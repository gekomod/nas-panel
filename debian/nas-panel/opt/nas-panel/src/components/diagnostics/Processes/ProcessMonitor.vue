<template>
  <div class="process-monitor" :class="{ 'dark': isDark }">
    <!-- Header -->
    <div class="monitor-header">
      <div class="header-left">
        <h1>
          <el-icon><Icon icon="mdi:chart-box" /></el-icon>
          {{ $t('processMonitor.title') }}
        </h1>
        <p class="subtitle">Monitorowanie procesów systemowych</p>
      </div>
      
      <div class="header-right">
        <el-button-group>
          <el-button 
            @click="toggleTheme"
            :icon="themeIcon"
            circle
            size="large"
            class="theme-toggle"
          />
          <el-input
            v-model="searchQuery"
            :placeholder="$t('processMonitor.searchPlaceholder')"
            clearable
            class="search-input"
            size="large"
            @keyup.enter="refreshProcesses"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-button 
            type="primary"
            @click="refreshProcesses" 
            :loading="loading"
            size="large"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            {{ $t('processMonitor.refresh') }}
          </el-button>
          <el-button 
            :type="autoRefresh ? 'warning' : 'default'"
            @click="toggleAutoRefresh"
            size="large"
          >
            <el-icon>
              <Icon :icon="autoRefresh ? 'mdi:pause' : 'mdi:play'" />
            </el-icon>
            {{ autoRefresh ? 'Pauza' : 'Auto' }}
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon total"><Icon icon="mdi:server" /></el-icon>
          <div class="stat-info">
            <div class="stat-value">{{ filteredProcesses.length }}</div>
            <div class="stat-label">Procesy</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon error"><Icon icon="mdi:cpu" /></el-icon>
          <div class="stat-info">
            <div class="stat-value">{{ highCpuCount }}</div>
            <div class="stat-label">Wysokie CPU</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon warning"><Icon icon="mdi:memory" /></el-icon>
          <div class="stat-info">
            <div class="stat-value">{{ highMemoryCount }}</div>
            <div class="stat-label">Wysoka pamięć</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon running"><Icon icon="mdi:check-circle" /></el-icon>
          <div class="stat-info">
            <div class="stat-value">{{ runningCount }}</div>
            <div class="stat-label">Uruchomione</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Processes Table -->
    <el-card class="process-table-card">
      <div class="table-header">
        <h3>
          <el-icon><Icon icon="mdi:format-list-bulleted" /></el-icon>
          Lista procesów
          <el-tag size="small" class="table-count">
            {{ filteredProcesses.length }} z {{ processes.length }}
          </el-tag>
        </h3>
        <div class="table-controls">
          <el-button 
            size="small" 
            @click="sortBy = 'cpu'; sortOrder = 'descending'"
            :type="sortBy === 'cpu' ? 'primary' : 'default'"
          >
            <el-icon><Icon icon="mdi:cpu" /></el-icon>
            Sortuj CPU
          </el-button>
          <el-button 
            size="small" 
            @click="sortBy = 'memory'; sortOrder = 'descending'"
            :type="sortBy === 'memory' ? 'primary' : 'default'"
          >
            <el-icon><Icon icon="mdi:memory" /></el-icon>
            Sortuj pamięć
          </el-button>
        </div>
      </div>

      <el-table
        :data="pagedProcesses"
        style="width: 100%"
        v-loading="loading"
        stripe
        border
        height="calc(100vh - 320px)"
        @sort-change="handleSortChange"
        class="process-table"
      >
        <el-table-column prop="pid" label="PID" width="80" sortable />
        <el-table-column prop="name" label="Nazwa" width="180" sortable show-overflow-tooltip>
          <template #default="{ row }">
            <div class="process-name">
              <el-tooltip :content="getProcessIconTooltip(row.name)" placement="top">
                <el-icon :class="getProcessIconClass(row.name)">
                  <Icon :icon="getProcessIcon(row.name)" />
                </el-icon>
              </el-tooltip>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="user" label="Użytkownik" width="120" sortable>
          <template #default="{ row }">
            <el-tag 
              size="small" 
              :type="row.user === 'root' ? 'danger' : 'info'"
              effect="plain"
            >
              {{ row.user }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cpu" label="CPU %" width="120" sortable>
          <template #default="{ row }">
            <div class="resource-cell">
              <el-progress 
                :percentage="row.cpu" 
                :color="getCpuColor(row.cpu)"
                :show-text="false"
                :stroke-width="12"
                class="resource-bar"
              />
              <div class="resource-value">
                <span :class="{'high-usage': row.cpu > 70}">{{ row.cpu.toFixed(1) }}%</span>
                <el-icon v-if="row.cpu > 70" class="warning-icon">
                  <Icon icon="mdi:alert" />
                </el-icon>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="memory" label="Pamięć %" width="130" sortable>
          <template #default="{ row }">
            <div class="resource-cell">
              <el-progress 
                :percentage="row.memory" 
                :color="getMemoryColor(row.memory)"
                :show-text="false"
                :stroke-width="12"
                class="resource-bar"
              />
              <div class="resource-value">
                <span :class="{'high-usage': row.memory > 80}">{{ row.memory.toFixed(1) }}%</span>
                <el-icon v-if="row.memory > 80" class="warning-icon">
                  <Icon icon="mdi:alert" />
                </el-icon>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="Status" width="100" sortable>
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ formatStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="command" label="Polecenie" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="command-cell">
              <code class="command-text">{{ shortenCommand(row.command) }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Akcje" width="140" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-tooltip content="Szczegóły" placement="top">
                <el-button
                  size="small"
                  type="info"
                  @click="showDetails(row)"
                >
                  <el-icon><Icon icon="mdi:information" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="Zakończ proces" placement="top">
                <el-button
                  size="small"
                  type="danger"
                  @click="killProcess(row.pid)"
                  :disabled="row.protected"
                  :loading="killingProcess === row.pid"
                >
                  <el-icon><Icon icon="mdi:skull" /></el-icon>
                </el-button>
              </el-tooltip>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <div class="footer-info">
          <div class="info-item" v-if="lastRefreshTime">
            <el-icon><Icon icon="mdi:clock-outline" /></el-icon>
            <span>Ostatnie odświeżenie: {{ lastRefreshTime }}</span>
          </div>
          <div class="info-item" v-if="autoRefresh">
            <el-icon><Icon icon="mdi:sync" /></el-icon>
            <span>Auto-refresh aktywny (co 10s)</span>
          </div>
        </div>
        
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredProcesses.length"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next"
          small
          background
          class="pagination"
        />
      </div>
    </el-card>

    <!-- Details Dialog -->
    <el-dialog 
      v-model="detailsDialogVisible" 
      title="Szczegóły procesu" 
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="process-details" v-if="currentProcess.pid">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="PID">
            <strong>{{ currentProcess.pid }}</strong>
            <el-tag 
              size="small" 
              :type="currentProcess.protected ? 'danger' : 'success'"
              class="pid-tag"
            >
              {{ currentProcess.protected ? 'Chroniony' : 'Standardowy' }}
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="Nazwa">
            <div class="detail-name">
              <el-icon :class="getProcessIconClass(currentProcess.name)">
                <Icon :icon="getProcessIcon(currentProcess.name)" />
              </el-icon>
              <span>{{ currentProcess.name }}</span>
            </div>
          </el-descriptions-item>
          
          <el-descriptions-item label="Użytkownik">
            <el-tag 
              size="small" 
              :type="currentProcess.user === 'root' ? 'danger' : 'info'"
            >
              {{ currentProcess.user }}
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="Status">
            <el-tag :type="getStatusType(currentProcess.status)" size="small">
              {{ formatStatus(currentProcess.status) }}
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="CPU">
            <div class="resource-detail">
              <el-progress 
                :percentage="currentProcess.cpu" 
                :color="getCpuColor(currentProcess.cpu)"
                :stroke-width="16"
                :text-inside="true"
                class="detail-progress"
              />
              <span class="detail-value">{{ currentProcess.cpu.toFixed(1) }}%</span>
            </div>
          </el-descriptions-item>
          
          <el-descriptions-item label="Pamięć">
            <div class="resource-detail">
              <el-progress 
                :percentage="currentProcess.memory" 
                :color="getMemoryColor(currentProcess.memory)"
                :stroke-width="16"
                :text-inside="true"
                class="detail-progress"
              />
              <span class="detail-value">{{ currentProcess.memory.toFixed(1) }}%</span>
            </div>
          </el-descriptions-item>
          
          <el-descriptions-item label="Polecenie">
            <pre class="command-detail">{{ currentProcess.command }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button 
            type="danger" 
            @click="killProcess(currentProcess.pid)"
            :disabled="currentProcess.protected"
            :loading="killingProcess === currentProcess.pid"
            v-if="currentProcess.pid"
          >
            Zakończ proces
          </el-button>
          <el-button @click="detailsDialogVisible = false">
            Zamknij
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Critical Alerts -->
    <div v-if="criticalAlerts.length > 0" class="alerts-container">
      <el-alert
        v-for="alert in criticalAlerts"
        :key="alert.id"
        :title="alert.title"
        :type="alert.type"
        :closable="true"
        show-icon
        @close="removeAlert(alert.id)"
        class="critical-alert"
      >
        {{ alert.message }}
      </el-alert>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Icon } from '@iconify/vue'

// Theme
const isDark = ref(false)
const themeIcon = computed(() => 
  isDark.value ? 'mdi:weather-sunny' : 'mdi:weather-night'
)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

// State
const loading = ref(false)
const processes = ref([])
const searchQuery = ref('')
const detailsDialogVisible = ref(false)
const currentProcess = ref({})
const autoRefresh = ref(true)
const autoRefreshInterval = ref(null)
const lastRefreshTime = ref('')
const criticalAlerts = ref([])
const killingProcess = ref(null)
const sortBy = ref('cpu')
const sortOrder = ref('descending')
const currentPage = ref(1)
const pageSize = ref(20)

// Computed
const filteredProcesses = computed(() => {
  if (!searchQuery.value.trim()) return processes.value
  
  const query = searchQuery.value.toLowerCase()
  return processes.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.pid.toString().includes(query) ||
    p.user.toLowerCase().includes(query) ||
    p.command.toLowerCase().includes(query)
  )
})

const sortedProcesses = computed(() => {
  const processes = [...filteredProcesses.value]
  
  if (sortBy.value === 'cpu') {
    return processes.sort((a, b) => 
      sortOrder.value === 'descending' ? b.cpu - a.cpu : a.cpu - b.cpu
    )
  }
  
  if (sortBy.value === 'memory') {
    return processes.sort((a, b) => 
      sortOrder.value === 'descending' ? b.memory - a.memory : a.memory - b.memory
    )
  }
  
  if (sortBy.value === 'pid') {
    return processes.sort((a, b) => 
      sortOrder.value === 'descending' ? b.pid - a.pid : a.pid - b.pid
    )
  }
  
  return processes
})

const pagedProcesses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedProcesses.value.slice(start, end)
})

