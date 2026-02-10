<template>
  <div class="ssh-terminal-wrapper">
    <div class="terminal-header">
      <div class="header-left">
        <el-icon class="terminal-icon"><Icon icon="mdi:console" /></el-icon>
        <span class="terminal-title">
          Container: {{ containerName || containerId.substring(0, 12) }}
        </span>
        <el-tag v-if="connected" type="success" size="small">
          <el-icon><Icon icon="mdi:check-circle" /></el-icon>
          Connected
        </el-tag>
        <el-tag v-else type="danger" size="small">
          <el-icon><Icon icon="mdi:close-circle" /></el-icon>
          Disconnected
        </el-tag>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-tooltip content="Clear terminal" placement="top">
            <el-button @click="clearTerminal" size="small" type="info">
              <el-icon><Icon icon="mdi:trash-can" /></el-icon>
              Clear
            </el-button>
          </el-tooltip>
          <el-tooltip content="Copy all" placement="top">
            <el-button @click="copyTerminal" size="small" type="success">
              <el-icon><Icon icon="mdi:content-copy" /></el-icon>
              Copy
            </el-button>
          </el-tooltip>
          <el-tooltip content="Reconnect" placement="top">
            <el-button @click="reconnect" size="small" type="warning" :loading="connecting">
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
              Reconnect
            </el-button>
          </el-tooltip>
          <el-tooltip content="Close" placement="top">
            <el-button @click="$emit('close')" size="small" type="danger">
              <el-icon><Icon icon="mdi:close" /></el-icon>
              Close
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </div>
    
    <div class="terminal-container" ref="terminalContainer">
      <div class="terminal-output" ref="terminalOutput">
        <div v-for="(line, index) in outputLines" :key="index" class="terminal-line">
          <span class="prompt" v-if="line.type === 'input'">$ </span>
          <span :class="['line-content', line.type]">{{ line.content }}</span>
        </div>
        <div v-if="connecting" class="connecting-message">
          <el-icon class="loading-icon"><Icon icon="mdi:loading" /></el-icon>
          Connecting to container...
        </div>
        <div v-if="!connected && !connecting" class="disconnected-message">
          <el-icon><Icon icon="mdi:alert-circle" /></el-icon>
          Disconnected from container
        </div>
      </div>
      <div class="terminal-input" v-if="connected">
        <span class="input-prompt">$ </span>
        <input
          ref="terminalInput"
          v-model="currentInput"
          @keydown="handleKeydown"
          :disabled="!connected"
          placeholder="Type command and press Enter..."
          class="terminal-input-field"
        />
      </div>
    </div>
    
    <div class="terminal-footer">
      <div class="footer-left">
        <span class="footer-info">
          <el-icon><Icon icon="mdi:information" /></el-icon>
          Press Enter to execute command
        </span>
      </div>
      <div class="footer-right">
        <span class="connection-status" :class="connectionStatusClass">
          <el-icon><Icon :icon="connectionStatusIcon" /></el-icon>
          {{ connectionStatusText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  containerId: {
    type: String,
    required: true
  },
  containerName: {
    type: String,
    default: ''
  },
  socketUrl: {
    type: String,
    default: 'ws://localhost:1111'
  }
});

const emit = defineEmits(['close']);

// Reactive state
const connected = ref(false);
const connecting = ref(false);
const outputLines = ref([]);
const currentInput = ref('');
const terminalInput = ref(null);
const terminalOutput = ref(null);
const terminalContainer = ref(null);
const socket = ref(null);
const reconnectAttempts = ref(0);
const MAX_RECONNECT_ATTEMPTS = 3;

// Computed properties
const connectionStatusClass = computed(() => {
  if (connected.value) return 'status-connected';
  if (connecting.value) return 'status-connecting';
  return 'status-disconnected';
});

const connectionStatusIcon = computed(() => {
  if (connected.value) return 'mdi:check-circle';
  if (connecting.value) return 'mdi:loading';
  return 'mdi:close-circle';
});

const connectionStatusText = computed(() => {
  if (connected.value) return 'Connected';
  if (connecting.value) return 'Connecting...';
  return 'Disconnected';
});

