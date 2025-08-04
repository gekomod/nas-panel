const path = require('path');
const fs = require('fs').promises;
const fsa = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const cron = require('node-cron');
const cronParser = require('cron-parser');

const util = require('util');
const execPromise = util.promisify(exec);
const YAML = require('yaml');
const Docker = require('dockerode');

var docker = new Docker();

const execAsync = promisify(exec);
const DOCKER_COMPOSE_DIR = path.join('/opt/nas-panel/docker-compose');
const CRON_JOBS_FILE = '/etc/nas-panel/cron-jobs.json';

// Globalny storage dla zadań cron
const cronJobs = new Map();

module.exports = function(app, requireAuth) {

const manageDockerService = async (action) => {
  return new Promise((resolve, reject) => {
    const command = `sudo systemctl ${action} docker`;
    console.log(`Executing: ${command}`);
    
    const child = exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error ${action}ing Docker: ${stderr || error.message}`);
        return reject(new Error(`Failed to ${action} Docker: ${stderr || error.message}`));
      }
      console.log(`Docker ${action} success: ${stdout}`);
      resolve(`Docker service ${action}ed successfully`);
    });

    child.on('exit', (code, signal) => {
      if (code !== 0) {
        console.warn(`Process exited with code ${code}, signal ${signal}`);
      }
    });
  });
};

// Uruchom Docker
app.post('/services/docker/stop', requireAuth, async (req, res) => {
  try {
    // 1. Najpierw zatrzymaj wszystkie kontenery
    await new Promise((resolve) => {
      exec('sudo docker stop $(sudo docker ps -aq)', { timeout: 30000 }, (error) => {
        if (error) {
          console.warn('Warning: Not all containers stopped gracefully');
        }
        resolve();
      });
    });

    // 2. Zatrzymaj usługę Docker
    const result = await manageDockerService('stop');
    
    // 3. Sprawdź status
    const status = await new Promise((resolve) => {
      exec('systemctl is-active docker', (error) => {
        resolve(error ? 'inactive' : 'active');
      });
    });

    if (status === 'active') {
      throw new Error('Docker service still running after stop command');
    }

    res.json({ 
      message: result,
      status: 'inactive'
    });
  } catch (error) {
    console.error(`Stop failed: ${error.message}`);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

app.post('/services/docker/container/create', requireAuth, async (req, res) => {
  try {
    const { name, image, ports, volumes, env } = req.body;
    
    // 1. Utwórz plik docker-compose
    const composeContent = `version: '3'
services:
  ${name}:
    image: ${image}
    ${ports ? `ports:\n${ports.map(p => `      - "${p}"`).join('\n')}` : ''}
    ${volumes ? `volumes:\n${volumes.map(v => `      - "${v}"`).join('\n')}` : ''}
    ${env ? `environment:\n${Object.entries(env).map(([k,v]) => `      - ${k}=${v}`).join('\n')}` : ''}`;
    
    const fileName = `docker-compose-${name}.yml`;
    const filePath = path.join(DOCKER_COMPOSE_DIR, fileName);
    await fs.writeFile(filePath, composeContent, 'utf8');
    
    // 2. Uruchom kontener
    await execAsync(`docker compose -f ${filePath} up -d`);
    
    res.json({
      success: true,
      message: `Container ${name} created and started`,
      composeFile: fileName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create container',
      details: error.message
    });
  }
});

app.post('/services/docker/container/:id/connect-network', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { network } = req.body;
    
    // Sprawdź czy sieć istnieje, jeśli nie - utwórz
    try {
      await execAsync(`docker network inspect ${network}`);
    } catch {
      await execAsync(`docker network create ${network}`);
    }
    
    // Podłącz kontener
    await execAsync(`docker network connect ${network} ${id}`);
    
    res.json({ success: true, message: `Connected to network ${network}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/services/docker/container/:id/mount-volume', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { volume, containerPath } = req.body;
    
    // Sprawdź czy wolumin istnieje, jeśli nie - utwórz
    try {
      await execAsync(`docker volume inspect ${volume}`);
    } catch {
      await execAsync(`docker volume create ${volume}`);
    }
    
    // Zamontuj wolumin
    await execAsync(`docker container update ${id} --mount source=${volume},target=${containerPath}`);
    
    res.json({ success: true, message: `Mounted volume ${volume} to ${containerPath}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Zatrzymaj Docker
app.post('/services/docker/start', requireAuth, async (req, res) => {
  try {
    const result = await manageDockerService('start');

    await new Promise((resolve) => {
      exec('sudo docker start $(sudo docker ps -aq)', { timeout: 30000 }, (error) => {
        if (error) {
          console.warn('Warning: Not all containers started gracefully');
        }
        resolve();
      });
    });

    res.json({ message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zrestartuj Docker
app.post('/services/docker/restart', requireAuth, async (req, res) => {
  try {
    const result = await manageDockerService('restart');
    res.json({ message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


  // Check if Docker is installed
  app.get('/services/docker/status', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('which docker || echo ""');
    const dockerInstalled = stdout.trim().length > 0;
    
    if (!dockerInstalled) {
      return res.json({
        installed: false,
        version: null,
        status: 'not-installed'
      });
    }

    // Get Docker version
    const { stdout: versionOut } = await execAsync('docker --version');
    const versionMatch = versionOut.match(/Docker version (.+?),/);
    
    // Get Docker service status
    let serviceStatus = 'unknown';
    try {
      const { stdout: serviceOut } = await execAsync('systemctl is-active docker');
      serviceStatus = serviceOut.trim();
    } catch (e) {
      serviceStatus = 'inactive';
    }

    res.json({
      installed: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
      status: serviceStatus,
      info: versionOut.trim()
    });
  } catch (error) {
    res.status(500).json({
      installed: false,
      error: error.message
    });
  }
});

  app.post('/services/docker/install', requireAuth, async (req, res) => {
  try {
    const commands = [
      'apt-get update -y',
      'apt-get install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common',
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -',
      'add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"',
      'apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io',
      'systemctl enable docker',
      'systemctl start docker',
      'docker run hello-world'
    ];

    let output = '';
    for (const cmd of commands) {
      try {
        const { stdout, stderr } = await execAsync(cmd);
        output += `$ ${cmd}\n${stdout || stderr}\n\n`;
      } catch (err) {
        output += `$ ${cmd}\nERROR: ${err.stderr || err.stdout}\n\n`;
        throw err;
      }
    }

    res.json({
      success: true,
      output: output
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Docker installation failed',
      details: error.message,
      output: error.stderr || error.stdout
    });
  }
});


  // Get Docker containers
  app.get('/services/docker/containers', requireAuth, async (req, res) => {
    try {
      const { all = false } = req.query;
      const { stdout } = await execAsync(`docker ps ${all ? '-a' : ''} --format '{{json .}}' | jq -s .`);
      res.json({
        success: true,
        containers: JSON.parse(stdout)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get containers',
        details: error.message
      });
    }
  });

app.get('/services/docker/container/logs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tail = 100 } = req.query;
    
    // Upewnij się, że ID kontenera jest bezpieczne
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid container ID'
      });
    }

    const { stdout } = await execAsync(`docker logs --tail ${tail} ${id} 2>&1 || echo "No logs available"`);
    
    res.json({
      success: true,
      logs: stdout
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get container logs',
      details: error.message
    });
  }
});

  // Start/Stop/Restart container
  app.post('/services/docker/container/:id/:action', requireAuth, async (req, res) => {
    try {
      const { id, action } = req.params;
      const validActions = ['start', 'stop', 'restart', 'pause', 'unpause'];
      
      if (!validActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
      }

      await execAsync(`docker ${action} ${id}`);
      res.json({
        success: true,
        message: `Container ${action}ed successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to ${action} container`,
        details: error.message
      });
    }
  });

  // Get Docker images
  app.get('/services/docker/images', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('docker images --format "{{json .}}" | jq -s .');
      res.json({
        success: true,
        images: JSON.parse(stdout)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get images',
        details: error.message
      });
    }
  });

  // Pull Docker image
  app.post('/services/docker/images/pull', requireAuth, async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Image name is required'
        });
      }

      const { stdout } = await execAsync(`docker pull ${image}`);
      res.json({
        success: true,
        message: `Image ${image} pulled successfully`,
        output: stdout
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to pull image',
        details: error.message
      });
    }
  });

  // Delete Docker Images
  app.delete('/services/docker/images/remove', requireAuth, async (req, res) => {
    try {
      const { image } = req.query;
      if (!image) {
        return res.status(400).json({ error: 'Image name is required' });
      }

      const { exec } = require('child_process');
      exec(`docker rmi ${image}`, (error, stdout, stderr) => {
        if (error) {
          return res.status(500).json({ error: stderr });
        }
        res.json({ message: `Image ${image} removed successfully` });
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Docker networks
  app.get('/services/docker/networks', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('docker network ls --format "{{json .}}" | jq -s .');
      res.json({
        success: true,
        networks: JSON.parse(stdout)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get networks',
        details: error.message
      });
    }
  });

  // Get Docker volumes
  app.get('/services/docker/volumes', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('docker volume ls --format "{{json .}}" | jq -s .');
      res.json({
        success: true,
        volumes: JSON.parse(stdout)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get volumes',
        details: error.message
      });
    }
  });

  // Get Docker compose files
  app.get('/services/docker/compose', requireAuth, async (req, res) => {
    try {
      await fs.mkdir(DOCKER_COMPOSE_DIR, { recursive: true });
      const files = await fs.readdir(DOCKER_COMPOSE_DIR);
      res.json({
        success: true,
        files: files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get compose files',
        details: error.message
      });
    }
  });

  // Deploy Docker compose file
  app.post('/services/docker/compose/deploy', requireAuth, async (req, res) => {
    try {
      const { file } = req.body;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'File name is required'
        });
      }

      const filePath = path.join(DOCKER_COMPOSE_DIR, file);
      const { stdout } = await execAsync(`docker compose -f ${filePath} up -d`);
      res.json({
        success: true,
        message: `Compose file ${file} deployed successfully`,
        output: stdout
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to deploy compose file',
        details: error.message
      });
    }
  });
  
// Docker Compose endpoints
app.get('/services/docker/compose/:filename', requireAuth, async (req, res) => {
  try {
    const filePath = path.join(DOCKER_COMPOSE_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf8');
    res.json({
      success: true,
      content
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to read compose file'
    });
  }
});

app.post('/services/docker/compose_add', requireAuth, async (req, res) => {
  try {
    const { filename, content } = req.body;
    console.log(req.body);
    const filePath = path.join(DOCKER_COMPOSE_DIR, filename);
    await fs.writeFile(filePath, content, 'utf8');
    res.json({
      success: true,
      message: 'Compose file saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to save compose file'
    });
  }
});

app.put('/services/docker/compose/:filename', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const filePath = path.join(DOCKER_COMPOSE_DIR, req.params.filename);
    await fs.writeFile(filePath, content, 'utf8');
    res.json({
      success: true,
      message: 'Compose file updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update compose file'
    });
  }
});

app.delete('/services/docker/compose/:filename', requireAuth, async (req, res) => {
  try {
    const filePath = path.join(DOCKER_COMPOSE_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({
      success: true,
      message: 'Compose file deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete compose file'
    });
  }
});

// Docker Networks endpoints
app.post('/services/docker/networks', requireAuth, async (req, res) => {
  try {
    const { name, driver, attachable } = req.body;
    const { stdout } = await execAsync(
      `docker network create ${attachable ? '--attachable' : ''} --driver ${driver} ${name}`
    );
    res.json({
      success: true,
      message: 'Network created successfully',
      id: stdout.trim()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create network'
    });
  }
});

app.delete('/services/docker/networks/:id', requireAuth, async (req, res) => {
  try {
    await execAsync(`docker network rm ${req.params.id}`);
    res.json({
      success: true,
      message: 'Network deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete network'
    });
  }
});

app.get('/services/docker/networks/:id/inspect', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker network inspect ${req.params.id}`);
    res.json({
      success: true,
      data: JSON.parse(stdout)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to inspect network'
    });
  }
});

// Docker Volumes endpoints
app.post('/services/docker/volumes', requireAuth, async (req, res) => {
  try {
    const { name, driver, driver_opts } = req.body;
    let cmd = `docker volume create --driver ${driver}`;
    
    if (name) cmd += ` --name ${name}`;
    if (driver_opts) {
      for (const [key, value] of Object.entries(driver_opts)) {
        cmd += ` --opt ${key}=${value}`;
      }
    }
    
    const { stdout } = await execAsync(cmd);
    res.json({
      success: true,
      message: 'Volume created successfully',
      name: stdout.trim()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create volume'
    });
  }
});

app.delete('/services/docker/volumes/:name', requireAuth, async (req, res) => {
  try {
    await execAsync(`docker volume rm ${req.params.name}`);
    res.json({
      success: true,
      message: 'Volume deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete volume'
    });
  }
});

app.get('/services/docker/volumes/:name/inspect', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync(`docker volume inspect ${req.params.name}`);
    res.json({
      success: true,
      data: JSON.parse(stdout)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to inspect volume'
    });
  }
});

