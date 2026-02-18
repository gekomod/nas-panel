// src/api/nfs.js
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const execAsync = promisify(exec);

const FSTAB_PATH = '/etc/fstab';

// Przechowuj status skanowania w pamięci
const scanStatus = new Map();
const networkScanStatus = new Map();

// Flaga czy skanowanie jest w toku
let isScanning = false;

module.exports = function(app, requireAuth) {

  // ==================== PODSTAWOWE FUNKCJE ====================

  // Sprawdź rolę (klient/serwer)
  app.get('/api/nfs/role', requireAuth, async (req, res) => {
    try {
      let isServer = false;
      let isClient = false;
      
      try {
        const { stdout: serverCheck } = await execAsync('systemctl list-unit-files | grep -E "nfs-(server|kernel-server|utils)" || true');
        isServer = serverCheck && (serverCheck.includes('enabled') || serverCheck.includes('static'));
      } catch (e) { 
        console.log('Server check error:', e.message);
      }
      
      try {
        const { stdout: clientCheck } = await execAsync('which mount.nfs || true');
        isClient = clientCheck && clientCheck.trim().length > 0;
      } catch (e) { 
        console.log('Client check error:', e.message);
      }
      
      let activeMounts = [];
      try {
        const { stdout: mounts } = await execAsync('mount -t nfs,nfs4 2>/dev/null || true');
        activeMounts = mounts.split('\n')
          .filter(line => line && line.includes(':'))
          .map(line => {
            const parts = line.split(' ');
            const source = parts[0] || '';
            const mountPoint = parts[2] || '';
            return { source, mountPoint };
          });
      } catch (e) {
        console.log('Mounts check error:', e.message);
      }
      
      res.json({
        success: true,
        isServer,
        isClient,
        activeMounts,
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to check NFS role',
        details: error.message
      });
    }
  });

  // Pobierz listę sieci
  app.get('/api/nfs/networks', requireAuth, async (req, res) => {
    try {
      const interfaces = os.networkInterfaces();
      const networks = [];
      const uniqueNetworks = new Set();
      
      Object.keys(interfaces).forEach(iface => {
        // Pomiń interfejsy wirtualne
        if (iface.startsWith('docker') || 
            iface.startsWith('br-') || 
            iface.startsWith('veth') || 
            iface.startsWith('virbr') ||
            iface === 'lo') {
          return;
        }
        
        interfaces[iface].forEach(addr => {
          if (addr.family === 'IPv4' && !addr.internal) {
            const ipParts = addr.address.split('.');
            if (ipParts.length === 4) {
              const network = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
              // Dodaj tylko unikalne sieci
              if (!uniqueNetworks.has(network)) {
                uniqueNetworks.add(network);
                networks.push({
                  interface: iface,
                  ip: addr.address,
                  network
                });
              }
            }
          }
        });
      });
      
      res.json({ success: true, networks });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==================== SKANOWANIE POJEDYNCZEGO IP ====================

  // Skanuj pojedyncze IP
  app.get('/api/nfs/scan-ip/:ip', requireAuth, async (req, res) => {
    const { ip } = req.params;
    
    try {
      // Sprawdź czy host odpowiada
      await execAsync(`ping -c 1 -W 2 ${ip}`);
      
      // Sprawdź showmount
      try {
        const { stdout } = await execAsync(`timeout 3 showmount -e ${ip} 2>/dev/null`);
        const exports = stdout.split('\n')
          .slice(1)
          .filter(line => line && line.trim() && !line.includes('clnt_create'))
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              export: parts[0] || '',
              options: parts[1] || '*'
            };
          });
        
        if (exports.length > 0) {
          const hostname = await getHostname(ip);
          return res.json({
            success: true,
            server: {
              ip,
              hostname,
              exports,
              reachable: true
            }
          });
        }
      } catch (e) {
        // Brak NFS
      }
      
      res.json({ success: true, server: null });
    } catch (error) {
      res.status(404).json({ 
        success: false, 
        error: 'Host not reachable' 
      });
    }
  });

  // ==================== SKANOWANIE WSZYSTKICH SIECI (POOLING) ====================

  // Rozpocznij skanowanie wszystkich sieci
app.post('/api/nfs/discover-start', requireAuth, async (req, res) => {
  const { networks } = req.body;
  const scanId = 'discover_' + Date.now();
  
  // Pobierz sieci do skanowania (jeśli nie podano, wykryj automatycznie)
  let networksToScan = [];
  const uniqueNetworks = new Set();
  
  if (networks && networks.length > 0) {
    networks.forEach(net => uniqueNetworks.add(net));
  } else {
    const interfaces = os.networkInterfaces();
    
    Object.keys(interfaces).forEach(iface => {
      if (iface.startsWith('docker') || iface.startsWith('br-') || iface === 'lo') return;
      
      interfaces[iface].forEach(addr => {
        if (addr.family === 'IPv4' && !addr.internal) {
          const ipParts = addr.address.split('.');
          if (ipParts[0] === '192' && ipParts[1] === '168') {
            const network = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
            uniqueNetworks.add(network);
          }
        }
      });
    });
  }
  
  networksToScan = Array.from(uniqueNetworks);
  
  if (networksToScan.length === 0) {
    networksToScan.push('192.168.1');
  }
  
  console.log(`[${scanId}] Starting scan for networks:`, networksToScan);
  
  // Inicjalizuj status
  const initialStatus = {
    progress: 0,
    currentIp: '',
    scanned: 0,
    total: networksToScan.length * 254,
    servers: [],
    networks: networksToScan,
    currentNetwork: networksToScan[0] || '',
    currentNetworkIndex: 0,
    complete: false,
    active: true,
    startTime: new Date().toISOString(),
    lastUpdate: new Date().toISOString()
  };
  
  scanStatus.set(scanId, initialStatus);
  
  // Uruchom skanowanie jako osobny proces
  scanNetworksInBackground(scanId, networksToScan).catch(err => {
    console.error(`[${scanId}] Background scan error:`, err);
  });
  
  res.json({ 
    success: true, 
    scanId,
    networks: networksToScan,
    totalIps: networksToScan.length * 254,
    status: initialStatus
  });
});

  // Sprawdź status skanowania wszystkich sieci
app.get('/api/nfs/discover-status', requireAuth, async (req, res) => {
  const { scanId } = req.query;
  
  if (scanId && scanStatus.has(scanId)) {
    return res.json(scanStatus.get(scanId));
  }
  
  // Znajdź ostatnie aktywne skanowanie
  const scans = Array.from(scanStatus.entries());
  const activeScans = scans.filter(([_, data]) => data.active && !data.complete);
  
  if (activeScans.length > 0) {
    const latestScan = activeScans.sort((a, b) => 
      new Date(b[1].startTime) - new Date(a[1].startTime)
    )[0];
    return res.json(latestScan[1]);
  }
  
  if (scans.length > 0) {
    const latestScan = scans.sort((a, b) => 
      new Date(b[1].startTime) - new Date(a[1].startTime)
    )[0];
    return res.json(latestScan[1]);
  }
  
  res.json({ 
    progress: 0, 
    scanned: 0, 
    total: 0, 
    servers: [], 
    complete: false,
    active: false
  });
});

  // Funkcja skanująca wszystkie sieci w tle
async function scanNetworksInBackground(scanId, networks) {
  console.log(`[${scanId}] Background scan started`);
  
  const servers = [];
  let scannedIps = 0;
  const totalIps = networks.length * 254;
  
  try {
    for (let netIdx = 0; netIdx < networks.length; netIdx++) {
      const network = networks[netIdx];
      console.log(`[${scanId}] Scanning network ${network} (${netIdx + 1}/${networks.length})`);
      
      for (let i = 1; i <= 254; i++) {
        const targetIP = `${network}.${i}`;
        scannedIps++;
        
        // Oblicz progress
        const progress = Math.round((scannedIps / totalIps) * 100);
        
        // Aktualizuj status co 5 IP (dla wydajności)
        if (i % 5 === 0 || i === 1) {
          const status = scanStatus.get(scanId);
          if (status) {
            status.progress = progress;
            status.currentIp = targetIP;
            status.scanned = scannedIps;
            status.total = totalIps;
            status.servers = servers;
            status.currentNetwork = network;
            status.currentNetworkIndex = netIdx;
            status.lastUpdate = new Date().toISOString();
            status.active = true;
            
            scanStatus.set(scanId, status);
          }
        }
        
        // Log co 50 IP
        if (i % 50 === 0) {
          console.log(`[${scanId}] Progress: ${progress}% - ${targetIP}`);
        }
        
        // Użyj Promise.race z timeoutem
        try {
          // Ping z timeoutem 1 sekunda
          await execAsync(`ping -c 1 -W 1 ${targetIP}`);
          
          // Jeśli ping OK, sprawdź NFS z krótkim timeoutem
          try {
            const { stdout } = await Promise.race([
              execAsync(`timeout 2 showmount -e ${targetIP} 2>/dev/null`),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Showmount timeout')), 2500))
            ]);
            
            const exports = stdout.split('\n')
              .slice(1)
              .filter(line => line && line.trim() && !line.includes('clnt_create'))
              .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                  export: parts[0] || '',
                  options: parts[1] || '*'
                };
              });
            
            if (exports.length > 0) {
              const hostname = await getHostname(targetIP);
              servers.push({
                ip: targetIP,
                hostname,
                exports,
                reachable: true,
                network
              });
              console.log(`[${scanId}] Found server: ${targetIP} with ${exports.length} exports`);
            }
          } catch (e) {
            // Brak NFS lub timeout - ignoruj
          }
        } catch (e) {
          // Host nie odpowiada na ping - ignoruj, ale nie zwalniaj tempa
          // console.log(`[${scanId}] Host ${targetIP} not responding`);
        }
        
        // Małe opóźnienie - TYLKO co 10 IP, nie po każdym
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    }
    
    console.log(`[${scanId}] Scan completed. Found ${servers.length} servers`);
    
    // Aktualizuj status końcowy
    const finalStatus = {
      progress: 100,
      currentIp: '',
      scanned: totalIps,
      total: totalIps,
      servers: servers,
      networks: networks,
      currentNetwork: '',
      currentNetworkIndex: networks.length,
      complete: true,
      active: false,
      endTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      stats: {
        totalScanned: totalIps,
        serversFound: servers.length,
        networks: networks.length
      }
    };
    
    scanStatus.set(scanId, finalStatus);
    
  } catch (error) {
    console.error(`[${scanId}] Scan error:`, error);
    
    const errorStatus = scanStatus.get(scanId);
    if (errorStatus) {
      errorStatus.error = error.message;
      errorStatus.active = false;
      errorStatus.complete = true;
      scanStatus.set(scanId, errorStatus);
    }
  }
}

  // ==================== SKANOWANIE POJEDYNCZEJ SIECI (POOLING) ====================

  // Rozpocznij skanowanie pojedynczej sieci
