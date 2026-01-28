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

// GET dla pojedynczego pakietu
app.get('/system/updates/details/:package', requireAuth, async (req, res) => {
  try {
    const { package } = req.params;
    
    // Pobierz szczegółowe informacje o pakiecie
    const details = await execPromise(`apt-cache show ${package}`);
    
    // Parsowanie danych wyjściowych apt-cache show
    const packageDetails = parsePackageDetails(details);
    
    res.json({
      success: true,
      package,
      details: packageDetails
    });
  } catch (error) {
    console.error('Error fetching package details:', error);
    res.status(500).json({
      success: false,
      error: error.toString(),
      message: 'Failed to fetch package details'
    });
  }
});

// POST dla wielu pakietów (frontend wysyła POST)
app.post('/system/updates/details', requireAuth, async (req, res) => {
  try {
    const { packages } = req.body;
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Package list is required and must be an array'
      });
    }
    
    const packageDetails = {};
    
    // Pobierz szczegóły dla każdego pakietu równolegle
    const promises = packages.map(async (pkg) => {
      try {
        const details = await execPromise(`apt-cache show ${pkg}`);
        packageDetails[pkg] = parsePackageDetails(details);
      } catch (error) {
        console.error(`Error fetching details for ${pkg}:`, error);
        packageDetails[pkg] = {
          error: error.toString(),
          message: 'Failed to fetch package details'
        };
      }
    });
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      packages: packageDetails
    });
  } catch (error) {
    console.error('Error fetching package details:', error);
    res.status(500).json({
      success: false,
      error: error.toString(),
      message: 'Failed to fetch package details'
    });
  }
});

app.get('/system/updates/changelog/:package', requireAuth, async (req, res) => {
  try {
    const { package } = req.params;
    const { version } = req.query; // Opcjonalna wersja
    
    let command;
    if (version) {
      command = `apt-get changelog ${package}=${version}`;
    } else {
      // Pobierz changelog dla aktualnej wersji
      const currentVersion = await execPromise(`apt-cache policy ${package} | grep Installed | cut -d: -f2`);
      const cleanVersion = currentVersion.trim();
      if (cleanVersion && cleanVersion !== '(none)') {
        command = `apt-get changelog ${package}=${cleanVersion}`;
      } else {
        command = `apt-get changelog ${package}`;
      }
    }
    
    const changelog = await execPromise(command);
    
    res.json({
      success: true,
      package,
      changelog: changelog
    });
  } catch (error) {
    console.error('Error fetching changelog:', error);
    res.status(500).json({
      success: false,
      error: error.toString(),
      message: 'Failed to fetch changelog'
    });
  }
});

app.post('/system/updates/changelog', requireAuth, async (req, res) => {
  try {
    const { packages } = req.body;
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Package list is required and must be an array'
      });
    }
    
    const changelogs = {};
    
    // Pobierz changelogi dla każdego pakietu
    const promises = packages.map(async (pkg) => {
      try {
        const changelog = await execPromise(`apt-get changelog ${pkg}`);
        changelogs[pkg] = changelog;
      } catch (error) {
        console.error(`Error fetching changelog for ${pkg}:`, error);
        changelogs[pkg] = `Error: ${error.toString()}`;
      }
    });
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      changelogs: changelogs
    });
  } catch (error) {
    console.error('Error fetching changelogs:', error);
    res.status(500).json({
      success: false,
      error: error.toString(),
      message: 'Failed to fetch changelogs'
    });
  }
});


// Dodaj także funkcję pomocniczą do parsowania szczegółów pakietu
function parsePackageDetails(detailsOutput) {
  const lines = detailsOutput.split('\n');
  const details = {
    name: '',
    version: '',
    architecture: '',
    maintainer: '',
    installedSize: 0,
    depends: [],
    description: '',
    homepage: '',
    priority: '',
    section: '',
    source: ''
  };
  
  let currentField = '';
  
  for (const line of lines) {
    if (line.startsWith('Package:')) {
      details.name = line.split(':')[1].trim();
    } else if (line.startsWith('Version:')) {
      details.version = line.split(':')[1].trim();
    } else if (line.startsWith('Architecture:')) {
      details.architecture = line.split(':')[1].trim();
    } else if (line.startsWith('Maintainer:')) {
      details.maintainer = line.split(':')[1].trim();
    } else if (line.startsWith('Installed-Size:')) {
      const size = line.split(':')[1].trim();
      details.installedSize = parseInt(size) || 0;
    } else if (line.startsWith('Depends:')) {
      const deps = line.split(':')[1].trim();
      details.depends = deps.split(',').map(dep => dep.trim()).filter(dep => dep);
    } else if (line.startsWith('Description:')) {
      details.description = line.split(':').slice(1).join(':').trim();
      currentField = 'description';
    } else if (line.startsWith('Homepage:')) {
      details.homepage = line.split(':')[1].trim();
    } else if (line.startsWith('Priority:')) {
      details.priority = line.split(':')[1].trim();
    } else if (line.startsWith('Section:')) {
      details.section = line.split(':')[1].trim();
    } else if (line.startsWith('Source:')) {
      details.source = line.split(':')[1].trim();
    } else if (currentField === 'description' && line.startsWith(' ')) {
      // Kontynuacja opisu (wcięta linia)
      details.description += '\n' + line.trim();
    }
  }
  
  return details;
}