function validateContainerId(req, res, next) {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid container ID format'
    });
  }
  next();
}

app.get('/services/docker/stats/container/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stream } = req.query;
    
    // Validate container ID
    if (!/^[a-f0-9]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid container ID' });
    }

    // Use modern docker stats format
    const command = `docker stats ${id} --no-stream --format "{{.ID}},{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}"`;
    
    const { stdout } = await execAsync(command, { timeout: 5000 });
    
    // Parse the output
    const [
      containerId,
      name,
      cpuPerc,
      memUsage,
      memPerc,
      netIO,
      blockIO
    ] = stdout.split(',');
    
    res.json({
      success: true,
      stats: {
        ID: containerId,
        Name: name,
        CPUPerc: cpuPerc,
        MemUsage: memUsage,
        MemPerc: memPerc,
        NetIO: netIO,
        BlockIO: blockIO
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get container stats',
      details: error.message,
      commandError: error.stderr
    });
  }
});

app.post('/services/docker/container/:id/restart', requireAuth, validateContainerId, async (req, res) => {
  try {
    await execAsync(`docker restart ${req.params.id}`);
    res.json({
      success: true,
      message: 'Container restarted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to restart container'
    });
  }
});

app.delete('/services/docker/container/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { removeVolumes, removeImage, force } = req.query;

  try {
    // 1. Zatrzymaj kontener jeśli jest uruchomiony i wymuszamy usunięcie
    if (force) {
      try {
        await exec(`docker stop ${id}`);
      } catch (stopError) {
        console.log('Container already stopped or does not exist');
      }
    }

    if (removeImage) {
      try {
        // Pobierz informacje o kontenerze przed usunięciem
        const containerInfo = await exec(`docker inspect ${id}`);
        const containerData = JSON.parse(containerInfo);

        if (containerData.length > 0 && containerData[0].Image) {
          const imageId = containerData[0].Image;
          await exec(`docker rmi ${imageId}`);
        }
      } catch (imageError) {
        console.error('Error removing image:', imageError);
        // Kontynuuj nawet jeśli nie uda się usunąć obrazu
      }
    }

    // 2. Usuń kontener
    let rmCommand = `docker rm ${id}`;
    if (removeVolumes) rmCommand += ' -v';
    if (force) rmCommand += ' -f';
    await exec(rmCommand);

    res.json({ success: true, message: 'Container deleted successfully' });
  } catch (error) {
    console.error('Error deleting container:', error);
    res.status(500).json({ 
      error: 'Failed to delete container',
      details: error.message 
    });
  }
});

