<template>
  <div class="real-terminal">
    <!-- Pasek narzędzi -->
    <div class="terminal-toolbar">
      <div class="toolbar-left">
        <el-tag size="small" :type="connectionStatus.type" effect="dark">
          <Icon :icon="connectionStatus.icon" width="12" />
          {{ connectionStatus.text }}
        </el-tag>
        <span class="connection-info" v-if="connected">
          {{ server?.username }}@{{ server?.host }}:{{ server?.port }}
        </span>
      </div>
      <div class="toolbar-right">
        <el-button 
          v-if="!connected && server?.status === 'online'"
          @click="connect" 
          size="small" 
          type="success"
          :loading="connecting"
        >
          <Icon icon="mdi:link" width="14" />
          Połącz
        </el-button>
        <el-button 
          v-if="connected"
          @click="disconnect" 
          size="small" 
          type="danger"
        >
          <Icon icon="mdi:link-off" width="14" />
          Rozłącz
        </el-button>
        <el-button 
          v-if="connected"
          @click="clearTerminal" 
          size="small"
        >
          <Icon icon="mdi:delete-sweep" width="14" />
        </el-button>
      </div>
    </div>

    <!-- Właściwy terminal xterm.js -->
    <div ref="terminalContainer" class="xterm-container"></div>

    <!-- Overlay gdy nie połączono -->
    <div v-if="!connected && !connecting" class="terminal-overlay">
      <div class="overlay-content">
        <Icon icon="mdi:console" size="48" />
        <h3>Terminal nieaktywny</h3>
        <p v-if="server?.status === 'online'">
          Kliknij "Połącz" aby uzyskać dostęp do terminala serwera {{ server?.name }}
        </p>
        <p v-else>
          Serwer {{ server?.name }} jest offline. Najpierw połącz się z serwerem.
        </p>
        <el-button 
          v-if="server?.status === 'online'"
          @click="connect" 
          type="primary"
          :disabled="server?.status !== 'online'"
        >
          <Icon icon="mdi:link" width="16" />
          Połącz z terminalem
        </el-button>
      </div>
    </div>

    <!-- Overlay ładowania -->
    <div v-if="connecting" class="terminal-overlay">
      <div class="overlay-content">
        <el-progress type="circle" :percentage="50" :show-text="false" status="info" />
        <h3>Łączenie...</h3>
        <p>Nawiązywanie połączenia SSH z {{ server?.host }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'
import 'xterm/css/xterm.css'

const props = defineProps({
  server: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['connected', 'disconnected', 'error'])

// Stan
const terminalContainer = ref(null)
const term = ref(null)
const fitAddon = ref(null)
const socket = ref(null)
const connected = ref(false)
const connecting = ref(false)
const commandBuffer = ref('')

// Status połączenia
const connectionStatus = computed(() => {
  if (connected.value) {
    return {
      type: 'success',
      icon: 'mdi:check-circle',
      text: 'Połączono'
    }
  }
  if (connecting.value) {
    return {
      type: 'warning',
      icon: 'mdi:loading',
      text: 'Łączenie...'
    }
  }
  return {
    type: 'info',
    icon: 'mdi:console',
    text: 'Rozłączono'
  }
})

// Inicjalizacja terminala xterm.js
const initTerminal = () => {
  if (!terminalContainer.value) return

  term.value = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    theme: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selection: '#585b70',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8'
    },
    fontSize: 13,
    fontFamily: 'JetBrains Mono, SF Mono, Monaco, Consolas, monospace',
    scrollback: 5000,
    lineHeight: 1.4,
    allowTransparency: true
  })

  // Dodaj addony
  fitAddon.value = new FitAddon()
  term.value.loadAddon(fitAddon.value)
  term.value.loadAddon(new WebLinksAddon())

  // Otwórz terminal w kontenerze
  term.value.open(terminalContainer.value)
  
  // Dostosuj rozmiar
  setTimeout(() => {
    fitAddon.value.fit()
  }, 100)

  // Obsługa zmiany rozmiaru okna
  window.addEventListener('resize', handleResize)
}

const handleResize = () => {
  if (fitAddon.value && connected.value) {
    fitAddon.value.fit()
  }
}

