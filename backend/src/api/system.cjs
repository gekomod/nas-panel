const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid')
const activeProcesses = new Map()

const SETTINGS_PATH = '/etc/nas-panel/settings.json';

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
app.get('/system/updates/check', requireAuth, async (req, res) => {
  try {
    // Aktualizacja listy pakietów z timeoutem
    await execPromise('timeout 30 apt-get update')

    // Uproszczone parsowanie z mniejszą liczbą pipe'ów
    const output = await execPromise('apt-get -s dist-upgrade')
    const updates = []
    const packageNames = new Set()
    
    // Parsowanie linii
    output.split('\n').forEach(line => {
      if (line.startsWith('Inst ')) {
        const parts = line.split(/\s+/)
        if (parts.length >= 4) {
          const name = parts[1]
          if (!packageNames.has(name)) {
            packageNames.add(name)
            updates.push({
              name,
              current_version: parts[2].replace(/[()]/g, ''),
              new_version: parts[3]
            })
          }
        }
      }
    })

    // Pobieranie opisów tylko dla unikalnych pakietów
    if (updates.length > 0) {
      const descriptions = await execPromise(
        `apt-cache show ${Array.from(packageNames).join(' ')} | ` +
        `awk '/^Package:/ {pkg=$2} /^Description(-[a-z]+)?:/ {print pkg ":" $0}'`
      )
      
      const descMap = {}
      descriptions.split('\n').forEach(line => {
        const [pkg, desc] = line.split(':')
        if (pkg && desc) descMap[pkg] = desc.trim()
      })

      updates.forEach(update => {
        update.description = descMap[update.name] || 'No description available'
      })
    }

    res.json({ updates })
  } catch (error) {
    console.error('Update check error:', error)
    res.status(500).json({ 
      message: 'Failed to check updates', 
      error: error.toString()
    })
  }
})

app.get('/system/updates/check-deps/:pkg', requireAuth, async (req, res) => {
  try {
    const { pkg } = req.params
    const output = await execPromise(`apt-get install -s ${pkg}`)
    
    // Analiza zależności
    const dependencies = output.match(/Inst\s([^\s]+)/g)
      ?.map(dep => dep.replace('Inst ', ''))
      ?.filter(dep => dep !== pkg) || []
    
    res.json({ 
      package: pkg,
      dependencies,
      totalSize: extractDownloadSize(output)
    })
  } catch (err) {
    res.status(400).json({ 
      message: 'Dependency check failed',
      error: err.toString(),
      output: err.output?.toString()
    })
  }
});

// Instalacja aktualizacji
app.post('/system/updates/install', requireAuth, async (req, res) => {
  const { packages = [], no_confirm = false } = req.body
  
  try {
    let command
    if (packages.length > 0) {
      command = `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(' ')}`
    } else {
      command = `DEBIAN_FRONTEND=noninteractive apt-get upgrade -y`
    }

    // Uruchomienie w tle z zapisem PID
    const child = exec(command, { detached: true })
    const processId = uuidv4()
    
    activeProcesses.set(processId, {
      child,
      packages,
      startTime: new Date()
    })

    res.json({ 
      success: true,
      processId,
      message: 'Installation started in background'
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.toString()
    })
  }
});

// Endpoint do śledzenia postępu (SSE)
app.get('/system/updates/progress/:pkg', requireAuth, (req, res) => {
  const { pkg } = req.params
  
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Symulacja postępu (w rzeczywistości parsuj stdout apt)
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      res.write(`data: ${JSON.stringify({
        progress: 100,
        status: 'success',
        message: 'Installation complete'
      })}\n\n`)
      setTimeout(() => res.end(), 1000)
    } else {
      res.write(`data: ${JSON.stringify({
        progress,
        message: progress < 30 ? 'Downloading...' : 
                progress < 70 ? 'Installing...' : 'Finalizing...',
        status: ''
      })}\n\n`)
    }
  }, 800)

  req.on('close', () => {
    clearInterval(interval)
  })
})

