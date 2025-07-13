const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid')
const activeProcesses = new Map()

// Helper do wykonania komendy z obietnicą
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message)
      } else {
        resolve(stdout)
      }
    })
  })
}

module.exports = function(app, requireAuth) {
// Lista procesów
app.get('/diagnostics/processes', requireAuth, (req, res) => {
  exec('ps -eo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu --no-headers', (error, stdout, stderr) => {
    if (error) {
      console.error('Error executing ps command:', error);
      return res.status(500).json({ error: 'Failed to get processes' });
    }

    const processes = stdout.trim().split('\n').map(line => {
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
    });

    res.json({ processes });
  });
});

// Zakończ proces
app.post('/diagnostics/processes/kill', requireAuth, (req, res) => {
  const { pid } = req.body;
  
  if (!pid || isNaN(pid)) {
    return res.status(400).json({ error: 'Invalid PID' });
  }

  // Sprawdź czy proces istnieje i czy można go zakończyć
  exec(`ps -p ${pid} -o user=`, (error, stdout) => {
    if (error) {
      return res.status(404).json({ error: 'Process not found' });
    }

    const user = stdout.trim();
    if (user === 'root') {
      return res.status(403).json({ error: 'Cannot kill root processes' });
    }

    // Właściwe zakończenie procesu
    exec(`kill -9 ${pid}`, (killError) => {
      if (killError) {
        console.error('Error killing process:', killError);
        return res.status(500).json({ error: 'Failed to kill process' });
      }
      res.json({ message: `Process ${pid} killed successfully` });
    });
  });
});

}