// Możesz też dodać endpoint do pobierania listy wszystkich pakietów
app.get('/system/updates/packages', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    let command = 'apt-cache search . | head -100';
    
    if (search) {
      command = `apt-cache search "${search}" | head -50`;
    }
    
    const output = await execPromise(command);
    const packages = output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(' - ');
        return {
          name: parts[0]?.trim() || '',
          description: parts.slice(1).join(' - ').trim()
        };
      });
    
    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      error: error.toString()
    });
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
app.get('/system/updates/progress/:processId', requireAuth, (req, res) => {
  const { processId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Znajdź aktywny proces
  const process = activeProcesses.get(processId);
  
  if (!process) {
    res.write(`data: ${JSON.stringify({
      progress: 0,
      status: 'error',
      message: 'Process not found'
    })}\n\n`);
    res.end();
    return;
  }

  // Dodaj klienta do procesu
  const client = { res };
  process.clients.add(client);

  // Jeśli proces już się zakończył, wyślij status
  if (process.output && process.output.includes('Installation complete')) {
    res.write(`data: ${JSON.stringify({
      progress: 100,
      status: 'success',
      message: 'Installation complete'
    })}\n\n`);
    res.end();
    process.clients.delete(client);
    return;
  }

  // Wyślij aktualny output jeśli istnieje
  if (process.output) {
    const progressData = parseAptProgress(process.output);
    res.write(`data: ${JSON.stringify(progressData)}\n\n`);
  }

  // Obsługa zamknięcia połączenia
  req.on('close', () => {
    process.clients.delete(client);
    
    // Jeśli nie ma już klientów, wyczyść po czasie
    if (process.clients.size === 0) {
      setTimeout(() => {
        if (process.clients.size === 0 && !process.output?.includes('Installation complete')) {
          process.clients.clear();
        }
      }, 5000);
    }
  });
});

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

function monitorActiveProcesses() {
  setInterval(() => {
    activeProcesses.forEach((process, processId) => {
      // Sprawdź czy proces nadal działa
      if (process.child && process.child.exitCode !== null) {
        // Proces zakończony
        const success = process.child.exitCode === 0;
        const message = success ? 'Installation complete' : `Installation failed with code ${process.child.exitCode}`;
        
        // Powiadom wszystkich klientów
        process.clients.forEach(client => {
          try {
            client.res.write(`data: ${JSON.stringify({
              progress: success ? 100 : 0,
              status: success ? 'success' : 'error',
              message: message
            })}\n\n`);
            client.res.end();
          } catch (err) {
            console.error('Error sending SSE to client:', err);
          }
        });
        
        // Wyczyść klientów
        process.clients.clear();
        
        // Po 30 sekundach usuń proces z pamięci
        setTimeout(() => {
          activeProcesses.delete(processId);
        }, 30000);
      }
    });
  }, 1000); // Sprawdzaj co sekundę
}


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
  let currentPackage = '';
  
  for (const line of lines) {
    // Parsowanie postępu pobierania
    if (line.match(/Get:\d+\s+\d+\/\d+\s+/)) {
      const match = line.match(/(\d+)%/);
      if (match) {
        progress = Math.min(parseInt(match[1]), 70);
        message = 'Downloading packages...';
      }
    }
    // Parsowanie wypakowywania
    else if (line.includes('Unpacking')) {
      progress = Math.min(progress + 5, 85);
      const pkgMatch = line.match(/Unpacking\s+([^(]+)/);
      if (pkgMatch) {
        currentPackage = pkgMatch[1].trim();
        message = `Unpacking ${currentPackage}...`;
      }
    }
    // Parsowanie konfiguracji
    else if (line.includes('Setting up')) {
      progress = Math.min(progress + 5, 95);
      const pkgMatch = line.match(/Setting up\s+([^(]+)/);
      if (pkgMatch) {
        currentPackage = pkgMatch[1].trim();
        message = `Configuring ${currentPackage}...`;
      }
    }
    // Koniec instalacji
    else if (line.includes('Processing triggers for') || 
             line.includes('Preparing to unpack')) {
      progress = Math.min(progress + 1, 99);
    }
    // Błędy
    else if (line.includes('E:') || line.includes('Error:')) {
      status = 'error';
      message = `Error: ${line}`;
    }
    // Ostrzeżenia
    else if (line.includes('W:') || line.includes('Warning:')) {
      status = 'warning';
      message = `Warning: ${line}`;
    }
  }
  
  // Jeśli osiągnięto 100%, oznaczenie sukcesu
  if (output.includes('apt-get upgrade -y') && output.length > 1000) {
    const linesCount = lines.length;
    if (linesCount > 50 && progress >= 95) {
      progress = 100;
      message = 'Installation complete';
      status = 'success';
    }
  }
  
  return {
    progress,
    message,
    status,
    currentPackage,
    timestamp: new Date().toISOString()
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
        description: job.description || '',
        isActive: job.isActive,
        isSystemJob: job.isSystemJob || false,
        lastRun: job.lastRun,
        nextRun: job.nextRun
      }));

    fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobsToSave, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving cron jobs:', error);
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
    throw new Error('Invalid cron expression');
  }

  try {
    const nextRun = calculateNextRun(job.schedule);
    
    const task = cron.schedule(
      job.schedule,
      async () => {
        try {
          console.log(`Executing cron job: ${job.name} (${job.id})`);
          await execPromise(job.command, { timeout: 300000 }); // 5 min timeout
          
          cronJobs.set(job.id, {
            ...cronJobs.get(job.id),
            lastRun: new Date(),
            nextRun: calculateNextRun(job.schedule)
          });
          saveCronJobs();
        } catch (err) {
          console.error(`Cron job execution error (${job.id}):`, err);
        }
      },
      {
        scheduled: job.isActive !== false, // domyślnie aktywne
        timezone: 'Europe/Warsaw'
      }
    );

    cronJobs.set(job.id, {
      ...job,
      task,
      nextRun,
      lastRun: null,
      isActive: job.isActive !== false
    });

    saveCronJobs();
    return true;
  } catch (err) {
    console.error(`Error creating cron job ${job.id}:`, err);
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
    if (cronExpression.startsWith('@')) {
      // Obsługa specjalnych wyrażeń
      const now = new Date();
      const nextRun = new Date(now);
      
      switch(cronExpression) {
        case '@yearly':
        case '@annually':
          nextRun.setFullYear(nextRun.getFullYear() + 1);
          break;
        case '@monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
        case '@weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case '@daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case '@hourly':
          nextRun.setHours(nextRun.getHours() + 1);
          break;
        case '@reboot':
          return null; // Nie obliczamy dla reboot
        default:
          return new Date(now.getTime() + 3600000); // domyślnie za godzinę
      }
      return nextRun;
    }
    
    // Dla normalnych wyrażeń cron
    const now = new Date();
    const interval = cronParser.CronExpression.parse(cronExpression, {
      currentDate: now,
      tz: 'Europe/Warsaw'
    });
    return interval.next().toDate();
  } catch (err) {
    console.error('Error calculating next run:', err);
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
        description: job.description || '',
        isActive: job.isActive !== false,
        isSystemJob: job.isSystemJob || false
      });
    } catch (error) {
      console.error('Error initializing cron job:', error);
    }
  });

  // Inicjalizuj zadanie aktualizacji systemu
  const settings = loadSettings();
  if (settings.updates?.autoUpdate) {
    try {
      updateCronSchedule(settings.updates);
    } catch (error) {
      console.error('Error initializing system update job:', error);
    }
  }
  
  // Dodaj domyślne zadanie backupu systemowego jeśli nie istnieje
  const SYSTEM_BACKUP_JOB_ID = 'system-scheduled-backup';
  if (!cronJobs.has(SYSTEM_BACKUP_JOB_ID)) {
    try {
      const backupJob = {
        id: SYSTEM_BACKUP_JOB_ID,
        name: 'Zaplanowany backup systemu',
        schedule: '0 2 * * *', // codziennie o 2:00
        command: 'sudo /usr/local/bin/backup-system.sh',
        description: 'Automatyczny backup systemu i danych',
        isActive: false, // domyślnie wyłączone
        isSystemJob: true
      };
      
      createCronJob(backupJob);
      console.log('Created system backup cron job');
    } catch (error) {
      console.error('Error creating system backup job:', error);
    }
  }
}

