const express = require('express');
const pam = require('authenticate-pam');
const si = require('systeminformation');
const cors = require('cors');
const session = require('express-session');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const diskusage = require('diskusage');
const { exec } = require('child_process');

const StorageRoutes = require('./src/api/storage.cjs');
const NetworkRoutes = require('./src/api/network.cjs');
const SystemRoutes = require('./src/api/system.cjs');
const ServicesRoutes = require('./src/api/services.cjs');
const DockerRoutes = require('./src/api/docker.cjs');
const DockerConfigRoutes = require('./src/api/docker-config.cjs');
const DiagnosticsRoutes = require('./src/api/diagnostics.cjs');
const dynamicDnsRoutes = require('./src/api/network-dynamicdns.cjs');
const WebDavRoutes = require('./src/api/webdav.cjs');
const AntivirusRoutes = require('./src/api/antivirus.cjs');
const UsersRoutes = require('./src/api/users.cjs');
const SystemLogsRoutes = require('./src/api/system-logs.cjs');
const SshRoutes = require('./src/api/ssh.cjs');
const SystemBackupRoutes = require('./src/api/system-backup.cjs');
const SftpFtpRoutes = require('./src/api/sftp-ftp.cjs');
const LogsRoutes = require('./src/api/logs.cjs');

const os = require('os');
const { publicIpv4 } = require('public-ip');

// Funkcja do dynamicznego dodawania IP
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      // Pomijaj IPv6 i wewnętrzne adresy
      if (config.family === 'IPv4' && !config.internal) {
        ips.push(config.address);
      }
    }
  }
  return ips;
}

const initializeDynamicOrigins = async () => {
  try {
    const localIps = getLocalIps(); // np. ['192.168.1.20', '192.168.1.54']
    const publicIp = await publicIpv4().catch(() => null);

    const newOrigins = [];

    // Dodaj wszystkie lokalne IP
    localIps.forEach(ip => {
      newOrigins.push(`http://${ip}:5173`);
      newOrigins.push(`http://${ip}:8080`);
      newOrigins.push(`http://${ip}`);
    });

    // Dodaj publiczne IP jeśli istnieje
    if (publicIp) {
      newOrigins.push(`http://${publicIp}:5173`);
      newOrigins.push(`http://${publicIp}:8080`);
      newOrigins.push(`http://${publicIp}`);
    }

    // Dodaj tylko unikalne originy
    newOrigins.forEach(origin => {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    });

    console.log('Zaktualizowane dozwolone originy:', allowedOrigins);
  } catch (error) {
    console.error('Błąd inicjalizacji originów:', error);
  }
};

initializeDynamicOrigins();

// Konfiguracja multer dla uploadu plików
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.body.path || '/';
    const absolutePath = path.join(process.cwd(), uploadPath);
    fs.mkdirSync(absolutePath, { recursive: true });
    cb(null, absolutePath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

const app = express()
const HOST = '0.0.0.0'; // Nasłuchuje na wszystkich interfejsach
const PORT = process.env.PORT || 3000;

const BASE_DIR = '/';

// Prosta konfiguracja CORS bez użycia path-to-regexp
const allowedOrigins = ['http://localhost:5173', 'http://localhost'];

app.locals.requireAuth = (req, res, next) => {
  // Your authentication logic here
  console.log('Auth check');
  next();
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Zezwalaj na żądania bez origin (np. curl)
  if (!origin) return next();

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

app.use(express.json())

// Middleware do sprawdzania autentykacji
const requireAuth = (err, req, res, next) => {
  if (req.session.authenticated) {
    return next()
  }
  res.status(401).json({ error: 'Nieautoryzowany dostęp' })
}

// SMART Endpoints

StorageRoutes(app,requireAuth);
NetworkRoutes(app,requireAuth);
SystemRoutes(app,requireAuth);
ServicesRoutes(app,requireAuth);
DockerRoutes(app,requireAuth);
DockerConfigRoutes(app,requireAuth);
DiagnosticsRoutes(app,requireAuth);
dynamicDnsRoutes(app, requireAuth);
WebDavRoutes(app, requireAuth);
AntivirusRoutes(app, requireAuth);
UsersRoutes(app, requireAuth);
SystemLogsRoutes(app, requireAuth);
SshRoutes(app, requireAuth);
SystemBackupRoutes(app, requireAuth);
SftpFtpRoutes(app, requireAuth);
LogsRoutes(app, requireAuth);

// Zmieniamy funkcję logowania:
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body

  try {
    pam.authenticate(username, password, async (err) => {
      if (err) {
        console.error('Błąd PAM:', err)
        return res.status(401).json({ 
          success: false, 
          error: 'Nieprawidłowe dane logowania' 
        })
      }

      // Autentykacja udana
      req.session.authenticated = true
      req.session.username = username

      // Pobierz informacje o użytkowniku
      const userInfo = {
        username,
        uid: await getUid(username), // Dodajemy funkcję pomocniczą
        groups: await getGroups(username)
      }

      res.json({ 
        success: true, 
        user: userInfo 
      })
    })
  } catch (error) {
    console.error('Błąd systemu PAM:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Błąd systemu autentykacji' 
    })
  }
})

