const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const SMART_CONFIG_PATH = path.join(__dirname, '../smart_monitoring.json');

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
    console.error('Failed to list devices:', error);
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
          console.warn(`Failed to parse SMART data for ${devicePath}:`, parseError);
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
        console.warn(`Basic info failed for ${devicePath}:`, basicError);
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
        console.log(`SMART monitoring ${enabled ? 'enabled' : 'disabled'} for ${device}`);

        res.json({
          success: true,
          message: `Monitoring ${enabled ? 'enabled' : 'disabled'}`,
          config: config.devices[device],
          log: SMART_CONFIG_PATH
        });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Update failed' });
      }
    });
  });

app.get('/api/storage/smart/monitoring', (req, res) => {
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

app.get('/api/storage/smart/details/:device', requireAuth, async (req, res) => {
  const { device } = req.params;
  
  // Walidacja parametru device
  if (!device || typeof device !== 'string' || !device.startsWith('/dev/')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device parameter',
      details: 'Device path must start with /dev/'
    });
  }

  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    const timeout = 10000; // 10 sekund timeout

    // 1. Pobierz podstawowe informacje i dane SMART
    const commands = [
      `sudo smartctl -A -i -H ${device} --json`,
      `smartctl -A -i -H ${device} --json` // Fallback bez sudo
    ];

    let data;
    let lastError;

    for (const cmd of commands) {
      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout });
        
        // Parsuj dane nawet jeśli jest kod błędu
        try {
          data = JSON.parse(stdout);
          
          // Jeśli SMART zwrócił błąd, ale są dane - użyj ich
          if (data.smartctl?.exit_status !== 0) {
            console.warn(`SMART returned non-zero status (${data.smartctl?.exit_status}) for ${device}`);
          }
          break;
        } catch (parseError) {
          lastError = parseError;
          continue;
        }
      } catch (execError) {
        lastError = execError;
        // Spróbuj parsować stdout nawet jeśli exec zwrócił błąd
        if (execError.stdout) {
          try {
            data = JSON.parse(execError.stdout);
            break;
          } catch (e) {
            continue;
          }
        }
      }
    }

    if (!data) {
      throw lastError || new Error('All SMART commands failed');
    }

    // 2. Pobierz historię testów (jeśli dostępna)
    let testHistory = [];
    try {
      testHistory = await getTestHistory(device);
    } catch (historyError) {
      console.warn(`Failed to get test history for ${device}:`, historyError);
    }

    // 3. Przygotuj odpowiedź
    const response = {
      success: true,
      data: {
        ...data,
        device_path: device,
        test_history: testHistory,
        // Dodatkowe zabezpieczone właściwości
        model_name: data.model_name || 'Unknown',
        serial_number: data.serial_number || 'Unknown',
        smart_status: data.smart_status || { passed: false, failed: false, message: 'Status not available' }
      },
      timestamp: new Date().toISOString()
    };

    // 4. Dodaj ostrzeżenia jeśli były problemy
    if (data.smartctl?.exit_status !== 0) {
      response.warnings = response.warnings || [];
      response.warnings.push(`SMART command returned status code ${data.smartctl.exit_status}`);
    }

    res.json(response);

  } catch (error) {
    console.error(`Error getting details for ${device}:`, error);
    
    // Spróbuj zwrócić przynajmniej podstawowe informacje
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      const { stdout } = await execAsync(`smartctl -i ${device}`);
      res.json({
        success: false,
        error: 'Limited SMART data available',
        basic_info: {
          device: device,
          model: stdout.match(/Device Model:\s*(.+)/)?.[1]?.trim() || 'Unknown',
          serial: stdout.match(/Serial Number:\s*(.+)/)?.[1]?.trim() || 'Unknown'
        },
        raw_output: stdout
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: 'Failed to get device details',
        details: error.message,
        device: device
      });
    }
  }
});

async function getTestHistory(device) {
  try {
    const { exec } = require('child_process')
    const util = require('util')
    const execAsync = util.promisify(exec)

    const { stdout } = await execAsync(`smartctl -l selftest ${device}`)
    // Przetwarzanie wyniku - to jest przykładowe, trzeba dostosować do rzeczywistego formatu
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
      console.error('Error syncing SMART monitoring:', e);
    }
  }

  syncSmartMonitoring();
};
