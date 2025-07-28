const path = require('path');
const fs = require('fs');
const { exec, spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid')
const activeProcesses = new Map()
const cron = require('node-cron');
const cronParser = require('cron-parser');

const CACHE_FILE = path.join('/etc/nas-panel/updates-cache.json');
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 godzin cache
const SETTINGS_PATH = '/etc/nas-panel/settings.json';
const CRON_JOBS_FILE = path.join('/etc', 'nas-panel', 'cron-jobs.json');

let updateCronJob = null;
// Inicjalizacja zadań
const cronJobs = new Map();

// Helper do wykonania komendy z obietnicą

const execPromise = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const { signal } = controller;
    const timeout = setTimeout(() => {
      controller.abort();
    }, options.timeout || 30000);

    const child = exec(command, {
      ...options,
      signal // Dodajemy obsługę abort
    }, (error, stdout, stderr) => {
      clearTimeout(timeout);
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(stdout);
      }
    });

    // Lepsze zarządzanie strumieniami
    let fullStdout = '';
    let fullStderr = '';

    child.stdout?.on('data', (data) => {
      fullStdout += data;
      // Debugowanie tylko pierwszych 500 znaków
      if (fullStdout.length < 500) {
        //console.debug('stdout chunk:', data.toString().trim());
      }
    });

    child.stderr?.on('data', (data) => {
      fullStderr += data;
      //console.error('stderr chunk:', data.toString().trim());
    });

    child.on('close', (code) => {
      if (code !== 0 && !fullStderr) {
        fullStderr = `Process exited with code ${code}`;
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      err.stdout = fullStdout;
      err.stderr = fullStderr;
      reject(err);
    });
  });
};

// Helper do zapisywania i odczytywania cache
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading cache:', e);
  }
  return null;
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      timestamp: Date.now(),
      data
    }), 'utf8');
  } catch (e) {
    console.error('Error writing cache:', e);
  }
}

// Funkcja do sprawdzania aktualizacji z możliwością wymuszenia
async function checkForUpdates(force = false) {
  // Sprawdź cache jeśli nie wymuszamy
  if (!force) {
    const cache = readCache();
    if (cache && (Date.now() - cache.timestamp < CACHE_TTL)) {
      return cache.data;
    }
  }

  try {
    await execPromise('timeout 30 apt-get update');
    const output = await execPromise('apt-get -s dist-upgrade');
    const updates = [];
    const packageNames = new Set();
    
    output.split('\n').forEach(line => {
      if (line.startsWith('Inst ')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const name = parts[1];
          if (!packageNames.has(name)) {
            packageNames.add(name);
            updates.push({
              name,
              current_version: parts[2].replace(/[()]/g, ''),
              new_version: parts[3],
              description: '' // Inicjalizacja pustego opisu
            });
          }
        }
      }
    });

    // Poprawione pobieranie opisów
    if (updates.length > 0) {
      const descriptions = await execPromise(
        `apt-cache show ${Array.from(packageNames).join(' ')} | ` +
        `awk '/^Package:/ {pkg=$2} /^Description(-[a-z]+)?:/ {desc=desc ? desc " " $0 : $0} ` +
        `/^$/ {if (pkg && desc) {print pkg ":" desc; desc=""; pkg=""}} END {if (pkg && desc) print pkg ":" desc}'`
      );
      
      const descMap = {};
      descriptions.split('\n').forEach(line => {
        const [pkg, ...descParts] = line.split(':');
        if (pkg && descParts.length > 0) {
          // Usuwamy prefix "Description:" z opisu
          descMap[pkg] = descParts.join(':')
            .replace(/^Description(-[a-z]+)?:\s*/, '')
            .trim();
        }
      });

      updates.forEach(update => {
        update.description = descMap[update.name] || 'No Description';
      });
    }

    writeCache(updates);
    return updates;
  } catch (error) {
    console.error('Update check error:', error);
    throw error;
  }
}

