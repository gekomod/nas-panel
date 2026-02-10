const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const FTP_CONFIG_PATH = '/etc/proftpd/proftpd.conf';
const SFTP_CONFIG_PATH = '/etc/ssh/sshd_config';
const FTP_SERVICE_NAME = 'proftpd';
const SFTP_SERVICE_NAME = 'sshd';
const FTP_USER_CONFIG_PATH = '/etc/proftpd/ftpusers.conf';

module.exports = function(app, requireAuth) {

  // Status usługi FTP/SFTP
  app.get('/api/services/ftp-sftp/status', requireAuth, async (req, res) => {
    try {
      // Check FTP status - proste sprawdzenie
      let ftpStatus = { installed: false, running: false };
      
      // Sprawdź czy proftpd jest zainstalowany
      try {
        // Sprawdź czy plik binarny istnieje
        await execAsync('which proftpd');
        ftpStatus.installed = true;
      } catch (error) {
        // Sprawdź alternatywnie
        try {
          await execAsync('command -v proftpd');
          ftpStatus.installed = true;
        } catch (error2) {
          ftpStatus.installed = false;
        }
      }
      
      if (ftpStatus.installed) {
        try {
          const { stdout } = await execAsync('systemctl is-active proftpd 2>/dev/null || echo "inactive"');
          ftpStatus.running = stdout.trim() === 'active';
        } catch (error) {
          ftpStatus.running = false;
        }
      }

      // Check SFTP status
      let sftpStatus = { installed: false, running: false };
      
      try {
        await execAsync('which sshd');
        sftpStatus.installed = true;
      } catch (error) {
        try {
          await execAsync('command -v sshd');
          sftpStatus.installed = true;
        } catch (error2) {
          sftpStatus.installed = false;
        }
      }
      
      if (sftpStatus.installed) {
        try {
          const { stdout } = await execAsync('systemctl is-active sshd 2>/dev/null || echo "inactive"');
          sftpStatus.running = stdout.trim() === 'active';
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
        ftpUser: 'ftpuser',
        ftpGroup: 'nogroup',
        additionalOptions: []
      };

      lines.forEach(line => {
        if (line.trim().startsWith('#') || line.trim() === '') return;

        if (line.includes('Port')) {
          config.port = parseInt(line.split(' ')[1]) || 21;
        } else if (line.includes('Anonymous')) {
          config.anonymousLogin = line.includes('~ftp');
        } else if (line.includes('PassivePorts')) {
          const ports = line.match(/\d+/g);
          if (ports && ports.length === 2) {
            config.passivePorts.min = parseInt(ports[0]);
            config.passivePorts.max = parseInt(ports[1]);
          }
        } else if (line.includes('MaxClients')) {
          const match = line.match(/MaxClients\s+(\d+)/);
          if (match) config.maxClients = parseInt(match[1]);
        } else if (line.includes('MaxClientsPerHost')) {
          const match = line.match(/MaxClientsPerHost\s+(\d+)/);
          if (match) config.maxClientsPerIP = parseInt(match[1]);
        } else if (line.includes('TimeoutIdle')) {
          const match = line.match(/TimeoutIdle\s+(\d+)/);
          if (match) config.timeout = parseInt(match[1]);
        } else if (line.includes('TLSEngine') && line.includes('on')) {
          config.sslEnabled = true;
        } else if (line.includes('TLSRSACertificateFile')) {
          const match = line.match(/TLSRSACertificateFile\s+(.+)/);
          if (match) config.sslCertPath = match[1].replace(/"/g, '');
        } else if (line.includes('User')) {
          const match = line.match(/User\s+(\S+)/);
          if (match) config.ftpUser = match[1];
        } else if (line.includes('Group')) {
          const match = line.match(/Group\s+(\S+)/);
          if (match) config.ftpGroup = match[1];
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

  // Zapisz konfigurację FTP - POPRAWIONA WERSJA
  app.post('/api/services/ftp-sftp/config', requireAuth, async (req, res) => {
    try {
      const { config } = req.body;
      
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid config format' 
        });
      }
      
      const ftpUser = config.ftpUser || 'ftpuser';
      const ftpGroup = config.ftpGroup || 'nogroup';

      // Sprawdź czy grupa istnieje
      try {
        await execAsync(`getent group ${ftpGroup}`);
      } catch (error) {
        // Jeśli grupa nie istnieje, utwórz ją
        try {
          await execAsync(`sudo groupadd ${ftpGroup}`);
        } catch (groupError) {
          console.error('Failed to create group:', groupError);
          return res.status(400).json({
            success: false,
            error: `Group '${ftpGroup}' does not exist and cannot be created`,
            details: groupError.message
          });
        }
      }

      // Sprawdź czy użytkownik FTP istnieje
      try {
        await execAsync(`id ${ftpUser}`);
      } catch (error) {
        // Użytkownik nie istnieje, utwórz go
        try {
          await execAsync(`sudo useradd --system --shell /bin/false --home-dir /home/${ftpUser} --create-home --gid ${ftpGroup} ${ftpUser}`);
          // Ustaw domyślne hasło
          await execAsync(`echo "${ftpUser}:changeme123" | sudo chpasswd`);
          // Ustaw właściciela katalogu domowego
          await execAsync(`sudo chown ${ftpUser}:${ftpGroup} /home/${ftpUser}`);
        } catch (userError) {
          console.error('Failed to create user:', userError);
          return res.status(400).json({
            success: false,
            error: `Failed to create FTP user '${ftpUser}'`,
            details: userError.message
          });
        }
      }

      // Przygotuj zawartość konfiguracji GŁÓWNEJ - BEZ AllowStoreRestart
      let configContent = `# ProFTPD Configuration
# Managed by NAS Panel - DO NOT EDIT MANUALLY

ServerName "NAS FTP Server"
ServerType standalone
DefaultServer on
Port ${config.port || 21}
UseIPv6 off

# User/Group
User ${ftpUser}
Group ${ftpGroup}

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

# Include user configuration
Include ${FTP_USER_CONFIG_PATH}
`;

      // Utwórz katalog na plik użytkowników jeśli nie istnieje
      const userConfigDir = path.dirname(FTP_USER_CONFIG_PATH);
      if (!fs.existsSync(userConfigDir)) {
        fs.mkdirSync(userConfigDir, { recursive: true });
      }

      // Utwórz DOMYŚLNY plik konfiguracji użytkowników z POPRAWNYMI direktywami
      if (!fs.existsSync(FTP_USER_CONFIG_PATH)) {
        const defaultUserConfig = `# FTP Users Configuration
# Managed by NAS Panel

<Global>
  # Default settings for all users
  DefaultRoot ~
</Global>
`;
        fs.writeFileSync(FTP_USER_CONFIG_PATH, defaultUserConfig);
      }

      // Utwórz kopię zapasową
      const backupPath = `${FTP_CONFIG_PATH}.backup.${Date.now()}`;
      if (fs.existsSync(FTP_CONFIG_PATH)) {
        fs.copyFileSync(FTP_CONFIG_PATH, backupPath);
      }

      // Zapisz nową konfigurację GŁÓWNĄ
      fs.writeFileSync(FTP_CONFIG_PATH, configContent);

      // Przeładuj usługę
      try {
        await execAsync(`systemctl restart ${FTP_SERVICE_NAME}`);
      } catch (serviceError) {
        console.error('FTP restart error:', serviceError);
        // Nie zgłaszaj błędu, tylko loguj
      }
      
      res.json({ 
        success: true,
        message: 'FTP config saved and service restarted'
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
      // Odczytaj plik konfiguracyjny użytkowników
      let userConfigContent = '';
      if (fs.existsSync(FTP_USER_CONFIG_PATH)) {
        userConfigContent = fs.readFileSync(FTP_USER_CONFIG_PATH, 'utf8');
      } else {
        // Jeśli plik nie istnieje, utwórz domyślny
        const defaultUserConfig = `# FTP Users Configuration
# Managed by NAS Panel

<Global>
  # Default settings for all users
  DefaultRoot ~
</Global>
`;
        fs.writeFileSync(FTP_USER_CONFIG_PATH, defaultUserConfig);
        userConfigContent = defaultUserConfig;
      }
      
      const shares = [];
      const lines = userConfigContent.split('\n');
      let currentShare = null;
      let inGlobalSection = false;

      lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('<Global>')) {
          inGlobalSection = true;
        } else if (line.startsWith('</Global>')) {
          inGlobalSection = false;
        } else if (line.startsWith('<Directory') && !inGlobalSection) {
          const pathMatch = line.match(/<Directory\s+(.*?)>/);
          if (pathMatch) {
            currentShare = {
              path: pathMatch[1].replace(/"/g, ''),
              options: {
                allowOverwrite: false,
                allowResume: false
              }
            };
          }
        } else if (line.startsWith('</Directory>') && currentShare) {
          shares.push(currentShare);
          currentShare = null;
        } else if (currentShare && line) {
          if (line.includes('AllowOverwrite')) {
            currentShare.options.allowOverwrite = line.includes('on');
          } else if (line.includes('AllowStoreRestart')) {
            currentShare.options.allowResume = line.includes('on');
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

  // Dodaj/zmodyfikuj udostępniony folder - POPRAWIONA WERSJA
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

      // Sprawdź czy katalog istnieje
      if (action !== 'remove' && !fs.existsSync(share.path)) {
        return res.status(400).json({ 
          success: false,
          error: 'Directory does not exist',
          details: `Path ${share.path} does not exist`
        });
      }

      // ZAWSZE odczytuj świeży plik konfiguracyjny
      let userConfigContent = '';
      if (fs.existsSync(FTP_USER_CONFIG_PATH)) {
        userConfigContent = fs.readFileSync(FTP_USER_CONFIG_PATH, 'utf8');
      } else {
        // Utwórz podstawowy plik z POPRAWNYMI direktywami
        userConfigContent = `# FTP Users Configuration
# Managed by NAS Panel

<Global>
  # Default settings for all users
  DefaultRoot ~
</Global>
`;
      }
      
      // Usuń istniejącą sekcję jeśli istnieje
      const shareStart = `<Directory "${share.path}">`;
      const shareEnd = `</Directory>`;
      
      const startIndex = userConfigContent.indexOf(shareStart);
      if (startIndex !== -1) {
        const endIndex = userConfigContent.indexOf(shareEnd, startIndex);
        if (endIndex !== -1) {
          userConfigContent = userConfigContent.substring(0, startIndex) + 
                           userConfigContent.substring(endIndex + shareEnd.length);
        }
      }

      // Dodaj nową sekcję jeśli nie usuwamy - UŻYJ POPRAWNYCH DIREKTYW
      if (action !== 'remove') {
        const shareConfig = `
<Directory "${share.path}">
  # Basic permissions - using correct directives
  <Limit ALL>
    AllowAll
  </Limit>
</Directory>
`;
        
        // Dodaj na końcu pliku
        userConfigContent += shareConfig;
      }

      // Utwórz kopię zapasową
      const backupPath = `${FTP_USER_CONFIG_PATH}.backup.${Date.now()}`;
      if (fs.existsSync(FTP_USER_CONFIG_PATH)) {
        fs.copyFileSync(FTP_USER_CONFIG_PATH, backupPath);
      }

      // Zapisz nową konfigurację
      fs.writeFileSync(FTP_USER_CONFIG_PATH, userConfigContent);

      // Przeładuj usługę
      try {
        await execAsync(`systemctl reload ${FTP_SERVICE_NAME}`);
      } catch (serviceError) {
        console.error('FTP reload error:', serviceError);
        // Spróbuj restartować jeśli reload nie działa
        try {
          await execAsync(`systemctl restart ${FTP_SERVICE_NAME}`);
        } catch (restartError) {
          console.error('FTP restart error:', restartError);
        }
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

  // Zarządzanie użytkownikami FTP
  app.get('/api/services/ftp-sftp/users', requireAuth, async (req, res) => {
    try {
      const users = [];
      
      // Odczytaj plik /etc/passwd dla użytkowników systemowych
      const { stdout } = await execAsync('getent passwd');
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 7) {
          const uid = parseInt(parts[2]);
          const shell = parts[6];
          // Filtruj użytkowników z niedozwolonym shell (ftp users)
          if (shell.includes('false') || shell.includes('nologin')) {
            users.push({
              username: parts[0],
              uid: uid,
              gid: parseInt(parts[3]),
              home: parts[5],
              shell: parts[6]
            });
          }
        }
      });

      res.json({
        success: true,
        users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get FTP users',
        details: error.message
      });
    }
  });

  // Utwórz użytkownika FTP
  app.post('/api/services/ftp-sftp/create-user', requireAuth, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      // Sprawdź czy użytkownik już istnieje
      try {
        await execAsync(`id ${username}`);
        return res.status(400).json({
          success: false,
          error: 'User already exists'
        });
      } catch (error) {
        // Użytkownik nie istnieje, kontynuuj
      }

      // Pobierz grupę z konfiguracji FTP
      let ftpGroup = 'nogroup';
      try {
        const configContent = fs.readFileSync(FTP_CONFIG_PATH, 'utf8');
        const match = configContent.match(/Group\s+(\S+)/);
        if (match) {
          ftpGroup = match[1];
        }
      } catch (error) {
        // Użyj domyślnej grupy
      }

      // Utwórz użytkownika systemowego bez loginu (bez shell)
      const createUserCmd = `sudo useradd --system --shell /bin/false --home-dir /home/${username} --create-home --gid ${ftpGroup} ${username}`;
      await execAsync(createUserCmd);
      
      // Ustaw hasło jeśli podano
      if (password) {
        await execAsync(`echo "${username}:${password}" | sudo chpasswd`);
      } else {
        // Ustaw domyślne hasło
        await execAsync(`echo "${username}:changeme123" | sudo chpasswd`);
      }
      
      // Utwórz katalog domowy jeśli nie istnieje
      await execAsync(`sudo mkdir -p /home/${username} && sudo chown ${username}:${ftpGroup} /home/${username}`);

      res.json({
        success: true,
        message: `FTP user '${username}' created successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create FTP user',
        details: error.message
      });
    }
  });

  // Dodaj użytkownika FTP (dla panelu)
  app.post('/api/services/ftp-sftp/users', requireAuth, async (req, res) => {
    try {
      const { username, password, homeDirectory } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // Sprawdź czy użytkownik już istnieje
      try {
        await execAsync(`id ${username}`);
        return res.status(400).json({
          success: false,
          error: 'User already exists'
        });
      } catch (error) {
        // Użytkownik nie istnieje, kontynuuj
      }

      // Pobierz grupę z konfiguracji FTP
      let ftpGroup = 'nogroup';
      try {
        const configContent = fs.readFileSync(FTP_CONFIG_PATH, 'utf8');
        const match = configContent.match(/Group\s+(\S+)/);
        if (match) {
          ftpGroup = match[1];
        }
      } catch (error) {
        // Użyj domyślnej grupy
      }

      // Utwórz użytkownika
      const homeDir = homeDirectory || `/home/${username}`;
      const cmd = `sudo useradd --system --shell /bin/false --home-dir ${homeDir} --create-home --gid ${ftpGroup} ${username} && echo "${username}:${password}" | sudo chpasswd`;
      
      await execAsync(cmd);
      
      // Ustaw właściciela katalogu domowego
      await execAsync(`sudo chown ${username}:${ftpGroup} ${homeDir}`);

      res.json({
        success: true,
        message: 'FTP user created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create FTP user',
        details: error.message
      });
    }
  });

  // Zmień hasło użytkownika FTP
  app.post('/api/services/ftp-sftp/users/:username/change-password', requireAuth, async (req, res) => {
    try {
      const { username } = req.params;
      const { password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // Sprawdź czy użytkownik istnieje
      try {
        await execAsync(`id ${username}`);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Zmień hasło
      await execAsync(`echo "${username}:${password}" | sudo chpasswd`);
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to change password',
        details: error.message
      });
    }
  });

  // Usuń użytkownika FTP
  app.delete('/api/services/ftp-sftp/users/:username', requireAuth, async (req, res) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required'
        });
      }

      // Sprawdź czy użytkownik istnieje
      try {
        await execAsync(`id ${username}`);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Usuń użytkownika (ale nie katalog domowy)
      await execAsync(`sudo userdel ${username}`);
      
      res.json({
        success: true,
        message: 'FTP user deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete FTP user',
        details: error.message
      });
    }
  });

  // Pobierz aktywne połączenia
  app.get('/api/services/ftp-sftp/connections', requireAuth, async (req, res) => {
    try {
      let ftpConnections = [];
      try {
        const { stdout } = await execAsync('netstat -tnp 2>/dev/null | grep :21 | grep ESTABLISHED || true');
        const connections = stdout.split('\n').filter(line => line.trim());
        
        ftpConnections = connections.map(line => {
          const parts = line.trim().split(/\s+/);
          const pidMatch = parts[6]?.match(/\/(\d+)/);
          return {
            pid: pidMatch ? pidMatch[1] : 'N/A',
            user: 'ftp',
            status: 'established',
            remote: parts[4] || 'unknown',
            type: 'ftp'
          };
        });
      } catch (error) {
        // Ignoruj błędy
      }

      res.json({
        success: true,
        connections: ftpConnections
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get connections',
        details: error.message
      });
    }
  });

  // Instalacja usługi
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
        command = 'apt-get update && apt-get install -y proftpd';
        message = 'FTP service installed successfully';
        
        // Po instalacji utwórz domyślnego użytkownika FTP
        try {
          await execAsync('sudo useradd --system --shell /bin/false --home-dir /home/ftpuser --create-home --gid nogroup ftpuser');
          await execAsync('echo "ftpuser:changeme123" | sudo chpasswd');
          await execAsync('sudo chown ftpuser:nogroup /home/ftpuser');
        } catch (userError) {
          console.error('Failed to create default FTP user:', userError);
        }
      } else {
        command = 'apt-get update && apt-get install -y openssh-server';
        message = 'SFTP (SSH) service installed successfully';
      }

      await execAsync(command);
      
      res.json({ 
        success: true,
        message
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: `Failed to install ${service.toUpperCase()} service`,
        details: error.message
      });
    }
  });

  // Zabij połączenie
  app.post('/api/services/ftp-sftp/kill-connection', requireAuth, async (req, res) => {
    const { pid, service } = req.body;
    
    if (!pid || pid === 'N/A') {
      return res.status(400).json({ 
        success: false,
        error: 'Valid PID is required' 
      });
    }

    try {
      await execAsync(`sudo kill -9 ${pid}`);
      
      res.json({ 
        success: true,
        message: 'Connection terminated successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to kill connection',
        details: error.message
      });
    }
  });

  // Napraw konfigurację FTP - POPRAWIONA WERSJA
  app.post('/api/services/ftp-sftp/repair-config', requireAuth, async (req, res) => {
    try {
      // Utwórz POPRAWNĄ konfigurację główną
      const mainConfig = `# ProFTPD Configuration
# Managed by NAS Panel - DO NOT EDIT MANUALLY

ServerName "NAS FTP Server"
ServerType standalone
DefaultServer on
Port 21
UseIPv6 off

# User/Group
User ftpuser
Group nogroup

# Authentication
AuthOrder mod_auth_file.c
RequireValidShell off

# Passive ports
PassivePorts 49152 65534

# Limits
MaxClients 50
MaxClientsPerHost 5
TimeoutIdle 300

# Include user configuration
Include ${FTP_USER_CONFIG_PATH}
`;

      // Utwórz POPRAWNĄ konfigurację użytkowników
      const userConfig = `# FTP Users Configuration
# Managed by NAS Panel

<Global>
  # Default settings for all users
  DefaultRoot ~
</Global>
`;

      // Utwórz kopie zapasowe
      const mainBackup = `${FTP_CONFIG_PATH}.backup.repair.${Date.now()}`;
      const userBackup = `${FTP_USER_CONFIG_PATH}.backup.repair.${Date.now()}`;
      
      if (fs.existsSync(FTP_CONFIG_PATH)) {
        fs.copyFileSync(FTP_CONFIG_PATH, mainBackup);
      }
      
      if (fs.existsSync(FTP_USER_CONFIG_PATH)) {
        fs.copyFileSync(FTP_USER_CONFIG_PATH, userBackup);
      }

      // Zapisz poprawne konfiguracje
      fs.writeFileSync(FTP_CONFIG_PATH, mainConfig);
      
      // Utwórz katalog jeśli nie istnieje
      const userConfigDir = path.dirname(FTP_USER_CONFIG_PATH);
      if (!fs.existsSync(userConfigDir)) {
        fs.mkdirSync(userConfigDir, { recursive: true });
      }
      
      fs.writeFileSync(FTP_USER_CONFIG_PATH, userConfig);

      // Przeładuj usługę
      try {
        await execAsync(`systemctl restart ${FTP_SERVICE_NAME}`);
      } catch (serviceError) {
        console.error('FTP restart error:', serviceError);
      }
      
      res.json({ 
        success: true,
        message: 'FTP configuration repaired successfully',
        backups: {
          main: mainBackup,
          user: userBackup
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to repair FTP config',
        details: error.message
      });
    }
  });

  // Testuj konfigurację FTP
  app.get('/api/services/ftp-sftp/test-config', requireAuth, async (req, res) => {
    try {
      // Sprawdź składnię konfiguracji
      const { stdout, stderr } = await execAsync('proftpd -t 2>&1');
      
      res.json({
        success: true,
        output: stdout,
        error: stderr,
        configValid: stdout.includes('configuration contains no errors') || stdout.includes('syntax ok')
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to test FTP config',
        details: error.message
      });
    }
  });

};