// Auto Update Endpoints
app.get('/services/docker/auto-update', requireAuth, async (req, res) => {
  try {
    const configPath = path.join(DOCKER_COMPOSE_DIR, 'auto-update.json');
    
    // Try to read existing config
    let config = {
      enabled: false,
      schedule: 'weekly',
      time: '02:00',
      images: []
    };
    
    try {
      const data = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, use defaults
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-update settings'
    });
  }
});

app.post('/services/docker/auto-update', requireAuth, async (req, res) => {
  try {
    const { enabled, schedule, time, images } = req.body;
    const configPath = path.join(DOCKER_COMPOSE_DIR, 'auto-update.json');
    
    // Validate input
    if (!['daily', 'weekly', 'monthly'].includes(schedule)) {
      return res.status(400).json({ error: 'Invalid schedule' });
    }
    
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    // Save config
    const config = {
      enabled: Boolean(enabled),
      schedule,
      time,
      images: Array.isArray(images) ? images : []
    };
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    // If enabling, schedule the job
    if (enabled) {
      scheduleAutoUpdates(config);
    }
    
    res.json({
      success: true,
      message: 'Auto-update settings saved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to save auto-update settings'
    });
  }
});

app.get('/services/docker/auto-update/check', requireAuth, async (req, res) => {
  try {
    // Get current images
    const { stdout } = await execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
    const currentImages = stdout.trim().split('\n');
    
    // Check for updates
    const updates = [];
    for (const image of currentImages) {
      try {
        // Skip <none> images
        if (image.includes('<none>')) continue;
        
        // Get current digest
        const { stdout: inspect } = await execAsync(`docker inspect --format='{{.Id}}' ${image}`);
        const currentDigest = inspect.trim();
        
        // Pull without actually downloading
        await execAsync(`docker pull --quiet --disable-content-trust ${image}`);
        
        // Get new digest
        const { stdout: inspectNew } = await execAsync(`docker inspect --format='{{.Id}}' ${image}`);
        const newDigest = inspectNew.trim();
        
        if (currentDigest !== newDigest) {
          updates.push({
            image,
            currentDigest: currentDigest.substring(0, 12),
            newDigest: newDigest.substring(0, 12)
          });
        }
      } catch (e) {
        console.error(`Error checking updates for ${image}:`, e);
      }
    }
    
    res.json({
      success: true,
      updates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check for updates'
    });
  }
});

