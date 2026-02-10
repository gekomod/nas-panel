const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const os = require('os');
const path = require('path');
const crypto = require('crypto');

module.exports = function(app, requireAuth) {
  const VPN_BASE_PATH = '/etc/vpn';
  const WIREGUARD_PATH = '/etc/wireguard';
  const OPENVPN_PATH = '/etc/openvpn';
  const IPSEC_PATH = '/etc/ipsec';

  // Helper function to generate WireGuard keys
  function generateWireGuardKeys() {
    const privateKey = crypto.randomBytes(32);
    const publicKey = crypto.createPublicKey({
      key: crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' }),
      format: 'der',
      type: 'spki'
    });
    
    return {
      privateKey: privateKey.toString('base64'),
      publicKey: publicKey.toString('base64')
    };
  }

  // Helper to format uptime
  function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Ensure VPN directories exist
  async function ensureDirectories() {
    const dirs = [VPN_BASE_PATH, WIREGUARD_PATH, OPENVPN_PATH, IPSEC_PATH];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  // Get system services status
  async function getServiceStatus(serviceName) {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${serviceName}`);
      return stdout.trim() === 'active';
    } catch (error) {
      return false;
    }
  }

  // Get process uptime
  async function getServiceUptime(serviceName) {
    try {
      const { stdout } = await execAsync(`systemctl show ${serviceName} --property=ActiveEnterTimestampMonotonic`);
      const match = stdout.match(/ActiveEnterTimestampMonotonic=(\d+)/);
      if (match) {
        const monotonic = parseInt(match[1]) / 1000000; // Convert to seconds
        return formatUptime(monotonic);
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  // Get WireGuard interfaces
  async function getWireGuardInterfaces() {
    try {
      const { stdout } = await execAsync('wg show interfaces');
      return stdout.trim().split('\n').filter(iface => iface);
    } catch (error) {
      return [];
    }
  }

  // Get WireGuard interface details
  async function getWireGuardInterface(interfaceName) {
    try {
      const { stdout } = await execAsync(`wg show ${interfaceName}`);
      const lines = stdout.trim().split('\n');
      
      const result = {
        interface: interfaceName,
        publicKey: '',
        privateKey: '',
        listenPort: 0,
        fwMark: '',
        peers: []
      };

      let currentPeer = null;

      for (const line of lines) {
        if (line.includes('public key:')) {
          result.publicKey = line.split(':')[1].trim();
        } else if (line.includes('listening port:')) {
          result.listenPort = parseInt(line.split(':')[1].trim());
        } else if (line.includes('fwmark:')) {
          result.fwMark = line.split(':')[1].trim();
        } else if (line.includes('peer:')) {
          if (currentPeer) {
            result.peers.push(currentPeer);
          }
          currentPeer = {
            publicKey: line.split(':')[1].trim(),
            allowedIPs: [],
            latestHandshake: 0,
            transferRx: 0,
            transferTx: 0
          };
        } else if (line.includes('allowed ips:')) {
          if (currentPeer) {
            currentPeer.allowedIPs = line.split(':')[1].trim().split(',').map(ip => ip.trim());
          }
        } else if (line.includes('latest handshake:')) {
          if (currentPeer) {
            const handshake = line.split(':')[1].trim();
            if (handshake !== '') {
              currentPeer.latestHandshake = parseInt(handshake);
            }
          }
        } else if (line.includes('transfer:')) {
          if (currentPeer) {
            const transfer = line.split(':')[1].trim();
            const [rx, tx] = transfer.split(', ').map(t => t.split(' ')[0]);
            currentPeer.transferRx = parseInt(rx);
            currentPeer.transferTx = parseInt(tx);
          }
        }
      }

      if (currentPeer) {
        result.peers.push(currentPeer);
      }

      return result;
    } catch (error) {
      return null;
    }
  }

  // Get OpenVPN connections
  async function getOpenVPNConnections() {
    try {
      const files = await fs.readdir(OPENVPN_PATH);
      const configs = files.filter(file => file.endsWith('.conf'));
      
      const connections = [];
      
      for (const configFile of configs) {
        const configPath = path.join(OPENVPN_PATH, configFile);
        const stats = await fs.stat(configPath);
        
        const configContent = await fs.readFile(configPath, 'utf8');
        const nameMatch = configContent.match(/^#\s*name:\s*(.+)$/mi);
        const serverMatch = configContent.match(/^remote\s+([^\s]+)/mi);
        const portMatch = configContent.match(/^remote\s+[^\s]+\s+(\d+)/mi);
        const protoMatch = configContent.match(/^proto\s+(\w+)/mi);
        
        const interfaceName = path.basename(configFile, '.conf');
        const isRunning = await getServiceStatus(`openvpn@${interfaceName}`);
        
        connections.push({
          id: interfaceName,
          name: nameMatch ? nameMatch[1].trim() : interfaceName,
          configFile: configFile,
          server: serverMatch ? serverMatch[1] : '',
          port: portMatch ? parseInt(portMatch[1]) : 1194,
          protocol: protoMatch ? protoMatch[1] : 'udp',
          enabled: true,
          active: isRunning,
          uptime: isRunning ? await getServiceUptime(`openvpn@${interfaceName}`) : null,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      return connections;
    } catch (error) {
      return [];
    }
  }

  // Get IPSec/L2TP status
  async function getIPSecStatus() {
    try {
      const isRunning = await getServiceStatus('ipsec');
      const strongswanRunning = await getServiceStatus('strongswan');
      
      if (isRunning || strongswanRunning) {
        const uptime = await getServiceUptime('ipsec') || await getServiceUptime('strongswan');
        
        // Try to get connection info
        let connections = [];
        try {
          const { stdout } = await execAsync('ipsec statusall');
          const lines = stdout.split('\n');
          
          for (const line of lines) {
            if (line.includes('Security Associations')) {
              const match = line.match(/\((\d+)\)/);
              if (match) {
                connections = Array(parseInt(match[1])).fill({});
              }
            }
          }
        } catch (error) {
          // Ignore
        }
        
        return {
          enabled: true,
          running: true,
          uptime: uptime,
          connections: connections.length,
          daemon: isRunning ? 'ipsec' : 'strongswan'
        };
      }
      
      // Check if config exists
      try {
        const configExists = await fs.access(path.join(IPSEC_PATH, 'ipsec.conf')).then(() => true).catch(() => false);
        const secretsExists = await fs.access(path.join(IPSEC_PATH, 'ipsec.secrets')).then(() => true).catch(() => false);
        
        return {
          enabled: configExists && secretsExists,
          running: false,
          uptime: null,
          connections: 0,
          daemon: 'ipsec'
        };
      } catch (error) {
        return {
          enabled: false,
          running: false,
          uptime: null,
          connections: 0,
          daemon: null
        };
      }
    } catch (error) {
      return {
        enabled: false,
        running: false,
        uptime: null,
        connections: 0,
        daemon: null
      };
    }
  }

  // Get statistics
  async function getVPNStatistics() {
    try {
      // Get network statistics
      const { stdout: netstat } = await execAsync('netstat -i');
      const lines = netstat.split('\n');
      let totalBytes = 0;
      
      for (const line of lines.slice(2)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 8) {
          totalBytes += parseInt(parts[6]) + parseInt(parts[7]); // RX + TX bytes
        }
      }
      
      // Count active connections
      const wireguardIfaces = await getWireGuardInterfaces();
      const openvpnConns = await getOpenVPNConnections();
      const ipsecStatus = await getIPSecStatus();
      
      const activeConnections = 
        wireguardIfaces.length + 
        openvpnConns.filter(c => c.active).length + 
        (ipsecStatus.running ? 1 : 0);
      
      // Get last connection time
      let lastConnection = null;
      try {
        const { stdout } = await execAsync('last | grep "still logged in" | head -1');
        if (stdout.trim()) {
          lastConnection = new Date().toISOString();
        }
      } catch (error) {
        // Ignore
      }
      
      return {
        totalBytes: totalBytes,
        activeConnections: activeConnections,
        lastConnection: lastConnection,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        totalBytes: 0,
        activeConnections: 0,
        lastConnection: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Initialize directories
  ensureDirectories().catch(console.error);

  // ========== API ROUTES ==========

  // Get all VPN services overview
  app.get('/api/vpn/overview', requireAuth, async (req, res) => {
    try {
      const wireguardIfaces = await getWireGuardInterfaces();
      const openvpnConns = await getOpenVPNConnections();
      const ipsecStatus = await getIPSecStatus();
      const stats = await getVPNStatistics();
      
      res.json({
        wireguard: {
          installed: true,
          active: wireguardIfaces.length > 0,
          interfaces: wireguardIfaces.length,
          configs: wireguardIfaces.length
        },
        openvpn: {
          installed: openvpnConns.length > 0,
          active: openvpnConns.some(c => c.active),
          connections: openvpnConns.length,
          configs: openvpnConns.length
        },
        ipsec: {
          installed: ipsecStatus.enabled,
          active: ipsecStatus.running,
          connections: ipsecStatus.connections
        },
        statistics: stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get WireGuard interfaces
  app.get('/api/vpn/wireguard', requireAuth, async (req, res) => {
    try {
      const interfaces = await getWireGuardInterfaces();
      const details = [];
      
      for (const iface of interfaces) {
        const detail = await getWireGuardInterface(iface);
        if (detail) {
          details.push(detail);
        }
      }
      
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get WireGuard interface config
  app.get('/api/vpn/wireguard/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;
      const configPath = path.join(WIREGUARD_PATH, `${iface}.conf`);
      
      try {
        const config = await fs.readFile(configPath, 'utf8');
        res.json({ interface: iface, config: config });
      } catch (error) {
        const detail = await getWireGuardInterface(iface);
        if (detail) {
          res.json(detail);
        } else {
          res.status(404).json({ error: 'Interface not found' });
        }
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create/Update WireGuard interface
  app.post('/api/vpn/wireguard/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;
      const { config, name, address, listenPort, privateKey, peers } = req.body;
      
      let configContent = '';
      
      if (config) {
        // Use provided config file content
        configContent = config;
      } else {
        // Build config from parameters
        configContent = `# WireGuard configuration for ${name || iface}\n`;
        configContent += `[Interface]\n`;
        configContent += `Address = ${address || '10.0.0.1/24'}\n`;
        configContent += `PrivateKey = ${privateKey || generateWireGuardKeys().privateKey}\n`;
        if (listenPort) {
          configContent += `ListenPort = ${listenPort}\n`;
        }
        
        if (peers && Array.isArray(peers)) {
          peers.forEach((peer, index) => {
            configContent += `\n[Peer] # Peer ${index + 1}\n`;
            configContent += `PublicKey = ${peer.publicKey}\n`;
            configContent += `AllowedIPs = ${peer.allowedIPs || '0.0.0.0/0'}\n`;
            if (peer.endpoint) {
              configContent += `Endpoint = ${peer.endpoint}\n`;
            }
            if (peer.persistentKeepalive) {
              configContent += `PersistentKeepalive = ${peer.persistentKeepalive}\n`;
            }
          });
        }
      }
      
      const configPath = path.join(WIREGUARD_PATH, `${iface}.conf`);
      await fs.writeFile(configPath, configContent, 'utf8');
      
      res.json({ 
        success: true, 
        message: 'WireGuard configuration saved',
        interface: iface,
        path: configPath
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete WireGuard interface
  app.delete('/api/vpn/wireguard/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;
      const configPath = path.join(WIREGUARD_PATH, `${iface}.conf`);
      
      // Stop the interface first
      try {
        await execAsync(`wg-quick down ${iface}`);
      } catch (error) {
        // Interface might not be running
      }
      
      // Delete config file
      try {
        await fs.unlink(configPath);
      } catch (error) {
        // File might not exist
      }
      
      res.json({ success: true, message: 'WireGuard interface deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Control WireGuard interface
  app.post('/api/vpn/wireguard/:interface/:action', requireAuth, async (req, res) => {
    try {
      const { interface: iface, action } = req.params;
      
      if (!['up', 'down', 'restart'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      
      const configPath = path.join(WIREGUARD_PATH, `${iface}.conf`);
      
      try {
        await fs.access(configPath);
      } catch (error) {
        return res.status(404).json({ error: 'Interface configuration not found' });
      }
      
      await execAsync(`wg-quick ${action} ${iface}`);
      
      res.json({ success: true, message: `WireGuard interface ${action} completed` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get OpenVPN connections
  app.get('/api/vpn/openvpn', requireAuth, async (req, res) => {
    try {
      const connections = await getOpenVPNConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get OpenVPN connection config
  app.get('/api/vpn/openvpn/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const configPath = path.join(OPENVPN_PATH, `${id}.conf`);
      
      try {
        const config = await fs.readFile(configPath, 'utf8');
        const stats = await fs.stat(configPath);
        
        const serverMatch = config.match(/^remote\s+([^\s]+)/mi);
        const portMatch = config.match(/^remote\s+[^\s]+\s+(\d+)/mi);
        const protoMatch = config.match(/^proto\s+(\w+)/mi);
        const authMatch = config.match(/^auth-user-pass\s+([^\s]+)/mi);
        
        let username = '';
        let password = '';
        
        if (authMatch) {
          const authPath = authMatch[1];
          if (authPath && authPath !== '') {
            try {
              const authContent = await fs.readFile(authPath, 'utf8');
              const authLines = authContent.split('\n');
              username = authLines[0] || '';
              password = authLines[1] ? '********' : '';
            } catch (error) {
              // Auth file not found
            }
          }
        }
        
        const isRunning = await getServiceStatus(`openvpn@${id}`);
        
        res.json({
          id: id,
          name: id,
          config: config,
          server: serverMatch ? serverMatch[1] : '',
          port: portMatch ? parseInt(portMatch[1]) : 1194,
          protocol: protoMatch ? protoMatch[1] : 'udp',
          username: username,
          password: password,
          enabled: true,
          active: isRunning,
          uptime: isRunning ? await getServiceUptime(`openvpn@${id}`) : null,
          created: stats.birthtime,
          modified: stats.mtime
        });
      } catch (error) {
        res.status(404).json({ error: 'Configuration not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create/Update OpenVPN connection
  app.post('/api/vpn/openvpn/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { config, name, server, port, protocol, username, password } = req.body;
      
      let configContent = '';
      
      if (config) {
        // Use provided config file content
        configContent = config;
      } else {
        // Build config from parameters
        configContent = `# OpenVPN configuration for ${name || id}\n`;
        configContent += `# name: ${name || id}\n`;
        configContent += `client\n`;
        configContent += `dev tun\n`;
        configContent += `proto ${protocol || 'udp'}\n`;
        configContent += `remote ${server} ${port || 1194}\n`;
        configContent += `resolv-retry infinite\n`;
        configContent += `nobind\n`;
        configContent += `persist-key\n`;
        configContent += `persist-tun\n`;
        
        // Add authentication if provided
        if (username && password) {
          const authPath = path.join(OPENVPN_PATH, `${id}.auth`);
          await fs.writeFile(authPath, `${username}\n${password}\n`, 'utf8');
          configContent += `auth-user-pass ${authPath}\n`;
        }
        
        configContent += `remote-cert-tls server\n`;
        configContent += `cipher AES-256-GCM\n`;
        configContent += `auth SHA256\n`;
        configContent += `verb 3\n`;
      }
      
      const configPath = path.join(OPENVPN_PATH, `${id}.conf`);
      await fs.writeFile(configPath, configContent, 'utf8');
      
      res.json({ 
        success: true, 
        message: 'OpenVPN configuration saved',
        id: id,
        path: configPath
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete OpenVPN connection
  app.delete('/api/vpn/openvpn/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const configPath = path.join(OPENVPN_PATH, `${id}.conf`);
      
      // Stop the connection first
      try {
        await execAsync(`systemctl stop openvpn@${id}`);
      } catch (error) {
        // Service might not be running
      }
      
      // Delete config file
      try {
        await fs.unlink(configPath);
      } catch (error) {
        // File might not exist
      }
      
      // Delete auth file if exists
      const authPath = path.join(OPENVPN_PATH, `${id}.auth`);
      try {
        await fs.unlink(authPath);
      } catch (error) {
        // File might not exist
      }
      
      res.json({ success: true, message: 'OpenVPN connection deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Control OpenVPN connection
  app.post('/api/vpn/openvpn/:id/:action', requireAuth, async (req, res) => {
    try {
      const { id, action } = req.params;
      
      if (!['start', 'stop', 'restart', 'enable', 'disable'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      
      const configPath = path.join(OPENVPN_PATH, `${id}.conf`);
      
      try {
        await fs.access(configPath);
      } catch (error) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      
      if (action === 'enable' || action === 'disable') {
        await execAsync(`systemctl ${action} openvpn@${id}`);
      } else {
        await execAsync(`systemctl ${action} openvpn@${id}`);
      }
      
      res.json({ success: true, message: `OpenVPN connection ${action}ed` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get IPSec status and config
  app.get('/api/vpn/ipsec', requireAuth, async (req, res) => {
    try {
      const status = await getIPSecStatus();
      
      // Try to read config
      let config = {};
      try {
        const configPath = path.join(IPSEC_PATH, 'ipsec.conf');
        const configContent = await fs.readFile(configPath, 'utf8');
        config.conf = configContent;
      } catch (error) {
        config.conf = null;
      }
      
      // Try to read secrets
      try {
        const secretsPath = path.join(IPSEC_PATH, 'ipsec.secrets');
        const secretsContent = await fs.readFile(secretsPath, 'utf8');
        config.secrets = secretsContent;
      } catch (error) {
        config.secrets = null;
      }
      
      res.json({ status: status, config: config });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update IPSec configuration
  app.post('/api/vpn/ipsec', requireAuth, async (req, res) => {
    try {
      const { conf, secrets, psk, username, password } = req.body;
      
      if (conf) {
        const configPath = path.join(IPSEC_PATH, 'ipsec.conf');
        await fs.writeFile(configPath, conf, 'utf8');
      }
      
      if (secrets) {
        const secretsPath = path.join(IPSEC_PATH, 'ipsec.secrets');
        await fs.writeFile(secretsPath, secrets, 'utf8');
      } else if (psk || (username && password)) {
        // Generate simple secrets file
        let secretsContent = '';
        if (psk) {
          secretsContent += `%any %any : PSK "${psk}"\n`;
        }
        if (username && password) {
          secretsContent += `${username} : XAUTH "${password}"\n`;
        }
        
        const secretsPath = path.join(IPSEC_PATH, 'ipsec.secrets');
        await fs.writeFile(secretsPath, secretsContent, 'utf8');
      }
      
      res.json({ success: true, message: 'IPSec configuration saved' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Control IPSec service
  app.post('/api/vpn/ipsec/:action', requireAuth, async (req, res) => {
    try {
      const { action } = req.params;
      
      if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      
      await execAsync(`systemctl ${action} ipsec`);
      
      res.json({ success: true, message: `IPSec service ${action}ed` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get VPN statistics
  app.get('/api/vpn/statistics', requireAuth, async (req, res) => {
    try {
      const stats = await getVPNStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate WireGuard keys
  app.get('/api/vpn/wireguard-keys/generate', requireAuth, async (req, res) => {
    try {
      const keys = generateWireGuardKeys();
      res.json(keys);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get VPN logs
  app.get('/api/vpn/logs/:service', requireAuth, async (req, res) => {
    try {
      const { service } = req.params;
      const { lines = 100 } = req.query;
      
      let command = '';
      
      if (service === 'wireguard') {
        command = `journalctl -u wg-quick@* -n ${lines} --no-pager`;
      } else if (service === 'openvpn') {
        command = `journalctl -u openvpn@* -n ${lines} --no-pager`;
      } else if (service === 'ipsec') {
        command = `journalctl -u ipsec -n ${lines} --no-pager`;
      } else if (service === 'all') {
        command = `journalctl -u wg-quick@* -u openvpn@* -u ipsec -n ${lines} --no-pager`;
      } else {
        return res.status(400).json({ error: 'Invalid service' });
      }
      
      const { stdout } = await execAsync(command);
      res.json({ logs: stdout });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get connection status (all services combined)
  app.get('/api/vpn/connections', requireAuth, async (req, res) => {
    try {
      const wireguardIfaces = await getWireGuardInterfaces();
      const openvpnConns = await getOpenVPNConnections();
      const ipsecStatus = await getIPSecStatus();
      
      const connections = [];
      
      // WireGuard interfaces
      for (const iface of wireguardIfaces) {
        const detail = await getWireGuardInterface(iface);
        if (detail) {
          connections.push({
            id: iface,
            type: 'wireguard',
            name: iface,
            status: 'Connected',
            ip: detail.address || '',
            uptime: formatUptime(detail.peers.reduce((max, peer) => Math.max(max, peer.latestHandshake), 0)),
            bytes: detail.peers.reduce((sum, peer) => sum + peer.transferRx + peer.transferTx, 0)
          });
        }
      }
      
      // OpenVPN connections
      for (const conn of openvpnConns) {
        connections.push({
          id: conn.id,
          type: 'openvpn',
          name: conn.name,
          status: conn.active ? 'Connected' : 'Disconnected',
          ip: conn.server || '',
          uptime: conn.uptime || '',
          bytes: 0 // Would need to parse ifconfig/tun stats
        });
      }
      
      // IPSec
      if (ipsecStatus.enabled) {
        connections.push({
          id: 'ipsec',
          type: 'ipsec',
          name: 'IPSec/L2TP Server',
          status: ipsecStatus.running ? 'Connected' : 'Disconnected',
          ip: '0.0.0.0',
          uptime: ipsecStatus.uptime || '',
          bytes: 0
        });
      }
      
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};
