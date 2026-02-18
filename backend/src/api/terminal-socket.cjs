// src/api/terminal-socket.cjs
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = '/etc/nas-panel';
const SERVERS_FILE = path.join(CONFIG_DIR, 'servers_list.json');

module.exports = function(server) {
  // Sprawdź czy to serwer HTTP
  if (!server || !server.listen) {
    console.error('Invalid HTTP server instance');
    return null;
  }

  const io = new Server(server, {
    path: '/terminal',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  console.log('Terminal WebSocket initialized');

  io.on('connection', (socket) => {
    console.log('Terminal client connected:', socket.id);
    
    let sshClient = null;
    let sshStream = null;

    socket.on('auth', async (data) => {
      try {
        const { serverId, username, password, keyFile, cols, rows } = data;
        
        // Sprawdź czy plik z serwerami istnieje
        if (!fs.existsSync(SERVERS_FILE)) {
          socket.emit('error', 'Brak pliku konfiguracyjnego serwerów');
          return;
        }

        // Pobierz dane serwera z pliku
        const serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
        const server = serversData.servers.find(s => s.id === serverId);
        
        if (!server) {
          socket.emit('error', 'Serwer nie istnieje');
          return;
        }

        console.log(`Connecting to ${server.host}:${server.port} as ${username || server.username}`);

        sshClient = new Client();

        sshClient.on('ready', () => {
          console.log(`SSH connected to ${server.host}`);
          
          // Uruchom shell
          sshClient.shell({
            term: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24
          }, (err, stream) => {
            if (err) {
              socket.emit('error', err.message);
              return;
            }

            sshStream = stream;

            // Przekazuj dane z SSH do klienta
            stream.on('data', (data) => {
              socket.emit('data', data.toString('utf-8'));
            });

            stream.on('close', () => {
              console.log('SSH stream closed');
              socket.emit('disconnected');
            });

            stream.on('error', (err) => {
              console.error('SSH stream error:', err);
              socket.emit('error', err.message);
            });

            // Potwierdź autoryzację
            socket.emit('authenticated');
          });
        });

        sshClient.on('error', (err) => {
          console.error('SSH error:', err);
          socket.emit('error', err.message);
        });

        // Konfiguracja połączenia
        const config = {
          host: server.host,
          port: server.port || 22,
          username: username || server.username,
          readyTimeout: 10000,
          keepaliveInterval: 10000,
          algorithms: {
            cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm'],
            compress: ['none'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
            kex: [
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha1'
            ],
            serverHostKey: [
              'ssh-rsa',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521',
              'ssh-ed25519'
            ]
          }
        };

        if (password) {
          config.password = password;
        } else if (server.password) {
          config.password = server.password;
        } else if (keyFile || server.keyFile) {
          try {
            config.privateKey = fs.readFileSync(keyFile || server.keyFile);
          } catch (e) {
            socket.emit('error', 'Nie można odczytać pliku klucza');
            return;
          }
        }

        sshClient.connect(config);

      } catch (error) {
        console.error('Auth error:', error);
        socket.emit('error', error.message);
      }
    });

    socket.on('input', (data) => {
      if (sshStream) {
        sshStream.write(data);
      }
    });

    socket.on('resize', (size) => {
      if (sshStream) {
        try {
          sshStream.setWindow(size.rows, size.cols, 0, 0);
        } catch (err) {
          console.error('Resize error:', err);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Terminal client disconnected:', socket.id);
      
      if (sshStream) {
        try {
          sshStream.end();
        } catch (err) {
          console.error('Error closing stream:', err);
        }
      }
      
      if (sshClient) {
        try {
          sshClient.end();
        } catch (err) {
          console.error('Error closing client:', err);
        }
      }
    });
  });

  return io;
};