app.post('/api/nfs/scan-network-start', requireAuth, async (req, res) => {
  const { network } = req.body;
  
  if (!network) {
    return res.status(400).json({ error: 'Network required' });
  }
  
  const scanId = 'network_' + network.replace(/\./g, '_') + '_' + Date.now();
  
  const initialStatus = {
    progress: 0,
    currentIp: '',
    scanned: 0,
    total: 254,
    servers: [],
    network: network,
    complete: false,
    active: true,
    startTime: new Date().toISOString(),
    lastUpdate: new Date().toISOString()
  };
  
  networkScanStatus.set(scanId, initialStatus);
  
  // Uruchom skanowanie
  scanSingleNetworkInBackground(scanId, network).catch(err => {
    console.error(`[${scanId}] Background scan error:`, err);
  });
  
  res.json({ 
    success: true, 
    scanId,
    network,
    totalIps: 254,
    status: initialStatus
  });
});

app.get('/api/nfs/scan-network-status', requireAuth, async (req, res) => {
  const { scanId, network } = req.query;
  
  if (scanId && networkScanStatus.has(scanId)) {
    return res.json(networkScanStatus.get(scanId));
  }
  
  if (network) {
    const scans = Array.from(networkScanStatus.entries());
    const networkScans = scans.filter(([_, data]) => data.network === network);
    
    if (networkScans.length > 0) {
      const latestScan = networkScans.sort((a, b) => 
        new Date(b[1].startTime) - new Date(a[1].startTime)
      )[0];
      return res.json(latestScan[1]);
    }
  }
  
  const scans = Array.from(networkScanStatus.entries());
  const activeScans = scans.filter(([_, data]) => data.active && !data.complete);
  
  if (activeScans.length > 0) {
    const latestScan = activeScans.sort((a, b) => 
      new Date(b[1].startTime) - new Date(a[1].startTime)
    )[0];
    return res.json(latestScan[1]);
  }
  
  res.json({ 
    progress: 0, 
    scanned: 0, 
    total: 254, 
    servers: [], 
    complete: false,
    active: false
  });
});

  // Funkcja skanująca pojedynczą sieć w tle