// Helper do walidacji harmonogramu
function isValidCronExpression(expression) {
  return cron.validate(expression);
}

// Endpointy CRUD dla zadań cron
app.get('/system/cron-jobs', requireAuth, (req, res) => {
  const jobs = Array.from(cronJobs.values()).map(job => {
    const nextRun = job.isActive ? (job.nextRun || calculateNextRun(job.schedule)) : null;
    
    return {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description || '',
      lastRun: job.lastRun?.toISOString(),
      nextRun: nextRun?.toISOString(),
      isActive: job.isActive !== false,
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
    console.log(`Manually running cron job: ${job.name} (${job.id})`);
    
    // Uruchom komendę z timeoutem
    await execPromise(job.command, { timeout: 300000 });
    
    // Zaktualizuj daty
    job.lastRun = new Date();
    job.nextRun = calculateNextRun(job.schedule);
    
    // Zapisz zmiany
    saveCronJobs();
    
    res.json({ 
      success: true, 
      message: 'Job executed successfully',
      lastRun: job.lastRun,
      nextRun: job.nextRun
    });
  } catch (error) {
    console.error(`Error running job ${job.id}:`, error);
    
    // Ustaw błąd ale nie aktualizuj dat
    job.lastError = error.message;
    
    res.status(500).json({ 
      error: 'Job execution failed',
      message: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
  }
});

app.patch('/system/cron-jobs/:id/status', requireAuth, (req, res) => {
  const job = cronJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const { isActive } = req.body;
  
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }
  
  try {
    if (isActive) {
      job.task.start();
    } else {
      job.task.stop();
    }
    
    job.isActive = isActive;
    job.nextRun = isActive ? calculateNextRun(job.schedule) : null;
    
    // Zapisz zmiany
    const jobs = loadCronJobs();
    const jobIndex = jobs.findIndex(j => j.id === job.id);
    if (jobIndex !== -1) {
      jobs[jobIndex].isActive = isActive;
      fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobs, null, 2));
    }
    
    res.json({ 
      success: true, 
      isActive,
      nextRun: job.nextRun
    });
  } catch (error) {
    console.error(`Error toggling job ${job.id}:`, error);
    res.status(500).json({ error: 'Failed to change job status' });
  }
});

app.put('/system/cron-jobs/:id', requireAuth, async (req, res) => {
  const job = cronJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.isSystemJob) {
    return res.status(400).json({ error: 'Cannot modify system jobs' });
  }
  
  const { name, schedule, command, description } = req.body;
  
  // Walidacja
  if (!cron.validate(schedule)) {
    return res.status(400).json({ error: 'Invalid cron schedule' });
  }
  
  if (!name || !command) {
    return res.status(400).json({ error: 'Name and command are required' });
  }
  
  try {
    // Zatrzymaj stare zadanie
    if (job.task) {
      job.task.stop();
    }
    
    // Utwórz nowe zadanie
    const task = cron.schedule(
      schedule,
      async () => {
        try {
          await execPromise(command, { timeout: 300000 });
          job.lastRun = new Date();
          job.nextRun = calculateNextRun(schedule);
          saveCronJobs();
        } catch (err) {
          console.error(`Cron job execution error (${job.id}):`, err);
          job.lastError = err.message;
        }
      },
      {
        scheduled: job.isActive,
        timezone: 'Europe/Warsaw'
      }
    );
    
    // Aktualizuj zadanie
    job.name = name;
    job.schedule = schedule;
    job.command = command;
    job.description = description || '';
    job.task = task;
    job.nextRun = job.isActive ? calculateNextRun(schedule) : null;
    
    // Zapisz zmiany
    const jobs = loadCronJobs();
    const jobIndex = jobs.findIndex(j => j.id === job.id);
    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        id: job.id,
        name,
        schedule,
        command,
        description: description || '',
        isActive: job.isActive,
        isSystemJob: false
      };
      fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobs, null, 2));
    }
    
    res.json({
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description,
      isActive: job.isActive,
      nextRun: job.nextRun,
      lastRun: job.lastRun
    });
  } catch (error) {
    console.error(`Error updating job ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update cron job' });
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
