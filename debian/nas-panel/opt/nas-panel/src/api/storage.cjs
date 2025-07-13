const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execAsyncs = promisify(exec);
const SMART_CONFIG_PATH = '/etc/nas-panel/smart_monitoring.json';

async function loadSmartConfig() {
  try {
    const data = await fs.readFile(SMART_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { devices: {} };
    }
    throw err;
  }
}

async function saveSmartConfig(config) {
  await fs.writeFile(SMART_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = function(app,requireAuth) {

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;

// Własna implementacja execAsync z lepszą obsługą błędów
const execAsync = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(command, { ...options, encoding: 'utf8' }, (error, stdout, stderr) => {
      // Traktujemy output jako potencjalnie ważny nawet jeśli jest kod błędu
      if (stdout || stderr) {
        resolve({ stdout, stderr });
      } else {
        reject(error || new Error('Command failed'));
      }
    });
  });
};

app.get('/api/storage/smart', requireAuth, async (req, res) => {
  // 1. Pobierz listę urządzeń dyskowych
  let devices;
  try {
    const { stdout } = await execAsync('lsblk -d -o NAME,TYPE,ROTA,MODEL,SERIAL -n -J');
    const lsblkData = JSON.parse(stdout);
    
    devices = lsblkData.blockdevices
      .filter(dev => dev.type === 'disk' && !dev.name.startsWith('loop'))
      .map(dev => ({
        name: dev.name,
        model: dev.model || 'Unknown',
        serial: dev.serial || 'Unknown',
        isSSD: dev.rota === '0'
      }));
  } catch (error) {
    //console.error('Failed to list devices:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list storage devices',
      details: error.message
    });
  }

  // 2. Pobierz dane SMART dla każdego urządzenia
  const results = [];
  const smartCommands = [
    { cmd: 'sudo -n smartctl', requireSudo: true },
    { cmd: 'smartctl', requireSudo: false }
  ];

  for (const device of devices) {
    const devicePath = `/dev/${device.name}`;
    const deviceResult = {
      device: devicePath,
      model: device.model,
      serial: device.serial,
      vendor: extractVendor(device.model),
      isSSD: device.isSSD,
      temperature: null,
      capacity: 0,
      status: 'unknown',
      available: false,
      error: null,
      rawData: null
    };

    // Próbuj różne warianty komend SMART
    for (const { cmd, requireSudo } of smartCommands) {
      try {
        const fullCmd = `${cmd} -A -i -H ${devicePath} --json`;
        //console.log(`Executing: ${fullCmd}`);
        
        const { stdout, stderr } = await execAsync(fullCmd, { timeout: 8000 });
        
        // Parsuj dane nawet jeśli jest kod błędu
        try {
          const smartData = JSON.parse(stdout);
          
          // Aktualizuj wynik jeśli są jakiekolwiek dane
          if (smartData.device || smartData.model_name) {
            updateDeviceResult(deviceResult, smartData);
            break; // Wyjdź z pętli jeśli udało się uzyskać dane
          }
        } catch (parseError) {
         // console.warn(`Failed to parse SMART data for ${devicePath}:`, parseError);
        }
      } catch (error) {
        //console.warn(`Command failed for ${devicePath}:`, error.message);
        deviceResult.error = error.stderr || error.message;
      }
    }

    // Jeśli nie udało się uzyskać danych, spróbuj podstawowej komendy
    if (!deviceResult.available) {
      try {
        const { stdout } = await execAsync(`smartctl -i ${devicePath}`);
        deviceResult.model = extractFromText(stdout, /Device Model:\s*(.+)/) || device.model;
        deviceResult.serial = extractFromText(stdout, /Serial Number:\s*(.+)/) || device.serial;
      } catch (basicError) {
        // console.warn(`Basic info failed for ${devicePath}:`, basicError);
      }
    }

    results.push(deviceResult);
  }

  // 3. Zwróć wyniki
  res.json({
    success: true,
    data: results,
    timestamp: new Date().toISOString()
  });
});

