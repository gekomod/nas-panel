// src/api/terminal.js
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');
const os = require('os');

// Store active terminal sessions
const terminalSessions = new Map();

// Store terminal preferences per user
const userPreferences = new Map();

module.exports = function(app, requireAuth) {

  // ==================== PODSTAWOWE FUNKCJE ====================

  // Create new terminal session
  app.post('/terminal/sessions', requireAuth, async (req, res) => {
    try {
      const { shell = 'bash', serverId = null, initialPath = null } = req.body;
      const sessionId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = req.session?.userId || 'default';
      
      // Validate shell exists
      try {
        await execAsync(`which ${shell}`);
      } catch {
        return res.status(400).json({ 
          success: false,
          error: `Shell '${shell}' not found`
        });
      }

      // Get initial working directory
      let cwd = initialPath || process.cwd();
      
      // Sprawdź czy ścieżka istnieje
      try {
        fs.accessSync(cwd, fs.constants.R_OK);
      } catch {
        cwd = os.homedir(); // Fallback do home directory
      }

      // Store session info
      terminalSessions.set(sessionId, {
        id: sessionId,
        shell: shell,
        process: null,
        cwd: cwd,
        serverId: serverId,
        userId: userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        history: [],
        env: { ...process.env },
        exitCode: 0,
        isRunning: false
      });

      // Load user preferences
      if (!userPreferences.has(userId)) {
        userPreferences.set(userId, {
          defaultShell: shell,
          historySize: 1000,
          fontSize: 14,
          theme: 'dark'
        });
      }

      res.json({
        success: true,
        sessionId: sessionId,
        initialPath: cwd,
        shell: shell,
        serverId: serverId,
        preferences: userPreferences.get(userId)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to create terminal session',
        details: error.message
      });
    }
  });

  // Execute command in terminal session - ULEPSZONE
  app.post('/terminal/sessions/:sessionId/execute', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command, captureOutput = true, timeout = 30000 } = req.body;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      session.lastActivity = new Date();
      
      // Dodaj do historii
      if (command.trim()) {
        session.history.push({
          command: command,
          timestamp: new Date().toISOString(),
          cwd: session.cwd
        });
        
        // Ogranicz historię
        const maxHistory = userPreferences.get(session.userId)?.historySize || 1000;
        if (session.history.length > maxHistory) {
          session.history = session.history.slice(-maxHistory);
        }
      }

      // Obsługa specjalnych komend
      if (command.startsWith('cd ')) {
        return handleCdCommand(session, command, res);
      }
      
      if (command === 'pwd') {
        return res.json({
          success: true,
          output: session.cwd,
          exitCode: 0,
          cwd: session.cwd
        });
      }
      
      if (command === 'clear' || command === 'cls') {
        return res.json({
          success: true,
          output: '__CLEAR__',
          exitCode: 0,
          cwd: session.cwd
        });
      }
      
      if (command === 'exit') {
        return res.json({
          success: true,
          output: '__EXIT__',
          exitCode: 0,
          cwd: session.cwd
        });
      }
      
      if (command === 'history') {
        const history = session.history.map((h, i) => `${i + 1}  ${h.command}`).join('\n');
        return res.json({
          success: true,
          output: history,
          exitCode: 0,
          cwd: session.cwd
        });
      }

      // Execute command
      session.isRunning = true;
      
      const childProcess = exec(command, {
        cwd: session.cwd,
        shell: session.shell,
        encoding: 'utf8',
        timeout: timeout,
        env: { ...session.env, PWD: session.cwd }
      }, (error, stdout, stderr) => {
        session.isRunning = false;
        session.process = null;
        
        if (error) {
          session.exitCode = error.code || 1;
        } else {
          session.exitCode = 0;
        }
      });

      session.process = childProcess;

      // Collect output
      let output = '';
      let errorOutput = '';

      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait for process to complete
      try {
        const exitCode = await new Promise((resolve, reject) => {
          childProcess.on('close', resolve);
          childProcess.on('error', reject);
          
          // Timeout handling
          setTimeout(() => {
            childProcess.kill();
            reject(new Error('Command timeout'));
          }, timeout + 1000);
        });

        let combinedOutput = output;
        if (errorOutput) {
          combinedOutput += combinedOutput ? '\n' + errorOutput : errorOutput;
        }

        res.json({
          success: true,
          output: combinedOutput.trim(),
          exitCode: exitCode || 0,
          cwd: session.cwd,
          command: command
        });
      } catch (error) {
        session.isRunning = false;
        res.json({
          success: false,
          output: `Error: ${error.message}`,
          exitCode: 1,
          cwd: session.cwd
        });
      }

    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to execute command',
        details: error.message
      });
    }
  });

  // Obsługa komendy cd
  function handleCdCommand(session, command, res) {
    const newPath = command.substring(3).trim();
    let absolutePath;
    
    if (!newPath || newPath === '~') {
      absolutePath = os.homedir();
    } else if (newPath === '-') {
      // Wróć do poprzedniego katalogu
      absolutePath = session.previousCwd || session.cwd;
    } else {
      absolutePath = path.resolve(session.cwd, newPath);
    }
    
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
      session.previousCwd = session.cwd;
      session.cwd = absolutePath;
      
      res.json({
        success: true,
        output: '',
        exitCode: 0,
        cwd: absolutePath
      });
    } catch (error) {
      res.json({
        success: false,
        output: `cd: ${newPath}: No such file or directory`,
        exitCode: 1,
        cwd: session.cwd
      });
    }
  }

  // ==================== ZARZĄDZANIE SESJAMI ====================

  // Kill running process
  app.post('/terminal/sessions/:sessionId/kill', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { signal = 'SIGTERM' } = req.body;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      
      if (session.process) {
        session.process.kill(signal);
        session.isRunning = false;
        session.process = null;
      }

      res.json({ 
        success: true,
        message: `Process killed with signal ${signal}`
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to kill process',
        details: error.message
      });
    }
  });

  // Change shell for session
  app.post('/terminal/sessions/:sessionId/shell', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { shell } = req.body;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      // Validate shell exists
      try {
        await execAsync(`which ${shell}`);
      } catch {
        return res.status(400).json({ 
          success: false,
          error: `Shell '${shell}' not found`
        });
      }

      const session = terminalSessions.get(sessionId);
      session.shell = shell;

      res.json({ 
        success: true,
        message: `Shell changed to ${shell}`
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to change shell',
        details: error.message
      });
    }
  });

  // Restart terminal session
  app.post('/terminal/sessions/:sessionId/restart', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      
      // Kill existing process if running
      if (session.process) {
        session.process.kill();
        session.process = null;
      }

      session.cwd = os.homedir();
      session.isRunning = false;
      session.lastActivity = new Date();

      res.json({ 
        success: true,
        message: 'Session restarted',
        cwd: session.cwd
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to restart session',
        details: error.message
      });
    }
  });

  // Get terminal session info
  app.get('/terminal/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      
      res.json({
        success: true,
        session: {
          id: session.id,
          shell: session.shell,
          cwd: session.cwd,
          serverId: session.serverId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          isActive: session.process !== null,
          isRunning: session.isRunning,
          exitCode: session.exitCode,
          history: session.history.slice(-10), // Ostatnie 10 komend
          historyCount: session.history.length
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get session info',
        details: error.message
      });
    }
  });

  // Get all active sessions
  app.get('/terminal/sessions', requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId || 'default';
      
      const sessions = Array.from(terminalSessions.values())
        .filter(s => s.userId === userId)
        .map(session => ({
          id: session.id,
          shell: session.shell,
          cwd: session.cwd,
          serverId: session.serverId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          isActive: session.process !== null,
          isRunning: session.isRunning,
          commandCount: session.history.length
        }));

      res.json({
        success: true,
        sessions: sessions,
        count: sessions.length
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get sessions',
        details: error.message
      });
    }
  });

  // Delete terminal session
  app.delete('/terminal/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      
      // Kill process if running
      if (session.process) {
        session.process.kill();
      }

      terminalSessions.delete(sessionId);

      res.json({ 
        success: true,
        message: 'Session closed'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to close session',
        details: error.message
      });
    }
  });

  // ==================== ZARZĄDZANIE PREFERENCJAMI ====================

  // Get user preferences
  app.get('/terminal/preferences', requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId || 'default';
      
      if (!userPreferences.has(userId)) {
        userPreferences.set(userId, {
          defaultShell: 'bash',
          historySize: 1000,
          fontSize: 14,
          theme: 'dark',
          fontFamily: 'SF Mono, Monaco, monospace',
          cursorStyle: 'block',
          cursorBlink: true
        });
      }

      res.json({
        success: true,
        preferences: userPreferences.get(userId)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get preferences',
        details: error.message
      });
    }
  });

  // Update user preferences
  app.post('/terminal/preferences', requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId || 'default';
      const updates = req.body;
      
      const currentPrefs = userPreferences.get(userId) || {
        defaultShell: 'bash',
        historySize: 1000,
        fontSize: 14,
        theme: 'dark'
      };

      userPreferences.set(userId, { ...currentPrefs, ...updates });

      res.json({
        success: true,
        preferences: userPreferences.get(userId)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to update preferences',
        details: error.message
      });
    }
  });

  // ==================== SYSTEM STATS ====================

  // Get system stats
  app.get('/terminal/stats', requireAuth, async (req, res) => {
    try {
      // CPU usage
      const cpuPromise = execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      
      // Memory usage
      const memoryPromise = execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
      
      // Load average
      const loadPromise = execAsync("uptime | awk -F'load average:' '{print $2}' | awk '{print $1}'");
      
      // Disk usage
      const diskPromise = execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
      
      // Process count
      const processPromise = execAsync("ps aux | wc -l");
      
      const [cpuResult, memoryResult, loadResult, diskResult, processResult] = await Promise.allSettled([
        cpuPromise, memoryPromise, loadPromise, diskPromise, processPromise
      ]);

      const stats = {
        cpu: cpuResult.status === 'fulfilled' ? parseFloat(cpuResult.value.stdout.trim()) : 0,
        memory: memoryResult.status === 'fulfilled' ? parseFloat(memoryResult.value.stdout.trim()) : 0,
        load: loadResult.status === 'fulfilled' ? parseFloat(loadResult.value.stdout.trim().replace(',', '.')) : 0,
        disk: diskResult.status === 'fulfilled' ? parseFloat(diskResult.value.stdout.trim()) : 0,
        processes: processResult.status === 'fulfilled' ? parseInt(processResult.value.stdout.trim()) : 0,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        stats: stats
      });
    } catch (error) {
      res.json({
        success: true,
        stats: {
          cpu: 0,
          memory: 0,
          load: 0,
          disk: 0,
          processes: 0,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Get system info
  app.get('/terminal/system-info', requireAuth, async (req, res) => {
    try {
      const hostname = os.hostname();
      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();
      const cpus = os.cpus().length;
      const totalMem = os.totalmem();
      const uptime = os.uptime();

      res.json({
        success: true,
        info: {
          hostname,
          platform,
          release,
          arch,
          cpus,
          totalMem,
          uptime,
          loadAvg: os.loadavg()
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get system info',
        details: error.message
      });
    }
  });

  // ==================== UTILS ====================

  // Get available shells
  app.get('/terminal/shells', requireAuth, async (req, res) => {
    try {
      const shells = ['bash', 'sh', 'zsh', 'fish', 'dash', 'ksh', 'tcsh', 'csh'];
      const availableShells = [];

      for (const shell of shells) {
        try {
          await execAsync(`which ${shell}`);
          availableShells.push(shell);
        } catch {
          // Shell not available, skip
        }
      }

      res.json({
        success: true,
        shells: availableShells
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get available shells',
        details: error.message
      });
    }
  });

  // Get directory listing
  app.post('/terminal/ls', requireAuth, async (req, res) => {
    try {
      const { path: dirPath = '.' } = req.body;
      const absolutePath = path.resolve(dirPath);
      
      const files = fs.readdirSync(absolutePath).map(file => {
        const filePath = path.join(absolutePath, file);
        const stat = fs.statSync(filePath);
        
        return {
          name: file,
          type: stat.isDirectory() ? 'directory' : 'file',
          size: stat.size,
          mode: stat.mode,
          modified: stat.mtime,
          isSymlink: stat.isSymbolicLink()
        };
      });

      res.json({
        success: true,
        path: absolutePath,
        files: files
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to list directory',
        details: error.message
      });
    }
  });

  // Clean up old sessions (cron job can call this)
  app.post('/terminal/cleanup', requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const MAX_AGE = 30 * 60 * 1000; // 30 minutes
      let cleanedCount = 0;

      for (const [sessionId, session] of terminalSessions.entries()) {
        const age = now - session.lastActivity;
        
        if (age > MAX_AGE) {
          if (session.process) {
            session.process.kill();
          }
          terminalSessions.delete(sessionId);
          cleanedCount++;
        }
      }

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} old sessions`,
        cleanedCount: cleanedCount,
        remainingCount: terminalSessions.size
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to cleanup sessions',
        details: error.message
      });
    }
  });
};
