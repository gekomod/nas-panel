// src/api/webdav.js
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const WEBDAV_CONFIG_PATH = '/etc/nas-panel/webdav.conf';
const WEBDAV_SERVER_BINARY = '/usr/local/bin/nas-webdav';

module.exports = function(app, requireAuth) {

  // Status usługi WebDAV
  app.get('/services/webdav/status', requireAuth, async (req, res) => {
    try {
      // Sprawdź czy serwer jest zainstalowany
      try {
        await fs.access(WEBDAV_SERVER_BINARY);
      } catch {
        return res.json({ 
          installed: false,
          running: false,
          active: false
        });
      }

      // Sprawdź status usługi
      const { stdout } = await execAsync('systemctl is-active nas-webdav');
      const isActive = stdout.trim() === 'active';

      res.json({
        installed: true,
        running: isActive,
        active: isActive,
        version: '1.0' // Można pobrać z pliku lub komendy
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to check WebDAV status'
      });
    }
  });

  // Zarządzanie usługą
  app.post('/services/webdav/toggle', requireAuth, async (req, res) => {
    const { action } = req.body;
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action' 
      });
    }

    try {
      await execAsync(`systemctl ${action} nas-webdav`);
      res.json({ 
        success: true,
        message: `WebDAV service ${action}ed` 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: `Failed to ${action} WebDAV`,
        details: error.message
      });
    }
  });

  // Pobierz konfigurację
  app.get('/services/webdav/config', requireAuth, async (req, res) => {
    try {
      const config = await fs.readFile(WEBDAV_CONFIG_PATH, 'utf8');
      res.json({ 
        success: true,
        config: JSON.parse(config) 
      });
    } catch (error) {
      // Jeśli plik nie istnieje, zwróć domyślną konfigurację
      if (error.code === 'ENOENT') {
        return res.json({
          success: true,
          config: {
            port: 8080,
            protocol: 'http',
            shares: [],
            auth: {
              enabled: true,
              users: []
            },
            nfs: {
              enabled: false,
              versions: ['v3', 'v4']
            }
          }
        });
      }
      res.status(500).json({ 
        success: false,
        error: 'Failed to read config' 
      });
    }
  });

  // Zapisz konfigurację
  app.post('/services/webdav/config', requireAuth, async (req, res) => {
    try {
      const { config } = req.body;
      await fs.writeFile(WEBDAV_CONFIG_PATH, JSON.stringify(config, null, 2));
      
      // Przeładuj usługę jeśli jest uruchomiona
      try {
        await execAsync('systemctl restart nas-webdav');
      } catch (serviceError) {
        console.error('WebDAV reload error:', serviceError);
      }
      
      res.json({ 
        success: true,
        message: 'Config saved' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to save config' 
      });
    }
  });

  // Lista dostępnych dysków (wykorzystuje istniejące API storage)
  app.get('/services/webdav/available-disks', requireAuth, async (req, res) => {
    try {
      // Wykorzystaj istniejące endpointy storage
      const storageResponse = await axios.get('/api/storage/devices');
      
      // Filtruj tylko dyski (nie partycje)
      const disks = storageResponse.data.data.filter(dev => 
        dev.type === 'disk' && 
        dev.mountpoint && 
        dev.fstype
      ).map(disk => ({
        path: disk.path,
        mountpoint: disk.mountpoint,
        fstype: disk.fstype,
        size: disk.size,
        model: disk.model
      }));

      res.json({ 
        success: true,
        data: disks 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get disks list' 
      });
    }
  });
};