// Registry Endpoints
app.get('/services/docker/registry/list', requireAuth, async (req, res) => {
  try {
    // 1. Pobierz informacje o zużyciu dysku
    let diskUsage = {};
    try {
      const { stdout } = await execAsync('docker system df --format "{{json .}}"');
      if (stdout.trim()) {
        diskUsage = stdout.trim();
      }
    } catch (diskError) {
      console.error('Error getting disk usage:', diskError);
    }

    // 2. Pobierz listę zalogowanych rejestrów
    let registries = [];
    try {
      // Sprawdź czy plik config.json istnieje
      const configPath = path.join(os.homedir(), '.docker/config.json');
      await fs.access(configPath);

      // Odczytaj konfigurację Docker
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);

      if (config.auths) {
        registries = Object.entries(config.auths).map(([server, authData]) => {
          let username = 'unknown';
          try {
            // Dekoduj dane uwierzytelniające
            const authString = Buffer.from(authData.auth, 'base64').toString();
            username = authString.split(':')[0];
          } catch (authError) {
            console.error('Error decoding auth data:', authError);
          }
          
          return {
            server,
            username,
            authConfigured: true
          };
        });
      }

      // Dodaj Docker Hub jeśli nie ma go w konfiguracji
      if (!registries.some(r => r.server.includes('docker.io'))) {
        registries.push({
          server: 'https://index.docker.io/v2/',
          username: 'anonymous',
          authConfigured: false
        });
      }
    } catch (configError) {
      console.error('Error reading docker config:', configError);
      // Zwróć domyślny Docker Hub jeśli plik nie istnieje
      registries.push({
        server: 'https://index.docker.io/v2/',
        username: 'anonymous',
        authConfigured: false
      });
    }

    res.json({
      success: true,
      registries,
      diskUsage
    });

  } catch (error) {
    console.error('Registry list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list registries',
      details: error.message
    });
  }
});

