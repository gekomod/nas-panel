const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NETWORK_CONFIG_DIR = '/etc/NetworkManager/system-connections/';

let lastSpeedTestTime = 0;

const checkNetworkTools = async (req, res, next) => {
  const requiredTools = ['ip', 'nmcli', 'ethtool', 'iperf3'];
  const missingTools = [];

  for (const tool of requiredTools) {
    try {
      await execAsync(`which ${tool}`);
    } catch {
      missingTools.push(tool);
    }
  }

  if (missingTools.length > 0) {
    return res.status(500).json({ 
      success: false, 
      error: 'System configuration error',
      details: `Missing tools: ${missingTools.join(', ')}`,
      solution: 'Install missing packages: sudo apt install iproute2 network-manager ethtool iperf3'
    });
  }
  next();
};

// Walidacja adresu IP
function validateIP(ip) {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}

// Walidacja maski sieci
function validateNetmask(mask) {
  const maskNum = parseInt(mask);
  return !isNaN(maskNum) && maskNum >= 0 && maskNum <= 32;
}

module.exports = function(app, requireAuth) {
  app.use(/^\/network(\/.*)?$/, checkNetworkTools);

  // Pobierz listę interfejsów
app.get('/network/interfaces', requireAuth, async (req, res) => {
  try {
    const { stdout: ipLinkOut } = await execAsync('ip -j link show');
    const interfaces = JSON.parse(ipLinkOut)
      .filter(iface => !['lo', 'docker', 'veth'].some(exclude => iface.ifname.startsWith(exclude)))
      .map(iface => ({
        device: iface.ifname,
        status: iface.operstate === 'UP' ? 'up' : 'down',
        mac: iface.address,
        mtu: iface.mtu,
        type: iface.ifname.startsWith('eth') ? 'ethernet' : 
             iface.ifname.startsWith('wlan') ? 'wireless' : 'other'
      }));

    // Uzupełnij o dodatkowe informacje + PRĘDKOŚĆ
    const results = await Promise.all(interfaces.map(async iface => {
      try {
        const { stdout: ipAddrOut } = await execAsync(`ip -j addr show dev ${iface.device}`);
        const ipData = JSON.parse(ipAddrOut)[0];
        
        // Pobierz adres IPv4
        let address = null, netmask = null, gateway = null, method = 'unknown';
        if (ipData.addr_info) {
          const ipv4 = ipData.addr_info.find(addr => addr.family === 'inet');
          if (ipv4) {
            address = ipv4.local;
            netmask = ipv4.prefixlen;
          }
        }

        // Pobierz metodę konfiguracji
        try {
          const { stdout: nmcliOut } = await execAsync(`nmcli -t -f IP4 dev show ${iface.device}`);
          method = nmcliOut.includes('IP4.DHCP[1]') ? 'dhcp' : 
                  nmcliOut.includes('IP4.ADDRESS[1]') ? 'static' : 'unknown';
        } catch (e) {
          //console.error(`Error getting config method for ${iface.device}:`, e);
        }

        // Pobierz WOL
        let wol = false;
        try {
          const { stdout: wolOut } = await execAsync(`ethtool ${iface.device} | grep Wake-on`);
          wol = wolOut.includes('g') || wolOut.includes('d');
        } catch (e) {
          //console.error(`Error checking WOL for ${iface.device}:`, e);
        }

        // Pobierz PRĘDKOŚĆ interfejsu
        let speed = 'unknown';
        let duplex = 'unknown';
        try {
          const { stdout: ethtoolOut } = await execAsync(`ethtool ${iface.device}`);
          const speedMatch = ethtoolOut.match(/Speed:\s*(\d+)\s*Mb\/s/);
          const duplexMatch = ethtoolOut.match(/Duplex:\s*(\w+)/);
          
          if (speedMatch) speed = `${speedMatch[1]} Mbps`;
          if (duplexMatch) duplex = duplexMatch[1].toLowerCase();
        } catch (e) {
          //console.error(`Error getting speed for ${iface.device}:`, e);
        }

        return { 
          ...iface, 
          address, 
          netmask, 
          gateway, 
          method, 
          wol,
          speed,
          duplex 
        };
      } catch (error) {
        //console.error(`Error getting details for ${iface.device}:`, error);
        return iface;
      }
    }));

    res.json(results);
  } catch (error) {
    //console.error('Network interfaces API error:', error);
    res.status(500).json({ error: 'Failed to get network interfaces' });
  }
});

  // Pobierz szczegóły interfejsu
  app.get('/network/interfaces/details/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;

      // Podstawowe informacje
      const { stdout: ipAddrOut } = await execAsync(`ip -j addr show dev ${iface}`);
      const ipData = JSON.parse(ipAddrOut)[0];
      
      // Ethtool
      const { stdout: ethtoolOut } = await execAsync(`ethtool ${iface}`);
      const { stdout: ethtoolStatsOut } = await execAsync(`ethtool -S ${iface}`);

      // Statystyki
      const { stdout: ipStatsOut } = await execAsync(`ip -s -j link show dev ${iface}`);
      const statsData = JSON.parse(ipStatsOut)[0];

      // Konfiguracja
      let config = {};
      try {
        const { stdout: nmcliOut } = await execAsync(`nmcli -t -f all dev show ${iface}`);
        nmcliOut.split('\n').forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) config[key] = value;
        });
      } catch (e) {
        // ERROR 
      }

      res.json({
        device: iface,
        status: ipData.operstate,
        mac: ipData.address,
        mtu: ipData.mtu,
        ipv4: ipData.addr_info?.find(addr => addr.family === 'inet') || null,
        stats: {
          rx_bytes: statsData.stats64?.rx?.bytes || statsData.rx_bytes,
          tx_bytes: statsData.stats64?.tx?.bytes || statsData.tx_bytes,
          rx_packets: statsData.stats64?.rx?.packets || statsData.rx_packets,
          tx_packets: statsData.stats64?.tx?.packets || statsData.tx_packets
        },
        ethtool: {
          driver: ethtoolOut.match(/driver:\s*(.+)/)?.[1],
          speed: ethtoolOut.match(/Speed:\s*(.+)/)?.[1],
          wol: ethtoolOut.match(/Wake-on:\s*(.+)/)?.[1]
        },
        config
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get interface details' });
    }
  });

  // Aktualizacja interfejsu
  app.post('/network/interfaces/details/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;
      const { method, address, netmask, gateway, mtu, wol } = req.body;

      // Walidacja danych wejściowych
      if (method === 'static') {
        if (!validateIP(address)) {
          return res.status(400).json({ error: 'Invalid IP address format' });
        }
        if (!validateNetmask(netmask)) {
          return res.status(400).json({ error: 'Invalid netmask (0-32)' });
        }
        if (gateway && !validateIP(gateway)) {
          return res.status(400).json({ error: 'Invalid gateway IP format' });
        }
      }

      // Aktualizacja przez nmcli
      try {
        // Najpierw usuń stare połączenie
        await execAsync(`nmcli connection delete "${iface}"`).catch(() => {});

        // Utwórz nową konfigurację
        if (method === 'dhcp') {
          await execAsync(`nmcli connection add type ethernet ifname ${iface} con-name "${iface}"`);
          await execAsync(`nmcli connection modify "${iface}" ipv4.method auto`);
        } else {
          await execAsync(`nmcli connection add type ethernet ifname ${iface} con-name "${iface}" ip4 ${address}/${netmask} gw4 ${gateway}`);
          await execAsync(`nmcli connection modify "${iface}" ipv4.method manual`);
        }

        // Ustaw MTU
        if (mtu) {
          await execAsync(`nmcli connection modify "${iface}" 802-3-ethernet.mtu ${mtu}`);
        }

        // Zastosuj zmiany
        await execAsync(`nmcli connection up "${iface}"`);

        res.json({ 
          success: true,
          message: `Configuration updated for ${iface}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        throw new Error('Failed to update network configuration');
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error.message,
        details: error.stderr || error.stdout || 'No additional details'
      });
    }
  });

  // Test prędkości z iperf3
const SPEEDTEST_TIMEOUT = 30000; // 30 seconds timeout
const IPERF_SERVERS = [
  // Najbardziej niezawodne serwery
  { host: 'iperf.he.net', port: 5201, label: 'Hurricane Electric (USA)' },
  { host: 'speedtest.serverius.net', port: 5002, label: 'Serverius (Netherlands)' },
  { host: 'iperf.biznetnetworks.com', port: 5201, label: 'BizNet (Indonesia)' },
  
  // Sprawdzone serwery europejskie
  { host: 'iperf.worldstream.nl', port: 5201, label: 'WorldStream (Netherlands)' },
  { host: 'iperf3.velocityonline.net', port: 5201, label: 'Velocity Online (USA)' },
  { host: 'iperf3.weininger.at', port: 5201, label: 'Weininger (Austria)' },
  
  // Serwery z dobrą dostępnością
  { host: 'iperf.fly.io', port: 5201, label: 'Fly.io (Global CDN)' },
  { host: 'iperf.scottlinux.com', port: 5201, label: 'ScottLinux (USA)' },
  { host: 'iperf.scaleway.com', port: 5201, label: 'Scaleway (France)' },
  
  // Backup serwery
  { host: 'iperf3.blazingfast.io', port: 5201, label: 'BlazingFast (Slovenia)' },
  { host: 'speedtest.wtnet.de', port: 5201, label: 'WTnet (Germany)' },
  { host: 'iperf3.lynxbroker.com', port: 5201, label: 'LynxBroker (Finland)' },
  
  // Publiczne serwery iperf3
  { host: 'iperf3.nsw.bigpond.net.au', port: 5201, label: 'Telstra (Australia)' },
  { host: 'iperf.paris.fr', port: 5201, label: 'Paris (France)' },
  { host: 'iperf3.moscow.vps.com', port: 5201, label: 'Moscow (Russia)' }
];

// Poprawiona funkcja testowania dostępności serwera
async function testServerAvailability(host, port, timeout = 3000) {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    // Użyj curl do testowania HTTP lub nc dla czystego TCP
    const testCmd = `timeout 2 bash -c "echo '' | nc -w 1 -z ${host} ${port} 2>/dev/null && echo 'OK' || echo 'FAIL'"`;
    
    const { stdout } = await execAsync(testCmd, { timeout });
    return stdout.includes('OK');
  } catch (error) {
    return false;
  }
}


// Poprawiona funkcja uruchamiania testu iperf3
async function runIperfTest(host, port, reverse = false) {
  const command = `iperf3 -c ${host} -p ${port} ${reverse ? '-R' : ''} -J --connect-timeout 3000 --timeout 8000`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { 
      timeout: SPEEDTEST_TIMEOUT,
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    // Sprawdź czy stdout zawiera poprawny JSON
    if (!stdout.trim().startsWith('{')) {
      throw new Error('Invalid response from server');
    }
    
    const result = JSON.parse(stdout);
    
    // Sprawdź czy test zakończył się sukcesem
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Walidacja struktury wyniku
    if (!result.end || (!result.end.sum_received && !result.end.sum_sent)) {
      throw new Error('Incomplete test results');
    }
    
    return result;
    
  } catch (error) {
    //console.log(`Server ${host}:${port} failed: ${error.message}`);
    throw error;
  }
}

// Poprawiony endpoint testu prędkości
app.post('/network/interfaces/details/:interface/speedtest', requireAuth, async (req, res) => {
  try {
    const { interface: iface } = req.params;
    let testResults = null;
    let workingServers = [];
    let failedServers = [];

    // Najpierw przetestuj dostępność serwerów
    for (const server of IPERF_SERVERS) {
      try {
        const isAvailable = await testServerAvailability(server.host, server.port);
        if (isAvailable) {
          workingServers.push(server);
          //console.log(`✓ ${server.host}:${server.port} is available`);
        } else {
          failedServers.push(`${server.host}:${server.port}`);
          //console.log(`✗ ${server.host}:${server.port} is not available`);
        }
      } catch (error) {
        failedServers.push(`${server.host}:${server.port} (error: ${error.message})`);
      }
    }

    // Jeśli nie ma dostępnych serwerów
    if (workingServers.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No speed test servers available',
        details: 'All test servers are currently unreachable',
        failedServers: failedServers,
        solution: 'Please check your internet connection and firewall settings'
      });
    }

    //console.log(`Found ${workingServers.length} available servers, starting tests...`);

    // Przetestuj dostępne serwery w kolejności
    for (const server of workingServers) {
      try {
        //console.log(`Testing download with ${server.host}...`);
        const downloadData = await runIperfTest(server.host, server.port, true);
        
        //console.log(`Testing upload with ${server.host}...`);
        const uploadData = await runIperfTest(server.host, server.port);
        
        testResults = {
          download: (downloadData.end.sum_received.bits_per_second / 1e6).toFixed(2),
          upload: (uploadData.end.sum_sent.bits_per_second / 1e6).toFixed(2),
          ping: downloadData.start.tcp_mss_default || uploadData.start.tcp_mss_default || 0,
          jitter: downloadData.end.sum_received.jitter_ms || uploadData.end.sum_sent.jitter_ms || 0,
          interface: iface,
          timestamp: new Date().toISOString(),
          server: server.label,
          serverHost: server.host,
          serverPort: server.port
        };

        //console.log(`Success with ${server.host}: ${testResults.download}↓ ${testResults.upload}↑ Mbps`);
        break; // Zatrzymaj po pierwszym udanym teście
        
      } catch (error) {
        //console.log(`Test failed on ${server.host}: ${error.message}`);
        failedServers.push(`${server.host}:${server.port} - ${error.message}`);
        continue;
      }
    }

    if (!testResults) {
      return res.status(500).json({
        success: false,
        error: 'All speed tests failed',
        details: 'Tests completed but no valid results were obtained',
        failedServers: failedServers,
        workingServers: workingServers.map(s => `${s.host}:${s.port}`)
      });
    }

    res.json({
      success: true,
      data: testResults,
      metadata: {
        testedServers: workingServers.length,
        failedServers: failedServers.length
      }
    });

  } catch (error) {
    //console.error('Speed test completely failed:', error);
    res.status(500).json({
      success: false,
      error: 'Speed test failed',
      details: error.message,
      solution: 'Please check your internet connection and try again later'
    });
  }
});

// Endpoint do testowania dostępności serwerów
app.get('/network/speedtest/servers', requireAuth, async (req, res) => {
  try {
    const serverStatus = [];
    
    for (const server of IPERF_SERVERS) {
      try {
        const isAvailable = await testServerAvailability(server.host, server.port);
        serverStatus.push({
          host: server.host,
          port: server.port,
          label: server.label,
          available: isAvailable,
          lastChecked: new Date().toISOString()
        });
        
        // Małe opóźnienie między testami
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        serverStatus.push({
          host: server.host,
          port: server.port,
          label: server.label,
          available: false,
          error: error.message,
          lastChecked: new Date().toISOString()
        });
      }
    }
    
    res.json({
      success: true,
      data: serverStatus,
      total: serverStatus.length,
      available: serverStatus.filter(s => s.available).length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to test servers'
    });
  }
});

app.post('/network/interfaces/add', requireAuth, async (req, res) => {
  try {
    const { name, type } = req.body;

    // Walidacja nazwy interfejsu
    if (!/^[a-z][a-z0-9]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interface name',
        details: 'Interface name must start with letter and contain only lowercase letters and numbers'
      });
    }

    // Komenda do dodania interfejsu (przykład dla Ethernet)
    let command;
    switch (type) {
      case 'ethernet':
        command = `sudo ip link add name ${name} type dummy`;
        break;
      case 'bridge':
        command = `sudo ip link add name ${name} type bridge`;
        break;
      case 'vlan':
        command = `sudo ip link add link eth0 name ${name} type vlan id 100`; // Przykładowe ID VLAN
        break;
      case 'bond':
        command = `sudo ip link add name ${name} type bond mode balance-rr`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid interface type' });
    }

    await execAsync(command);

    // Aktywuj interfejs
    await execAsync(`sudo ip link set ${name} up`);

    res.json({
      success: true,
      message: `Interface ${name} added successfully`,
      interface: {
        name,
        type,
        status: 'down'
      }
    });
  } catch (error) {
    console.error('Error adding interface:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add interface',
      details: error.message,
      solution: 'Check if you have proper permissions (sudo)'
    });
  }
});

app.delete('/network/interfaces/remove/:interface', requireAuth, async (req, res) => {
  try {
    const { interface: iface } = req.params;

    // Zabezpieczenie przed usunięciem ważnych interfejsów
    const protectedInterfaces = ['lo', 'eth0'];
    if (protectedInterfaces.includes(iface)) {
      return res.status(400).json({
        success: false,
        error: 'Protected interface',
        message: `Cannot delete protected interface ${iface}`
      });
    }

    // Sprawdź czy interfejs istnieje
    try {
      await execAsync(`ip link show ${iface}`);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Interface not found',
        message: `Interface ${iface} does not exist`
      });
    }

    // Dezaktywuj interfejs przed usunięciem
    await execAsync(`sudo ip link set ${iface} down`);

    // Usuń interfejs
    await execAsync(`sudo ip link delete ${iface}`);

    res.json({
      success: true,
      message: `Interface ${iface} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete interface',
      details: error.message,
      solution: 'Check if interface is not in use and you have proper permissions'
    });
  }
});