// Zaplanuj automatyczne odświeżanie o północy
cron.schedule('0 0 * * *', () => {
  console.log('Running scheduled apt update at midnight...');
  checkForUpdates(true).then(() => {
    console.log('Scheduled update completed');
  });
});

module.exports = function(app, requireAuth) {
  app.get('/system/updates/check', requireAuth, async (req, res) => {
    try {
      const forceRefresh = req.query.force === 'true';
      const updates = await checkForUpdates(forceRefresh);
      res.json({ updates });
    } catch (error) {
      console.error('Update check error:', error);
      res.status(500).json({ 
        message: 'Failed to check updates', 
        error: error.toString()
      });
    }
  });

app.get('/system/updates/check-deps/:pkg', requireAuth, async (req, res) => {
  try {
    const { pkg } = req.params
    const output = await execPromise(`apt-get install -s ${pkg}`)
    
    // Analiza zależności
    const dependencies = output.match(/Inst\s([^\s]+)/g)
      ?.map(dep => dep.replace('Inst ', ''))
      ?.filter(dep => dep !== pkg) || []
    
    res.json({ 
      package: pkg,
      dependencies,
      totalSize: extractDownloadSize(output)
    })
  } catch (err) {
    res.status(400).json({ 
      message: 'Dependency check failed',
      error: err.toString(),
      output: err.output?.toString()
    })
  }
});

// Instalacja aktualizacji
app.post('/system/updates/install', requireAuth, async (req, res) => {
  const { packages = [], no_confirm = false } = req.body
  
  try {
    let command
    if (packages.length > 0) {
      command = `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(' ')}`
    } else {
      command = `DEBIAN_FRONTEND=noninteractive apt-get upgrade -y`
    }

    // Uruchomienie w tle z zapisem PID
    const child = exec(command, { detached: true })
    const processId = uuidv4()
    
    activeProcesses.set(processId, {
      child,
      packages,
      startTime: new Date()
    })

    res.json({ 
      success: true,
      processId,
      message: 'Installation started in background'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.toString()
    })
  }
});

// Endpoint do śledzenia postępu (SSE)
app.get('/system/updates/progress/:pkg', requireAuth, (req, res) => {
  const { pkg } = req.params
  
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Symulacja postępu (w rzeczywistości parsuj stdout apt)
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      res.write(`data: ${JSON.stringify({
        progress: 100,
        status: 'success',
        message: 'Installation complete'
      })}\n\n`)
      setTimeout(() => res.end(), 1000)
    } else {
      res.write(`data: ${JSON.stringify({
        progress,
        message: progress < 30 ? 'Downloading...' : 
                progress < 70 ? 'Installing...' : 'Finalizing...',
        status: ''
      })}\n\n`)
    }
  }, 800)

  req.on('close', () => {
    clearInterval(interval)
  })
})

// Anulowanie instalacji
app.delete('/system/updates/cancel/:pkg', requireAuth, async (req, res) => {
  const { pkg } = req.params
  const process = [...activeProcesses.values()].find(p => p.packages.includes(pkg))
  
  if (!process) {
    return res.status(404).json({ message: 'Process not found' })
  }

  try {
    process.child.kill('SIGTERM')
    await new Promise(resolve => process.child.on('exit', resolve))
    
    process.clients.forEach(client => {
      client.res.write(`data: ${JSON.stringify({
        progress: 0,
        status: 'exception',
        message: 'Installation cancelled by user'
      })}\n\n`)
      client.res.end()
    })
    
    activeProcesses.delete(process.id)
    res.json({ message: 'Installation cancelled' })
  } catch (err) {
    res.status(500).json({ 
      message: 'Failed to cancel installation',
      error: err.toString()
    })
  }
})

// Endpoint zdrowia systemu
app.get('/api/system-health', (req, res) => {
  res.status(200).json({ status: 'healthy' })
})