app.post('/services/docker/registry/login', requireAuth, async (req, res) => {
  try {
    const { server, username, password } = req.body;
    
    if (!server || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Execute docker login
    const { stdout } = await execAsync(
      `docker login --username ${username} --password ${password} ${server}`,
      { input: password }
    );
    
    res.json({
      success: true,
      message: stdout || 'Logged in successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: error.stderr || error.message
    });
  }
});

// Helper function to schedule auto updates
function scheduleAutoUpdates(config) {
  // Clear existing job if any
  if (global.autoUpdateJob) {
    clearInterval(global.autoUpdateJob);
  }
  
  // Calculate interval based on schedule
  let interval;
  switch (config.schedule) {
    case 'daily':
      interval = 24 * 60 * 60 * 1000;
      break;
    case 'weekly':
      interval = 7 * 24 * 60 * 60 * 1000;
      break;
    case 'monthly':
      interval = 30 * 24 * 60 * 60 * 1000; // Approximate
      break;
    default:
      interval = 24 * 60 * 60 * 1000;
  }
  
  // Schedule the job
  global.autoUpdateJob = setInterval(async () => {
    try {
      console.log('Running scheduled image updates...');
      
      // Update each image
      for (const image of config.images) {
        try {
          await execAsync(`docker pull ${image}`);
          console.log(`Successfully updated ${image}`);
          
          // Restart containers using this image
          const { stdout: containers } = await execAsync(
            `docker ps --filter ancestor=${image} --format "{{.ID}}"`
          );
          
          if (containers.trim()) {
            const containerIds = containers.trim().split('\n');
            for (const id of containerIds) {
              await execAsync(`docker restart ${id}`);
              console.log(`Restarted container ${id}`);
            }
          }
        } catch (e) {
          console.error(`Failed to update ${image}:`, e);
        }
      }
    } catch (error) {
      console.error('Auto-update job failed:', error);
    }
  }, interval);
  
  // Run immediately if it's time
  const now = new Date();
  const [hours, minutes] = config.time.split(':').map(Number);
  const nextRun = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes
  );
  
  if (now > nextRun) {
    setTimeout(() => {
      global.autoUpdateJob._onTimeout();
    }, 10000); // Run in 10 seconds
  }
}

app.get('/services/docker/images/inspect/:imageId', requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Walidacja ID obrazu
    if (!/^[a-f0-9]+$/.test(imageId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid image ID format' 
      });
    }

    // Pobierz szczegółowe informacje o obrazie
    const { stdout } = await execAsync(`docker inspect ${imageId}`);
    
    res.json({
      success: true,
      data: JSON.parse(stdout)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to inspect image',
      details: error.message,
      commandError: error.stderr
    });
  }
});

