// src/api/terminal.js
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');

// Store active terminal sessions
const terminalSessions = new Map();

module.exports = function(app, requireAuth) {

  // Create new terminal session
  app.post('/terminal/sessions', requireAuth, async (req, res) => {
    try {
      const { shell = 'bash' } = req.body;
      const sessionId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
      const initialPath = process.cwd();

      // Store session info
      terminalSessions.set(sessionId, {
        id: sessionId,
        shell: shell,
        process: null,
        cwd: initialPath,
        createdAt: new Date(),
        lastActivity: new Date()
      });

      res.json({
        success: true,
        sessionId: sessionId,
        initialPath: initialPath,
        shell: shell
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Failed to create terminal session',
        details: error.message
      });
    }
  });

  // Execute command in terminal session
  app.post('/terminal/sessions/:sessionId/execute', requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command } = req.body;
      
      if (!terminalSessions.has(sessionId)) {
        return res.status(404).json({ 
          success: false,
          error: 'Session not found'
        });
      }

      const session = terminalSessions.get(sessionId);
      session.lastActivity = new Date();

      // Special handling for cd command
      if (command.startsWith('cd ')) {
        const newPath = command.substring(3).trim();
        const absolutePath = path.resolve(session.cwd, newPath);
        
        try {
          fs.accessSync(absolutePath, fs.constants.R_OK);
          session.cwd = absolutePath;
          
          res.json({
            success: true,
            output: `Changed directory to: ${absolutePath}`,
            exitCode: 0
          });
        } catch (error) {
          res.json({
            success: false,
            output: `cd: ${newPath}: No such file or directory`,
            exitCode: 1
          });
        }
        return;
      }

      // Execute command
      const childProcess = exec(command, {
        cwd: session.cwd,
        shell: session.shell,
        encoding: 'utf8',
        timeout: 30000
      }, (error, stdout, stderr) => {
        // Clean up process reference
        session.process = null;
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

      childProcess.on('close', (code) => {
        // Already handled via promise
      });

      // Wait for process to complete
      try {
        await new Promise((resolve, reject) => {
          childProcess.on('close', (code) => {
            resolve(code);
          });
          childProcess.on('error', reject);
        });

        const combinedOutput = output + (errorOutput ? `\n${errorOutput}` : '');

        res.json({
          success: true,
          output: combinedOutput.trim(),
          exitCode: childProcess.exitCode || 0
        });
      } catch (error) {
        res.json({
          success: false,
          output: `Error: ${error.message}`,
          exitCode: 1
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

      session.cwd = process.cwd();
      session.lastActivity = new Date();

      res.json({ 
        success: true,
        message: 'Session restarted'
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
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          isActive: session.process !== null
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
      const sessions = Array.from(terminalSessions.values()).map(session => ({
        id: session.id,
        shell: session.shell,
        cwd: session.cwd,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        isActive: session.process !== null
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

  // Get system stats
  app.get('/terminal/stats', requireAuth, async (req, res) => {
    try {
      // Get CPU usage
      const cpuPromise = execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      
      // Get memory usage
      const memoryPromise = execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
      
      // Get load average
      const loadPromise = execAsync("uptime | awk -F'load average:' '{print $2}' | awk '{print $1}'");
      
      const [cpuResult, memoryResult, loadResult] = await Promise.allSettled([
        cpuPromise, memoryPromise, loadPromise
      ]);

      const stats = {
        cpu: cpuResult.status === 'fulfilled' ? parseFloat(cpuResult.value.stdout.trim()) : 0,
        memory: memoryResult.status === 'fulfilled' ? parseFloat(memoryResult.value.stdout.trim()) : 0,
        load: loadResult.status === 'fulfilled' ? parseFloat(loadResult.value.stdout.trim().replace(',', '.')) : 0,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        stats: stats
      });
    } catch (error) {
      // Return default values if stats collection fails
      res.json({
        success: true,
        stats: {
          cpu: 0,
          memory: 0,
          load: 0,
          timestamp: new Date().toISOString()
        }
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

  // Get available shells
  app.get('/terminal/shells', requireAuth, async (req, res) => {
    try {
      const shells = ['bash', 'sh', 'zsh', 'fish', 'dash', 'ksh'];
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
};