// Endpoint restartu systemu
app.post('/api/system-restart', requireAuth, (req, res) => {
  // W rzeczywistości tutaj powinna być logika restartu systemu
  console.log('Received restart command')
  
  // Symulacja opóźnienia restartu
  setTimeout(() => {
    // W rzeczywistości tutaj powinno być wywołanie systemowe np.:
    // require('child_process').exec('sudo reboot')
    process.exit(0) // Tylko dla testów - wyłącza serwer Node
  }, 3000)
  
  res.json({ status: 'restarting' })
})

// Funkcja do ładowania ustawień
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const rawData = fs.readFileSync(SETTINGS_PATH, 'utf8');
      const settings = JSON.parse(rawData);
      
      // Upewnij się, że cronJobs istnieje i jest tablicą
      if (!Array.isArray(settings.cronJobs)) {
        settings.cronJobs = [];
      }
      
      return settings;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  // Domyślne ustawienia jeśli plik nie istnieje
    return {
      docker: {
        composeDir: '/opt/docker/compose',
        dataRoot: '/var/lib/docker',
        autoStart: true
      },
      system: {
        hostname: '',
        timezone: 'Europe/Warsaw',
        language: 'pl'
      },
      ui: {
        theme: 'system',
        sidebarMode: 'vertical'
      },
      services: {
        monitoredServices: []
      },
      updates: {
        autoUpdate: false,
        schedule: '0 0 * * *',
        updateCommand: 'sudo apt-get update && sudo apt-get upgrade -y'
      },
      cronJobs: []
    }
}