// Połączenie WebSocket przez SSH
const connect = async () => {
  if (!props.server || props.server.status !== 'online') {
    ElMessage.warning('Serwer jest offline. Najpierw połącz się z serwerem.')
    return
  }

  connecting.value = true

  try {
    // Połączenie WebSocket do serwera SSH
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `ws://${window.location.hostname}:1113`
    
    socket.value = io(wsUrl, {
      path: '/terminal',
      transports: ['websocket'],
      query: {
        serverId: props.server.id,
        cols: term.value.cols,
        rows: term.value.rows
      }
    })

    socket.value.on('connect', () => {
      console.log('WebSocket connected')
      
      // Wyślij dane logowania
      socket.value.emit('auth', {
        serverId: props.server.id,
        username: props.server.username,
        password: props.server.password || null,
        keyFile: props.server.keyFile || null
      })
    })

    socket.value.on('authenticated', () => {
      connected.value = true
      connecting.value = false
      
      term.value.clear()
      term.value.writeln('\x1b[32m╭────────────────────────────────────╮')
      term.value.writeln('\x1b[32m│   Połączono z serwerem pomyślnie   │')
      term.value.writeln('\x1b[32m╰────────────────────────────────────╯\x1b[0m')
      term.value.writeln('')
      
      emit('connected')
      ElMessage.success('Połączono z terminalem')
    })

    socket.value.on('data', (data) => {
      // Odbierz dane z SSH i wyświetl w terminalu
      term.value.write(data)
    })

    socket.value.on('error', (error) => {
      console.error('Socket error:', error)
      ElMessage.error(error)
      emit('error', error)
      disconnect()
    })

    socket.value.on('disconnect', () => {
      if (connected.value) {
        ElMessage.warning('Rozłączono z terminalem')
        disconnect()
      }
    })

    // Przekaż dane z terminala do SSH
    term.value.onData((data) => {
      if (socket.value && connected.value) {
        socket.value.emit('input', data)
      }
    })

    // Obsługa resize
    term.value.onResize((size) => {
      if (socket.value && connected.value) {
        socket.value.emit('resize', size)
      }
    })

  } catch (error) {
    console.error('Connection error:', error)
    ElMessage.error('Nie można połączyć się z terminalem')
    connecting.value = false
    emit('error', error.message)
  }
}

const disconnect = () => {
  if (socket.value) {
    socket.value.disconnect()
    socket.value = null
  }
  
  connected.value = false
  connecting.value = false
  
  if (term.value) {
    term.value.clear()
    term.value.writeln('\x1b[33m╭────────────────────────────────────╮')
    term.value.writeln('\x1b[33m│      Rozłączono z terminalem        │')
    term.value.writeln('\x1b[33m╰────────────────────────────────────╯\x1b[0m')
  }
  
  emit('disconnected')
}

const clearTerminal = () => {
  if (term.value) {
    term.value.clear()
  }
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    initTerminal()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  
  if (socket.value) {
    socket.value.disconnect()
  }
  
  if (term.value) {
    term.value.dispose()
  }
})

// Expose metody dla rodzica
defineExpose({
  connect,
  disconnect,
  clearTerminal,
  isConnected: connected
})
</script>

<style scoped lang="scss">
.real-terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e2e;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #313244;
}

.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #181825;
  border-bottom: 1px solid #313244;
  
  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .connection-info {
      font-size: 12px;
      color: #a6adc8;
      font-family: 'JetBrains Mono', monospace;
    }
  }
  
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.xterm-container {
  flex: 1;
  min-height: 300px;
  padding: 8px;
  background: #1e1e2e;
  
  :deep(.xterm) {
    height: 100%;
    
    .xterm-viewport {
      overflow-y: auto;
      background: #1e1e2e !important;
      
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: #313244;
      }
      
      &::-webkit-scrollbar-thumb {
        background: #585b70;
        border-radius: 4px;
        
        &:hover {
          background: #6c7086;
        }
      }
    }
    
    .xterm-screen {
      width: 100% !important;
    }
  }
}

.terminal-overlay {
  position: absolute;
  top: 40px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 46, 0.95);
  backdrop-filter: blur(4px);
  z-index: 10;
  
  .overlay-content {
    text-align: center;
    color: #cdd6f4;
    padding: 32px;
    max-width: 400px;
    
    h3 {
      margin: 16px 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    
    p {
      margin: 0 0 20px;
      color: #a6adc8;
      font-size: 14px;
    }
  }
}
</style>