const highCpuCount = computed(() => {
  return processes.value.filter(p => p.cpu > 70).length
})

const highMemoryCount = computed(() => {
  return processes.value.filter(p => p.memory > 80).length
})

const runningCount = computed(() => {
  return processes.value.filter(p => 
    p.status && (
      p.status.toLowerCase().includes('running') || 
      p.status.toLowerCase().includes('r') ||
      p.status === 'R' || p.status === 'S+'
    )
  ).length
})

// Methods
const getCpuColor = (percentage) => {
  if (percentage > 80) return '#f56c6c'
  if (percentage > 50) return '#e6a23c'
  if (percentage > 20) return '#409eff'
  return '#67c23a'
}

const getMemoryColor = (percentage) => {
  if (percentage > 85) return '#f56c6c'
  if (percentage > 60) return '#e6a23c'
  if (percentage > 30) return '#409eff'
  return '#67c23a'
}

const getStatusType = (status) => {
  if (!status) return 'info'
  
  const statusStr = String(status).toLowerCase()
  if (statusStr.includes('running') || statusStr === 'r' || statusStr === 'r+' || statusStr === 's+') return 'success'
  if (statusStr.includes('sleep') || statusStr === 's' || statusStr === 's ') return 'primary'
  if (statusStr.includes('stop') || statusStr === 't' || statusStr.includes('trace')) return 'warning'
  if (statusStr.includes('zombie') || statusStr === 'z') return 'danger'
  return 'info'
}

