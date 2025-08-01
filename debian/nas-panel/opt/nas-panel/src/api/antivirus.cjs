const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const HISTORY_FILE = path.join('/etc/nas-panel/scan-history.json');
const SETTINGS_FILE = path.join('/etc/nas-panel/antivirus-settings.json');

// Check Clamav is INSTALLED
function isAntivirusInstalled() {
  try {
    const output = execSync('which clamscan').toString().trim();
    return output.length > 0;
  } catch (error) {
    return false;
  }
}

//Check DB Virus
function getVirusDbVersion() {
  try {
    // Sprawdzenie wersji ClamAV
    const versionOutput = execSync('clamscan --version').toString().trim();
    
    // Znajdź ścieżkę do bazy danych
    let dbPath = '/var/lib/clamav'; // Domyślna ścieżka w większości systemów
    try {
      const clamconfOutput = execSync('clamconf').toString();
      const dbMatch = clamconfOutput.match(/DatabaseDirectory\s+(.*)/);
      if (dbMatch) dbPath = dbMatch[1].trim();
    } catch (e) {
      console.warn('Nie można określić ścieżki bazy danych, używam domyślnej');
    }

    // Sprawdź pliki bazy danych
    let dbFiles = [];
    try {
      dbFiles = fs.readdirSync(dbPath)
        .filter(file => file.endsWith('.cvd') || file.endsWith('.cld'));
    } catch (e) {
      console.error('Błąd odczytu katalogu bazy danych:', e.message);
    }

    // Sprawdź datę modyfikacji głównego pliku bazy
    let mainDbDate = null;
    const mainDbPath = path.join(dbPath, 'main.cvd');
    if (fs.existsSync(mainDbPath)) {
      mainDbDate = fs.statSync(mainDbPath).mtime;
    }

    return {
      version: versionOutput,
      dbPath,
      dbFiles,
      dbDate: mainDbDate,
      dbStatus: dbFiles.length > 0 ? 'active' : 'empty'
    };
  } catch (error) {
    console.error('Błąd pobierania informacji o bazie:', error);
    return { 
      error: 'Failed to get virus DB info',
      details: error.message
    };
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    return [];
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
    return {
      autoUpdate: true,
      updateFrequency: 'daily',
      realtimeProtection: false,
      notifications: true
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

module.exports = function(app, requireAuth) {

app.get('/api/antivirus/status', requireAuth, (req, res) => {
  const installed = isAntivirusInstalled();
  res.json({
    installed,
    version: installed ? execSync('clamscan --version').toString().trim() : null,
    lastUpdate: new Date().toISOString(),
    active: installed
  });
});

app.get('/api/antivirus/virusdb', requireAuth, (req, res) => {
  const dbInfo = getVirusDbVersion();
  
  if (dbInfo.error) {
    return res.status(500).json({
      error: dbInfo.error,
      details: dbInfo.details || 'Unknown error'
    });
  }

  res.json({
    version: dbInfo.version,
    updatedAt: dbInfo.dbDate || new Date().toISOString(),
    dbPath: dbInfo.dbPath,
    dbFiles: dbInfo.dbFiles,
    status: dbInfo.dbStatus
  });
});

app.get('/api/antivirus/scan/history', requireAuth, (req, res) => {
  res.json(loadHistory());
});

// Endpoint do zapisywania wyników skanowania
app.post('/api/antivirus/scan/history', (req, res) => {
  try {
    const newScan = {
      ...req.body,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };

    const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
    const history = JSON.parse(historyData);
    history.unshift(newScan);

    // Ogranicz historię do 100 ostatnich skanowań
    const limitedHistory = history.slice(0, 100);
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(limitedHistory, null, 2));
    
    res.json(newScan);
  } catch (error) {
    console.error('Błąd zapisu historii:', error);
    res.status(500).json({ error: 'Failed to save scan results' });
  }
});

// Endpoint do usuwania wpisu z historii
app.delete('/api/antivirus/scan/history/:id', (req, res) => {
  try {
    const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
    let history = JSON.parse(historyData);
    
    history = history.filter(item => item.id !== req.params.id);
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Błąd usuwania z historii:', error);
    res.status(500).json({ error: 'Failed to delete scan entry' });
  }
});

app.get('/api/antivirus/settings', requireAuth, (req, res) => {
  const settings = loadSettings();
  if (!settings) {
    return res.status(500).json({ error: 'Failed to load settings' });
  }
  res.json(settings);
});

app.put('/api/antivirus/settings', requireAuth, (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json(req.body);
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/antivirus/scan', (req, res) => {
  try {
    const scanType = req.query.scanType;
    const paths = req.query.paths ? JSON.parse(req.query.paths) : [];
    
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

    // Sprawdź czy dla skanowania custom podano ścieżki
    if (scanType === 'custom' && (!paths || paths.length === 0)) {
      return res.write('event: error\ndata: {"message":"Dla skanowania niestandardowego wymagane są ścieżki"}\n\n');
    }

    // Przygotuj komendę do wykonania
    let scanCommand;
    switch (scanType) {
      case 'quick':
        scanCommand = 'clamscan --recursive /home /etc';
        break;
      case 'full':
        scanCommand = 'clamscan --recursive /';
        break;
      case 'custom':
        scanCommand = `clamscan --recursive ${paths.join(' ')}`;
        break;
      default:
        return res.write('event: error\ndata: {"message":"Nieprawidłowy typ skanowania"}\n\n');
    }
    
  const scanProcess = exec(scanCommand);

  let output = '';
  let infectedFiles = [];
  let scannedItems = 0;

  scanProcess.stdout.on('data', (data) => {
    output += data;
    scannedItems += (data.match(/\n/g) || []).length;
    
    // Przykładowe parsowanie outputu clamav
    const lines = data.split('\n');
    lines.forEach(line => {
      if (line.includes('FOUND')) {
        const parts = line.split(': ');
        const filePath = parts[0];
        const virusName = parts[2].replace(' FOUND', '');
        infectedFiles.push({ path: filePath, name: virusName });
        
        res.write(`event: threat\ndata: ${JSON.stringify({
          path: filePath,
          name: virusName,
          severity: 'high'
        })}\n\n`);
      }
    });

    res.write(`event: progress\ndata: ${JSON.stringify({
      progress: Math.min(scannedItems / 1000 * 100, 100), // Przybliżony postęp
      itemsScanned: scannedItems,
      message: `Scanning... (${scannedItems} items checked)`
    })}\n\n`);
  });

  scanProcess.stderr.on('data', (data) => {
    res.write(`event: error\ndata: ${JSON.stringify({ message: data.toString() })}\n\n`);
  });

  scanProcess.on('close', (code) => {
    const historyEntry = {
      scanType,
      timestamp: new Date().toISOString(),
      duration: `${Math.floor(process.uptime())}s`,
      itemsScanned: scannedItems,
      threatsDetected: infectedFiles.length,
      threats: infectedFiles
    };

    const history = loadHistory();
    history.unshift(historyEntry);
    saveHistory(history);

    res.write(`event: complete\ndata: ${JSON.stringify({
      progress: 100,
      itemsScanned: scannedItems,
      threatsDetected: infectedFiles.length,
      duration: process.uptime()
    })}\n\n`);
    res.end();
  });
  } catch (error) {
    console.error('Błąd endpointu skanowania:', error);
    res.write(`event: error\ndata: ${JSON.stringify({message: error.message})}\n\n`);
  }
});

app.post('/api/antivirus/update', (req, res) => {
  if (!isAntivirusInstalled()) {
    return res.status(400).json({ error: 'Antivirus not installed' });
  }

  const updateProcess = exec('freshclam', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr.toString() });
    }
    
    const dbInfo = getVirusDbVersion();
    res.json({
      success: true,
      message: 'Virus database updated',
      version: dbInfo.version,
      updatedAt: new Date().toISOString()
    });
  });
});

