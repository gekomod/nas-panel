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
        version: '1.1' // Można pobrać z pliku lub komendy
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
      
      // Wymuś podanie aliasu dla każdego udostępnienia
      if (config.shares) {
        for (const share of config.shares) {
          if (!share.alias || share.alias.trim() === '') {
            return res.status(400).json({ 
              success: false,
              error: 'Alias is required for each share'
            });
          }
        }
      }
      
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

app.get('/services/webdav/available-disks', requireAuth, async (req, res) => {
  try {
    // Użyj tylko dostępnych kolumn
    const { stdout } = await execAsync(
      'lsblk -o NAME,TYPE,MOUNTPOINT,FSTYPE,SIZE,MODEL,ROTA -J -b'
    );
    const lsblkData = JSON.parse(stdout);
    
    if (!lsblkData.blockdevices) {
      throw new Error('Nieprawidłowy format wyjścia lsblk');
    }

    // Znajdź wszystkie dyski i ich partycje
    const disks = lsblkData.blockdevices
      .filter(dev => dev.type === 'disk' && !dev.name.startsWith('loop'))
      .map(disk => {
        // Znajdź główną partycję (z punktem montowania)
        const mountedPartition = disk.children?.find(
          part => part.mountpoint && part.mountpoint !== '[SWAP]'
        );
        
        return {
          name: disk.model || `Dysk ${disk.name}`,
          device: `/dev/${disk.name}`,
          mountpoint: mountedPartition?.mountpoint || null,
          fstype: mountedPartition?.fstype || null,
          size: disk.size,
          model: disk.model || 'Nieznany',
          isSSD: disk.rota === '0',
          isSystem: disk.mountpoint === '/' // Systemowy jeśli montowany w root
        };
      })
      .filter(disk => disk.mountpoint); // Filtruj tylko zamontowane dyski

    res.json({ 
      success: true,
      data: disks
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Nie udało się pobrać listy dysków',
      details: error.message,
      suggestion: 'Sprawdź czy lsblk jest dostępne i czy dyski są zamontowane'
    });
  }
});

};
