const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execAsyncs = promisify(exec);
const SMART_CONFIG_PATH = '/etc/nas-panel/smart_monitoring.json';
const FSTAB_PATH = '/etc/fstab';
const FSTAB_BACKUP_PATH = '/etc/fstab.bak';
const MDADM_CONF = '/etc/mdadm/mdadm.conf';

//HELPER FUNCTIONS
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

async function backupFstab() {
  try {
    await execAsync(`sudo cp ${FSTAB_PATH} ${FSTAB_BACKUP_PATH}`);
  } catch (err) {
    console.error('Failed to backup fstab:', err);
  }
}

async function readFstab() {
  try {
    const data = await fs.readFile(FSTAB_PATH, 'utf8');
    return data.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeFstab(entries) {
  await backupFstab();
  const content = [
    '# /etc/fstab: static file system information.',
    '#',
    '# <file system> <mount point>   <type>  <options>       <dump>  <pass>',
    ...entries
  ].join('\n');
  await fs.writeFile(FSTAB_PATH, content, 'utf8');
}

//END

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
    // First try with JSON format
    let lsblkData = await tryGetLsblkJson();
    
    // If JSON fails, fall back to legacy parsing
    if (!lsblkData) {
      lsblkData = await tryGetLsblkLegacy();
    }

    if (!lsblkData) {
      throw new Error('Could not get device information from lsblk');
    }

    // Get RAID devices
    const mdDevices = await getMdDevices();

    const devices = lsblkData.blockdevices.map(dev => {
      const isRaid = dev.type === 'raid' || mdDevices.includes(dev.name);
      return {
        path: `/dev/${dev.name}`,
        model: isRaid ? `RAID Device` : (dev.model || 'Unknown'),
        serial: dev.serial || (isRaid ? `RAID-${dev.name}` : 'Unknown'),
        type: dev.type,
        fstype: dev.fstype || '',
        mountpoint: dev.mountpoint || '',
        label: dev.label || '',
        isRaid: isRaid,
        partitions: dev.children ? dev.children.map(part => ({
          path: `/dev/${part.name}`,
          fstype: part.fstype || '',
          mountpoint: part.mountpoint || '',
          type: part.type,
          label: part.label || '',
          isRaid: isRaid
        })) : []
      };
    });

    res.json({
      success: true,
      data: devices
    });

  } catch (error) {
    console.error('Device listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list storage devices',
      details: error.message,
      systemError: error.toString()
    });
  }
});

// Helper functions
async function tryGetLsblkJson() {
  try {
    const { stdout } = await execAsync('lsblk -o NAME,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL,RAID -n -J');
    const data = JSON.parse(stdout);
    return data?.blockdevices ? data : null;
  } catch (error) {
    console.warn('JSON lsblk failed, trying legacy method:', error.message);
    return null;
  }
}

async function tryGetLsblkLegacy() {
  try {
    const { stdout } = await execAsync('lsblk -o NAME,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL,RAID -n');
    return parseLegacyLsblk(stdout);
  } catch (error) {
    console.error('Legacy lsblk failed:', error.message);
    return null;
  }
}

function parseLegacyLsblk(output) {
  // Implement parsing of non-JSON lsblk output
  // This is a simplified version - you'll need to expand it
  const lines = output.split('\n');
  const devices = [];
  
  // Parse each line and create device objects
  // Note: This needs to be customized based on your actual lsblk output format
  lines.forEach(line => {
    if (line.trim()) {
      const parts = line.split(/\s+/);
      devices.push({
        name: parts[0] || 'unknown',
        type: parts[1] || 'disk',
        model: parts[2] || 'Unknown',
        // Add other properties as needed
      });
    }
  });
  
  return { blockdevices: devices };
}