app.get('/api/antivirus/realtime', requireAuth, (req, res) => {
  if (!isAntivirusInstalled()) {
    return res.status(400).json({ error: 'Antivirus not installed' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Monitorowanie zmian w systemie plików
  const realtimeProcess = exec('inotifywait -r -m -e create,modify,delete /');

  realtimeProcess.stdout.on('data', (data) => {
    // Tutaj można dodać skanowanie zmienionych plików
    const filePath = data.split(' ')[2];
    const scanCommand = `clamscan --infected "${filePath}"`;
    
    exec(scanCommand, (error, stdout, stderr) => {
      if (stdout.includes('FOUND')) {
        const parts = stdout.split(': ');
        const virusName = parts[2].replace(' FOUND', '');
        
        res.write(`event: threat\ndata: ${JSON.stringify({
          path: filePath,
          name: virusName,
          severity: 'high',
          message: `Real-time threat detected: ${virusName} in ${filePath}`
        })}\n\n`);
      }
    });
  });

  realtimeProcess.stderr.on('data', (data) => {
    res.write(`event: error\ndata: ${JSON.stringify({ message: data.toString() })}\n\n`);
  });

  // Zamknij połączenie przy zamknięciu klienta
  req.on('close', () => {
    realtimeProcess.kill();
  });
});

app.post('/api/antivirus/install', requireAuth, async (req, res) => {
  if (isAntivirusInstalled()) {
    return res.status(400).json({ error: 'Antivirus jest już zainstalowany' });
  }

  try {
    // Instalacja ClamAV (dla systemów Debian/Ubuntu)
    execSync('sudo apt-get update && sudo apt-get install -y clamav clamav-daemon', { stdio: 'inherit' });
    
    // Inicjalizacja bazy wirusów
    execSync('sudo freshclam', { stdio: 'inherit' });
    
    res.json({ 
      success: true,
      message: 'Antywirus ClamAV został pomyślnie zainstalowany',
      installed: true,
      version: execSync('clamscan --version').toString().trim()
    });
  } catch (error) {
    console.error('Błąd instalacji:', error);
    res.status(500).json({ 
      error: 'Nie udało się zainstalować antywirusa',
      details: error.message 
    });
  }
});

};