const formatStatus = (status) => {
  if (!status) return 'Nieznany'
  
  const statusStr = String(status).toLowerCase()
  if (statusStr.includes('running') || statusStr === 'r' || statusStr === 'r+') return 'Uruchomiony'
  if (statusStr.includes('sleep') || statusStr === 's' || statusStr === 's+' || statusStr === 's ') return 'Uśpiony'
  if (statusStr.includes('stop') || statusStr === 't') return 'Zatrzymany'
  if (statusStr.includes('zombie') || statusStr === 'z') return 'Zombie'
  return status
}

const getProcessIcon = (processName) => {
  const name = (processName || '').toLowerCase()
  
  if (name.includes('node') || name.includes('npm') || name.includes('yarn')) return 'mdi:nodejs'
  if (name.includes('python') || name.includes('python3')) return 'mdi:language-python'
  if (name.includes('java') || name.includes('jar')) return 'mdi:language-java'
  if (name.includes('php')) return 'mdi:language-php'
  if (name.includes('docker') || name.includes('dockerd')) return 'mdi:docker'
  if (name.includes('nginx')) return 'mdi:nginx'
  if (name.includes('apache') || name.includes('httpd')) return 'mdi:web'
  if (name.includes('mysql') || name.includes('mariadb')) return 'mdi:database'
  if (name.includes('redis')) return 'mdi:database'
  if (name.includes('postgres')) return 'mdi:database'
  if (name.includes('bash') || name.includes('sh')) return 'mdi:console'
  if (name.includes('systemd')) return 'mdi:application-cog'
  if (name.includes('sshd')) return 'mdi:lock'
  if (name.includes('cron')) return 'mdi:clock'
  
  return 'mdi:cog'
}

