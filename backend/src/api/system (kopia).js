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


// Load and save webserver configuration
function loadWebserverConfig() {
  const configPath = '/etc/nas-web/nas-web.conf';
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = {};
      
      content.split('\n').forEach(line => {
        // Pomijaj komentarze i puste linie
        if (!line.trim() || line.trim().startsWith('#')) return;
        
        // Usuń komentarze z końca linii i podziel na klucz-wartość
        const cleanLine = line.split('#')[0].trim();
        const [key, value] = cleanLine.split('=').map(part => part.trim());
        
        if (key && value !== undefined) {
          // Dla pól liczbowych (jak CACHE_MAX_SIZE) wyciągnij tylko wartość liczbową
          if (key === 'CACHE_MAX_SIZE' || key === 'CACHE_TTL' || 
              key === 'GZIP_MIN_SIZE' || key === 'HSTS_MAX_AGE' ||
              key === 'LOG_MAX_SIZE' || key === 'LOG_BACKUP_COUNT' ||
              key === 'MAX_THREADS' || key === 'MAX_CONNECTIONS' ||
              key === 'CONNECTION_TIMEOUT' || key === 'HTTP2_MAX_STREAMS' ||
              key === 'HTTP2_WINDOW_SIZE' || key === 'PORT') {
            const numericValue = value.match(/\d+/);
            config[key] = numericValue ? parseInt(numericValue[0], 10) : 0;
          }
          // Dla wartości logicznych
          else if (value.toLowerCase() === 'true') config[key] = true;
          else if (value.toLowerCase() === 'false') config[key] = false;
          // Dla pozostałych - string
          else config[key] = value;
        }
      });
      
      return config;
    }
  } catch (error) {
    console.error('Error loading webserver config:', error);
  }
  return null;
}

function saveWebserverConfig(config) {
  const configPath = '/etc/nas-web/nas-web.conf';
  try {
    // Upewnij się, że katalog istnieje
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let content = `# NAS-WEB Server Configuration\n`;
    
    // Sekcja podstawowa
    content += `PORT=${config.PORT}\n`;
    content += `FRONTEND_PATH=${config.FRONTEND_PATH}\n`;
    content += `API_PREFIX=${config.API_PREFIX}\n\n`;
    
    // Sekcja HTTPS
    content += `# HTTPS Configuration\n`;
    content += `ENABLE_HTTPS=${config.ENABLE_HTTPS}\n`;
    if (config.ENABLE_HTTPS) {
      content += `SSL_CERT_PATH=${config.SSL_CERT_PATH}\n`;
      content += `SSL_KEY_PATH=${config.SSL_KEY_PATH}\n`;
    } else {
      content += `# SSL_CERT_PATH=/path/to/cert.pem  # komentarz gdy HTTPS wyłączony\n`;
      content += `# SSL_KEY_PATH=/path/to/key.pem    # komentarz gdy HTTPS wyłączony\n`;
    }
    content += `\n`;
    
    // Sekcja Cache - teraz bez komentarzy w tej samej linii
    content += `# Cache Configuration\n`;
    content += `CACHE_ENABLED=${config.CACHE_ENABLED}\n`;
    content += `CACHE_MAX_SIZE=${config.CACHE_MAX_SIZE}\n`;
    content += `CACHE_TTL=${config.CACHE_TTL}\n\n`;
    
    // Sekcja Compression
    content += `# Compression\n`;
    content += `GZIP_ENABLED=${config.GZIP_ENABLED}\n`;
    content += `GZIP_MIN_SIZE=${config.GZIP_MIN_SIZE}  # Minimum file size to compress (bytes)\n\n`;
    
    // Sekcja Security Headers
    content += `# Security Headers\n`;
    content += `CORS_ENABLED=${config.CORS_ENABLED}\n`;
    content += `HSTS_ENABLED=${config.HSTS_ENABLED}\n`;
    content += `HSTS_MAX_AGE=${config.HSTS_MAX_AGE}  # 1 year\n\n`;
    
    // Sekcja Logging
    content += `# Logging\n`;
    content += `LOG_LEVEL=${config.LOG_LEVEL}        # debug, info, warning, error\n`;
    content += `LOG_FILE=${config.LOG_FILE}\n`;
    content += `LOG_MAX_SIZE=${config.LOG_MAX_SIZE}       # in MB\n`;
    content += `LOG_BACKUP_COUNT=${config.LOG_BACKUP_COUNT}    # number of rotated logs to keep\n\n`;
    
    // Sekcja Performance
    content += `# Performance\n`;
    content += `THREADPOOL_ENABLED=${config.THREADPOOL_ENABLED}\n`;
    content += `MAX_THREADS=${config.MAX_THREADS}\n`;
    content += `MAX_CONNECTIONS=${config.MAX_CONNECTIONS}\n`;
    content += `CONNECTION_TIMEOUT=${config.CONNECTION_TIMEOUT}  # in seconds\n\n`;
    
    // Sekcja HTTP/2
    content += `# HTTP/2 Configuration\n`;
    content += `HTTP2_ENABLED=${config.HTTP2_ENABLED}\n`;
    if (config.HTTP2_ENABLED) {
      content += `HTTP2_CERT_PATH=${config.HTTP2_CERT_PATH}\n`;
      content += `HTTP2_KEY_PATH=${config.HTTP2_KEY_PATH}\n`;
    } else {
      content += `# HTTP2_CERT_PATH=/path/to/http2_cert.pem\n`;
      content += `# HTTP2_KEY_PATH=/path/to/http2_key.pem\n`;
    }
    content += `HTTP2_MAX_STREAMS=${config.HTTP2_MAX_STREAMS}\n`;
    content += `HTTP2_WINDOW_SIZE=${config.HTTP2_WINDOW_SIZE}  # in bytes\n`;
    
    fs.writeFileSync(configPath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving webserver config:', error);
    return false;
  }
}


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
  // Najpierw sprawdź cache jeśli nie wymuszamy
  if (!force) {
    const cache = readCache();
    if (cache && (Date.now() - cache.timestamp < CACHE_TTL)) {
      return cache.data;
    }
  }

  try {
    // Uruchom tylko jeśli wymuszone lub cache wygasło
    await execPromise('timeout 30 apt-get update');
    const output = await execPromise('apt-get -s dist-upgrade');
    const updates = parseAptUpdates(output);
    
    if (updates.length > 0) {
      await enrichWithPackageDescriptions(updates);
    }

    writeCache(updates);
    return updates;
  } catch (error) {
    console.error('Update check error:', error);
    throw error;
  }
}

