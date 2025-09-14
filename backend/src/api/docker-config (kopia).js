const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DOCKER_CONFIG_PATH = '/etc/docker/daemon.json';

module.exports = function(app, requireAuth) {

// Helper do odczytu konfiguracji
const readDockerConfig = () => {
  try {
    if (fs.existsSync(DOCKER_CONFIG_PATH)) {
      const rawData = fs.readFileSync(DOCKER_CONFIG_PATH);
      return JSON.parse(rawData);
    }
    return {};
  } catch (error) {
    console.error('Error reading docker config:', error);
    return {};
  }
};

// Helper do zapisu konfiguracji
const writeDockerConfig = (config) => {
  try {
    fs.writeFileSync(DOCKER_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing docker config:', error);
    return false;
  }
};

// Pobierz aktualną konfigurację
app.get('/services/docker/config', requireAuth, (req, res) => {
  try {
    const config = readDockerConfig();

    // Extract port from hosts array
    let daemonPort = 2375;
    const tcpHost = config['hosts']?.find(host => host.startsWith('tcp://'));
    if (tcpHost) {
      const portMatch = tcpHost.match(/:(\d+)$/);
      if (portMatch) {
        daemonPort = parseInt(portMatch[1]);
      }
    }

    // Mapowanie na format oczekiwany przez frontend
const response = {
  daemonPort: daemonPort,
  hosts: config['hosts'] || ['tcp://0.0.0.0:2375', 'unix:///var/run/docker.sock'],
  ipv6Enabled: config['ipv6'] || false,
  loggingDriver: config['log-driver'] || 'json-file',
  logLevel: config['log-level'] || 'debug',
  maxConcurrentDownloads: config['max-concurrent-downloads'] || 3,
  maxConcurrentUploads: config['max-concurrent-uploads'] || 5,
  maxDownloadAttempts: config['max-download-attempts'] || 5,
  dataRoot: config['data-root'] || '/var/lib/docker',
  containerd: config['containerd'] || '/run/containerd/containerd.sock',
  experimental: config['experimental'] || false,
  debug: config['debug'] !== undefined ? config['debug'] : true,
  liveRestore: config['live-restore'] !== undefined ? config['live-restore'] : true,
  iptables: config['iptables'] || false,
  ip6tables: config['ip6tables'] || false,
  ipForward: config['ip-forward'] || false, // Dodane
  ipMasq: config['ip-masq'] || false, // Dodane
  tls: config['tls'] || false, // Dodane
  defaultAddressPools: config['default-address-pools'] || [ // Dodane
    {
      base: '172.30.0.0/16',
      size: 24
    },
    {
      base: '172.31.0.0/16',
      size: 24
    }
  ],
  logOpts: config['log-opts'] || { // Dodane
    'cache-disabled': 'false',
    'cache-max-file': '5',
    'cache-max-size': '20m',
    'cache-compress': 'true',
    'env': 'os,customer',
    'labels': 'somelabel',
    'max-file': '5',
    'max-size': '10m'
  }
};

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to read Docker config' });
  }
});

// Zapisz nową konfigurację
app.post('/services/docker/config', requireAuth, async (req, res) => {
  try {
    // Przygotuj nową konfigurację - używamy danych z req.body bez nadpisywania
    const newConfig = {
      'hosts': req.body.hosts || [`tcp://0.0.0.0:${req.body.daemonPort || 2375}`, 'unix:///var/run/docker.sock'],
      'containerd': req.body.containerd,
      'ipv6': req.body.ipv6Enabled,
      'log-driver': req.body.loggingDriver,
      'log-level': req.body.logLevel,
      'max-concurrent-downloads': req.body.maxConcurrentDownloads,
      'max-concurrent-uploads': req.body.maxConcurrentUploads,
      'max-download-attempts': req.body.maxDownloadAttempts,
      'data-root': req.body.dataRoot,
      'experimental': req.body.experimental,
      'debug': req.body.debug,
      'live-restore': req.body.liveRestore,
      'iptables': req.body.iptables,
      'ip6tables': req.body.ip6tables,
      'ip-forward': req.body.ipForward, // Dodane nowe pole
      'ip-masq': req.body.ipMasq || false, // Dodane z domyślną wartością
      'tls': req.body.tls || false, // Dodane z domyślną wartością
      'default-address-pools': req.body.defaultAddressPools || [ // Dodane z domyślną wartością
        {
          'base': '172.30.0.0/16',
          'size': 24
        },
        {
          'base': '172.31.0.0/16',
          'size': 24
        }
      ],
      'log-opts': req.body.logOpts || { // Dodane z domyślną wartością
        'cache-disabled': 'false',
        'cache-max-file': '5',
        'cache-max-size': '20m',
        'cache-compress': 'true',
        'env': 'os,customer',
        'labels': 'somelabel',
        'max-file': '5',
        'max-size': '10m'
      }
    };

    // Usuń puste/niezdefiniowane wartości
    Object.keys(newConfig).forEach(key => {
      if (newConfig[key] === undefined || newConfig[key] === null) {
        delete newConfig[key];
      }
    });

    // Zapisz konfigurację
    if (!writeDockerConfig(newConfig)) {
      throw new Error('Failed to write config file');
    }

    // Restart Docker aby zastosować zmiany
    exec('systemctl restart docker', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting docker: ${stderr}`);
        return res.status(500).json({ error: 'Failed to restart Docker service' });
      }
      res.json({ message: 'Docker configuration updated successfully' });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update Docker config' });
  }
});

};
