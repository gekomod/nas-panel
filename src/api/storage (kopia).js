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
app.get('/api/storage/smart', requireAuth, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // First check if smartctl is installed
    try {
      await execAsync('which smartctl');
    } catch (e) {
      return res.status(501).json({
        success: false,
        error: 'SMART monitoring not available',
        details: 'smartctl command not found. Please install smartmontools package.'
      });
    }

    // Get list of devices
    let devices = [];
    try {
      const { stdout: lsblkOut } = await execAsync('lsblk -d -o NAME,TYPE -n');
      devices = lsblkOut.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, type] = line.trim().split(/\s+/);
          return { name, type };
        })
        .filter(dev => dev.type === 'disk' && !dev.name.startsWith('loop'));
    } catch (e) {
      console.error('Error getting device list:', e);
      return res.status(500).json({
        success: false,
        error: 'Failed to get device list',
        details: e.message
      });
    }

    // Get SMART data for each device
    const results = [];
    for (const dev of devices) {
      try {
        // Get all SMART data in one call
        const { stdout } = await execAsync(`smartctl -A -i -H /dev/${dev.name} --json`);
        const data = JSON.parse(stdout);

        // Extract temperature - próbujemy różnych metod
        let temperature = null;

        // Metoda 1: Z atrybutów SMART
        if (data.temperature?.current) {
          temperature = data.temperature.current;
        }
        // Metoda 2: Z danych surowych
        else if (data.ata_smart_attributes?.table) {
          const tempAttr = data.ata_smart_attributes.table.find(
            attr => attr.name === 'Temperature_Celsius' || attr.id === 194
          );
          if (tempAttr?.raw?.value) {
            temperature = parseInt(tempAttr.raw.value);
          }
        }
        // Metoda 3: Z tekstowej odpowiedzi (fallback)
        else {
          const tempMatch = stdout.match(/Temperature(?:_?Celsius)?[\s\S]*?(\d+)\s*(?:\(|$)/i);
          if (tempMatch) {
            temperature = parseInt(tempMatch[1]);
          }
        }

        // Extract capacity
        let capacity = data.user_capacity?.bytes;
        if (!capacity && stdout.includes('User Capacity:')) {
          const capacityMatch = stdout.match(/User Capacity:\s*([\d\s]+)\s*bytes/);
          if (capacityMatch) {
            capacity = parseInt(capacityMatch[1].replace(/\D/g, ''));
          }
        }

        results.push({
          device: `${data.device?.name || dev.name}`,
          model: data.model_name || 'Unknown',
          serial: data.serial_number || 'Unknown',
          vendor: data.device.protocol || 'Unknown',
          wwn: `${data.wwn?.naa}-${data.wwn.oui}-${data.wwn.id}`,
          temperature: temperature || null,
          capacity: capacity || 0,
          status: data.smart_status?.passed ? 'healthy' :
                 data.smart_status?.failed ? 'error' : 'unknown',
          available: true,
          rawData: data  // Dodajemy surowe dane do debugowania
        });
      } catch (cmdError) {
        console.error(`Error getting SMART data for /dev/${dev.name}:`, cmdError);
        // Próbujemy uzyskać chociaż podstawowe informacje
        try {
          const { stdout: basicStdout } = await execAsync(`smartctl -i /dev/${dev.name}`);
          results.push({
            device: `${dev.name}`,
            model: basicStdout.match(/Device Model:\s*(.+)/)?.[1] || 'Unknown',
            serial: basicStdout.match(/Serial Number:\s*(.+)/)?.[1] || 'Unknown',
            temperature: null,
            capacity: 0,
            status: 'unknown',
            available: false,
            error: 'Limited SMART data'
          });
        } catch (e) {
          results.push({
            device: `/dev/${dev.name}`,
            model: 'Unknown',
            serial: 'Unknown',
            temperature: null,
            capacity: 0,
            status: 'unknown',
            available: false,
            error: cmdError.stderr || 'SMART command failed'
          });
        }
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('SMART API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SMART data',
      details: error.message
    });
  }
});

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
  try {
    const { device } = req.params
    const { exec } = require('child_process')
    const util = require('util')
    const execAsync = util.promisify(exec)

    // Pobierz pełne dane SMART
    const { stdout } = await execAsync(`smartctl -a -i ${device} --json`)
    const data = JSON.parse(stdout)

    res.json({
      success: true,
      data: {
        ...data,
        device_path: device,
        test_history: await getTestHistory(device)
      }
    })
  } catch (error) {
    console.error('Error getting device details:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get device details',
      details: error.message
    })
  }
})

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