function parseAptUpdates(output) {
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
            description: ''
          });
        }
      }
    }
  });
  
  return updates;
}

async function enrichWithPackageDescriptions(updates) {
  const packageNames = updates.map(u => u.name).join(' ');
  const descriptions = await execPromise(
    `apt-cache show ${packageNames} | ` +
    `awk '/^Package:/ {pkg=$2} /^Description(-[a-z]+)?:/ {desc=desc ? desc " " $0 : $0} ` +
    `/^$/ {if (pkg && desc) {print pkg ":" desc; desc=""; pkg=""}} END {if (pkg && desc) print pkg ":" desc}'`
  );
  
  const descMap = {};
  descriptions.split('\n').forEach(line => {
    const [pkg, ...descParts] = line.split(':');
    if (pkg && descParts.length > 0) {
      descMap[pkg] = descParts.join(':')
        .replace(/^Description(-[a-z]+)?:\s*/, '')
        .trim();
    }
  });

  updates.forEach(update => {
    update.description = descMap[update.name] || 'No Description';
  });
}

// Zaplanuj automatyczne odświeżanie o północy
cron.schedule('0 0 * * *', () => {
  console.log('Running scheduled apt update at midnight...');
  checkForUpdates(true).then(() => {
    console.log('Scheduled update completed');
  });
});

