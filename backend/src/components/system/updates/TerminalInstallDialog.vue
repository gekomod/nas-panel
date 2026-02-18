<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="dialogTitle"
    width="85%"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="!isRunning"
    class="terminal-install-dialog"
    @closed="handleClosed"
    :destroy-on-close="true"
  >
    <div class="terminal-container" :class="{ 'dark-theme': isDarkTheme }">
      <!-- Nagłówek terminala -->
      <div class="terminal-header">
        <div class="terminal-title">
          <Icon :icon="getHeaderIcon" width="16" />
          <span>{{ terminalTitle }}</span>
        </div>
        <div class="terminal-status" :class="statusClass">
          <span class="status-indicator"></span>
          {{ statusText }}
        </div>
      </div>
      
      <!-- Obszar terminala - uproszczony, bez virtual scrollingu -->
      <div 
        ref="terminalRef" 
        class="terminal-body"
        @scroll.passive="handleScroll"
      >
        <div class="terminal-content">
          <div 
            v-for="line in lines" 
            :key="line.id"
            class="terminal-line"
          >
            <span 
              class="line-content" 
              v-html="renderAnsi(line.rawContent)"
            ></span>
          </div>
          
          <!-- Kursor podczas działania -->
          <div v-if="isRunning" class="terminal-cursor-line">
            <span class="cursor"></span>
          </div>
        </div>
      </div>
      
      <!-- Stopka terminala -->
      <div class="terminal-footer">
        <div class="terminal-stats">
          <div class="stat-item">
            <Icon icon="mdi:package" width="14" />
            <span>{{ packages.length }} {{ $t('systemUpdates.packages') }}</span>
          </div>
          <div class="stat-item" v-if="elapsedTime">
            <Icon icon="mdi:clock-outline" width="14" />
            <span>{{ elapsedTime }}</span>
          </div>
          <div class="stat-item" v-if="currentPackage">
            <Icon icon="mdi:package-variant" width="14" />
            <span class="current-package">{{ currentPackage }}</span>
          </div>
          <div class="stat-item" v-if="downloadProgress">
            <Icon icon="mdi:download" width="14" />
            <span>{{ downloadProgress }}</span>
          </div>
        </div>
        
        <div class="terminal-actions">
          <el-button 
            v-if="isRunning"
            size="small" 
            type="danger" 
            plain
            @click="cancelInstallation"
            :loading="isCancelling"
          >
            <Icon icon="mdi:close-circle" width="14" />
            {{ $t('common.cancel') }}
          </el-button>
          
          <el-button 
            v-if="!isRunning && lines.length > 0"
            size="small" 
            type="primary"
            plain
            @click="copyLog"
          >
            <Icon icon="mdi:content-copy" width="14" />
            {{ $t('common.copy') }}
          </el-button>
          
          <el-button 
            size="small" 
            @click="closeDialog"
          >
            {{ $t('common.close') }}
          </el-button>
          
          <el-button 
            v-if="hasError && !isRunning"
            size="small" 
            type="warning"
            plain
            @click="retryInstallation"
          >
            <Icon icon="mdi:refresh" width="14" />
            {{ $t('common.retry') }}
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- Progress bar -->
    <div v-if="isRunning" class="installation-progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: progressWidth + '%' }"
      ></div>
      <span class="progress-text">{{ progressText || 'Installing...' }}</span>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

// Prosty parser ANSI - tylko usuwanie sekwencji
const stripAnsi = (text) => {
  if (!text) return ''
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  packages: {
    type: Array,
    default: () => []
  },
  processId: {
    type: String,
    default: ''
  },
  isBulk: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'complete', 'cancel', 'retry'])

const { t } = useI18n()