app.get('/services/docker/composer/deploy-stream', requireAuth, async (req, res) => {
  const { file } = req.query;
  
  if (!file) {
    return res.status(400).json({ error: 'File parameter is required' });
  }

  const filePath = path.join(DOCKER_COMPOSE_DIR, file);
  
  // Ustaw nagłówki dla strumieniowania SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Uruchom proces docker compose
  const child = exec(`docker compose -f ${filePath} up -d`);

  // Funkcja do wysyłania danych w formacie SSE
  const sendEvent = (data) => {
    // Normalizuj znaki nowej linii i dodaj znacznik czasu
    const normalizedData = data
      .replace(/\r?\n/g, '\r\n') // Zamień wszystkie rodzaje nowych linii na \r\n
      .replace(/\r\n/g, '\n')    // Tymczasowo na \n
      .replace(/\n/g, '\r\n');   // Potem na \r\n (dla spójności)

    res.write(`data: ${JSON.stringify({ 
      message: normalizedData,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  child.stdout.on('data', (data) => {
    sendEvent(data.toString());
  });

  child.stderr.on('data', (data) => {
    sendEvent(data.toString());
  });

  child.on('close', (code) => {
    sendEvent(`\nProcess exited with code ${code}\n`);
    res.end();
  });

  // Obsługa zamknięcia połączenia przez klienta
  req.on('close', () => {
    child.kill();
    res.end();
  });
});

// Backup endpoints
app.post('/services/docker/backup', requireAuth, async (req, res) => {
  try {
    const { location, includes } = req.body;
    
    // Walidacja wejścia
    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'Invalid backup location' });
    }
    
    // Utwórz katalog backupu jeśli nie istnieje
    await fs.mkdir(location, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFiles = [];
    
    // 1. Backup woluminów
    if (includes.includes('volumes')) {
      const volumesBackupFile = `volumes-${timestamp}.tar.gz`;
      const volumesBackupPath = path.join(location, volumesBackupFile);
      
      const volumes = await docker.listVolumes();
      if (volumes.Volumes.length > 0) {
        const volumeMounts = volumes.Volumes.map(v => `-v ${v.Name}:/volumes/${v.Name}`).join(' ');
        
        await execAsync(
          `docker run --rm ${volumeMounts} ` +
          `-v ${location}:/backup ` +
          `alpine sh -c "tar -czf /backup/${volumesBackupFile} -C /volumes ."`
        );
        
        backupFiles.push(volumesBackupFile);
      }
    }
    
    // 2. Backup compose files
    if (includes.includes('compose')) {
      const composeBackupFile = `compose-${timestamp}.tar.gz`;
      const composeBackupPath = path.join(location, composeBackupFile);
      
      await require('tar').create({
        file: composeBackupPath,
        cwd: DOCKER_COMPOSE_DIR,
        gzip: true
      }, await fs.readdir(DOCKER_COMPOSE_DIR));
      
      backupFiles.push(composeBackupFile);
    }
    
    // 3. Backup konfiguracji kontenerów
    const containersBackupFile = `containers-${timestamp}.json`;
    const containers = await docker.listContainers({ all: true });
    
    const containersConfig = await Promise.all(
      containers.map(async c => {
        const container = docker.getContainer(c.Id);
        const inspectData = await container.inspect();
        return {
          id: c.Id,
          name: c.Names[0].replace(/^\//, ''),
          config: {
            Image: inspectData.Config.Image,
            Env: inspectData.Config.Env,
            Cmd: inspectData.Config.Cmd,
            Labels: inspectData.Config.Labels,
            HostConfig: {
              Binds: inspectData.HostConfig.Binds,
              PortBindings: inspectData.HostConfig.PortBindings
            }
          }
        };
      })
    );
    
    await fs.writeFile(
      path.join(location, containersBackupFile),
      JSON.stringify(containersConfig, null, 2)
    );
    backupFiles.push(containersBackupFile);
    
    res.json({
      success: true,
      message: 'Backup completed successfully',
      files: backupFiles,
      location
    });
    
  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Backup failed',
      details: error.message
    });
  }
});

app.get('/services/docker/backup/list', requireAuth, async (req, res) => {
  try {
    // Default backup location or use from config if available
    const backupLocation = '/var/backups/docker';
    
    // Create directory if it doesn't exist
    await fs.mkdir(backupLocation, { recursive: true });
    
    // List backup files with details
    const files = await fs.readdir(backupLocation);
    const filesWithStats = await Promise.all(
      files.map(async file => {
        const stats = await fs.stat(path.join(backupLocation, file));
        return {
          name: file,
          date: stats.mtime.toISOString(),
          size: formatFileSize(stats.size),
          path: path.join(backupLocation, file)
        };
      })
    );
    
    // Sort by date (newest first)
    filesWithStats.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({
      success: true,
      files: filesWithStats
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list backup files',
      details: error.message
    });
  }
});

// Helper function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.post('/services/docker/backup/restore', requireAuth, async (req, res) => {
  try {
    const { file } = req.body;
    const backupDir = '/var/backups/docker'; // Domyślna lokalizacja
    
    // 1. Wczytaj metadane backupu
    const metaFile = path.join(backupDir, file.replace(/\.tar$/, '.json'));
    const metaData = JSON.parse(await fs.readFile(metaFile, 'utf8'));
    
    // 2. Przywróć woluminy (jeśli istnieją w backupie)
    const volumesBackupFile = path.join(backupDir, file.replace(/meta-/, 'volumes-').replace(/\.json$/, '.tar'));
    if (await fs.access(volumesBackupFile).then(() => true).catch(() => false)) {
      await require('tar').extract({
        file: volumesBackupFile,
        cwd: '/var/lib/docker/volumes',
        preservePaths: true
      });
    }
    
    // 3. Przywróć compose files (jeśli istnieją w backupie)
    const composeBackupFile = path.join(backupDir, file.replace(/meta-/, 'compose-').replace(/\.json$/, '.tar'));
    if (await fs.access(composeBackupFile).then(() => true).catch(() => false)) {
      await require('tar').extract({
        file: composeBackupFile,
        cwd: DOCKER_COMPOSE_DIR,
        preservePaths: true
      });
    }
    
    // 4. Przywróć kontenery
    for (const containerBackup of metaData.containers) {
      try {
        // Usuń istniejący kontener jeśli istnieje
        try {
          const existingContainer = docker.getContainer(containerBackup.id);
          await existingContainer.stop();
          await existingContainer.remove();
        } catch (e) {
          console.log(`Container ${containerBackup.name} not found, creating new`);
        }
        
        // Utwórz nowy kontener z backupu
        await docker.createContainer({
          name: containerBackup.name,
          ...containerBackup.config
        });
      } catch (error) {
        console.error(`Failed to restore container ${containerBackup.name}:`, error);
      }
    }
    
    // 5. Uruchom wszystkie kontenery
    const containers = await docker.listContainers({ all: true });
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      if (containerInfo.State !== 'running') {
        await container.start();
      }
    }
    
    res.json({
      success: true,
      message: 'Restore completed successfully'
    });
    
  } catch (error) {
    console.error('Restore failed:', error);
    res.status(500).json({
      success: false,
      error: 'Restore failed',
      details: error.message
    });
  }
});

// Funkcja pomocnicza do ładowania zadań
function loadCronJobs() {
  try {
    if (!fsa.existsSync(CRON_JOBS_FILE)) {
      fsa.writeFileSync(CRON_JOBS_FILE, JSON.stringify([]));
      return [];
    }
    
    const data = fsa.readFileSync(CRON_JOBS_FILE, 'utf8');
    const jobs = JSON.parse(data);
    
    // Inicjalizacja zadań przy starcie
    jobs.forEach(job => {
      scheduleJob(job);
    });
    
    return jobs;
  } catch (error) {
    console.error('Error loading cron jobs:', error);
    return [];
  }
}

// Funkcja zapisująca zadania do pliku
function saveCronJobs() {
  try {
    const jobsToSave = Array.from(cronJobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description,
      type: job.type,
      location: job.location,
      includes: job.includes
    }));

    fsa.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobsToSave, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving cron jobs:', error);
    return false;
  }
}

// Funkcja planująca zadanie
function scheduleJob(jobConfig) {
  // Usuń istniejące zadanie jeśli istnieje
  if (cronJobs.has(jobConfig.id)) {
    cronJobs.get(jobConfig.id).task.stop();
    cronJobs.delete(jobConfig.id);
  }

  // Utwórz nowe zadanie cron
  const task = cron.schedule(jobConfig.schedule, () => {
    console.log(`Executing job: ${jobConfig.name}`);
    executeDockerBackup(jobConfig);
  }, {
    scheduled: true,
    timezone: 'Europe/Warsaw'
  });

  // Zapisz referencję do zadania
  cronJobs.set(jobConfig.id, {
    ...jobConfig,
    task
  });
}

// Funkcja wykonująca backup Dockera
async function executeDockerBackup(job) {
  try {
    // Validate job configuration
    if (!job || !job.includes || !Array.isArray(job.includes)) {
      throw new Error('Invalid job configuration - missing includes array');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = job.location || '/var/backups/docker';
    const backupFile = path.join(backupDir, `docker-backup-${timestamp}.tar.gz`);
    
    // Create directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });

    // Backup commands
    const commands = [];
    
    if (job.includes.includes('compose')) {
      commands.push(`tar -czf ${backupFile} ${DOCKER_COMPOSE_DIR}`);
    }
    
    if (job.includes.includes('volumes')) {
      const volumeBackup = path.join(backupDir, `volumes-${timestamp}.tar.gz`);
      const { stdout: volumes } = await execAsync('docker volume ls -q');
      if (volumes.trim()) {
        const volumeList = volumes.trim().split('\n');
        commands.push(`docker run --rm -v ${volumeBackup}:/backup ${volumeList.map(v => `-v ${v}:/volume/${v}`).join(' ')} alpine tar -czf /backup /volume`);
      }
    }

    // Execute commands
    for (const cmd of commands) {
      await execAsync(cmd);
    }
    
    console.log(`Backup completed: ${backupFile}`);
  } catch (error) {
    console.error('Backup failed:', error);
  }
}

// Endpoint do planowania backupów
app.post('/services/docker/backup/schedule', requireAuth, (req, res) => {
  try {
    const { schedule, location, includes, name } = req.body;
    
    // Validation
    if (!cron.validate(schedule)) {
      return res.status(400).json({ error: 'Invalid cron schedule' });
    }
    
    if (!Array.isArray(includes) || includes.length === 0) {
      return res.status(400).json({ error: 'Please select at least one backup option' });
    }

    // Utwórz konfigurację zadania
    const jobConfig = {
      id: `backup_${Date.now()}`,
      name: name || 'Docker Backup',
      type: 'docker-backup',
      schedule,
      location: location || '/var/backups/docker',
      includes: Array.isArray(includes) ? includes : [],
      description: 'Automatic Docker backup job'
    }; 

    // Zaplanuj i zapisz zadanie
    scheduleJob(jobConfig);
    saveCronJobs();

    res.json({
      success: true,
      jobId: jobConfig.id,
      message: 'Backup scheduled successfully',
      nextRun: getNextRunTime(schedule)
    });

  } catch (error) {
    console.error('Error scheduling backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule backup',
      details: error.message
    });
  }
});

// Helper do obliczania następnego wykonania
function getNextRunTime(cronExpr) {
  const schedule = cronParser.CronExpressionParser.parse(cronExpr);
  return schedule.next().toISOString();
}

// Endpoint do listy zaplanowanych zadań
app.get('/services/docker/backup/schedules', requireAuth, (req, res) => {
  try {
    const jobs = Array.from(cronJobs.values())
      .filter(job => job.type === 'docker-backup')
      .map(job => ({
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        location: job.location,
        includes: job.includes,
        nextRun: getNextRunTime(job.schedule),
        description: job.description
      }));

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduled jobs'
    });
  }
});

app.delete('/services/docker/backup/schedule/:jobId', requireAuth, (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if job exists
    if (!cronJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        error: 'Backup job not found'
      });
    }

    // Stop the cron job
    const job = cronJobs.get(jobId);
    job.task.stop();

    // Remove from memory
    cronJobs.delete(jobId);

    // Update the stored jobs
    saveCronJobs();

    res.json({
      success: true,
      message: 'Backup schedule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting backup schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup schedule',
      details: error.message
    });
  }
});

app.get('/services/docker/container/status/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { stdout } = await execPromise(
      `sudo docker ps -a --filter "name=${name}" --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}'`
    );

    if (!stdout.trim()) {
      return res.json({ 
        status: 'not_found',
        message: 'Container not found'
      });
    }

    // Przetwarzanie wyniku
    const containers = stdout.trim().split('\n')
      .map(line => {
        const [id, names, status, image] = line.split('|');
        return { id, names, status, image };
      });

    // Znajdź kontener którego szukamy (może być wiele gdy używamy compose)
    const container = containers.find(c => 
      c.names.includes(name) || 
      c.names.includes(`docker-compose-${name}-`)
    );

    if (!container) {
      return res.json({ status: 'not_found' });
    }

    // Uproszczona logika statusu
    const normalizedStatus = container.status.toLowerCase().includes('up') 
      ? 'running' 
      : 'stopped';

    res.json({
      status: normalizedStatus,
      rawStatus: container.status,
      containerName: container.names,
      image: container.image
    });

  } catch (error) {
    console.error('Error checking container status:', error);
    res.status(500).json({ 
      error: 'Failed to check container status',
      details: error.message
    });
  }
});