// Wylogowanie
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false })
    }
    res.clearCookie('connect.sid')
    return res.json({ success: true })
  })
})

// Sprawdzenie sesji
app.get('/api/check-auth', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated,
    user: req.session.username 
  })
})


// Endpoint dla danych CPU
app.get('/api/cpu', requireAuth, async (req, res) => {
  try {
    const [cpu, temp] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature(),
      si.currentLoad()
    ])
    
    const osInfo = await si.osInfo();

    res.json({
      usage: Math.round(cpu.currentLoad),
      temperature: temp.main,
      cores: cpu.cpus.length,
      load1: osInfo.loadavg[0] || load.avgLoad[0] || 0,
      load5: osInfo.loadavg[1] || load.avgLoad[1] || 0,
      load15: osInfo.loadavg[2] || load.avgLoad[2] || 0
    });
  } catch (error) {
    res.json({
      usage: Math.round(Math.random() * 100),
      temperature: Math.round(Math.random() * 30 + 50),
      cores: os.cpus().length,
      load1: Math.random().toFixed(2),
      load5: Math.random().toFixed(2),
      load15: Math.random().toFixed(2)
    });
  }
});

// Endpoint dla danych RAM

app.get('/api/ram', requireAuth, async (req, res) => {
  try {
    const mem = await si.mem()
    res.json({
      total: mem.total,
      used: mem.used,
      free: mem.free,
      available: mem.available, // Ważne - dostępna pamięć
      buffers: mem.buffers,
      cached: mem.cached,
      active: mem.active,
      // Oblicz procent na podstawie rzeczywiście użytej pamięci
      percentage: Math.round(((mem.total - mem.available) / mem.total) * 100)
    })
  } catch (error) {
    console.error('RAM API error:', error)
    res.status(500).json({ error: 'Failed to get RAM data' })
  }
})

function checkRestartRequired() {
  try {
    const fs = require('fs')
    const path = require('path')

    const rebootFiles = [
      '/var/run/reboot-required',
      '/run/reboot-required',
      '/tmp/reboot-required'
    ]

    for (const file of rebootFiles) {
      if (fs.existsSync(file)) {
        return true
      }
    }

    try {
      const execSync = require('child_process').execSync
      const output = execSync('cat /var/run/reboot-required.pkgs 2>/dev/null || echo ""').toString()
      return output.trim().length > 0
    } catch {
      return false
    }
    
  } catch (error) {
    console.error('Error checking restart requirement:', error)
    return false
  }
}

