<template>
  <div class="remote-logs-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:server-network" />
          </div>
          <div class="header-text">
            <h1>{{ $t('systemLogs.remoteLogs') }}</h1>
            <p class="subtitle">Konfiguracja zdalnego wysyłania logów systemowych</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Configuration Card -->
    <el-card class="config-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:cog-outline" />
            Konfiguracja Syslog
          </h2>
          <el-tag :type="syslogConfig.enabled ? 'success' : 'info'" size="small">
            {{ syslogConfig.enabled ? 'Aktywny' : 'Nieaktywny' }}
          </el-tag>
        </div>
      </template>

      <div class="config-form">
        <el-form :model="syslogConfig" label-position="top">
          <el-form-item :label="$t('systemLogs.enableRemote')">
            <div class="switch-container">
              <el-switch 
                v-model="syslogConfig.enabled" 
                :active-text="$t('systemLogs.enableRemote')"
                size="large"
              />
              <el-text class="switch-description" size="small">
                Włącz wysyłanie logów systemowych na zdalny serwer Syslog
              </el-text>
            </div>
          </el-form-item>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('systemLogs.host')" required>
                <el-input 
                  v-model="syslogConfig.host" 
                  :placeholder="$t('systemLogs.host')"
                  :disabled="!syslogConfig.enabled"
                  size="large"
                >
                  <template #prefix>
                    <Icon icon="mdi:server" />
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item :label="$t('systemLogs.port')" required>
                <el-input-number
                  v-model="syslogConfig.port"
                  :min="1"
                  :max="65535"
                  :disabled="!syslogConfig.enabled"
                  controls-position="right"
                  size="large"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item :label="$t('systemLogs.protocol')">
                <el-select
                  v-model="syslogConfig.protocol"
                  :disabled="!syslogConfig.enabled"
                  size="large"
                >
                  <el-option label="UDP" value="udp">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <Icon icon="mdi:network-outline" />
                      <span>UDP (szybszy, mniej niezawodny)</span>
                    </div>
                  </el-option>
                  <el-option label="TCP" value="tcp">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <Icon icon="mdi:connection" />
                      <span>TCP (wolniejszy, niezawodny)</span>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item>
            <div class="form-actions">
              <el-button 
                type="primary" 
                @click="saveConfig"
                size="large"
                :loading="savingConfig"
              >
                <Icon icon="mdi:content-save" />
                {{ $t('systemLogs.saveConfig') }}
              </el-button>
              <el-button 
                @click="resetConfig"
                size="large"
                :disabled="savingConfig"
              >
                <Icon icon="mdi:restore" />
                Resetuj
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- Log Viewer Card -->
    <el-card class="log-viewer-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:file-document-multiple-outline" />
            {{ $t('systemLogs.receivedLogs') }}
            <el-tag v-if="syslogConfig.enabled" type="success" size="small">
              {{ remoteLogsCount }} logów
            </el-tag>
          </h2>
          <div class="card-header-actions">
            <el-button-group>
              <el-button 
                :type="logFilter.level === 'all' ? 'primary' : 'default'"
                @click="logFilter.level = 'all'"
                size="small"
              >
                Wszystkie
              </el-button>
              <el-button 
                :type="logFilter.level === 'error' ? 'danger' : 'default'"
                @click="logFilter.level = 'error'"
                size="small"
              >
                <Icon icon="mdi:alert-circle" />
                Błędy
              </el-button>
              <el-button 
                :type="logFilter.level === 'warning' ? 'warning' : 'default'"
                @click="logFilter.level = 'warning'"
                size="small"
              >
                <Icon icon="mdi:alert" />
                Ostrzeżenia
              </el-button>
            </el-button-group>
          </div>
        </div>
      </template>

      <div class="log-controls">
        <div class="search-controls">
          <el-input
            v-model="logFilter.search"
            placeholder="Szukaj w logach..."
            clearable
            size="large"
            style="width: 300px"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" />
            </template>
          </el-input>
          
          <el-input-number
            v-model="logLines"
            :min="50"
            :max="5000"
            :step="50"
            size="large"
            style="width: 200px"
            controls-position="right"
          >
            <template #prefix>
              <Icon icon="mdi:format-list-numbered" />
            </template>
            <template #append>
              linii
            </template>
          </el-input-number>
        </div>
        
        <div class="action-controls">
          <el-button 
            type="primary" 
            @click="fetchRemoteLogs"
            :loading="loading"
            size="large"
          >
            <Icon icon="mdi:refresh" />
            {{ $t('systemLogs.refresh') }}
          </el-button>
          
          <el-button 
            type="info"
            @click="toggleAutoRefresh"
            :loading="loading"
            size="large"
          >
            <Icon :icon="autoRefresh ? 'mdi:pause' : 'mdi:play'" />
            {{ autoRefresh ? 'Pauza' : 'Auto-odświeżanie' }}
          </el-button>
          
          <el-dropdown @command="handleExport">
            <el-button type="success" size="large">
              <Icon icon="mdi:export" />
              Eksportuj
              <Icon icon="mdi:chevron-down" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="txt">TXT</el-dropdown-item>
                <el-dropdown-item command="csv">CSV</el-dropdown-item>
                <el-dropdown-item command="json">JSON</el-dropdown-item>
                <el-dropdown-item divided command="pdf">PDF</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="log-content-wrapper">
        <div class="log-content" ref="logContentRef">
          <div v-if="!loading && filteredLogs.length === 0" class="empty-state">
            <Icon icon="mdi:file-search-outline" width="120" height="120" />
            <h3>Brak logów</h3>
            <p v-if="syslogConfig.enabled">Serwer zdalny nie wysyła jeszcze logów</p>
            <p v-else>Zdalne logowanie jest wyłączone</p>
          </div>
          
          <div v-else-if="loading" class="loading-spinner">
            <el-icon :size="48" class="is-loading">
              <Icon icon="mdi:loading" />
            </el-icon>
            <p>Ładowanie logów...</p>
          </div>
          
          <div v-else class="log-entries">
            <div 
              v-for="(log, index) in filteredLogs" 
              :key="index"
              :class="['log-entry', getLogLevelClass(log)]"
            >
              <div class="log-timestamp">
                <Icon icon="mdi:clock-outline" />
                {{ formatTime(log.timestamp) }}
              </div>
              <div class="log-level">
                <el-tag :type="getLogLevelType(log.level)" size="small" effect="plain">
                  {{ log.level }}
                </el-tag>
              </div>
              <div class="log-message">
                <span class="log-source" v-if="log.source">
                  <strong>{{ log.source }}:</strong>
                </span>
                <span class="log-text">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && filteredLogs.length > 0" class="log-footer">
        <el-text type="info" size="small">
          Wyświetlono {{ filteredLogs.length }} z {{ remoteLogsCount }} logów
        </el-text>
        <el-text 
          v-if="logFilter.level !== 'all' || logFilter.search" 
          type="warning" 
          size="small"
        >
          (Filtrowanie: 
          <span v-if="logFilter.level !== 'all'">{{ logFilterLevelLabel }}</span>
          <span v-if="logFilter.level !== 'all' && logFilter.search">, </span>
          <span v-if="logFilter.search">wyszukiwanie: "{{ logFilter.search }}"</span>
          )
        </el-text>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const savingConfig = ref(false)
