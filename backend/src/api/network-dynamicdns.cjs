const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cron = require('node-cron');

// Konfiguracja domyślna
const DEFAULT_CONFIG_PATH = '/etc/nas-panel/dynamic-dns.conf';
const PROVIDERS = {
  noip: {
    id: 'noip',
    updateUrl: 'http://dynupdate.no-ip.com/nic/update',
    requiredFields: ['hostname', 'username', 'password'],
    authMethod: 'basic'
  },
  dyndns: {
    id: 'dyndns',
    updateUrl: 'https://members.dyndns.org/v3/update',
    requiredFields: ['hostname', 'username', 'password']
  },
  duckdns: {
    id: 'duckdns',
    updateUrl: 'https://www.duckdns.org/update',
    requiredFields: ['hostname', 'token']
  }
};

module.exports = function(app, requireAuth) {
  // Pobierz listę skonfigurowanych usług DDNS
  app.get('/network/dynamic-dns', requireAuth, async (req, res) => {
    try {
      const config = await readConfig();
      res.json({ services: config.services || [] });
    } catch (error) {
      console.error('Error reading DDNS config:', error);
      res.status(500).json({ error: 'Failed to read DDNS configuration' });
    }
  });

  // Dodaj nową usługę DDNS
  app.post('/network/dynamic-dns', requireAuth, async (req, res) => {
    try {
      const { provider, ...serviceData } = req.body;
      
      // Walidacja
      if (!PROVIDERS[provider]) {
        return res.status(400).json({ error: 'Invalid provider' });
      }

      const missingFields = PROVIDERS[provider].requiredFields.filter(
        field => !serviceData[field]
      );

      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const config = await readConfig();
      const newService = {
        id: uuidv4(),
        provider,
        ...serviceData,
        lastUpdate: null,
        status: 'pending'
      };

      config.services = [...(config.services || []), newService];
      await saveConfig(config);

      res.status(201).json(newService);
    } catch (error) {
      console.error('Error adding DDNS service:', error);
      res.status(500).json({ error: 'Failed to add DDNS service' });
    }
  });

  // Aktualizuj usługę DDNS
  app.put('/network/dynamic-dns/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { provider, ...updateData } = req.body;
      
      const config = await readConfig();
      const serviceIndex = config.services.findIndex(s => s.id === id);
      
      if (serviceIndex === -1) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const updatedService = {
        ...config.services[serviceIndex],
        ...updateData,
        lastUpdate: new Date().toISOString()
      };

      config.services[serviceIndex] = updatedService;
      await saveConfig(config);

      res.json(updatedService);
    } catch (error) {
      console.error('Error updating DDNS service:', error);
      res.status(500).json({ error: 'Failed to update DDNS service' });
    }
  });

  // Usuń usługę DDNS
  app.delete('/network/dynamic-dns/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const config = await readConfig();
      const initialLength = config.services?.length || 0;
      
      config.services = (config.services || []).filter(s => s.id !== id);
      
      if (config.services.length === initialLength) {
        return res.status(404).json({ error: 'Service not found' });
      }

      await saveConfig(config);
      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Error deleting DDNS service:', error);
      res.status(500).json({ error: 'Failed to delete DDNS service' });
    }
  });

  // Wymuś aktualizację DDNS
  app.post('/network/dynamic-dns/:id/update', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const config = await readConfig();
      const service = config.services.find(s => s.id === id);
      
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const provider = PROVIDERS[service.provider];
      if (!provider) {
        return res.status(400).json({ error: 'Invalid provider configuration' });
      }

      // Wykonaj aktualizację (uproszczone - w rzeczywistości trzeba by wykonać zapytanie HTTP)
      const updateResult = await updateDns(service, provider);
      
      // Zaktualizuj status
      service.lastUpdate = new Date().toISOString();
      service.status = updateResult.success ? 'active' : 'error';
      await saveConfig(config);

      res.json({
        success: updateResult.success,
        message: updateResult.message,
        service
      });
    } catch (error) {
      console.error('Error updating DNS:', error);
      res.status(500).json({ error: 'Failed to update DNS' });
    }
  });

  // Pobierz ustawienia DDNS
  app.get('/network/dynamic-dns/settings', requireAuth, async (req, res) => {
    try {
      const config = await readConfig();
      res.json({ 
        settings: config.settings || {
          updateInterval: '30m',
          forceIpv4: false,
          forceIpv6: false
        }
      });
    } catch (error) {
      console.error('Error reading DDNS settings:', error);
      res.status(500).json({ error: 'Failed to read DDNS settings' });
    }
  });

  // Zapisz ustawienia DDNS
  app.post('/network/dynamic-dns/settings', requireAuth, async (req, res) => {
    try {
      const { settings } = req.body;
      const config = await readConfig();
    
      config.settings = {
        ...(config.settings || {}),
        ...settings
      };

      await saveConfig(config);
    
      // Aktualizuj cron przy zmianie interwału
      if (settings.updateInterval) {
        updateCronJob(settings.updateInterval);
      }
    
      res.json({ settings: config.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });
  
app.get('/network/dynamic-dns/update-all', async (req, res) => {
  try {
    const config = await readConfig();
    const results = [];
    
    for (const service of config.services || []) {
      const provider = PROVIDERS[service.provider];
      if (!provider) {
        results.push({
          id: service.id,
          hostname: service.hostname,
          success: false,
          message: 'Provider not configured'
        });
        continue;
      }
      
      const result = await performDnsUpdate(service, provider);
      results.push({
        id: service.id,
        hostname: service.hostname,
        success: result.success,
        message: result.message,
        ipUsed: result.ipUsed
      });
      
      // Aktualizuj status w konfiguracji
      service.lastUpdate = new Date().toISOString();
      service.status = result.success ? 'active' : 'error';
    }
    
    await saveConfig(config);
    res.json({ 
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating all DNS:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update DNS services',
      details: error.message
    });
  }
});
  
app.post('/network/dynamic-dns/install-cron', requireAuth, async (req, res) => {
  try {
    const config = await readConfig();
    const interval = config.settings?.updateInterval || '30m';
    const cronExpression = convertIntervalToCron(interval);
    
    // Poprawione polecenie - bez nawiasów otaczających
    const cronCommand = `${cronExpression} /usr/bin/python3 /usr/local/bin/update-dynamic-dns.py >> /var/log/dynamic-dns.log 2>&1`;
    const addCronCommand = `(crontab -l 2>/dev/null; echo "${cronCommand}") | crontab -`;
    
    exec(addCronCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Error installing cron:', error);
        console.error('stderr:', stderr);
        return res.status(500).json({ 
          error: 'Failed to install cron job',
          details: stderr 
        });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to install cron job',
      details: error.message 
    });
  }
});

app.get('/network/dynamic-dns/cron-status', requireAuth, async (req, res) => {
  try {
    exec('crontab -l', (error, stdout) => {
      if (error) {
        return res.json({ installed: false, error: 'No cron jobs or error' });
      }
      const hasJob = stdout.includes('update-dynamic-dns.py');
      res.json({ installed: hasJob, jobs: stdout });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check cron status' });
  }
});
  
  
};

// Helper functions
async function updateCronJob(interval) {
  try {
    const cronExpression = convertIntervalToCron(interval);
    const scriptPath = '/usr/local/bin/update-dynamic-dns.py';
    
    // Sprawdź czy skrypt istnieje
    try {
      await fs.access(scriptPath, fs.constants.X_OK);
    } catch {
      console.error('Update script does not exist or is not executable');
      return;
    }
    
    // Usuń istniejące zadania
    cron.getTasks().forEach(task => task.stop());
    
    // Dodaj nowe
    cron.schedule(cronExpression, () => {
      console.log(`Running DNS update at ${new Date().toISOString()}`);
      exec(`${scriptPath}`, (error, stdout, stderr) => {
        if (error) console.error('Update failed:', error);
        if (stdout) console.log('Update output:', stdout);
        if (stderr) console.error('Update error:', stderr);
      });
    });
    
    console.log(`Cron job scheduled with interval: ${interval}`);
  } catch (error) {
    console.error('Error updating cron job:', error);
  }
}

function convertIntervalToCron(interval) {
  switch(interval) {
    case '15m': return '*/15 * * * *';
    case '30m': return '*/30 * * * *';
    case '1h': return '0 * * * *';
    case '2h': return '0 */2 * * *';
    case '6h': return '0 */6 * * *';
    case '12h': return '0 */12 * * *';
    case '24h': return '0 0 * * *';
    default: return '*/30 * * * *';
  }
}

function initCron() {
  readConfig().then(config => {
    if (config.settings?.updateInterval) {
      updateCronJob(config.settings.updateInterval);
    }
  });
}

// Wywołaj przy starcie serwera
initCron();

async function performDnsUpdate(service, provider) {
  try {
    const config = await readConfig();
    const settings = config.settings || {
      forceIpv4: false,
      forceIpv6: false
    };

    // Pobierz aktualny adres IP
    const ipAddress = await getCurrentIpAddress(settings);
    
    // Konfiguracja zapytania HTTP
    const requestConfig = {
      timeout: 10000,
      headers: {
        'User-Agent': 'YourApp/1.0 your@email.com'
      }
    };

    // Specjalna obsługa dla No-IP
    if (provider.id === 'noip' || provider.id === 'dyndns') {      
      const params = new URLSearchParams();
      params.append('hostname', service.hostname);
      if (ipAddress) params.append('myip', ipAddress);

      const response = await axios.get(
        `${provider.updateUrl}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${service.username}:${service.password}`).toString('base64')}`,
            'User-Agent': 'YourApp/1.0 your@email.com'
          },
	  auth: {
	    username: service.username,
	    password: service.password,
	  },
	}
      );

      return interpretNoIpResponse(response.data, ipAddress);
    }

    // Standardowa obsługa dla innych providerów
    const params = new URLSearchParams();
    params.append('hostname', service.hostname);
    if (service.username) params.append('username', service.username);
    if (service.password) params.append('password', service.password);
    if (service.token) params.append('token', service.token);
    if (ipAddress) params.append('myip', ipAddress);

    const response = await axios.get(
      `${provider.updateUrl}?${params.toString()}`,
    	   requestConfig
    );

    return {
      success: response.status === 200,
      message: response.data,
      ipUsed: ipAddress
    };

  } catch (error) {
    console.error('DNS update error:', error);
    return {
      success: false,
      message: error.response?.data || error.message,
      ipUsed: ''
    };
  }
}

// Pomocnicza funkcja do interpretacji odpowiedzi No-IP
function interpretNoIpResponse(responseData, ipUsed) {
  const message = responseData.split('\n')[0];
  const successCodes = ['good', 'nochg'];
  const errorCodes = ['nohost', 'badauth', 'badagent', '!donator', 'abuse'];

  const success = successCodes.some(code => message.includes(code));
  const isError = errorCodes.some(code => message.includes(code));

  return {
    success: success && !isError,
    message: message,
    ipUsed: ipUsed
  };
}

// Funkcja do pobierania adresu IP
async function getCurrentIpAddress(settings) {
  try {
    if (settings.forceIpv4) return await getPublicIp('ipv4');
    if (settings.forceIpv6) return await getPublicIp('ipv6');
    return await getPublicIp('auto');
  } catch (error) {
    console.error('Error getting IP:', error);
    return '';
  }
}

async function getPublicIp(version = 'auto') {
  const services = {
    ipv4: [
      'https://api.ipify.org',
      'https://ipv4.icanhazip.com'
    ],
    ipv6: [
      'https://api6.ipify.org',
      'https://ipv6.icanhazip.com'
    ],
    auto: [
      'https://api.ipify.org',
      'https://icanhazip.com'
    ]
  };

  const urls = services[version] || services.auto;
  
  for (const url of urls) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      const ip = response.data.trim();
      if (ip) return ip;
    } catch (error) {
      console.warn(`Failed to get IP from ${url}:`, error.message);
    }
  }
  
  throw new Error('Could not determine public IP address');
}

async function readConfig() {
  try {
    const data = await fs.readFile(DEFAULT_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { services: [], settings: {} };
    }
    throw error;
  }
}

async function saveConfig(config) {
  await fs.writeFile(DEFAULT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

async function updateDns(service, provider) {
  // W rzeczywistej implementacji należy wykonać zapytanie HTTP do providera
  // Tutaj uproszczona symulacja
  const success = Math.random() > 0.2; // 80% szans na sukces dla demonstracji
  return {
    success,
    message: success ? 'DNS updated successfully' : 'Failed to update DNS'
  };
}
