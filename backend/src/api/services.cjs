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
      
      // Sekcja [share]
      const sectionMatch = trimmed.match(/^\[(.*?)\]/);
      if (sectionMatch && sectionMatch[1] !== 'global') {
        if (currentSection && currentShare.name) {
          shares.push(currentShare);
        }
        currentSection = sectionMatch[1];
        currentShare = { name: currentSection };
        continue;
      }
      
      // Parametry share'a
      if (currentSection && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=').map(s => s.trim());
        currentShare[key] = value;
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

module.exports = function(app, requireAuth) {
  // Shares CRUD
  app.get('/services/samba/shares', requireAuth, async (req, res) => {
    try {
      const shares = await parseSmbConf();
      res.json({ 
        success: true, 
        data: shares.map(share => ({
          name: share.name,
          path: share.path || '',
          comment: share.comment || '',
          readOnly: share.readonly === 'yes' || share['read only'] === 'yes',
          available: true
        }))
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
      const { name, path, comment, readOnly } = req.body;
      
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
      
      // Nowa konfiguracja
      const newShare = [
        `[${name}]`,
        `  path = ${path}`,
        `  comment = ${comment || 'Samba share'}`,
        `  read only = ${readOnly ? 'yes' : 'no'}`,
        `  browsable = yes`,
        `  guest ok = no`,
        `  create mask = 0664`,
        `  directory mask = 0775`,
        `  valid users = @users`
      ].join('\n');
      
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
        share: { name, path, comment, readOnly }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add share',
        details: error.message 
      });
    }
  });
  
app.delete('/services/samba/shares/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Odczytaj cały plik
    const content = await fs.readFile(SAMBA_CONFIG_PATH, 'utf8');
    const lines = content.split('\n');
    
    // Znajdź sekcję do usunięcia
    let startIndex = -1;
    let endIndex = -1;
    let inTargetSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Początek sekcji
      if (line === `[${name}]`) {
        startIndex = i;
        inTargetSection = true;
        continue;
      }
      
      // Koniec sekcji (następna sekcja lub koniec pliku)
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
    if (startIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Share not found' 
      });
    }
    
    // Usuń sekcję
    const updatedLines = [
      ...lines.slice(0, startIndex),
      ...lines.slice(endIndex + 1)
    ];
    
    // Zapisz zaktualizowany plik
    await fs.writeFile(SAMBA_CONFIG_PATH, updatedLines.join('\n'));
    
    // Przeładuj konfigurację Samby
    try {
      await execAsync('sudo systemctl restart smbd');
    } catch (serviceError) {
      console.error('Error restarting Samba:', serviceError);
    }
    
    res.json({ 
      success: true, 
      message: 'Share deleted successfully' 
    });
  } catch (error) {
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
      const { stdout } = await execAsync('testparm -s --section-name="global" -l');
      // Parse global settings from stdout
      const settings = {
        workgroup: 'WORKGROUP', // parsed from config
        security: 'user',
        interfaces: 'eth0',
        // other settings...
      };
      
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
      'security': settings.security || 'user',
      'interfaces': settings.interfaces || 'eth0',
      'bind interfaces only': settings.bindInterfacesOnly ? 'yes' : 'no',
      'log level': settings.logLevel ?? 1,
      'server string': '%h server (Samba, Ubuntu)',
      'log file': '/var/log/samba/log.%m',
      'max log size': '1000',
      'logging': 'file',
      'panic action': '/usr/share/samba/panic-action %d',
      'server role': 'standalone server',
      'obey pam restrictions': 'yes',
      'unix password sync': 'yes',
      'passwd program': '/usr/bin/passwd %u',
      'passwd chat': '*Enter\\snew\\s*\\spassword:* %n\\n *Retype\\snew\\s*\\spassword:* %n\\n *password\\supdated\\ssuccessfully* .',
      'pam password change': 'yes',
      'map to guest': 'bad user',
      'usershare allow guests': 'yes'
    });

    // 2. Obsłuż sekcję [homes]
    if (settings.homes) {
      if (settings.homes.enabled) {
        config = updateSection(config, 'homes', {
          'browseable': settings.homes.browsable ? 'yes' : 'no',
          'read only': 'no',
          'create mask': '0700',
          'directory mask': '0700',
          'inherit acls': settings.homes.inheritAcls ? 'yes' : 'no',
          'inherit permissions': settings.homes.inheritPermissions ? 'yes' : undefined,
          'follow symlinks': settings.homes.followSymlinks ? 'yes' : 'no',
          'wide links': settings.homes.wideLinks ? 'yes' : undefined,
          'vfs objects': settings.homes.enableRecycleBin ? 'recycle' : undefined
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
    if (value !== undefined) {
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
    try {
      await execAsync('which smbd');
    } catch {
      return res.json({ 
        success: false,
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
    // Walidacja wejścia
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }

    action = req.body.action;
    console.log(action);
    
    if (!action || !['start', 'stop'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action - use "start" or "stop"'
      });
    }

    // Wykonaj komendę
    const { stdout } = await execAsync(`systemctl ${action} smbd`);
    
    // Pojedyncza odpowiedź sukcesu
    return res.json({ 
      success: true,
      message: `Samba ${action === 'start' ? 'started' : 'stopped'} successfully`,
      output: stdout.trim()
    });

  } catch (error) {
    // Obsługa błędów z gwarancją pojedynczej odpowiedzi
    console.error(`Error ${action ? action : 'action'} Samba:`, error);
    
    const errorResponse = {
      success: false,
      error: `Failed to ${action ? action : 'perform action on'} Samba`,
      details: error.message
    };

    if (error.stderr) {
      errorResponse.stderr = error.stderr.trim();
    }

    // Bezpieczna odpowiedź z sprawdzeniem czy nie została już wysłana
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
    
    const settings = {
      enabled: config.includes('[homes]'),
      enableUserHomes: config.includes('browseable = yes'),
      browsable: !config.includes('browseable = no'),
      inheritAcls: !config.includes('inherit acls = no'),
      inheritPermissions: config.includes('inherit permissions = yes'),
      enableRecycleBin: config.includes('vfs objects = recycle'),
      followSymlinks: !config.includes('follow symlinks = no'),
      wideLinks: config.includes('wide links = yes')
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/services/samba/settings/homedirs', requireAuth, async (req, res) => {
  try {
    // Validate input
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

  app.get('/api/services/status/:service', async (req, res) => {
    const { service } = req.params
    
    try {
      // Sprawdź status usługi (dla systemd)
      const { stdout } = await execAsync(`systemctl is-active ${service}`)
      
      res.json({
        success: true,
        active: stdout.trim() === 'active',
        service
      })
    } catch (error) {
      res.json({
        success: true,
        active: false,
        service,
        error: error.stderr || error.message
      })
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
   ${settings.inheritPermissions ? 'inherit permissions = yes' : ''}
   ${settings.followSymlinks ? 'follow symlinks = yes' : 'follow symlinks = no'}
   ${settings.wideLinks ? 'wide links = yes' : ''}
   ${settings.enableRecycleBin ? 'vfs objects = recycle\n   recycle:repository = .recycle/%U\n   recycle:keeptree = yes\n   recycle:versions = yes' : ''}
`;
}

};