module.exports = function(app, requireAuth) {
app.locals.clients = new Set();

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
  const { packages = [], no_confirm = false } = req.body;
  
  try {
    const processId = uuidv4();
    let command;
    
    if (packages.length > 0) {
      command = `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(' ')}`;
    } else {
      command = `DEBIAN_FRONTEND=noninteractive apt-get upgrade -y`;
    }

    const child = spawn('/bin/bash', ['-c', command], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const processData = {
      id: processId,
      child,
      packages,
      startTime: new Date(),
      clients: new Set(),
      output: ''
    };

    activeProcesses.set(processId, processData);

    // Przetwarzanie outputu w czasie rzeczywistym
    child.stdout.on('data', (data) => {
      const output = data.toString();
      processData.output += output;
      
      // Przetwarzaj postęp instalacji
      const progressData = parseAptProgress(output);
      
      // Powiadom wszystkich klientów
      processData.clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      });
    });

    child.stderr.on('data', (data) => {
      processData.output += data.toString();
    });

    child.on('close', (code) => {
      const success = code === 0;
      
      processData.clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({
          progress: success ? 100 : 0,
          status: success ? 'success' : 'exception',
          message: success ? 'Installation complete' : `Installation failed with code ${code}`
        })}\n\n`);
        client.res.end();
      });
      
      activeProcesses.delete(processId);
    });

    res.json({ 
      success: true,
      processId,
      message: 'Installation started in background'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.toString()
    });
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

// Pobierz konfigurację webservera
  app.get('/system/webserver-config', requireAuth, (req, res) => {
    const config = loadWebserverConfig();
    if (config) {
      res.json(config);
    } else {
      res.status(500).json({ error: 'Failed to load webserver config' });
    }
  });

// Zapisz konfigurację webservera
  app.post('/system/save-webserver-config', requireAuth, (req, res) => {
    const success = saveWebserverConfig(req.body);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save webserver config' });
    }
  });

async function updateCronSchedule(updateSettings) {
  const UPDATE_JOB_ID = 'system-auto-updates';

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
      const task = cron.schedule(
        updateSettings.schedule,
        async () => {
          console.log('Running scheduled system update...');
          try {
            const updates = await checkForUpdates(true); // Wymuś aktualizację
            
            if (updates.length > 0) {
            
              // Jeśli auto-instalacja jest włączona
              if (updateSettings.autoInstall) {
                await execPromise(updateSettings.updateCommand);
              }
            }

            cronJobs.set(UPDATE_JOB_ID, {
              ...cronJobs.get(UPDATE_JOB_ID),
              lastRun: new Date(),
              nextRun: calculateNextRun(updateSettings.schedule)
            });
            saveCronJobs();
          } catch (error) {
            console.error('System updates failed:', error);
          }
        },
        {
          scheduled: true,
          timezone: 'Europe/Warsaw'
        }
      );

      const nextRun = calculateNextRun(updateSettings.schedule);

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
function parseAptProgress(output) {
  const lines = output.split('\n');
  let progress = 0;
  let message = 'Starting installation...';
  let status = '';
  
  for (const line of lines) {
    if (line.includes('Unpacking')) {
      progress = Math.min(progress + 10, 70);
      message = `Unpacking: ${line.split('Unpacking ')[1]}`;
    } 
    else if (line.includes('Setting up')) {
      progress = Math.min(progress + 5, 95);
      message = `Configuring: ${line.split('Setting up ')[1]}`;
    }
    else if (line.match(/Get:\d+/)) {
      const percentMatch = line.match(/(\d+)%/);
      if (percentMatch) {
        progress = Math.min(parseInt(percentMatch[1]) * 0.7, 70);
        message = `Downloading packages...`;
      }
    }
    else if (line.includes('Reading package lists')) {
      progress = 5;
      message = 'Reading package lists...';
    }
    else if (line.includes('Building dependency tree')) {
      progress = 10;
      message = 'Building dependency tree...';
    }
  }
  
  return {
    progress,
    message,
    status,
    time: new Date().toISOString()
  };
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

// Endpoint do wykonania aktualizacji
app.post('/api/system/update', requireAuth, async (req, res) => {
  try {
    exec('sudo /usr/bin/update-script.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`Błąd aktualizacji: ${error}`)
        return res.status(500).json({ error: 'Błąd podczas aktualizacji' })
      }
      res.json({ message: 'Aktualizacja rozpoczęta' })
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Endpoint do zaplanowania aktualizacji
app.post('/api/system/schedule-update', requireAuth, async (req, res) => {
  const { time } = req.body
  
  try {
    // Tutaj dodaj logikę planowania (np. cron job)
    exec(`echo "sudo /usr/bin/update-script.sh" | at ${time}`, (error) => {
      if (error) {
        return res.status(500).json({ error: 'Błąd podczas planowania' })
      }
      res.json({ message: `Aktualizacja zaplanowana na ${time}` })
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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