// Funkcje pomocnicze
function extractVendor(model) {
  if (!model) return 'Unknown';
  const vendors = [
    'Samsung', 'Seagate', 'Western Digital', 'WDC', 
    'Toshiba', 'Intel', 'Crucial', 'Kingston', 'SanDisk', 'Hitachi', 'Crucial'
  ];
  return vendors.find(v => model.includes(v)) || 'Unknown';
}

function updateDeviceResult(result, smartData) {
  result.available = true;
  result.rawData = smartData;
  
  // Model i producent
  result.model = smartData.model_name || result.model;
  result.vendor = extractVendor(result.model);
  
  // Pojemność
  if (smartData.user_capacity?.bytes) {
    result.capacity = smartData.user_capacity.bytes;
  } else if (smartData.logical_block_size && smartData.sectors) {
    result.capacity = smartData.logical_block_size * smartData.sectors;
  }
  
  // Temperatura
  result.temperature = extractTemperature(smartData);
  
  // Status SMART
  result.status = determineSmartStatus(smartData);
}

function extractTemperature(data) {
  // Dla dysków NVMe
  if (data.nvme_smart_health_information_log?.temperature) {
    return data.nvme_smart_health_information_log.temperature - 273; // Konwersja z Kelvinów
  }
  
  // Dla tradycyjnych dysków
  if (data.temperature?.current) return data.temperature.current;
  
  // Z atrybutów SMART
  if (data.ata_smart_attributes?.table) {
    const tempAttr = data.ata_smart_attributes.table.find(
      attr => ['Temperature_Celsius', 'Temperature_Internal'].includes(attr.name) || attr.id === 194
    );
    if (tempAttr?.raw?.value) return parseInt(tempAttr.raw.value);
  }
  
  return null;
}

function determineSmartStatus(data) {
  if (data.smart_status?.passed) return 'healthy';
  if (data.smart_status?.failed) return 'error';
  
  // Dla NVMe
  if (data.nvme_smart_health_information_log?.critical_warning) {
    return data.nvme_smart_health_information_log.critical_warning > 0 ? 'warning' : 'healthy';
  }
  
  return 'unknown';
}

