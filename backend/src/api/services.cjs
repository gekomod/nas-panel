// src/api/samba.js
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const SAMBA_CONFIG_PATH = '/etc/samba/smb.conf';

async function isSambaInstalled() {
  try {
    await execAsync('which smbd');
    return true;
  } catch {
    return false;
  }
}

async function parseSmbConf() {
  try {
    const content = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
    const shares = [];
    let currentSection = null;
    let currentShare = {};

    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Sekcja [share] - poprawione wykrywanie
      const sectionMatch = trimmed.match(/^\s*\[([^\]]+)\]\s*$/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].trim();
        if (sectionName !== 'global' && sectionName !== 'homes' && sectionName !== 'printers') {
          // Zapisz poprzedni share jeśli istnieje
          if (currentSection && currentShare.name) {
            shares.push({ ...currentShare });
          }
          currentSection = sectionName;
          currentShare = { 
            name: currentSection,
            settings: {}
          };
          continue;
        }
      }
      
      // Parametry share'a
      if (currentSection && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=').map(s => s.trim());
        currentShare.settings[key.toLowerCase()] = value;
      }
    }
    
    // Dodaj ostatni share jeśli istnieje
    if (currentSection && currentShare.name) {
      shares.push(currentShare);
    }
    
    return shares;
  } catch (error) {
    console.error('Error parsing smb.conf:', error);
    return [];
  }
}

async function getSystemUsers() {
  try {
    const { stdout } = await execAsync('getent passwd | cut -d: -f1');
    return stdout.trim().split('\n').filter(user => 
      !user.startsWith('_') && user !== 'nobody' && user !== 'systemd-'
    );
  } catch (error) {
    console.error('Error getting system users:', error);
    return ['root'];
  }
}

