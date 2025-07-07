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
    
    // Mapowanie na format oczekiwany przez frontend
    const response = {
      daemonPort: config['hosts']?.includes('2375') ? 2375 : 2376,
      ipv6Enabled: config['ipv6'] || false,
      loggingDriver: config['log-driver'] || 'json-file',
      maxConcurrentDownloads: config['max-concurrent-downloads'] || 3,
      dataRoot: config['data-root'] || '/var/lib/docker',
      containerd: config['containerd']
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
    const { 
      daemonPort,
      ipv6Enabled,
      loggingDriver,
      maxConcurrentDownloads,
      dataRoot
    } = req.body;

    // Przygotuj nową konfigurację
    const newConfig = {
      'hosts': [`tcp://0.0.0.0:${daemonPort}`, "unix:///var/run/docker.sock"],
      'containerd': '/run/containerd/containerd.sock',
      'ipv6': ipv6Enabled,
      'log-driver': loggingDriver,
      'max-concurrent-downloads': maxConcurrentDownloads,
      'data-root': dataRoot,
      'experimental': false,
      'tls': false,
      'tlscacert': '',
      'tlscert': '',
      'tlskey': ''
    };

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
