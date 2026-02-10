const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const readLastLines = require('read-last-lines');

const CONFIG_PATH = '/etc/nas-panel/remote-syslog.conf';
const SYSLOG_SERVICE = 'rsyslog';

module.exports = function(app, requireAuth) {
  const LOG_FILES = {
    syslog: '/var/log/syslog',
    auth: '/var/log/auth.log',
    kern: '/var/log/kern.log',
    messages: '/var/log/messages',
    nasweb_error: '/var/log/nas-web/error.log',
    nasweb_output: '/var/log/nas-web/output.log',
    "nas_panel_access": '/var/log/nas-panel/access.log',
    "nas_panel_debug": '/var/log/nas-panel/debug.log',
    "nas_panel_info": '/var/log/nas-panel/info.log',
    "samba_smbd": '/var/log/samba/log.smbd',
    "samba_nmbd": '/var/log/samba/log.nmbd',
    "samba_winbind": '/var/log/samba/log.winbindd',
    "samba_netlogon": '/var/log/samba/log.netlogon'
  };
  
const handleAbortedRequests = (handler) => async (req, res) => {
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await handler(req, res, controller.signal);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Request aborted by client');
      return;
    }
    res.status(500).json({ error: err.message });
  }
};

  // Pobierz ostatnie linie z wybranego logu
  app.get('/diagnostics/system-logs/:type', requireAuth, async (req, res) => {
    try {
      const { type } = req.params;
      const { lines = 100, filter = '' } = req.query;
      
      if (!LOG_FILES[type]) {
        return res.status(404).json({ error: 'Log type not found' });
      }

      // Sprawdź czy plik istnieje
      try {
        await fs.accessSync(LOG_FILES[type]);
      } catch {
        return res.status(404).json({ error: 'Log file not found' });
      }

      // Odczytaj ostatnie linie
      const logContent = await readLastLines.read(LOG_FILES[type], lines);
      
      // Filtruj jeśli podano filtr
      const filteredContent = filter 
        ? logContent.split('\n').filter(line => line.includes(filter)).join('\n')
        : logContent;

      res.json({
        success: true,
        data: filteredContent,
        file: LOG_FILES[type],
        size: (await fs.statSync(LOG_FILES[type])).size
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to read logs',
        details: error.message
      });
    }
  });

  // Pobierz listę dostępnych logów
  app.get('/diagnostics/system-logs', requireAuth, async (req, res) => {
    try {
      const availableLogs = {};
      
      for (const [name, path] of Object.entries(LOG_FILES)) {
        try {
          await fs.accessSync(path);
          availableLogs[name] = path;
        } catch {
          // Plik nie istnieje, pomiń
        }
      }

      res.json({
        success: true,
        availableLogs,
        totalSize: await getLogsTotalSize(Object.values(availableLogs))
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to list logs' 
      });
    }
  });

  async function getLogsTotalSize(logPaths) {
    let total = 0;
    for (const path of logPaths) {
      try {
        total += (await fs.statSync(path)).size;
      } catch {
        // Ignoruj błędy
      }
    }
    return total;
  }
  
app.get('/diagnostics/remote-logs/:serverId/:logType', requireAuth, async (req, res) => {
  try {
    const { serverId, logType } = req.params;
    const { lines = 100 } = req.query;
    
    // Tutaj dodaj logikę pobierania logów ze zdalnego serwera
    // Możesz użyć SSH, API, lub innego mechanizmu
    
    res.json({
      success: true,
      data: `Mock remote logs from server ${serverId}, log type ${logType}`,
      serverId,
      logType
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch remote logs' 
    });
  }
});

  // Pobierz konfigurację zdalnego logowania
  app.get('/api/diagnostics/remote-logs/config', requireAuth, async (req, res) => {
    const defaultConfig = {
      enabled: false,
      host: '',
      port: 514,
      protocol: 'udp'
    };

    try {
      const configData = await fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      
      res.json({ success: true, config });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({ success: true, config: defaultConfig });
      }
      throw error;
    }
  });

app.post('/api/diagnostics/remote-logs/config', async (req, res) => {
  req.setTimeout(30000);

  // Walidacja danych - teraz oczekujemy bezpośrednio właściwości w req.body
  const { enabled, host, port, protocol } = req.body;
  
  // Sprawdzamy tylko enabled, bo reszta jest wymagana tylko gdy enabled=true
  if (enabled === undefined || typeof enabled !== 'boolean') {
    return res.status(400).json({ 
      error: 'Missing or invalid enabled field',
      example: {
        enabled: true,
        host: "192.168.1.100",
        port: 514,
        protocol: "udp"
      }
    });
  }

  // Jeśli logging jest włączony, walidujemy resztę pól
  if (enabled) {
    if (!host || typeof host !== 'string') {
      return res.status(400).json({ error: 'Host is required when enabled is true' });
    }
    
    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      return res.status(400).json({ error: 'Valid port number (1-65535) is required' });
    }
    
    if (!protocol || !['udp', 'tcp'].includes(protocol)) {
      return res.status(400).json({ error: 'Protocol must be either udp or tcp' });
    }
  }

  // Przygotowanie konfiguracji do zapisu
  const config = {
    enabled,
    ...(enabled && { host, port, protocol }) // Dodajemy host/port/protocol tylko jeśli enabled=true
  };

  try {
    // Zapisz konfigurację
    await fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
    
    // Jeśli logging jest włączony, zastosuj zmiany w rsyslog
    if (enabled) {
      const configLine = `*.* @${protocol === 'tcp' ? '@@' : '@'}${host}:${port}`;
      await fs.writeFileSync('/etc/rsyslog.d/remote.conf', configLine);
    } else {
      // Jeśli logging jest wyłączony, wyczyść konfigurację
      try {
        await fs.unlinkSync('/etc/rsyslog.d/remote.conf');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err; // Ignoruj jeśli plik nie istnieje
      }
    }

    res.json({ 
      success: true,
      message: enabled ? 'Remote logging enabled' : 'Remote logging disabled'
    });
    
  } catch (err) {
    console.error('Error saving config:', err);
    res.status(500).json({ 
      error: 'Failed to save configuration',
      details: err.message
    });
  }
});

  // Pobierz zdalne logi z timeoutem i kontrolą przerwania
  app.get('/api/diagnostics/remote-logs', requireAuth, async (req, res) => {
    try {

      // Użyj execAsync z timeoutem i sygnałem
      const { stdout } = await execAsync('tail -n 100 /var/log/remote.log || echo "No remote logs available"', {
        timeout: 10000 // 10 sekund timeout
      });

      res.json({ 
        success: true,
        logs: stdout
      });
    } catch (error) {
      if (error.code === 'ENOENT' || error.message.includes('No such file')) {
        return res.json({
          success: true,
          logs: "No remote logs available yet. Configure remote logging first."
        });
      }
      throw error;
    }
  });

};
