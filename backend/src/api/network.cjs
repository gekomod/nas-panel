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

// Sprawdzanie czy Docker jest zainstalowany
const checkDocker = async () => {
  try {
    await execAsync('which docker');
    return { installed: true, error: null };
  } catch (error) {
    return { installed: false, error: 'Docker nie jest zainstalowany' };
  }
};

// Sprawdzanie statusu Dockera
const checkDockerStatus = async () => {
  try {
    const { stdout } = await execAsync('sudo systemctl is-active docker');
    return { status: stdout.trim(), running: stdout.trim() === 'active' };
  } catch (error) {
    return { status: 'inactive', running: false, error: error.message };
  }
};

// Sprawdzanie czy ufw-docker jest zainstalowany
const checkUfwDocker = async () => {
  try {
    await execAsync('which ufw-docker');
    return { installed: true, error: null };
  } catch (error) {
    return { installed: false, error: 'ufw-docker nie jest zainstalowany' };
  }
};

// Instalacja ufw-docker
const installUfwDocker = async () => {
  try {
    // Pobierz ufw-docker
    await execAsync('sudo wget -O /usr/local/bin/ufw-docker https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker');
    
    // Nadaj uprawnienia wykonania
    await execAsync('sudo chmod +x /usr/local/bin/ufw-docker');
    
    // Zainstaluj
    await execAsync('sudo ufw-docker install');
    
    return { success: true, message: 'ufw-docker zainstalowany pomyślnie' };
  } catch (error) {
    return { 
      success: false, 
      error: 'Błąd instalacji ufw-docker', 
      details: error.message 
    };
  }
};

// Pobierz uruchomione kontenery Docker
const getDockerContainers = async () => {
  try {
    const { stdout } = await execAsync('sudo docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}"');
    
    const containers = stdout.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [name, image, ports] = line.split('|');
        return {
          name,
          image,
          ports: ports.split(',').map(p => p.trim()).filter(p => p),
          exposedPorts: extractPorts(ports)
        };
      });
    
    return { success: true, containers };
  } catch (error) {
    return { success: false, error: error.message, containers: [] };
  }
};

// Funkcja pomocnicza do ekstrakcji portów
const extractPorts = (portsString) => {
  const ports = [];
  const portRegex = /(\d+)\/tcp/g;
  let match;
  
  while ((match = portRegex.exec(portsString)) !== null) {
    ports.push(parseInt(match[1]));
  }
  
  return ports;
};