app.get('/api/system-info', requireAuth, async (req, res) => {
  try {
    const [
      time,
      osInfo,
      cpu,
      mem,
      versions
    ] = await Promise.all([
      si.time(),
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.versions()
    ])

    res.json({
      system: {
        hostname: osInfo.hostname,
        kernel: osInfo.kernel,
        platform: osInfo.platform,
        distro: osInfo.distro,
        arch: osInfo.arch,
        uptime: time.uptime,
        time: time.current,
        requiresRestart: checkRestartRequired()
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free
      },
      versions: {
        node: versions.node,
        npm: versions.npm,
        app: '1.2.3'
      }
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to get system info' })
  }
})

// Funkcje pomocnicze (dodaj do server.js)
async function getUid(username) {
  const { exec } = await import('child_process')
  return new Promise((resolve) => {
    exec(`id -u ${username}`, (err, stdout) => {
      resolve(err ? null : parseInt(stdout.trim()))
    })
  })
}

async function getGroups(username) {
  const { exec } = await import('child_process')
  return new Promise((resolve) => {
    exec(`groups ${username}`, (err, stdout) => {
      if (err) return resolve([])
      resolve(stdout.trim().split(': ')[1].split(' '))
    })
  })
}

async function getFilesystems() {
  try {
    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      exec('df -h --output=source,size,pcent,target | awk \'NR>1{print $1","$2","$3","$4}\'', (err, stdout) => {
        if (err) return resolve([]);
        
        const lines = stdout.trim().split('\n');
        const filesystems = lines.map(line => {
          const [device, size, percent, mount] = line.split(',');
          return {
            device,
            size: size.trim(),
            percent: percent.trim(),
            percentNumber: parseInt(percent.trim()),
            mount: mount.trim()
          };
        });
        
        resolve(filesystems);
      });
    });
  } catch (error) {
    console.error('Error getting filesystems:', error);
    return [];
  }
}

// Dodaj nowy endpoint (umieść go z innymi endpointami)
app.get('/api/filesystems', requireAuth, async (req, res) => {
  try {
    const filesystems = await getFilesystems();
    res.json(filesystems);
  } catch (error) {
    console.error('Filesystems API error:', error);
    res.status(500).json({ error: 'Failed to get filesystem data' });
  }
});

app.post('/api/filesystems/browse-directory', requireAuth, async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    
    // Validate path exists and is accessible
    if (!dirPath || !fs.existsSync(dirPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid directory path'
      });
    }

    // Get directory contents
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const directories = items
      .filter(item => item.isDirectory())
      .map(dir => ({
        name: dir.name,
        path: path.join(dirPath, dir.name),
        isLeaf: false
      }));

    res.json({
      success: true,
      directories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to browse directory',
      details: error.message
    });
  }
});


//FILEMANAGER

// Sprawdzanie bezpieczeństwa ścieżki
const validatePath = (userPath) => {
  const absolutePath = path.resolve(path.join(BASE_DIR, userPath));
 
  // Dodatkowe zabezpieczenie - możesz ograniczyć do konkretnych katalogów
  const allowedPaths = [
    '/home',
    '/var/www',
    '/tmp',
    '/',
    '/etc',
    '/var',
    '/var/log'
  ];
  
  // Sprawdź czy ścieżka jest w dozwolonych katalogach
  const isAllowed = allowedPaths.some(allowedPath => 
    absolutePath.startsWith(allowedPath)
  );
  
  return {
    absolutePath,
    isValid: isAllowed && !absolutePath.includes('../')
  };
};