const remoteLogs = ref([])
const autoRefresh = ref(false)
const autoRefreshInterval = ref(null)
const logLines = ref(200)
const logContentRef = ref(null)

const syslogConfig = ref({
  enabled: false,
  host: '',
  port: 514,
  protocol: 'udp'
})

const logFilter = ref({
  level: 'all',
  search: ''
})

const remoteLogsCount = computed(() => remoteLogs.value.length)

const logFilterLevelLabel = computed(() => {
  const labels = {
    'all': 'Wszystkie',
    'error': 'Błędy',
    'warning': 'Ostrzeżenia',
    'info': 'Informacje'
  }
  return labels[logFilter.value.level]
})

const filteredLogs = computed(() => {
  let filtered = [...remoteLogs.value]
  
  // Filtrowanie po poziomie
  if (logFilter.value.level !== 'all') {
    filtered = filtered.filter(log => 
      log.level.toLowerCase() === logFilter.value.level
    )
  }
  
  // Filtrowanie po wyszukiwaniu
  if (logFilter.value.search) {
    const searchLower = logFilter.value.search.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(searchLower) ||
      (log.source && log.source.toLowerCase().includes(searchLower))
    )
  }
  
  // Ogranicz liczbę linii
  return filtered.slice(-logLines.value)
})