const getProcessIconClass = (processName) => {
  const name = (processName || '').toLowerCase()
  
  if (name.includes('node') || name.includes('npm') || name.includes('yarn')) return 'icon-node'
  if (name.includes('python')) return 'icon-python'
  if (name.includes('java')) return 'icon-java'
  if (name.includes('docker')) return 'icon-docker'
  if (name.includes('nginx') || name.includes('apache')) return 'icon-web'
  if (name.includes('mysql') || name.includes('postgres') || name.includes('redis')) return 'icon-database'
  
  return 'icon-default'
}

const getProcessIconTooltip = (processName) => {
  const name = (processName || '').toLowerCase()
  
  if (name.includes('node')) return 'Aplikacja Node.js'
  if (name.includes('python')) return 'Aplikacja Python'
  if (name.includes('java')) return 'Aplikacja Java'
  if (name.includes('docker')) return 'Proces Docker'
  if (name.includes('nginx')) return 'Serwer web Nginx'
  if (name.includes('apache')) return 'Serwer web Apache'
  if (name.includes('mysql')) return 'Baza danych MySQL'
  if (name.includes('postgres')) return 'Baza danych PostgreSQL'
  if (name.includes('redis')) return 'Baza danych Redis'
  if (name.includes('systemd')) return 'Systemd service'
  if (name.includes('sshd')) return 'SSH demon'
  
  return 'Proces systemowy'
}

const shortenCommand = (command) => {
  if (!command) return ''
  if (command.length <= 60) return command
  return command.substring(0, 57) + '...'
}