// Methods
const initWebSocket = () => {
  if (connecting.value || connected.value) return;
  
  connecting.value = true;
  reconnectAttempts.value++;
  
  try {
    // Close existing socket
    if (socket.value) {
      socket.value.close();
      socket.value = null;
    }
    
    const wsUrl = `${props.socketUrl}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    socket.value = new WebSocket(wsUrl);
    
    socket.value.onopen = () => {
      console.log('WebSocket connected');
      connected.value = true;
      connecting.value = false;
      reconnectAttempts.value = 0;
      addOutputLine('Connected to container terminal', 'system');
      
      // Initialize terminal session
      initializeTerminal();
    };
    
    socket.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data.type);
        
        switch (data.type) {
          case 'stdout':
            addOutputLine(data.data, 'stdout');
            break;
          case 'stderr':
            addOutputLine(data.data, 'stderr');
            break;
          case 'connected':
            addOutputLine(data.data, 'system');
            break;
          case 'error':
            addOutputLine(`Error: ${data.data}`, 'error');
            break;
          case 'closed':
            addOutputLine(`Session closed (code: ${data.code})`, 'system');
            disconnect();
            break;
          case 'pong':
            // Handle pong response
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        addOutputLine(`Error: ${error.message}`, 'error');
      }
    };
    
    socket.value.onerror = (error) => {
      console.error('WebSocket error:', error);
      addOutputLine(`WebSocket error: ${error.type}`, 'error');
      connecting.value = false;
      connected.value = false;
      
      if (reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(initWebSocket, 2000);
      } else {
        ElMessage.error('Failed to connect to terminal server');
      }
    };
    
    socket.value.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      connecting.value = false;
      connected.value = false;
      
      if (event.code !== 1000 && reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(initWebSocket, 2000);
      } else {
        addOutputLine('Connection closed', 'system');
      }
    };
    
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    connecting.value = false;
    ElMessage.error(`WebSocket error: ${error.message}`);
  }
};

const initializeTerminal = () => {
  if (!connected.value || !socket.value) return;
  
  try {
    // Start interactive shell in container
    const initMessage = {
      type: 'exec',
      containerId: props.containerId,
      command: '/bin/sh'
    };
    
    socket.value.send(JSON.stringify(initMessage));
    addOutputLine('Initializing shell...', 'system');
    
    // Send initial command to get prompt
    setTimeout(() => {
      sendCommand('echo "Terminal ready"');
    }, 500);
    
  } catch (error) {
    console.error('Failed to initialize terminal:', error);
    addOutputLine(`Init error: ${error.message}`, 'error');
  }
};

const sendCommand = (command) => {
  if (!connected.value || !socket.value) {
    ElMessage.warning('Not connected to terminal');
    return;
  }
  
  if (!command.trim()) return;
  
  // Add input to output
  addOutputLine(command, 'input');
  
  try {
    // Send command via WebSocket
    const message = {
      type: 'stdin',
      data: command + '\n'
    };
    
    socket.value.send(JSON.stringify(message));
    currentInput.value = '';
    
    // Focus input again
    nextTick(() => {
      if (terminalInput.value) {
        terminalInput.value.focus();
      }
    });
    
  } catch (error) {
    console.error('Failed to send command:', error);
    addOutputLine(`Send error: ${error.message}`, 'error');
  }
};

const addOutputLine = (content, type = 'stdout') => {
  outputLines.value.push({
    content: content.trimRight(),
    type: type,
    timestamp: new Date().toISOString()
  });
  
  // Limit output lines to prevent memory issues
  if (outputLines.value.length > 1000) {
    outputLines.value = outputLines.value.slice(-500);
  }
  
  // Auto-scroll to bottom
  nextTick(() => {
    if (terminalOutput.value) {
      terminalOutput.value.scrollTop = terminalOutput.value.scrollHeight;
    }
  });
};

const handleKeydown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendCommand(currentInput.value);
  } else if (event.key === 'Tab') {
    event.preventDefault();
    // Tab completion could be implemented here
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    // Command history could be implemented here
  }
};

const clearTerminal = () => {
  outputLines.value = [];
  addOutputLine('Terminal cleared', 'system');
};

const copyTerminal = () => {
  const text = outputLines.value
    .map(line => (line.type === 'input' ? '$ ' : '') + line.content)
    .join('\n');
  
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success('Terminal content copied to clipboard'))
    .catch(() => ElMessage.error('Failed to copy to clipboard'));
};

const reconnect = () => {
  reconnectAttempts.value = 0;
  initWebSocket();
};

const disconnect = () => {
  if (socket.value) {
    socket.value.close();
    socket.value = null;
  }
  connected.value = false;
  connecting.value = false;
};

const focusInput = () => {
  nextTick(() => {
    if (terminalInput.value) {
      terminalInput.value.focus();
    }
  });
};

// Lifecycle
onMounted(() => {
  console.log('SSHTerminal mounted for container:', props.containerId);
  initWebSocket();
  
  // Focus input when component is mounted
  setTimeout(focusInput, 500);
});

onBeforeUnmount(() => {
  console.log('SSHTerminal unmounting');
  disconnect();
});

// Watch for prop changes
watch(() => props.containerId, () => {
  console.log('Container ID changed:', props.containerId);
  if (connected.value) {
    disconnect();
  }
  initWebSocket();
});

// Auto-reconnect if disconnected unexpectedly
watch(connected, (newVal) => {
  if (!newVal && !connecting.value && reconnectAttempts.value < MAX_RECONNECT_ATTEMPTS) {
    setTimeout(initWebSocket, 3000);
  }
});
</script>

<style scoped>
.ssh-terminal-wrapper {
  display: flex;
  flex-direction: column;
  height: 600px;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.terminal-icon {
  color: #10b981;
  font-size: 20px;
}

.terminal-title {
  color: #f0f0f0;
  font-weight: 600;
  font-size: 14px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #1e1e1e;
}

.terminal-line {
  margin-bottom: 2px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

.prompt {
  color: #10b981;
  font-weight: bold;
  margin-right: 8px;
}

.line-content {
  color: #f0f0f0;
}

.line-content.stdout {
  color: #e0e0e0;
}

.line-content.stderr {
  color: #f87171;
}

.line-content.error {
  color: #ef4444;
  font-weight: bold;
}

.line-content.system {
  color: #60a5fa;
}

.line-content.input {
  color: #fbbf24;
}

.connecting-message,
.disconnected-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: #94a3b8;
  font-style: italic;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.terminal-input {
  padding: 12px 16px;
  background: #2d2d2d;
  border-top: 1px solid #444;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.input-prompt {
  color: #10b981;
  font-weight: bold;
}

.terminal-input-field {
  flex: 1;
  background: transparent;
  border: none;
  color: #f0f0f0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 14px;
  outline: none;
}

.terminal-input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.terminal-input-field::placeholder {
  color: #64748b;
}

.terminal-footer {
  padding: 8px 16px;
  background: #2d2d2d;
  border-top: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 12px;
}

.status-connected {
  color: #10b981;
  background: #10b98120;
}

.status-connecting {
  color: #f59e0b;
  background: #f59e0b20;
}

.status-disconnected {
  color: #ef4444;
  background: #ef444420;
}

/* Custom scrollbar */
.terminal-output::-webkit-scrollbar {
  width: 8px;
}

.terminal-output::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.terminal-output::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.terminal-output::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>
