const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');

// Helper do wykonania komendy z obietnicą
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Parsowanie logów
const parseLogLine = (line) => {
  if (!line.trim()) return null;
  
  const syslogRegex = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)\[(\d+)\]:\s+(.+)$/;
  const match = line.match(syslogRegex);
  
  if (match) {
    const [, timestamp, hostname, process, pid, message] = match;
    
    let level = 'INFO';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('error') || lowerMessage.includes('err:')) {
      level = 'ERROR';
    } else if (lowerMessage.includes('warn')) {
      level = 'WARNING';
    } else if (lowerMessage.includes('debug')) {
      level = 'DEBUG';
    }
    
    const monthMap = {
      'sty': 'Jan', 'lut': 'Feb', 'mar': 'Mar', 'kwi': 'Apr',
      'maj': 'May', 'cze': 'Jun', 'lip': 'Jul', 'sie': 'Aug',
      'wrz': 'Sep', 'paź': 'Oct', 'lis': 'Nov', 'gru': 'Dec'
    };
    
    const [monthStr, day, time] = timestamp.split(/\s+/);
    const month = monthMap[monthStr] || monthStr;
    const now = new Date();
    const year = now.getFullYear();
    const dateStr = `${year} ${month} ${day} ${time}`;
    
    return {
      timestamp: new Date(dateStr).toISOString(),
      displayTime: timestamp,
      hostname,
      process,
      pid: parseInt(pid),
      message,
      level,
      raw: line,
      parsed: true
    };
  }
  
  const simpleRegex = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(.+)$/;
  const simpleMatch = line.match(simpleRegex);
  
  if (simpleMatch) {
    const [, timestamp, message] = simpleMatch;
    
    let level = 'INFO';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('error')) level = 'ERROR';
    else if (lowerMessage.includes('warn')) level = 'WARNING';
    else if (lowerMessage.includes('debug')) level = 'DEBUG';
    
    return {
      timestamp: new Date().toISOString(),
      displayTime: timestamp,
      message,
      level,
      raw: line,
      parsed: true
    };
  }
  
  return {
    timestamp: new Date().toISOString(),
    message: line,
    level: 'INFO',
    raw: line,
    parsed: false
  };
};

// Eksport do PDF
const exportToPDF = async (logs, filename) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });
    
    const chunks = [];
    doc.on('data', chunks.push.bind(chunks));
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    doc.fontSize(20)
       .text('Raport Logów Systemowych', { align: 'center' });
    
    doc.moveDown();
    doc.fontSize(12)
       .text(`Plik: ${filename}`, { align: 'center' });
    doc.text(`Data wygenerowania: ${new Date().toLocaleString()}`, { align: 'center' });
    
    doc.moveDown(2);
    
    const stats = {
      total: logs.length,
      errors: logs.filter(l => l.level === 'ERROR').length,
      warnings: logs.filter(l => l.level === 'WARNING').length
    };
    
    doc.fontSize(14).text('Statystyki:', { underline: true });
    doc.fontSize(12)
       .text(`• Wszystkie wpisy: ${stats.total}`)
       .text(`• Błędy: ${stats.errors}`)
       .text(`• Ostrzeżenia: ${stats.warnings}`);
    
    doc.moveDown(2);
    
    doc.fontSize(14).text('Logi:', { underline: true });
    doc.moveDown();
    
    logs.forEach((log, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }
      
      switch(log.level) {
        case 'ERROR':
          doc.fillColor('red');
          break;
        case 'WARNING':
          doc.fillColor('orange');
          break;
        case 'DEBUG':
          doc.fillColor('gray');
          break;
        default:
          doc.fillColor('black');
      }
      
      const logText = log.parsed 
        ? `[${log.displayTime || log.timestamp.substring(11, 19)}] [${log.level}] ${log.message}`
        : log.raw;
      
      doc.fontSize(10)
         .text(logText, {
           align: 'left',
           indent: 10,
           continued: false
         });
      
      doc.fillColor('black');
      
      if (index < logs.length - 1) {
        doc.moveDown(0.5);
      }
    });
    
    doc.end();
  });
};

