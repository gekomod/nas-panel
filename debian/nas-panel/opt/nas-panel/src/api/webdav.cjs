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
    // Użyj rozszerzonego formatu z UUID i więcej informacji
    const { stdout } = await execAsync(
      'lsblk -o NAME,TYPE,MOUNTPOINT,FSTYPE,SIZE,MODEL,ROTA,LABEL,UUID -J -b'
    );
    
    const lsblkData = JSON.parse(stdout);
    
    if (!lsblkData.blockdevices) {
      throw new Error('Nieprawidłowy format wyjścia lsblk');
    }

    // Funkcja rekurencyjna do znajdowania wszystkich zamontowanych urządzeń
    const findMountedDevices = (devices) => {
      const mounted = [];
      
      for (const device of devices) {
        // Sprawdź czy to urządzenie ma punkt montowania
        if (device.mountpoint && device.mountpoint !== '[SWAP]') {
          mounted.push({
            name: device.model || device.label || `Urządzenie ${device.name}`,
            device: `/dev/${device.name}`,
            mountpoint: device.mountpoint,
            fstype: device.fstype || 'unknown',
            size: parseInt(device.size) || 0,
            model: device.model || 'Nieznany',
            label: device.label || '',
            uuid: device.uuid || '',
            isSSD: device.rota === '0',
            isSystem: device.mountpoint === '/',
            type: device.type,
            hasChildren: !!device.children && device.children.length > 0
          });
        }
        
        // Rekurencyjnie przeszukaj dzieci (partycje)
        if (device.children && device.children.length > 0) {
          mounted.push(...findMountedDevices(device.children));
        }
      }
      
      return mounted;
    };

    // Znajdź wszystkie zamontowane urządzenia
    const mountedDevices = findMountedDevices(lsblkData.blockdevices);
    
    // Usuń duplikaty (czasem mogą się pojawić)
    const uniqueDevices = mountedDevices.filter((device, index, self) =>
      index === self.findIndex(d => d.mountpoint === device.mountpoint)
    );

    // Dodaj dyski fizyczne, nawet jeśli nie są zamontowane (ale mają partycje)
    const allDisks = lsblkData.blockdevices
      .filter(dev => dev.type === 'disk' && !dev.name.startsWith('loop'))
      .map(disk => {
        // Sprawdź czy któraś partycja jest zamontowana
        const mountedPartitions = disk.children?.filter(
          part => part.mountpoint && part.mountpoint !== '[SWAP]'
        ) || [];

        return {
          name: disk.model || `Dysk ${disk.name}`,
          device: `/dev/${disk.name}`,
          mountpoint: null, // Dysk fizyczny nie ma mountpoint
          fstype: null,
          size: parseInt(disk.size) || 0,
          model: disk.model || 'Nieznany',
          label: disk.label || '',
          isSSD: disk.rota === '0',
          isSystem: false,
          type: 'disk',
          hasChildren: !!disk.children && disk.children.length > 0,
          partitions: disk.children?.map(part => ({
            name: part.name,
            mountpoint: part.mountpoint,
            fstype: part.fstype,
            size: part.size,
            label: part.label
          })) || [],
          mountedPartitions: mountedPartitions.length
        };
      });

    res.json({ 
      success: true,
      data: {
        // Wszystkie zamontowane urządzenia (partycje, LVM, etc.)
        mountedDevices: uniqueDevices,
        // Wszystkie dyski fizyczne
        physicalDisks: allDisks,
        // Dla kompatybilności - pokaż wszystkie zamontowane urządzenia
        allAvailable: [...uniqueDevices, ...allDisks.filter(d => d.mountedPartitions > 0)]
      }
    });
    
  } catch (error) {
    console.error('Błąd pobierania dysków:', error);
    res.status(500).json({ 
      success: false,
      error: 'Nie udało się pobrać listy dysków',
      details: error.message,
      suggestion: 'Sprawdź czy lsblk jest dostępne i czy dyski są zamontowane'
    });
  }
});

};
