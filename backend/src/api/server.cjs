const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = function(app, requireAuth) {

// Endpoint shutdown
app.post('/api/system-shutdown', requireAuth, (req, res) => {
  console.log('Received shutdown command');
  
  setTimeout(() => {
    exec('shutdown now')
  }, 2000);
  
  res.json({ status: 'shutting down' });
});

// Endpoint schedule shutdown
app.post('/api/system/schedule-shutdown', requireAuth, async (req, res) => {
  const { time } = req.body;
  
  try {
    exec(`echo "sudo shutdown -h now" | at ${time}`, (error) => {
      if (error) {
        return res.status(500).json({ error: 'Błąd podczas planowania' });
      }
      res.json({ message: `Wyłączenie zaplanowane na ${time}` });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint cancel shutdown
app.post('/api/system/cancel-shutdown', requireAuth, async (req, res) => {
  try {
    exec('sudo shutdown -c', (error) => {
      if (error) {
        return res.status(500).json({ error: 'Błąd podczas anulowania' });
      }
      res.json({ message: 'Zaplanowane wyłączenie anulowane' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system-restart', requireAuth, async (req, res) => {
  console.log('Received restart command from:', req.ip);
  
  try {
    res.json({ 
      status: 'restarting',
      message: 'Server restart initiated',
      timestamp: new Date().toISOString(),
      estimatedTime: '1-3 minutes'
    });
    
    setTimeout(() => {
      try {
        console.log('Executing system restart...');
        exec('sudo reboot');
      } catch (error) {
        console.error('Restart failed:', error);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Restart command error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate restart',
      message: error.message 
    });
  }
});

app.get('/api/system-health', (req, res) => {
  try {
    console.log('Health check requested');
    
    const isHealthy = true; // Serwer działa, więc zwracamy true
    
    console.log('Health check result:', isHealthy);
    
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json(isHealthy);
    
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(200).json(false);
  }
});

function checkDiskSpace() {
  try {
    // Proste sprawdzenie miejsca na dysku
    const diskInfo = execSync("df / | awk 'NR==2{print $4}'").toString().trim();
    const freeSpace = parseInt(diskInfo);
    console.log('Free disk space:', freeSpace);
    return freeSpace > 100000; // Minimum 100KB wolnego miejsca
  } catch (error) {
    console.error('Disk space check failed:', error);
    return true;
  }
}

function checkMemory() {
  try {
    // Proste sprawdzenie pamięci
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const freePercent = (freeMem / totalMem) * 100;
    console.log('Free memory:', freePercent.toFixed(1) + '%');
    return freePercent > 1; // Minimum 1% wolnej pamięci
  } catch (error) {
    console.error('Memory check failed:', error);
    return true;
  }
}

};
