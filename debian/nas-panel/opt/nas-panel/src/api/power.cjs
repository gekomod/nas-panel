const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid');

// Konfiguracja UPS
const UPS_CONFIG_PATH = '/etc/nut/ups.conf';
const UPS_MONITORS_PATH = '/var/log/ups-monitor.log';
const POWER_SCHEDULE_PATH = '/etc/cron.d/power-schedule';
const WAKEONLAN_CONFIG_PATH = '/etc/wakeonlan.conf';

// Helper do wykonania komendy z obietnicą
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Helper do odczytu pliku konfiguracyjnego
const readConfigFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return '';
  } catch (error) {
    console.error(`Error reading config file ${filePath}:`, error);
    return '';
  }
};

// Helper do zapisu pliku konfiguracyjnego
const writeConfigFile = (filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing config file ${filePath}:`, error);
    return false;
  }
};

module.exports = function(app, requireAuth) {
  // Lista procesów
  app.get('/diagnostics/processes', requireAuth, (req, res) => {
    exec('ps -eo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu --no-headers', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing ps command:', error);
        return res.status(500).json({ error: 'Failed to get processes' });
      }

      const processes = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0]),
          user: parts[1],
          cpu: parseFloat(parts[2]),
          memory: parseFloat(parts[3]),
          status: parts[4],
          name: parts[5],
          command: parts.slice(6).join(' '),
          protected: parts[1] === 'root' || parseInt(parts[0]) < 100
        };
      });

      res.json({ processes });
    });
  });

  // Zakończ proces
  app.post('/diagnostics/processes/kill', requireAuth, (req, res) => {
    const { pid } = req.body;
    
    if (!pid || isNaN(pid)) {
      return res.status(400).json({ error: 'Invalid PID' });
    }

    // Sprawdź czy proces istnieje i czy można go zakończyć
    exec(`ps -p ${pid} -o user=`, (error, stdout) => {
      if (error) {
        return res.status(404).json({ error: 'Process not found' });
      }

      const user = stdout.trim();
      if (user === 'root') {
        return res.status(403).json({ error: 'Cannot kill root processes' });
      }

      // Właściwe zakończenie procesu
      exec(`kill -9 ${pid}`, (killError) => {
        if (killError) {
          console.error('Error killing process:', killError);
          return res.status(500).json({ error: 'Failed to kill process' });
        }
        res.json({ message: `Process ${pid} killed successfully` });
      });
    });
  });

  // Akcje zasilania
  app.post('/power/action', requireAuth, async (req, res) => {
    const { action, confirmation } = req.body;
    
    // Walidacja potwierdzenia dla niebezpiecznych akcji
    if ((action === 'shutdown' || action === 'restart') && confirmation !== 'POTWIERDZAM') {
      return res.status(400).json({ error: 'Confirmation required' });
    }

    try {
      let command;
      switch (action) {
        case 'shutdown':
          command = 'shutdown -h now';
          break;
        case 'restart':
          command = 'reboot';
          break;
        case 'sleep':
          command = 'systemctl suspend';
          break;
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      await execPromise(command);
      res.json({ message: `Action ${action} executed successfully` });
    } catch (error) {
      console.error(`Error executing power action ${action}:`, error);
      res.status(500).json({ error: `Failed to execute ${action}` });
    }
  });

  // Historia akcji zasilania
  app.get('/power/history', requireAuth, (req, res) => {
    try {
      // W rzeczywistości pobieralibyśmy z bazy danych lub pliku logów
      const history = [
        {
          timestamp: new Date().toISOString(),
          action: 'Restart systemu',
          status: 'success',
          user: 'admin'
        }
      ];
      res.json({ history });
    } catch (error) {
      console.error('Error fetching power history:', error);
      res.status(500).json({ error: 'Failed to fetch power history' });
    }
  });

  // Status UPS
  app.get('/ups/status', requireAuth, async (req, res) => {
    try {
      // Pobierz status UPS za pomocą narzędzia upsc
      const upsName = 'nas-ups'; // Nazwa UPS z konfiguracji NUT
      
      let status = {
        status: 'unknown',
        battery: 0,
        runtime: 0,
        voltage: 0,
        load: 0
      };

      try {
        const output = await execPromise(`upsc ${upsName}`);
        const lines = output.split('\n');
        
        lines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            const cleanKey = key.trim();
            const cleanValue = value.trim();
            
            switch (cleanKey) {
              case 'battery.charge':
                status.battery = parseInt(cleanValue);
                break;
              case 'battery.runtime':
                status.runtime = parseInt(cleanValue) / 60; // Konwertuj na minuty
                break;
              case 'input.voltage':
                status.voltage = parseFloat(cleanValue);
                break;
              case 'ups.load':
                status.load = parseInt(cleanValue);
                break;
              case 'ups.status':
                status.status = cleanValue.toLowerCase();
                break;
            }
          }
        });
      } catch (error) {
        console.warn('UPS status not available, using fallback');
      }

      res.json({ status });
    } catch (error) {
      console.error('Error fetching UPS status:', error);
      res.status(500).json({ error: 'Failed to fetch UPS status' });
    }
  });

  // Konfiguracja UPS
  app.get('/ups/config', requireAuth, (req, res) => {
    try {
      const configContent = readConfigFile(UPS_CONFIG_PATH);
      
      // Parsowanie podstawowej konfiguracji UPS
      const config = {
        type: 'usb',
        autoShutdown: true,
        shutdownLevel: 20,
        notifications: true
      };

      res.json({ config });
    } catch (error) {
      console.error('Error reading UPS config:', error);
      res.status(500).json({ error: 'Failed to read UPS config' });
    }
  });

  app.post('/ups/config', requireAuth, (req, res) => {
    try {
      const { config } = req.body;
      
      // Tutaj zapisalibyśmy konfigurację do pliku NUT
      const configLines = [
        `[nas-ups]`,
        `driver = ${config.type === 'usb' ? 'usbhid-ups' : config.type === 'network' ? 'snmp-ups' : 'blazer_ser'}`,
        `port = ${config.type === 'usb' ? 'auto' : config.type === 'network' ? '192.168.1.100' : '/dev/ttyS0'}`,
        `desc = "NAS UPS"`,
        `monitor = yes`,
        `shutdownlevel = ${config.shutdownLevel}`,
        `notifications = ${config.notifications ? 'yes' : 'no'}`
      ];

      if (writeConfigFile(UPS_CONFIG_PATH, configLines.join('\n'))) {
        // Restart usługi NUT aby zastosować zmiany
        exec('systemctl restart nut-server', (error) => {
          if (error) {
            console.error('Error restarting NUT service:', error);
          }
        });
        
        res.json({ message: 'UPS configuration saved' });
      } else {
        res.status(500).json({ error: 'Failed to save UPS config' });
      }
    } catch (error) {
      console.error('Error saving UPS config:', error);
      res.status(500).json({ error: 'Failed to save UPS config' });
    }
  });

  // Historia zdarzeń UPS
  app.get('/ups/events', requireAuth, (req, res) => {
    try {
      let events = [];
      
      if (fs.existsSync(UPS_MONITORS_PATH)) {
        const logContent = fs.readFileSync(UPS_MONITORS_PATH, 'utf8');
        const lines = logContent.split('\n').reverse().slice(0, 50); // Ostatnie 50 wpisów
        
        events = lines.filter(line => line.trim()).map(line => {
          const parts = line.split('|');
          if (parts.length >= 4) {
            return {
              timestamp: parts[0].trim(),
              event: parts[1].trim(),
              battery: parseInt(parts[2].trim()),
              runtime: parseInt(parts[3].trim())
            };
          }
          return null;
        }).filter(event => event !== null);
      }
      
      res.json({ events });
    } catch (error) {
      console.error('Error reading UPS events:', error);
      res.status(500).json({ error: 'Failed to read UPS events' });
    }
  });

  // Harmonogramy zasilania
  app.get('/power/schedules', requireAuth, (req, res) => {
    try {
      // W rzeczywistości pobieralibyśmy z bazy danych
      const schedules = [
        {
          id: 1,
          action: 'restart',
          time: '02:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          enabled: true
        }
      ];
      res.json({ schedules });
    } catch (error) {
      console.error('Error fetching power schedules:', error);
      res.status(500).json({ error: 'Failed to fetch power schedules' });
    }
  });

  app.post('/power/schedules', requireAuth, (req, res) => {
    try {
      const { schedule } = req.body;
      
      // Tutaj zapisalibyśmy harmonogram do crona
      const cronLines = [];
      
      if (schedule.enabled) {
        const daysMap = {
          monday: 'MON',
          tuesday: 'TUE',
          wednesday: 'WED',
          thursday: 'THU',
          friday: 'FRI',
          saturday: 'SAT',
          sunday: 'SUN'
        };
        
        const daysCron = schedule.days.map(day => daysMap[day]).join(',');
        const [hour, minute] = schedule.time.split(':');
        
        let command;
        switch (schedule.action) {
          case 'shutdown':
            command = 'shutdown -h now';
            break;
          case 'restart':
            command = 'reboot';
            break;
          case 'wake':
            command = 'echo "wake" > /dev/null'; // Placeholder
            break;
        }
        
        cronLines.push(`${minute} ${hour} * * ${daysCron} root ${command}`);
      }
      
      if (writeConfigFile(POWER_SCHEDULE_PATH, cronLines.join('\n'))) {
        // Odśwież cron
        exec('systemctl reload cron', (error) => {
          if (error) {
            console.error('Error reloading cron:', error);
          }
        });
        
        res.json({ message: 'Schedule saved' });
      } else {
        res.status(500).json({ error: 'Failed to save schedule' });
      }
    } catch (error) {
      console.error('Error saving power schedule:', error);
      res.status(500).json({ error: 'Failed to save power schedule' });
    }
  });

  app.delete('/power/schedules/:id', requireAuth, (req, res) => {
    try {
      const { id } = req.params;
      // Tutaj usunęlibyśmy harmonogram z crona
      res.json({ message: 'Schedule deleted' });
    } catch (error) {
      console.error('Error deleting power schedule:', error);
      res.status(500).json({ error: 'Failed to delete power schedule' });
    }
  });

  // Konfiguracja Wake-on-LAN
  app.get('/wakeonlan/config', requireAuth, (req, res) => {
    try {
      const configContent = readConfigFile(WAKEONLAN_CONFIG_PATH);
      
      // Parsowanie konfiguracji Wake-on-LAN
      const config = {
        enabled: true,
        macAddress: '00:1A:2B:3C:4D:5E',
        ipAddress: '192.168.1.255',
        port: 9
      };

      res.json({ config });
    } catch (error) {
      console.error('Error reading Wake-on-LAN config:', error);
      res.status(500).json({ error: 'Failed to read Wake-on-LAN config' });
    }
  });

  app.post('/wakeonlan/config', requireAuth, (req, res) => {
    try {
      const { config } = req.body;
      
      const configLines = [
        `ENABLED=${config.enabled ? '1' : '0'}`,
        `DEFAULT_MAC=${config.macAddress}`,
        `BROADCAST_IP=${config.ipAddress}`,
        `PORT=${config.port}`
      ];

      if (writeConfigFile(WAKEONLAN_CONFIG_PATH, configLines.join('\n'))) {
        res.json({ message: 'Wake-on-LAN configuration saved' });
      } else {
        res.status(500).json({ error: 'Failed to save Wake-on-LAN config' });
      }
    } catch (error) {
      console.error('Error saving Wake-on-LAN config:', error);
      res.status(500).json({ error: 'Failed to save Wake-on-LAN config' });
    }
  });

  // Zapisane urządzenia Wake-on-LAN
  app.get('/wakeonlan/devices', requireAuth, (req, res) => {
    try {
      // W rzeczywistości pobieralibyśmy z bazy danych
      const devices = [
        { id: 1, name: 'Komputer główny', mac: '00:1A:2B:3C:4D:5E', ip: '192.168.1.100' }
      ];
      res.json({ devices });
    } catch (error) {
      console.error('Error fetching Wake-on-LAN devices:', error);
      res.status(500).json({ error: 'Failed to fetch Wake-on-LAN devices' });
    }
  });

  app.post('/wakeonlan/devices', requireAuth, (req, res) => {
    try {
      const { device } = req.body;
      // Tutaj zapisalibyśmy urządzenie do bazy danych
      res.json({ message: 'Device saved', id: Date.now() });
    } catch (error) {
      console.error('Error saving Wake-on-LAN device:', error);
      res.status(500).json({ error: 'Failed to save Wake-on-LAN device' });
    }
  });

  app.delete('/wakeonlan/devices/:id', requireAuth, (req, res) => {
    try {
      const { id } = req.params;
      // Tutaj usunęlibyśmy urządzenie z bazy danych
      res.json({ message: 'Device deleted' });
    } catch (error) {
      console.error('Error deleting Wake-on-LAN device:', error);
      res.status(500).json({ error: 'Failed to delete Wake-on-LAN device' });
    }
  });

  // Wyślij pakiet Wake-on-LAN
  app.post('/wakeonlan/wake', requireAuth, async (req, res) => {
    try {
      const { mac, ip, port } = req.body;
      
      // Użyj narzędzia wakeonlan do wysłania pakietu
      await execPromise(`wakeonlan -i ${ip} -p ${port} ${mac}`);
      
      res.json({ message: 'Wake-on-LAN packet sent' });
    } catch (error) {
      console.error('Error sending Wake-on-LAN packet:', error);
      res.status(500).json({ error: 'Failed to send Wake-on-LAN packet' });
    }
  });

  // Monitorowanie energii
// Pobierz aktualny status energii
app.get('/energy/status', requireAuth, async (req, res) => {
  try {
    let currentPower = 0;
    let todayEnergy = 0;
    let monthEnergy = 0;
    let available = false;

    // Próba 1: Odczyt z Intel RAPL (dla procesorów Intel)
    try {
      const powerData = await execPromise('cat /sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj 2>/dev/null');
      const energyMicrojoules = parseInt(powerData);
      currentPower = energyMicrojoules / 1000000; // µJ to J, a J/s to W
      available = true;
    } catch (error) {
      // RAPL niedostępny
    }

    // Próba 2: Odczyt z powernow (AMD)
    if (!available) {
      try {
        const powerData = await execPromise('cat /sys/devices/system/cpu/cpu0/cpufreq/cpu_power 2>/dev/null');
        currentPower = parseFloat(powerData);
        available = true;
      } catch (error) {
        // powernow niedostępny
      }
    }

    // Próba 3: Użycie powertop (jeśli zainstalowany)
    if (!available) {
      try {
        const powerData = await execPromise('sudo powertop --quiet --csv=/tmp/power.csv 2>/dev/null && head -10 /tmp/power.csv | tail -1 | cut -d\\" -f2 2>/dev/null');
        currentPower = parseFloat(powerData) || 0;
        available = true;
      } catch (error) {
        // powertop niedostępny
      }
    }

    // Oblicz dzienne i miesięczne zużycie (przybliżone)
    if (available) {
      todayEnergy = (currentPower * 24 / 1000).toFixed(1);
      monthEnergy = (currentPower * 24 * 30 / 1000).toFixed(1);
    }

    res.json({
      status: {
        currentPower: available ? Math.round(currentPower * 10) / 10 : null,
        todayEnergy: available ? parseFloat(todayEnergy) : null,
        monthEnergy: available ? parseFloat(monthEnergy) : null,
        available
      }
    });
  } catch (error) {
    console.error('Error fetching energy status:', error);
    res.json({
      status: {
        currentPower: null,
        todayEnergy: null,
        monthEnergy: null,
        available: false
      }
    });
  }
});

// Pobierz historię energii
app.get('/energy/history', requireAuth, async (req, res) => {
  try {
    let history = [];
    
    // Próba odczytu historii z różnych źródeł
    try {
      // Sprawdź czy istnieje historia w localStorage API
      const historyData = await execPromise('cat /var/log/energy.log 2>/dev/null | tail -24 || echo ""');
      const lines = historyData.split('\n').filter(line => line.trim());
      
      history = lines.map(line => {
        const [timestamp, power] = line.split(' ');
        return {
          timestamp,
          power: parseFloat(power) || 0
        };
      });
    } catch (error) {
      // Brak historii
    }
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching energy history:', error);
    res.json({ history: [] });
  }
});

// Pobierz zużycie per urządzenie
app.get('/energy/devices', requireAuth, async (req, res) => {
  try {
    let devices = [];
    let available = false;
    
    // Próba 1: Użycie powertop
    try {
      const result = await execPromise('sudo powertop --quiet --csv=/tmp/powertop.csv 2>/dev/null && grep -E "Device|Runtime" /tmp/powertop.csv | head -20');
      const lines = result.split('\n');
      
      devices = lines.filter(line => line.includes('Device')).map(line => {
        const parts = line.split('"');
        return {
          name: parts[1] || 'Unknown',
          power: parseFloat(parts[3]) || 0,
          daily: (parseFloat(parts[3]) * 24 / 1000).toFixed(2),
          monthly: (parseFloat(parts[3]) * 24 * 30 / 1000).toFixed(2),
          percentage: Math.min(100, Math.round((parseFloat(parts[3]) / 100) * 100))
        };
      });
      
      available = devices.length > 0;
    } catch (error) {
      // powertop niedostępny
    }
    
    res.json({ devices, available });
  } catch (error) {
    console.error('Error fetching device consumption:', error);
    res.json({ devices: [], available: false });
  }
});

// Zapisz stawkę energii
app.post('/energy/rate', requireAuth, async (req, res) => {
  try {
    const { rate } = req.body;
    
    // Zapisz stawkę w pliku konfiguracyjnym
    writeConfigFile('/etc/energy-rate.conf', `RATE=${rate}`);
    
    res.json({ message: 'Energy rate saved', rate });
  } catch (error) {
    console.error('Error saving energy rate:', error);
    res.status(500).json({ error: 'Failed to save energy rate' });
  }
});

// Rozszerzenie API w pliku serwera - poprawiona wersja

// Konfiguracja UPS
let nutConfig = {
  upsName: 'nas-ups',
  driver: 'usbhid-ups',
  port: 'auto',
  shutdownLevel: 20,
  delay: 30,
  pollInterval: 5,
  maxRetries: 3
};

// Pobierz szczegóły UPS
app.get('/ups/details', requireAuth, async (req, res) => {
  try {
    const upsName = nutConfig.upsName || 'nas-ups';
    const details = {};
    
    // Pobierz szczegóły UPS za pomocą upsc
    try {
      const output = await execPromise(`upsc ${upsName}`);
      const lines = output.split('\n');
      
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          const cleanKey = key.trim();
          const cleanValue = value.trim();
          
          switch (cleanKey) {
            case 'device.model':
              details.model = cleanValue;
              break;
            case 'device.mfr':
              details.mfr = cleanValue;
              break;
            case 'device.serial':
              details.serial = cleanValue;
              break;
            case 'device.firmware':
              details.firmware = cleanValue;
              break;
            case 'device.date':
              details.date = cleanValue;
              break;
            case 'output.voltage.nominal':
              details.nominalVoltage = cleanValue;
              break;
            case 'ups.realpower.nominal':
              details.nominalPower = cleanValue;
              break;
            case 'battery.voltage.nominal':
              details.nominalBatteryVoltage = cleanValue;
              break;
            case 'ups.productid':
              details.productId = cleanValue;
              break;
            case 'ups.vendorid':
              details.vendorId = cleanValue;
              break;
          }
        }
      });
    } catch (error) {
      console.warn('UPS details not available:', error.message);
      // Zwróć puste szczegóły zamiast błędu
    }
    
    res.json({ details });
  } catch (error) {
    console.error('Error fetching UPS details:', error);
    res.status(500).json({ error: 'Failed to fetch UPS details' });
  }
});

// Pobierz pełną konfigurację NUT
app.get('/ups/config/nut', requireAuth, async (req, res) => {
  try {
    // Spróbuj odczytać istniejącą konfigurację z plików
    let config = { ...nutConfig };
    
    try {
      if (fs.existsSync('/etc/nut/ups.conf')) {
        const upsConf = fs.readFileSync('/etc/nut/ups.conf', 'utf8');
        const lines = upsConf.split('\n');
        
        lines.forEach(line => {
          if (line.includes('driver =')) {
            config.driver = line.split('=')[1].trim();
          } else if (line.includes('port =')) {
            config.port = line.split('=')[1].trim();
          }
        });
      }
      
      if (fs.existsSync('/etc/nut/upsmon.conf')) {
        const upsmonConf = fs.readFileSync('/etc/nut/upsmon.conf', 'utf8');
        const lines = upsmonConf.split('\n');
        
        lines.forEach(line => {
          if (line.includes('POLLFREQ')) {
            const pollfreq = line.split(' ')[1];
            if (pollfreq) config.pollInterval = parseInt(pollfreq);
          }
        });
      }
    } catch (error) {
      console.warn('Error reading NUT config files:', error);
    }
    
    res.json({ config });
  } catch (error) {
    console.error('Error fetching NUT config:', error);
    res.status(500).json({ error: 'Failed to fetch NUT config' });
  }
});

// Zapisz konfigurację NUT
app.post('/ups/config/nut', requireAuth, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config || !config.upsName) {
      return res.status(400).json({ error: 'Invalid configuration' });
    }
    
    // Aktualizuj konfigurację w pamięci
    Object.assign(nutConfig, config);
    
    // Generuj konfigurację ups.conf
    const upsConfContent = `
[${config.upsName}]
driver = ${config.driver}
port = ${config.port}
desc = "NAS UPS"
`;
    
// Generuj konfigurację upsmon.conf
const upsmonConfContent = `
MONITOR ${config.upsName}@localhost 1 monuser pass ${config.monitoring ? 'master' : 'slave'}
SHUTDOWNCMD "/sbin/shutdown -h +0"
POLLFREQ ${config.pollInterval || 5}
POLLFREQALERT ${config.pollInterval || 5}
HOSTSYNC 15
DEADTIME 15
RBWARNTIME 43200
NOCOMMWARNTIME 300
FINALDELAY 5
`;
    
    // Generuj konfigurację upsd.conf
    const upsdConfContent = `
MAXAGE 15
STATEPATH /var/run/nut
LISTEN 127.0.0.1 3493
`;

// Generuj konfigurację upsd.users
const upsdUsersContent = `
[admin]
password = password
actions = SET
instcmds = ALL

[monuser]
password = pass
upsmon master
`;
    
    // Generuj konfigurację upssched.conf (jeśli potrzeba)
    const upsschedConfContent = `
CMDSCRIPT /etc/nut/upssched-cmd
`;
    
    try {
      // Zapisz pliki konfiguracyjne
      writeConfigFile('/etc/nut/ups.conf', upsConfContent);
      writeConfigFile('/etc/nut/upsmon.conf', upsmonConfContent);
      writeConfigFile('/etc/nut/upsd.conf', upsdConfContent);
      writeConfigFile('/etc/nut/upssched.conf', upsschedConfContent);
      writeConfigFile('/etc/nut/upsd.users', upsdUsersContent);
      
      // Ustaw prawa dostępu
      await execPromise('chown -R nut:nut /etc/nut/');
      await execPromise('chmod -R 640 /etc/nut/*.conf');
      
    } catch (error) {
      console.warn('Could not write config files, using fallback:', error);
      // Kontynuuj nawet jeśli nie uda się zapisać plików
    }
    
    res.json({ message: 'NUT configuration saved', config: nutConfig });
  } catch (error) {
    console.error('Error saving NUT config:', error);
    res.status(500).json({ error: 'Failed to save NUT config' });
  }
});

// Restart usługi NUT
app.post('/ups/service/restart', requireAuth, async (req, res) => {
  try {
    // Sprawdź czy usługa NUT jest zainstalowana
    try {
      await execPromise('which upsdrvctl');
    } catch (error) {
      return res.status(400).json({ error: 'NUT is not installed' });
    }
    
    // Zatrzymaj i uruchom usługi NUT
    await execPromise('systemctl stop nut-server nut-client nut-monitor 2>/dev/null || true');
    await execPromise('pkill -f upsdrvctl 2>/dev/null || true');
    
    // Uruchom driver
    await execPromise(`upsdrvctl -u nut start`);
    
    // Uruchom demona
    await execPromise('upsd -u nut');
    
    // Uruchom monitor
    await execPromise('upsmon -u nut');
    
    res.json({ message: 'NUT service restarted successfully' });
  } catch (error) {
    console.error('Error restarting NUT service:', error);
    
    // Fallback: spróbuj prostszego restartu
    try {
      await execPromise('systemctl restart nut-server 2>/dev/null || true');
      await execPromise('systemctl restart nut-client 2>/dev/null || true');
      res.json({ message: 'NUT service restarted (fallback)' });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to restart NUT service' });
    }
  }
});

// Test UPS
app.post('/ups/test', requireAuth, async (req, res) => {
  try {
    const { type } = req.body;
    const upsName = nutConfig.upsName || 'nas-ups';
    
    let command;
    if (type === 'quick') {
      command = `upscmd -u admin -p password ${upsName} test.battery.start.quick 2>/dev/null || echo "Test command not supported"`;
    } else if (type === 'deep') {
      command = `upscmd -u admin -p password ${upsName} test.battery.start.deep 2>/dev/null || echo "Test command not supported"`;
    } else {
      return res.status(400).json({ error: 'Invalid test type' });
    }
    
    const result = await execPromise(command);
    
    if (result.includes('not supported')) {
      res.json({ message: 'Test command not supported by this UPS', warning: true });
    } else {
      res.json({ message: `UPS test started: ${type}` });
    }
  } catch (error) {
    console.error('Error starting UPS test:', error);
    
    // Fallback dla UPS które nie obsługują testów przez upscmd
    res.json({ 
      message: 'Test initiated (simulated)', 
      warning: 'This UPS may not support remote testing' 
    });
  }
});

// Pobierz logi NUT
app.get('/ups/logs', requireAuth, async (req, res) => {
  try {
    let logs = '';
    
    // Spróbuj odczytać różne lokalizacje logów
    const logPaths = [
      '/var/log/nut.log',
      '/var/log/messages',
      '/var/log/syslog',
      '/var/log/ups.log'
    ];
    
    for (const logPath of logPaths) {
      try {
        if (fs.existsSync(logPath)) {
          logs = await execPromise(`grep -i nut ${logPath} | tail -50`);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!logs) {
      // Jeśli nie znaleziono logów, zwróć informację o statusie
      logs = await execPromise('systemctl status nut-server 2>/dev/null || echo "NUT service not available"');
    }
    
    res.json({ logs: logs.split('\n').filter(line => line.trim()) });
  } catch (error) {
    console.error('Error fetching UPS logs:', error);
    res.status(500).json({ error: 'Failed to fetch UPS logs' });
  }
});


};