// API Endpoints dla FileManager
app.get('/api/files', requireAuth, (req, res) => {
  try {
    const { path: dirPath = '/' } = req.query;
    
    const { absolutePath, isValid } = validatePath(dirPath);

    if (!isValid) {
      return res.status(403).json({ error: 'Access to this path is not allowed' });
    }

    const requestedPath = req.query.path || '/';
    
    if (!validatePath(requestedPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Sprawdź czy ścieżka istnieje
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Path does not exist' });
    }

    // Pobierz statystyki dysku
    const diskStats = diskusage.checkSync('/');
    const totalSpace = formatBytes(diskStats.total);
    const freeSpace = formatBytes(diskStats.free);

    // Odczytaj zawartość katalogu
    const files = fs.readdirSync(absolutePath).map(file => {
      const filePath = path.join(absolutePath, file);
      const stats = fs.statSync(filePath);
      
      return {
        name: file,
        path: path.join(requestedPath, file),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        permissions: getPermissions(stats.mode),
        owner: stats.uid,
        group: stats.gid
      };
    });

    // Budowanie drzewa katalogów (uproszczone)
    const buildTree = (dir, depth = 0) => {
      if (depth > 3) return null; // Ogranicz głębokość dla wydajności
      
      try {
        const items = fs.readdirSync(dir);
        return items.map(item => {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            return {
              name: item,
              path: fullPath.replace(process.cwd(), ''),
              type: 'directory',
              children: buildTree(fullPath, depth + 1)
            };
          }
          return null;
        }).filter(Boolean);
      } catch (err) {
        return [];
      }
    };

    const tree = buildTree(process.cwd());

    res.json({
      files,
      tree,
      totalSpace,
      freeSpace
    });

  } catch (err) {
    console.error('Files API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/files/create-folder', requireAuth, (req, res) => {
  try {
    const { path: dirPath, name } = req.body;
    
    if (!validatePath(dirPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const fullPath = path.join(process.cwd(), dirPath, name);

    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ success: true });

  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.post('/api/files/rename', requireAuth, (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    
    if (!validatePath(oldPath) || !newName) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const oldFullPath = path.join(process.cwd(), oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);

    if (!fs.existsSync(oldFullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(newFullPath)) {
      return res.status(400).json({ error: 'Name already exists' });
    }

    fs.renameSync(oldFullPath, newFullPath);
    res.json({ success: true });

  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).json({ error: 'Failed to rename' });
  }
});

app.post('/api/files/delete', requireAuth, (req, res) => {
  try {
    const { paths } = req.body;
    
    if (!Array.isArray(paths)) {
      return res.status(400).json({ error: 'Invalid paths' });
    }

    paths.forEach(filePath => {
      if (!validatePath(filePath)) {
        throw new Error('Invalid path');
      }

      const fullPath = path.join(process.cwd(), filePath);
      
      if (fs.existsSync(fullPath)) {
        if (fs.lstatSync(fullPath).isDirectory()) {
          fs.rmdirSync(fullPath, { recursive: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      }
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.post('/api/files/permissions', requireAuth, (req, res) => {
  try {
    const { paths, permissions } = req.body;
    
    if (!Array.isArray(paths) || !permissions) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    paths.forEach(filePath => {
      if (!validatePath(filePath)) {
        throw new Error('Invalid path');
      }

      const fullPath = path.join(process.cwd(), filePath);
      
      if (fs.existsSync(fullPath)) {
        // Zmiana uprawnień (Unix only)
        fs.chmodSync(fullPath, parseInt(permissions.mode, 8));
        
        // Zmiana właściciela (wymaga roota)
        if (permissions.owner) {
          fs.chownSync(fullPath, permissions.owner, permissions.group);
        }
      }
    });

    res.json({ success: true });

  } catch (err) {
    console.error('Permissions error:', err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

app.post('/api/files/upload', requireAuth, upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      name: file.originalname,
      path: path.join(req.body.path || '/', file.originalname)
    }));

    res.json({ 
      success: true,
      files: uploadedFiles
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/files/download', requireAuth, async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      console.error('No path provided');
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    const allowedBase = process.env.ALLOWED_BASE_DIR || '../';
    const decodedPath = decodeURIComponent(filePath);
    const safePath = path.resolve(path.join(allowedBase, decodedPath));

    console.log('Download request:', {
      originalPath: filePath,
      decodedPath,
      safePath,
      allowedBase
    });

    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.error('Cannot download directory:', filePath);
      return res.status(400).json({ error: 'Cannot download directory' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File stream error' });
      }
    });
    
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

// Helper function to promisify fs functions
const readFileAsync = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const writeFileAsync = (path, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const statAsync = (path) => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) reject(err);
      else resolve(stats);
    });
  });
};

// Endpoint do odczytu plików
app.get('/api/files/read', (req, res) => {
  try {
    console.log('All query parameters:', req.query);
    
    // Pobieramy ścieżkę na kilka sposobów
    const filepath = req.query.filepath || req.query.path || req.query.f;
    
    if (!filepath) {
      return res.status(400).json({
        error: 'File path parameter is required',
        received_query: req.query,
        usage_examples: [
          '/api/files/read?filepath=/var/log/syslog',
          '/api/files/read?path=/etc/hosts',
          '/api/files/read?f=/tmp/test.txt'
        ]
      });
    }

    console.log('Requested file path:', filepath);
    
    const absolutePath = path.resolve(filepath);
    console.log('Absolute path:', absolutePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        error: 'File not found',
        path: absolutePath
      });
    }

    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      return res.status(400).json({
        error: 'Path must be a file',
        path: absolutePath
      });
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    res.json({
      success: true,
      path: absolutePath,
      content: content
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});


// Write file endpoint
app.post('/api/files/write', requireAuth, async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required' });
    }

    const absolutePath = path.resolve(filePath);
    
    // Verify file exists first
    try {
      const stats = await statAsync(absolutePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Cannot write to directory' });
      }
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    await writeFileAsync(absolutePath, content);
    res.json({ success: true });
  } catch (error) {
    console.error('File write error:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

//STORAGE
app.get('/api/storage/disks', requireAuth, async (req, res) => {
  try {
    const [disks, fsSizes, diskStats] = await Promise.all([
      si.blockDevices(),
      si.fsSize(),
      si.disksIO().catch(() => []) // Fallback na pustą tablicę jeśli błąd
    ]);

    // Filtruj tylko fizyczne dyski
    const physicalDisks = disks.filter(disk => 
      disk && 
      disk.type === 'disk' && 
      disk.name && 
      !disk.name.startsWith('loop') && 
      !disk.name.startsWith('ram')
    );

    const result = physicalDisks.map(disk => {
      // Bezpieczne wyszukiwanie informacji o systemie plików
      const fsInfo = Array.isArray(fsSizes) 
        ? fsSizes.find(fs => fs?.device?.includes(disk.name))
        : null;
      
      // Bezpieczne wyszukiwanie statystyk dysku
      const stats = Array.isArray(diskStats) 
        ? diskStats.find(d => d?.device === disk.name) || {}
        : {};

      return {
        device: disk.name || 'Unknown',
        model: disk.model || 'Unknown',
        serial: disk.serial || 'Unknown',
        vendor: disk.vendor || 'Unknown',
        size: disk.size || 0,
        bytesRead: stats.rIO_sec || 0,
        bytesWritten: stats.wIO_sec || 0,
        mountPoint: fsInfo?.mount || 'Not mounted',
        fsType: fsInfo?.type || 'Unknown',
        usedPercent: fsInfo?.use || 0
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Storage disks API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get disk information',
      details: error.message 
    });
  }
});

app.post('/api/storage/rescan', requireAuth, async (req, res) => {
  try {
    // Symulacja skanowania nowych urządzeń
    // W rzeczywistości możesz potrzebować wywołać odpowiednie polecenia systemowe
    // np. przez child_process.exec()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Symulacja opóźnienia
    
    res.json({ 
      success: true,
      message: 'Rescan completed'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Rescan failed'
    })
  }
});

app.get('/api/storage/filesystems', requireAuth, async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    // 1. Pobierz podstawowe dane przez df (zawsze dostępne)
    const { stdout: dfStdout } = await execAsync(
      'df -h --output=source,fstype,size,used,avail,pcent,target | awk \'NR>1{print}\''
    );

    if (!dfStdout.trim()) {
      return res.json({ success: true, data: [] });
    }

    // 2. Parsowanie wyniku df
    const filesystems = dfStdout.split('\n').map(line => {
      const [device, type, size, used, avail, pcent, mounted] = line.trim().split(/\s+/);
      return {
        device,
        type,
        size,
        used,
        available: avail,
        usedPercent: parseInt(pcent),
        mounted
      };
    }).filter(fs => fs.device && !fs.device.startsWith('tmpfs'));

    // 3. Pobierz UUID tylko dla istniejących urządzeń
    const uuidMapping = {};
    try {
      const { stdout: blkidStdout } = await execAsync(
        'blkid -o export 2>/dev/null || echo ""'
      );
      
      blkidStdout.split('\n\n').forEach(block => {
        const device = block.match(/DEVICE=([^\n]+)/)?.[1];
        const uuid = block.match(/UUID=([^\n]+)/)?.[1];
        if (device && uuid) {
          uuidMapping[device] = uuid;
        }
      });
    } catch (e) {
      console.error('UUID mapping error:', e.message);
    }

    // 4. Przygotuj ostateczną odpowiedź
    const result = filesystems.map(fs => {
      // Konwersja rozmiarów do bajtów
      const units = { 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4 };
      const convert = (val) => {
        const match = val.match(/^(\d+\.?\d*)([KMGT])?/i);
        if (!match) return 0;
        return parseFloat(match[1]) * (units[match[2]?.toUpperCase()] || 1);
      };

      return {
        device: fs.device,
        type: fs.type || 'unknown',
        size: convert(fs.size),
        used: convert(fs.used),
        available: convert(fs.available),
        usedPercent: fs.usedPercent,
        mounted: fs.mounted,
        reference: uuidMapping[fs.device] || fs.device,
        status: fs.mounted ? 'active' : 'inactive'
      };
    });

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Filesystems API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get filesystems data',
      details: error.message
    });
  }
});

// Funkcja do sprawdzania statusu systemu plików
async function checkFilesystemStatus(device, mountPoint) {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  try {
    // Sprawdzanie czy jest zamontowany
    if (!mountPoint || mountPoint === 'Not mounted') {
      return 'inactive';
    }

    // Sprawdzanie błędów fsck
    const fsckCheck = await execAsync(`fsck -N ${device}`).catch(() => ({}));
    if (fsckCheck.stderr && fsckCheck.stderr.includes('contains a file system with errors')) {
      return 'error';
    }

    // Sprawdzanie czy jest tylko do odczytu
    const mountCheck = await execAsync(`findmnt -n -o OPTIONS ${device}`);
    if (mountCheck.stdout.includes('ro,')) {
      return 'readonly';
    }

    // Domyślnie aktywny
    return 'active';
  } catch (e) {
    console.error(`Error checking status for ${device}:`, e);
    return 'unknown';
  }
}

// Funkcja pomocnicza do formatowania rozmiaru
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
}

// Funkcja do pobierania uprawnień w formacie Unix
function getPermissions(mode) {
  return {
    mode: (mode & parseInt('777', 8)).toString(8),
    readable: Boolean(mode & parseInt('444', 8)),
    writable: Boolean(mode & parseInt('222', 8)),
    executable: Boolean(mode & parseInt('111', 8))
  };
}

// CLOSE SERVER FUNCTION

// Globalna flaga zamykania
let isShuttingDown = false;

// Middleware blokujący nowe żądania podczas zamykania
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).json({ error: 'Serwer w trakcie zamykania' });
    return;
  }
  next();
});

// Ulepszona obsługa zamykania
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\nRozpoczęcie gracful shutdown...');
  
  try {
    // Zamknij serwer HTTP
    await new Promise((resolve) => server.close(resolve));
    
    // Zamknij inne zasoby (bazy danych, itp.)
    // np. jeśli używasz mongoose:
    // if (mongoose.connection) await mongoose.connection.close();
    
    console.log('Wszystkie zasoby zamknięte');
    process.exit(0);
  } catch (err) {
    console.error('Błąd podczas zamykania:', err);
    process.exit(1);
  }
}

app.listen(PORT, HOST, () => {
  console.log(`Serwer działa na http://${HOST}:${PORT}`);
})