const fetchProcesses = async () => {
  try {
    loading.value = true
    console.log('Pobieranie listy procesów...')
    
    const response = await axios.get('/api/diagnostics/processes', {
      timeout: 5000,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    
    console.log('Odpowiedź API:', response.data)
    
    // Poprawiona obsługa odpowiedzi - API zwraca bezpośrednio tablicę w data
    let processesData = []
    
    if (Array.isArray(response.data)) {
      // Jeśli API zwraca bezpośrednio tablicę
      processesData = response.data
    } else if (response.data && response.data.processes) {
      // Jeśli API zwraca obiekt z właściwością processes
      processesData = response.data.processes
    } else if (response.data && response.data.success && response.data.processes) {
      // Jeśli API zwraca obiekt z success i processes
      processesData = response.data.processes
    } else {
      console.warn('Nieznany format odpowiedzi API:', response.data)
      throw new Error('Nieznany format odpowiedzi API')
    }
    
    processes.value = processesData.map(p => ({
      pid: parseInt(p.pid) || 0,
      name: p.name || p.comm || 'unknown',
      user: p.user || 'unknown',
      cpu: parseFloat(p.cpu) || 0,
      memory: parseFloat(p.memory) || 0,
      status: p.status || p.stat || 'unknown',
      command: p.command || p.args || '',
      protected: p.protected || p.user === 'root' || (parseInt(p.pid) < 100) || false
    }))
    
    lastRefreshTime.value = new Date().toLocaleTimeString('pl-PL')
    
    // Sprawdź krytyczne procesy
    checkCriticalProcesses()
    
    console.log(`Załadowano ${processes.value.length} procesów`)
    
  } catch (error) {
    console.error('Błąd ładowania procesów:', error)
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      ElMessage.warning('Timeout podczas ładowania procesów')
    } else if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Dane:', error.response.data)
      ElMessage.error(`Błąd API ${error.response.status}: ${error.response.data?.error || 'Unknown error'}`)
    } else {
      ElMessage.error('Błąd ładowania procesów: ' + error.message)
    }
    
    // Fallback: testowe dane
    if (processes.value.length === 0) {
      processes.value = generateTestData()
      ElMessage.warning('Używam danych testowych')
    }
  } finally {
    loading.value = false
  }
}

const checkCriticalProcesses = () => {
  const critical = processes.value.filter(p => p.cpu > 90 || p.memory > 95)
  
  critical.forEach(process => {
    const exists = criticalAlerts.value.some(a => a.pid === process.pid)
    if (!exists) {
      criticalAlerts.value.push({
        id: `process-${process.pid}-${Date.now()}`,
        pid: process.pid,
        title: 'Krytyczne zużycie zasobów',
        message: `Proces ${process.name} (PID: ${process.pid}) zużywa ${process.cpu}% CPU i ${process.memory}% pamięci`,
        type: 'warning'
      })
    }
  })
}