const fetchRemoteLogs = async () => {
  if (!syslogConfig.value.enabled) return
  
  loading.value = true
  try {
    const response = await axios.get('/api/diagnostics/remote-logs', {
      params: { lines: logLines.value }
    })
    remoteLogs.value = response.data.logs
    scrollToBottom()
  } catch (error) {
    console.error('Błąd pobierania zdalnych logów:', error)
    remoteLogs.value = []
    ElMessage.error('Nie można pobrać zdalnych logów')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  savingConfig.value = true
  try {
    await axios.post('/api/diagnostics/remote-logs/config', syslogConfig.value)
    ElMessage.success('Konfiguracja zapisana pomyślnie')
    
    if (syslogConfig.value.enabled) {
      await fetchRemoteLogs()
      if (!autoRefresh.value) {
        toggleAutoRefresh()
      }
    } else {
      stopAutoRefresh()
      remoteLogs.value = []
    }
  } catch (error) {
    ElMessage.error('Błąd podczas zapisywania konfiguracji')
  } finally {
    savingConfig.value = false
  }
}

const resetConfig = () => {
  syslogConfig.value = {
    enabled: false,
    host: '',
    port: 514,
    protocol: 'udp'
  }
}

const loadConfig = async () => {
  try {
    const response = await axios.get('/api/diagnostics/remote-logs/config')
    syslogConfig.value = response.data.config
    
    if (syslogConfig.value.enabled) {
      await fetchRemoteLogs()
      toggleAutoRefresh()
    }
  } catch (error) {
    console.error('Błąd ładowania konfiguracji:', error)
  }
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
  autoRefreshInterval.value = setInterval(fetchRemoteLogs, 5000)
}

const stopAutoRefresh = () => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value)
    autoRefreshInterval.value = null
  }
}

const getLogLevelClass = (log) => {
  const level = log.level.toLowerCase()
  if (level.includes('error') || level.includes('err')) return 'log-error'
  if (level.includes('warn')) return 'log-warning'
  if (level.includes('info')) return 'log-info'
  if (level.includes('debug')) return 'log-debug'
  return ''
}

const getLogLevelType = (level) => {
  const levelLower = level.toLowerCase()
  if (levelLower.includes('error') || levelLower.includes('err')) return 'danger'
  if (levelLower.includes('warn')) return 'warning'
  if (levelLower.includes('info')) return 'info'
  if (levelLower.includes('debug')) return ''
  return 'info'
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('pl-PL')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight
    }
  })
}

const handleExport = async (format) => {
  try {
    const response = await axios.post('/api/diagnostics/remote-logs/export', {
      logs: filteredLogs.value,
      format: format
    }, {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `logs-${new Date().toISOString().split('T')[0]}.${format}`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    ElMessage.success(`Logi wyeksportowane jako ${format.toUpperCase()}`)
  } catch (error) {
    ElMessage.error('Błąd podczas eksportowania logów')
  }
}

watch(logFilter, () => {
  scrollToBottom()
}, { deep: true })

onMounted(async () => {
  await loadConfig()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.remote-logs-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.config-card,
.log-viewer-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.config-card:hover,
.log-viewer-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
}

.config-form {
  padding: 24px;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.switch-description {
  color: #64748b;
  margin-left: 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.log-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.search-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.action-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.log-content-wrapper {
  min-height: 400px;
  max-height: 600px;
  overflow: hidden;
}

.log-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 0;
  min-height: 300px;
  color: #64748b;
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: #1e293b;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 0;
  min-height: 300px;
}

.loading-spinner p {
  margin-top: 16px;
  color: #64748b;
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-entry {
  display: grid;
  grid-template-columns: 200px 100px 1fr;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  transition: all 0.2s ease;
  align-items: center;
}

.log-entry:hover {
  background: #f8fafc;
  transform: translateX(4px);
}

.log-entry.log-error {
  border-left: 4px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.log-entry.log-warning {
  border-left: 4px solid #f59e0b;
  background: rgba(245, 158, 11, 0.05);
}

.log-entry.log-info {
  border-left: 4px solid #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.log-entry.log-debug {
  border-left: 4px solid #8b5cf6;
  background: rgba(139, 92, 246, 0.05);
}

.log-timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
  font-family: monospace;
}

.log-level {
  display: flex;
  align-items: center;
}

.log-message {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}

.log-source {
  flex-shrink: 0;
  color: #475569;
  font-weight: 500;
}

.log-text {
  flex: 1;
  min-width: 0;
  color: #1e293b;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

/* Custom scrollbar */
.log-content::-webkit-scrollbar {
  width: 10px;
}

.log-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.log-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

@media (max-width: 1024px) {
  .log-entry {
    grid-template-columns: 180px 90px 1fr;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .log-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-controls,
  .action-controls {
    width: 100%;
  }
  
  .action-controls .el-button {
    flex: 1;
  }
  
  .log-entry {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .log-timestamp,
  .log-level {
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .config-form {
    padding: 16px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .el-button {
    width: 100%;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

:deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}

/* Tag styling */
:deep(.el-tag) {
  font-weight: 500;
}

/* Input styling */
:deep(.el-input) {
  --el-input-focus-border-color: #3b82f6;
}

/* Animation for auto-refresh */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

.log-entries .log-entry:last-child {
  animation: pulse 1s ease-in-out;
}
</style>
