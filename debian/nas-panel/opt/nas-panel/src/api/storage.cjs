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

// HELPER FUNCTIONS
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

// Własna implementacja execAsync z lepszą obsługą błędów
const execAsyncCustom = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(command, { ...options, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (stdout || stderr) {
        resolve({ stdout, stderr });
      } else {
        reject(error || new Error('Command failed'));
      }
    });
  });
};

module.exports = function(app, requireAuth) {
  const { exec } = require('child_process');
  const util = require('util');
  const fs = require('fs').promises;

  const execAsync = execAsyncCustom;

  // FUNKCJE POMOCNICZE SMART
  function extractVendor(model) {
    if (!model) return 'Unknown';
    const vendors = [
      'Samsung', 'Seagate', 'Western Digital', 'WDC', 
      'Toshiba', 'Intel', 'Crucial', 'Kingston', 'SanDisk', 'Hitachi', 'Crucial'
    ];
    return vendors.find(v => model.includes(v)) || 'Unknown';
  }

  function calculateBadSectors(smartData) {
    if (!smartData?.ata_smart_attributes?.table) return 0;
    
    const attributeIds = {
      reallocated: 5,
      pending: 197,
      offline: 198,
      reported: 187,
      commandTimeout: 188
    };
    
    let total = 0;
    for (const [key, id] of Object.entries(attributeIds)) {
      const attr = smartData.ata_smart_attributes.table.find(a => a.id === id);
      if (attr?.raw?.value !== undefined) {
        total += parseInt(attr.raw.value);
      }
    }
    
    return total;
  }

  function hasPhysicalShockIssues(smartData) {
    if (!smartData?.ata_smart_attributes?.table) return false;
    
    const gsenseAttr = smartData.ata_smart_attributes.table.find(
      attr => attr.id === 191 || attr.name === 'G-Sense_Error_Rate'
    );
    
    if (gsenseAttr?.raw?.value) {
      const gsenseValue = parseInt(gsenseAttr.raw.value);
      return gsenseValue > 1000;
    }
    
    return false;
  }

  function hasCriticalIssues(smartData) {
    const badSectors = calculateBadSectors(smartData);
    if (badSectors > 0) return true;
    
    if (smartData.ata_smart_attributes?.table) {
      const criticalAttributes = smartData.ata_smart_attributes.table.filter(
        attr => attr.value && attr.thresh && attr.value <= attr.thresh
      );
      if (criticalAttributes.length > 0) return true;
    }
    
    return false;
  }

  function determineSmartStatus(data) {
    if (data.smart_status?.passed === false) return 'error';
    if (data.smart_status?.passed === true) {
      if (hasCriticalIssues(data) || hasPhysicalShockIssues(data)) {
        return 'warning';
      }
      return 'healthy';
    }
    
    if (data.nvme_smart_health_information_log?.critical_warning) {
      return data.nvme_smart_health_information_log.critical_warning > 0 ? 'warning' : 'healthy';
    }
    
    return 'unknown';
  }

  function extractTemperature(data) {
    if (data.nvme_smart_health_information_log?.temperature) {
      return data.nvme_smart_health_information_log.temperature - 273;
    }
    
    if (data.temperature?.current) return data.temperature.current;
    
    if (data.ata_smart_attributes?.table) {
      const tempAttr = data.ata_smart_attributes.table.find(
        attr => ['Temperature_Celsius', 'Temperature_Internal'].includes(attr.name) || attr.id === 194
      );
      if (tempAttr?.raw?.value) return parseInt(tempAttr.raw.value);
    }
    
    return null;
  }

  function updateDeviceResult(result, smartData) {
    result.available = true;
    result.rawData = smartData;
    
    result.model = smartData.model_name || result.model;
    result.vendor = extractVendor(result.model);
    
    if (smartData.user_capacity?.bytes) {
      result.capacity = smartData.user_capacity.bytes;
    } else if (smartData.logical_block_size && smartData.sectors) {
      result.capacity = smartData.logical_block_size * smartData.sectors;
    }
    
    result.temperature = extractTemperature(smartData);
    result.status = determineSmartStatus(smartData);
  }

  function extractFromText(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  function getShockLevel(gsenseValue) {
    if (gsenseValue < 100) return 'Normal';
    if (gsenseValue < 1000) return 'Minor';
    if (gsenseValue < 10000) return 'Moderate';
    if (gsenseValue < 100000) return 'Severe';
    return 'Critical';
  }

  // ENDPOINTY SMART

  app.get('/api/storage/smart', requireAuth, async (req, res) => {
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
      return res.status(500).json({
        success: false,
        error: 'Failed to list storage devices',
        details: error.message
      });
    }

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

      for (const { cmd, requireSudo } of smartCommands) {
        try {
          const fullCmd = `${cmd} -A -i -H ${devicePath} --json`;
          const { stdout, stderr } = await execAsync(fullCmd, { timeout: 8000 });
          
          try {
            const smartData = JSON.parse(stdout);
            
            if (smartData.device || smartData.model_name) {
              updateDeviceResult(deviceResult, smartData);
              break;
            }
          } catch (parseError) {
            // Ignore parse errors
          }
        } catch (error) {
          deviceResult.error = error.stderr || error.message;
        }
      }

      if (!deviceResult.available) {
        try {
          const { stdout } = await execAsync(`smartctl -i ${devicePath}`);
          deviceResult.model = extractFromText(stdout, /Device Model:\s*(.+)/) || device.model;
          deviceResult.serial = extractFromText(stdout, /Serial Number:\s*(.+)/) || device.serial;
        } catch (basicError) {
          // Ignore basic errors
        }
      }

      results.push(deviceResult);
    }

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  });

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

        res.json({
          success: true,
          message: `Monitoring ${enabled ? 'enabled' : 'disabled'}`,
          config: config.devices[device],
          log: SMART_CONFIG_PATH
        });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Update failed' });
      }
    });
  });

  app.get('/api/storage/smart/monitoring', requireAuth, (req, res) => {
    const { device } = req.query;
    
    fs.readFile(SMART_CONFIG_PATH, 'utf8')
      .then(data => {
        const config = JSON.parse(data);
        
        if (device) {
          const status = config.devices[device]?.monitored || false;
          return res.json({
            success: true,
            monitored: status,
            device: device
          });
        }
        
        res.json({
          success: true,
          devices: config.devices
        });
      })
      .catch(err => {
        if (err.code === 'ENOENT') {
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
  const CACHE_TTL = 30000;

  app.get('/api/storage/smart/details/:device', requireAuth, async (req, res) => {
    const { device } = req.params;
    
    if (!device || typeof device !== 'string' || !device.startsWith('/dev/')) {
      return res.status(400).json({
        success: false,
        error: 'Nieprawidłowy parametr urządzenia',
        details: 'Ścieżka urządzenia musi zaczynać się od /dev/'
      });
    }

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

      const cmd = `sudo smartctl -A -i -H ${device} --json`;
      
      let data;
      try {
        const { stdout } = await execAsyncs(cmd, { timeout });
        data = JSON.parse(stdout);
      } catch (error) {
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

      smartCache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });

      res.json(response);

    } catch (error) {
      console.error(`Błąd podczas pobierania danych SMART dla ${device}:`, error);
      
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

  // ENDPOINTY NAPRAWY SMART

  app.post('/api/storage/smart/repair-bad-sectors', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    if (!device || !device.startsWith('/dev/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device path'
      });
    }

    try {
      console.log(`Starting SMART repair for ${device}`);
      
      await execAsync(`sudo smartctl --offlineauto=on ${device}`).catch(() => {
        console.log(`Failed to enable offline auto for ${device}`);
      });
      
      console.log(`Starting SMART test for ${device}`);
      const { stdout: testStart, stderr: testStderr } = await execAsync(
        `sudo smartctl -t short ${device} 2>&1`,
        { timeout: 30000 }
      );
      
      console.log(`Test start output for ${device}:`, testStart);
      
      console.log(`Waiting 15 seconds for test to start on ${device}...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      console.log(`Checking test status for ${device}...`);
      const { stdout: testResults } = await execAsync(
        `sudo smartctl -l selftest ${device} 2>&1`,
        { timeout: 10000 }
      );
      
      console.log(`Test results for ${device}:`, testResults.substring(0, 500));
      
      const { stdout: attributes } = await execAsync(
        `sudo smartctl -A ${device} 2>&1`,
        { timeout: 10000 }
      );
      
      const extractSectors = () => {
        const patterns = {
          reallocated: /Reallocated_Sector_Ct.*?\s+(\d+)/,
          pending: /Current_Pending_Sector.*?\s+(\d+)/,
          offline: /Offline_Uncorrectable.*?\s+(\d+)/,
          reported: /Reported_Uncorrectable_Errors.*?\s+(\d+)/,
          timeout: /Command_Timeout.*?\s+(\d+)/,
          gsense: /G-Sense_Error_Rate.*?\s+(\d+)/
        };
        
        const result = {};
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = attributes.match(pattern);
          result[key] = match ? parseInt(match[1]) : 0;
        }
        
        return result;
      };
      
      const sectors = extractSectors();
      
      const isTestActive = testResults.includes('Self-test execution status:') && 
                          testResults.includes('Self-test routine in progress');
      const hasTestHistory = !testResults.includes('No self-tests have been logged');
      
      const response = {
        success: true,
        message: hasTestHistory ? 'SMART test started successfully' : 'Test command sent but may not have started',
        testStarted: hasTestHistory,
        testActive: isTestActive,
        testOutput: testStart,
        testStatus: testResults,
        sectors: sectors,
        badSectors: sectors.reallocated,
        pendingSectors: sectors.pending,
        offlineSectors: sectors.offline,
        reportedSectors: sectors.reported,
        timeoutSectors: sectors.timeout,
        gSenseErrorRate: sectors.gsense,
        totalBadSectors: sectors.reallocated + sectors.pending + sectors.offline + sectors.reported + sectors.timeout,
        device: device,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Response for ${device}:`, JSON.stringify(response, null, 2));
      
      res.json(response);
      
    } catch (error) {
      console.error(`SMART repair error for ${device}:`, error);
      
      try {
        const { stdout: basicInfo } = await execAsync(`sudo smartctl -i ${device} 2>&1`);
        const { stdout: basicAttrs } = await execAsync(`sudo smartctl -A ${device} 2>&1`);
        
        res.status(500).json({
          success: false,
          error: 'Failed to initiate SMART test',
          details: error.message,
          basicInfo: basicInfo.substring(0, 200),
          basicAttrs: basicAttrs.substring(0, 200),
          device: device
        });
      } catch (fallbackError) {
        res.status(500).json({
          success: false,
          error: 'Failed to initiate SMART test',
          details: error.message,
          device: device
        });
      }
    }
  });

  app.post('/api/storage/smart/ata-secure-erase', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    if (!device) {
      return res.status(400).json({
        success: false,
        error: 'Device is required'
      });
    }

    try {
      const { stdout: capabilities } = await execAsync(`sudo hdparm -I ${device}`);
      
      if (!capabilities.includes('supported: enhanced erase') && 
          !capabilities.includes('supported: security erase')) {
        return res.status(400).json({
          success: false,
          error: 'Device does not support ATA Secure Erase',
          details: 'This feature requires hardware support'
        });
      }

      await execAsync(`sudo hdparm --user-master u --security-set-pass Eins ${device}`);
      
      const { stdout, stderr } = await execAsync(
        `sudo hdparm --user-master u --security-erase Eins ${device}`,
        { timeout: 3600000 }
      );
      
      await execAsync(`sudo hdparm --security-disable Eins ${device}`);
      
      res.json({
        success: true,
        message: 'ATA Secure Erase completed successfully',
        device: device,
        details: 'All data has been securely erased and bad sectors may have been remapped'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Secure erase failed',
        details: error.stderr || error.message,
        device: device,
        warning: 'This operation can take a long time for large drives'
      });
    }
  });

  app.post('/api/storage/smart/run-extended-test', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    try {
      await execAsync(`sudo smartctl -t long ${device}`);
      
      res.json({
        success: true,
        message: 'Extended SMART test started',
        device: device,
        estimatedTime: '2+ hours depending on drive size',
        note: 'Check test results later using the device details page'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to start extended test',
        details: error.message,
        device: device
      });
    }
  });

  app.post('/api/storage/smart/enable-automatic-offline', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    try {
      await execAsync(`sudo smartctl --offlineauto=on ${device}`);
      await execAsync(`sudo smartctl --saveauto=on ${device}`);
      
      res.json({
        success: true,
        message: 'Automatic offline data collection enabled',
        device: device,
        features: ['Automatic offline scans', 'Attribute autosave']
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to enable automatic features',
        details: error.message,
        device: device
      });
    }
  });

  app.get('/api/storage/smart/repair-status/:device', requireAuth, async (req, res) => {
    const { device } = req.params;
    
    try {
      const { stdout: selftest } = await execAsync(`sudo smartctl -l selftest ${device}`);
      const { stdout: attributes } = await execAsync(`sudo smartctl -A ${device}`);
      
      const attributePatterns = {
        badSectors: /Reallocated_Sector_Ct.*?\s+(\d+)/,
        pendingSectors: /Current_Pending_Sector.*?\s+(\d+)/,
        offlineUncorrectable: /Offline_Uncorrectable.*?\s+(\d+)/,
        loadCycleCount: /Load_Cycle_Count.*?\s+(\d+)/,
        endToEndError: /End-to-End_Error.*?\s+(\d+)/,
        reportedUncorrectable: /Reported_Uncorrectable_Errors.*?\s+(\d+)/,
        commandTimeout: /Command_Timeout.*?\s+(\d+)/,
        temperature: /Temperature_Celsius.*?\s+(\d+)/,
        gSenseErrorRate: /G-Sense_Error_Rate.*?\s+(\d+)/
      };
      
      const results = {};
      for (const [key, pattern] of Object.entries(attributePatterns)) {
        const match = attributes.match(pattern);
        results[key] = match ? parseInt(match[1]) : 0;
      }
      
      const testsInProgress = selftest.includes('%') && selftest.includes('in progress');
      
      res.json({
        success: true,
        device: device,
        testsInProgress: testsInProgress,
        attributes: results,
        rawTestLog: selftest,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get repair status',
        details: error.message,
        device: device
      });
    }
  });

  app.post('/api/storage/smart/fix-load-cycle-count', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    try {
      const { stdout: identify } = await execAsync(`sudo hdparm -I ${device}`);
      
      if (identify.includes('WDC') || identify.includes('Western Digital')) {
        await execAsync(`sudo hdparm -B 254 ${device}`);
        await execAsync(`sudo hdparm -S 0 ${device}`);
      }
      
      await execAsync(`sudo hdparm -J 255 ${device}`).catch(() => {});
      await execAsync(`sudo hdparm -S 0 ${device}`).catch(() => {});
      
      res.json({
        success: true,
        message: 'Load cycle count fixes applied',
        device: device,
        appliedFixes: [
          'Disabled APM (Advanced Power Management)',
          'Disabled automatic spindown',
          'Set maximum performance mode'
        ],
        note: 'These changes may be reset after reboot. Consider adding to startup scripts.'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to apply load cycle count fixes',
        details: error.message,
        device: device
      });
    }
  });

  app.post('/api/storage/smart/refresh-attributes', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    try {
      await execAsync(`sudo smartctl --smart=on ${device}`);
      await execAsync(`sudo smartctl -t offline ${device}`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { stdout: attributes } = await execAsync(`sudo smartctl -A ${device}`);
      
      res.json({
        success: true,
        message: 'SMART attributes refreshed',
        device: device,
        attributes: attributes
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to refresh attributes',
        details: error.message,
        device: device
      });
    }
  });

  app.post('/api/storage/smart/force-reallocation', requireAuth, async (req, res) => {
    const { device, sectorCount = 1 } = req.body;
    
    if (!device) {
      return res.status(400).json({
        success: false,
        error: 'Device is required'
      });
    }

    try {
      await execAsync(`sudo smartctl -t long ${device}`);
      
      res.json({
        success: true,
        message: 'Extended test started - bad sectors may be reallocated automatically',
        device: device,
        warning: 'For manual sector reallocation, use professional tools like ddrescue or hdparm',
        note: 'This operation may take several hours',
        recommendation: 'Consider using: sudo ddrescue --force --no-split /dev/zero ' + device
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to force reallocation',
        details: error.message,
        device: device
      });
    }
  });

  app.get('/api/storage/smart/sector-details/:device', requireAuth, async (req, res) => {
    const { device } = req.params;
    
    try {
      const { stdout } = await execAsync(`sudo smartctl -A ${device}`);
      
      const sectorDetails = {
        reallocated: 0,
        pending: 0,
        offline: 0,
        reported: 0,
        timeout: 0,
        gsense: 0,
        total: 0
      };
      
      const attributeMap = [
        { id: 5, key: 'reallocated', name: 'Reallocated_Sector_Ct', pattern: /Reallocated_Sector_Ct.*?\s+(\d+)/ },
        { id: 197, key: 'pending', name: 'Current_Pending_Sector', pattern: /Current_Pending_Sector.*?\s+(\d+)/ },
        { id: 198, key: 'offline', name: 'Offline_Uncorrectable', pattern: /Offline_Uncorrectable.*?\s+(\d+)/ },
        { id: 187, key: 'reported', name: 'Reported_Uncorrectable_Errors', pattern: /Reported_Uncorrectable_Errors.*?\s+(\d+)/ },
        { id: 188, key: 'timeout', name: 'Command_Timeout', pattern: /Command_Timeout.*?\s+(\d+)/ },
        { id: 191, key: 'gsense', name: 'G-Sense_Error_Rate', pattern: /G-Sense_Error_Rate.*?\s+(\d+)/ }
      ];
      
      attributeMap.forEach(item => {
        const match = stdout.match(item.pattern);
        if (match) {
          sectorDetails[item.key] = parseInt(match[1]);
        }
      });
      
      sectorDetails.total = sectorDetails.reallocated + sectorDetails.pending + 
                           sectorDetails.offline + sectorDetails.reported + 
                           sectorDetails.timeout;
      
      res.json({
        success: true,
        device: device,
        sectorDetails: sectorDetails,
        shockLevel: getShockLevel(sectorDetails.gsense),
        rawAttributes: stdout.substring(0, 1000),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get sector details',
        details: error.message,
        device: device
      });
    }
  });

  app.post('/api/storage/smart/fix-physical-issues', requireAuth, async (req, res) => {
    const { device } = req.body;
    
    try {
      const { stdout: attributes } = await execAsync(`sudo smartctl -A ${device} 2>&1`);
      
      const gsenseMatch = attributes.match(/G-Sense_Error_Rate.*?\s+(\d+)/);
      const gsenseValue = gsenseMatch ? parseInt(gsenseMatch[1]) : 0;
      
      const recommendations = [];
      
      if (gsenseValue > 1000) {
        recommendations.push('⚠️ POWAŻNE WSTRZĄSY WYKRYTE');
        recommendations.push('1. Sprawdź mocowanie dysku w obudowie');
        recommendations.push('2. Upewnij się, że obudowa stoi na stabilnej powierzchni');
        recommendations.push('3. Unikaj przenoszenia działającego serwera');
        recommendations.push('4. Rozważ amortyzatory antywibracyjne');
      }
      
      if (gsenseValue > 10000) {
        recommendations.push('🚨 KRYTYCZNE WSTRZĄSY - wymiana dysku zalecana');
      }
      
      await execAsync(`sudo smartctl -t long ${device}`).catch(() => {});
      
      res.json({
        success: true,
        message: 'Diagnoza fizycznych problemów dysku',
        device: device,
        gSenseErrorRate: gsenseValue,
        shockLevel: getShockLevel(gsenseValue),
        recommendations: recommendations,
        action: 'Uruchomiono długi test SMART do sprawdzenia uszkodzeń',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to diagnose physical issues',
        details: error.message,
        device: device
      });
    }
  });

  app.get('/api/storage/smart/test-status/:device', requireAuth, async (req, res) => {
    const { device } = req.params;
    
    try {
      const { stdout: testStatus } = await execAsync(
        `sudo smartctl -l selftest ${device} 2>&1`,
        { timeout: 10000 }
      );
      
      const { stdout: attributes } = await execAsync(
        `sudo smartctl -A ${device} 2>&1`,
        { timeout: 10000 }
      );
      
      const isTestActive = testStatus.includes('Self-test execution status:') && 
                          testStatus.includes('Self-test routine in progress');
      
      const hasTestHistory = !testStatus.includes('No self-tests have been logged');
      
      let progress = 0;
      if (isTestActive) {
        const progressMatch = testStatus.match(/remaining:\s+(\d+)%/);
        progress = progressMatch ? 100 - parseInt(progressMatch[1]) : 0;
      }
      
      const extractSectors = () => {
        const patterns = {
          reallocated: /Reallocated_Sector_Ct.*?\s+(\d+)/,
          pending: /Current_Pending_Sector.*?\s+(\d+)/,
          offline: /Offline_Uncorrectable.*?\s+(\d+)/,
          reported: /Reported_Uncorrectable_Errors.*?\s+(\d+)/,
          timeout: /Command_Timeout.*?\s+(\d+)/,
          gsense: /G-Sense_Error_Rate.*?\s+(\d+)/
        };
        
        const result = {};
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = attributes.match(pattern);
          result[key] = match ? parseInt(match[1]) : 0;
        }
        
        return result;
      };
      
      const sectors = extractSectors();
      
      res.json({
        success: true,
        device: device,
        testActive: isTestActive,
        testHistoryAvailable: hasTestHistory,
        progress: progress,
        testStatus: testStatus,
        sectors: sectors,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get test status',
        details: error.message,
        device: device
      });
    }
  });

  app.get('/api/storage/smart/diagnostics/:device', requireAuth, async (req, res) => {
    const { device } = req.params;
    
    try {
      const diagnostics = {};
      
      const { stdout: smartInfo } = await execAsync(`sudo smartctl -i ${device} 2>&1`);
      diagnostics.smartInfo = smartInfo;
      
      diagnostics.smartEnabled = smartInfo.includes('SMART support is: Enabled');
      
      const { stdout: attributes } = await execAsync(`sudo smartctl -A ${device} 2>&1`);
      diagnostics.attributes = attributes;
      
      const { stdout: testHistory } = await execAsync(`sudo smartctl -l selftest ${device} 2>&1`);
      diagnostics.testHistory = testHistory;
      
      const { stdout: errors } = await execAsync(`sudo smartctl -l error ${device} 2>&1`);
      diagnostics.errors = errors;
      
      const { stdout: lsblk } = await execAsync(`lsblk -o NAME,TYPE,MODEL,SERIAL -n ${device}`);
      diagnostics.lsblk = lsblk;
      
      const { stdout: hdparm } = await execAsync(`sudo hdparm -C ${device} 2>&1`);
      diagnostics.hdparm = hdparm;
      
      res.json({
        success: true,
        device: device,
        diagnostics: diagnostics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Diagnostics failed',
        details: error.message,
        device: device
      });
    }
  });

  // POZOSTAŁE ENDPOINTY STORAGE - MOUNT/UNMOUNT/FORMAT/FSTAB itp.

  app.get('/api/storage/devices', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('lsblk -o NAME,SIZE,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL -n -b -J');
      const lsblkData = JSON.parse(stdout);
      
      const parseSize = (sizeStr) => {
        if (!sizeStr) return 0;
        return parseInt(sizeStr) || 0;
      };

      const filterDevice = (device) => {
        const ignorePatterns = ['overlay', 'docker', 'containerd'];
        const deviceName = device.name?.toLowerCase() || '';
        const deviceModel = device.model?.toLowerCase() || '';
        const deviceMount = device.mountpoint?.toLowerCase() || '';
        const deviceFsType = device.fstype?.toLowerCase() || '';

        const isOverlay = ignorePatterns.some(pattern => {
          return deviceName.includes(pattern) ||
                 deviceModel.includes(pattern) ||
                 deviceMount.includes(pattern) ||
                 deviceFsType.includes(pattern);
        });

        const isLoop = deviceName.startsWith('loop');
        return !isOverlay && !isLoop;
      };

      const filterPartition = (partition) => {
        const ignorePatterns = ['overlay', 'docker', 'containerd'];
        const partName = partition.name?.toLowerCase() || '';
        const partMount = partition.mountpoint?.toLowerCase() || '';
        const partFsType = partition.fstype?.toLowerCase() || '';

        const isOverlay = ignorePatterns.some(pattern => 
          partName.includes(pattern) ||
          partMount.includes(pattern) ||
          partFsType.includes(pattern)
        );
        const isLoop = partName.startsWith('loop');
        return !isOverlay && !isLoop;
      };

      const devices = lsblkData.blockdevices
        .filter(filterDevice)
        .map(dev => ({
          path: `/dev/${dev.name}`,
          model: dev.model || 'Unknown',
          serial: dev.serial || 'Unknown',
          type: dev.type,
          size: parseSize(dev.size),
          fstype: dev.fstype || '',
          mountpoint: dev.mountpoint || '',
          label: dev.label || '',
          partitions: dev.children ? dev.children
            .filter(filterPartition)
            .map(part => ({
              path: `/dev/${part.name}`,
              fstype: part.fstype || '',
              mountpoint: part.mountpoint || '',
              size: parseSize(part.size),
              type: part.type,
              label: part.label || ''
            })) : []
        }));

      if (devices.some(dev => dev.size < 1024 * 1024 * 1024)) {
        const { stdout: humanStdout } = await execAsync('lsblk -o NAME,SIZE,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL -n -J');
        const humanData = JSON.parse(humanStdout);
        
        const humanToBytes = (sizeStr) => {
          if (!sizeStr) return 0;
          const units = { 'B': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3, 'T': 1024 ** 4, 'P': 1024 ** 5 };
          const match = sizeStr.match(/^([\d.]+)([BKMGTP])?$/i);
          if (!match) return 0;
          const num = parseFloat(match[1]);
          const unit = match[2]?.toUpperCase() || 'B';
          return Math.round(num * (units[unit] || 1));
        };
        
        const updateDeviceSizes = (blockdevices) => {
          return blockdevices
            .filter(filterDevice)
            .map(dev => ({
              path: `/dev/${dev.name}`,
              model: dev.model || 'Unknown',
              serial: dev.serial || 'Unknown',
              type: dev.type,
              size: humanToBytes(dev.size),
              fstype: dev.fstype || '',
              mountpoint: dev.mountpoint || '',
              label: dev.label || '',
              partitions: dev.children ? dev.children
                .filter(filterPartition)
                .map(part => ({
                  path: `/dev/${part.name}`,
                  fstype: part.fstype || '',
                  mountpoint: part.mountpoint || '',
                  size: humanToBytes(part.size),
                  type: part.type,
                  label: part.label || ''
                })) : []
            }));
        };
        
        return res.json({
          success: true,
          data: updateDeviceSizes(humanData.blockdevices)
        });
      }

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

  app.get('/api/storage/debug-devices', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('lsblk -b -o NAME,SIZE,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL -n -J 2>/dev/null || lsblk --bytes --output NAME,SIZE,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL --json 2>/dev/null');
      const lsblkData = JSON.parse(stdout);
      
      const enrichWithSizeBytes = (device) => {
        const sizeStr = device.size;
        let sizeBytes = 0;
        
        if (sizeStr && !isNaN(parseInt(sizeStr))) {
          sizeBytes = parseInt(sizeStr);
        } else if (sizeStr) {
          const units = { 'B': 1, 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4 };
          const match = String(sizeStr).match(/^([\d.]+)([BKMGTP])?$/i);
          if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2]?.toUpperCase() || 'B';
            sizeBytes = Math.round(num * (units[unit] || 1));
          }
        }
        
        return {
          ...device,
          size_raw: sizeStr,
          size_bytes: sizeBytes,
          children: device.children ? device.children.map(enrichWithSizeBytes) : undefined
        };
      };
      
      const enrichedDevices = lsblkData.blockdevices.map(enrichWithSizeBytes);
      
      res.json({
        success: true,
        data: enrichedDevices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug devices API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list debug devices'
      });
    }
  });

  async function tryGetLsblkJson() {
    try {
      const { stdout } = await execAsync('lsblk -b -o NAME,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL,SIZE -n -J');
      const data = JSON.parse(stdout);
      return data?.blockdevices ? data : null;
    } catch (error) {
      console.warn('JSON lsblk failed, trying legacy method:', error.message);
      return null;
    }
  }

  async function tryGetLsblkLegacy() {
    try {
      const { stdout } = await execAsync('lsblk -o NAME,TYPE,MODEL,SERIAL,PATH,FSTYPE,MOUNTPOINT,LABEL -n');
      const lines = output.split('\n');
      const devices = [];
      
      lines.forEach(line => {
        if (line.trim()) {
          const parts = line.split(/\s+/);
          devices.push({
            name: parts[0] || 'unknown',
            type: parts[1] || 'disk',
            model: parts[2] || 'Unknown',
          });
        }
      });
      
      return { blockdevices: devices };
    } catch (error) {
      console.error('Legacy lsblk failed:', error.message);
      return null;
    }
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

app.post('/api/storage/scan-lvm', requireAuth, async (req, res) => {
  try {
    await execAsync('sudo vgscan');
    await execAsync('sudo vgchange -ay');
    
    res.json({
      success: true,
      message: 'LVM volumes scanned and activated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to scan LVM volumes',
      details: error.message
    });
  }
});

// Add RAID activation before mount
app.post('/api/storage/scan-raid', requireAuth, async (req, res) => {
  try {
    await execAsync('sudo mdadm --assemble --scan');
    
    res.json({
      success: true,
      message: 'RAID arrays assembled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to assemble RAID arrays',
      details: error.message
    });
  }
});

// RAID endpoints
app.get('/api/storage/raid', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('cat /proc/mdstat');
    // Parse mdstat output
    const raidDevices = [];
    // ... parsing logic
    res.json({ success: true, data: raidDevices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/storage/raid/start', requireAuth, async (req, res) => {
  const { device } = req.body;
  try {
    await execAsync(`mdadm --assemble ${device}`);
    res.json({ success: true, message: 'RAID array started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LVM endpoints
app.get('/api/storage/lvm', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('lvs --units b --noheadings -o lv_name,vg_name,lv_size');
    // Parse LVM output
    const lvmVolumes = [];
    // ... parsing logic
    res.json({ success: true, data: lvmVolumes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    let detectedFsType = fsType;
    let mountCmd;
    let actualMountPoint = mountPoint;

    // Detect filesystem type
    if (!detectedFsType || detectedFsType === 'auto') {
      try {
        const { stdout } = await execAsync(`blkid -o value -s TYPE ${device} 2>/dev/null || true`);
        detectedFsType = stdout.trim().toLowerCase();
        if (!detectedFsType) {
          // Try with lsblk
          const { stdout: lsblkOut } = await execAsync(`lsblk -o FSTYPE -n ${device} 2>/dev/null || true`);
          detectedFsType = lsblkOut.trim().toLowerCase();
        }
      } catch (detectError) {
        detectedFsType = 'auto';
      }
    }

    const isRaidDevice = device.includes('/dev/md');
    const isZfs = detectedFsType === 'zfs';
    const isLvm = device.includes('/dev/mapper/') || device.includes('/dev/dm-');
    
    // Create mount point directory
    if (!isZfs) {
      if (!mountPoint) {
        return res.status(400).json({
          success: false,
          error: 'Mount point is required',
          details: 'Please specify a mount point'
        });
      }
      await execAsync(`mkdir -p "${mountPoint}"`);
    }

    // Construct mount command based on device type
    if (isRaidDevice) {
      mountCmd = `sudo mount ${detectedFsType !== 'auto' ? `-t ${detectedFsType}` : ''} ${options ? `-o ${options}` : ''} ${device} ${mountPoint}`;
    } else if (isZfs) {
      mountCmd = `sudo zpool import ${zfsPoolName || 'zpool'} && sudo zfs mount ${zfsPoolName || 'zpool'}`;
      actualMountPoint = `/mnt/${zfsPoolName || 'zpool'}`;
    } else if (isLvm) {
      // For LVM, try auto detection first
      mountCmd = `sudo mount ${device} ${mountPoint}`;
      if (options && options !== 'defaults,nofail') {
        mountCmd = `sudo mount -o ${options} ${device} ${mountPoint}`;
      }
    } else {
      // Regular device/partition
      mountCmd = `sudo mount -t ${detectedFsType !== 'auto' ? detectedFsType : 'auto'} ${options ? `-o ${options}` : ''} ${device} ${mountPoint}`;
    }

    console.log(`Mount command: ${mountCmd}`);
    const { stdout, stderr } = await execAsync(mountCmd);
    
    // Verify mount
    let verifyCmd;
    if (isZfs) {
      verifyCmd = `sudo zfs list -H -o mounted ${zfsPoolName || 'zpool'}`;
    } else {
      verifyCmd = `findmnt -n -o SOURCE --target ${mountPoint}`;
    }

    try {
      const { stdout: verifyStdout } = await execAsync(verifyCmd);
      const isMounted = isZfs 
        ? verifyStdout.trim() === 'yes'
        : verifyStdout.trim() === device;

      if (!isMounted) {
        throw new Error('Mount verification failed');
      }
    } catch (verifyError) {
      console.log('Mount verification failed, trying alternative check...');
      // Alternative check
      const { stdout: mountCheck } = await execAsync(`mount | grep ${mountPoint}`);
      if (!mountCheck.includes(device)) {
        throw new Error('Mount verification failed');
      }
    }

    // Add to fstab if not ZFS
    if (!isZfs && !isRaidDevice) {
      try {
        const fstabEntries = await readFstab();
        const existingEntry = fstabEntries.find(entry => {
          const parts = entry.split(/\s+/);
          return parts[0] === device || parts[1] === mountPoint;
        });

        if (!existingEntry) {
          const fsTypeForFstab = detectedFsType !== 'auto' ? detectedFsType : 'auto';
          const newEntry = `${device} ${mountPoint} ${fsTypeForFstab} ${options || 'defaults,nofail'} 0 2`;
          fstabEntries.push(newEntry);
          await writeFstab(fstabEntries);
        }
      } catch (fstabError) {
        console.warn('Failed to update fstab:', fstabError);
      }
    }

    res.json({
      success: true,
      message: 'Device mounted successfully',
      mountPoint: actualMountPoint,
      device: device,
      detectedFsType: detectedFsType,
      isZfs: isZfs,
      isRaid: isRaidDevice,
      isLvm: isLvm,
      addedToFstab: !isZfs && !isRaidDevice
    });
  } catch (error) {
    console.error('Mount error:', error);
    let errorDetails = error.stderr || error.message;

    // User-friendly error messages
    if (errorDetails.includes('already mounted')) {
      errorDetails = 'Device is already mounted';
    } else if (errorDetails.includes('no such pool')) {
      errorDetails = 'ZFS pool does not exist';
    } else if (errorDetails.includes('wrong fs type')) {
      errorDetails = 'Wrong filesystem type. Try formatting the device first.';
    } else if (errorDetails.includes('no such device')) {
      errorDetails = 'Device does not exist';
    } else if (errorDetails.includes('permission denied')) {
      errorDetails = 'Permission denied. Try using sudo or check permissions.';
    } else if (errorDetails.includes('unknown filesystem')) {
      errorDetails = 'Unknown filesystem type. The device may need to be formatted.';
    }

    res.status(500).json({
      success: false,
      error: 'Failed to mount device',
      details: errorDetails,
      command: error.cmd
    });
  }
});

  app.post('/api/storage/unmount', requireAuth, async (req, res) => {
    const { mountPoint } = req.body;
    
    try {
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

  app.post('/api/storage/format', requireAuth, async (req, res) => {
    const { device, fsType, force, label } = req.body;
    
    try {
      const targetDevice = fsType === 'zfs' 
        ? device.replace(/[0-9]+$/, '') 
        : device;

      console.log(`Formatting ${targetDevice} as ${fsType}`);

      const { stdout: deviceSize } = await execAsyncs(`lsblk -b -n -o SIZE ${targetDevice}`);
      if (!deviceSize.trim()) throw new Error(`Device ${targetDevice} not found`);

      await execAsyncs(`wipefs -a ${targetDevice}`);
      await execAsyncs(`sgdisk --zap-all ${targetDevice}`);
      await execAsyncs(`dd if=/dev/zero of=${targetDevice} bs=1M count=100 status=none`);

      if (fsType === 'zfs') {
        const poolName = label || 'zpool';
        
        try {
          await execAsyncs(`zpool destroy ${poolName}`);
        } catch (e) {
          console.log(`No existing pool ${poolName} to destroy`);
        }

        await execAsyncs(`zpool create -f -o ashift=12 ${poolName} ${targetDevice}`);
        
        return res.json({
          success: true,
          message: `ZFS pool ${poolName} created on ${targetDevice}`,
          deviceUsed: targetDevice
        });
      } else {
        let formatCmd;
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
        
        await execAsyncs(formatCmd, { timeout: 60000 });
        
        res.json({
          success: true,
          message: `Device ${device} formatted as ${fsType}`,
          device: device
        });
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
      await fs.access(device);
      
      const { stdout: fsType } = await execAsync(`lsblk -no FSTYPE ${device}`);
      
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
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      await execAsync('which nano');
      
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
      await execAsync(`sudo cp ${FSTAB_PATH} ${FSTAB_BACKUP_PATH}`);
      
      await fs.writeFile(FSTAB_PATH, req.body.content, 'utf8');
      
      try {
        await execAsync('sudo findmnt --verify');
      } catch (verifyError) {
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

  app.post('/api/storage/create-raid', requireAuth, async (req, res) => {
    const { devices, raidLevel, name } = req.body;

    try {
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
  
  app.get('/api/storage/lvm-volumes', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('sudo lvs --units b --separator ";" --noheadings -o lv_name,vg_name,lv_size,lv_path 2>/dev/null || true');
    
    const volumes = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [name, vg, size, path] = line.split(';').map(s => s.trim());
        return {
          name,
          vg,
          path: path || `/dev/mapper/${vg}-${name}`,
          size: parseInt(size) || 0,
          fstype: 'lvm'
        };
      })
      .filter(vol => vol.path && vol.size > 0);
    
    res.json({
      success: true,
      volumes
    });
  } catch (error) {
    console.error('Error fetching LVM volumes:', error);
    res.json({
      success: true,
      volumes: []
    });
  }
});



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