const generateTestData = () => {
  const testProcesses = [
    { pid: 1, name: 'systemd', user: 'root', cpu: 0.5, memory: 0.8, status: 'S', command: '/usr/lib/systemd/systemd --switched-root --system --deserialize 22' },
    { pid: 1234, name: 'nginx', user: 'www-data', cpu: 15.2, memory: 12.5, status: 'S', command: 'nginx: master process /usr/sbin/nginx -g daemon off;' },
    { pid: 1235, name: 'node', user: 'app', cpu: 45.7, memory: 65.3, status: 'R', command: 'node /var/www/app/server.js' },
    { pid: 1236, name: 'python3', user: 'app', cpu: 5.2, memory: 8.1, status: 'S', command: 'python3 /opt/app/main.py' },
    { pid: 1237, name: 'mysqld', user: 'mysql', cpu: 12.8, memory: 32.4, status: 'S', command: '/usr/sbin/mysqld --daemonize --pid-file=/var/run/mysqld/mysqld.pid' },
    { pid: 1238, name: 'docker', user: 'root', cpu: 3.5, memory: 15.7, status: 'S', command: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock' },
    { pid: 1239, name: 'redis', user: 'redis', cpu: 0.8, memory: 5.2, status: 'S', command: '/usr/bin/redis-server 127.0.0.1:6379' },
    { pid: 1240, name: 'sshd', user: 'root', cpu: 0.2, memory: 0.5, status: 'S', command: '/usr/sbin/sshd -D' },
    { pid: 1241, name: 'cron', user: 'root', cpu: 0.1, memory: 0.3, status: 'S', command: '/usr/sbin/cron -f' },
    { pid: 1242, name: 'php-fpm', user: 'www-data', cpu: 8.7, memory: 18.9, status: 'S', command: 'php-fpm: pool www' },
  ]
  
  return testProcesses.map(p => ({
    ...p,
    protected: p.user === 'root' || p.pid < 100,
    cpu: p.cpu,
    memory: p.memory,
    status: p.status
  }))
}

const refreshProcesses = () => {
  fetchProcesses()
}

const killProcess = (pid) => {
  ElMessageBox.confirm(
    `Czy na pewno chcesz zakończyć proces ${pid}?`,
    'Potwierdzenie zakończenia procesu',
    {
      confirmButtonText: 'Zakończ',
      cancelButtonText: 'Anuluj',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    killingProcess.value = pid
    
    try {
      const response = await axios.post('/api/diagnostics/processes/kill', { pid }, {
        timeout: 10000
      })
      
      console.log('Odpowiedź zakończenia procesu:', response.data)
      
      let message = `Proces ${pid} został zakończony`
      if (response.data && response.data.message) {
        message = response.data.message
      }
      
      ElMessage.success(message)
      
      // Usuń proces z listy
      processes.value = processes.value.filter(p => p.pid !== pid)
      
      // Usuń alerty dla tego procesu
      criticalAlerts.value = criticalAlerts.value.filter(a => a.pid !== pid)
      
      if (currentProcess.value.pid === pid) {
        detailsDialogVisible.value = false
        currentProcess.value = {}
      }
      
      // Odśwież listę po 2 sekundach
      setTimeout(() => {
        fetchProcesses()
      }, 2000)
      
    } catch (error) {
      console.error('Błąd kończenia procesu:', error)
      
      let errorMessage = 'Błąd podczas kończenia procesu'
      if (error.response?.data?.message) {
        errorMessage += `: ${error.response.data.message}`
      } else if (error.response?.data?.error) {
        errorMessage += `: ${error.response.data.error}`
      } else if (error.message) {
        errorMessage += `: ${error.message}`
      }
      
      ElMessage.error(errorMessage)
    } finally {
      killingProcess.value = null
    }
  }).catch(() => {
    // Anulowano
    console.log('Anulowano zakończenie procesu')
  })
}

const showDetails = (process) => {
  currentProcess.value = process
  detailsDialogVisible.value = true
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  autoRefreshInterval.value = setInterval(refreshProcesses, 10000) // 10 sekund
  ElNotification({
    title: 'Auto-refresh',
    message: 'Automatyczne odświeżanie włączone (co 10s)',
    type: 'success',
    duration: 2000
  })
}

const stopAutoRefresh = () => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
    autoRefreshInterval.value = null
  }
}

const removeAlert = (id) => {
  criticalAlerts.value = criticalAlerts.value.filter(alert => alert.id !== id)
}

const handleSortChange = ({ prop, order }) => {
  if (prop) {
    sortBy.value = prop
    sortOrder.value = order === 'ascending' ? 'ascending' : 'descending'
  }
}

// Lifecycle
onMounted(() => {
  fetchProcesses()
  lastRefreshTime.value = new Date().toLocaleTimeString('pl-PL')
})

onUnmounted(() => {
  stopAutoRefresh()
})

// Watch dla paginacji
watch(searchQuery, () => {
  currentPage.value = 1
})

watch(sortBy, () => {
  currentPage.value = 1
})
</script>