async function getMdDevices() {
  try {
    const { stdout } = await execAsync('mdadm --detail --scan');
    return stdout.split('\n')
      .filter(line => line.startsWith('ARRAY'))
      .map(line => {
        const match = line.match(/\/dev\/(md\d+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  } catch (error) {
    console.warn('MDADM check failed:', error.message);
    return [];
  }
}

// Mount device
app.post('/api/storage/mount', requireAuth, async (req, res) => {
  const { device, mountPoint, fsType, options, zfsPoolName } = req.body;
  
  if (!device || !device.startsWith('/dev/')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device path',
      details: 'Device must start with /dev/'
    });
  }

  try {
    const isZfs = fsType === 'zfs';
    let mountCmd;
    let actualMountPoint = mountPoint;

    const isRaidDevice = device.includes('/dev/md');
    
    if (isRaidDevice) {
      // Specjalna obsługa RAID
      await execAsync(`mkdir -p "${mountPoint}"`);
      const mountCmd = `mount ${fsType ? `-t ${fsType}` : ''} ${options ? `-o ${options}` : ''} ${device} ${mountPoint}`;
      await execAsync(mountCmd);
      
      return res.json({
        success: true,
        message: 'RAID device mounted successfully',
        isRaid: true
      });
    }

    if (isZfs) {
      // For ZFS we use 'zfs mount' instead of standard mount
      mountCmd = `sudo zpool import ${zfsPoolName || 'zpool'} && sudo zfs mount ${device}`;
      actualMountPoint = zfsPoolName || 'zpool';
    } else {
      // Standard mounting for other filesystems
      if (!mountPoint) {
        return res.status(400).json({
          success: false,
          error: 'Mount point is required',
          details: 'Please specify a mount point for non-ZFS filesystems'
        });
      }
      mountCmd = `sudo mkdir -p "${mountPoint}" && sudo mount -t ${fsType} -o ${options || 'defaults'} ${device} ${mountPoint}`;
    }

    const { stdout, stderr } = await execAsync(mountCmd);
    
    // Verify mounting
    let verifyCmd;
    if (isZfs) {
      verifyCmd = `sudo zfs list -H -o mounted ${device}`;
    } else {
      verifyCmd = `findmnt -n -o SOURCE --target ${mountPoint}`;
    }

    const { stdout: verifyStdout } = await execAsync(verifyCmd);
    
    if ((isZfs && verifyStdout.trim() !== 'yes') || (!isZfs && verifyStdout.trim() !== device)) {
      throw new Error('Mount verification failed');
    }

    // Add to fstab if not ZFS
    if (!isZfs) {
      const fstabEntries = await readFstab();
      const existingEntry = fstabEntries.find(entry => {
        const parts = entry.split(/\s+/);
        return parts[0] === device || parts[1] === mountPoint;
      });

      if (!existingEntry) {
        const newEntry = `${device} ${mountPoint} ${fsType} ${options || 'defaults'} 0 2`;
        fstabEntries.push(newEntry);
        await writeFstab(fstabEntries);
      }
    }

    res.json({
      success: true,
      message: 'Device mounted successfully',
      mountPoint: actualMountPoint,
      device: device,
      isZfs: isZfs,
      addedToFstab: !isZfs
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
    // Check if it's ZFS
    let isZfs = false;
    try {
      const { stdout } = await execAsync(`sudo zfs list -H -o name ${mountPoint}`);
      isZfs = stdout.trim() === mountPoint;
    } catch (e) {
      // Not ZFS
    }

    let unmountCmd;
    if (isZfs) {
      unmountCmd = `sudo zfs unmount ${mountPoint} && sudo zpool export ${mountPoint}`;
    } else {
      unmountCmd = `sudo umount "${mountPoint}"`;
      
      // Remove from fstab if not ZFS
      const fstabEntries = await readFstab();
      const initialLength = fstabEntries.length;
      const newEntries = fstabEntries.filter(entry => {
        const parts = entry.split(/\s+/);
        return parts[1] !== mountPoint;
      });
      
      if (newEntries.length < initialLength) {
        await writeFstab(newEntries);
      }
    }

    await execAsync(unmountCmd);
    
    res.json({
      success: true,
      message: 'Filesystem unmounted successfully',
      isZfs: isZfs,
      removedFromFstab: !isZfs
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
  const { device, fsType, force, label } = req.body;
  
    const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  try {
    // Dla ZFS - wyciągnij bazową nazwę dysku (usuń cyfry partycji)
    const targetDevice = fsType === 'zfs' 
      ? device.replace(/[0-9]+$/, '') 
      : device;

    console.log(`Formatting ${targetDevice} as ${fsType}`); // Debug

    // Obsługa RAID
    if (raidOptions && raidOptions.createRaid) {
      const raidResponse = await axios.post('/api/storage/create-raid', {
        devices: raidOptions.devices,
        raidLevel: raidOptions.level,
        name: raidOptions.name
      });

      if (!raidResponse.data.success) {
        throw new Error('RAID creation failed');
      }

      device = raidResponse.data.raidDevice;
    }

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

app.post('/api/storage/fstab', requireAuth, async (req, res) => {
  const { action, device, mountPoint, fsType, options } = req.body;
  
  try {
    const fstabEntries = await readFstab();
    
    if (action === 'add') {
      // Check if entry already exists
      const exists = fstabEntries.some(entry => {
        const parts = entry.split(/\s+/);
        return parts[0] === device || parts[1] === mountPoint;
      });
      
      if (exists) {
        return res.json({
          success: true,
          message: 'Entry already exists in fstab',
          updated: false
        });
      }
      
      const newEntry = `${device} ${mountPoint} ${fsType} ${options || 'defaults'} 0 2`;
      fstabEntries.push(newEntry);
      await writeFstab(fstabEntries);
      
      return res.json({
        success: true,
        message: 'Entry added to fstab',
        updated: true
      });
    }
    else if (action === 'remove') {
      const initialLength = fstabEntries.length;
      const newEntries = fstabEntries.filter(entry => {
        const parts = entry.split(/\s+/);
        return !(parts[0] === device || parts[1] === mountPoint);
      });
      
      if (newEntries.length === initialLength) {
        return res.json({
          success: true,
          message: 'Entry not found in fstab',
          updated: false
        });
      }
      
      await writeFstab(newEntries);
      return res.json({
        success: true,
        message: 'Entry removed from fstab',
        updated: true
      });
    }
    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action',
        details: 'Action must be either "add" or "remove"'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update fstab',
      details: error.message
    });
  }
});

app.post('/api/storage/edit-fstab', requireAuth, async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    // Sprawdzamy czy nano jest dostępne
    await execAsync('which nano');
    
    // Uruchamiamy edytor z timeoutem
    const { stdout, stderr } = await execAsync('sudo nano /etc/fstab', { 
      signal: controller.signal 
    });
    
    res.json({
      success: true,
      message: 'Fstab edited successfully'
    });
  } catch (error) {
    if (error.killed || error.signal) {
      return res.status(500).json({
        success: false,
        error: 'Operation timed out or was aborted',
        details: 'Editing fstab took too long or was interrupted'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to edit fstab',
      details: error.message
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/storage/fstab-content', requireAuth, async (req, res) => {
  try {
    const content = await fs.readFile(FSTAB_PATH, 'utf8');
    res.json({
      success: true,
      content: content
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to read fstab',
      details: error.message
    });
  }
});

app.get('/api/storage/fstab-check', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('cat /etc/fstab | grep -v "^#"');
    const entries = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [device, mountPoint, fsType, options, dump, pass] = line.split(/\s+/);
        return { device, mountPoint, fsType, options, dump, pass };
      });
    
    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/storage/save-fstab', requireAuth, async (req, res) => {
  try {
    // Create backup
    await execAsync(`sudo cp ${FSTAB_PATH} ${FSTAB_BACKUP_PATH}`);
    
    // Save new content
    await fs.writeFile(FSTAB_PATH, req.body.content, 'utf8');
    
    // Verify fstab
    try {
      await execAsync('sudo findmnt --verify');
    } catch (verifyError) {
      // Restore backup if verification fails
      await execAsync(`sudo cp ${FSTAB_BACKUP_PATH} ${FSTAB_PATH}`);
      throw new Error('Fstab verification failed. Changes reverted. Error: ' + verifyError.message);
    }
    
    res.json({
      success: true,
      message: 'Fstab saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to save fstab',
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

app.post('/api/storage/exec-command', requireAuth, async (req, res) => {
  const { command, timeout = 30000 } = req.body;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    res.json({
      success: true,
      stdout,
      stderr
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Command failed',
      details: error.message,
      stderr: error.stderr
    });
  }
});

app.get('/api/storage/disk-size', requireAuth, async (req, res) => {
  const { device } = req.query;
  
  try {
    const { stdout } = await execAsync(`lsblk -b -n -o SIZE ${device}`);
    const size = parseInt(stdout.trim());
    
    res.json({
      success: true,
      size: size
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get disk size',
      details: error.message
    });
  }
});

// Endpoint do tworzenia RAID
app.post('/api/storage/create-raid', requireAuth, async (req, res) => {
  const { devices, raidLevel, name } = req.body;

  try {
    // Walidacja
    if (!devices || devices.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 devices are required for RAID'
      });
    }

    const raidDevice = name ? `/dev/${name}` : `/dev/md${Math.floor(Math.random() * 100)}`;
    const raidCmd = `sudo mdadm --create ${raidDevice} --level=${raidLevel} --raid-devices=${devices.length} ${devices.join(' ')}`;
    
    await execAsync(raidCmd);
    await execAsync(`sudo mdadm --detail --scan | sudo tee -a ${MDADM_CONF}`);
    await execAsync(`sudo update-initramfs -u`);

    res.json({
      success: true,
      message: `RAID ${raidLevel} created successfully`,
      raidDevice: raidDevice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create RAID',
      details: error.stderr || error.message
    });
  }
});

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