module.exports = function(app, requireAuth) {
  // Shares CRUD
app.get('/services/samba/shares', requireAuth, async (req, res) => {
  try {
    const shares = await parseSmbConf();
    const users = await getSystemUsers();
    
    const formattedShares = shares.map(share => {
      const settings = share.settings;
      return {
        name: share.name,
        path: settings.path || '',
        comment: settings.comment || '',
        readOnly: settings['read only'] === 'yes' || settings.readonly === 'yes',
        browsable: settings.browsable !== 'no',
        validUsers: settings['valid users'] || settings.validusers || '',
        guestOk: settings['guest ok'] === 'yes' || settings.guestok === 'yes',
        createMask: settings['create mask'] || settings.createmask || '0664',
        directoryMask: settings['directory mask'] || settings.directorymask || '0775',
        available: true
      };
    });
    
    res.json({ 
      success: true, 
      data: formattedShares,
      users
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to read shares',
      details: error.message 
    });
  }
});

  app.post('/services/samba/shares', requireAuth, async (req, res) => {
    try {
      const { name, path, comment, readOnly, validUsers, guestOk, createMask, directoryMask } = req.body;
      
      // Walidacja
      if (!name || !path) {
        return res.status(400).json({ 
          success: false, 
          error: 'Name and path are required' 
        });
      }
      
      // Sprawdź czy share już istnieje
      const existingShares = await parseSmbConf();
      if (existingShares.some(s => s.name === name)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Share with this name already exists' 
        });
      }
      
      // Nowa konfiguracja z poprawionymi parametrami
const newShare = [
  `[${name}]`,
  `  path = ${path}`,
  comment ? `  comment = ${comment}` : '',
  `  read only = ${readOnly ? 'yes' : 'no'}`,
  `  browsable = yes`,
  `  guest ok = ${guestOk ? 'yes' : 'no'}`,
  `  create mask = ${createMask || '0664'}`,
  `  directory mask = ${directoryMask || '0775'}`,
  validUsers ? `  valid users = ${validUsers}` : ''
].filter(line => line.trim() !== '').join('\n');
      
      // Dodaj do pliku
      await fs.appendFile(SAMBA_CONFIG_PATH, '\n' + newShare + '\n');
      
      // Przeładuj konfigurację Samby
      try {
        await execAsync('sudo systemctl restart smbd');
      } catch (serviceError) {
        console.error('Error restarting Samba:', serviceError);
      }
      
      res.json({ 
        success: true, 
        message: 'Share added successfully',
        share: { 
          name, 
          path, 
          comment, 
          readOnly,
          validUsers,
          guestOk,
          createMask,
          directoryMask
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add share',
        details: error.message 
      });
    }
  });
  
  app.put('/services/samba/shares/:name', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const { path, comment, readOnly, validUsers, guestOk, createMask, directoryMask } = req.body;
      
      // Odczytaj cały plik
      let content = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
      const lines = content.split('\n');
      
      // Znajdź i zaktualizuj sekcję
      let startIndex = -1;
      let endIndex = -1;
      let inTargetSection = false;
      let found = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === `[${name}]`) {
          startIndex = i;
          inTargetSection = true;
          found = true;
          continue;
        }
        
        if (inTargetSection) {
          if (line.startsWith('[') && line.endsWith(']')) {
            endIndex = i - 1;
            break;
          }
          if (i === lines.length - 1) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (!found) {
        return res.status(404).json({ 
          success: false, 
          error: 'Share not found' 
        });
      }
      
      // Zbuduj zaktualizowaną sekcję
      const updatedShare = [
        `[${name}]`,
        `  path = ${path}`,
        `  comment = ${comment || 'Samba share'}`,
        `  read only = ${readOnly ? 'yes' : 'no'}`,
        `  browsable = yes`,
        `  guest ok = ${guestOk ? 'yes' : 'no'}`,
        `  create mask = ${createMask || '0664'}`,
        `  directory mask = ${directoryMask || '0775'}`,
        validUsers ? `  valid users = ${validUsers}` : ''
      ].filter(line => line.trim()).join('\n');
      
      // Zastąp starą sekcję nową
      const newLines = [];
      for (let i = 0; i < lines.length; i++) {
        if (i < startIndex || i > endIndex) {
          newLines.push(lines[i]);
        } else if (i === startIndex) {
          newLines.push(updatedShare);
        }
      }
      
      // Zapisz zaktualizowany plik
      await fs.writeFile(SAMBA_CONFIG_PATH, newLines.join('\n'));
      
      // Restartuj usługę
      try {
        await execAsync('systemctl restart smbd');
      } catch (serviceError) {
        console.warn('Warning: Could not restart Samba service:', serviceError.message);
      }
      
      res.json({ 
        success: true, 
        message: 'Share updated successfully' 
      });
    } catch (error) {
      console.error('Error updating share:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update share',
        details: error.message 
      });
    }
  });
  
  app.delete('/services/samba/shares/:name', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      
      // Odczytaj cały plik
      let content = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
      const lines = content.split('\n');
      
      // Znajdź sekcję do usunięcia
      let startIndex = -1;
      let endIndex = -1;
      let inTargetSection = false;
      let found = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Początek sekcji
        if (line === `[${name}]`) {
          startIndex = i;
          inTargetSection = true;
          found = true;
          continue;
        }
        
        // Koniec sekcji
        if (inTargetSection) {
          if (line.startsWith('[') && line.endsWith(']')) {
            endIndex = i - 1;
            break;
          }
          if (i === lines.length - 1) {
            endIndex = i;
            break;
          }
        }
      }
      
      // Jeśli nie znaleziono sekcji
      if (!found) {
        return res.status(404).json({ 
          success: false, 
          error: 'Share not found' 
        });
      }
      
      // Usuń sekcję
      const newLines = [];
      for (let i = 0; i < lines.length; i++) {
        if (i < startIndex || i > endIndex) {
          newLines.push(lines[i]);
        }
      }
      
      // Usuń nadmiarowe puste linie
      let cleanedContent = newLines.join('\n');
      cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();
      
      // Dodaj nową linię na końcu jeśli potrzeba
      if (!cleanedContent.endsWith('\n')) {
        cleanedContent += '\n';
      }
      
      // Zapisz zaktualizowany plik
      await fs.writeFile(SAMBA_CONFIG_PATH, cleanedContent);
      
      // Restartuj usługę
      try {
        await execAsync('systemctl restart smbd');
      } catch (serviceError) {
        console.warn('Warning: Could not restart Samba service:', serviceError.message);
      }
      
      res.json({ 
        success: true, 
        message: 'Share deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting share:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete share',
        details: error.message 
      });
    }
  });

  // Settings endpoints
  app.get('/services/samba/settings', requireAuth, async (req, res) => {
    try {
      const config = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
      
      // Parse global settings
      const globalSection = config.match(/\[global\]([\s\S]*?)(?=\n\[|\Z)/);
      const settings = {
        workgroup: 'WORKGROUP',
        security: 'user',
        interfaces: '',
        bindInterfacesOnly: false,
        logLevel: 1,
        serverString: '%h server (Samba)'
      };
      
      if (globalSection) {
        const lines = globalSection[1].split('\n');
        for (const line of lines) {
          if (line.includes('=')) {
            const [key, value] = line.split('=').map(s => s.trim());
            switch(key) {
              case 'workgroup':
                settings.workgroup = value;
                break;
              case 'security':
                settings.security = value;
                break;
              case 'interfaces':
                settings.interfaces = value;
                break;
              case 'bind interfaces only':
                settings.bindInterfacesOnly = value === 'yes';
                break;
              case 'log level':
                settings.logLevel = parseInt(value) || 1;
                break;
              case 'server string':
                settings.serverString = value;
                break;
            }
          }
        }
      }
      
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Error getting Samba settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get settings' });
    }
  });

  app.put('/services/samba/settings', requireAuth, async (req, res) => {
    try {
      if (!req.body?.settings) {
        return res.status(400).json({ success: false, error: 'Brak danych' });
      }

      const { settings } = req.body;
      const backupPath = `${SAMBA_CONFIG_PATH}.bak.${Date.now()}`;
      await fs.copyFile(SAMBA_CONFIG_PATH, backupPath);

      // Odczytaj cały plik
      let config = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');

      // 1. Aktualizuj sekcję [global]
      config = updateSection(config, 'global', {
        'workgroup': settings.workgroup || 'WORKGROUP',
        'server string': settings.serverString || '%h server (Samba)',
        'security': settings.security || 'user',
        'map to guest': 'Bad User',
        'interfaces': settings.interfaces || '',
        'bind interfaces only': settings.bindInterfacesOnly ? 'yes' : 'no',
        'log level': settings.logLevel?.toString() || '1',
        'log file': '/var/log/samba/log.%m',
        'max log size': '1000',
        'dns proxy': 'no'
      });

      // 2. Obsłuż sekcję [homes]
      if (settings.homes) {
        if (settings.homes.enabled) {
          config = updateSection(config, 'homes', {
            'comment': 'Home Directories',
            'browseable': settings.homes.browsable ? 'yes' : 'no',
            'read only': 'no',
            'create mask': '0700',
            'directory mask': '0700',
            'valid users': '%S',
            'inherit acls': settings.homes.inheritAcls ? 'yes' : 'no'
          });
        } else {
          // Usuń sekcję [homes] jeśli wyłączona
          config = config.replace(/(\n?\[homes\][\s\S]*?)(?=(\n\[|\Z))/g, '');
        }
      }

      // Zapisz zmiany
      await fs.writeFile(SAMBA_CONFIG_PATH, config);

      // Weryfikacja i restart
      try {
        await execAsync('testparm -s');
        await execAsync('systemctl restart smbd');
      } catch (error) {
        await fs.copyFile(backupPath, SAMBA_CONFIG_PATH);
        throw error;
      }

      res.json({ success: true, message: 'Konfiguracja zaktualizowana' });

    } catch (error) {
      console.error('Błąd:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Funkcja pomocnicza do aktualizacji sekcji
  function updateSection(config, sectionName, settings) {
    // 1. Usuń istniejącą sekcję
    const sectionRegex = new RegExp(`(\\n?\\[${sectionName}\\][\\s\\S]*?)(?=(\\n\\[|\\Z))`, 'g');
    config = config.replace(sectionRegex, '');

    // 2. Dodaj nową sekcję jeśli są ustawienia
    const settingsLines = [];
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && value !== '') {
        settingsLines.push(`  ${key} = ${value}`);
      }
    }

    if (settingsLines.length > 0) {
      config += `\n[${sectionName}]\n${settingsLines.join('\n')}\n`;
    }

    return config;
  }

  app.post('/services/samba/restart', requireAuth, async (req, res) => {
    try {
      await execAsync('systemctl restart smbd');
      res.json({ success: true, message: 'Samba service restarted' });
    } catch (error) {
      console.error('Error restarting Samba:', error);
      res.status(500).json({ success: false, error: 'Failed to restart Samba' });
    }
  });
  
  // Sprawdzenie statusu Samby
  app.get('/services/samba/status', requireAuth, async (req, res) => {
    try {
      const installed = await isSambaInstalled();
      
      if (!installed) {
        return res.json({ 
          installed: false,
          active: false,
          running: false
        });
      }

      // Check service status
      let isActive = false;
      try {
        const { stdout } = await execAsync('systemctl is-active smbd');
        isActive = stdout.trim() === 'active';
      } catch (error) {
        // systemctl returns non-zero exit code when service isn't active
        if (error.code === 3) {  // 3 means inactive
          isActive = false;
        } else {
          throw error;
        }
      }

      res.json({
        installed: true,
        active: isActive,
        running: isActive
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to check Samba status',
        details: error.message
      });
    }
  });

  // Włącz/Wyłącz Sambę
  app.post('/services/samba/toggle', requireAuth, async (req, res) => {
    let action;
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body'
        });
      }

      action = req.body.action;
      
      if (!action || !['start', 'stop'].includes(action)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action - use "start" or "stop"'
        });
      }

      const { stdout } = await execAsync(`systemctl ${action} smbd`);
      
      return res.json({ 
        success: true,
        message: `Samba ${action === 'start' ? 'started' : 'stopped'} successfully`,
        output: stdout.trim()
      });

    } catch (error) {
      console.error(`Error ${action ? action : 'action'} Samba:`, error);
      
      const errorResponse = {
        success: false,
        error: `Failed to ${action ? action : 'perform action on'} Samba`,
        details: error.message
      };

      if (error.stderr) {
        errorResponse.stderr = error.stderr.trim();
      }

      if (!res.headersSent) {
        return res.status(500).json(errorResponse);
      } else {
        console.error('Headers already sent, cannot send error response');
      }
    }
  });

  // Instalacja Samby
  app.post('/services/samba/install', requireAuth, async (req, res) => {
    try {
      const { stdout, stderr } = await execAsync('sudo apt install samba -y');
      res.json({ 
        success: true,
        message: 'Samba installed successfully',
        output: stdout 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Installation failed',
        details: error.message 
      });
    }
  });

  app.get('/services/samba/settings/homedirs', requireAuth, async (req, res) => {
    try {
      const config = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
      const homesSection = config.match(/\[homes\]([\s\S]*?)(?=\n\[|\Z)/);
      
      const settings = {
        enabled: homesSection !== null,
        browsable: true,
        inheritAcls: true
      };
      
      if (homesSection) {
        const lines = homesSection[1].split('\n');
        for (const line of lines) {
          if (line.includes('=')) {
            const [key, value] = line.split('=').map(s => s.trim());
            if (key === 'browseable') {
              settings.browsable = value !== 'no';
            }
            if (key === 'inherit acls') {
              settings.inheritAcls = value !== 'no';
            }
          }
        }
      }

      res.json({ success: true, data: settings });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/services/samba/settings/homedirs', requireAuth, async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid request body' 
        });
      }

      // Read current config
      let config = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
      
      // Remove ALL existing [homes] sections
      config = config.replace(/(\n?\[homes\].*?)(?=(\n\[|\Z))/gs, '');
      
      // Add new section if enabled
      if (req.body.enabled) {
        const homesSection = generateHomesSection(req.body);
        config += homesSection;
      }

      // Write new config
      await fs.writeFile(SAMBA_CONFIG_PATH, config);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating home dir settings:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update settings',
        details: error.message 
      });
    }
  });

  app.get('/services/samba/users', requireAuth, async (req, res) => {
    try {
      const users = await getSystemUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  function generateHomesSection(settings) {
    return `
[homes]
   comment = Home Directories
   browseable = ${settings.browsable ? 'yes' : 'no'}
   read only = no
   create mask = 0700
   directory mask = 0700
   ${settings.inheritAcls ? 'inherit acls = yes' : 'inherit acls = no'}
   valid users = %S
`;
  }
};
