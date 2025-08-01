const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = function(app, requireAuth) {

 // Middleware sprawdzający czy użytkownik jest w grupie root
const requireRootGroup = async (req, res, next) => {
  if (!req.session.authenticated || !req.session.username) {
    return res.status(401).json({ error: 'Nieautoryzowany dostęp' });
  }

  try {
    const groups = await getGroups(req.session.username);
    if (!groups.includes('root')) {
      return res.status(403).json({ error: 'Wymagane członkostwo w grupie root' });
    }
    next();
  } catch (error) {
    console.error('Błąd sprawdzania grup:', error);
    res.status(500).json({ error: 'Błąd serwera podczas weryfikacji uprawnień' });
  }
};

// Endpointy zarządzania użytkownikami
app.get('/api/system/users', requireAuth, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Pobierz wszystkich użytkowników systemu
    const { stdout } = await execAsync('getent passwd');
    const users = stdout.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const parts = line.split(':');
        return {
          id: parseInt(parts[2]), // UID
          username: parts[0],
          homeDir: parts[5],
          shell: parts[6]
        };
      });

    // Dla każdego użytkownika pobierz dodatkowe informacje
    const usersWithDetails = await Promise.all(users.map(async user => {
      try {
        const { stdout: groupsStdout } = await execAsync(`groups ${user.username}`);
        const groups = groupsStdout.split(':')[1].trim().split(' ');
        
        return {
          ...user,
          groups,
          isAdmin: groups.includes('root')
        };
      } catch (error) {
        return {
          ...user,
          groups: [],
          isAdmin: false
        };
      }
    }));

    res.json(usersWithDetails);
  } catch (error) {
    console.error('Błąd pobierania użytkowników:', error);
    res.status(500).json({ error: 'Błąd pobierania listy użytkowników' });
  }
});

app.post('/api/system/users', requireAuth, async (req, res) => {
  try {
    const { username, password, isAdmin, groups } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Nazwa użytkownika i hasło są wymagane' });
    }

    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Sprawdź czy użytkownik już istnieje
    try {
      await execAsync(`id -u ${username}`);
      return res.status(400).json({ error: 'Użytkownik już istnieje' });
    } catch (e) {
      // Użytkownik nie istnieje - kontynuuj
    }

    // Utwórz użytkownika
    await execAsync(`useradd -m ${username}`);
    
    // Ustaw hasło
    await execAsync(`echo "${username}:${password}" | chpasswd`);

    // Dodaj do grup
    const allGroups = [...(groups || [])];
    if (isAdmin && !allGroups.includes('root')) {
      allGroups.push('root');
    }

    if (allGroups.length > 0) {
      await execAsync(`usermod -aG ${allGroups.join(',')} ${username}`);
    }

    res.json({ success: true, message: `Użytkownik ${username} został utworzony` });
  } catch (error) {
    console.error('Błąd tworzenia użytkownika:', error);
    res.status(500).json({ error: 'Błąd tworzenia użytkownika' });
  }
});

app.put('/api/system/users/:username', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { password, isAdmin, groups } = req.body;

    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Sprawdź czy użytkownik istnieje
    try {
      await execAsync(`id -u ${username}`);
    } catch (e) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    // Zmień hasło jeśli podane
    if (password) {
      await execAsync(`echo "${username}:${password}" | chpasswd`);
    }

    // Przygotuj listę wszystkich grup
    const allGroups = [...(groups || [])];
    if (isAdmin && !allGroups.includes('root')) {
      allGroups.push('root');
    } else if (!isAdmin) {
      // Usuń root jeśli użytkownik nie ma być adminem
      const rootIndex = allGroups.indexOf('root');
      if (rootIndex !== -1) {
        allGroups.splice(rootIndex, 1);
      }
    }

    // Aktualizuj grupy
    const { stdout: currentGroupsStdout } = await execAsync(`groups ${username}`);
    const currentGroups = currentGroupsStdout.split(':')[1].trim().split(' ');
    
    // Usuń użytkownika ze wszystkich grup (oprócz jego podstawowej)
    for (const group of currentGroups) {
      if (group !== username) { // Podstawowa grupa ma zwykle taką samą nazwę jak użytkownik
        await execAsync(`gpasswd -d ${username} ${group}`).catch(() => {});
      }
    }
    
    // Dodaj do nowych grup
    if (allGroups.length > 0) {
      await execAsync(`usermod -aG ${allGroups.join(',')} ${username}`);
    }

    res.json({ success: true, message: `Użytkownik ${username} został zaktualizowany` });
  } catch (error) {
    console.error('Błąd aktualizacji użytkownika:', error);
    res.status(500).json({ error: 'Błąd aktualizacji użytkownika' });
  }
});

app.delete('/api/system/users/:username', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;

    // Nie pozwól usunąć obecnie zalogowanego użytkownika
    if (username === req.session.username) {
      return res.status(400).json({ error: 'Nie możesz usunąć swojego własnego konta' });
    }

    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Sprawdź czy użytkownik istnieje
    try {
      await execAsync(`id -u ${username}`);
    } catch (e) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    // Usuń użytkownika wraz z katalogiem domowym
    await execAsync(`userdel -r ${username}`);

    res.json({ success: true, message: `Użytkownik ${username} został usunięty` });
  } catch (error) {
    console.error('Błąd usuwania użytkownika:', error);
    res.status(500).json({ error: 'Błąd usuwania użytkownika' });
  }
});

app.get('/api/system/groups', requireAuth, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // Pobierz wszystkie grupy systemowe
    const { stdout } = await execAsync('getent group');
    const groups = stdout.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const parts = line.split(':');
        return {
          name: parts[0],
          gid: parseInt(parts[2]),
          members: parts[3] ? parts[3].split(',') : []
        };
      });

    res.json(groups);
  } catch (error) {
    console.error('Błąd pobierania grup:', error);
    res.status(500).json({ error: 'Błąd pobierania listy grup' });
  }
});

};
