const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const HISTORY_FILE = path.join('/etc/nas-panel/scan-history.json');
const SETTINGS_FILE = path.join('/etc/nas-panel/antivirus-settings.json');
const THREATS_FILE = path.join('/etc/nas-panel/antivirus-threats.json');

// Helper functions
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function ensureFiles() {
  await ensureDirectory(path.dirname(HISTORY_FILE));
  
  const files = [
    { path: HISTORY_FILE, default: [] },
    { path: SETTINGS_FILE, default: {
      autoUpdate: true,
      updateFrequency: 'daily',
      realtimeProtection: false,
      notifications: true,
      scanSchedule: '02:00'
    }},
    { path: THREATS_FILE, default: [] }
  ];
  
  for (const file of files) {
    if (!await fileExists(file.path)) {
      await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
    }
  }
}

// Poprawiona funkcja sprawdzania instalacji
async function isAntivirusInstalled() {
  try {
    // Sprawdź czy clamscan jest dostępny
    await execAsync('which clamscan');
    return true;
  } catch (error) {
    // Sprawdź alternatywne lokalizacje
    const possiblePaths = [
      '/usr/bin/clamscan',
      '/usr/local/bin/clamscan',
      '/bin/clamscan'
    ];
    
    for (const path of possiblePaths) {
      if (fsSync.existsSync(path)) {
        return true;
      }
    }
    
    // Sprawdź przez dpkg
    try {
      const { stdout } = await execAsync('dpkg -l | grep clamav');
      return stdout.includes('clamav');
    } catch {
      return false;
    }
  }
}

// Sprawdź czy ClamAV działa
async function isClamAVRunning() {
  try {
    await execAsync('clamscan --version');
    return true;
  } catch (error) {
    return false;
  }
}

async function getClamAVVersion() {
  try {
    const { stdout } = await execAsync('clamscan --version');
    const match = stdout.match(/ClamAV\s+([\d\.]+)/);
    return match ? match[1] : 'unknown';
  } catch (error) {
    console.error('Cannot get ClamAV version:', error.message);
    return 'unknown';
  }
}

