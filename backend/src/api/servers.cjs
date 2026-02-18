// src/api/servers.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { Client } = require('ssh2');
const net = require('net');

const execAsync = promisify(exec);

const CONFIG_DIR = '/etc/nas-panel';
const SERVERS_FILE = path.join(CONFIG_DIR, 'servers_list.json');

// Upewnij się że katalog istnieje
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o755 });
}

// Inicjalizuj plik jeśli nie istnieje
if (!fs.existsSync(SERVERS_FILE)) {
  fs.writeFileSync(SERVERS_FILE, JSON.stringify({ servers: [] }, null, 2));
}

// Przechowuj aktywne połączenia SSH
const activeConnections = new Map();

module.exports = function(app, requireAuth) {

  // ==================== PODSTAWOWE OPERACJE ====================

  // Pobierz listę serwerów
  app.get('/api/servers', requireAuth, async (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      // Nie zwracaj haseł
      const servers = data.servers.map(s => ({
        ...s,
        password: undefined
      }));
      res.json({ success: true, servers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Dodaj nowy serwer
  app.post('/api/servers', requireAuth, async (req, res) => {
    const { name, host, port, username, password, keyFile } = req.body;
    
    if (!name || !host || !username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, host and username are required' 
      });
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      
      const newServer = {
        id: Date.now().toString(),
        name,
        host,
        port: port || 22,
        username,
        password: password || '',
        keyFile: keyFile || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      data.servers.push(newServer);
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
      
      res.json({ 
        success: true, 
        server: { ...newServer, password: undefined } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Aktualizuj serwer
  app.put('/api/servers/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      const index = data.servers.findIndex(s => s.id === id);
      
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }
      
      data.servers[index] = {
        ...data.servers[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
      
      res.json({ 
        success: true, 
        server: { ...data.servers[index], password: undefined } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Usuń serwer
  app.delete('/api/servers/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      data.servers = data.servers.filter(s => s.id !== id);
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2));
      
      // Rozłącz jeśli aktywny
      if (activeConnections.has(id)) {
        const conn = activeConnections.get(id);
        conn.end();
        activeConnections.delete(id);
      }
      
      res.json({ success: true, message: 'Server deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== POŁĄCZENIE SSH ====================

  // Test połączenia
  app.post('/api/servers/:id/test', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      const server = data.servers.find(s => s.id === id);
      
      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }
      
      const conn = new Client();
      
      conn.on('ready', () => {
        conn.end();
        res.json({ success: true, message: 'Connection successful' });
      });
      
      conn.on('error', (err) => {
        res.status(500).json({ success: false, error: err.message });
      });
      
      const config = {
        host: server.host,
        port: server.port || 22,
        username: server.username,
        readyTimeout: 10000
      };
      
      if (server.password) {
        config.password = server.password;
      } else if (server.keyFile) {
        config.privateKey = fs.readFileSync(server.keyFile);
      }
      
      conn.connect(config);
      
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Połącz z serwerem
  app.post('/api/servers/:id/connect', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    
    try {
      const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
      const server = data.servers.find(s => s.id === id);
      
      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }
      
      // Rozłącz jeśli już połączony
      if (activeConnections.has(id)) {
        const oldConn = activeConnections.get(id);
        oldConn.end();
        activeConnections.delete(id);
      }
      
      const conn = new Client();
      
      conn.on('ready', () => {
        console.log(`Connected to ${server.host}`);
        activeConnections.set(id, conn);
        res.json({ success: true, message: 'Connected successfully' });
      });
      
      conn.on('error', (err) => {
        console.error('SSH connection error:', err);
        res.status(500).json({ success: false, error: err.message });
      });
      
      const config = {
        host: server.host,
        port: server.port || 22,
        username: server.username,
        readyTimeout: 30000,
        keepaliveInterval: 10000
      };
      
      if (password) {
        config.password = password;
      } else if (server.password) {
        config.password = server.password;
      } else if (server.keyFile) {
        config.privateKey = fs.readFileSync(server.keyFile);
      }
      
      conn.connect(config);
      
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Rozłącz od serwera
  app.post('/api/servers/:id/disconnect', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      if (activeConnections.has(id)) {
        const conn = activeConnections.get(id);
        conn.end();
        activeConnections.delete(id);
      }
      
      res.json({ success: true, message: 'Disconnected' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Sprawdź status połączenia (NIE próbuje łączyć, tylko sprawdza)
  app.get('/api/servers/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      const isConnected = activeConnections.has(id);
      
      res.json({ 
        success: true, 
        connected: isConnected,
        serverId: id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // ==================== PINGOWANIE (SPRAWDZANIE DOSTĘPNOŚCI) ====================

  // Szybki ping (tylko TCP connect, bez logowania)
app.get('/api/servers/:id/fast-ping', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    const server = data.servers.find(s => s.id === id);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    
    const isReachable = await new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(server.port || 22, server.host);
    });
    
    res.json({ 
      success: true, 
      online: isReachable,
      serverId: id,
      host: server.host,
      port: server.port
    });
    
  } catch (error) {
    console.error('Fast ping error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

  // Pełne pingowanie (próba SSH bez zapisywania połączenia)
 app.post('/api/servers/:id/ping', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    const server = data.servers.find(s => s.id === id);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    
    // Próba połączenia tylko na chwilę, aby sprawdzić dostępność
    const pingResult = await new Promise((resolve) => {
      const conn = new Client();
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          resolve({ online: false, error: 'Connection timeout' });
        }
      }, 5000); // 5 sekund timeout
      
      conn.on('ready', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          conn.end();
          resolve({ online: true });
        }
      });
      
      conn.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          conn.end();
          resolve({ online: false, error: err.message });
        }
      });
      
      const config = {
        host: server.host,
        port: server.port || 22,
        username: server.username,
        readyTimeout: 5000,
        keepaliveInterval: 0,
        algorithms: {
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm'],
          compress: ['none'],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha1'
          ],
          serverHostKey: [
            'ssh-rsa',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'ssh-ed25519'
          ]
        }
      };
      
      // Próba połączenia bez hasła/klucza - tylko sprawdzenie czy serwer SSH odpowiada
      // Nie wysyłamy credentials, bo to tylko ping
      config.password = 'dummy_ping_check'; // To spowoduje błąd autoryzacji, ale połączenie zostanie nawiązane
      
      conn.connect(config);
    });
    
    res.json({ 
      success: true, 
      online: pingResult.online,
      error: pingResult.error,
      serverId: id,
      host: server.host,
      port: server.port
    });
    
  } catch (error) {
    console.error('Ping error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/servers/:id/simple-ping', requireAuth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const data = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    const server = data.servers.find(s => s.id === id);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    
    // Użyj ping z systemu
    const { stdout } = await execAsync(`ping -c 1 -W 2 ${server.host}`);
    const online = stdout.includes('1 received') || stdout.includes('0% packet loss');
    
    res.json({ 
      success: true, 
      online,
      serverId: id,
      host: server.host
    });
    
  } catch (error) {
    // Ping nie powiódł się - host nie odpowiada
    res.json({ 
      success: true, 
      online: false,
      serverId: id,
      error: error.message
    });
  }
});

  // ==================== DANE SYSTEMOWE ====================

  // Wykonaj komendę przez SSH
  async function execCommand(serverId, command) {
    return new Promise((resolve, reject) => {
      const conn = activeConnections.get(serverId);
      
      if (!conn) {
        reject(new Error('Not connected'));
        return;
      }
      
      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        
        let output = '';
        let error = '';
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        stream.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(error || `Command failed with code ${code}`));
          }
        });
      });
    });
  }

  // Pobierz statystyki systemu
  app.get('/api/servers/:id/stats', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      if (!activeConnections.has(id)) {
        return res.status(400).json({ success: false, error: 'Not connected' });
      }
      
      // Uptime
      const uptimeOutput = await execCommand(id, 'cat /proc/uptime');
      const uptime = uptimeOutput.split(' ')[0] || '0';
      
      // CPU cores
      const coresOutput = await execCommand(id, 'nproc');
      const cores = parseInt(coresOutput) || 1;
      
      // Load average
      const loadOutput = await execCommand(id, 'cat /proc/loadavg');
      const loadParts = loadOutput.split(' ');
      const load1 = parseFloat(loadParts[0]) || 0;
      const load5 = parseFloat(loadParts[1]) || 0;
      const load15 = parseFloat(loadParts[2]) || 0;
      
      // Memory info
      const memTotalOutput = await execCommand(id, "grep MemTotal /proc/meminfo | awk '{print $2}'");
      const memFreeOutput = await execCommand(id, "grep MemFree /proc/meminfo | awk '{print $2}'");
      const memAvailableOutput = await execCommand(id, "grep MemAvailable /proc/meminfo | awk '{print $2}'");
      
      const total = parseInt(memTotalOutput) * 1024 || 0;
      const free = parseInt(memFreeOutput) * 1024 || 0;
      const available = parseInt(memAvailableOutput) * 1024 || 0;
      const used = total - available;
      
      // Disk info
      const dfOutput = await execCommand(id, 'df -B1 /');
      const dfLines = dfOutput.split('\n');
      const dfData = dfLines[1] ? dfLines[1].split(/\s+/) : [];
      
      const diskTotal = parseInt(dfData[1]) || 0;
      const diskUsed = parseInt(dfData[2]) || 0;
      const diskFree = parseInt(dfData[3]) || 0;
      const diskPercent = dfData[4] ? dfData[4].replace('%', '') : '0';
      
      // Network info
      let rxBytes = 0, txBytes = 0;
      try {
        const netDevOutput = await execCommand(id, 'cat /proc/net/dev');
        const netLines = netDevOutput.split('\n');
        
        for (const line of netLines) {
          if (line.includes('eth') || line.includes('enp') || line.includes('ens')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 9) {
              rxBytes = parseInt(parts[1]) || 0;
              txBytes = parseInt(parts[9]) || 0;
              break;
            }
          }
        }
      } catch (e) {
        console.log('Network stats error:', e.message);
      }
      
      // Hostname
      const hostnameOutput = await execCommand(id, 'hostname');
      const hostname = hostnameOutput.trim() || 'unknown';
      
      // OS info
      let osInfo = 'Linux';
      try {
        osInfo = await execCommand(id, "cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'");
      } catch (e) {
        try {
          osInfo = await execCommand(id, 'lsb_release -d | cut -f2');
        } catch (e2) {}
      }
      
      res.json({
        success: true,
        stats: {
          uptime: parseFloat(uptime).toFixed(0),
          cpu: {
            cores: cores,
            load1: load1,
            load5: load5,
            load15: load15
          },
          memory: {
            total: total,
            used: used,
            free: free,
            usedPercent: total ? ((used / total) * 100).toFixed(1) : '0'
          },
          disk: {
            total: diskTotal,
            used: diskUsed,
            free: diskFree,
            usedPercent: diskPercent
          },
          network: {
            rxBytes: rxBytes,
            txBytes: txBytes,
            rx: formatBytes(rxBytes),
            tx: formatBytes(txBytes)
          },
          system: {
            hostname: hostname,
            os: osInfo.trim() || 'Linux'
          }
        }
      });
      
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Pobierz listę procesów
  app.get('/api/servers/:id/processes', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      if (!activeConnections.has(id)) {
        return res.status(400).json({ success: false, error: 'Not connected' });
      }
      
      const output = await execCommand(id, 
        'ps aux --sort=-%cpu | head -20 | tail -n +2 | while read user pid cpu mem rest; do echo "$user|$pid|$cpu|$mem|$rest"; done'
      );
      
      const processes = output.split('\n').map(line => {
        const parts = line.split('|');
        return {
          user: parts[0] || '',
          pid: parts[1] || '',
          cpu: parts[2] || '0',
          mem: parts[3] || '0',
          command: (parts.slice(4).join(' ') || '').substring(0, 60)
        };
      }).filter(p => p.pid);
      
      res.json({ success: true, processes });
      
    } catch (error) {
      console.error('Processes error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Zabij proces
  app.post('/api/servers/:id/processes/:pid/kill', requireAuth, async (req, res) => {
    const { id, pid } = req.params;
    const { signal = 'TERM' } = req.body;
    
    try {
      if (!activeConnections.has(id)) {
        return res.status(400).json({ success: false, error: 'Not connected' });
      }
      
      await execCommand(id, `kill -${signal} ${pid}`);
      res.json({ success: true, message: `Process ${pid} killed with signal ${signal}` });
      
    } catch (error) {
      console.error('Kill error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Pobierz logi systemowe
  app.get('/api/servers/:id/logs', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { lines = 50 } = req.query;
    
    try {
      if (!activeConnections.has(id)) {
        return res.status(400).json({ success: false, error: 'Not connected' });
      }
      
      let output;
      try {
        output = await execCommand(id, `journalctl -n ${lines} --no-pager 2>/dev/null || tail -n ${lines} /var/log/syslog 2>/dev/null || echo "No logs available"`);
      } catch (e) {
        output = 'No logs available';
      }
      
      const logs = output.split('\n').map(line => ({
        message: line,
        timestamp: new Date().toISOString()
      }));
      
      res.json({ success: true, logs });
      
    } catch (error) {
      console.error('Logs error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== FUNKCJE POMOCNICZE ====================

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};