function extractFromText(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

  // POST endpoint
  app.post('/api/storage/smart/monitoring', (req, res, next) => {
    app.locals.requireAuth(req, res, async () => {
      try {
        const { device, enabled } = req.body;
        if (!device || typeof enabled !== 'boolean') {
          return res.status(400).json({ success: false, error: 'Invalid parameters' });
        }

        const config = await loadSmartConfig();
        config.devices[device] = {
          monitored: enabled,
          lastUpdated: new Date().toISOString()
        };

        await saveSmartConfig(config);
        //console.log(`SMART monitoring ${enabled ? 'enabled' : 'disabled'} for ${device}`);

        res.json({
          success: true,
          message: `Monitoring ${enabled ? 'enabled' : 'disabled'}`,
          config: config.devices[device],
          log: SMART_CONFIG_PATH
        });
      } catch (error) {
        //console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Update failed' });
      }
    });
  });

app.get('/api/storage/smart/monitoring', requireAuth, (req, res) => {
  const { device } = req.query;
  
  // Odczytaj konfigurację z pliku
  fs.readFile(SMART_CONFIG_PATH, 'utf8')
    .then(data => {
      const config = JSON.parse(data);
      
      // Jeśli podano konkretne urządzenie
      if (device) {
        const status = config.devices[device]?.monitored || false;
        return res.json({
          success: true,
          monitored: status,
          device: device
        });
      }
      
      // Jeśli nie podano urządzenia - zwróć wszystkie
      res.json({
        success: true,
        devices: config.devices
      });
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        // Jeśli plik nie istnieje - zwróć domyślne wartości
        return res.json({
          success: true,
          devices: {}
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to read monitoring status'
      });
    });
});

const smartCache = new Map();
const CACHE_TTL = 30000; // 30 sekund cache

app.get('/api/storage/smart/details/:device', requireAuth, async (req, res) => {
  const { device } = req.params;
  
  // Walidacja parametru device
  if (!device || typeof device !== 'string' || !device.startsWith('/dev/')) {
    return res.status(400).json({
      success: false,
      error: 'Nieprawidłowy parametr urządzenia',
      details: 'Ścieżka urządzenia musi zaczynać się od /dev/'
    });
  }

  // Sprawdź cache
  const cacheKey = `smart-${device}`;
  const cachedData = smartCache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
    return res.json(cachedData.response);
  }

  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsyncs = util.promisify(exec);
    const timeout = 10000;

    // Tylko jedno polecenie z sudo
    const cmd = `sudo smartctl -A -i -H ${device} --json`;
    
    let data;
    try {
      const { stdout } = await execAsyncs(cmd, { timeout });
      data = JSON.parse(stdout);
    } catch (error) {
      // Spróbuj parsować nawet jeśli jest błąd
      if (error.stdout) {
        try {
          data = JSON.parse(error.stdout);
        } catch (parseError) {
          throw new Error(`Błąd parsowania danych SMART: ${parseError.message}`);
        }
      } else {
        throw error;
      }
    }
    
    // Pobierz historię testów (jeśli dostępna)

    // Przygotuj odpowiedź
    const response = {
      success: true,
      data: {
        ...data,
        device_path: device,
        model_name: data.model_name || 'Nieznany',
        serial_number: data.serial_number || 'Nieznany',
        smart_status: data.smart_status || { 
          passed: false, 
          failed: false, 
          message: 'Status niedostępny' 
        },
        test_history: await getTestHistory(device)
      },
      timestamp: new Date().toISOString()
    };

    // Zapisz w cache
    smartCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    res.json(response);

  } catch (error) {
    console.error(`Błąd podczas pobierania danych SMART dla ${device}:`, error);
    
    // Spróbuj zwrócić przynajmniej podstawowe informacje
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsyncs = util.promisify(exec);
      
      const { stdout } = await execAsyncs(`smartctl -i ${device}`);
      res.json({
        success: false,
        error: 'Ograniczone dane SMART dostępne',
        basic_info: {
          device: device,
          model: stdout.match(/Device Model:\s*(.+)/)?.[1]?.trim() || 'Nieznany',
          serial: stdout.match(/Serial Number:\s*(.+)/)?.[1]?.trim() || 'Nieznany'
        },
        raw_output: stdout
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: 'Nie udało się pobrać informacji o urządzeniu',
        details: error.message,
        device: device
      });
    }
  }
});