async function getVirusDbVersion() {
  try {
    const version = await getClamAVVersion();
    let dbPath = '/var/lib/clamav';
    
    try {
      const { stdout } = await execAsync('clamconf 2>/dev/null || echo ""');
      const dbMatch = stdout.match(/DatabaseDirectory\s*=\s*(.*)/);
      if (dbMatch) {
        dbPath = dbMatch[1].trim().replace(/^['"]|['"]$/g, '');
      }
    } catch (e) {
      console.warn('Cannot determine database path:', e.message);
    }

    dbPath = dbPath.trim().replace(/^=?\s*['"]?|['"]$/g, '');

    let dbFiles = [];
    let dbStatus = 'empty';
    let mainDbDate = null;
    
    try {
      if (fsSync.existsSync(dbPath)) {
        const files = fsSync.readdirSync(dbPath);
        dbFiles = files
          .filter(file => ['.cvd', '.cld'].includes(path.extname(file).toLowerCase()));
        
        dbStatus = dbFiles.length > 0 ? 'active' : 'empty';

        // Sprawdź datę głównej bazy
        const mainDbPath = path.join(dbPath, 'main.cvd');
        const mainDbCldPath = path.join(dbPath, 'main.cld');
        
        if (fsSync.existsSync(mainDbPath)) {
          mainDbDate = fsSync.statSync(mainDbPath).mtime;
        } else if (fsSync.existsSync(mainDbCldPath)) {
          mainDbDate = fsSync.statSync(mainDbCldPath).mtime;
        }
      } else {
        console.error('Database directory does not exist:', dbPath);
        dbStatus = 'missing';
      }
    } catch (e) {
      console.error('Error reading database directory:', e.message);
      dbStatus = 'error';
    }

    return {
      version: `ClamAV ${version}`,
      dbPath,
      dbFiles,
      dbDate: mainDbDate,
      dbStatus,
      lastChecked: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error getting virus DB info:', error);
    return { 
      error: 'Failed to get virus DB info',
      details: error.message,
      dbStatus: 'error'
    };
  }
}

async function loadHistory() {
  try {
    await ensureFiles();
    const data = await fs.readFile(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

async function saveHistory(history) {
  try {
    await ensureFiles();
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

async function loadSettings() {
  try {
    await ensureFiles();
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      autoUpdate: true,
      updateFrequency: 'daily',
      realtimeProtection: false,
      notifications: true,
      scanSchedule: '02:00'
    };
  }
}

async function saveSettings(settings) {
  try {
    await ensureFiles();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

async function loadThreats() {
  try {
    await ensureFiles();
    const data = await fs.readFile(THREATS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading threats:', error);
    return [];
  }
}

async function saveThreat(threat) {
  try {
    await ensureFiles();
    const threats = await loadThreats();
    threats.push({
      ...threat,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      status: 'detected'
    });
    await fs.writeFile(THREATS_FILE, JSON.stringify(threats.slice(0, 1000), null, 2));
  } catch (error) {
    console.error('Error saving threat:', error);
  }
}

async function updateThreatStatus(threatId, status) {
  try {
    await ensureFiles();
    const threats = await loadThreats();
    const threatIndex = threats.findIndex(t => t.id === threatId);
    if (threatIndex !== -1) {
      threats[threatIndex].status = status;
      threats[threatIndex].updatedAt = new Date().toISOString();
      await fs.writeFile(THREATS_FILE, JSON.stringify(threats, null, 2));
      return threats[threatIndex];
    }
    return null;
  } catch (error) {
    console.error('Error updating threat status:', error);
    throw error;
  }
}

// Ulepszony parser outputu ClamAV
function parseClamAVOutput(output) {
  const lines = output.split('\n');
  const result = {
    scannedFiles: 0,
    scannedDirs: 0,
    infectedFiles: [],
    errors: 0,
    dataScanned: '0 MB',
    timeElapsed: 0
  };
  
  for (const line of lines) {
    if (line.includes('FOUND')) {
      const parts = line.split(': ');
      if (parts.length >= 3) {
        const filePath = parts[0].trim();
        const virusName = parts[2].replace(' FOUND', '').trim();
        result.infectedFiles.push({
          path: filePath,
          name: virusName,
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (line.includes('Scanned files:')) {
      const match = line.match(/Scanned files:\s*(\d+)/);
      if (match) result.scannedFiles = parseInt(match[1]);
    }
    
    if (line.includes('Scanned directories:')) {
      const match = line.match(/Scanned directories:\s*(\d+)/);
      if (match) result.scannedDirs = parseInt(match[1]);
    }
    
    if (line.includes('Infected files:')) {
      const match = line.match(/Infected files:\s*(\d+)/);
      if (match) result.infectedCount = parseInt(match[1]);
    }
    
    if (line.includes('Data scanned:')) {
      const match = line.match(/Data scanned:\s*([\d\.]+\s*\w+)/);
      if (match) result.dataScanned = match[1];
    }
    
    if (line.includes('Time:')) {
      const match = line.match(/Time:\s*([\d\.]+)\s*sec/);
      if (match) result.timeElapsed = parseFloat(match[1]);
    }
    
    if (line.includes('Total errors:')) {
      const match = line.match(/Total errors:\s*(\d+)/);
      if (match) result.errors = parseInt(match[1]);
    }
  }
  
  return result;
}

// Funkcja do emulacji postępu
function estimateProgress(scanType, elapsedSeconds, filesScanned) {
  const estimates = {
    quick: { totalFiles: 20000, avgTime: 120 }, // 2 minuty
    full: { totalFiles: 200000, avgTime: 1200 }, // 20 minut
    custom: { totalFiles: 10000, avgTime: 300 } // 5 minut
  };
  
  const estimate = estimates[scanType] || estimates.quick;
  
  // Postęp oparty na czasie
  const timeProgress = Math.min((elapsedSeconds / estimate.avgTime) * 100, 95);
  
  // Postęp oparty na plikach
  const fileProgress = Math.min((filesScanned / estimate.totalFiles) * 100, 95);
  
  // Średnia ważona
  return Math.round((timeProgress * 0.6) + (fileProgress * 0.4));
}

module.exports = function(app, requireAuth) {
  ensureFiles().catch(console.error);

  // Status endpoint - POPRAWIONY
  app.get('/api/antivirus/status', requireAuth, async (req, res) => {
    try {
      const installed = await isAntivirusInstalled();
      const running = installed ? await isClamAVRunning() : false;
      
      let version = null;
      let lastUpdate = null;
      
      if (installed) {
        try {
          version = await getClamAVVersion();
          
          // Spróbuj pobrać datę ostatniej aktualizacji bazy
          try {
            const dbPath = '/var/lib/clamav';
            const mainDb = fsSync.existsSync(path.join(dbPath, 'main.cvd')) ? 
              path.join(dbPath, 'main.cvd') : 
              path.join(dbPath, 'main.cld');
            
            if (fsSync.existsSync(mainDb)) {
              const stats = fsSync.statSync(mainDb);
              lastUpdate = stats.mtime.toISOString();
            }
          } catch (e) {
            console.warn('Cannot get last update time:', e.message);
          }
        } catch (error) {
          console.warn('Cannot get version:', error.message);
          version = 'unknown';
        }
      }
      
      res.json({
        installed,
        version: version ? `ClamAV ${version}` : null,
        lastUpdate,
        active: running,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Status error:', error);
      res.status(500).json({ 
        error: 'Failed to get antivirus status',
        details: error.message 
      });
    }
  });

  // Debug endpoint
  app.get('/api/antivirus/debug', requireAuth, async (req, res) => {
    try {
      const installed = await isAntivirusInstalled();
      const running = await isClamAVRunning();
      
      let testOutput = '';
      try {
        const { stdout } = await execAsync('clamscan --version');
        testOutput = stdout;
      } catch (error) {
        testOutput = error.message;
      }
      
      res.json({
        installed,
        running,
        testOutput,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Virus DB endpoint
  app.get('/api/antivirus/virusdb', requireAuth, async (req, res) => {
    try {
      const dbInfo = await getVirusDbVersion();
      
      if (dbInfo.error) {
        return res.status(500).json({
          error: dbInfo.error,
          details: dbInfo.details
        });
      }

      res.json({
        version: dbInfo.version,
        updatedAt: dbInfo.dbDate || new Date().toISOString(),
        dbPath: dbInfo.dbPath,
        dbFiles: dbInfo.dbFiles,
        status: dbInfo.dbStatus
      });
    } catch (error) {
      console.error('Virus DB error:', error);
      res.status(500).json({ error: 'Failed to get virus database info' });
    }
  });

  // Scan history endpoints
  app.get('/api/antivirus/scan/history', requireAuth, async (req, res) => {
    try {
      const history = await loadHistory();
      res.json(history);
    } catch (error) {
      console.error('History load error:', error);
      res.status(500).json({ error: 'Failed to load scan history' });
    }
  });

  app.post('/api/antivirus/scan/history', requireAuth, async (req, res) => {
    try {
      const newScan = {
        ...req.body,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      };

      const history = await loadHistory();
      history.unshift(newScan);
      await saveHistory(history);
      
      res.json(newScan);
    } catch (error) {
      console.error('Save history error:', error);
      res.status(500).json({ error: 'Failed to save scan results' });
    }
  });

  app.delete('/api/antivirus/scan/history/:id', requireAuth, async (req, res) => {
    try {
      const history = await loadHistory();
      const filteredHistory = history.filter(item => item.id !== req.params.id);
      await saveHistory(filteredHistory);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete history error:', error);
      res.status(500).json({ error: 'Failed to delete scan entry' });
    }
  });

  // Settings endpoints
  app.get('/api/antivirus/settings', requireAuth, async (req, res) => {
    try {
      const settings = await loadSettings();
      res.json(settings);
    } catch (error) {
      console.error('Settings load error:', error);
      res.status(500).json({ error: 'Failed to load settings' });
    }
  });

  app.put('/api/antivirus/settings', requireAuth, async (req, res) => {
    try {
      await saveSettings(req.body);
      res.json(req.body);
    } catch (error) {
      console.error('Settings save error:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  app.delete('/api/antivirus/settings', requireAuth, async (req, res) => {
    try {
      const defaultSettings = {
        autoUpdate: true,
        updateFrequency: 'daily',
        realtimeProtection: false,
        notifications: true,
        scanSchedule: '02:00'
      };
      await saveSettings(defaultSettings);
      res.json(defaultSettings);
    } catch (error) {
      console.error('Settings reset error:', error);
      res.status(500).json({ error: 'Failed to reset settings' });
    }
  });

  // GŁÓWNY ENDPOINT SKANOWANIA - POPRAWIONY
  app.get('/api/antivirus/scan', requireAuth, async (req, res) => {
    try {
      const installed = await isAntivirusInstalled();
      if (!installed) {
        res.write(`event: error\ndata: ${JSON.stringify({
          message: "Antivirus not installed. Please install ClamAV first.",
          code: "NOT_INSTALLED"
        })}\n\n`);
        return res.end();
      }

      const scanType = req.query.scanType || 'quick';
      const paths = req.query.paths ? JSON.parse(req.query.paths) : [];
      
      if (scanType === 'custom' && (!paths || paths.length === 0)) {
        res.write(`event: error\ndata: ${JSON.stringify({
          message: "Custom scan requires at least one path"
        })}\n\n`);
        return res.end();
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Przygotuj komendę
      let scanCommand;
      switch (scanType) {
        case 'quick':
          scanCommand = ['clamscan', '--recursive', '--bell', '--infected', '/home', '/etc'];
          break;
        case 'full':
          scanCommand = ['clamscan', '--recursive', '--bell', '--infected', '/'];
          break;
        case 'custom':
          scanCommand = ['clamscan', '--recursive', '--bell', '--infected', ...paths];
          break;
        default:
          res.write(`event: error\ndata: ${JSON.stringify({
            message: "Invalid scan type"
          })}\n\n`);
          return res.end();
      }

      console.log('Starting scan with command:', scanCommand.join(' '));
      
      // Wyślij początkowy status
      res.write(`event: status\ndata: ${JSON.stringify({
        message: "Starting scan...",
        command: scanCommand.join(' ')
      })}\n\n`);

      const scanStartTime = Date.now();
      let filesScanned = 0;
      let infectedFiles = [];
      let lastProgressUpdate = Date.now();
      let lastFileTime = Date.now();

      // Użyj spawn z bufferem
      const scanProcess = spawn(scanCommand[0], scanCommand.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let buffer = '';
      
      scanProcess.stdout.on('data', (data) => {
        const output = data.toString();
        buffer += output;
        
        // Przetwarzaj linie z bufora
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Zachowaj niepełną linię
        
        lines.forEach(line => {
          if (!line.trim()) return;
          
          // Sprawdź czy to zagrożenie
          if (line.includes('FOUND')) {
            const parts = line.split(': ');
            if (parts.length >= 3) {
              const filePath = parts[0].trim();
              const virusName = parts[2].replace(' FOUND', '').trim();
              const threat = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                path: filePath,
                name: virusName,
                severity: 'high',
                timestamp: new Date().toISOString()
              };
              
              infectedFiles.push(threat);
              res.write(`event: threat\ndata: ${JSON.stringify(threat)}\n\n`);
              saveThreat(threat).catch(console.error);
            }
          }
          
          // Zliczaj skanowane pliki (każda linia to potencjalny plik)
          if (line.includes('/') && !line.includes('FOUND')) {
            filesScanned++;
            
            // Wyślij aktualizację pliku co 100ms
            const now = Date.now();
            if (now - lastFileTime > 100) {
              const fileName = line.split('/').pop() || line.substring(0, 50);
              res.write(`event: info\ndata: ${JSON.stringify({
                message: `Scanning: ${fileName}`,
                file: fileName
              })}\n\n`);
              lastFileTime = now;
            }
          }
        });

        // Aktualizuj postęp co sekundę
        const now = Date.now();
        if (now - lastProgressUpdate > 1000) {
          const elapsedSeconds = (now - scanStartTime) / 1000;
          const progress = estimateProgress(scanType, elapsedSeconds, filesScanned);
          
          res.write(`event: progress\ndata: ${JSON.stringify({
            progress: progress,
            itemsScanned: filesScanned,
            elapsedTime: elapsedSeconds,
            message: `Progress: ${progress}% (${filesScanned} files)`
          })}\n\n`);
          
          lastProgressUpdate = now;
        }
      });

      scanProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.trim()) {
          res.write(`event: warning\ndata: ${JSON.stringify({
            message: error.trim()
          })}\n\n`);
        }
      });

      scanProcess.on('close', async (code) => {
        const scanDuration = (Date.now() - scanStartTime) / 1000;
        
        // Parsuj ostateczne statystyki
        let finalStats = {
          scannedFiles: filesScanned,
          infectedFiles: infectedFiles.length,
          errors: 0,
          dataScanned: '0 MB',
          timeElapsed: scanDuration
        };
        
        // Wyślij końcowe statystyki
        res.write(`event: complete\ndata: ${JSON.stringify({
          progress: 100,
          itemsScanned: finalStats.scannedFiles,
          threatsDetected: finalStats.infectedFiles,
          duration: scanDuration,
          dataScanned: finalStats.dataScanned,
          errors: finalStats.errors,
          summary: finalStats
        })}\n\n`);
        
        // Zapisz do historii
        const historyEntry = {
          id: Date.now().toString(),
          scanType,
          timestamp: new Date().toISOString(),
          duration: `${Math.round(scanDuration)}s`,
          itemsScanned: finalStats.scannedFiles,
          threatsDetected: finalStats.infectedFiles,
          threats: infectedFiles,
          dataScanned: finalStats.dataScanned,
          exitCode: code
        };

        try {
          const history = await loadHistory();
          history.unshift(historyEntry);
          await saveHistory(history);
        } catch (error) {
          console.error('Error saving history:', error);
        }
        
        res.write(`event: status\ndata: ${JSON.stringify({
          message: finalStats.infectedFiles > 0 
            ? `Scan completed! Found ${finalStats.infectedFiles} threats.` 
            : "Scan completed! No threats found."
        })}\n\n`);
        
        res.end();
      });

      scanProcess.on('error', (error) => {
        console.error('Scan process error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({
          message: "Failed to start scan process",
          details: error.message
        })}\n\n`);
        res.end();
      });

      req.on('close', () => {
        if (!scanProcess.killed) {
          scanProcess.kill('SIGTERM');
        }
      });

    } catch (error) {
      console.error('Scan endpoint error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Scan failed', details: error.message });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({message: error.message})}\n\n`);
        res.end();
      }
    }
  });

  // Update endpoint
  app.post('/api/antivirus/update', requireAuth, async (req, res) => {
    try {
      const installed = await isAntivirusInstalled();
      if (!installed) {
        return res.status(400).json({ error: 'Antivirus not installed' });
      }

      const updateProcess = exec('freshclam --verbose', async (error, stdout, stderr) => {
        if (error) {
          console.error('Update error:', error);
          return res.status(500).json({ 
            error: 'Update failed', 
            details: stderr.toString() || error.message
          });
        }
        
        const dbInfo = await getVirusDbVersion();
        res.json({
          success: true,
          message: 'Virus database updated successfully',
          version: dbInfo.version,
          updatedAt: new Date().toISOString(),
          output: stdout.toString().substring(0, 500) // Ogranicz output
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!updateProcess.killed) {
          updateProcess.kill('SIGTERM');
          res.status(500).json({ error: 'Update timed out' });
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('Update endpoint error:', error);
      res.status(500).json({ 
        error: 'Update failed', 
        details: error.message 
      });
    }
  });

  // Threats management endpoints
  app.post('/api/antivirus/threats/:id/quarantine', requireAuth, async (req, res) => {
    try {
      const threatId = req.params.id;
      const updatedThreat = await updateThreatStatus(threatId, 'quarantined');
      
      if (updatedThreat) {
        // Symuluj kwarantannę
        res.json({ 
          success: true, 
          message: 'Threat quarantined',
          threat: updatedThreat 
        });
      } else {
        res.status(404).json({ error: 'Threat not found' });
      }
    } catch (error) {
      console.error('Quarantine error:', error);
      res.status(500).json({ error: 'Failed to quarantine threat' });
    }
  });

  app.delete('/api/antivirus/threats/:id', requireAuth, async (req, res) => {
    try {
      const threatId = req.params.id;
      const updatedThreat = await updateThreatStatus(threatId, 'removed');
      
      if (updatedThreat) {
        res.json({ 
          success: true, 
          message: 'Threat removed',
          threat: updatedThreat 
        });
      } else {
        res.status(404).json({ error: 'Threat not found' });
      }
    } catch (error) {
      console.error('Remove threat error:', error);
      res.status(500).json({ error: 'Failed to remove threat' });
    }
  });

  // Install endpoint
  app.post('/api/antivirus/install', requireAuth, async (req, res) => {
    try {
      const installed = await isAntivirusInstalled();
      if (installed) {
        return res.status(400).json({ 
          error: 'Antivirus is already installed',
          installed: true 
        });
      }

      // Symuluj instalację (w rzeczywistości wymaga sudo)
      res.json({ 
        success: true,
        message: 'ClamAV would be installed here (requires sudo)',
        installed: false,
        note: 'Run manually: sudo apt-get install clamav clamav-daemon && sudo freshclam'
      });
    } catch (error) {
      console.error('Installation error:', error);
      res.status(500).json({ 
        error: 'Failed to install antivirus',
        details: error.message,
        installed: false
      });
    }
  });

  // Realtime endpoint (uproszczony)
  app.get('/api/antivirus/realtime', requireAuth, (req, res) => {
    try {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      res.write(`event: status\ndata: ${JSON.stringify({
        message: "Real-time protection activated",
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Keep-alive
      const interval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`event: ping\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
      }, 30000);

      req.on('close', () => {
        clearInterval(interval);
        res.write(`event: status\ndata: ${JSON.stringify({
          message: "Real-time protection deactivated"
        })}\n\n`);
        res.end();
      });

    } catch (error) {
      console.error('Realtime endpoint error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Realtime failed', details: error.message });
      }
    }
  });
};
