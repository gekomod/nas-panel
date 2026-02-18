<template>
  <div class="servers-manager">
    <!-- Nagłówek z przyciskiem dodawania -->
    <div class="page-header">
      <div class="header-title">
        <h1>{{ $t('servers.title') }}</h1>
        <el-tag size="large" type="info" effect="plain">
          {{ servers.length }} {{ $t('servers.total') }}
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button @click="refreshAllStatus" :loading="refreshing" size="large">
          <Icon icon="mdi:refresh" width="18" />
          {{ $t('servers.refreshStatus') }}
        </el-button>
        <el-button type="primary" @click="openAddDialog" size="large">
          <Icon icon="mdi:server-plus" width="18" />
          {{ $t('servers.addServer') }}
        </el-button>
      </div>
    </div>

    <!-- Statystyki ogólne -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1); color: #409EFF">
              <Icon icon="mdi:server" width="24" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ servers.length }}</div>
              <div class="stat-label">{{ $t('servers.totalServers') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <div class="stat-icon" style="background: rgba(103, 194, 58, 0.1); color: #67C23A">
              <Icon icon="mdi:check-circle" width="24" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ onlineCount }}</div>
              <div class="stat-label">{{ $t('servers.online') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-item">
            <div class="stat-icon" style="background: rgba(245, 108, 108, 0.1); color: #F56C6C">
              <Icon icon="mdi:close-circle" width="24" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ offlineCount }}</div>
              <div class="stat-label">{{ $t('servers.offline') }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Lista serwerów w kartach -->
    <div class="servers-grid">
      <el-card
        v-for="server in servers"
        :key="server.id"
        class="server-card"
        :class="{
          'server-online': server.status === 'online',
          'server-offline': server.status === 'offline'
        }"
        shadow="hover"
      >
        <!-- Nagłówek karty serwera -->
        <div class="server-card-header">
          <div class="server-icon">
            <Icon 
              :icon="getServerIcon(server)" 
              :width="32" 
              :style="{ color: getServerColor(server) }"
            />
          </div>
          <div class="server-info">
            <h3>{{ server.name }}</h3>
            <div class="server-meta">
              <span class="server-host">
                <Icon icon="mdi:ip-network" width="12" />
                {{ server.host }}:{{ server.port }}
              </span>
              <span class="server-user">
                <Icon icon="mdi:account" width="12" />
                {{ server.username }}
              </span>
            </div>
          </div>
          <div class="server-status-badge">
            <el-tag 
              :type="server.status === 'online' ? 'success' : 'danger'"
              size="small"
              effect="dark"
              class="status-tag"
            >
              <Icon 
                :icon="server.status === 'online' ? 'mdi:check-circle' : 'mdi:close-circle'" 
                width="12" 
                style="margin-right: 4px"
              />
              {{ server.status === 'online' ? $t('servers.online') : $t('servers.offline') }}
            </el-tag>
            
            <el-tag 
              v-if="server.connected"
              type="success"
              size="small"
              effect="plain"
              class="connection-tag"
            >
              <Icon icon="mdi:link" width="12" style="margin-right: 4px" />
              {{ $t('servers.connected') }}
            </el-tag>
            
            <el-dropdown trigger="click" @command="handleCommand($event, server)">
              <el-button size="small" type="info" plain circle>
                <Icon icon="mdi:dots-vertical" width="14" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item 
                    v-if="!server.connected"
                    command="connect" 
                    :disabled="server.status !== 'online'"
                  >
                    <Icon icon="mdi:link" width="14" style="margin-right: 8px" />
                    {{ $t('servers.connect') }}
                  </el-dropdown-item>
                  <el-dropdown-item 
                    v-else
                    command="disconnect"
                  >
                    <Icon icon="mdi:link-off" width="14" style="margin-right: 8px" />
                    {{ $t('servers.disconnect') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="terminal" :disabled="!server.connected">
                    <Icon icon="mdi:console" width="14" style="margin-right: 8px" />
                    {{ $t('servers.openTerminal') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="ping" divided>
                    <Icon icon="mdi:radar" width="14" style="margin-right: 8px" />
                    {{ $t('servers.checkStatus') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <Icon icon="mdi:pencil" width="14" style="margin-right: 8px" />
                    {{ $t('common.edit') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <Icon icon="mdi:delete" width="14" style="margin-right: 8px; color: #F56C6C" />
                    <span style="color: #F56C6C">{{ $t('common.delete') }}</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- Panel szybkich akcji -->
        <div class="quick-actions" v-if="server.status === 'online' && !server.connected">
          <el-button 
            @click="connectToServer(server)"
            type="success"
            plain
            size="small"
            block
          >
            <Icon icon="mdi:link" width="14" />
            {{ $t('servers.connectToServer') }}
          </el-button>
        </div>

        <!-- Panel danych serwera (tylko gdy połączony) -->
        <div v-if="server.connected" class="server-data-panel">
          <el-tabs v-model="server.activeTab" @tab-click="() => loadServerData(server)">
            <!-- Statystyki -->
            <el-tab-pane :label="$t('servers.stats')" name="stats">
              <div v-loading="server.loadingStats" class="stats-container">
                <el-row :gutter="16">
                  <!-- CPU -->
                  <el-col :span="12">
                    <div class="metric-card">
                      <div class="metric-header">
                        <Icon icon="mdi:cpu-64-bit" width="16" />
                        <span>CPU</span>
                      </div>
                      <div class="metric-content">
                        <div class="metric-main">
                          <span class="metric-value">{{ server.stats?.cpu?.load1 || 0 }}</span>
                          <span class="metric-unit">load</span>
                        </div>
                        <div class="metric-details">
                          <div class="metric-row">
                            <span>{{ $t('servers.cores') }}:</span>
                            <strong>{{ server.stats?.cpu?.cores || 0 }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>5m:</span>
                            <strong>{{ server.stats?.cpu?.load5 || 0 }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>15m:</span>
                            <strong>{{ server.stats?.cpu?.load15 || 0 }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </el-col>

                  <!-- RAM -->
                  <el-col :span="12">
                    <div class="metric-card">
                      <div class="metric-header">
                        <Icon icon="mdi:memory" width="16" />
                        <span>RAM</span>
                      </div>
                      <div class="metric-content">
                        <div class="metric-main">
                          <el-progress 
                            type="dashboard" 
                            :percentage="parseFloat(server.stats?.memory?.usedPercent) || 0"
                            :width="80"
                            :stroke-width="8"
                            :color="getProgressColor(server.stats?.memory?.usedPercent)"
                          />
                        </div>
                        <div class="metric-details">
                          <div class="metric-row">
                            <span>{{ $t('servers.total') }}:</span>
                            <strong>{{ formatBytes(server.stats?.memory?.total) }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.used') }}:</span>
                            <strong>{{ formatBytes(server.stats?.memory?.used) }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.free') }}:</span>
                            <strong>{{ formatBytes(server.stats?.memory?.free) }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </el-col>

                  <!-- Dysk -->
                  <el-col :span="12">
                    <div class="metric-card">
                      <div class="metric-header">
                        <Icon icon="mdi:harddisk" width="16" />
                        <span>{{ $t('servers.disk') }}</span>
                      </div>
                      <div class="metric-content">
                        <div class="metric-main">
                          <el-progress 
                            type="dashboard" 
                            :percentage="parseFloat(server.stats?.disk?.usedPercent) || 0"
                            :width="80"
                            :stroke-width="8"
                            :color="getProgressColor(server.stats?.disk?.usedPercent)"
                          />
                        </div>
                        <div class="metric-details">
                          <div class="metric-row">
                            <span>{{ $t('servers.total') }}:</span>
                            <strong>{{ formatBytes(server.stats?.disk?.total) }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.used') }}:</span>
                            <strong>{{ formatBytes(server.stats?.disk?.used) }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.free') }}:</span>
                            <strong>{{ formatBytes(server.stats?.disk?.free) }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </el-col>

                  <!-- System -->
                  <el-col :span="12">
                    <div class="metric-card">
                      <div class="metric-header">
                        <Icon icon="mdi:server" width="16" />
                        <span>{{ $t('servers.system') }}</span>
                      </div>
                      <div class="metric-content">
                        <div class="system-info">
                          <div class="metric-row">
                            <span>{{ $t('servers.os') }}:</span>
                            <strong>{{ server.stats?.system?.os || 'Linux' }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.uptime') }}:</span>
                            <strong>{{ formatUptime(server.stats?.uptime) }}</strong>
                          </div>
                          <div class="metric-row">
                            <span>{{ $t('servers.hostname') }}:</span>
                            <strong>{{ server.stats?.system?.hostname || '-' }}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </el-col>
                </el-row>
              </div>
            </el-tab-pane>

            <!-- Procesy -->
            <el-tab-pane :label="$t('servers.processes')" name="processes">
              <div class="processes-container">
                <div class="processes-toolbar">
                  <el-input
                    v-model="server.processFilter"
                    :placeholder="$t('servers.searchProcesses')"
                    size="small"
                    clearable
                  >
                    <template #prefix>
                      <Icon icon="mdi:magnify" width="14" />
                    </template>
                  </el-input>
                  <el-button 
                    @click="loadProcesses(server)" 
                    size="small" 
                    :loading="server.loadingProcesses"
                  >
                    <Icon icon="mdi:refresh" width="14" />
                  </el-button>
                </div>

                <el-table 
                  :data="filteredProcesses(server)" 
                  size="small"
                  height="300"
                  style="width: 100%"
                  border
                >
                  <el-table-column prop="user" :label="$t('servers.user')" width="80" />
                  <el-table-column prop="pid" label="PID" width="70" />
                  <el-table-column prop="cpu" label="CPU%" width="70" />
                  <el-table-column prop="mem" label="MEM%" width="70" />
                  <el-table-column prop="command" :label="$t('servers.command')" min-width="200" />
                  <el-table-column :label="$t('servers.actions')" width="80" fixed="right">
                    <template #default="{ row }">
                      <el-button
                        @click="killProcess(server, row.pid)"
                        size="small"
                        type="danger"
                        link
                      >
                        <Icon icon="mdi:close" width="14" />
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <!-- Terminal -->
            <el-tab-pane :label="$t('servers.terminal')" name="terminal">
              <div class="terminal-section">
                <RealTerminal 
                  v-if="server.connected"
                  ref="terminalRefs"
                  :server="server"
                  @connected="onTerminalConnected(server)"
                  @disconnected="onTerminalDisconnected(server)"
                  @error="onTerminalError"
                />
                <div v-else class="terminal-offline">
                  <Icon icon="mdi:console" size="48" color="#909399" />
                  <h3>{{ $t('servers.terminalNotAvailable') }}</h3>
                  <p>{{ $t('servers.connectToServerFirst') }}</p>
                </div>
              </div>
            </el-tab-pane>

            <!-- Logi -->
            <el-tab-pane :label="$t('servers.logs')" name="logs">
              <div class="logs-container">
                <div class="logs-toolbar">
                  <el-select v-model="server.logLines" size="small" style="width: 100px">
                    <el-option label="50" :value="50" />
                    <el-option label="100" :value="100" />
                    <el-option label="200" :value="200" />
                  </el-select>
                  <el-button 
                    @click="loadLogs(server)" 
                    size="small" 
                    :loading="server.loadingLogs"
                  >
                    <Icon icon="mdi:refresh" width="14" />
                  </el-button>
                </div>
                <div class="logs-output">
                  <div v-for="(log, idx) in server.logs" :key="idx" class="log-line">
                    <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                  <div v-if="!server.logs?.length" class="logs-empty">
                    <Icon icon="mdi:clipboard-text-off" size="24" />
                    <p>{{ $t('servers.noLogs') }}</p>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- Informacja o offline -->
        <div v-else-if="server.status === 'offline'" class="offline-info">
          <Icon icon="mdi:server-off" size="20" color="#909399" />
          <span>{{ $t('servers.serverOffline') }}</span>
          <el-button @click="pingServer(server, true)" text size="small">
            <Icon icon="mdi:refresh" width="12" />
            {{ $t('servers.checkAgain') }}
          </el-button>
          <div v-if="server.lastError" class="error-details">
            {{ server.lastError }}
          </div>
        </div>
      </el-card>
    </div>

    <!-- Dialog dodawania/edycji serwera -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? $t('servers.editServer') : $t('servers.addServer')"
      width="500px"
      destroy-on-close
      class="server-dialog"
    >
      <el-form
        ref="formRef"
        :model="dialog.form"
        :rules="formRules"
        label-position="top"
      >
        <el-form-item :label="$t('servers.name')" prop="name">
          <el-input v-model="dialog.form.name" :placeholder="$t('servers.namePlaceholder')" />
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="16">
            <el-form-item :label="$t('servers.host')" prop="host">
              <el-input v-model="dialog.form.host" placeholder="192.168.1.100">
                <template #prepend>
                  <Icon icon="mdi:ip" width="14" />
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('servers.port')" prop="port">
              <el-input-number v-model="dialog.form.port" :min="1" :max="65535" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="$t('servers.username')" prop="username">
          <el-input v-model="dialog.form.username" placeholder="root">
            <template #prepend>
              <Icon icon="mdi:account" width="14" />
            </template>
          </el-input>
        </el-form-item>

        <el-divider>{{ $t('servers.authentication') }}</el-divider>

        <el-radio-group v-model="dialog.authMethod" class="auth-method">
          <el-radio-button value="password">
            <Icon icon="mdi:lock" width="14" />
            Password
          </el-radio-button>
          <el-radio-button value="key">
            <Icon icon="mdi:key" width="14" />
            SSH Key
          </el-radio-button>
        </el-radio-group>

        <el-form-item v-if="dialog.authMethod === 'password'" :label="$t('servers.password')" class="auth-field">
          <el-input
            v-model="dialog.form.password"
            type="password"
            show-password
            :placeholder="$t('servers.passwordPlaceholder')"
          />
        </el-form-item>

        <el-form-item v-else :label="$t('servers.keyFile')" class="auth-field">
          <el-input
            v-model="dialog.form.keyFile"
            :placeholder="$t('servers.keyFilePlaceholder')"
          >
            <template #append>
              <el-button @click="browseKeyFile">
                <Icon icon="mdi:folder-open" width="14" />
              </el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="saveServer"
          :loading="dialog.saving"
        >
          {{ dialog.isEdit ? $t('common.save') : $t('servers.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog połączenia (hasło) -->
    <el-dialog
      v-model="connectDialog.visible"
      :title="$t('servers.connectTo') + ' ' + connectDialog.server?.name"
      width="400px"
      class="connect-dialog"
    >
      <el-form @submit.prevent="submitPassword">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="connect-info"
        >
          {{ $t('servers.enterPasswordFor') }} {{ connectDialog.server?.username }}@{{ connectDialog.server?.host }}
        </el-alert>
        
        <el-form-item :label="$t('servers.password')">
          <el-input
            v-model="connectDialog.password"
            type="password"
            show-password
            :placeholder="$t('servers.enterPassword')"
            @keyup.enter="submitPassword"
            autofocus
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="connectDialog.visible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="submitPassword"
          :loading="connectDialog.loading"
        >
          <Icon icon="mdi:link" width="14" />
          {{ $t('servers.connect') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import RealTerminal from './Terminal.vue'

const { t } = useI18n()

// ==================== STAN ====================
const servers = ref([])
const refreshing = ref(false)
const refreshIntervals = ref({})
const terminalRefs = ref({})

// Dialog serwera
const dialog = reactive({
  visible: false,
  isEdit: false,
  editId: null,
  saving: false,
  authMethod: 'password',
  form: {
    name: '',
    host: '',
    port: 22,
    username: 'root',
    password: '',
    keyFile: ''
  }
})

// Dialog połączenia
const connectDialog = reactive({
  visible: false,
  server: null,
  password: '',
  loading: false
})

// ==================== COMPUTED ====================
const onlineCount = computed(() => {
  return servers.value.filter(s => s.status === 'online').length
})

const offlineCount = computed(() => {
  return servers.value.filter(s => s.status === 'offline').length
})

// ==================== WALIDACJA ====================
const formRules = {
  name: [
    { required: true, message: t('servers.nameRequired'), trigger: 'blur' }
  ],
  host: [
    { required: true, message: t('servers.hostRequired'), trigger: 'blur' }
  ],
  username: [
    { required: true, message: t('servers.usernameRequired'), trigger: 'blur' }
  ]
}

// ==================== FUNKCJE POMOCNICZE ====================
const getServerIcon = (server) => {
  if (server.connected) return 'mdi:server-network'
  if (server.status === 'online') return 'mdi:server'
  return 'mdi:server-off'
}

const getServerColor = (server) => {
  if (server.connected) return '#67C23A'
  if (server.status === 'online') return '#409EFF'
  return '#909399'
}

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatUptime = (seconds) => {
  if (!seconds) return '0m'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const formatLogTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getProgressColor = (percent) => {
  const p = parseFloat(percent) || 0
  if (p < 60) return '#67C23A'
  if (p < 80) return '#E6A23C'
  return '#F56C6C'
}

const filteredProcesses = (server) => {
  const filter = server.processFilter?.toLowerCase() || ''
  const processes = server.processes || []
  
  if (!filter) return processes
  
  return processes.filter(p => 
    p.user?.toLowerCase().includes(filter) ||
    p.pid?.includes(filter) ||
    p.command?.toLowerCase().includes(filter)
  )
}

// ==================== SPRAWDZANIE STATUSU ====================

// Szybkie pingowanie (sprawdza tylko czy port SSH jest otwarty)
const fastPing = async (server) => {
  try {
    const response = await axios.get(`/api/servers/${server.id}/fast-ping`)
    return response.data.online
  } catch (error) {
    console.error(`Fast ping error for ${server.name}:`, error)
    return false
  }
}

// Pełne pingowanie
const pingServer = async (server, showMessage = false) => {
  if (showMessage) {
    ElMessage.info(t('servers.checkingServer', { name: server.name }))
  }
  
  try {
    const response = await axios.post(`/api/servers/${server.id}/ping`)
    
    if (response.data.online) {
      server.status = 'online'
      server.lastPing = new Date().toISOString()
      if (showMessage) {
        ElMessage.success(t('servers.serverOnline', { name: server.name }))
      }
    } else {
      server.status = 'offline'
      server.lastError = response.data.error
      if (showMessage) {
        ElMessage.warning(t('servers.serverOffline', { name: server.name }))
      }
    }
    
    await checkConnectionStatus(server)
    
    return response.data.online
  } catch (error) {
    console.error(`Ping error for ${server.name}:`, error)
    server.status = 'offline'
    if (showMessage) {
      ElMessage.error(t('servers.checkError', { name: server.name }))
    }
    return false
  }
}

// Sprawdź czy mamy aktywne połączenie
const checkConnectionStatus = async (server) => {
  try {
    const response = await axios.get(`/api/servers/${server.id}/status`)
    server.connected = response.data.connected
  } catch (error) {
    server.connected = false
  }
}

// Sprawdź wszystkie serwery
const checkAllServersStatus = async () => {
  refreshing.value = true
  
  for (const server of servers.value) {
    try {
      const isReachable = await fastPing(server)
      
      if (isReachable) {
        server.status = 'online'
      } else {
        server.status = 'offline'
      }
      
      await checkConnectionStatus(server)
      
    } catch (error) {
      console.error(`Status check failed for ${server.name}:`, error)
      server.status = 'offline'
    }
  }
  
  refreshing.value = false
}

// ==================== POŁĄCZENIE ====================

const connectToServer = async (server) => {
  if (server.status !== 'online') {
    ElMessage.warning(t('servers.cannotConnectOffline'))
    return
  }
  
  if (server.password) {
    connectDialog.server = server
    connectDialog.visible = true
  } else {
    server.connecting = true
    await doConnect(server)
  }
}

const submitPassword = async () => {
  if (!connectDialog.password) {
    ElMessage.warning(t('servers.passwordRequired'))
    return
  }
  
  connectDialog.loading = true
  const server = connectDialog.server
  server.connecting = true
  
  await doConnect(server, connectDialog.password)
  
  connectDialog.loading = false
  connectDialog.visible = false
  connectDialog.password = ''
  server.connecting = false
}

const doConnect = async (server, password = null) => {
  try {
    const payload = password ? { password } : {}
    await axios.post(`/api/servers/${server.id}/connect`, payload)
    
    server.connected = true
    server.connecting = false
    server.lastUpdate = new Date().toISOString()
    server.activeTab = 'stats'
    server.currentPassword = password || server.password
    
    ElMessage.success(t('servers.connected', { name: server.name }))
    
    await loadStats(server)
    
  } catch (error) {
    console.error('Connection error:', error)
    server.connected = false
    server.connecting = false
    ElMessage.error(error.response?.data?.error || t('servers.connectionError'))
  }
}

const disconnectFromServer = async (server) => {
  try {
    // Rozłącz terminal jeśli aktywny
    if (terminalRefs.value[server.id]) {
      terminalRefs.value[server.id].disconnect()
    }
    
    await axios.post(`/api/servers/${server.id}/disconnect`)
    
    server.connected = false
    server.stats = null
    server.processes = []
    server.logs = []
    server.terminalSessionId = null
    server.currentPassword = null
    
    ElMessage.success(t('servers.disconnected', { name: server.name }))
    
  } catch (error) {
    console.error('Disconnect error:', error)
    ElMessage.error(t('servers.disconnectError'))
  }
}

// ==================== ŁADOWANIE DANYCH ====================

const loadServerData = async (server) => {
  if (!server.connected) return
  
  const activeTab = server.activeTab || 'stats'
  
  if (activeTab === 'stats') {
    await loadStats(server)
  } else if (activeTab === 'processes') {
    await loadProcesses(server)
  } else if (activeTab === 'logs') {
    await loadLogs(server)
  }
}

const loadStats = async (server) => {
  server.loadingStats = true
  try {
    const response = await axios.get(`/api/servers/${server.id}/stats`)
    server.stats = response.data.stats
    server.lastUpdate = new Date().toISOString()
  } catch (error) {
    console.error('Load stats error:', error)
    ElMessage.error(t('servers.loadDataError'))
  } finally {
    server.loadingStats = false
  }
}

const loadProcesses = async (server) => {
  server.loadingProcesses = true
  try {
    const response = await axios.get(`/api/servers/${server.id}/processes`)
    server.processes = response.data.processes
  } catch (error) {
    console.error('Load processes error:', error)
    ElMessage.error(t('servers.loadProcessesError'))
  } finally {
    server.loadingProcesses = false
  }
}

const loadLogs = async (server) => {
  server.loadingLogs = true
  try {
    const response = await axios.get(`/api/servers/${server.id}/logs?lines=${server.logLines}`)
    server.logs = response.data.logs
  } catch (error) {
    console.error('Load logs error:', error)
    ElMessage.error(t('servers.loadLogsError'))
  } finally {
    server.loadingLogs = false
  }
}

// ==================== PROCESY ====================

const killProcess = async (server, pid) => {
  try {
    await ElMessageBox.confirm(
      t('servers.confirmKill', { pid }),
      t('common.warning'),
      {
        confirmButtonText: t('servers.kill'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    await axios.post(`/api/servers/${server.id}/processes/${pid}/kill`)
    ElMessage.success(t('servers.processKilled'))
    await loadProcesses(server)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Kill error:', error)
      ElMessage.error(error.response?.data?.error || t('servers.killError'))
    }
  }
}

// ==================== TERMINAL ====================

const onTerminalConnected = (server) => {
  console.log(`Terminal connected for ${server.name}`)
}

const onTerminalDisconnected = (server) => {
  console.log(`Terminal disconnected for ${server.name}`)
}

const onTerminalError = (error) => {
  ElMessage.error(error)
}

// ==================== ZARZĄDZANIE SERWERAMI ====================

const loadServers = async () => {
  try {
    const response = await axios.get('/api/servers')
    const serverList = response.data.servers || []
    
    servers.value = serverList.map(s => ({
      ...s,
      status: 'offline',
      connected: false,
      connecting: false,
      activeTab: 'stats',
      stats: null,
      processes: [],
      logs: [],
      terminalSessionId: null,
      loadingStats: false,
      loadingProcesses: false,
      loadingLogs: false,
      processFilter: '',
      logLines: 50,
      lastPing: null,
      lastError: null,
      lastUpdate: null,
      currentPassword: null
    }))
    
    await checkAllServersStatus()
    
  } catch (error) {
    console.error('Load servers error:', error)
    ElMessage.error(t('servers.loadError'))
  }
}

const refreshAllStatus = async () => {
  await checkAllServersStatus()
}

const openAddDialog = () => {
  dialog.isEdit = false
  dialog.authMethod = 'password'
  dialog.form = {
    name: '',
    host: '',
    port: 22,
    username: 'root',
    password: '',
    keyFile: ''
  }
  dialog.visible = true
}

const editServer = (server) => {
  dialog.isEdit = true
  dialog.editId = server.id
  dialog.authMethod = server.keyFile ? 'key' : 'password'
  dialog.form = {
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    password: '',
    keyFile: server.keyFile || ''
  }
  dialog.visible = true
}

const saveServer = async () => {
  dialog.saving = true
  try {
    if (dialog.isEdit) {
      await axios.put(`/api/servers/${dialog.editId}`, dialog.form)
      ElMessage.success(t('servers.updated'))
    } else {
      await axios.post('/api/servers', dialog.form)
      ElMessage.success(t('servers.added'))
    }
    
    dialog.visible = false
    await loadServers()
  } catch (error) {
    console.error('Save error:', error)
    ElMessage.error(error.response?.data?.error || t('servers.saveError'))
  } finally {
    dialog.saving = false
  }
}

const deleteServer = async (server) => {
  try {
    await ElMessageBox.confirm(
      t('servers.confirmDelete', { name: server.name }),
      t('common.warning'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    await axios.delete(`/api/servers/${server.id}`)
    ElMessage.success(t('servers.deleted'))
    await loadServers()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete error:', error)
      ElMessage.error(t('servers.deleteError'))
    }
  }
}

const browseKeyFile = () => {
  ElMessage.info('File browser coming soon')
}

const handleCommand = async (command, server) => {
  switch (command) {
    case 'connect':
      await connectToServer(server)
      break
    case 'disconnect':
      await disconnectFromServer(server)
      break
    case 'terminal':
      server.activeTab = 'terminal'
      await nextTick()
      break
    case 'ping':
      await pingServer(server, true)
      break
    case 'edit':
      editServer(server)
      break
    case 'delete':
      await deleteServer(server)
      break
  }
}

// ==================== LIFECYCLE ====================

onMounted(() => {
  loadServers()
  
  const interval = setInterval(() => {
    checkAllServersStatus()
  }, 60000)
  
  refreshIntervals.value.status = interval
})

onUnmounted(() => {
  Object.values(refreshIntervals.value).forEach(clearInterval)
})
</script>

<style scoped lang="scss">
.servers-manager {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
    
    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
}

/* Stats Row */
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .stat-info {
      .stat-value {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.2;
      }
      
      .stat-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

/* Servers Grid */
.servers-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.server-card {
  border-radius: 12px;
  border-left: 4px solid transparent;
  transition: all 0.3s ease;
  
  &.server-online {
    border-left-color: #67C23A;
  }
  
  &.server-offline {
    border-left-color: #909399;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
}

.server-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  
  .server-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color-light);
    border-radius: 12px;
  }
  
  .server-info {
    flex: 1;
    
    h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 600;
    }
    
    .server-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
  
  .server-status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .status-tag {
      min-width: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    
    .connection-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(103, 194, 58, 0.1);
      border-color: rgba(103, 194, 58, 0.3);
      color: #67C23A;
    }
  }
}

.quick-actions {
  padding: 0 16px 16px;
}

/* Server Data Panel */
.server-data-panel {
  border-top: 1px solid var(--el-border-color-light);
  padding: 16px;
  background: var(--el-fill-color-light);
}

.stats-container {
  padding: 8px 0;
}

.metric-card {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  
  .metric-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-primary);
  }
  
  .metric-content {
    display: flex;
    gap: 12px;
    
    .metric-main {
      min-width: 70px;
      text-align: center;
      
      .metric-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--el-color-primary);
        display: block;
      }
      
      .metric-unit {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }
    
    .metric-details {
      flex: 1;
      
      .metric-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        font-size: 12px;
        border-bottom: 1px dashed var(--el-border-color-lighter);
        
        &:last-child {
          border-bottom: none;
        }
        
        span {
          color: var(--el-text-color-secondary);
        }
        
        strong {
          color: var(--el-text-color-primary);
          font-family: monospace;
        }
      }
    }
  }
}

.system-info {
  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px dashed var(--el-border-color-lighter);
    
    &:last-child {
      border-bottom: none;
    }
    
    span {
      color: var(--el-text-color-secondary);
    }
    
    strong {
      color: var(--el-text-color-primary);
    }
  }
}

/* Processes */
.processes-container {
  padding: 8px 0;
  
  .processes-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    
    .el-input {
      flex: 1;
    }
  }
}

/* Terminal */
.terminal-section {
  height: 350px;
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e2e;
}

.terminal-offline {
  height: 350px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-dark);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  
  h3 {
    margin: 16px 0 8px;
    font-size: 16px;
    font-weight: 500;
  }
  
  p {
    margin: 0;
    font-size: 14px;
  }
}

/* Logs */
.logs-container {
  .logs-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    justify-content: flex-end;
  }
  
  .logs-output {
    background: var(--el-bg-color);
    border-radius: 6px;
    padding: 10px;
    height: 250px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 11px;
    
    .log-line {
      display: flex;
      gap: 8px;
      padding: 2px 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
      
      .log-time {
        min-width: 70px;
        color: var(--el-text-color-secondary);
      }
      
      .log-message {
        flex: 1;
        word-break: break-word;
      }
    }
    
    .logs-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--el-text-color-secondary);
      gap: 8px;
    }
  }
}

/* Offline Info */
.offline-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 16px;
  color: #909399;
  font-size: 13px;
  
  .error-details {
    font-size: 11px;
    color: #F56C6C;
    background: rgba(245, 108, 108, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    margin-left: 8px;
  }
}

/* Dialogs */
.server-dialog, .connect-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
  }
}

.auth-method {
  display: flex;
  margin-bottom: 16px;
  width: 100%;
  
  .el-radio-button {
    flex: 1;
    
    .el-radio-button__inner {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }
}

.auth-field {
  margin-top: 16px;
}

.connect-info {
  margin-bottom: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .server-card-header {
    flex-wrap: wrap;
  }
  
  .metric-content {
    flex-direction: column;
    
    .metric-main {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}
</style>
