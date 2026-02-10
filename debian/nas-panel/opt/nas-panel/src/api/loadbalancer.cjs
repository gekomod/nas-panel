// src/api/loadbalancer.js
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CONFIG_PATH = '/etc/loadbalancer/loadbalancer.conf';
const NGINX_CONFIG_PATH = '/etc/nginx/nginx.conf';
const NGINX_SITES_PATH = '/etc/nginx/sites-available/loadbalancer';
const HA_PROXY_CONFIG = '/etc/haproxy/haproxy.cfg';

module.exports = function(app, requireAuth) {

  // Status load balancera
  app.get('/services/loadbalancer/status', requireAuth, async (req, res) => {
    try {
      let status = {
        enabled: false,
        service: 'none',
        running: false,
        algorithm: 'round-robin',
        healthCheck: false,
        servers: []
      };

      // Sprawdź czy konfiguracja istnieje
      if (fs.existsSync(CONFIG_PATH)) {
        const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configContent);
        status.enabled = config.enabled || false;
        status.service = config.service || 'nginx';
        status.algorithm = config.algorithm || 'round-robin';
        status.healthCheck = config.healthCheck || false;
        status.servers = config.servers || [];
      }

      // Sprawdź status usługi
      if (status.enabled && status.service !== 'none') {
        try {
          const serviceName = status.service === 'nginx' ? 'nginx' : 'haproxy';
          const { stdout } = await execAsync(`systemctl is-active ${serviceName}`);
          status.running = stdout.trim() === 'active';
        } catch (error) {
          status.running = false;
        }
      }

      res.json({ success: true, status });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to load load balancer status',
        details: error.message
      });
    }
  });

  // Pobierz konfigurację
  app.get('/services/loadbalancer/config', requireAuth, async (req, res) => {
    try {
      let config = {
        enabled: false,
        service: 'nginx',
        algorithm: 'round-robin',
        healthCheck: true,
        healthCheckInterval: '30s',
        failThreshold: 3,
        stickySessions: true,
        sessionTimeout: 30,
        servers: []
      };

      if (fs.existsSync(CONFIG_PATH)) {
        const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
        config = { ...config, ...JSON.parse(configContent) };
      }

      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to load configuration',
        details: error.message
      });
    }
  });

  // Zapisz konfigurację
  app.post('/services/loadbalancer/config', requireAuth, async (req, res) => {
    try {
      const { config } = req.body;
      
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid configuration format' 
        });
      }

      // Walidacja serwerów
      if (!config.servers || !Array.isArray(config.servers)) {
        return res.status(400).json({ 
          success: false,
          error: 'Servers configuration is required' 
        });
      }

      if (config.servers.length < 2) {
        return res.status(400).json({ 
          success: false,
          error: 'At least 2 servers are required' 
        });
      }

      // Walidacja wag
      const totalWeight = config.servers.reduce((sum, server) => sum + (server.weight || 50), 0);
      if (totalWeight !== 100) {
        return res.status(400).json({ 
          success: false,
          error: `Total weight must be 100% (currently: ${totalWeight}%)` 
        });
      }

      // Sprawdź czy serwery są dostępne
      const serverChecks = await Promise.allSettled(
        config.servers.map(async (server) => {
          try {
            const { stdout } = await execAsync(`timeout 5 curl -s -o /dev/null -w "%{http_code}" http://${server.ip}:${server.port}/health`);
            return { 
              server: server.ip, 
              status: stdout.trim() === '200' ? 'healthy' : 'unhealthy' 
            };
          } catch {
            return { 
              server: server.ip, 
              status: 'unreachable' 
            };
          }
        })
      );

      const unreachableServers = serverChecks
        .filter(result => result.value.status === 'unreachable')
        .map(result => result.value.server);

      if (unreachableServers.length > 0) {
        return res.status(400).json({ 
          success: false,
          error: `The following servers are unreachable: ${unreachableServers.join(', ')}`,
          unreachable: unreachableServers
        });
      }

      // Utwórz katalog konfiguracyjny jeśli nie istnieje
      const configDir = CONFIG_PATH.split('/').slice(0, -1).join('/');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Utwórz kopię zapasową
      if (fs.existsSync(CONFIG_PATH)) {
        const backupPath = `${CONFIG_PATH}.backup.${Date.now()}`;
        fs.copyFileSync(CONFIG_PATH, backupPath);
      }

      // Zapisz konfigurację
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      // Generuj konfigurację dla wybranej usługi
      await generateServiceConfig(config);

      // Włącz/restartuj usługę jeśli włączony
      if (config.enabled) {
        await applyLoadBalancerConfig(config.service);
      }

      res.json({ 
        success: true,
        message: 'Load balancer configuration saved successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to save configuration',
        details: error.message
      });
    }
  });

  // Testuj konfigurację
  app.post('/services/loadbalancer/test', requireAuth, async (req, res) => {
    try {
      const { config } = req.body;
      
      if (!config || !config.servers) {
        return res.status(400).json({ 
          success: false,
          error: 'Configuration required' 
        });
      }

      const results = [];
      const totalRequests = 100; // Liczba testowych żądań

      // Wykonaj testowe żądania do każdego serwera
      for (const server of config.servers) {
        const startTime = Date.now();
        let successes = 0;
        let totalResponseTime = 0;

        for (let i = 0; i < totalRequests / config.servers.length; i++) {
          try {
            const requestStart = Date.now();
            const { stdout } = await execAsync(
              `timeout 2 curl -s -o /dev/null -w "%{http_code}" http://${server.ip}:${server.port}/health`
            );
            const requestTime = Date.now() - requestStart;
            
            if (stdout.trim() === '200') {
              successes++;
              totalResponseTime += requestTime;
            }
          } catch (error) {
            // Błąd żądania
          }
        }

        const successRate = (successes / (totalRequests / config.servers.length)) * 100;
        const avgResponseTime = successes > 0 ? totalResponseTime / successes : 0;

        results.push({
          server: server.ip,
          successRate: successRate.toFixed(2),
          avgResponseTime: avgResponseTime.toFixed(2),
          status: successRate > 95 ? 'healthy' : successRate > 70 ? 'degraded' : 'unhealthy'
        });
      }

      res.json({ 
        success: true,
        results,
        message: 'Load balancer test completed'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Test failed',
        details: error.message
      });
    }
  });

  // Zastosuj konfigurację
  app.post('/services/loadbalancer/apply', requireAuth, async (req, res) => {
    try {
      const { service } = req.body;
      
      if (!['nginx', 'haproxy'].includes(service)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid service type' 
        });
      }

      await applyLoadBalancerConfig(service);

      res.json({ 
        success: true,
        message: `Load balancer configuration applied for ${service}`
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to apply configuration',
        details: error.message
      });
    }
  });

  // Funkcje pomocnicze
  async function generateServiceConfig(config) {
    if (config.service === 'nginx') {
      await generateNginxConfig(config);
    } else if (config.service === 'haproxy') {
      await generateHAProxyConfig(config);
    }
  }

  async function generateNginxConfig(config) {
    let nginxConfig = `
# Load Balancer Configuration
# Generated by NAS Panel - DO NOT EDIT MANUALLY

upstream backend {
`;

    // Dodaj serwery z wagami
    config.servers.forEach(server => {
      nginxConfig += `    server ${server.ip}:${server.port} weight=${server.weight};\n`;
    });

    nginxConfig += `}

server {
    listen 80;
    server_name _;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
`;

    // Dodaj health check jeśli włączony
    if (config.healthCheck) {
      nginxConfig += `
    # Health check configuration
    location /backend-health {
        proxy_pass http://backend;
        health_check interval=${config.healthCheckInterval} fails=${config.failThreshold} passes=1;
    }
`;
    }

    nginxConfig += `}
`;

    // Zapisz konfigurację
    fs.writeFileSync(NGINX_SITES_PATH, nginxConfig);
    
    // Aktywuj konfigurację
    const sitesEnabled = '/etc/nginx/sites-enabled/loadbalancer';
    if (fs.existsSync(sitesEnabled)) {
      fs.unlinkSync(sitesEnabled);
    }
    fs.symlinkSync(NGINX_SITES_PATH, sitesEnabled);
  }

  async function generateHAProxyConfig(config) {
    let haproxyConfig = `
# HAProxy Configuration
# Generated by NAS Panel - DO NOT EDIT MANUALLY

global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    log global
    mode http
    option httplog
    option dontlognull
    timeout connect 5000
    timeout client 50000
    timeout server 50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

frontend http_front
    bind *:80
    stats uri /haproxy?stats
    default_backend http_back

backend http_back
    balance ${config.algorithm}
`;

    // Dodaj serwery
    config.servers.forEach((server, index) => {
      haproxyConfig += `    server server${index + 1} ${server.ip}:${server.port} weight ${server.weight} check\n`;
    });

    // Dodaj health check
    if (config.healthCheck) {
      haproxyConfig += `
    option httpchk GET /health
    http-check expect status 200
`;
    }

    // Dodaj sticky sessions
    if (config.stickySessions) {
      haproxyConfig += `
    cookie SERVERID insert indirect nocache
`;
    }

    haproxyConfig += `
listen stats
    bind *:1936
    stats enable
    stats hide-version
    stats realm Haproxy\\ Statistics
    stats uri /
    stats auth admin:password
`;

    fs.writeFileSync(HA_PROXY_CONFIG, haproxyConfig);
  }

  async function applyLoadBalancerConfig(service) {
    try {
      // Test konfiguracji
      if (service === 'nginx') {
        await execAsync('nginx -t');
      } else if (service === 'haproxy') {
        await execAsync('haproxy -c -f /etc/haproxy/haproxy.cfg');
      }

      // Restart usługi
      await execAsync(`systemctl restart ${service}`);

      // Sprawdź status
      const { stdout } = await execAsync(`systemctl is-active ${service}`);
      if (stdout.trim() !== 'active') {
        throw new Error(`Service ${service} failed to start`);
      }
    } catch (error) {
      console.error(`Failed to apply ${service} config:`, error);
      throw error;
    }
  }
};
