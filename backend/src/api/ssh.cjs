// src/api/ssh.js
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const SSH_CONFIG_PATH = '/etc/ssh/sshd_config';
const SSH_SERVICE_NAME = 'sshd';

module.exports = function(app, requireAuth) {

  // Status usługi SSH
  app.get('/services/ssh/status', requireAuth, async (req, res) => {
    try {
      // Sprawdź czy konfiguracja SSH istnieje
      fs.accessSync(SSH_CONFIG_PATH, fs.constants.F_OK);

      // Sprawdź status usługi
      const { stdout } = await execAsync(`systemctl is-active ${SSH_SERVICE_NAME}`);
      const isActive = stdout.trim() === 'active';

      // Pobierz wersję SSH
      const { stdout: versionOutput } = await execAsync('ssh -V');
      const versionMatch = versionOutput.match(/OpenSSH_([\d.]+)/);

      res.json({
        installed: true,
        running: isActive,
        active: isActive,
        version: versionMatch ? versionMatch[1] : 'unknown'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({ 
          installed: false,
          running: false,
          active: false
        });
      }
      res.status(500).json({ 
        success: false,
        error: 'Failed to check SSH status',
        details: error.message
      });
    }
  });

  // Zarządzanie usługą SSH
  app.post('/services/ssh/toggle', requireAuth, async (req, res) => {
    const { action } = req.body;
    
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action' 
      });
    }

    try {
      await execAsync(`systemctl ${action} ${SSH_SERVICE_NAME}`);
      res.json({ 
        success: true,
        message: `SSH service ${action}ed` 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: `Failed to ${action} SSH`,
        details: error.message
      });
    }
  });

  // Pobierz konfigurację SSH
  app.get('/services/ssh/config', requireAuth, async (req, res) => {
    try {
      const configContent = fs.readFileSync(SSH_CONFIG_PATH, 'utf8');
      
      // Parsowanie konfiguracji SSH
      const lines = configContent.split('\n');
      const config = {
        port: 22,
        allowRootLogin: false,
        passwordAuthentication: true,
        publicKeyAuthentication: true,
        tcpForwarding: false,
        compression: false,
        additionalOptions: []
      };

      lines.forEach(line => {
        if (line.trim().startsWith('#') || line.trim() === '') return;

        if (line.includes('Port')) {
          config.port = parseInt(line.split(' ')[1]);
        } else if (line.includes('PermitRootLogin')) {
          config.allowRootLogin = line.split(' ')[1].toLowerCase() === 'yes';
        } else if (line.includes('PasswordAuthentication')) {
          config.passwordAuthentication = line.split(' ')[1].toLowerCase() === 'yes';
        } else if (line.includes('PubkeyAuthentication')) {
          config.publicKeyAuthentication = line.split(' ')[1].toLowerCase() === 'yes';
        } else if (line.includes('AllowTcpForwarding')) {
          config.tcpForwarding = line.split(' ')[1].toLowerCase() === 'yes';
        } else if (line.includes('Compression')) {
          config.compression = line.split(' ')[1].toLowerCase() === 'yes';
        } else if (!line.includes('Match') && line.trim()) {
          config.additionalOptions.push(line.trim());
        }
      });

      res.json({ 
        success: true,
        config 
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ 
          success: false,
          error: 'SSH config file not found' 
        });
      }
      res.status(500).json({ 
        success: false,
        error: 'Failed to read SSH config',
        details: error.message
      });
    }
  });

  // Zapisz konfigurację SSH
  app.post('/services/ssh/config', requireAuth, async (req, res) => {
    try {
      const { config } = req.body;
      
      // Walidacja konfiguracji
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid config format' 
        });
      }

      // Przygotowanie zawartości pliku konfiguracyjnego
      let configContent = `# SSH Server Configuration
# Managed by NAS Panel - DO NOT EDIT MANUALLY

Port ${config.port || 22}
PermitRootLogin ${config.allowRootLogin ? 'yes' : 'no'}
PasswordAuthentication ${config.passwordAuthentication ? 'yes' : 'no'}
PubkeyAuthentication ${config.publicKeyAuthentication ? 'yes' : 'no'}
AllowTcpForwarding ${config.tcpForwarding ? 'yes' : 'no'}
Compression ${config.compression ? 'yes' : 'no'}

# Additional options
${config.additionalOptions ? config.additionalOptions.join('\n') : ''}
`;

      // Utwórz kopię zapasową obecnej konfiguracji
      const backupPath = `${SSH_CONFIG_PATH}.backup.${Date.now()}`;
      if (fs.existsSync(SSH_CONFIG_PATH)) {
        fs.copyFileSync(SSH_CONFIG_PATH, backupPath);
      }

      // Zapisz nową konfigurację
      fs.writeFileSync(SSH_CONFIG_PATH, configContent);

      // Przeładuj usługę SSH
      try {
        await execAsync(`systemctl restart ${SSH_SERVICE_NAME}`);
      } catch (serviceError) {
        console.error('SSH reload error:', serviceError);
      }
      
      res.json({ 
        success: true,
        message: 'SSH config saved and service reloaded' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to save SSH config',
        details: error.message
      });
    }
  });

  // Sprawdź połączenia SSH
// Modify the connections endpoint like this:
app.get('/services/ssh/connections', requireAuth, async (req, res) => {
    try {
        // Try ss first, fall back to netstat if it fails
        let command = 'ss -tnp 2>/dev/null || netstat -tnp 2>/dev/null';
        const { stdout } = await execAsync(`${command} | grep sshd`);
        
        const connections = stdout.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const parts = line.trim().split(/\s+/);
                // Handle both ss and netstat output formats
                if (line.includes('sshd')) {
                    return {
                        local: parts[3] || parts[3],
                        remote: parts[4] || parts[4],
                        state: parts[1] || parts[5],
                        pid: parts[6] ? parts[6].split(',')[0] : 'unknown'
                    };
                }
                return null;
            }).filter(Boolean);

        res.json({ 
            success: true,
            connections 
        });
    } catch (error) {
        // If no connections found, return empty array instead of error
        if (error.message.includes('Command failed')) {
            return res.json({ 
                success: true,
                connections: [] 
            });
        }
        res.status(500).json({ 
            success: false,
            error: 'Failed to check SSH connections',
            details: error.message
        });
    }
});
};
