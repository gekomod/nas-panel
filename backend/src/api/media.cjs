const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const Docker = require('dockerode');
const path = require('path');
const axios = require('axios');

module.exports = function(app, requireAuth) {
  const docker = new Docker();

  // Service definitions with API endpoints
  const services = {
    emby: {
      name: 'Emby',
      icon: 'mdi:emby',
      systemService: 'emby-server',
      ports: [8096],
      configPath: '/etc/emby-server',
      dockerImage: 'emby/embyserver',
      apiKeyPath: '/etc/emby-server/api.key',
      apiUrl: 'http://localhost:8096/emby',
      apiHeaders: {}
    },
    jellyfin: {
      name: 'Jellyfin',
      icon: 'mdi:jellyfin',
      systemService: 'jellyfin',
      ports: [8096],
      configPath: '/etc/jellyfin',
      dockerImage: 'jellyfin/jellyfin',
      apiKeyPath: '/etc/jellyfin/api.key',
      apiUrl: 'http://localhost:8096',
      apiHeaders: {}
    },
    plex: {
      name: 'Plex',
      icon: 'mdi:plex',
      systemService: 'plexmediaserver',
      ports: [32400],
      configPath: '/etc/plex',
      dockerImage: 'plexinc/pms-docker',
      tokenPath: '/etc/plex/token',
      apiUrl: 'http://localhost:32400',
      apiHeaders: {}
    }
  };

  // Helper function to ensure directory exists
  function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Helper to get API key/token
  async function getServiceAuth(serviceId, config) {
    try {
      if (serviceId === 'plex') {
        if (fs.existsSync(config.tokenPath)) {
          const token = fs.readFileSync(config.tokenPath, 'utf8').trim();
          config.apiHeaders = {
            'X-Plex-Token': token,
            'Accept': 'application/json'
          };
        }
      } else {
        if (fs.existsSync(config.apiKeyPath)) {
          const apiKey = fs.readFileSync(config.apiKeyPath, 'utf8').trim();
          config.apiHeaders = {
            'X-Emby-Token': apiKey,
            'Accept': 'application/json'
          };
        }
      }
    } catch (error) {
      console.log(`Failed to load auth for ${serviceId}:`, error.message);
    }
    return config;
  }

  // Get service status
  app.get('/api/media/:serviceId/status', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const status = await detectService(serviceId, serviceConfig);
      res.json(status);
    } catch (error) {
      console.error(`Error getting status for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function detectService(serviceId, config) {
    const result = {
      installed: false,
      running: false,
      installationType: null,
      version: null,
      port: config.ports[0],
      containerId: null,
      url: null,
      uptime: null
    };

    // Check Docker first
    try {
      const containers = await docker.listContainers({ all: true });
      const container = containers.find(c => 
        c.Names.some(n => n.includes(serviceId)) ||
        c.Image.includes(serviceId) ||
        c.Image.includes(config.dockerImage)
      );

      if (container) {
        result.installed = true;
        result.running = container.State === 'running';
        result.installationType = 'docker';
        result.containerId = container.Id;
        
        // Get port mapping
        const portMapping = container.Ports.find(p => config.ports.includes(p.PrivatePort));
        if (portMapping) {
          result.port = portMapping.PublicPort || config.ports[0];
        }
        
        result.url = `http://localhost:${result.port}`;
        
        // Get uptime from container
        if (result.running) {
          const containerInfo = await docker.getContainer(container.Id).inspect();
          const startedAt = new Date(containerInfo.State.StartedAt);
          const now = new Date();
          const uptimeMs = now - startedAt;
          result.uptime = formatUptime(uptimeMs);
          
          // Get version from container
          try {
            const execInstance = await docker.getContainer(container.Id).exec({
              Cmd: serviceId === 'plex' ? 
                ['/usr/lib/plexmediaserver/Plex\\ Media\\ Server', '--version'] :
                [serviceId, '--version'],
              AttachStdout: true,
              AttachStderr: true
            });
            
            const stream = await execInstance.start({});
            let versionOutput = '';
            stream.on('data', chunk => {
              versionOutput += chunk.toString();
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const match = versionOutput.match(/([\d.]+)/);
            if (match) result.version = match[1];
          } catch (err) {
            // Fallback to image tag
            const image = container.Image;
            const tagMatch = image.match(/:([\d.]+)/);
            if (tagMatch) result.version = tagMatch[1];
          }
        }
      }
    } catch (error) {
      console.log('Docker check failed:', error.message);
    }

    // Check system service if not found in Docker
    if (!result.installed) {
      try {
        const { stdout } = await execAsync(`systemctl is-active ${config.systemService} 2>/dev/null || echo "inactive"`);
        const isActive = stdout.trim() === 'active';
        
        if (isActive || fs.existsSync(config.configPath)) {
          result.installed = true;
          result.running = isActive;
          result.installationType = 'system';
          result.url = `http://localhost:${config.ports[0]}`;
          
          // Get uptime for system service
          if (isActive) {
            const { stdout: uptimeStdout } = await execAsync(`systemctl show ${config.systemService} --property=ActiveEnterTimestamp`);
            const match = uptimeStdout.match(/ActiveEnterTimestamp=(.*)/);
            if (match) {
              const startedAt = new Date(match[1]);
              const now = new Date();
              const uptimeMs = now - startedAt;
              result.uptime = formatUptime(uptimeMs);
            }
            
            // Get version
            try {
              const { stdout: versionStdout } = await execAsync(`${serviceId} --version 2>/dev/null || echo ""`);
              const match = versionStdout.match(/([\d.]+)/);
              if (match) result.version = match[1];
            } catch (err) {
              // Version check failed
            }
          }
        }
      } catch (error) {
        console.log('System service check failed:', error.message);
      }
    }

    // If service is running, verify via API
    if (result.running) {
      try {
        const apiUrl = serviceId === 'plex' ? `${result.url}/` : `${result.url}/System/Info`;
        const response = await axios.get(apiUrl, {
          timeout: 3000,
          headers: serviceId === 'plex' ? 
            { 
              'X-Plex-Token': fs.existsSync(config.tokenPath) ? fs.readFileSync(config.tokenPath, 'utf8').trim() : '',
              'Accept': 'application/json'
            } :
            {}
        });
        
        if (response.data) {
          if (serviceId === 'plex') {
            result.version = response.data.MediaContainer?.version || 'Unknown';
          } else {
            result.version = response.data.Version || response.data.version || 'Unknown';
          }
        }
      } catch (error) {
        // API check failed, but service is still running
        console.log(`API check for ${serviceId} failed:`, error.message);
      }
    }

    return result;
  }

  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Get all services status
  app.get('/api/media/status/all', requireAuth, async (req, res) => {
    try {
      const allStatus = {};
      
      for (const serviceId in services) {
        allStatus[serviceId] = await detectService(serviceId, services[serviceId]);
      }
      
      res.json(allStatus);
    } catch (error) {
      console.error('Error getting all services status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get service configuration
  app.get('/api/media/:serviceId/config', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed) {
        return res.json({
          port: serviceConfig.ports[0],
          bindAddress: '0.0.0.0',
          sslEnabled: false,
          libraryScanInterval: 86400,
          transcodingEnabled: true,
          maxStreams: 5,
          libraryScan: true,
          autoStart: true
        });
      }
      
      // Try to get config from service API
      try {
        const config = await getServiceConfigFromAPI(serviceId, serviceConfig, status);
        res.json(config);
      } catch (apiError) {
        console.log(`API config failed for ${serviceId}:`, apiError.message);
        // Fallback to file config
        const configPath = path.join(serviceConfig.configPath, 'config.json');
        if (fs.existsSync(configPath)) {
          try {
            const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            res.json(configContent);
          } catch (fileError) {
            console.log(`File config failed for ${serviceId}:`, fileError.message);
            // Return default config
            res.json({
              port: status.port || serviceConfig.ports[0],
              bindAddress: '0.0.0.0',
              sslEnabled: false,
              libraryScanInterval: 86400,
              transcodingEnabled: true,
              maxStreams: 5,
              libraryScan: true,
              autoStart: true
            });
          }
        } else {
          // Return default config
          res.json({
            port: status.port || serviceConfig.ports[0],
            bindAddress: '0.0.0.0',
            sslEnabled: false,
            libraryScanInterval: 86400,
            transcodingEnabled: true,
            maxStreams: 5,
            libraryScan: true,
            autoStart: true
          });
        }
      }
    } catch (error) {
      console.error(`Error getting config for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function getServiceConfigFromAPI(serviceId, config, status) {
    if (!status.running) {
      throw new Error('Service not running');
    }
    
    const baseConfig = {
      port: status.port,
      bindAddress: '0.0.0.0',
      sslEnabled: false,
      libraryScanInterval: 86400,
      transcodingEnabled: true,
      maxStreams: 5,
      libraryScan: true,
      autoStart: true
    };
    
    try {
      if (serviceId === 'plex') {
        // Plex doesn't expose config via API easily
        return baseConfig;
        
      } else {
        // Emby/Jellyfin
        // First get API key if not already loaded
        await getServiceAuth(serviceId, config);
        
        const response = await axios.get(`${status.url}/System/Configuration`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        
        const apiConfig = response.data;
        return {
          ...baseConfig,
          port: apiConfig.PublicPort || status.port,
          sslEnabled: apiConfig.EnableHttps || false,
          libraryScanInterval: apiConfig.LibraryMonitorDelay || 86400,
          transcodingEnabled: apiConfig.EnableHardwareEncoding || true,
          maxStreams: apiConfig.MaxActiveEncodings || 5
        };
      }
    } catch (error) {
      console.log(`API config get failed for ${serviceId}:`, error.message);
      throw error;
    }
  }

  // Save service configuration
  app.post('/api/media/:serviceId/config', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const newConfig = req.body;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed) {
        return res.status(404).json({ error: 'Service not installed' });
      }
      
      // Save config to file
      ensureDirectoryExists(serviceConfig.configPath);
      const configPath = path.join(serviceConfig.configPath, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      // Apply config to running service via API if possible
      if (status.running) {
        try {
          await applyConfigToService(serviceId, serviceConfig, status, newConfig);
        } catch (apiError) {
          console.log(`API config apply failed for ${serviceId}:`, apiError.message);
          // Config saved to file, but API update failed
        }
        
        // Restart service if needed
        if (newConfig.restartRequired !== false) {
          if (status.installationType === 'docker' && status.containerId) {
            try {
              const container = docker.getContainer(status.containerId);
              await container.restart();
            } catch (dockerError) {
              console.log(`Docker restart failed for ${serviceId}:`, dockerError.message);
            }
          } else if (status.installationType === 'system') {
            try {
              await execAsync(`systemctl restart ${serviceConfig.systemService}`);
            } catch (systemError) {
              console.log(`System restart failed for ${serviceId}:`, systemError.message);
            }
          }
        }
      }
      
      res.json({ success: true, message: 'Configuration saved' });
    } catch (error) {
      console.error(`Error saving config for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function applyConfigToService(serviceId, config, status, newConfig) {
    if (!status.running) return;
    
    try {
      if (serviceId === 'plex') {
        // Plex API for config is limited
        return;
      } else {
        // Emby/Jellyfin - load API key first
        await getServiceAuth(serviceId, config);
        
        const response = await axios.post(`${status.url}/System/Configuration`, newConfig, {
          headers: config.apiHeaders,
          timeout: 10000
        });
        return response.data;
      }
    } catch (error) {
      console.log(`Apply config API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  // Service actions
  app.post('/api/media/:serviceId/:action', requireAuth, async (req, res) => {
    try {
      const { serviceId, action } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      if (!['start', 'stop', 'restart', 'pause', 'unpause'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      
      if (!status.installed) {
        return res.status(404).json({ error: 'Service not installed' });
      }
      
      if (status.installationType === 'docker' && status.containerId) {
        const container = docker.getContainer(status.containerId);
        
        switch (action) {
          case 'start':
            await container.start();
            break;
          case 'stop':
            await container.stop();
            break;
          case 'restart':
            await container.restart();
            break;
          case 'pause':
            await container.pause();
            break;
          case 'unpause':
            await container.unpause();
            break;
        }
      } else if (status.installationType === 'system') {
        await execAsync(`systemctl ${action} ${serviceConfig.systemService}`);
      }
      
      res.json({ success: true, message: `Service ${action}ed successfully` });
    } catch (error) {
      console.error(`Error performing action ${req.params.action} for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get service logs
  app.get('/api/media/:serviceId/logs', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { lines = 100 } = req.query;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      let logs = '';
      
      if (status.installationType === 'docker' && status.containerId) {
        try {
          const container = docker.getContainer(status.containerId);
          const stream = await container.logs({
            stdout: true,
            stderr: true,
            tail: parseInt(lines),
            timestamps: true,
            follow: false
          });
          logs = stream.toString('utf8');
        } catch (dockerError) {
          logs = `Docker logs error: ${dockerError.message}`;
        }
      } else if (status.installationType === 'system') {
        try {
          const { stdout } = await execAsync(`journalctl -u ${serviceConfig.systemService} -n ${lines} --no-pager`);
          logs = stdout;
        } catch (systemError) {
          logs = `System logs error: ${systemError.message}`;
        }
      } else {
        logs = 'Service not running or logs not available';
      }
      
      res.json({ logs });
    } catch (error) {
      console.error(`Error getting logs for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear service logs
  app.delete('/api/media/:serviceId/logs', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      
      if (status.installationType === 'system') {
        try {
          await execAsync(`journalctl --vacuum-time=1s -u ${serviceConfig.systemService}`);
          res.json({ success: true, message: 'Logs cleared' });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      } else if (status.installationType === 'docker' && status.containerId) {
        try {
          // Restart container to clear logs
          const container = docker.getContainer(status.containerId);
          await container.restart();
          res.json({ success: true, message: 'Service restarted, logs cleared' });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      } else {
        res.json({ success: true, message: 'No logs to clear' });
      }
    } catch (error) {
      console.error(`Error clearing logs for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get service statistics
  app.get('/api/media/:serviceId/stats', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      let stats = {
        cpuPercent: 0,
        memoryPercent: 0,
        memoryUsed: 0,
        memoryTotal: 0,
        activeUsers: [],
        activeStreams: [],
        streamsStats: { directPlay: 0, transcoding: 0 }
      };
      
      // Get Docker container stats if running in Docker
      if (status.running && status.installationType === 'docker' && status.containerId) {
        try {
          const container = docker.getContainer(status.containerId);
          const containerStats = await container.stats({ stream: false });
          
          // Parse Docker stats
          const cpuDelta = containerStats.cpu_stats.cpu_usage.total_usage - containerStats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = containerStats.cpu_stats.system_cpu_usage - containerStats.precpu_stats.system_cpu_usage;
          const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * containerStats.cpu_stats.online_cpus : 0;
          
          const memoryUsed = containerStats.memory_stats.usage || 0;
          const memoryLimit = containerStats.memory_stats.limit || 1;
          const memoryPercent = (memoryUsed / memoryLimit) * 100;
          
          stats.cpuPercent = Math.round(cpuPercent * 10) / 10;
          stats.memoryPercent = Math.round(memoryPercent * 10) / 10;
          stats.memoryUsed = memoryUsed;
          stats.memoryTotal = memoryLimit;
        } catch (dockerError) {
          console.log(`Docker stats failed for ${serviceId}:`, dockerError.message);
        }
      }
      
      // Get active sessions from media server API
      if (status.running) {
        try {
          const sessions = await getActiveSessions(serviceId, serviceConfig, status);
          stats.activeUsers = sessions.users || [];
          stats.activeStreams = sessions.streams || [];
          stats.streamsStats = {
            directPlay: sessions.directPlay || 0,
            transcoding: sessions.transcoding || 0
          };
        } catch (apiError) {
          console.log(`Failed to get sessions for ${serviceId}:`, apiError.message);
        }
      }
      
      res.json(stats);
    } catch (error) {
      console.error(`Error getting stats for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function getActiveSessions(serviceId, config, status) {
    try {
      if (serviceId === 'plex') {
        // Load auth for Plex
        await getServiceAuth(serviceId, config);
        
        const response = await axios.get(`${status.url}/status/sessions`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        
        const sessions = response.data.MediaContainer?.Metadata || [];
        const users = sessions.map(session => ({
          id: session.User?.id || session.sessionId,
          name: session.User?.title || 'Unknown User',
          activity: session.type === 'track' ? 'Listening to music' : 
                   session.type === 'photo' ? 'Viewing photos' : 'Watching video',
          duration: formatDuration(session.duration || 0)
        }));
        
        const streams = sessions.map(session => ({
          id: session.sessionId,
          user: session.User?.title || 'Unknown User',
          quality: session.Stream?.videoResolution || 'Unknown',
          transcoding: session.TranscodeSession ? true : false
        }));
        
        return {
          users,
          streams,
          directPlay: streams.filter(s => !s.transcoding).length,
          transcoding: streams.filter(s => s.transcoding).length
        };
        
      } else {
        // Emby/Jellyfin - load auth first
        await getServiceAuth(serviceId, config);
        
        const response = await axios.get(`${status.url}/Sessions`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        
        const sessions = response.data || [];
        const users = sessions.map(session => ({
          id: session.UserId || session.Id,
          name: session.UserName || 'Unknown User',
          activity: session.NowPlayingItem ? 
                   `Playing ${session.NowPlayingItem.Type}` : 
                   session.PlayState?.IsPaused ? 'Paused' : 'Browsing',
          duration: formatDuration(session.PlayState?.PositionTicks ? session.PlayState.PositionTicks / 10000 : 0)
        }));
        
        const streams = sessions.map(session => ({
          id: session.Id,
          user: session.UserName || 'Unknown User',
          quality: session.TranscodingInfo ? `${session.TranscodingInfo.Height}p` : 'Direct',
          transcoding: session.TranscodingInfo ? true : false
        }));
        
        return {
          users,
          streams,
          directPlay: streams.filter(s => !s.transcoding).length,
          transcoding: streams.filter(s => s.transcoding).length
        };
      }
    } catch (error) {
      console.log(`Get sessions API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Get libraries from service API - FIXED VERSION
  app.get('/api/media/:serviceId/libraries', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed) {
        return res.json([]);
      }
      
      let libraries = [];
      
      if (status.running) {
        try {
          // Get libraries from API
          libraries = await getLibrariesFromAPI(serviceId, serviceConfig, status);
        } catch (apiError) {
          console.log(`API libraries failed for ${serviceId}:`, apiError.message);
          // Fallback to cache
          libraries = await getLibrariesFromCache(serviceId, serviceConfig);
        }
      } else {
        // Get libraries from cache file
        libraries = await getLibrariesFromCache(serviceId, serviceConfig);
      }
      
      res.json(libraries);
    } catch (error) {
      console.error(`Error getting libraries for ${req.params.serviceId}:`, error);
      // Return empty array instead of 500 error
      res.json([]);
    }
  });

  async function getLibrariesFromAPI(serviceId, config, status) {
    try {
      let libraries = [];
      
      if (serviceId === 'plex') {
        // Load auth for Plex
        await getServiceAuth(serviceId, config);
        
        const response = await axios.get(`${status.url}/library/sections`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        
        const sections = response.data.MediaContainer?.Directory || [];
        libraries = sections.map(section => ({
          id: section.key,
          name: section.title || 'Unknown Library',
          type: section.type || 'mixed',
          path: section.Location?.path || section.Location?.[0]?.path || '/media',
          movies: section.leafCount || 0,
          shows: section.leafCount || 0,
          lastScanned: section.updatedAt ? new Date(section.updatedAt * 1000).toISOString() : new Date().toISOString()
        }));
        
      } else {
        // Emby/Jellyfin - load auth first
        await getServiceAuth(serviceId, config);
        
        const response = await axios.get(`${status.url}/Library/VirtualFolders`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        
        const folders = response.data || [];
        libraries = folders.map(folder => ({
          id: folder.ItemId || folder.Name,
          name: folder.Name || 'Unknown Library',
          type: folder.CollectionType?.toLowerCase() || 'mixed',
          path: folder.Locations?.[0] || '/media',
          movies: (folder.CollectionType === 'movies' || folder.CollectionType === 'mixed') ? (folder.RecursiveItemCount || 0) : 0,
          shows: folder.CollectionType === 'tvshows' ? (folder.RecursiveItemCount || 0) : 0,
          lastScanned: folder.LastModified || new Date().toISOString()
        }));
      }
      
      // Cache libraries
      await cacheLibraries(serviceId, config, libraries);
      
      return libraries;
    } catch (error) {
      console.log(`Get libraries API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  async function getLibrariesFromCache(serviceId, config) {
    try {
      const cachePath = path.join(config.configPath, 'libraries.cache.json');
      if (fs.existsSync(cachePath)) {
        const cacheContent = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(cacheContent);
      }
    } catch (error) {
      console.log(`Cache read failed for ${serviceId}:`, error.message);
    }
    return [];
  }

  async function cacheLibraries(serviceId, config, libraries) {
    try {
      ensureDirectoryExists(config.configPath);
      const cachePath = path.join(config.configPath, 'libraries.cache.json');
      fs.writeFileSync(cachePath, JSON.stringify(libraries, null, 2));
    } catch (error) {
      console.log(`Cache write failed for ${serviceId}:`, error.message);
    }
  }

  // Add a new library (via API)
  app.post('/api/media/:serviceId/libraries', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const newLibrary = req.body;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed || !status.running) {
        return res.status(400).json({ error: 'Service not running' });
      }
      
      // Add library via API
      const result = await addLibraryViaAPI(serviceId, serviceConfig, status, newLibrary);
      
      // Clear cache
      await clearLibraryCache(serviceId, serviceConfig);
      
      res.json({ success: true, library: result });
    } catch (error) {
      console.error(`Error adding library for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function addLibraryViaAPI(serviceId, config, status, library) {
    try {
      // Load auth first
      await getServiceAuth(serviceId, config);
      
      if (serviceId === 'plex') {
        // Plex API for adding libraries requires special permissions
        throw new Error('Adding libraries via API not supported for Plex. Use web interface.');
      } else {
        // Emby/Jellyfin
        const response = await axios.post(`${status.url}/Library/VirtualFolders`, {
          Name: library.name,
          CollectionType: library.type === 'movies' ? 'movies' : 
                         library.type === 'tvshows' ? 'tvshows' : 
                         library.type === 'music' ? 'music' : 'mixed',
          RefreshLibrary: true,
          LibraryOptions: {
            PathInfos: [{ Path: library.path }],
            EnablePhotos: library.type === 'photos',
            EnableRealtimeMonitor: true,
            EnableChapterImageExtraction: true,
            ExtractChapterImagesDuringLibraryScan: true,
            DownloadImagesInAdvance: true
          }
        }, {
          headers: config.apiHeaders,
          timeout: 10000
        });
        
        return {
          id: response.data.Id || library.name,
          name: library.name,
          type: library.type,
          path: library.path,
          movies: 0,
          shows: 0,
          lastScanned: new Date().toISOString()
        };
      }
    } catch (error) {
      console.log(`Add library API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  async function clearLibraryCache(serviceId, config) {
    try {
      const cachePath = path.join(config.configPath, 'libraries.cache.json');
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.log(`Clear cache failed for ${serviceId}:`, error.message);
    }
  }

  // Delete a library (via API)
  app.delete('/api/media/:serviceId/libraries/:libraryId', requireAuth, async (req, res) => {
    try {
      const { serviceId, libraryId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed || !status.running) {
        return res.status(400).json({ error: 'Service not running' });
      }
      
      // Delete library via API
      await deleteLibraryViaAPI(serviceId, serviceConfig, status, libraryId);
      
      // Clear cache
      await clearLibraryCache(serviceId, serviceConfig);
      
      res.json({ success: true, message: 'Library deleted successfully' });
    } catch (error) {
      console.error(`Error deleting library for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function deleteLibraryViaAPI(serviceId, config, status, libraryId) {
    try {
      // Load auth first
      await getServiceAuth(serviceId, config);
      
      if (serviceId === 'plex') {
        const response = await axios.delete(`${status.url}/library/sections/${libraryId}`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        return response.data;
      } else {
        const response = await axios.delete(`${status.url}/Library/VirtualFolders`, {
          headers: config.apiHeaders,
          data: { Ids: [libraryId] },
          timeout: 5000
        });
        return response.data;
      }
    } catch (error) {
      console.log(`Delete library API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  // Scan a library (via API)
  app.post('/api/media/:serviceId/libraries/:libraryId/scan', requireAuth, async (req, res) => {
    try {
      const { serviceId, libraryId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed || !status.running) {
        return res.status(400).json({ error: 'Service not running' });
      }
      
      // Scan library via API
      await scanLibraryViaAPI(serviceId, serviceConfig, status, libraryId);
      
      res.json({ success: true, message: 'Library scan initiated' });
    } catch (error) {
      console.error(`Error scanning library for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  async function scanLibraryViaAPI(serviceId, config, status, libraryId) {
    try {
      // Load auth first
      await getServiceAuth(serviceId, config);
      
      if (serviceId === 'plex') {
        const response = await axios.get(`${status.url}/library/sections/${libraryId}/refresh`, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        return response.data;
      } else {
        const response = await axios.post(`${status.url}/Library/Refresh`, {
          Ids: [libraryId]
        }, {
          headers: config.apiHeaders,
          timeout: 5000
        });
        return response.data;
      }
    } catch (error) {
      console.log(`Scan library API error for ${serviceId}:`, error.message);
      throw error;
    }
  }

  // Install service
  app.post('/api/media/:serviceId/install', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const installConfig = req.body;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      // Ensure config directory exists
      ensureDirectoryExists(serviceConfig.configPath);
      
      if (installConfig.type === 'docker') {
        // Docker installation
        const ports = installConfig.port ? `${installConfig.port}:${serviceConfig.ports[0]}` : `${serviceConfig.ports[0]}:${serviceConfig.ports[0]}`;
        
        const dockerCommand = `docker run -d \
          --name ${installConfig.containerName || serviceId} \
          --restart ${installConfig.restartPolicy || 'unless-stopped'} \
          -v ${installConfig.path || serviceConfig.configPath}:/config \
          -v ${installConfig.mediaPath || '/media'}:/media \
          -p ${ports} \
          ${serviceConfig.dockerImage}:latest`;
        
        const { stdout } = await execAsync(dockerCommand);
        
      } else if (installConfig.type === 'native') {
        // Native installation
        let installCommand = '';
        
        if (serviceId === 'emby') {
          installCommand = 'wget -q -O - https://github.com/MediaBrowser/Emby.Releases/raw/master/installers/deb/install.sh | sudo sh';
        } else if (serviceId === 'jellyfin') {
          installCommand = 'sudo apt-get update && sudo apt-get install -y jellyfin';
        } else if (serviceId === 'plex') {
          installCommand = 'wget -q https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/debian/plexmediaserver_1.32.5.7349-8f4248874_amd64.deb && sudo dpkg -i plexmediaserver*.deb';
        }
        
        if (installCommand) {
          await execAsync(installCommand);
        }
      }
      
      // Create initial config file
      const initialConfig = {
        port: installConfig.port || serviceConfig.ports[0],
        bindAddress: '0.0.0.0',
        sslEnabled: false,
        libraryScanInterval: 86400,
        transcodingEnabled: true,
        maxStreams: 5,
        libraryScan: true,
        autoStart: true
      };
      
      const configPath = path.join(serviceConfig.configPath, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
      
      res.json({ success: true, message: 'Service installed successfully' });
    } catch (error) {
      console.error(`Error installing ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update library cache endpoint
  app.post('/api/media/:serviceId/libraries/refresh', requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const serviceConfig = services[serviceId];
      
      if (!serviceConfig) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const status = await detectService(serviceId, serviceConfig);
      if (!status.installed || !status.running) {
        return res.status(400).json({ error: 'Service not running' });
      }
      
      // Force refresh from API
      const libraries = await getLibrariesFromAPI(serviceId, serviceConfig, status);
      
      res.json({ success: true, libraries });
    } catch (error) {
      console.error(`Error refreshing libraries for ${req.params.serviceId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint
  app.get('/api/media/health', requireAuth, async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {}
      };
      
      for (const serviceId in services) {
        try {
          const status = await detectService(serviceId, services[serviceId]);
          health.services[serviceId] = {
            installed: status.installed,
            running: status.running,
            version: status.version
          };
        } catch (error) {
          health.services[serviceId] = {
            error: error.message,
            installed: false,
            running: false
          };
        }
      }
      
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
};
