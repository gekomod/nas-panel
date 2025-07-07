const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const DOCKER_COMPOSE_DIR = path.join(__dirname, '../docker-compose');

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

};