// Get list of all available devices
// Zmodyfikowana funkcja do pobierania urządzeń
app.get('/api/storage/devices', requireAuth, async (req, res) => {
  try {
    // Pobieramy zarówno dyski jak i partycje
    const { stdout } = await execAsync('lsblk -o NAME,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT -n -J');
    const lsblkData = JSON.parse(stdout);
    
    const devices = lsblkData.blockdevices.map(dev => ({
      path: `/dev/${dev.name}`,
      model: dev.model || 'Unknown',
      serial: dev.serial || 'Unknown',
      type: dev.type,
      fstype: dev.fstype || '',
      mountpoint: dev.mountpoint || '',
      partitions: dev.children ? dev.children.map(part => ({
        path: `/dev/${part.name}`,
        fstype: part.fstype || '',
        mountpoint: part.mountpoint || '',
        type: part.type
      })) : []
    }));

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list storage devices',
      details: error.message
    });
  }
});
// Mount device
app.post('/api/storage/mount', requireAuth, async (req, res) => {
  const { device, mountPoint, fsType, options } = req.body;
  
  if (!device || !device.startsWith('/dev/')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device path',
      details: 'Device must start with /dev/'
    });
  }

  try {
    // Sprawdź czy to urządzenie ZFS
    const isZfs = fsType === 'zfs';
    let mountCmd;

    if (isZfs) {
      // Dla ZFS używamy 'zfs mount' zamiast standardowego mount
      mountCmd = `sudo zpool import ${device} && sudo zfs mount ${device}`;
    } else {
      // Standardowe montowanie dla innych systemów plików
      mountCmd = `sudo mkdir -p "${mountPoint}" && sudo mount -t ${fsType} -o ${options || 'defaults'} ${device} ${mountPoint}`;
    }

    const { stdout, stderr } = await execAsyncs(mountCmd);
    
    // Weryfikacja montowania
    let verifyCmd;
    if (isZfs) {
      verifyCmd = `sudo zfs list -H -o mounted ${device}`;
    } else {
      verifyCmd = `findmnt -n -o SOURCE --target ${mountPoint}`;
    }

    const { stdout: verifyStdout } = await execAsyncs(verifyCmd);
    
    if ((isZfs && verifyStdout.trim() !== 'yes') || (!isZfs && verifyStdout.trim() !== device)) {
      throw new Error('Mount verification failed');
    }

    res.json({
      success: true,
      message: 'Device mounted successfully',
      mountPoint: isZfs ? device : mountPoint,
      device: device,
      isZfs: isZfs
    });
  } catch (error) {
    let errorDetails = error.stderr || error.message;

    if (errorDetails.includes('already mounted')) {
      errorDetails = 'Device is already mounted';
    } else if (errorDetails.includes('no such pool')) {
      errorDetails = 'ZFS pool does not exist';
    } else if (errorDetails.includes('wrong fs type')) {
      errorDetails = 'Wrong filesystem type or corrupted device';
    } else if (errorDetails.includes('no such device')) {
      errorDetails = 'Device does not exist';
    }

    res.status(500).json({
      success: false,
      error: 'Failed to mount device',
      details: errorDetails,
      command: error.cmd
    });
  }
});

// Unmount filesystem
app.post('/api/storage/unmount', requireAuth, async (req, res) => {
  const { mountPoint } = req.body;
  
  try {
    // Sprawdź czy to ZFS
    let isZfs = false;
    try {
      const { stdout } = await execAsyncs(`sudo zfs list -H -o name ${mountPoint}`);
      isZfs = stdout.trim() === mountPoint;
    } catch (e) {
      // Nie jest ZFS
    }

    let unmountCmd;
    if (isZfs) {
      unmountCmd = `sudo zfs unmount ${mountPoint} && sudo zpool export ${mountPoint}`;
    } else {
      unmountCmd = `sudo umount "${mountPoint}"`;
    }

    await execAsyncs(unmountCmd);
    
    res.json({
      success: true,
      message: 'Filesystem unmounted successfully',
      isZfs: isZfs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to unmount filesystem',
      details: error.message
    });
  }
});