// Funkcja do zapisywania ustawień
function saveSettings(settings) {
  try {
    // Upewnij się, że katalog istnieje
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// Pobierz ustawienia
app.get('/system/settings', (req, res) => {

    const settings = loadSettings();

    // Upewnij się, że istnieją pola do aktualizacji
    if (!settings.updates) {
      settings.updates = {
        autoUpdate: false,
        schedule: '0 0 * * *',
        updateCommand: 'sudo apt-get update && sudo apt-get upgrade -y'
      };
    }
    
    res.json(settings);
});

// Zapisz ustawienia
app.post('/system/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    // Zaktualizuj harmonogram cron jeśli się zmienił
    if (settings.updates) {
      updateCronSchedule(settings.updates);
    }
    
    await fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

async function updateCronSchedule(updateSettings) {
  const UPDATE_JOB_ID = 'system-auto-updates'; // Stałe ID dla tego zadania

  // Usuń istniejące zadanie jeśli istnieje
  if (updateCronJob) {
    updateCronJob.destroy();
    updateCronJob = null;
  }
  
  if (cronJobs.has(UPDATE_JOB_ID)) {
    cronJobs.get(UPDATE_JOB_ID).task.stop();
    cronJobs.delete(UPDATE_JOB_ID);
  }

  if (updateSettings.autoUpdate) {
    try {
      // Utwórz nowe zadanie
      const task = cron.schedule(
        updateSettings.schedule,
        async () => {
          console.log('Running scheduled system update...');
          try {
            await execPromise(updateSettings.updateCommand);
            // Aktualizuj informacje o ostatnim wykonaniu
            cronJobs.set(UPDATE_JOB_ID, {
              ...cronJobs.get(UPDATE_JOB_ID),
              lastRun: new Date(),
              nextRun: calculateNextRun(updateSettings.schedule)
            });
            saveCronJobs();
            console.log('System updates completed');
          } catch (error) {
            console.error('System updates failed:', error);
          }
        },
        {
          scheduled: true,
          timezone: 'Europe/Warsaw'
        }
      );

      // Oblicz następne wykonanie
      const nextRun = calculateNextRun(updateSettings.schedule);

      // Zapisz zadanie w głównej mapie zadań
      cronJobs.set(UPDATE_JOB_ID, {
        id: UPDATE_JOB_ID,
        name: 'Automatyczne aktualizacje systemu',
        schedule: updateSettings.schedule,
        command: updateSettings.updateCommand,
        description: 'Automatyczne aktualizacje systemu zgodnie z ustawieniami',
        task: task,
        nextRun: nextRun,
        lastRun: null,
        isSystemJob: true
      });

      updateCronJob = task;
      saveCronJobs();
    } catch (error) {
      console.error('Error creating system update cron job:', error);
    }
  }
}


  app.get('/services/status/:service', async (req, res) => {
    const { service } = req.params
    
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service}`)
      res.json({
        success: true,
        active: stdout.trim() === 'active',
        service
      })
    } catch (error) {
      res.json({
        success: true,
        active: false,
        service,
        error: error.stderr || error.message
      })
    }
  });

// Helper functions
function getStatusMessage(progress) {
  const phases = [
    { range: [0, 20], messages: ['Preparing installation', 'Checking dependencies'] },
    { range: [21, 50], messages: ['Downloading package', 'Verifying package'] },
    { range: [51, 80], messages: ['Installing package', 'Configuring system'] },
    { range: [81, 99], messages: ['Finalizing installation', 'Cleaning up'] },
    { range: [100, 100], messages: ['Installation complete'] }
  ]
  
  const phase = phases.find(p => progress >= p.range[0] && progress <= p.range[1])
  return phase.messages[Math.floor(Math.random() * phase.messages.length)]
}

// Helper functions
function parseAptProgress(line) {
  // Przykładowe parsowanie outputu apt
  if (line.includes('Unpacking')) {
    return { progress: 30, message: 'Unpacking package...', status: '' }
  }
  if (line.includes('Setting up')) {
    return { progress: 80, message: 'Configuring package...', status: '' }
  }
  if (line.match(/Get:\d+/)) {
    const match = line.match(/(\d+)%/)
    const percent = match ? parseInt(match[1]) : 0
    return { 
      progress: Math.floor(percent * 0.7), // Download to 70% całego procesu
      message: 'Downloading package...',
      status: '',
      indeterminate: percent === 0
    }
  }
  return null
}

function extractDownloadSize(output) {
  const match = output.match(/Need to get (\d+ [KM]B)/)
  return match ? match[1] : 'unknown'
}

// Cron jobs page


function saveCronJobs() {
  try {
    const jobsToSave = Array.from(cronJobs.values())
      .map(job => ({
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        command: job.command,
        description: job.description
      }));

    fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobsToSave, null, 2));
    
    // Dodatkowo zapisz ustawienia systemowe
    const settings = loadSettings();
    if (cronJobs.has('system-auto-updates')) {
      const updateJob = cronJobs.get('system-auto-updates');
      settings.updates = {
        autoUpdate: true,
        schedule: updateJob.schedule,
        updateCommand: updateJob.command
      };
    } else {
      settings.updates.autoUpdate = false;
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    
    return true;
  } catch (error) {
    return false;
  }
}

// Funkcja do ładowania zadań z pliku
function loadCronJobs() {
  try {
    if (fs.existsSync(CRON_JOBS_FILE)) {
      const data = fs.readFileSync(CRON_JOBS_FILE, 'utf8');
      const jobs = JSON.parse(data);
      return Array.isArray(jobs) ? jobs : [];
    }
  } catch (error) {
    console.error('Error loading cron jobs:', error);
  }
  return [];
}

// Funkcja tworząca nowe zadanie cron
async function createCronJob(job) {
  if (!isValidCronExpression(job.schedule)) {
    return false;
  }

  try {
    // Oblicz następne wykonanie
    const nextRun = calculateNextRun(job.schedule);
    
    // Utwórz zadanie
    const task = cron.schedule(
      job.schedule,
      async () => {
        try {
          await execPromise(job.command);
          
          // Aktualizuj daty po wykonaniu
          cronJobs.set(job.id, {
            ...cronJobs.get(job.id),
            lastRun: new Date(),
            nextRun: calculateNextRun(job.schedule)
          });
          saveCronJobs();
        } catch (err) {
        }
      },
      {
        scheduled: true,
        timezone: 'Europe/Warsaw'
      }
    );

    // Zapisz zadanie
    cronJobs.set(job.id, {
      ...job,
      task,
      nextRun,
      lastRun: null
    });

    saveCronJobs();
    return true;
  } catch (err) {
    return false;
  }
}

function isValidCronExpression(expression) {
  try {
    cronParser.CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

function calculateNextRun(cronExpression) {
  try {
    // Poprawne użycie CronExpressionParser
    const interval = cronParser.CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
      tz: 'Europe/Warsaw'
    });
    return interval.next().toDate();
  } catch (err) {
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    return nextRun;
  }
}

// Inicjalizacja zadań przy starcie
function initCronJobs() {
  // Wczytaj zwykłe zadania
  const jobs = loadCronJobs();
  jobs.forEach(job => {
    try {
      createCronJob({
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        command: job.command,
        description: job.description,
        isSystemJob: job.isSystemJob || false
      });
    } catch (error) {
      console.error('Error initializing cron job:', error);
    }
  });

  // Inicjalizuj zadanie aktualizacji systemu
  const settings = loadSettings();
  if (settings.updates?.autoUpdate) {
    updateCronSchedule(settings.updates);
  }
}

// Helper do walidacji harmonogramu
function isValidCronExpression(expression) {
  return cron.validate(expression);
}

// Endpointy CRUD dla zadań cron
app.get('/system/cron-jobs', requireAuth, (req, res) => {
  const jobs = Array.from(cronJobs.values()).map(job => {
    const nextRun = job.nextRun || calculateNextRun(job.schedule);
    
    return {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description,
      lastRun: job.lastRun?.toISOString(),
      nextRun: nextRun.toISOString(),
      isActive: !!job.task,
      isSystemJob: job.isSystemJob || false
    };
  });
  
  res.json(jobs);
});

app.post('/system/cron-jobs', requireAuth, async (req, res) => {
  try {
    const { schedule, command, name, description } = req.body;

    if (!cron.validate(schedule)) {
      return res.status(400).json({ error: 'Invalid cron schedule' });
    }

    const job = {
      id: uuidv4(),
      name: name || 'New Cron Job',
      schedule,
      command,
      description: description || ''
    };
    saveCronJobs();
    await createCronJob(job);
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cron job' });
  }
});

app.delete('/system/cron-jobs/:id', requireAuth, (req, res) => {
  const job = cronJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  job.task.stop();
  cronJobs.delete(req.params.id);
  saveCronJobs();

  res.json({ success: true });
});

// Endpoint do ręcznego uruchomienia zadania
app.post('/system/cron-jobs/:id/run', requireAuth, async (req, res) => {
  const job = cronJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    await execPromise(job.command);
    job.lastRun = new Date();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Funkcja do pobierania następnej daty wykonania
function getNextRun(schedule) {
  return cron.getNextDate(schedule, new Date());
}

// Funkcja pomocnicza do zapisywania zadań
function saveAllCronJobsToSettings() {
  const settings = loadSettings();
  settings.cronJobs = Array.from(cronJobs.values())
    .filter(job => !job.id.startsWith('system-'))
    .map(job => ({
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description
    }));
  
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Na końcu pliku, przed eksportem modułu
function migrateCronJobs() {
  const settings = loadSettings();
  if (settings.cronJobs && settings.cronJobs.length > 0 && !fs.existsSync(CRON_JOBS_FILE)) {
    console.log('Migrating cron jobs from settings.json to cron-jobs.json');
    fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(settings.cronJobs, null, 2));
  }
}

// Wywołaj migrację przy starcie
migrateCronJobs();
initCronJobs();

}