// API
const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3001}`
})

// State
const terminalRef = ref(null)
const eventSource = ref(null)
const lines = ref([])
const isRunning = ref(false)
const isCancelling = ref(false)
const hasError = ref(false)
const startTime = ref(null)
const currentTime = ref(null)
const downloadProgress = ref('')
const currentPackage = ref('')
const progressWidth = ref(0)
const progressText = ref('')
const autoScroll = ref(true)
const userScrolled = ref(false)

// Computed
const dialogTitle = computed(() => {
  if (props.isBulk) {
    return `${t('systemUpdates.bulkInstallation')} (${props.packages.length})`
  }
  if (props.packages.length === 1) {
    return `${t('systemUpdates.installing')}: ${props.packages[0]}`
  }
  return `${t('systemUpdates.installingPackages')} (${props.packages.length})`
})

const terminalTitle = computed(() => {
  if (isRunning.value) {
    return `apt-get install ${props.packages.join(' ')}`
  }
  if (hasError.value) {
    return 'Installation failed'
  }
  return 'Installation completed'
})

const statusText = computed(() => {
  if (isRunning.value) return 'INSTALLING'
  if (hasError.value) return 'FAILED'
  return 'SUCCESS'
})

const statusClass = computed(() => {
  if (isRunning.value) return 'status-running'
  if (hasError.value) return 'status-failed'
  return 'status-success'
})

const getHeaderIcon = computed(() => {
  if (isRunning.value) return 'mdi:console'
  if (hasError.value) return 'mdi:alert-circle'
  return 'mdi:check-circle'
})

const elapsedTime = computed(() => {
  if (!startTime.value) return ''
  const end = currentTime.value || Date.now()
  const diff = Math.floor((end - startTime.value) / 1000)
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const isDarkTheme = computed(() => {
  return document.documentElement.getAttribute('data-theme') === 'dark'
})

// Watch for dialog open
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && props.processId) {
    await nextTick()
    resetTerminal()
    startInstallation()
  }
})

// Watch for new lines - auto scroll only if user hasn't scrolled up
watch(() => lines.value.length, () => {
  if (autoScroll.value && !userScrolled.value && isRunning.value) {
    scrollToBottom()
  }
})

// Methods
const resetTerminal = () => {
  lines.value = []
  isRunning.value = true
  hasError.value = false
  startTime.value = Date.now()
  currentTime.value = Date.now()
  progressWidth.value = 0
  progressText.value = ''
  downloadProgress.value = ''
  currentPackage.value = ''
  userScrolled.value = false
  autoScroll.value = true
  
  // Dodaj linię startową
  addLine(`\x1b[36m❯ Starting installation of ${props.packages.join(', ')}\x1b[0m`)
  addLine('')
}

const startInstallation = () => {
  if (!props.processId) return
  
  console.log('Starting installation with processId:', props.processId)
  
  // Timer dla czasu trwania
  const timer = setInterval(() => {
    if (isRunning.value) {
      currentTime.value = Date.now()
    }
  }, 1000)
  
  // EventSource dla logów
  const baseURL = api.defaults.baseURL
  try {
    eventSource.value = new EventSource(`${baseURL}/system/updates/progress/${props.processId}`)
    
    eventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'output') {
          processOutput(data.data)
        } else if (data.type === 'complete') {
          isRunning.value = false
          currentTime.value = Date.now()
          clearInterval(timer)
          
          if (data.success) {
            addLine('')
            addLine('\x1b[32m✓ Installation completed successfully!\x1b[0m')
            progressWidth.value = 100
            progressText.value = 'Complete'
          } else {
            hasError.value = true
            addLine('')
            addLine(`\x1b[31m✗ Installation failed with code ${data.code}\x1b[0m`)
          }
          
          emit('complete', data)
          closeEventSource()
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e)
      }
    }
    
    eventSource.value.onerror = (err) => {
      console.error('SSE Error:', err)
      if (isRunning.value) {
        addLine('\x1b[31m✗ Connection to installation process lost\x1b[0m')
        hasError.value = true
        isRunning.value = false
        clearInterval(timer)
      }
      closeEventSource()
    }
  } catch (err) {
    console.error('Error creating EventSource:', err)
    isRunning.value = false
    clearInterval(timer)
  }
}

const processOutput = (data) => {
  if (!data) return
  
  // Podziel na linie i przetwórz każdą
  const outputLines = data.split('\n')
  
  outputLines.forEach(rawLine => {
    if (!rawLine) return
    
    const cleanLine = stripAnsi(rawLine).trim()
    
    // Ignoruj puste linie
    if (!cleanLine && !rawLine.includes('%')) return
    
    // Sprawdź czy to linia postępu (powinna nadpisać poprzednią)
    if (rawLine.includes('%]') || rawLine.includes('Pobr:') || rawLine.includes('Get:')) {
      updateLastLine(rawLine)
    } else {
      addLine(rawLine)
    }
    
    // Ekstrakcja informacji o postępie
    extractProgressInfo(rawLine)
  })
}

const extractProgressInfo = (line) => {
  const cleanLine = stripAnsi(line)
  
  // Nazwa pakietu
  const unpackMatch = cleanLine.match(/Unpacking (.+?) \(/)
  if (unpackMatch) {
    currentPackage.value = unpackMatch[1]
    progressText.value = `Unpacking: ${unpackMatch[1]}`
  }
  
  const setupMatch = cleanLine.match(/Setting up (.+?) \(/)
  if (setupMatch) {
    currentPackage.value = setupMatch[1]
    progressText.value = `Configuring: ${setupMatch[1]}`
  }
  
  const getMatch = cleanLine.match(/Get:\d+\s+\S+\s+(\S+)/)
  if (getMatch) {
    currentPackage.value = getMatch[1]
  }
  
  // Postęp pobierania
  const percentMatch = cleanLine.match(/(\d+)%/)
  if (percentMatch) {
    const percent = parseInt(percentMatch[1])
    
    if (line.includes('Get:') || line.includes('Pobr:')) {
      progressWidth.value = Math.min(Math.floor(percent * 0.7), 70)
      progressText.value = `Downloading: ${percent}%`
    }
  }
  
  // Rozmiar
  const sizeMatch = cleanLine.match(/([0-9,.]+)\s+([KM]B)/)
  if (sizeMatch) {
    downloadProgress.value = `${sizeMatch[1]} ${sizeMatch[2]}`
  }
}

const addLine = (content) => {
  // Usuń zbędne sekwencje ANSI ale zachowaj kolory dla renderowania
  lines.value.push({
    id: Date.now() + Math.random(),
    rawContent: content,
    timestamp: Date.now()
  })
  
  // Limit linii
  if (lines.value.length > 500) {
    lines.value = lines.value.slice(-450)
  }
}

const updateLastLine = (content) => {
  if (lines.value.length === 0) {
    addLine(content)
    return
  }
  
  // Zastąp ostatnią linię jeśli to update postępu
  const lastLine = lines.value[lines.value.length - 1]
  const lastClean = stripAnsi(lastLine.rawContent)
  const currentClean = stripAnsi(content)
  
  // Jeśli linie są podobne (ten sam typ), nadpisz
  if (lastClean.includes('%') && currentClean.includes('%')) {
    lastLine.rawContent = content
    lastLine.timestamp = Date.now()
  } else {
    addLine(content)
  }
}

const renderAnsi = (text) => {
  if (!text) return ''
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Zamień spacje na &nbsp; tylko dla wcięć
  html = html.replace(/^ {2,}/gm, match => '&nbsp;'.repeat(match.length))
  
  // Kolory ANSI na klasy CSS
  const ansiToClass = [
    { regex: /\x1b\[31m/g, class: 'color-red' },
    { regex: /\x1b\[32m/g, class: 'color-green' },
    { regex: /\x1b\[33m/g, class: 'color-yellow' },
    { regex: /\x1b\[34m/g, class: 'color-blue' },
    { regex: /\x1b\[35m/g, class: 'color-magenta' },
    { regex: /\x1b\[36m/g, class: 'color-cyan' },
    { regex: /\x1b\[1m/g, class: 'bold' },
    { regex: /\x1b\[4m/g, class: 'underline' },
    { regex: /\x1b\[0m/g, class: '' }
  ]
  
  ansiToClass.forEach(({ regex, class: className }) => {
    if (className) {
      html = html.replace(regex, `<span class="${className}">`)
    } else {
      html = html.replace(regex, '</span>')
    }
  })
  
  // Usuń pozostałe sekwencje ANSI
  html = html.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  
  // Formatowanie liczb
  html = html.replace(/(\d+)%/g, '<span class="progress-percent">$1%</span>')
  html = html.replace(/([0-9,.]+)\s+([KM]B)/g, '<span class="size">$1 $2</span>')
  html = html.replace(/([0-9,.]+)\s+([KM]B\/s)/g, '<span class="speed">$1 $2</span>')
  
  return html
}

const scrollToBottom = () => {
  if (terminalRef.value) {
    terminalRef.value.scrollTop = terminalRef.value.scrollHeight
  }
}

const handleScroll = () => {
  if (!terminalRef.value || !isRunning.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = terminalRef.value
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
  
  // Aktualizuj flagi tylko jeśli znacząco różne
  if (isAtBottom !== autoScroll.value) {
    autoScroll.value = isAtBottom
  }
  
  userScrolled.value = !isAtBottom
}

const cancelInstallation = async () => {
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmCancelInstallation'),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    isCancelling.value = true
    addLine('\x1b[33m⚠ Cancelling installation...\x1b[0m')
    
    await api.delete(`/system/updates/cancel/${props.packages[0] || 'all'}`)
    
    addLine('\x1b[33m⚠ Installation cancelled by user\x1b[0m')
    isRunning.value = false
    emit('cancel')
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.cancelFailed'))
    }
  } finally {
    isCancelling.value = false
  }
}

const copyLog = async () => {
  const text = lines.value
    .map(line => stripAnsi(line.rawContent))
    .join('\n')
  
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('common.copied'))
  } catch (err) {
    ElMessage.error(t('common.copyFailed'))
  }
}

const retryInstallation = () => {
  emit('retry', props.packages)
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

const handleClosed = () => {
  closeEventSource()
  lines.value = []
  isRunning.value = false
  userScrolled.value = false
  autoScroll.value = true
}

const closeEventSource = () => {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
}

onBeforeUnmount(() => {
  closeEventSource()
})
</script>

<style scoped>
.terminal-install-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    overflow: hidden;
    background: #0a0a0f;
    border: 1px solid #2d2d3a;
    margin-top: 5vh !important;
  }
  
  :deep(.el-dialog__header) {
    background: #0f0f17;
    border-bottom: 1px solid #2d2d3a;
    padding: 12px 20px;
    margin: 0;
    
    .el-dialog__title {
      color: #e4e7ed;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
    background: #0a0a0f;
  }
  
  :deep(.el-dialog__footer) {
    display: none;
  }
}

.terminal-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-height: 70vh;
  background: #0a0a0f;
  color: #cdd6f4;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.5;
  position: relative;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #0f0f17;
  border-bottom: 1px solid #2d2d3a;
  flex-shrink: 0;
  
  .terminal-title {
    display: flex;
    align-items: center;
    gap: 6px;
    
    span {
      color: #cdd6f4;
      font-size: 12px;
    }
  }
  
  .terminal-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    &.status-running {
      background: rgba(64, 158, 255, 0.1);
      color: #89b4fa;
      .status-indicator { 
        background: #89b4fa; 
        animation: pulse 1s infinite; 
      }
    }
    
    &.status-success {
      background: rgba(103, 194, 58, 0.1);
      color: #a6e3a1;
      .status-indicator { background: #a6e3a1; }
    }
    
    &.status-failed {
      background: rgba(245, 108, 108, 0.1);
      color: #f38ba8;
      .status-indicator { background: #f38ba8; }
    }
  }
}

.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #0a0a0f;
  
  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0f0f17;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #313244;
    border-radius: 5px;
    border: 2px solid #0f0f17;
    
    &:hover {
      background: #45475a;
    }
  }
}

.terminal-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal-line {
  padding: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  line-height: 1.5;
  
  .line-content {
    display: inline;
  }
}

.terminal-cursor-line {
  display: flex;
  align-items: center;
  padding: 2px 0;
  
  .cursor {
    display: inline-block;
    width: 8px;
    height: 16px;
    background: #cdd6f4;
    animation: blink 1s infinite;
  }
}

.terminal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #0f0f17;
  border-top: 1px solid #2d2d3a;
  flex-shrink: 0;
  
  .terminal-stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #7f849c;
      font-size: 11px;
      
      span {
        color: #cdd6f4;
      }
      
      .current-package {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
  
  .terminal-actions {
    display: flex;
    gap: 6px;
    
    :deep(.el-button) {
      padding: 6px 12px;
      font-size: 12px;
      height: 28px;
      
      .el-icon {
        margin-right: 4px;
      }
    }
  }
}

.installation-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: #1e1e2e;
  display: flex;
  align-items: center;
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #409eff, #89b4fa);
    transition: width 0.2s ease;
    border-radius: 0;
  }
  
  .progress-text {
    position: absolute;
    left: 12px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    text-shadow: 0 0 4px rgba(0,0,0,0.5);
    z-index: 1;
    mix-blend-mode: difference;
  }
}

/* ANSI colors */
:deep(.color-red) { color: #f38ba8; }
:deep(.color-green) { color: #a6e3a1; }
:deep(.color-yellow) { color: #fab387; }
:deep(.color-blue) { color: #89b4fa; }
:deep(.color-magenta) { color: #cba6f7; }
:deep(.color-cyan) { color: #94e2d5; }
:deep(.bold) { font-weight: 700; }
:deep(.underline) { text-decoration: underline; }

/* Formatowanie specjalne */
:deep(.progress-percent) {
  color: #89b4fa;
  font-weight: 600;
  background: rgba(137, 180, 250, 0.1);
  padding: 0 2px;
  border-radius: 2px;
}

:deep(.size) {
  color: #a6e3a1;
  font-weight: 500;
}

:deep(.speed) {
  color: #f9e2af;
  font-weight: 500;
}

/* Animacje */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

/* Responsive */
@media (max-width: 768px) {
  .terminal-container {
    height: 70vh;
    font-size: 12px;
  }
  
  .terminal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .terminal-footer {
    flex-direction: column;
    gap: 12px;
    
    .terminal-stats {
      width: 100%;
      justify-content: space-around;
    }
    
    .terminal-actions {
      width: 100%;
      justify-content: center;
    }
  }
  
  .terminal-stats .stat-item .current-package {
    max-width: 150px;
  }
}
</style>