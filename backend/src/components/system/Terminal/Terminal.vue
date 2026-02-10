<template>
  <div class="terminal-dashboard">
    <!-- Compact Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small" :class="{ 'terminal-icon': true }">
            <Icon icon="mdi:console-line" />
          </div>
          <div class="header-text">
            <h2>{{ t('terminal.title') }}</h2>
            <p class="subtitle">{{ t('terminal.subtitle') }}</p>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="header-stats">
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:terminal" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ sessions.length }}</div>
              <div class="stat-label">{{ t('terminal.sessions') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:cpu-64-bit" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ cpuUsage }}%</div>
              <div class="stat-label">{{ t('terminal.cpu') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:memory" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ memoryUsage }}%</div>
              <div class="stat-label">{{ t('terminal.memory') }}</div>
            </div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="header-actions compact">
          <el-button-group>
            <el-button 
              type="primary" 
              size="small"
              @click="createNewSession"
              :disabled="sessions.length >= maxSessions"
            >
              <Icon icon="mdi:plus" width="12" />
              {{ t('terminal.newSession') }}
            </el-button>
            <el-button 
              type="warning" 
              size="small"
              @click="clearAllTerminals"
              :disabled="sessions.length === 0"
            >
              <Icon icon="mdi:trash-can-outline" width="12" />
              {{ t('terminal.clearAll') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Terminal Sessions Container -->
    <el-card class="terminal-sessions-card" shadow="hover">
      <div class="sessions-header">
        <!-- Session Tabs -->
        <div class="session-tabs">
          <div 
            v-for="(session, index) in sessions" 
            :key="session.id"
            :class="['session-tab', { active: activeSessionId === session.id }]"
            @click="switchSession(session.id)"
          >
            <span class="tab-title">
              <Icon icon="mdi:console" width="12" />
              {{ t('terminal.session') }} {{ index + 1 }}
            </span>
            <el-tag 
              v-if="session.status === 'running'" 
              size="mini" 
              type="success" 
              effect="plain"
              class="tab-status"
            >
              {{ t('terminal.running') }}
            </el-tag>
            <el-button 
              size="mini" 
              text 
              circle
              @click.stop="closeSession(session.id)"
              class="tab-close"
            >
              <Icon icon="mdi:close" width="10" />
            </el-button>
          </div>
        </div>

        <!-- Session Actions -->
        <div class="session-actions">
          <el-button-group size="small">
            <el-button 
              type="info" 
              @click="sendCommandToAll('clear')"
              :disabled="sessions.length === 0"
            >
              <Icon icon="mdi:broom" width="12" />
              {{ t('terminal.clearAll') }}
            </el-button>
            <el-button 
              type="success" 
              @click="restartAllSessions"
              :disabled="sessions.length === 0"
            >
              <Icon icon="mdi:restart" width="12" />
              {{ t('terminal.restartAll') }}
            </el-button>
          </el-button-group>
        </div>
      </div>

      <!-- Active Terminal Session -->
      <div v-if="activeSession" class="terminal-container">
        <!-- Terminal Toolbar -->
        <div class="terminal-toolbar">
          <div class="toolbar-left">
            <el-select 
              v-model="selectedShell" 
              size="small" 
              style="width: 120px"
              @change="changeShell(activeSessionId, selectedShell)"
            >
              <el-option 
                v-for="shell in availableShells" 
                :key="shell.value" 
                :label="shell.label" 
                :value="shell.value"
              />
            </el-select>
            
            <el-button-group size="small" style="margin-left: 8px">
              <el-button @click="sendCommand(activeSessionId, 'pwd')">
                <Icon icon="mdi:folder" width="12" />
                PWD
              </el-button>
              <el-button @click="sendCommand(activeSessionId, 'ls -la')">
                <Icon icon="mdi:format-list-bulleted" width="12" />
                LS
              </el-button>
              <el-button @click="sendCommand(activeSessionId, 'df -h')">
                <Icon icon="mdi:harddisk" width="12" />
                DF
              </el-button>
            </el-button-group>
          </div>
          
          <div class="toolbar-right">
            <el-button 
              size="small" 
              type="info" 
              @click="copyTerminalOutput(activeSessionId)"
              :disabled="!activeSession.output"
            >
              <Icon icon="mdi:content-copy" width="12" />
              {{ t('terminal.copy') }}
            </el-button>
            <el-button 
              size="small" 
              type="warning" 
              @click="clearTerminal(activeSessionId)"
            >
              <Icon icon="mdi:broom" width="12" />
              {{ t('terminal.clear') }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="restartSession(activeSessionId)"
            >
              <Icon icon="mdi:restart" width="12" />
              {{ t('terminal.restart') }}
            </el-button>
          </div>
        </div>

        <!-- Terminal Output -->
        <div 
          ref="terminalOutput"
          class="terminal-output"
          @click="focusTerminalInput"
        >
          <div 
            v-for="(line, index) in formattedOutput" 
            :key="index"
            class="terminal-line"
            :class="getLineClasses(line)"
          >
            <span class="line-prefix" v-if="line.type === 'command'">
              <span class="prompt">$</span>
              <span class="cursor">▶</span>
            </span>
            
            <!-- Directory Listing -->
            <div v-if="line.type === 'dir-listing'" class="dir-listing">
              <div class="dir-header" v-if="line.header">
                <span class="dir-header-text">{{ line.header }}</span>
              </div>
              <div class="dir-grid">
                <div 
                  v-for="(item, itemIndex) in line.items" 
                  :key="itemIndex"
                  :class="['dir-item', getFileTypeClass(item)]"
                >
                  <Icon 
                    :icon="getFileIcon(item.name, item.type)" 
                    width="14" 
                    class="file-icon"
                  />
                  <span class="file-name">{{ item.name }}</span>
                  <span v-if="item.permissions" class="file-permissions">{{ item.permissions }}</span>
                  <span v-if="item.size" class="file-size">{{ formatFileSize(item.size) }}</span>
                  <span v-if="item.date" class="file-date">{{ item.date }}</span>
                </div>
              </div>
            </div>
            
            <!-- Table Output (for df, ps, etc.) -->
            <div v-else-if="line.type === 'table'" class="table-output">
              <table class="styled-table">
                <thead>
                  <tr>
                    <th v-for="(header, hIndex) in line.headers" :key="hIndex">{{ header }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIndex) in line.rows" :key="rIndex">
                    <td v-for="(cell, cIndex) in row" :key="cIndex" :class="getCellClass(cell)">
                      <Icon 
                        v-if="cIndex === 0 && line.iconColumn" 
                        :icon="getRowIcon(row)" 
                        width="12"
                        class="row-icon"
                      />
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Process List -->
            <div v-else-if="line.type === 'process-list'" class="process-list">
              <div class="process-header">
                <div v-for="header in line.headers" :key="header" class="process-header-item">
                  {{ header }}
                </div>
              </div>
              <div v-for="process in line.processes" :key="process.pid" class="process-item">
                <div class="process-user">{{ process.user }}</div>
                <div class="process-pid">{{ process.pid }}</div>
                <div class="process-cpu">{{ process.cpu }}%</div>
                <div class="process-mem">{{ process.mem }}%</div>
                <div class="process-command">
                  <Icon :icon="getProcessIcon(process.command)" width="10" />
                  {{ truncateCommand(process.command) }}
                </div>
              </div>
            </div>
            
            <!-- Network Connections -->
            <div v-else-if="line.type === 'network-connections'" class="network-connections">
              <div class="network-item" v-for="conn in line.connections" :key="conn.local + conn.remote">
                <div class="connection-type" :class="conn.type">
                  <Icon :icon="getNetworkIcon(conn.type)" width="12" />
                </div>
                <div class="connection-details">
                  <div class="connection-local">{{ conn.local }}</div>
                  <div class="connection-arrow">→</div>
                  <div class="connection-remote">{{ conn.remote }}</div>
                </div>
                <div class="connection-state" :class="conn.state">
                  {{ conn.state }}
                </div>
              </div>
            </div>
            
            <!-- Regular Text Output -->
            <span v-else-if="line.type === 'text'" class="line-content">
              <span v-html="formatText(line.content)"></span>
            </span>
            
            <!-- Error Output -->
            <span v-else-if="line.type === 'error'" class="line-content error-text">
              <Icon icon="mdi:alert-circle" width="12" />
              {{ line.content }}
            </span>
            
            <!-- Success Output -->
            <span v-else-if="line.type === 'success'" class="line-content success-text">
              <Icon icon="mdi:check-circle" width="12" />
              {{ line.content }}
            </span>
            
            <!-- Default Output -->
            <span v-else class="line-content">
              {{ line.content }}
            </span>
          </div>
          
          <!-- Terminal Input -->
          <div class="terminal-input-line">
            <span class="input-prefix">
              <span class="prompt">$</span>
              <span class="cursor blink">▶</span>
            </span>
            <input
              ref="terminalInput"
              v-model="inputCommand"
              type="text"
              class="terminal-input"
              :placeholder="t('terminal.typeCommand')"
              @keyup.enter="executeCommand"
              @keyup.up="commandHistoryUp"
              @keyup.down="commandHistoryDown"
            />
          </div>
        </div>

        <!-- Terminal Status -->
        <div class="terminal-status">
          <div class="status-left">
            <span class="status-item">
              <Icon icon="mdi:console" width="12" />
              {{ activeSession.shell }}
            </span>
            <span class="status-item">
              <Icon icon="mdi:clock-outline" width="12" />
              {{ formatDuration(activeSession.startTime) }}
            </span>
          </div>
          <div class="status-right">
            <span class="status-item">
              <Icon icon="mdi:format-list-text" width="12" />
              {{ activeSession.output.split('\n').length }} {{ t('terminal.lines') }}
            </span>
            <span class="status-item" :class="getStatusClass(activeSession.status)">
              <Icon :icon="getStatusIcon(activeSession.status)" width="12" />
              {{ t(`terminal.status.${activeSession.status}`) }}
            </span>
          </div>
        </div>
      </div>

      <!-- No Session State -->
      <div v-else class="no-session-state">
        <div class="empty-terminal">
          <Icon icon="mdi:console-network-outline" width="64" />
          <div class="empty-text">
            <h4>{{ t('terminal.noSessionTitle') }}</h4>
            <p>{{ t('terminal.noSessionDescription') }}</p>
            <el-button type="primary" size="small" @click="createNewSession">
              <Icon icon="mdi:plus" width="12" />
              {{ t('terminal.createFirstSession') }}
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Quick Commands Panel -->
    <el-card class="quick-commands-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h3>{{ t('terminal.quickCommands') }}</h3>
          <el-button size="small" text @click="showCommandManager">
            <Icon icon="mdi:cog" width="12" />
          </el-button>
        </div>
      </template>
      
      <div class="quick-commands-grid">
        <el-button 
          v-for="(cmd, index) in quickCommands" 
          :key="index"
          size="small"
          @click="sendCommand(activeSessionId, cmd.command)"
          :disabled="!activeSession"
          class="command-button"
        >
          <Icon :icon="cmd.icon" width="12" />
          {{ cmd.label }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// API configuration
const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3001}`,
  timeout: 30000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// Reactive state
const sessions = ref([])
const activeSessionId = ref(null)
const inputCommand = ref('')
const commandHistory = ref([])
const historyIndex = ref(-1)
const cpuUsage = ref(0)
const memoryUsage = ref(0)
const selectedShell = ref('bash')
const terminalInput = ref(null)
const terminalOutput = ref(null)

// Constants
const maxSessions = 5
const availableShells = [
  { label: 'Bash', value: 'bash' },
  { label: 'Zsh', value: 'zsh' },
  { label: 'Sh', value: 'sh' },
  { label: 'Fish', value: 'fish' }
]

const quickCommands = [
  { label: t('terminal.commands.systemInfo'), command: 'uname -a', icon: 'mdi:information-outline' },
  { label: t('terminal.commands.diskUsage'), command: 'df -h', icon: 'mdi:harddisk' },
  { label: t('terminal.commands.memoryInfo'), command: 'free -h', icon: 'mdi:memory' },
  { label: t('terminal.commands.processList'), command: 'ps aux | head -20', icon: 'mdi:format-list-bulleted' },
  { label: t('terminal.commands.networkStats'), command: 'ss -tuln', icon: 'mdi:network' },
  { label: t('terminal.commands.serviceStatus'), command: 'systemctl list-units --type=service | head -20', icon: 'mdi:server' },
  { label: t('terminal.commands.logsTail'), command: 'tail -20 /var/log/syslog', icon: 'mdi:file-document-outline' },
  { label: t('terminal.commands.packageUpdates'), command: 'apt list --upgradable 2>/dev/null | head -10', icon: 'mdi:package-up' }
]

// Computed properties
const activeSession = computed(() => {
  return sessions.value.find(s => s.id === activeSessionId.value)
})

const formattedOutput = computed(() => {
  if (!activeSession.value) return []
  
  const lines = activeSession.value.output.split('\n')
  const formattedLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) {
      formattedLines.push({ type: 'empty', content: '' })
      continue
    }
    
    // Command line
    if (line.startsWith('$ ')) {
      formattedLines.push({ 
        type: 'command', 
        content: line.substring(2),
        raw: line
      })
      continue
    }
    
    // Directory listing (ls -la)
    if (line.startsWith('razem ') || line.includes('total ')) {
      const dirItems = []
      let header = line
      
      // Collect all directory items
      for (let j = i + 1; j < lines.length; j++) {
        const itemLine = lines[j]
        if (!itemLine.trim() || itemLine.startsWith('$ ')) break
        
        const item = parseLsLine(itemLine)
        if (item) {
          dirItems.push(item)
        }
      }
      
      if (dirItems.length > 0) {
        formattedLines.push({
          type: 'dir-listing',
          header: header,
          items: dirItems,
          raw: line
        })
        i += dirItems.length
        continue
      }
    }
    
    // Directory listing simple (ls)
    if (line.match(/^[\w\-\.]+\s+[\w\-\.]+\s+[\w\-\.]+/) && !line.includes(':')) {
      const items = line.split(/\s+/).filter(item => item.trim())
      if (items.length > 2 && items.every(item => !item.includes('/'))) {
        const dirItems = items.map(name => ({
          name,
          type: getFileTypeByName(name),
          icon: getFileIcon(name, getFileTypeByName(name))
        }))
        
        formattedLines.push({
          type: 'dir-listing',
          items: dirItems,
          raw: line
        })
        continue
      }
    }
    
    // df -h output
    if (line.includes('Filesystem') && line.includes('Size') && line.includes('Use%')) {
      const tableRows = []
      const headers = ['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted']
      
      // Collect table rows
      for (let j = i + 1; j < lines.length; j++) {
        const tableLine = lines[j]
        if (!tableLine.trim() || tableLine.startsWith('$ ')) break
        
        const row = tableLine.split(/\s+/).filter(cell => cell.trim())
        if (row.length >= 6) {
          tableRows.push(row)
        }
      }
      
      if (tableRows.length > 0) {
        formattedLines.push({
          type: 'table',
          headers: headers,
          rows: tableRows,
          iconColumn: true,
          raw: line
        })
        i += tableRows.length
        continue
      }
    }
    
    // Process list (ps aux)
    if (line.includes('USER') && line.includes('PID') && line.includes('%CPU')) {
      const processes = []
      const headers = ['USER', 'PID', '%CPU', '%MEM', 'COMMAND']
      
      for (let j = i + 1; j < lines.length; j++) {
        const procLine = lines[j]
        if (!procLine.trim() || procLine.startsWith('$ ')) break
        
        const parts = procLine.split(/\s+/).filter(p => p.trim())
        if (parts.length >= 11) {
          processes.push({
            user: parts[0],
            pid: parts[1],
            cpu: parts[2],
            mem: parts[3],
            command: parts.slice(10).join(' ')
          })
        }
      }
      
      if (processes.length > 0) {
        formattedLines.push({
          type: 'process-list',
          headers: headers,
          processes: processes.slice(0, 10),
          raw: line
        })
        i += processes.length
        continue
      }
    }
    
    // Network connections (ss -tuln)
    if (line.includes('State') && line.includes('Recv-Q') && line.includes('Send-Q')) {
      const connections = []
      
      for (let j = i + 1; j < lines.length; j++) {
        const connLine = lines[j]
        if (!connLine.trim() || connLine.startsWith('$ ')) break
        
        const parts = connLine.split(/\s+/).filter(p => p.trim())
        if (parts.length >= 5 && parts[0] !== 'State') {
          connections.push({
            state: parts[0],
            local: parts[4],
            remote: parts[5] || '-',
            type: getConnectionType(parts[4])
          })
        }
      }
      
      if (connections.length > 0) {
        formattedLines.push({
          type: 'network-connections',
          connections: connections,
          raw: line
        })
        i += connections.length
        continue
      }
    }
    
    // Error messages
    if (line.toLowerCase().includes('error') || 
        line.toLowerCase().includes('failed') || 
        line.toLowerCase().includes('permission denied') ||
        line.startsWith('bash:')) {
      formattedLines.push({
        type: 'error',
        content: line,
        raw: line
      })
      continue
    }
    
    // Success messages
    if (line.toLowerCase().includes('success') || 
        line.toLowerCase().includes('ok') ||
        line.toLowerCase().includes('completed')) {
      formattedLines.push({
        type: 'success',
        content: line,
        raw: line
      })
      continue
    }
    
    // Info messages
    if (line.toLowerCase().includes('warning') || 
        line.toLowerCase().includes('info') ||
        line.startsWith('Note:')) {
      formattedLines.push({
        type: 'info',
        content: line,
        raw: line
      })
      continue
    }
    
    // Default text output
    formattedLines.push({
      type: 'text',
      content: line,
      raw: line
    })
  }
  
  return formattedLines
})

// Helper functions
const parseLsLine = (line) => {
  const match = line.match(/^([dl\-])([rwx\-]{9})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+\s+\S+\s+\S+)\s+(.+)$/)
  if (match) {
    const [, type, permissions, , , , size, date, name] = match
    return {
      name,
      type: type === 'd' ? 'directory' : type === 'l' ? 'link' : 'file',
      permissions,
      size: parseInt(size),
      date,
      icon: getFileIcon(name, type === 'd' ? 'directory' : 'file')
    }
  }
  return null
}

const getFileTypeByName = (name) => {
  if (name.includes('.')) {
    const ext = name.split('.').pop().toLowerCase()
    const fileTypes = {
      'js': 'javascript',
      'ts': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'vue': 'vue',
      'py': 'python',
      'md': 'markdown',
      'txt': 'text',
      'sh': 'shell',
      'jpg': 'image',
      'png': 'image',
      'svg': 'image',
      'ico': 'image',
      'gitignore': 'config',
      'env': 'config',
      'lock': 'lock'
    }
    return fileTypes[ext] || 'file'
  }
  return 'file'
}

const getFileIcon = (name, type) => {
  const icons = {
    'directory': 'mdi:folder',
    'link': 'mdi:link',
    'javascript': 'mdi:language-javascript',
    'typescript': 'mdi:language-typescript',
    'json': 'mdi:code-json',
    'html': 'mdi:language-html5',
    'css': 'mdi:language-css3',
    'vue': 'mdi:vuejs',
    'python': 'mdi:language-python',
    'markdown': 'mdi:language-markdown',
    'text': 'mdi:text-box',
    'shell': 'mdi:bash',
    'image': 'mdi:image',
    'config': 'mdi:cog',
    'lock': 'mdi:lock',
    'file': 'mdi:file'
  }
  
  if (name === 'package.json') return 'mdi:package-variant'
  if (name === 'README.md') return 'mdi:book-open'
  if (name === 'Dockerfile') return 'mdi:docker'
  if (name === 'docker-compose.yml') return 'mdi:docker'
  if (name === '.gitignore') return 'mdi:git'
  if (name === '.env') return 'mdi:key'
  if (name === 'node_modules') return 'mdi:folder-cog'
  if (name === 'dist') return 'mdi:folder-zip'
  if (name === 'src') return 'mdi:folder-code'
  if (name === 'public') return 'mdi:folder-public'
  
  return icons[type] || 'mdi:file'
}

const getFileTypeClass = (item) => {
  return `file-type-${item.type}`
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const getConnectionType = (address) => {
  if (address.includes(':22')) return 'ssh'
  if (address.includes(':80')) return 'http'
  if (address.includes(':443')) return 'https'
  if (address.includes(':3306')) return 'mysql'
  if (address.includes(':5432')) return 'postgres'
  if (address.includes(':6379')) return 'redis'
  return 'tcp'
}

const getNetworkIcon = (type) => {
  const icons = {
    'ssh': 'mdi:lock',
    'http': 'mdi:web',
    'https': 'mdi:lock',
    'mysql': 'mdi:database',
    'postgres': 'mdi:database',
    'redis': 'mdi:database',
    'tcp': 'mdi:connection'
  }
  return icons[type] || 'mdi:connection'
}

const getProcessIcon = (command) => {
  if (command.includes('node')) return 'mdi:nodejs'
  if (command.includes('python')) return 'mdi:language-python'
  if (command.includes('java')) return 'mdi:language-java'
  if (command.includes('docker')) return 'mdi:docker'
  if (command.includes('nginx')) return 'mdi:nginx'
  if (command.includes('systemd')) return 'mdi:cogs'
  if (command.includes('bash')) return 'mdi:bash'
  return 'mdi:cog'
}

const truncateCommand = (command) => {
  if (command.length > 40) {
    return command.substring(0, 37) + '...'
  }
  return command
}

const getRowIcon = (row) => {
  const filesystem = row[0] || ''
  if (filesystem.includes('/dev/')) return 'mdi:harddisk'
  if (filesystem.includes('tmpfs')) return 'mdi:memory'
  if (filesystem.includes('overlay')) return 'mdi:layers'
  return 'mdi:folder'
}

const getCellClass = (cell) => {
  if (cell.includes('%') && parseFloat(cell) > 80) return 'cell-warning'
  if (cell.includes('%') && parseFloat(cell) > 95) return 'cell-danger'
  if (cell === 'LISTEN') return 'cell-listen'
  if (cell === 'ESTAB') return 'cell-estab'
  return ''
}

const getLineClasses = (line) => {
  const classes = []
  if (line.type === 'command') classes.push('command-line')
  if (line.type === 'error') classes.push('error-line')
  if (line.type === 'success') classes.push('success-line')
  if (line.type === 'info') classes.push('info-line')
  return classes
}

const formatText = (text) => {
  // Najpierw usuń ewentualne już istniejące znaczniki HTML
  let formatted = text.replace(/<[^>]*>/g, '')
  
  // Highlight URLs (ale tylko pełne URL-e, nie fragmenty)
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g, 
    '<span class="highlight-url">$1</span>'
  )
  
  // Highlight pełnych adresów IP (nie fragmentów)
  formatted = formatted.replace(
    /(\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b)/g,
    '<span class="highlight-ip">$1</span>'
  )
  
  // Highlight ścieżek (ale tylko pełnych ścieżek, nie fragmentów)
  formatted = formatted.replace(
    /(\/(?:[^/\s]+\/)*[^/\s]+)/g,
    '<span class="highlight-path">$1</span>'
  )
  
  // Highlight samodzielnych liczb (nie będących częścią innych wyrazów)
  formatted = formatted.replace(
    /(\b\d+\b(?!\.\d))/g, // Nie łap liczb z kropkami jak w wersjach
    '<span class="highlight-number">$1</span>'
  )
  
  // Special handling for version numbers like "6.12.57"
  formatted = formatted.replace(
    /(\b\d+\.\d+\.\d+\b)/g,
    '<span class="highlight-version">$1</span>'
  )
  
  // Special handling for dates like "2025-11-05"
  formatted = formatted.replace(
    /(\b\d{4}-\d{2}-\d{2}\b)/g,
    '<span class="highlight-date">$1</span>'
  )
  
  // Special handling for percentages
  formatted = formatted.replace(
    /(\b\d+%\b)/g,
    '<span class="highlight-percent">$1</span>'
  )
  
  return formatted
}

// Main methods
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const createNewSession = async () => {
  if (sessions.value.length >= maxSessions) {
    ElMessage.warning(t('terminal.maxSessionsReached', { max: maxSessions }))
    return
  }

  try {
    const response = await api.post('/terminal/sessions', {
      shell: selectedShell.value
    })

    const newSession = {
      id: response.data.sessionId,
      shell: selectedShell.value,
      output: `$ ${t('terminal.sessionStarted', { shell: selectedShell.value })}\n$ ${response.data.initialPath}\n`,
      status: 'running',
      startTime: Date.now(),
      commandHistory: []
    }

    sessions.value.push(newSession)
    activeSessionId.value = newSession.id
    
    ElNotification.success({
      title: t('terminal.sessionCreated'),
      message: t('terminal.sessionReady'),
      position: 'bottom-right'
    })

    focusTerminalInput()
  } catch (err) {
    ElMessage.error(t('terminal.createFailed', { 
      error: err.response?.data?.message || err.message 
    }))
  }
}

const switchSession = (sessionId) => {
  activeSessionId.value = sessionId
  focusTerminalInput()
}

const closeSession = async (sessionId) => {
  try {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session && session.status === 'running') {
      await api.delete(`/terminal/sessions/${sessionId}`)
    }

    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : null
    }

    ElMessage.success(t('terminal.sessionClosed'))
  } catch (err) {
    console.error('Failed to close session:', err)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
  }
}

const executeCommand = async () => {
  if (!inputCommand.value.trim() || !activeSession.value) return

  const command = inputCommand.value.trim()
  inputCommand.value = ''
  
  commandHistory.value.unshift(command)
  if (commandHistory.value.length > 50) commandHistory.value.pop()
  historyIndex.value = -1

  activeSession.value.output += `$ ${command}\n`
  
  try {
    const response = await api.post(`/terminal/sessions/${activeSessionId.value}/execute`, {
      command: command
    })

    if (response.data.output) {
      activeSession.value.output += response.data.output + '\n'
    }
    
    if (response.data.exitCode !== 0) {
      activeSession.value.output += `${t('terminal.commandExited')}: ${response.data.exitCode}\n`
    }

    nextTick(() => {
      if (terminalOutput.value) {
        terminalOutput.value.scrollTop = terminalOutput.value.scrollHeight
      }
    })
  } catch (err) {
    activeSession.value.output += `${t('terminal.error')}: ${err.response?.data?.message || err.message}\n`
    activeSession.value.status = 'error'
  }

  focusTerminalInput()
}

const sendCommand = async (sessionId, command) => {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return

  inputCommand.value = command
  await nextTick()
  executeCommand()
}

const sendCommandToAll = (command) => {
  sessions.value.forEach(session => {
    if (session.status === 'running') {
      sendCommand(session.id, command)
    }
  })
}

const clearTerminal = (sessionId) => {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.output = ''
    ElMessage.success(t('terminal.cleared'))
  }
}

const clearAllTerminals = () => {
  ElMessageBox.confirm(
    t('terminal.confirmClearAll'),
    t('common.warning'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(() => {
    sessions.value.forEach(session => {
      session.output = ''
    })
    ElMessage.success(t('terminal.allCleared'))
  }).catch(() => {})
}

const restartSession = async (sessionId) => {
  try {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) return

    await api.post(`/terminal/sessions/${sessionId}/restart`)
    session.output = `$ ${t('terminal.sessionRestartedMessage')}\n`
    session.status = 'running'
    
    ElMessage.success(t('terminal.sessionRestarted'))
  } catch (err) {
    ElMessage.error(t('terminal.restartFailed'))
  }
}

const restartAllSessions = async () => {
  try {
    for (const session of sessions.value) {
      if (session.status === 'running') {
        await restartSession(session.id)
      }
    }
  } catch (err) {
    console.error('Failed to restart all sessions:', err)
  }
}

const changeShell = async (sessionId, newShell) => {
  try {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) return

    await api.post(`/terminal/sessions/${sessionId}/shell`, {
      shell: newShell
    })
    
    session.shell = newShell
    session.output += `$ ${t('terminal.shellChangedMessage', { shell: newShell })}\n`
    
    ElMessage.success(t('terminal.shellChanged', { shell: newShell }))
  } catch (err) {
    ElMessage.error(t('terminal.shellChangeFailed'))
  }
}

const copyTerminalOutput = (sessionId) => {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session || !session.output) return

  navigator.clipboard.writeText(session.output)
    .then(() => {
      ElMessage.success(t('terminal.outputCopied'))
    })
    .catch(() => {
      ElMessage.error(t('terminal.copyFailed'))
    })
}

const focusTerminalInput = () => {
  nextTick(() => {
    if (terminalInput.value) {
      terminalInput.value.focus()
    }
  })
}

const commandHistoryUp = () => {
  if (commandHistory.value.length === 0) return
  
  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++
  }
  
  if (historyIndex.value >= 0 && historyIndex.value < commandHistory.value.length) {
    inputCommand.value = commandHistory.value[historyIndex.value]
  }
}

const commandHistoryDown = () => {
  if (historyIndex.value <= 0) {
    historyIndex.value = -1
    inputCommand.value = ''
    return
  }
  
  historyIndex.value--
  inputCommand.value = commandHistory.value[historyIndex.value]
}

const formatDuration = (startTime) => {
  const seconds = Math.floor((Date.now() - startTime) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

const getStatusClass = (status) => {
  const classes = {
    'running': 'status-running',
    'idle': 'status-idle',
    'error': 'status-error',
    'terminated': 'status-terminated'
  }
  return classes[status] || ''
}

const getStatusIcon = (status) => {
  const icons = {
    'running': 'mdi:check-circle',
    'idle': 'mdi:sleep',
    'error': 'mdi:alert-circle',
    'terminated': 'mdi:close-circle'
  }
  return icons[status] || 'mdi:help-circle'
}

const showCommandManager = () => {
  ElMessage.info(t('terminal.commandManagerComingSoon'))
}

const fetchSystemStats = async () => {
  try {
    const response = await api.get('/terminal/stats')
    cpuUsage.value = response.data.cpu || 0
    memoryUsage.value = response.data.memory || 0
  } catch (err) {
    console.error('Failed to fetch system stats:', err)
  }
}

// Lifecycle hooks
onMounted(() => {
  createNewSession()
  
  fetchSystemStats()
  const statsInterval = setInterval(fetchSystemStats, 5000)
  
  focusTerminalInput()
  
  onBeforeUnmount(() => {
    clearInterval(statsInterval)
    
    sessions.value.forEach(session => {
      closeSession(session.id).catch(() => {})
    })
  })
})
</script>

<style scoped>
.terminal-dashboard {
  padding: 16px;
  min-height: 100vh;
}

:root[class="dark"] .terminal-dashboard {
  
}

/* Header Styles */
.dashboard-header.compact {
  border-radius: 12px;
  margin-bottom: 16px;
}

.dashboard-header.compact .header-content {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.header-icon.small {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.header-icon.small.terminal-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.header-text {
  flex: 1;
  min-width: 0;
}

.header-text h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[class="dark"] .header-text h2 {
  color: #e4e7ed;
}

.header-text .subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
}

:root[class="dark"] .header-text .subtitle {
  color: #a0aec0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 0 20px;
  flex: 1;
  justify-content: center;
}

.stat-item.small {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.stat-item.small .stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
  color: #10b981;
}

:root[class="dark"] .stat-item.small .stat-icon {
  background: #2d3748;
}

.stat-item.small .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[class="dark"] .stat-item.small .stat-value {
  color: #e4e7ed;
}

.stat-item.small .stat-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

:root[class="dark"] .stat-item.small .stat-label {
  color: #a0aec0;
}

.header-actions.compact {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Sessions Card */
.terminal-sessions-card {
  border-radius: 12px;
  margin-bottom: 16px;
}

.sessions-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

:root[class="dark"] .sessions-header {
  border-bottom-color: #4a5568;
}

.session-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
}

.session-tab {
  padding: 8px 12px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  min-width: 120px;
}

:root[class="dark"] .session-tab {
  background: #2d3748;
  border-color: #4a5568;
}

.session-tab:hover {
  background: #e4e7ed;
}

:root[class="dark"] .session-tab:hover {
  background: #4a5568;
}

.session-tab.active {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.tab-title {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-status {
  font-size: 10px;
}

.tab-close {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tab-close:hover {
  opacity: 1;
}

.session-actions {
  flex-shrink: 0;
}

/* Terminal Container */
.terminal-container {
  padding: 16px;
}

.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

:root[class="dark"] .terminal-toolbar {
  background: #2d3748;
  border-color: #4a5568;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Terminal Output */
.terminal-output {
  background: #1a1a1a;
  color: #f0f0f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 16px;
  border-radius: 8px;
  min-height: 400px;
  max-height: 600px;
  overflow-y: auto;
  margin-bottom: 12px;
  border: 1px solid #333;
}

:root[data-theme="dark"] .terminal-output {
  background: #0a0a0a;
  border-color: #444;
}

.terminal-line {
  margin-bottom: 4px;
  padding: 2px 0;
}

.command-line {
  color: #4fc3f7;
  font-weight: bold;
}

.error-line {
  color: #ff6b6b;
}

.success-line {
  color: #69f0ae;
}

.info-line {
  color: #ffd54f;
}

.line-prefix {
  color: #ffd54f;
  margin-right: 8px;
}

.prompt {
  font-weight: bold;
}

.cursor {
  margin-left: 4px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor.blink {
  animation: blink 1s infinite;
}

.line-content {
  flex: 1;
}

/* Directory Listing */
.dir-listing {
  margin: 8px 0;
}

.dir-header {
  color: #909399;
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.dir-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.dir-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
}

.dir-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.file-type-directory {
  color: #4fc3f7;
}

.file-type-link {
  color: #ffd54f;
}

.file-type-javascript {
  color: #f0db4f;
}

.file-type-typescript {
  color: #3178c6;
}

.file-type-json {
  color: #f5de19;
}

.file-type-html {
  color: #e44d26;
}

.file-type-css {
  color: #264de4;
}

.file-type-vue {
  color: #42b883;
}

.file-type-python {
  color: #3776ab;
}

.file-icon {
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-permissions {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}

.file-size {
  font-size: 11px;
  color: #69f0ae;
  font-family: monospace;
}

.file-date {
  font-size: 11px;
  color: #bb86fc;
}

/* Table Output */
.table-output {
  margin: 12px 0;
  overflow-x: auto;
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.styled-table thead {
  background: rgba(79, 195, 247, 0.1);
}

.styled-table th {
  padding: 8px 12px;
  text-align: left;
  color: #4fc3f7;
  font-weight: 600;
  border-bottom: 2px solid #333;
}

.styled-table td {
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.styled-table tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.row-icon {
  margin-right: 6px;
  vertical-align: middle;
}

.cell-warning {
  color: #ffb74d !important;
  font-weight: bold;
}

.cell-danger {
  color: #ff6b6b !important;
  font-weight: bold;
}

.cell-listen {
  color: #69f0ae !important;
}

.cell-estab {
  color: #4fc3f7 !important;
}

/* Process List */
.process-list {
  margin: 12px 0;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}

.process-header {
  display: grid;
  grid-template-columns: 80px 70px 60px 60px 1fr;
  background: rgba(79, 195, 247, 0.1);
  padding: 8px 12px;
  font-weight: 600;
  color: #4fc3f7;
  border-bottom: 1px solid #333;
}

.process-item {
  display: grid;
  grid-template-columns: 80px 70px 60px 60px 1fr;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  align-items: center;
}

.process-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.process-item:last-child {
  border-bottom: none;
}

.process-user {
  color: #bb86fc;
  font-weight: 500;
}

.process-pid {
  color: #69f0ae;
  font-family: monospace;
}

.process-cpu, .process-mem {
  color: #ffd54f;
  font-family: monospace;
}

.process-command {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Network Connections */
.network-connections {
  margin: 12px 0;
}

.network-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.network-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.connection-type {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(79, 195, 247, 0.1);
  border-radius: 6px;
  color: #4fc3f7;
}

.connection-type.ssh {
  background: rgba(255, 193, 7, 0.1);
  color: #ffd54f;
}

.connection-type.http {
  background: rgba(76, 175, 80, 0.1);
  color: #69f0ae;
}

.connection-details {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.connection-local, .connection-remote {
  font-family: monospace;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-arrow {
  color: #909399;
  font-size: 12px;
}

.connection-state {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.connection-state.LISTEN {
  background: rgba(76, 175, 80, 0.2);
  color: #69f0ae;
}

.connection-state.ESTAB {
  background: rgba(33, 150, 243, 0.2);
  color: #4fc3f7;
}

.connection-state.CLOSE_WAIT {
  background: rgba(255, 152, 0, 0.2);
  color: #ffb74d;
}

/* Text Formatting */
.highlight-url {
  color: #bb86fc;
  text-decoration: underline;
  cursor: pointer;
}

.highlight-url:hover {
  color: #9c6bff;
}

.highlight-ip {
  color: #4fc3f7;
  font-family: monospace;
  background: rgba(79, 195, 247, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}

.highlight-number {
  color: #ffd54f;
  font-family: monospace;
}

.highlight-path {
  color: #69f0ae;
  font-family: monospace;
}

.error-text, .success-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Terminal Input */
.terminal-input-line {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.input-prefix {
  color: #ffd54f;
  margin-right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #f0f0f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  outline: none;
  padding: 4px 0;
}

.terminal-input::placeholder {
  color: #666;
}

/* Terminal Status */
.terminal-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  font-size: 12px;
}

:root[class="dark"] .terminal-status {
  background: #2d3748;
  border-color: #4a5568;
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #606266;
}

:root[class="dark"] .status-item {
  color: #a0aec0;
}

.status-running {
  color: #67c23a;
}

.status-idle {
  color: #e6a23c;
}

.status-error {
  color: #f56c6c;
}

.status-terminated {
  color: #909399;
}

/* No Session State */
.no-session-state {
  padding: 60px 20px;
  text-align: center;
}

.empty-terminal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-terminal .empty-text h4 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

:root[class="dark"] .empty-terminal .empty-text h4 {
  color: #e4e7ed;
}

.empty-terminal .empty-text p {
  margin: 0 0 16px;
  font-size: 14px;
  color: #909399;
}

:root[class="dark"] .empty-terminal .empty-text p {
  color: #a0aec0;
}

/* Quick Commands Card */
.quick-commands-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.quick-commands-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  padding: 8px 0;
}

.command-button {
  justify-content: start;
  padding: 8px 12px;
}

.highlight-version {
  color: #bb86fc;
  font-weight: bold;
  font-family: monospace;
}

.highlight-date {
  color: #4fc3f7;
  font-family: monospace;
}

.highlight-percent {
  color: #69f0ae;
  font-weight: bold;
  font-family: monospace;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-stats {
    order: 2;
    justify-content: space-around;
    gap: 12px;
  }
  
  .stat-item.small {
    flex-direction: column;
    text-align: center;
    gap: 4px;
  }
  
  .header-actions.compact {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  
  .sessions-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .session-tabs {
    order: 2;
    margin-top: 12px;
  }
  
  .quick-commands-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

@media (max-width: 768px) {
  .terminal-dashboard {
    padding: 12px;
  }
  
  .header-stats {
    display: none;
  }
  
  .terminal-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .toolbar-left, .toolbar-right {
    justify-content: center;
  }
  
  .terminal-status {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .status-left, .status-right {
    justify-content: space-between;
  }
  
  .dir-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  
  .process-header,
  .process-item {
    grid-template-columns: 70px 60px 50px 50px 1fr;
    font-size: 11px;
  }
  
  .styled-table {
    font-size: 11px;
  }
  
  .styled-table th,
  .styled-table td {
    padding: 6px 8px;
  }
}

@media (max-width: 480px) {
  .session-tabs {
    flex-direction: column;
  }
  
  .session-tab {
    width: 100%;
  }
  
  .quick-commands-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .dir-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .process-header,
  .process-item {
    grid-template-columns: 60px 50px 40px 40px 1fr;
    font-size: 10px;
    padding: 4px 8px;
  }
  
  .network-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .connection-details {
    width: 100%;
    justify-content: space-between;
  }
  
  .connection-state {
    align-self: flex-start;
  }
}
</style>