app.get('/api/services/config', async (req, res) => {
  try {
    const { service, filePath } = req.query;
    
    if (!service || !filePath) {
      return res.status(400).json({ error: 'Service name and file path are required' });
    }

    // Bezpieczna ścieżka - zapobiega atakom directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = `/opt/nas-panel/docker-compose/${safePath}`;
    
    const content = await fsa.readFileSync(fullPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zapisywanie pliku i restart usługi
app.put('/api/services/config', async (req, res) => {
  try {
    const { service, filePath, content } = req.body;
    
    if (!service || !filePath || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Walidacja YAML
    YAML.parse(content);

    // Bezpieczna ścieżka
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = `/opt/nas-panel/docker-compose/${safePath}`;
    
    // Backup starego pliku
    const backupPath = `${fullPath}.bak_${Date.now()}`;
    await fsa.copyFileSync(fullPath, backupPath);
    
    // Zapis nowej zawartości
    await fsa.writeFileSync(fullPath, content);
    
    // Restart usługi
    await execPromise(`docker compose -f /opt/nas-panel/docker-compose/${safePath} down`);
    await execPromise(`docker compose -f /opt/nas-panel/docker-compose/${safePath} up -d`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pobierz konfigurację kontenera
app.get('/services/docker/container/:id/config', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const inspectData = await container.inspect();
    
    // Przekształć dane inspect na nasz format
    const config = {
      name: inspectData.Name.replace(/^\//, ''),
      image: inspectData.Config.Image,
      command: inspectData.Config.Cmd ? inspectData.Config.Cmd.join(' ') : '',
      ports: inspectData.HostConfig.PortBindings ? 
        Object.entries(inspectData.HostConfig.PortBindings).map(([containerPort, hostConfig]) => ({
          host: hostConfig[0].HostPort,
          container: containerPort.split('/')[0],
          protocol: containerPort.split('/')[1] || 'tcp'
        })) : [],
      volumes: inspectData.HostConfig.Binds ? 
        inspectData.HostConfig.Binds.map(bind => {
          const [host, container, mode] = bind.split(':');
          return {
            host,
            container,
            mode: mode || 'rw'
          };
        }) : [],
      env: inspectData.Config.Env ? 
        inspectData.Config.Env.map(env => {
          const [key, ...value] = env.split('=');
          return {
            key,
            value: value.join('=')
          };
        }) : []
    };

    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zaktualizuj konfigurację kontenera
app.put('/services/docker/container/:id/config', async (req, res) => {
  try {
    const { config } = req.body;
    const container = docker.getContainer(req.params.id);
    
    // Zatrzymaj kontener przed aktualizacją
    await container.stop();
    
    // Usuń stary kontener
    await container.remove();
    
    // Utwórz nowy kontener z nową konfiguracją
    const newContainer = await docker.createContainer({
      Image: config.image,
      name: config.name,
      Cmd: config.command ? config.command.split(' ') : null,
      Env: config.env.map(e => `${e.key}=${e.value}`),
      HostConfig: {
        PortBindings: config.ports.reduce((acc, port) => {
          acc[`${port.container}/${port.protocol}`] = [{ HostPort: port.host }];
          return acc;
        }, {}),
        Binds: config.volumes.map(v => `${v.host}:${v.container}:${v.mode}`)
      }
    });
    
    // Uruchom nowy kontener
    await newContainer.start();
    
    res.json({ message: 'Container updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/services/docker/images/search', async (req, res) => {
  try {
    const images = await docker.listImages();
    const searchTerm = req.query.q.toLowerCase();
    
    const filteredImages = images
      .filter(img => 
        img.RepoTags && 
        img.RepoTags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
      .flatMap(img => img.RepoTags)
      .filter(tag => tag !== '<none>:<none>');
    
    res.json({ images: filteredImages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicjalizacja przy starcie
loadCronJobs();
};