// FIREWALL API

// Status zapory
app.get('/network/firewall/status', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('LANG=C sudo ufw status | grep "Status"')
    const enabled = !stdout.includes('inactive') && stdout.includes('active');

    res.json({
      enabled: Boolean(enabled),
      status: enabled ? 'active' : 'inactive',
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to get firewall status',
      details: error.message
    });
  }
})

// Przełączanie zapory
app.post('/network/firewall/status/:action', requireAuth, async (req, res) => {
  try {
    const { action } = req.params
    await execAsync(`LANG=C sudo ufw ${action}`)
    
    res.json({ success: true, message: `Firewall ${action}d` })
  } catch (error) {
    res.status(500).json({ error: `Failed to ${action} firewall` })
  }
})

// Lista reguł
app.get('/network/firewall/rules', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('LANG=C sudo ufw status numbered | tail -n +3');
    
    const rules = stdout.split('\n')
      .filter(line => line.trim().startsWith('[')) // Tylko linie z regułami
      .map(line => {
        // Przykładowa linia: [ 1] Anywhere                   ALLOW IN    80                         # test
        const match = line.match(/\[(\s*\d+\s*)\]\s+([^\s]+)(?:\s+\(v6\))?\s+(\w+)\s+(\w+)\s+([^\s#]+)(?:\s+#\s+(.*))?/);
        
        if (!match) {
          return null;
        }

        return {
          id: match[1].trim(),
          target: match[2], // Anywhere
          action: match[3].toLowerCase(), // ALLOW → allow
          direction: match[4], // IN/OUT
          port: match[5].trim(), // 80
          comment: match[6] || '' // test
        };
      })
      .filter(rule => rule !== null);

    res.json({
      success: true,
      data: rules
    });

  } catch (error) {
    console.error('Error getting firewall rules:', {
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get firewall rules',
      details: error.message,
      rawOutput: error.stdout
    });
  }
});

app.post('/network/firewall/rules', requireAuth, async (req, res) => {
  try {
    const { name, protocol, port, source, action } = req.body;

    // Walidacja
    if (!name || !protocol || !action) {
      return res.status(400).json({
        success: false,
        error: 'Brak wymaganych pól',
        required: ['name', 'protocol', 'action']
      });
    }

    // Budowanie poprawnej komendy ufw
    let command = `LANG=C sudo ufw ${action}`;
    
    command += ` from ${source || 'any'}`;
    
    // Dodaj protokół (jeśli nie jest 'all')
    if (protocol !== 'all') {
      command += ` proto ${protocol}`;
    }
    
    // Dodaj port (jeśli określony)
    if (port) {
      command += ` port ${port}`;
    }
        
    // Dodaj komentarz
    command += ` comment "${name}"`;

    // Wykonaj komendę
    const { stdout } = await execAsync(command);

    res.json({
      success: true,
      message: 'Reguła dodana pomyślnie',
      rule: {
        id: Date.now().toString(),
        name,
        protocol,
        port: port || 'any',
        source: source || 'any',
        action,
        command
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Nie udało się dodać reguły',
      details: error.stderr || error.message,
      solution: 'Sprawdź składnię reguły'
    });
  }
});

app.delete('/network/firewall/rules/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    await execAsync(`LANG=C sudo ufw delete ${id} <<EOF
y
EOF`)
    res.json({ success: true, message: `Rule ${id} deleted` })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule',
      details: error.message
    })
  }
})

// Statystyki
app.get('/network/firewall/stats', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('LANG=C sudo ufw status verbose')
    res.json({
      version: stdout.match(/version\s(.+)/)?.[1],
      lastActivity: stdout.match(/last\sactivity:\s(.+)/)?.[1]
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get firewall stats' })
  }
})


};