<style scoped>
/* ... (stylowanie pozostaje bez zmian jak w poprzedniej wersji) ... */
.process-monitor {
  padding: 20px;
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

.process-monitor.dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Header Styles */
.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.dark .subtitle {
  color: #a0a0a0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 240px;
}

/* Stats Cards */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.dark .stat-card {
  background: #2d2d2d;
  border-color: #404040;
}

.dark .stat-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.stat-icon {
  font-size: 32px;
  padding: 12px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-icon.total {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-icon.error {
  background: var(--el-color-error-light-9);
  color: var(--el-color-error);
}

.stat-icon.warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.stat-icon.running {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.dark .stat-label {
  color: #a0a0a0;
}

/* Process Table Card */
.process-table-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
}

.dark .process-table-card {
  background: #2d2d2d;
  border-color: #404040;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dark .table-header {
  border-bottom-color: #404040;
}

.table-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-count {
  margin-left: 8px;
}

.table-controls {
  display: flex;
  gap: 8px;
}

/* Process Table */
.process-table {
  font-size: 13px;
}

.process-table :deep(.el-table__header-wrapper) {
  font-weight: 600;
}

.process-table :deep(.el-table__body tr:hover > td) {
  background-color: var(--el-fill-color-light) !important;
}

.dark .process-table :deep(.el-table__body tr:hover > td) {
  background-color: #3d3d3d !important;
}

.process-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-text {
  font-weight: 500;
}

.icon-node {
  color: #339933;
}

.icon-python {
  color: #3776ab;
}

.icon-java {
  color: #007396;
}

.icon-docker {
  color: #2496ed;
}

.icon-web {
  color: #f16529;
}

.icon-database {
  color: #00758f;
}

.icon-default {
  color: var(--el-text-color-secondary);
}

.resource-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.resource-bar {
  flex: 1;
}

.resource-value {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 50px;
  font-size: 12px;
  font-weight: 600;
}

.high-usage {
  color: var(--el-color-error);
}

.warning-icon {
  color: var(--el-color-error);
  font-size: 14px;
}

.command-cell {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
}

.command-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .command-text {
  background: #3d3d3d;
  color: #a0a0a0;
}

/* Table Footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-light);
  flex-wrap: wrap;
  gap: 16px;
}

.dark .table-footer {
  border-top-color: #404040;
}

.footer-info {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dark .info-item {
  color: #a0a0a0;
}

.pagination {
  margin: 0;
}

/* Process Details */
.process-details {
  padding: 8px 0;
}

.pid-tag {
  margin-left: 8px;
}

.detail-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.resource-detail {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-progress {
  flex: 1;
}

.detail-value {
  min-width: 50px;
  font-weight: 600;
  text-align: right;
}

.command-detail {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.dark .command-detail {
  background: #3d3d3d;
  color: #e0e0e0;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Alerts */
.alerts-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-width: calc(100vw - 40px);
  z-index: 1000;
}

.critical-alert {
  margin-bottom: 12px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Custom Scrollbar */
.command-detail::-webkit-scrollbar,
.process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.command-detail::-webkit-scrollbar-track,
.process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.dark .command-detail::-webkit-scrollbar-track,
.dark .process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-track {
  background: #3d3d3d;
}

.command-detail::-webkit-scrollbar-thumb,
.process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.dark .command-detail::-webkit-scrollbar-thumb,
.dark .process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-thumb {
  background: #555;
}

.command-detail::-webkit-scrollbar-thumb:hover,
.process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

.dark .command-detail::-webkit-scrollbar-thumb:hover,
.dark .process-table :deep(.el-table__body-wrapper)::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Responsive */
@media (max-width: 768px) {
  .process-monitor {
    padding: 16px;
  }
  
  .monitor-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: flex-start;
  }
  
  .search-input {
    width: 100%;
  }
  
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .table-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .table-footer {
    flex-direction: column;
    align-items: stretch;
  }
  
  .dialog-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
  
  .alerts-container {
    width: calc(100vw - 32px);
    right: 16px;
    bottom: 16px;
  }
}

@media (max-width: 480px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }
  
  .table-controls {
    width: 100%;
  }
  
  .table-controls .el-button {
    flex: 1;
  }
}
</style>