// Format device
app.post('/api/storage/format', requireAuth, async (req, res) => {
  const { device, fsType, label } = req.body;
  
    const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  try {
    // Dla ZFS - wyciągnij bazową nazwę dysku (usuń cyfry partycji)
    const targetDevice = fsType === 'zfs' 
      ? device.replace(/[0-9]+$/, '') 
      : device;

    console.log(`Formatting ${targetDevice} as ${fsType}`); // Debug

    // 1. Weryfikacja urządzenia
    const { stdout: deviceSize } = await execAsyncs(`lsblk -b -n -o SIZE ${targetDevice}`);
    if (!deviceSize.trim()) throw new Error(`Device ${targetDevice} not found`);

    // 2. Czyszczenie dysku
    await execAsyncs(`wipefs -a ${targetDevice}`);
    await execAsyncs(`sgdisk --zap-all ${targetDevice}`);
    await execAsyncs(`dd if=/dev/zero of=${targetDevice} bs=1M count=100 status=none`);

    // 3. Specjalna obsługa ZFS
    if (fsType === 'zfs') {
      const poolName = label || 'zpool';
      
      // Zniszcz istniejącą pulę jeśli istnieje
      try {
        await execAsyncs(`zpool destroy ${poolName}`);
      } catch (e) {
        console.log(`No existing pool ${poolName} to destroy`);
      }

      // Utwórz nową pulę na całym dysku
      await execAsyncs(`zpool create -f -o ashift=12 ${poolName} ${targetDevice}`);
      
      return res.json({
        success: true,
        message: `ZFS pool ${poolName} created on ${targetDevice}`,
        deviceUsed: targetDevice
      });
    } else {
      // Standardowe formatowanie dla innych FS
      switch (fsType) {
        case 'ext4':
          formatCmd = `mkfs.ext4 ${force ? '-F' : ''} ${label ? `-L ${label}` : ''} ${device}`;
          break;
        case 'xfs':
          formatCmd = `mkfs.xfs ${force ? '-f' : ''} ${label ? `-L ${label}` : ''} ${device}`;
          break;
        default:
          throw new Error(`Unsupported filesystem: ${fsType}`);
      }
      
          
       // Wykonaj formatowanie
       await execAsyncs(formatCmd, { timeout: 60000 });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Format failed',
      details: error.message,
      originalDevice: device
    });
  }
});

app.get('/api/storage/check-device', requireAuth, async (req, res) => {
  const { device } = req.query;
  
  try {
    // Check if device exists
    await fs.access(device);
    
    // Check filesystem type
    const { stdout: fsType } = await execAsync(`lsblk -no FSTYPE ${device}`);
    
    // Check if mounted
    const { stdout: mountPoint } = await execAsync(`findmnt -n -o TARGET --source ${device} || true`);
    
    res.json({
      success: true,
      exists: true,
      fsType: fsType.trim(),
      isMounted: mountPoint.trim() !== ''
    });
  } catch (error) {
    res.json({
      success: true,
      exists: false
    });
  }
});

app.post('/api/filesystems/list-directories', requireAuth, async (req, res) => {
  try {
    const { path } = req.body;
    const dirs = await fs.readdir(path, { withFileTypes: true });
    
    const directories = dirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const fullPath = `${path}/${dirent.name}`;
        return {
          name: dirent.name,
          path: fullPath,
          isLeaf: isDirectoryEmpty(fullPath)
        };
      });
    
    res.json({ success: true, directories });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list directories',
      details: error.message 
    });
  }
});

async function isDirectoryEmpty(path) {
  try {
    const files = await fs.readdir(path);
    return files.length === 0;
  } catch {
    return true;
  }
}

async function getTestHistory(device) {
  try {
    const { exec } = require('child_process')
    const util = require('util')
    const execAsyncs = util.promisify(exec)

    const { stdout } = await execAsyncs(`smartctl -l selftest ${device}`)
    return stdout.split('\n')
      .filter(line => line.includes('%'))
      .map(line => {
        const [date, type, status, remaining] = line.split(/\s+/)
        return { date, type, status, remaining }
      })
  } catch (e) {
    console.error('Error getting test history:', e)
    return []
  }
}

  // Sync function
  async function syncSmartMonitoring() {
    const config = await loadSmartConfig();
    try {
      const { stdout } = await execAsync('lsblk -d -o NAME,TYPE -n');
      const devices = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, type] = line.trim().split(/\s+/);
          return { name, type };
        })
        .filter(dev => dev.type === 'disk' && !dev.name.startsWith('loop'));

      for (const device of devices) {
        const devicePath = `/dev/${device.name}`;
        if (config.devices[devicePath]?.monitored) {
          await execAsync(`smartctl --smart=on --offlineauto=on --saveauto=on ${devicePath}`);
        }
      }
    } catch (e) {
      //console.error('Error syncing SMART monitoring:', e);
    }
  }

  syncSmartMonitoring();
};