// Dodaj regułę UFW dla kontenera Docker
const addUfwDockerRule = async (containerName, port, protocol = 'tcp') => {
  try {
    const { stdout } = await execAsync(`sudo ufw-docker allow ${containerName} ${port}/${protocol}`);
    
    return { 
      success: true, 
      message: `Reguła dodana dla kontenera ${containerName} na porcie ${port}/${protocol}`,
      output: stdout 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Błąd dodawania reguły dla ${containerName}`,
      details: error.message 
    };
  }
};

// Pobierz istniejące reguły UFW dla Docker
const getUfwDockerRules = async () => {
  try {
    // Pobierz wszystkie reguły UFW i filtruj te związane z Dockerem
    const { stdout } = await execAsync('sudo ufw status numbered');
    
    const rules = stdout.trim().split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        // Szukaj reguł związanych z Dockerem
        if (line.toLowerCase().includes('docker') || 
            line.includes('ufw-docker') ||
            line.match(/172\.17\.|172\.18\.|172\.19\.|172\.2[0-9]\.|172\.3[0-1]\./)) {
          
          const match = line.match(/\[(\s*\d+\s*)\]\s+(.*?)\s+(ALLOW|DENY|ALLOW IN|DENY IN)\s+(.*?)(?:\s+#\s+(.*))?/i);
          
          if (match) {
            return {
              id: match[1].trim(),
              target: match[2].trim(),
              action: match[3].toLowerCase().replace(' in', ''),
              direction: 'in', // UFW docker rules are usually inbound
              port: extractPortFromTarget(match[2]),
              protocol: extractProtocolFromTarget(match[2]),
              comment: match[5] || 'docker rule',
              source: 'ufw',
              raw: line.trim()
            };
          }
          
          // Alternatywne parsowanie dla innych formatów
          return {
            id: index.toString(),
            target: line.trim(),
            action: 'allow',
            direction: 'in',
            port: 'unknown',
            protocol: 'tcp',
            comment: 'docker-related rule',
            source: 'ufw',
            raw: line.trim()
          };
        }
        return null;
      })
      .filter(rule => rule !== null);

    return { success: true, rules };
  } catch (error) {
    console.error('Error getting UFW Docker rules:', error);
    return { success: false, error: error.message, rules: [] };
  }
};

const extractPortFromTarget = (target) => {
  const portMatch = target.match(/(\d+)(?:\/|$)/);
  return portMatch ? portMatch[1] : 'any';
};

// Funkcja pomocnicza do ekstrakcji protokołu
const extractProtocolFromTarget = (target) => {
  const protocolMatch = target.match(/\/(tcp|udp)$/);
  return protocolMatch ? protocolMatch[1] : 'tcp';
};

module.exports = function(app, requireAuth) {
  app.use(/^\/network(\/.*)?$/, checkNetworkTools);

  app.get('/network/docker/debug-rules', requireAuth, async (req, res) => {
    try {
      const commands = [
        'sudo ufw status numbered',
        'sudo ufw-docker list || echo "ufw-docker not available"',
        'sudo iptables -L -n | grep -i docker || true',
        'sudo iptables -t nat -L -n | grep -i docker || true'
      ];

      const results = {};
      
      for (const cmd of commands) {
        try {
          const { stdout } = await execAsync(cmd);
          results[cmd] = stdout;
        } catch (error) {
          results[cmd] = `ERROR: ${error.message}`;
        }
      }

      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: 'Debug failed',
        details: error.message
      });
    }
  });

  // Pobierz listę interfejsów Z POPRAWKĄ DLA PRĘDKOŚCI
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
            console.error(`Error getting config method for ${iface.device}:`, e.message);
          }

          // Pobierz WOL
          let wol = false;
          try {
            const { stdout: wolOut } = await execAsync(`sudo ethtool ${iface.device} | grep Wake-on`);
            wol = wolOut.includes('g') || wolOut.includes('d');
          } catch (e) {
            console.error(`Error checking WOL for ${iface.device}:`, e.message);
          }

          // Pobierz PRĘDKOŚĆ i duplex interfejsu - DODANO 'sudo'
          let speed = 'unknown';
          let duplex = 'unknown';
          try {
            const { stdout: ethtoolOut } = await execAsync(`sudo ethtool ${iface.device}`);
            const speedMatch = ethtoolOut.match(/Speed:\s*(\d+)\s*Mb\/s/);
            const duplexMatch = ethtoolOut.match(/Duplex:\s*(\w+)/);
            
            if (speedMatch) speed = `${speedMatch[1]} Mbps`;
            if (duplexMatch) duplex = duplexMatch[1].toLowerCase();
          } catch (e) {
            console.error(`Error getting speed for ${iface.device}:`, e.message);
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
          console.error(`Error getting details for ${iface.device}:`, error.message);
          return iface;
        }
      }));

      res.json(results);
    } catch (error) {
      console.error('Network interfaces API error:', error);
      res.status(500).json({ 
        error: 'Failed to get network interfaces',
        details: error.message 
      });
    }
  });

  // Pobierz szczegóły interfejsu - POPRAWIONY
  app.get('/network/interfaces/details/:interface', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;

      // Podstawowe informacje
      const { stdout: ipAddrOut } = await execAsync(`ip -j addr show dev ${iface}`);
      const ipData = JSON.parse(ipAddrOut)[0];
      
      // Ethtool - DODANO 'sudo'
      const { stdout: ethtoolOut } = await execAsync(`sudo ethtool ${iface}`);
      
      // Pobierz statystyki ethtool
      let ethtoolStats = null;
      try {
        const { stdout: ethtoolStatsOut } = await execAsync(`sudo ethtool -S ${iface}`);
        ethtoolStats = ethtoolStatsOut;
      } catch (e) {
        console.error(`Error getting ethtool stats for ${iface}:`, e.message);
      }

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
        console.error(`Error getting nmcli config for ${iface}:`, e.message);
      }

      // Ekstrakcja prędkości i duplex z ethtool
      const speedMatch = ethtoolOut.match(/Speed:\s*(.+)/);
      const duplexMatch = ethtoolOut.match(/Duplex:\s*(.+)/);
      const wolMatch = ethtoolOut.match(/Wake-on:\s*(.+)/);
      const driverMatch = ethtoolOut.match(/driver:\s*(.+)/);

      res.json({
        device: iface,
        status: ipData.operstate,
        mac: ipData.address,
        mtu: ipData.mtu || 1500,
        ipv4: ipData.addr_info?.find(addr => addr.family === 'inet') || null,
        stats: {
          rx_bytes: statsData.stats64?.rx?.bytes || statsData.rx_bytes || 0,
          tx_bytes: statsData.stats64?.tx?.bytes || statsData.tx_bytes || 0,
          rx_packets: statsData.stats64?.rx?.packets || statsData.rx_packets || 0,
          tx_packets: statsData.stats64?.tx?.packets || statsData.tx_packets || 0
        },
        ethtool: {
          driver: driverMatch?.[1]?.trim(),
          speed: speedMatch?.[1]?.trim() || 'unknown',
          duplex: duplexMatch?.[1]?.trim()?.toLowerCase() || 'unknown',
          wol: wolMatch?.[1]?.trim()
        },
        config
      });
    } catch (error) {
      console.error('Interface details API error:', error);
      res.status(500).json({ 
        error: 'Failed to get interface details',
        details: error.message 
      });
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
    // Publiczne serwery z dobrą dostępnością
    { host: 'iperf.scottlinux.com', port: 5201, label: 'ScottLinux (USA)' },
    { host: 'iperf.he.net', port: 5201, label: 'Hurricane Electric (USA)' },
    { host: 'iperf.velocityonline.net', port: 5201, label: 'Velocity Online (USA)' },
    { host: 'iperf.biznetnetworks.com', port: 5201, label: 'BizNet (Indonesia)' },
    { host: 'iperf.worldstream.nl', port: 5201, label: 'WorldStream (Netherlands)' },
    
    // Backup serwery
    { host: 'iperf.paris.fr', port: 5201, label: 'Paris (France)' },
    { host: 'speedtest.wtnet.de', port: 5201, label: 'WTnet (Germany)' },
    { host: 'iperf3.lynxbroker.com', port: 5201, label: 'LynxBroker (Finland)' },
    
    // Dodatkowe serwery
    { host: 'iperf3.online.net', port: 5201, label: 'Online.net (France)' },
    { host: 'iperf.astra.in.ua', port: 5201, label: 'Astra (Ukraine)' },
    { host: 'iperf3.swit.la', port: 5201, label: 'Swit.la (Poland)' }
  ];

  // Ulepszona funkcja testowania dostępności
  async function testServerAvailability(host, port, timeout = 2000) {
    try {
      const testCmd = `timeout 2 bash -c "</dev/tcp/${host}/${port}" && echo "OK"`;
      const { stdout } = await execAsync(testCmd, { timeout: 3000 });
      return stdout.includes('OK');
    } catch (error) {
      return false;
    }
  }

  // Poprawiona funkcja uruchamiania testu
  async function runIperfTest(host, port, reverse = false) {
    const command = `iperf3 -c ${host} -p ${port} ${reverse ? '-R' : ''} -J --connect-timeout 5000 --timeout 10000`;
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 15000,
        maxBuffer: 1024 * 1024
      });
      
      if (!stdout.trim().startsWith('{')) {
        console.error(`Invalid JSON response from ${host}:${port}`);
        throw new Error('Invalid server response');
      }
      
      const result = JSON.parse(stdout);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.log(`Server ${host}:${port} test failed: ${error.message}`);
      throw error;
    }
  }

  // Poprawiony endpoint testu prędkości
  app.post('/network/interfaces/details/:interface/speedtest', requireAuth, async (req, res) => {
    try {
      const { interface: iface } = req.params;
      const { serverId } = req.body;
      
      // Sprawdź czy speedtest-cli jest zainstalowany
      const status = await checkSpeedtestCli();
      if (!status.installed) {
        return res.status(400).json({
          success: false,
          error: 'speedtest-cli not installed',
          solution: 'Please install speedtest-cli first: sudo apt install speedtest-cli'
        });
      }
      
      // Uruchom test
      const result = await runSpeedtest(serverId);
      
      if (result.success) {
        // Dodaj informację o interfejsie
        result.data.interface = iface;
        res.json(result);
      } else {
        res.status(500).json(result);
      }
      
    } catch (error) {
      console.error('Speedtest endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Speed test failed',
        details: error.message,
        solution: 'Please check your internet connection and try again'
      });
    }
  });
  
  app.post('/network/speedtest/quick', requireAuth, async (req, res) => {
    try {
      const result = await runSpeedtest();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Quick speed test failed',
        details: error.message
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
      // Pobierz reguły UFW
      const ufwRules = [];
      try {
        const { stdout: ufwStdout } = await execAsync('LANG=C sudo ufw status numbered | tail -n +3');
        
        ufwStdout.split('\n')
          .filter(line => line.trim().startsWith('['))
          .forEach(line => {
            const match = line.match(/\[(\s*\d+\s*)\]\s+([^\s]+)(?:\s+\(v6\))?\s+(\w+)\s+(\w+)\s+([^\s#]+)(?:\s+#\s+(.*))?/);
            
            if (match) {
              ufwRules.push({
                id: match[1].trim(),
                target: match[2],
                action: match[3].toLowerCase(),
                direction: match[4],
                port: match[5].trim(),
                comment: match[6] || '',
                source: 'ufw'
              });
            }
          });
      } catch (ufwError) {
        console.warn('UFW rules not available:', ufwError.message);
      }

      // Pobierz reguły iptables
      const iptablesRules = [];
      try {
        // INPUT chain
        const { stdout: inputStdout } = await execAsync('sudo iptables -L INPUT -n --line-numbers -v');
        parseIptablesChain(inputStdout, 'INPUT', iptablesRules);
        
        // OUTPUT chain
        const { stdout: outputStdout } = await execAsync('sudo iptables -L OUTPUT -n --line-numbers -v');
        parseIptablesChain(outputStdout, 'OUTPUT', iptablesRules);
        
        // FORWARD chain
        const { stdout: forwardStdout } = await execAsync('sudo iptables -L FORWARD -n --line-numbers -v');
        parseIptablesChain(forwardStdout, 'FORWARD', iptablesRules);

      } catch (iptablesError) {
        console.warn('iptables rules not available:', iptablesError.message);
      }

      res.json({
        success: true,
        data: {
          ufw: ufwRules,
          iptables: iptablesRules,
          all: [...ufwRules, ...iptablesRules]
        },
        counts: {
          ufw: ufwRules.length,
          iptables: iptablesRules.length,
          total: ufwRules.length + iptablesRules.length
        }
      });

    } catch (error) {
      console.error('Error getting firewall rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get firewall rules',
        details: error.message
      });
    }
  });

  // Funkcja pomocnicza do parsowania łańcuchów iptables
  function parseIptablesChain(output, chainName, rulesArray) {
    const lines = output.split('\n');
    let currentRule = null;

    for (const line of lines) {
      // Pomijaj puste linie i nagłówki
      if (!line.trim() || line.startsWith('Chain') || line.startsWith('target')) {
        continue;
      }

      // Główna linia z regułą
      const ruleMatch = line.match(/^\s*(\d+)\s+(\w+)\s+(\w+)\s+(\w+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.*))?/);
      
      if (ruleMatch) {
        currentRule = {
          id: `${chainName}-${ruleMatch[1]}`,
          num: ruleMatch[1],
          chain: chainName,
          target: ruleMatch[2],
          protocol: ruleMatch[3],
          opt: ruleMatch[4],
          in: ruleMatch[5],
          out: ruleMatch[6],
          source: ruleMatch[7],
          destination: ruleMatch[8],
          options: ruleMatch[9] || '',
          source_type: 'iptables',
          packets: '0',
          bytes: '0'
        };
        rulesArray.push(currentRule);
      } 
      // Linia z pakietami i bajtami
      else if (currentRule && line.includes('pkts') && line.includes('bytes')) {
        const statsMatch = line.match(/(\d+[KM]?)\s+(\d+[KM]?)/);
        if (statsMatch) {
          currentRule.packets = statsMatch[1];
          currentRule.bytes = statsMatch[2];
        }
      }
      // Dodatkowe opcje
      else if (currentRule && line.trim()) {
        currentRule.options += ' ' + line.trim();
      }
    }
  }

  // Dodatkowy endpoint tylko dla iptables
  app.get('/network/iptables/rules', requireAuth, async (req, res) => {
    try {
      const chains = ['INPUT', 'OUTPUT', 'FORWARD'];
      const allRules = [];

      for (const chain of chains) {
        try {
          const { stdout } = await execAsync(`sudo iptables -L ${chain} -n --line-numbers -v`);
          parseIptablesChain(stdout, chain, allRules);
        } catch (chainError) {
          console.warn(`Failed to get ${chain} chain:`, chainError.message);
        }
      }

      res.json({
        success: true,
        data: allRules,
        counts: {
          input: allRules.filter(r => r.chain === 'INPUT').length,
          output: allRules.filter(r => r.chain === 'OUTPUT').length,
          forward: allRules.filter(r => r.chain === 'FORWARD').length,
          total: allRules.length
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get iptables rules',
        details: error.message
      });
    }
  });

  // Endpoint do dodawania reguł iptables
  app.post('/network/iptables/rules', requireAuth, async (req, res) => {
    try {
      const { chain, target, protocol, source, destination, dport, sport, comment } = req.body;

      let command = 'sudo iptables';
      
      // Określ łańcuch
      if (chain) command += ` -A ${chain.toUpperCase()}`;
      
      // Protokół
      if (protocol && protocol !== 'all') command += ` -p ${protocol}`;
      
      // Źródło
      if (source) command += ` -s ${source}`;
      
      // Cel
      if (destination) command += ` -d ${destination}`;
      
      // Port docelowy
      if (dport) command += ` --dport ${dport}`;
      
      // Port źródłowy
      if (sport) command += ` --sport ${sport}`;
      
      // Akcja
      command += ` -j ${target || 'ACCEPT'}`;
      
      // Komentarz (jako dodatkowe opcje)
      if (comment) command += ` -m comment --comment "${comment}"`;

      await execAsync(command);

      res.json({
        success: true,
        message: 'iptables rule added successfully',
        command: command
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to add iptables rule',
        details: error.message
      });
    }
  });

  // Endpoint do usuwania reguł iptables
  app.delete('/network/iptables/rules/:chain/:number', requireAuth, async (req, res) => {
    try {
      const { chain, number } = req.params;
      
      await execAsync(`sudo iptables -D ${chain} ${number}`);

      res.json({
        success: true,
        message: `Rule ${number} deleted from ${chain} chain`
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete iptables rule',
        details: error.message
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

  // Docker status
  app.get('/network/docker/status', requireAuth, async (req, res) => {
    try {
      const [dockerCheck, dockerStatus, ufwDockerCheck] = await Promise.all([
        checkDocker(),
        checkDockerStatus(),
        checkUfwDocker()
      ]);

      res.json({
        docker: {
          installed: dockerCheck.installed,
          status: dockerStatus.status,
          running: dockerStatus.running
        },
        ufwDocker: {
          installed: ufwDockerCheck.installed
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get Docker status' });
    }
  });

  // Instalacja ufw-docker
  app.post('/network/docker/install-ufw-docker', requireAuth, async (req, res) => {
    try {
      const result = await installUfwDocker();
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to install ufw-docker' });
    }
  });

  // Lista kontenerów Docker
  app.get('/network/docker/containers', requireAuth, async (req, res) => {
    try {
      const result = await getDockerContainers();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get Docker containers' });
    }
  });

  // Dodaj regułę UFW dla kontenera
  app.post('/network/docker/ufw-rule', requireAuth, async (req, res) => {
    try {
      const { containerName, port, protocol } = req.body;
      
      if (!containerName || !port) {
        return res.status(400).json({ error: 'Container name and port are required' });
      }

      const result = await addUfwDockerRule(containerName, port, protocol);
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to add UFW rule for container' });
    }
  });

  // Lista reguł UFW dla Docker
  app.get('/network/docker/ufw-rules', requireAuth, async (req, res) => {
    try {
      const result = await getUfwDockerRules();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get UFW Docker rules' });
    }
  });
  
  const checkSpeedtestCli = async () => {
  try {
    await execAsync('which speedtest-cli || which speedtest');
    return { installed: true, error: null };
  } catch (error) {
    return { installed: false, error: 'speedtest-cli nie jest zainstalowany' };
  }
};

// Zainstaluj speedtest-cli
const installSpeedtestCli = async () => {
  try {
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y speedtest-cli');
    return { success: true, message: 'speedtest-cli zainstalowany pomyślnie' };
  } catch (error) {
    return { 
      success: false, 
      error: 'Błąd instalacji speedtest-cli', 
      details: error.message 
    };
  }
};

const getSpeedtestServers = async () => {
  try {
    const { stdout } = await execAsync('speedtest-cli --list | head -20');
    
    const servers = stdout.split('\n')
      .filter(line => line.trim() && line.includes(')'))
      .map(line => {
        const match = line.match(/(\d+)\)\s+(.+?)\s+\((.+?)\)\s+\[(.+?)\]/);
        if (match) {
          return {
            id: parseInt(match[1]),
            name: match[2].trim(),
            location: match[3].trim(),
            country: match[4].trim(),
            distance: 0
          };
        }
        return null;
      })
      .filter(server => server !== null);
    
    return { success: true, servers };
  } catch (error) {
    return { success: false, error: error.message, servers: [] };
  }
};

const runSpeedtest = async (serverId = null) => {
  try {
    let command = 'speedtest-cli --json --secure';
    
    if (serverId) {
      command += ` --server ${serverId}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 60000, // 60 sekund timeout
      maxBuffer: 1024 * 1024 * 5 // 5MB buffer
    });
    
    if (!stdout.trim().startsWith('{')) {
      throw new Error('Invalid JSON response from speedtest-cli');
    }
    
    const result = JSON.parse(stdout);
    
    // Formatuj wynik
    return {
      success: true,
      data: {
        download: (result.download / 1000000).toFixed(2), // Mbps
        upload: (result.upload / 1000000).toFixed(2), // Mbps
        ping: result.ping.toFixed(2),
        jitter: result.server?.jitter || 0,
        server: result.server?.name || 'Unknown',
        serverHost: result.server?.host || 'Unknown',
        sponsor: result.server?.sponsor || 'Unknown',
        location: `${result.server?.name || ''} (${result.server?.country || ''})`,
        timestamp: result.timestamp || new Date().toISOString(),
        client: result.client ? {
          ip: result.client.ip,
          isp: result.client.isp,
          country: result.client.country
        } : null,
        interface: result.interface ? {
          name: result.interface.internalIp,
          externalIp: result.interface.externalIp
        } : null
      },
      raw: result
    };
    
  } catch (error) {
    console.error('Speedtest error:', error);
    
    // Fallback: spróbuj prostszego formatu wyjścia
    try {
      console.log('Trying simple speedtest format...');
      const simpleCommand = serverId 
        ? `speedtest-cli --server ${serverId} --simple`
        : 'speedtest-cli --simple';
      
      const { stdout } = await execAsync(simpleCommand, { timeout: 30000 });
      
      // Parsuj prosty format
      const lines = stdout.split('\n');
      const pingMatch = lines[0]?.match(/Ping:\s+([\d.]+)\s+ms/);
      const downloadMatch = lines[1]?.match(/Download:\s+([\d.]+)\s+Mbit\/s/);
      const uploadMatch = lines[2]?.match(/Upload:\s+([\d.]+)\s+Mbit\/s/);
      
      if (downloadMatch && uploadMatch) {
        return {
          success: true,
          data: {
            download: downloadMatch[1],
            upload: uploadMatch[1],
            ping: pingMatch ? pingMatch[1] : '0',
            jitter: 0,
            server: 'Speedtest Server',
            serverHost: 'speedtest.net',
            sponsor: 'Ookla',
            location: 'Unknown',
            timestamp: new Date().toISOString()
          }
        };
      }
    } catch (simpleError) {
      console.error('Simple speedtest also failed:', simpleError);
    }
    
    return {
      success: false,
      error: 'Speed test failed',
      details: error.message,
      solution: 'Please check your internet connection and try again'
    };
  }
};

  app.get('/network/speedtest/status', requireAuth, async (req, res) => {
    try {
      const status = await checkSpeedtestCli();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check speedtest-cli status' });
    }
  });

  app.post('/network/speedtest/install', requireAuth, async (req, res) => {
    try {
      const result = await installSpeedtestCli();
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to install speedtest-cli' });
    }
  });

  app.get('/network/speedtest/servers', requireAuth, async (req, res) => {
    try {
      const result = await getSpeedtestServers();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get speedtest servers' });
    }
  });

};
