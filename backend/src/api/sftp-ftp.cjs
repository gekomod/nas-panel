const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const FTP_CONFIG_PATH = '/etc/proftpd/proftpd.conf';
const SFTP_CONFIG_PATH = '/etc/ssh/sshd_config';
const FTP_SERVICE_NAME = 'proftpd';
const SFTP_SERVICE_NAME = 'sshd';

module.exports = function(app, requireAuth) {

  // Status usługi FTP/SFTP
  app.get('/api/services/ftp-sftp/status', requireAuth, async (req, res) => {
    try {
      // Check FTP status
      const ftpInstalled = fs.existsSync(FTP_CONFIG_PATH);
      let ftpStatus = { installed: false, running: false };
      
      if (ftpInstalled) {
        try {
          const { stdout } = await execAsync(`systemctl is-active ${FTP_SERVICE_NAME}`);
          ftpStatus = {
            installed: true,
            running: stdout.trim() === 'active'
          };
        } catch (error) {
          ftpStatus.running = false;
        }
      }

      // Check SFTP status (part of SSH)
      const sftpInstalled = fs.existsSync(SFTP_CONFIG_PATH);
      let sftpStatus = { installed: false, running: false };
      
      if (sftpInstalled) {
        try {
          const { stdout } = await execAsync(`systemctl is-active ${SFTP_SERVICE_NAME}`);
          sftpStatus = {
            installed: true,
            running: stdout.trim() === 'active'
          };
        } catch (error) {
          sftpStatus.running = false;
        }
      }

      res.json({
        ftp: ftpStatus,
        sftp: sftpStatus,
        active: ftpStatus.running || sftpStatus.running
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to check FTP/SFTP status',
        details: error.message
      });
    }
  });

  // Zarządzanie usługą FTP/SFTP
  app.post('/api/services/ftp-sftp/toggle', requireAuth, async (req, res) => {
    const { action, service } = req.body;
    
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action' 
      });
    }

    if (!['ftp', 'sftp'].includes(service)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid service' 
      });
    }

    try {
      const serviceName = service === 'ftp' ? FTP_SERVICE_NAME : SFTP_SERVICE_NAME;
      await execAsync(`systemctl ${action} ${serviceName}`);
      
      res.json({ 
        success: true,
        message: `${service.toUpperCase()} service ${action}ed` 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: `Failed to ${action} ${service.toUpperCase()}`,
        details: error.message
      });
    }
  });

  // Pobierz konfigurację FTP
  app.get('/api/services/ftp-sftp/config', requireAuth, async (req, res) => {
    try {
      const ftpConfigContent = fs.existsSync(FTP_CONFIG_PATH) ? 
        fs.readFileSync(FTP_CONFIG_PATH, 'utf8') : '';
      
      // Parsowanie konfiguracji FTP
      const lines = ftpConfigContent.split('\n');
      const config = {
        port: 21,
        anonymousLogin: false,
        passivePorts: {
          min: 49152,
          max: 65534
        },
        maxClients: 50,
        maxClientsPerIP: 5,
        timeout: 300,
        sslEnabled: false,
        sslCertPath: '',
        additionalOptions: []
      };

      lines.forEach(line => {
	  if (line.trim().startsWith('#') || line.trim() === '') return;

	  if (line.includes('Port')) {
	    config.port = parseInt(line.split(' ')[1]);
	  } else if (line.includes('Anonymous')) {
	    config.anonymousLogin = true;
	  } else if (line.includes('PassivePorts')) {
	    const ports = line.match(/\d+/g);
	    if (ports && ports.length === 2) {
	      config.passivePorts.min = parseInt(ports[0]);
	      config.passivePorts.max = parseInt(ports[1]);
	    }
	  } else if (line.includes('MaxClients')) {
	    config.maxClients = parseInt(line.split(' ')[1]);
	  } else if (line.includes('MaxClientsPerHost')) {
	    config.maxClientsPerIP = parseInt(line.split(' ')[1]);
	  } else if (line.includes('TimeoutIdle')) {
	    config.timeout = parseInt(line.split(' ')[1]);
	  } else if (line.includes('TLSEngine') && line.includes('on')) {
	    config.sslEnabled = true;
	  } else if (line.includes('TLSRSACertificateFile')) {
	    config.sslCertPath = line.split(' ')[1].replace(/"/g, '');
	  } else if (line.trim()) {
	    config.additionalOptions.push(line.trim());
	  }
	});

      res.json({ 
        success: true,
        config 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to read FTP config',
        details: error.message
      });
    }
  });

  // Zapisz konfigurację FTP
  app.post('/api/services/ftp-sftp/config', requireAuth, async (req, res) => {
  try {
    const { config } = req.body;
    
    // Walidacja konfiguracji
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid config format' 
      });
    }
    
    try {
  await execAsync('id nobody');
} catch (error) {
  return res.status(400).json({
    success: false,
    error: 'FTP user does not exist',
    details: 'Please create the ftpuser account first: sudo adduser --system --no-create-home --group ftpuser'
  });
}

    // Przygotowanie zawartości pliku konfiguracyjnego
    let configContent = `# ProFTPD Configuration
# Managed by NAS Panel - DO NOT EDIT MANUALLY

ServerName "NAS FTP Server"
ServerType standalone
DefaultServer on
Port ${config.port || 21}
UseIPv6 off

# User/Group - Using dedicated user
User nobody
Group nogroup

# Authentication
AuthOrder mod_auth_file.c
${config.anonymousLogin ? 'Anonymous ~ftp' : ''}
RequireValidShell off

# Passive ports
PassivePorts ${config.passivePorts?.min || 49152} ${config.passivePorts?.max || 65534}

# Limits
MaxClients ${config.maxClients || 50}
MaxClientsPerHost ${config.maxClientsPerIP || 5}
TimeoutIdle ${config.timeout || 300}

# SSL/TLS
${config.sslEnabled ? `
TLSEngine on
TLSRequired on
TLSRSACertificateFile ${config.sslCertPath || '/etc/ssl/certs/proftpd.crt'}
TLSRSACertificateKeyFile ${config.sslCertPath ? config.sslCertPath.replace('.crt', '.key') : '/etc/ssl/private/proftpd.key'}
` : ''}
`;

    // Utwórz kopię zapasową obecnej konfiguracji
    const backupPath = `${FTP_CONFIG_PATH}.backup.${Date.now()}`;
    if (fs.existsSync(FTP_CONFIG_PATH)) {
      fs.copyFileSync(FTP_CONFIG_PATH, backupPath);
    }

    // ZAPISZ NOWĄ KONFIGURACJĘ ZAMIAST DODAWAĆ DO ISTNIEJĄCEJ
    fs.writeFileSync(FTP_CONFIG_PATH, configContent);

    // Przeładuj usługę FTP
    try {
      await execAsync(`systemctl restart ${FTP_SERVICE_NAME}`);
    } catch (serviceError) {
      console.error('FTP reload error:', serviceError);
      throw new Error('Failed to restart FTP service');
    }
    
    res.json({ 
      success: true,
      message: 'SSH config saved and service reloaded' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to save FTP config',
      details: error.message
    });
  }
});

  // Pobierz listę udostępnionych folderów
  app.get('/api/services/ftp-sftp/shares', requireAuth, async (req, res) => {
    try {
      const configContent = fs.existsSync(FTP_CONFIG_PATH) ? 
        fs.readFileSync(FTP_CONFIG_PATH, 'utf8') : '';
      
      const shares = [];
      let currentShare = null;

      configContent.split('\n').forEach(line => {
        if (line.trim().startsWith('<Directory')) {
          const pathMatch = line.match(/<Directory\s+(.*?)>/);
          if (pathMatch) {
            currentShare = {
              path: pathMatch[1].replace(/"/g, ''),
              options: {}
            };
          }
        } else if (line.trim().startsWith('</Directory>') && currentShare) {
          shares.push(currentShare);
          currentShare = null;
        } else if (currentShare) {
          if (line.includes('AllowOverwrite')) {
            currentShare.options.allowOverwrite = line.includes('on');
          } else if (line.includes('AllowStoreRestart')) {
            currentShare.options.allowResume = line.includes('on');
          } else if (line.includes('HideFiles')) {
            currentShare.options.hiddenFiles = line.match(/HideFiles\s+(.*)/)[1].replace(/"/g, '');
          }
        }
      });

      res.json({ 
        success: true,
        shares 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to read FTP shares',
        details: error.message
      });
    }
  });

  // Dodaj/zmodyfikuj udostępniony folder
  app.post('/api/services/ftp-sftp/shares', requireAuth, async (req, res) => {
  try {
    const { action, share } = req.body;
    
    if (!['add', 'update', 'remove'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action' 
      });
    }

    if (!share || !share.path) {
      return res.status(400).json({ 
        success: false,
        error: 'Share path is required' 
      });
    }

    let configContent = fs.existsSync(FTP_CONFIG_PATH) ? 
      fs.readFileSync(FTP_CONFIG_PATH, 'utf8') : '';
    
    // Remove existing share if it exists
    const shareStart = `<Directory "${share.path}">`;
    const shareEnd = `</Directory>`;
    
    // Remove existing share configuration
    const startIndex = configContent.indexOf(shareStart);
    const endIndex = configContent.indexOf(shareEnd, startIndex);
    
    if (startIndex !== -1 && endIndex !== -1) {
      configContent = configContent.substring(0, startIndex) + 
                     configContent.substring(endIndex + shareEnd.length);
    }

    // Add new share if not removing
    if (action !== 'remove') {
      const shareConfig = `
${shareStart}
  AllowOverwrite ${share.options?.allowOverwrite ? 'on' : 'off'}
  AllowStoreRestart ${share.options?.allowResume ? 'on' : 'off'}
  HideFiles "^\\.|~$|\\.bak$"
</Directory>
`;
      configContent += shareConfig;
    }

    // Create backup
    const backupPath = `${FTP_CONFIG_PATH}.backup.${Date.now()}`;
    fs.copyFileSync(FTP_CONFIG_PATH, backupPath);

    // Save new config
    fs.writeFileSync(FTP_CONFIG_PATH, configContent);

    // Reload service
    try {
      await execAsync(`systemctl restart ${FTP_SERVICE_NAME}`);
    } catch (serviceError) {
      console.error('FTP reload error:', serviceError);
    }
    
    res.json({ 
      success: true,
      message: `FTP share ${action}ed successfully` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: `Failed to manage FTP share`,
      details: error.message
    });
  }
});

  // Pobierz aktywne połączenia FTP
// Pobierz aktywne połączenia FTP i SFTP
app.get('/api/services/ftp-sftp/connections', requireAuth, async (req, res) => {
  try {
    // Get FTP connections
    let ftpConnections = [];
    try {
      const { stdout: ftpStdout } = await execAsync('ftpwho -v');
      ftpConnections = ftpStdout.split('\n')
        .filter(line => line.includes('pid') && line.includes('user'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[1],
            user: parts[3],
            status: parts[5],
            time: parts[7],
            command: parts.slice(9).join(' '),
            type: 'ftp'
          };
        });
    } catch (ftpError) {
      console.error('Error getting FTP connections:', ftpError);
    }

    // Get SFTP connections (SSH)
    let sftpConnections = [];
    try {
      const { stdout: sshStdout } = await execAsync('ss -tpn | grep "sftp-server"');
      const { stdout: psStdout } = await execAsync('ps aux | grep "sftp-server"');
      
      // Parse ss output to get connection info
      const ssLines = sshStdout.split('\n').filter(line => line.trim() !== '');
      const psLines = psStdout.split('\n').filter(line => 
        line.includes('sftp-server') && !line.includes('grep')
      );

      sftpConnections = psLines.map(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        const user = parts[0];
        
        // Find matching connection in ss output
        const connInfo = ssLines.find(l => l.includes(`pid=${pid}`));
        let status = 'active';
        let remote = '';
        
        if (connInfo) {
          const connParts = connInfo.split(/\s+/);
          remote = connParts[4] || '';
          status = connParts[1] || 'active';
        }
        
        return {
          pid,
          user,
          status,
          remote,
          command: 'sftp',
          type: 'sftp'
        };
      });
    } catch (sftpError) {
      console.error('Error getting SFTP connections:', sftpError);
    }

    res.json({ 
      success: true,
      connections: [...ftpConnections, ...sftpConnections]
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to check connections',
      details: error.message
    });
  }
});
  
// Install FTP/SFTP service
app.post('/api/services/ftp-sftp/install', requireAuth, async (req, res) => {
  const { service } = req.body;
  
  if (!['ftp', 'sftp'].includes(service)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid service type' 
    });
  }

  try {
    let command, message;
    
    if (service === 'ftp') {
      // Install ProFTPD
      command = 'apt-get install -y proftpd';
      message = 'FTP service installed successfully';
    } else {
      // SFTP is part of SSH, so we install OpenSSH
      command = 'apt-get install -y openssh-server';
      message = 'SFTP (SSH) service installed successfully';
    }

    const { stdout } = await execAsync(command);
    
    res.json({ 
      success: true,
      message,
      details: stdout
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: `Failed to install ${service.toUpperCase()} service`,
      details: error.message
    });
  }
});

// Kill connection endpoint
app.post('/api/services/ftp-sftp/kill-connection', requireAuth, async (req, res) => {
  const { command } = req.body;
  
  if (!command || !command.startsWith('kill')) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid kill command' 
    });
  }

  try {
    const { stdout } = await execAsync(command);
    
    res.json({ 
      success: true,
      message: 'Connection terminated',
      details: stdout
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to kill connection',
      details: error.message
    });
  }
});

};