// Funkcja pomocnicza do formatowania nazw logów
function getDisplayName(key) {
  const names = {
    'syslog': 'System Log',
    'auth': 'Authentication',
    'kern': 'Kernel',
    'daemon': 'Daemon',
    'user': 'User',
    'docker': 'Docker',
    'info': 'Info',
    'debug': 'Debug',
    'warn': 'Warning',
    'warning': 'Warning',
    'access': 'Access',
    'error': 'Error',
    'nas-panel-info': 'NAS Panel Info',
    'nas-panel-debug': 'NAS Panel Debug',
    'nas-panel-warn': 'NAS Panel Warning',
    'nas-panel-access': 'NAS Panel Access',
    'nas-panel-error': 'NAS Panel Error',
    'nas-web-error': 'NAS Web Error',
    'nas-wen-output': 'NAS Wen Output'
  };
  
  return names[key] || key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Główna funkcja do pobierania dostępnych logów - POPRAWIONA
async function getAvailableLogs() {
  const logMapping = {
    // Systemowe - spróbuj różnych wariantów
    'syslog': ['/var/log/syslog', '/var/log/messages'],
    'auth': ['/var/log/auth.log', '/var/log/secure'],
    'kern': ['/var/log/kern.log'],
    'daemon': ['/var/log/daemon.log'],
    'user': ['/var/log/user.log'],
    'docker': ['/var/log/docker.log', '/var/log/docker/docker.log'],
    'dynamic-dns': ['/var/log/dynamic-dns.log'],
    'dpkg': ['/var/log/dpkg.log'],
    
    // NAS Panel - sprawdź różne lokalizacje
    'nas-panel-info': ['/var/nas-panel/info.log', '/opt/nas-panel/logs/info.log', '/var/log/nas-panel/info.log'],
    'nas-panel-debug': ['/var/nas-panel/debug.log', '/opt/nas-panel/logs/debug.log', '/var/log/nas-panel/debug.log'],
    'nas-panel-warn': ['/var/nas-panel/warn.log', '/opt/nas-panel/logs/warn.log', '/var/log/nas-panel/warn.log'],
    'nas-panel-access': ['/var/nas-panel/access.log', '/opt/nas-panel/logs/access.log', '/var/log/nas-panel/access.log'],
    'nas-panel-error': ['/var/nas-panel/error.log', '/opt/nas-panel/logs/error.log', '/var/log/nas-panel/error.log'],
    
    // NAS Web/Wen
    'nas-web-error': ['/var/nas-web/error.log', '/opt/nas-web/logs/error.log', '/var/log/nas-web/error.log'],
    'nas-wen-output': ['/var/nas-wen/output.log', '/opt/nas-wen/logs/output.log', '/var/log/nas-wen/output.log']
  };
  
  const existingLogs = {};
  const totalSize = {};
  
  console.log('\n=== SZUKANIE PLIKÓW LOGÓW ===');
  
  for (const [key, possiblePaths] of Object.entries(logMapping)) {
    let foundPath = null;
    
    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        foundPath = filePath;
        existingLogs[key] = filePath;
        totalSize[key] = stats.size;
        console.log(`✓ Znaleziono: ${key} -> ${filePath} (${stats.size} bajtów)`);
        break; // Znaleziono plik, przechodzimy do następnego klucza
      } catch (err) {
        // Plik nie istnieje, próbujemy następną ścieżkę
        continue;
      }
    }
    
    if (!foundPath) {
      console.log(`✗ Nie znaleziono pliku dla: ${key}`);
    }
  }
  
  // Jeśli nie znaleziono żadnych plików, spróbuj znaleźć COKOLWIEK w /var/log
  if (Object.keys(existingLogs).length === 0) {
    console.log('\n=== PRÓBA ZNALEZIENIA DOWOLNYCH PLIKÓW LOGÓW ===');
    try {
      const files = await fs.readdir('/var/log');
      const logFiles = files.filter(file => file.endsWith('.log') || file.includes('log'));
      
      for (const file of logFiles.slice(0, 10)) { // Ogranicz do 10 plików
        const filePath = `/var/log/${file}`;
        try {
          const stats = await fs.stat(filePath);
          const key = file.replace('.log', '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
          existingLogs[key] = filePath;
          totalSize[key] = stats.size;
          console.log(`✓ Znaleziono ogólny plik: ${key} -> ${filePath}`);
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      console.log(`Błąd czytania /var/log: ${err.message}`);
    }
  }
  
  console.log(`\n=== PODSUMOWANIE: Znaleziono ${Object.keys(existingLogs).length} plików ===`);
  return { existingLogs, totalSize };
}

module.exports = function(app, requireAuth) {
  // Lista dostępnych logów systemowych
  app.get('/api/diagnostics/system-logs', requireAuth, async (req, res) => {
    try {
      console.log('\n=== API: Pobieranie listy logów ===');
      const { existingLogs, totalSize } = await getAvailableLogs();
      
      const logGroups = [];
      
      // Systemowe logi
      const systemKeys = ['syslog', 'auth', 'kern', 'daemon', 'user', 'docker'];
      const systemLogs = systemKeys
        .filter(key => existingLogs[key])
        .map(key => ({
          key,
          name: getDisplayName(key),
          path: existingLogs[key],
          size: totalSize[key] || 0,
          group: 'system'
        }));
      
      if (systemLogs.length > 0) {
        logGroups.push({
          label: 'Systemowe',
          logs: systemLogs
        });
      }
      
      // NAS Panel logi
      const nasPanelKeys = ['nas-panel-info', 'nas-panel-debug', 'nas-panel-warn', 
                           'nas-panel-access', 'nas-panel-error'];
      const nasPanelLogs = nasPanelKeys
        .filter(key => existingLogs[key])
        .map(key => ({
          key,
          name: getDisplayName(key.replace('nas-panel-', '')),
          path: existingLogs[key],
          size: totalSize[key] || 0,
          group: 'nas-panel'
        }));
      
      if (nasPanelLogs.length > 0) {
        logGroups.push({
          label: 'NAS Panel',
          logs: nasPanelLogs
        });
      }
      
      // NAS Web/Wen logi
      const nasWebKeys = ['nas-web-error', 'nas-wen-output'];
      const nasWebLogs = nasWebKeys
        .filter(key => existingLogs[key])
        .map(key => ({
          key,
          name: getDisplayName(key.replace('nas-', '')),
          path: existingLogs[key],
          size: totalSize[key] || 0,
          group: 'nas-web'
        }));
      
      if (nasWebLogs.length > 0) {
        logGroups.push({
          label: 'NAS Web',
          logs: nasWebLogs
        });
      }
      
      // Inne logi (jeśli jakieś znaleziono)
      const otherLogs = Object.keys(existingLogs)
        .filter(key => ![...systemKeys, ...nasPanelKeys, ...nasWebKeys].includes(key))
        .map(key => ({
          key,
          name: getDisplayName(key),
          path: existingLogs[key],
          size: totalSize[key] || 0,
          group: 'other'
        }));
      
      if (otherLogs.length > 0) {
        logGroups.push({
          label: 'Inne',
          logs: otherLogs
        });
      }
      
      // Płaska lista dla kompatybilności
      const flatLogs = Object.keys(existingLogs).map(key => ({
        key,
        name: getDisplayName(key),
        path: existingLogs[key],
        size: totalSize[key] || 0,
        group: key.includes('nas-panel') ? 'nas-panel' : 
               key.includes('nas-') ? 'nas-web' : 
               ['syslog', 'auth', 'kern', 'daemon', 'user', 'docker'].includes(key) ? 'system' : 'other'
      }));
      
      const response = {
        success: true,
        availableLogs: existingLogs,
        totalSize,
        logGroups,
        logs: flatLogs,
        count: Object.keys(existingLogs).length,
        timestamp: new Date().toISOString(),
        message: Object.keys(existingLogs).length > 0 ? 
          `Znaleziono ${Object.keys(existingLogs).length} plików logów` : 
          'Brak dostępnych plików logów'
      };
      
      console.log('API Response:', JSON.stringify(response, null, 2));
      res.json(response);
      
    } catch (error) {
      console.error('Error listing log files:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to list log files',
        details: error.message 
      });
    }
  });

  // Pobierz konkretny plik logu
  app.get('/api/diagnostics/system-logs/:logFile', requireAuth, async (req, res) => {
    const { logFile } = req.params;
    const { lines = 200 } = req.query;
    
    console.log(`\n=== API: Czytanie pliku logu: "${logFile}" ===`);
    
    try {
      // Najpierw pobierz wszystkie dostępne logi
      const { existingLogs } = await getAvailableLogs();
      
      // Sprawdź czy żądany plik istnieje
      const logPath = existingLogs[logFile];
      
      if (!logPath) {
        console.log(`Plik nie znaleziony: ${logFile}`);
        console.log(`Dostępne pliki: ${Object.keys(existingLogs).join(', ')}`);
        return res.status(404).json({ 
          error: 'Log file not found',
          requested: logFile,
          available: Object.keys(existingLogs)
        });
      }
      
      console.log(`Czytanie pliku: ${logPath}`);
      
      // Sprawdź czy plik istnieje
      try {
        await fs.access(logPath);
      } catch (err) {
        console.log(`Plik nie istnieje: ${logPath}`);
        return res.status(404).json({ 
          error: 'Log file does not exist',
          path: logPath
        });
      }
      
      // Czytanie pliku
      let output;
      const linesNum = parseInt(lines) || 200;
      
      try {
        if (linesNum > 0) {
          const cmd = `tail -n ${linesNum} "${logPath}"`;
          output = await execPromise(cmd);
        } else {
          output = await fs.readFile(logPath, 'utf8');
        }
      } catch (readErr) {
        console.error(`Błąd czytania pliku:`, readErr);
        // Spróbuj bezpośrednio
        try {
          output = await fs.readFile(logPath, 'utf8');
          if (linesNum > 0) {
            const linesArray = output.split('\n');
            output = linesArray.slice(-linesNum).join('\n');
          }
        } catch (fsErr) {
          return res.status(500).json({ 
            error: 'Cannot read log file',
            details: fsErr.message
          });
        }
      }
      
      const linesArray = output.split('\n').filter(line => line.trim());
      const parsedLines = linesArray.map(line => parseLogLine(line));
      
      const response = {
        success: true,
        logFile,
        logKey: logFile,
        logPath,
        totalLines: linesArray.length,
        lines: parsedLines,
        raw: output,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Przeczytano ${linesArray.length} linii z ${logPath}`);
      res.json(response);
      
    } catch (error) {
      console.error(`Error reading log file ${logFile}:`, error);
      res.status(500).json({ 
        success: false,
        error: `Failed to read log file ${logFile}`,
        details: error.message
      });
    }
  });

  // Endpoint debugujący - POKAŻ CO JEST W SYSTEMIE
  app.get('/api/diagnostics/debug-logs', requireAuth, async (req, res) => {
    try {
      console.log('\n=== DEBUG: Sprawdzanie systemu ===');
      
      // Sprawdź jakie pliki faktycznie istnieją
      const checkPaths = [
        // Systemowe
        '/var/log/syslog',
        '/var/log/messages',
        '/var/log/auth.log',
        '/var/log/secure',
        '/var/log/kern.log',
        '/var/log/daemon.log',
        '/var/log/user.log',
        '/var/log/docker.log',
        '/var/log/dpkg.log',
        
        // NAS Panel - różne możliwe lokalizacje
        '/var/nas-panel/info.log',
        '/var/nas-panel/debug.log',
        '/var/nas-panel/warn.log',
        '/var/nas-panel/access.log',
        '/var/nas-panel/error.log',
        
        '/opt/nas-panel/logs/info.log',
        '/opt/nas-panel/logs/debug.log',
        '/opt/nas-panel/logs/warn.log',
        '/opt/nas-panel/logs/access.log',
        '/opt/nas-panel/logs/error.log',
        
        '/var/log/nas-panel/info.log',
        '/var/log/nas-panel/debug.log',
        '/var/log/nas-panel/warn.log',
        '/var/log/nas-panel/access.log',
        '/var/log/nas-panel/error.log',
        
        // NAS Web
        '/var/nas-web/error.log',
        '/opt/nas-web/logs/error.log',
        '/var/log/nas-web/error.log',
        
        // NAS Wen
        '/var/nas-wen/output.log',
        '/opt/nas-wen/logs/output.log',
        '/var/log/nas-wen/output.log'
      ];
      
      const results = [];
      for (const filePath of checkPaths) {
        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          results.push({
            path: filePath,
            exists: true,
            size: stats.size,
            readable: true,
            lastModified: stats.mtime
          });
          console.log(`✓ ${filePath} (${stats.size} bajtów)`);
        } catch (err) {
          results.push({
            path: filePath,
            exists: false,
            error: err.message,
            readable: false
          });
        }
      }
      
      // Sprawdź katalogi
      const checkDirs = ['/var/log', '/var/nas-panel', '/opt/nas-panel', '/var/nas-web', '/var/nas-wen'];
      const dirResults = [];
      
      for (const dirPath of checkDirs) {
        try {
          const files = await fs.readdir(dirPath);
          dirResults.push({
            path: dirPath,
            exists: true,
            files: files.slice(0, 20) // pierwsze 20 plików
          });
          console.log(`📁 ${dirPath}: ${files.length} plików`);
        } catch (err) {
          dirResults.push({
            path: dirPath,
            exists: false,
            error: err.message
          });
        }
      }
      
      // Sprawdź uprawnienia użytkownika
      const userInfo = {
        uid: process.getuid ? process.getuid() : 'unknown',
        gid: process.getgid ? process.getgid() : 'unknown',
        user: process.env.USER || process.env.USERNAME || 'unknown',
        cwd: process.cwd()
      };
      
      console.log(`Użytkownik: ${userInfo.user} (UID: ${userInfo.uid})`);
      
      // Test dostępności
      const testPaths = ['/var/log/syslog', '/tmp'];
      const testResults = [];
      
      for (const testPath of testPaths) {
        try {
          await fs.access(testPath, fs.constants.R_OK);
          testResults.push({
            path: testPath,
            readable: true
          });
        } catch (err) {
          testResults.push({
            path: testPath,
            readable: false,
            error: err.message
          });
        }
      }
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        userInfo,
        fileCheck: results,
        directoryCheck: dirResults,
        permissionTest: testResults,
        systemInfo: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          cwd: process.cwd()
        },
        suggestions: [
          'Sprawdź czy pliki logów istnieją',
          'Sprawdź uprawnienia do odczytu',
          'Utwórz brakujące pliki jeśli to konieczne'
        ]
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // UTWÓRZ PRZYKŁADOWE PLIKI LOGÓW (dla testów)
  app.post('/api/diagnostics/create-test-logs', requireAuth, async (req, res) => {
    try {
      const testLogs = [
        { path: '/tmp/test-syslog.log', content: 'Jan 28 15:00:00 localhost systemd[1]: Started Test service.\nJan 28 15:01:00 localhost kernel[0]: Test kernel message\n' },
        { path: '/tmp/test-nas-panel.log', content: '2026-01-28 15:00:00 [INFO] NAS Panel started\n2026-01-28 15:01:00 [ERROR] Test error message\n' },
        { path: '/tmp/test-error.log', content: 'ERROR: Something went wrong\nWARNING: This is a warning\nINFO: This is information\n' }
      ];
      
      const created = [];
      
      for (const testLog of testLogs) {
        try {
          await fs.writeFile(testLog.path, testLog.content, 'utf8');
          created.push({
            path: testLog.path,
            size: testLog.content.length
          });
          console.log(`Utworzono plik testowy: ${testLog.path}`);
        } catch (err) {
          console.error(`Błąd tworzenia ${testLog.path}:`, err.message);
        }
      }
      
      res.json({
        success: true,
        message: 'Utworzono pliki testowe',
        created,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // SIMPLE FALLBACK - zawsze pokaże przynajmniej jakieś pliki
  app.get('/api/diagnostics/simple-logs', requireAuth, async (req, res) => {
    try {
      // Zawsze zwróć przynajmniej te podstawowe pliki
      const defaultLogs = {
        'syslog': { name: 'System Log', path: '/var/log/syslog' },
        'messages': { name: 'System Messages', path: '/var/log/messages' },
        'auth': { name: 'Authentication', path: '/var/log/auth.log' },
        'test-log': { name: 'Test Log', path: '/tmp/test.log' },
        'dmesg': { name: 'Kernel Messages', path: '/var/log/dmesg' }
      };
      
      const availableLogs = {};
      const totalSize = {};
      const logs = [];
      
      for (const [key, info] of Object.entries(defaultLogs)) {
        try {
          await fs.access(info.path);
          const stats = await fs.stat(info.path);
          availableLogs[key] = info.path;
          totalSize[key] = stats.size;
          logs.push({
            key,
            name: info.name,
            path: info.path,
            size: stats.size,
            group: 'system'
          });
        } catch (err) {
          // Plik nie istnieje, dodaj jako niedostępny
          logs.push({
            key,
            name: info.name,
            path: info.path,
            size: 0,
            group: 'system',
            missing: true
          });
        }
      }
      
      // Dodaj testowy plik który zawsze istnieje
      const testPath = '/tmp/nas-panel-test.log';
      try {
        await fs.writeFile(testPath, `Test log created at ${new Date().toISOString()}\n`, { flag: 'a' });
        const stats = await fs.stat(testPath);
        availableLogs['test'] = testPath;
        totalSize['test'] = stats.size;
        logs.push({
          key: 'test',
          name: 'Test Log',
          path: testPath,
          size: stats.size,
          group: 'test'
        });
      } catch (err) {
        console.log('Nie udało się utworzyć testowego pliku:', err.message);
      }
      
      res.json({
        success: true,
        availableLogs,
        totalSize,
        logs,
        logGroups: [{
          label: 'Systemowe',
          logs: logs.filter(l => l.group === 'system')
        }],
        count: Object.keys(availableLogs).length,
        timestamp: new Date().toISOString(),
        note: 'To są domyślne pliki. Sprawdź czy istnieją w Twoim systemie.'
      });
      
    } catch (error) {
      console.error('Error in simple-logs:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // Journalctl logs
  app.get('/api/diagnostics/journal-logs', requireAuth, async (req, res) => {
    const { 
      unit, 
      lines = 100, 
      since = '1 hour ago',
      priority,
      grep
    } = req.query;
    
    try {
      let command = 'journalctl --no-pager';
      
      if (unit) command += ` -u ${unit}`;
      if (lines) command += ` -n ${lines}`;
      if (since) command += ` --since="${since}"`;
      if (priority) command += ` -p ${priority}`;
      if (grep) command += ` --grep="${grep}"`;
      
      const output = await execPromise(command);
      
      const linesArray = output.split('\n').filter(line => line.trim());
      const parsedLines = linesArray.map(line => parseLogLine(line));
      
      const stats = {
        total: parsedLines.length,
        errors: parsedLines.filter(l => l.level === 'ERROR').length,
        warnings: parsedLines.filter(l => l.level === 'WARNING').length,
        info: parsedLines.filter(l => l.level === 'INFO').length
      };
      
      res.json({
        success: true,
        unit,
        query: { lines, since, priority, grep },
        stats,
        lines: parsedLines,
        raw: output,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error reading journal logs:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to read journal logs',
        details: error.message 
      });
    }
  });

  // Status systemd service
  app.get('/api/diagnostics/service-status/:service', requireAuth, async (req, res) => {
    const { service } = req.params;
    
    try {
      const statusCommand = `systemctl status ${service} --no-pager`;
      const statusOutput = await execPromise(statusCommand);
      
      const logsCommand = `journalctl -u ${service} -n 50 --no-pager`;
      const logsOutput = await execPromise(logsCommand);
      
      const logsArray = logsOutput.split('\n').filter(line => line.trim());
      const parsedLogs = logsArray.map(line => parseLogLine(line));
      
      const isActive = statusOutput.includes('active (running)');
      const isFailed = statusOutput.includes('failed');
      
      let pid = null;
      if (isActive) {
        const pidMatch = statusOutput.match(/Main PID:\s+(\d+)/);
        if (pidMatch) {
          pid = parseInt(pidMatch[1]);
        }
      }
      
      res.json({
        success: true,
        service,
        status: {
          active: isActive,
          failed: isFailed,
          pid,
          output: statusOutput
        },
        recentLogs: parsedLogs.slice(0, 20),
        logCount: parsedLogs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error checking service ${service}:`, error);
      res.status(500).json({ 
        success: false,
        error: `Failed to check service ${service}`,
        details: error.message 
      });
    }
  });

  // Kontrola usługi
  app.post('/api/diagnostics/service-control/:service', requireAuth, async (req, res) => {
    const { service } = req.params;
    const { action } = req.body;
    
    const validActions = ['start', 'stop', 'restart', 'reload'];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid action' 
      });
    }
    
    try {
      const command = `systemctl ${action} ${service}`;
      const output = await execPromise(command);
      
      const statusCommand = `systemctl status ${service} --no-pager`;
      const statusOutput = await execPromise(statusCommand);
      
      const isActive = statusOutput.includes('active (running)');
      
      res.json({
        success: true,
        service,
        action,
        output,
        status: {
          active: isActive,
          output: statusOutput
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error ${action}ing service ${service}:`, error);
      res.status(500).json({ 
        success: false,
        error: `Failed to ${action} service ${service}`,
        details: error.message 
      });
    }
  });

  // Eksport logów
  app.post('/api/diagnostics/export-logs', requireAuth, async (req, res) => {
    const { logs, filename = 'logs', format = 'txt' } = req.body;
    
    try {
      if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid logs data' 
        });
      }
      
      let content;
      let contentType;
      let exportFilename = `${filename}-${new Date().toISOString().split('T')[0]}`;
      
      switch (format.toLowerCase()) {
        case 'csv':
          const csvHeader = 'Timestamp,Level,Process,PID,Hostname,Message\n';
          const csvRows = logs.map(log => {
            const timestamp = log.timestamp ? new Date(log.timestamp).toISOString() : '';
            const level = log.level || 'INFO';
            const process = log.process || '';
            const pid = log.pid || '';
            const hostname = log.hostname || '';
            const message = (log.message || log.raw || '').replace(/"/g, '""');
            return `"${timestamp}","${level}","${process}","${pid}","${hostname}","${message}"`;
          }).join('\n');
          
          content = csvHeader + csvRows;
          contentType = 'text/csv';
          exportFilename += '.csv';
          break;
          
        case 'json':
          content = JSON.stringify(logs, null, 2);
          contentType = 'application/json';
          exportFilename += '.json';
          break;
          
        case 'pdf':
          const logEntries = logs.map(log => ({
            timestamp: log.timestamp,
            displayTime: log.displayTime || log.timestamp.substring(11, 19),
            level: log.level || 'INFO',
            message: log.message || log.raw || '',
            raw: log.raw || ''
          }));
          
          content = await exportToPDF(logEntries, filename);
          contentType = 'application/pdf';
          exportFilename += '.pdf';
          break;
          
        case 'txt':
        default:
          content = logs.map(log => log.raw || log.message || '').join('\n');
          contentType = 'text/plain';
          exportFilename += '.txt';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
      res.send(content);
    } catch (error) {
      console.error('Error exporting logs:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to export logs',
        details: error.message 
      });
    }
  });

  // Diagnostyka aplikacji NAS Panel
  app.get('/api/diagnostics/nas-panel/errors', requireAuth, async (req, res) => {
    const { since = '10 minutes ago', limit = 50 } = req.query;
    
    try {
      const command = `journalctl -u nas-api --since "${since}" --no-pager -n ${limit}`;
      const output = await execPromise(command);
      
      const lines = output.split('\n').filter(line => line.trim());
      const parsedLines = lines.map(line => parseLogLine(line));
      
      const errorStats = parsedLines.reduce((stats, line) => {
        if (!line) return stats;
        
        const type = line.errorType || 'OTHER';
        if (!stats[type]) {
          stats[type] = { count: 0, lastSeen: null, examples: [] };
        }
        
        stats[type].count++;
        stats[type].lastSeen = line.timestamp;
        if (stats[type].examples.length < 3) {
          stats[type].examples.push(line.message.substring(0, 200));
        }
        
        return stats;
      }, {});
      
      const criticalErrors = parsedLines
        .filter(line => line && line.level === 'ERROR')
        .slice(0, 10);
      
      const mostCommonError = Object.entries(errorStats)
        .sort(([,a], [,b]) => b.count - a.count)[0];
      
      res.json({
        success: true,
        summary: {
          totalLines: lines.length,
          errorCount: parsedLines.filter(l => l && l.level === 'ERROR').length,
          warningCount: parsedLines.filter(l => l && l.level === 'WARNING').length,
          errorTypes: Object.keys(errorStats).length,
          mostCommonError: mostCommonError ? {
            type: mostCommonError[0],
            count: mostCommonError[1].count
          } : null,
          timeRange: since
        },
        errorStats,
        recentErrors: criticalErrors,
        rawSample: lines.slice(0, 5),
        timestamp: new Date().toISOString(),
        recommendations: criticalErrors.length > 0 ? [
          'Sprawdź logi aplikacji w poszukiwaniu błędów',
          'Zweryfikuj zależności aplikacji',
          'Restartuj usługę jeśli błędy są krytyczne'
        ] : ['Brak krytycznych błędów']
      });
    } catch (error) {
      console.error('Error fetching NAS Panel errors:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch application errors',
        details: error.message 
      });
    }
  });

  // System health check
  app.get('/api/diagnostics/system-health', requireAuth, async (req, res) => {
    try {
      const failedServicesCmd = 'systemctl list-units --type=service --state=failed --no-pager --no-legend';
      let failedServices = [];
      
      try {
        const output = await execPromise(failedServicesCmd);
        failedServices = output.split('\n')
          .filter(line => line.trim())
          .map(line => line.split(/\s+/)[0]);
      } catch (error) {
        console.error('Error checking failed services:', error);
      }
      
      const memoryCmd = "free -m | awk 'NR==2{printf \"%.1f\", $3*100/$2}'";
      const cpuCmd = "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'";
      const diskCmd = "df -h / | awk 'NR==2{print $5}'";
      
      const [memoryPercent, cpuPercent, diskPercent] = await Promise.all([
        execPromise(memoryCmd).catch(() => '0'),
        execPromise(cpuCmd).catch(() => '0'),
        execPromise(diskCmd).catch(() => '0%')
      ]);
      
      let healthStatus = 'HEALTHY';
      let healthScore = 100;
      const issues = [];
      
      if (failedServices.length > 0) {
        healthStatus = 'DEGRADED';
        healthScore -= 30;
        issues.push(`${failedServices.length} failed services`);
      }
      
      if (parseFloat(memoryPercent) > 90) {
        healthStatus = 'DEGRADED';
        healthScore -= 20;
        issues.push('High memory usage');
      }
      
      if (parseFloat(cpuPercent) > 90) {
        healthStatus = 'DEGRADED';
        healthScore -= 20;
        issues.push('High CPU usage');
      }
      
      if (parseFloat(diskPercent) > 90) {
        healthStatus = 'DEGRADED';
        healthScore -= 20;
        issues.push('High disk usage');
      }
      
      if (healthScore < 60) {
        healthStatus = 'UNHEALTHY';
      }
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        health: {
          status: healthStatus,
          score: Math.max(0, healthScore),
          issues
        },
        resources: {
          memory: {
            percent: parseFloat(memoryPercent),
            status: parseFloat(memoryPercent) > 80 ? 'HIGH' : 'NORMAL'
          },
          cpu: {
            percent: parseFloat(cpuPercent),
            status: parseFloat(cpuPercent) > 80 ? 'HIGH' : 'NORMAL'
          },
          disk: {
            percent: parseFloat(diskPercent),
            status: parseFloat(diskPercent) > 80 ? 'HIGH' : 'NORMAL'
          }
        },
        services: {
          failed: failedServices,
          failedCount: failedServices.length
        },
        recommendations: issues.length > 0 ? [
          'Sprawdź uszkodzone usługi',
          'Monitoruj wykorzystanie zasobów',
          'Rozważ dodanie więcej zasobów jeśli to konieczne'
        ] : ['System działa prawidłowo']
      });
    } catch (error) {
      console.error('Error checking system health:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to check system health',
        details: error.message 
      });
    }
  });

  // Process list
  app.get('/api/diagnostics/processes', requireAuth, async (req, res) => {
    try {
      const command = 'ps -eo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu --no-headers';
      const output = await execPromise(command);
      
      const processes = output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parseInt(parts[0]),
            user: parts[1],
            cpu: parseFloat(parts[2]),
            memory: parseFloat(parts[3]),
            status: parts[4],
            name: parts[5],
            command: parts.slice(6).join(' '),
            protected: parts[1] === 'root' || parseInt(parts[0]) < 100
          };
        })
        .slice(0, 50);
      
      res.json({
        success: true,
        processes,
        total: processes.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting processes:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get processes',
        details: error.message 
      });
    }
  });

  console.log('\n✅ Diagnostics module załadowany!');
  console.log('Dostępne endpointy:');
  console.log('  GET  /api/diagnostics/system-logs');
  console.log('  GET  /api/diagnostics/system-logs/:logFile');
  console.log('  GET  /api/diagnostics/debug-logs');
  console.log('  GET  /api/diagnostics/simple-logs');
  console.log('  POST /api/diagnostics/create-test-logs');
  console.log('  ... i inne\n');
};