// Anulowanie instalacji
app.delete('/system/updates/cancel/:pkg', requireAuth, async (req, res) => {
  const { pkg } = req.params
  const process = [...activeProcesses.values()].find(p => p.packages.includes(pkg))
  
  if (!process) {
    return res.status(404).json({ message: 'Process not found' })
  }

  try {
    process.child.kill('SIGTERM')
    await new Promise(resolve => process.child.on('exit', resolve))
    
    process.clients.forEach(client => {
      client.res.write(`data: ${JSON.stringify({
        progress: 0,
        status: 'exception',
        message: 'Installation cancelled by user'
      })}\n\n`)
      client.res.end()
    })
    
    activeProcesses.delete(process.id)
    res.json({ message: 'Installation cancelled' })
  } catch (err) {
    res.status(500).json({ 
      message: 'Failed to cancel installation',
      error: err.toString()
    })
  }
})

// Endpoint zdrowia systemu
app.get('/api/system-health', (req, res) => {
  res.status(200).json({ status: 'healthy' })
})

// Endpoint restartu systemu
app.post('/api/system-restart', requireAuth, (req, res) => {
  // W rzeczywistości tutaj powinna być logika restartu systemu
  console.log('Received restart command')
  
  // Symulacja opóźnienia restartu
  setTimeout(() => {
    // W rzeczywistości tutaj powinno być wywołanie systemowe np.:
    // require('child_process').exec('sudo reboot')
    process.exit(0) // Tylko dla testów - wyłącza serwer Node
  }, 3000)
  
  res.json({ status: 'restarting' })
})

// Pobierz ustawienia
app.get('/system/settings', (req, res) => {
  try {
    const settings = fs.readFileSync(SETTINGS_PATH, 'utf8');
    res.json(JSON.parse(settings));
  } catch (error) {
    console.error('Error reading settings:', error);
    // Zwróć domyślne ustawienia jeśli plik nie istnieje
    res.json({
      docker: {
        composeDir: '/opt/docker/compose',
        dataRoot: '/var/lib/docker',
        autoStart: true
      },
      system: {
        hostname: '',
        timezone: 'Europe/Warsaw',
        language: 'pl',
        autoUpdates: false
      },
      ui: {
        theme: 'system',
        sidebarMode: 'vertical'
      },
      services: {
        monitoredServices: []
      }
    });
  }
});

// Zapisz ustawienia
app.post('/system/settings', async (req, res) => {
  try {
    await fs.writeFileSync(SETTINGS_PATH, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

  app.get('/services/status/:service', async (req, res) => {
    const { service } = req.params
    
    try {
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

// Helper functions
function getStatusMessage(progress) {
  const phases = [
    { range: [0, 20], messages: ['Preparing installation', 'Checking dependencies'] },
    { range: [21, 50], messages: ['Downloading package', 'Verifying package'] },
    { range: [51, 80], messages: ['Installing package', 'Configuring system'] },
    { range: [81, 99], messages: ['Finalizing installation', 'Cleaning up'] },
    { range: [100, 100], messages: ['Installation complete'] }
  ]
  
  const phase = phases.find(p => progress >= p.range[0] && progress <= p.range[1])
  return phase.messages[Math.floor(Math.random() * phase.messages.length)]
}

// Helper functions
function parseAptProgress(line) {
  // Przykładowe parsowanie outputu apt
  if (line.includes('Unpacking')) {
    return { progress: 30, message: 'Unpacking package...', status: '' }
  }
  if (line.includes('Setting up')) {
    return { progress: 80, message: 'Configuring package...', status: '' }
  }
  if (line.match(/Get:\d+/)) {
    const match = line.match(/(\d+)%/)
    const percent = match ? parseInt(match[1]) : 0
    return { 
      progress: Math.floor(percent * 0.7), // Download to 70% całego procesu
      message: 'Downloading package...',
      status: '',
      indeterminate: percent === 0
    }
  }
  return null
}

function extractDownloadSize(output) {
  const match = output.match(/Need to get (\d+ [KM]B)/)
  return match ? match[1] : 'unknown'
}

// Helper do wykonania komendy z Promise
function execPromise(command) {
  return new Promise((resolve, reject) => {
    require('child_process').exec(command, (error, stdout, stderr) => {
      if (error) {
        error.output = stdout + stderr
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

}