async function scanSingleNetworkInBackground(scanId, network) {
  console.log(`[${scanId}] Starting scan for ${network}`);
  
  const servers = [];
  
  try {
    for (let i = 1; i <= 254; i++) {
      const targetIP = `${network}.${i}`;
      const progress = Math.round((i / 254) * 100);
      
      // Aktualizuj status
      const status = networkScanStatus.get(scanId);
      if (status) {
        status.progress = progress;
        status.currentIp = targetIP;
        status.scanned = i;
        status.total = 254;
        status.servers = servers;
        status.lastUpdate = new Date().toISOString();
        status.active = true;
        
        networkScanStatus.set(scanId, status);
      }
      
      // Log co 50 IP
      if (i % 50 === 0) {
        console.log(`[${scanId}] Progress: ${progress}% - ${targetIP}`);
      }
      
      try {
        await execAsync(`ping -c 1 -W 1 ${targetIP}`);
        
        try {
          const { stdout } = await execAsync(`timeout 2 showmount -e ${targetIP} 2>/dev/null`);
          const exports = stdout.split('\n')
            .slice(1)
            .filter(line => line && line.trim() && !line.includes('clnt_create'))
            .map(line => {
              const parts = line.trim().split(/\s+/);
              return {
                export: parts[0] || '',
                options: parts[1] || '*'
              };
            });
          
          if (exports.length > 0) {
            const hostname = await getHostname(targetIP);
            servers.push({
              ip: targetIP,
              hostname,
              exports,
              reachable: true,
              network
            });
            console.log(`[${scanId}] Found server: ${targetIP}`);
          }
        } catch (e) {}
      } catch (e) {}
      
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    console.log(`[${scanId}] Scan completed. Found ${servers.length} servers`);
    
    const finalStatus = {
      progress: 100,
      currentIp: '',
      scanned: 254,
      total: 254,
      servers: servers,
      network: network,
      complete: true,
      active: false,
      endTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      stats: {
        totalScanned: 254,
        serversFound: servers.length
      }
    };
    
    networkScanStatus.set(scanId, finalStatus);
    
  } catch (error) {
    console.error(`[${scanId}] Scan error:`, error);
    
    const errorStatus = networkScanStatus.get(scanId);
    if (errorStatus) {
      errorStatus.error = error.message;
      errorStatus.active = false;
      errorStatus.complete = true;
      networkScanStatus.set(scanId, errorStatus);
    }
  }
}

  // ==================== EKSPORTY Z SERWERA ====================

  // Pobierz listę dostępnych udziałów z konkretnego serwera
  app.get('/api/nfs/exports/:server', requireAuth, async (req, res) => {
    const { server } = req.params;
    
    try {
      const { stdout } = await execAsync(`showmount -e ${server} 2>/dev/null || true`);
      const exports = stdout.split('\n')
        .slice(1)
        .filter(line => line && line.trim() && !line.includes('clnt_create'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            path: parts[0] || '',
            permissions: parts[1] || '*',
            mounted: false
          };
        });
      
      let mounts = '';
      try {
        const { stdout: mountsOutput } = await execAsync('mount -t nfs,nfs4 2>/dev/null || true');
        mounts = mountsOutput;
      } catch (e) {}
      
      exports.forEach(exp => {
        exp.mounted = mounts.includes(`${server}:${exp.path}`);
      });
      
      res.json({
        success: true,
        server,
        exports
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get exports',
        details: error.message
      });
    }
  });

  // ==================== ZARZĄDZANIE MONTOWANIEM ====================

  // Zamontuj udział NFS
  app.post('/api/nfs/mount', requireAuth, async (req, res) => {
    const { server, export: exportPath, mountPoint, options = {}, addToFstab } = req.body;
    
    if (!server || !exportPath || !mountPoint) {
      return res.status(400).json({
        success: false,
        error: 'Server, export path and mount point are required'
      });
    }

    try {
      // Sprawdź czy punkt montowania istnieje, jeśli nie - utwórz
      if (!fs.existsSync(mountPoint)) {
        fs.mkdirSync(mountPoint, { recursive: true, mode: 0o755 });
      }

      // Sprawdź czy już jest zamontowane
      let mounts = '';
      try {
        const { stdout: mountsOutput } = await execAsync('mount -t nfs,nfs4 2>/dev/null || true');
        mounts = mountsOutput;
      } catch (e) {}
      
      if (mounts.includes(`${server}:${exportPath}`)) {
        return res.status(400).json({
          success: false,
          error: 'This share is already mounted'
        });
      }

      // Opcje montowania
      const mountOptions = [
        options.vers ? `vers=${options.vers}` : 'vers=4.2',
        options.rsize ? `rsize=${options.rsize}` : 'rsize=1048576',
        options.wsize ? `wsize=${options.wsize}` : 'wsize=1048576',
        options.hard ? 'hard' : 'soft',
        options.intr ? 'intr' : '',
        options.noexec ? 'noexec' : '',
        options.nosuid ? 'nosuid' : '',
        options.nodev ? 'nodev' : '',
        options.noatime ? 'noatime' : '',
        options._netdev ? '_netdev' : '',
      ].filter(Boolean).join(',');

      const source = `${server}:${exportPath}`;
      const mountCmd = `mount -t nfs -o ${mountOptions} ${source} ${mountPoint}`;

      await execAsync(mountCmd);

      // Opcjonalnie dodaj do fstab
      if (addToFstab) {
        const fstabEntry = `${source} ${mountPoint} nfs ${mountOptions} 0 0\n`;
        fs.appendFileSync(FSTAB_PATH, fstabEntry);
      }

      res.json({
        success: true,
        message: 'NFS share mounted successfully',
        source,
        mountPoint,
        options: mountOptions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to mount NFS share',
        details: error.message
      });
    }
  });

  // Odmontuj udział NFS
  app.post('/api/nfs/umount', requireAuth, async (req, res) => {
    const { mountPoint, removeFromFstab } = req.body;
    
    if (!mountPoint) {
      return res.status(400).json({
        success: false,
        error: 'Mount point is required'
      });
    }

    try {
      await execAsync(`umount -f ${mountPoint} 2>/dev/null || true`);

      // Usuń z fstab jeśli zaznaczone
      if (removeFromFstab && fs.existsSync(FSTAB_PATH)) {
        const fstabContent = fs.readFileSync(FSTAB_PATH, 'utf8');
        const newFstab = fstabContent
          .split('\n')
          .filter(line => !line.includes(mountPoint))
          .join('\n');
        fs.writeFileSync(FSTAB_PATH, newFstab);
      }

      // Spróbuj usunąć pusty katalog
      try {
        fs.rmdirSync(mountPoint);
      } catch (e) {
        // Katalog nie jest pusty lub nie można usunąć
      }

      res.json({
        success: true,
        message: 'NFS share unmounted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to unmount NFS share',
        details: error.message
      });
    }
  });

  // Pobierz listę zamontowanych udziałów
  app.get('/api/nfs/mounts', requireAuth, async (req, res) => {
    try {
      const { stdout } = await execAsync('mount -t nfs,nfs4 2>/dev/null || true');
      const mounts = stdout.split('\n')
        .filter(line => line && line.includes(':'))
        .map(line => {
          const parts = line.split(' ');
          const source = parts[0] || '';
          const mountPoint = parts[2] || '';
          const optionsMatch = line.match(/\((.*?)\)/);
          const options = optionsMatch ? optionsMatch[1].split(',') : [];
          
          const [server, exportPath] = source.split(':');
          
          return {
            server: server || '',
            export: exportPath || '',
            mountPoint,
            options,
            type: 'nfs'
          };
        });

      res.json({
        success: true,
        mounts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list mounts',
        details: error.message
      });
    }
  });

  // ==================== BENCHMARK ====================

  // Benchmark wydajności
  app.post('/api/nfs/benchmark', requireAuth, async (req, res) => {
    const { mountPoint } = req.body;
    
    if (!mountPoint) {
      return res.status(400).json({
        success: false,
        error: 'Mount point is required'
      });
    }

    try {
      const results = {};
      const testFile = path.join(mountPoint, '.nfs_test_' + Date.now());
      
      // Sprawdź czy można pisać
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Mount point is not writable'
        });
      }

      // Test zapisu
      const { stdout: writeOutput } = await execAsync(`dd if=/dev/zero of=${testFile} bs=1M count=100 2>&1 || true`);
      const writeMatch = writeOutput.match(/([\d.]+) (MB|GB)\/s/);
      results.writeSpeed = writeMatch ? writeMatch[0] : 'N/A';

      // Test odczytu
      const { stdout: readOutput } = await execAsync(`dd if=${testFile} of=/dev/null bs=1M 2>&1 || true`);
      const readMatch = readOutput.match(/([\d.]+) (MB|GB)\/s/);
      results.readSpeed = readMatch ? readMatch[0] : 'N/A';

      // Opóźnienie
      const start = Date.now();
      await execAsync(`stat ${mountPoint} >/dev/null 2>&1 || true`);
      const latency = Date.now() - start;
      results.latency = `${latency}ms`;

      // Wyczyść plik testowy
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }

      res.json({
        success: true,
        ...results,
        mountPoint
      });
    } catch (error) {
      console.error('Benchmark error:', error);
      res.status(500).json({
        success: false,
        error: 'Benchmark failed',
        details: error.message
      });
    }
  });

  // ==================== FUNKCJE POMOCNICZE ====================

  // Pomocnicza funkcja do pobierania nazwy hosta
  async function getHostname(ip) {
    try {
      const { stdout } = await execAsync(`nslookup ${ip} 2>/dev/null | grep name | awk '{print $4}' || true`);
      const hostname = stdout.trim().replace(/\.$/, '');
      return hostname || ip;
    } catch {
      return ip;
    }
  }

  // Czyszczenie starych statusów (co godzinę)
  setInterval(() => {
    const now = Date.now();
    
    // Czyść stare statusy discover
    for (const [id, data] of scanStatus.entries()) {
      if (data.endTime) {
        const endTime = new Date(data.endTime).getTime();
        if (now - endTime > 3600000) { // starsze niż 1 godzina
          scanStatus.delete(id);
        }
      } else if (data.startTime) {
        const startTime = new Date(data.startTime).getTime();
        if (now - startTime > 7200000) { // wiszące dłużej niż 2 godziny
          scanStatus.delete(id);
        }
      }
    }
    
    // Czyść stare statusy network
    for (const [id, data] of networkScanStatus.entries()) {
      if (data.endTime) {
        const endTime = new Date(data.endTime).getTime();
        if (now - endTime > 3600000) {
          networkScanStatus.delete(id);
        }
      } else if (data.startTime) {
        const startTime = new Date(data.startTime).getTime();
        if (now - startTime > 7200000) {
          networkScanStatus.delete(id);
        }
      }
    }
  }, 3600000); // co godzinę
};
