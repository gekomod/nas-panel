<template>
  <div class="terminal-wrapper">
    <div class="terminal-header">
      <div class="connection-info">
        <el-tag :type="connectionStatus.type">
          <Icon :icon="connectionStatus.icon" />
          {{ connectionStatus.text }} ({{ containerId }})
        </el-tag>
      </div>
      <div class="terminal-actions">
        <el-button 
          size="small" 
          @click="disconnect" 
          :disabled="!isConnected"
        >
          <el-icon><Icon icon="streamline-ultimate:power-plug-disconnected" /></el-icon>
          Disconnect
        </el-button>
        <el-button 
          size="small" 
          type="danger" 
          @click="closeTerminal"
          plain
        >
          <el-icon><Icon icon="mdi:close" /></el-icon>
          Close
        </el-button>
      </div>
    </div>
    <div class="terminal-container" ref="terminalContainer"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import { Icon } from '@iconify/vue';
import { Close, Connection, WarnTriangleFilled } from '@element-plus/icons-vue';
import 'xterm/css/xterm.css';

const props = defineProps({
  containerId: String,
  socketUrl: String
});

const emit = defineEmits(['close']);

const terminalContainer = ref(null);
const connectionState = ref('disconnected'); // 'connecting', 'connected', 'disconnected', 'error'
let term = null;
let socket = null;
const fitAddon = new FitAddon();

const connectionStatus = computed(() => {
  switch (connectionState.value) {
    case 'connected':
      return { 
        type: 'success', 
        icon: 'streamline-freehand-color:network-connection-locked', 
        text: 'Connected' 
      };
    case 'connecting':
      return { 
        type: 'warning', 
        icon: 'streamline-freehand-color:laptop-action-warning', 
        text: 'Connecting...' 
      };
    case 'error':
      return { 
        type: 'danger', 
        icon: 'streamline-freehand-color:safety-sign-danger-slippery', 
        text: 'Connection Error' 
      };
    default:
      return { 
        type: 'info', 
        icon: 'streamline-freehand-color:information-desk', 
        text: 'Disconnected' 
      };
  }
});

const isConnected = computed(() => connectionState.value === 'connected');

onMounted(() => {
  initializeTerminal();
  connectToContainer();
});

onBeforeUnmount(() => {
  cleanup();
});

const initializeTerminal = () => {
  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    theme: {
      background: '#1e1e1e',
      foreground: '#e0e0e0'
    }
  });

  term.loadAddon(fitAddon);
  term.open(terminalContainer.value);
  fitAddon.fit();

  term.onData(data => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stdin', data }));
    }
  });

  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  try {
    fitAddon.fit();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'resize', 
        cols: term.cols,
        rows: term.rows
      }));
    }
  } catch (e) {
    console.error('Resize error:', e);
  }
};

const connectToContainer = () => {
  connectionState.value = 'connecting';
  
  socket = new WebSocket(props.socketUrl);

  socket.onopen = () => {
    connectionState.value = 'connected';
    term.writeln('\x1b[32m✓ Connected to container ' + props.containerId + '\x1b[0m\r\n');
    socket.send(JSON.stringify({
      type: 'init',
      containerId: props.containerId,
      cols: term.cols,
      rows: term.rows
    }));
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'stdout') {
        term.write(msg.data);
      }
    } catch (e) {
      console.error('Message parse error:', e);
    }
  };

  socket.onclose = () => {
    connectionState.value = 'disconnected';
  };

  socket.onerror = (error) => {
    connectionState.value = 'error';
    term.writeln('\r\n\x1b[31m⚠ Connection error: ' + error.message + '\x1b[0m');
  };
};

const disconnect = () => {
  if (socket) {
    socket.close();
  }
  connectionState.value = 'disconnected';
};

const closeTerminal = () => {
  if (term) {
    term.writeln('\r\n\x1b[31m✗ Connection closed by user\x1b[0m');
    // Dodaj krótkie opóźnienie aby komunikat się wyświetlił
    setTimeout(() => {
      cleanup();
      emit('close');
    }, 100);
  } else {
    cleanup();
    emit('close');
  }
};

const cleanup = () => {
  if (socket) {
    const oldSocket = socket;
    socket = null;
    
    if (oldSocket.readyState === WebSocket.OPEN) {
      oldSocket.close();
    }
  }

  if (term) {
    try {
      term.dispose();
    } catch (e) {
      console.error('Error disposing terminal:', e);
    }
    term = null;
  }

  window.removeEventListener('resize', handleResize);
};
</script>

<style scoped>
.terminal-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #2d2d2d;
  border-bottom: 1px solid #444;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-actions {
  display: flex;
  gap: 8px;
}

.terminal-container {
  flex-grow: 1;
  padding: 10px;
}

:deep(.el-tag) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.el-icon) {
  vertical-align: middle;
}
</style>