<template>
  <div class="ssh-settings-modern">
    <!-- Nagłówek panelu -->
    <div class="ssh-header-panel">
      <el-card shadow="hover" class="service-card">
        <div class="service-header">
          <div class="service-icon-container">
            <el-icon size="42" class="service-icon">
              <Icon icon="mdi:console-network" />
            </el-icon>
            <div class="service-status-badge">
              <el-tag 
                :type="serviceStatus.active ? 'success' : 'danger'" 
                size="small"
                class="status-tag"
              >
                <Icon :icon="serviceStatus.active ? 'mdi:play-circle' : 'mdi:stop-circle'" width="12" />
                {{ serviceStatus.active ? $t('sshSettings.running') : $t('sshSettings.stopped') }}
              </el-tag>
            </div>
          </div>
          
          <div class="service-info">
            <h2 class="service-title">{{ $t('sshSettings.title') }}</h2>
            <div class="service-meta">
              <span v-if="serviceStatus.version" class="version-info">
                <Icon icon="mdi:tag" width="12" />
                v{{ serviceStatus.version }}
              </span>
              <span class="port-info">
                <Icon icon="mdi:network-port" width="12" />
                {{ $t('sshSettings.port') }}: {{ settings.port || 22 }}
              </span>
              <span class="update-time">
                <Icon icon="mdi:update" width="12" />
                {{ $t('common.update') }}: {{ lastUpdate }}
              </span>
            </div>
          </div>
          
          <div class="service-actions">
            <div class="service-toggle">
              <label class="toggle-label">{{ $t('sshSettings.serviceState') }}</label>
              <el-switch
                v-model="serviceStatus.active"
                @change="toggleService"
                :loading="statusLoading"
                :active-text="$t('sshSettings.enabled')"
                :inactive-text="$t('sshSettings.disabled')"
                inline-prompt
                active-color="var(--el-color-success)"
                inactive-color="var(--el-color-danger)"
              />
            </div>
            
            <el-button-group class="service-buttons">
              <el-button
                @click="loadServiceStatus"
                :loading="statusLoading"
                circle
                class="action-btn"
              >
                <Icon icon="mdi:refresh" width="14" />
              </el-button>
              <el-button
                @click="openQuickConfig"
                circle
                type="primary"
                class="action-btn"
              >
                <Icon icon="mdi:cog" width="14" />
              </el-button>
            </el-button-group>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Karty konfiguracyjne -->
    <div class="config-section">
      <el-tabs v-model="activeTab" type="border-card" class="compact-tabs">
        <!-- Podstawowe ustawienia -->
        <el-tab-pane :label="$t('sshSettings.basicSettings')" name="basic">
          <div class="tab-content">
            <el-card shadow="hover" class="compact-card">
              <div class="config-grid">
                <div class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:connection" width="16" />
                    <h4>{{ $t('sshSettings.connectionSettings') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.port') }}</label>
                    <el-input-number
                      v-model="settings.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="config-hint">{{ $t('sshSettings.portHint') }}</div>
                  </div>
                </div>

                <div class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:lock" width="16" />
                    <h4>{{ $t('sshSettings.authentication') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.passwordAuth') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="settings.passwordAuthentication"
                        inline-prompt
                        :active-text="$t('sshSettings.enabled')"
                        :inactive-text="$t('sshSettings.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('sshSettings.passwordAuthHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.publicKeyAuth') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="settings.publicKeyAuthentication"
                        inline-prompt
                        :active-text="$t('sshSettings.enabled')"
                        :inactive-text="$t('sshSettings.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('sshSettings.publicKeyAuthHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.rootLogin') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="settings.allowRootLogin"
                        inline-prompt
                        :active-text="$t('sshSettings.yes')"
                        :inactive-text="$t('sshSettings.no')"
                        active-color="var(--el-color-danger)"
                        inactive-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint warning-hint">
                      <Icon icon="mdi:alert-circle" width="12" />
                      {{ $t('sshSettings.rootLoginHint') }}
                    </div>
                  </div>
                </div>

                <div class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:tune-variant" width="16" />
                    <h4>{{ $t('sshSettings.advancedSettings') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.tcpForwarding') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="settings.tcpForwarding"
                        inline-prompt
                        :active-text="$t('sshSettings.enabled')"
                        :inactive-text="$t('sshSettings.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('sshSettings.tcpForwardingHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.compression') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="settings.compression"
                        inline-prompt
                        :active-text="$t('sshSettings.enabled')"
                        :inactive-text="$t('sshSettings.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('sshSettings.compressionHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.maxSessions') }}</label>
                    <el-input-number
                      v-model="settings.maxSessions"
                      :min="1"
                      :max="100"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="config-hint">{{ $t('sshSettings.maxSessionsHint') }}</div>
                  </div>
                </div>
              </div>
              
              <div class="advanced-options">
                <div class="advanced-options-header">
                  <Icon icon="mdi:code-braces" width="16" />
                  <h4>{{ $t('sshSettings.additionalOptions') }}</h4>
                </div>
                <el-input
                  v-model="settings.additionalOptions"
                  type="textarea"
                  :rows="4"
                  :placeholder="$t('sshSettings.additionalOptionsPlaceholder')"
                  class="advanced-textarea"
                  resize="none"
                />
              </div>
              
              <div class="config-actions">
                <el-button
                  type="primary"
                  @click="saveSettings"
                  :loading="saveLoading"
                  size="large"
                  class="save-btn"
                >
                  <Icon icon="mdi:content-save" width="16" />
                  {{ $t('sshSettings.saveSettings') }}
                </el-button>
                <el-button
                  @click="resetSettings"
                  size="large"
                  class="reset-btn"
                >
                  <Icon icon="mdi:restore" width="16" />
                  {{ $t('sshSettings.reset') }}
                </el-button>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- Status usługi -->
        <el-tab-pane :label="$t('sshSettings.serviceStatus')" name="status">
          <div class="tab-content">
            <el-card shadow="hover" class="compact-card">
              <div class="status-grid">
                <div class="status-card">
                  <div class="status-header">
                    <Icon icon="mdi:information-outline" width="20" class="status-icon" />
                    <h4>{{ $t('sshSettings.serviceDetails') }}</h4>
                  </div>
                  
                  <div class="status-details">
                    <div class="status-item">
                      <label>{{ $t('sshSettings.status') }}</label>
                      <el-tag :type="serviceStatus.active ? 'success' : 'danger'" class="status-value-tag">
                        <Icon :icon="serviceStatus.active ? 'mdi:check-circle' : 'mdi:close-circle'" width="12" />
                        {{ serviceStatus.active ? $t('sshSettings.running') : $t('sshSettings.stopped') }}
                      </el-tag>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.version') }}</label>
                      <span class="status-value">{{ serviceStatus.version || 'N/A' }}</span>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.installed') }}</label>
                      <el-tag :type="serviceStatus.installed ? 'success' : 'warning'" class="status-value-tag">
                        {{ serviceStatus.installed ? $t('sshSettings.yes') : $t('sshSettings.no') }}
                      </el-tag>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.configPath') }}</label>
                      <span class="status-value">/etc/ssh/sshd_config</span>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.servicePath') }}</label>
                      <span class="status-value">/usr/sbin/sshd</span>
                    </div>
                  </div>
                </div>
                
                <div class="status-card logs-card">
                  <div class="status-header">
                    <Icon icon="mdi:clipboard-text-outline" width="20" class="status-icon" />
                    <h4>{{ $t('sshSettings.statusOutput') }}</h4>
                  </div>
                  
                  <div class="logs-container">
                    <pre class="status-output">{{ serviceStatus.details || $t('sshSettings.noStatusData') }}</pre>
                  </div>
                  
                  <div class="logs-actions">
                    <el-button
                      @click="copyStatusOutput"
                      size="small"
                      class="log-action-btn"
                    >
                      <Icon icon="mdi:content-copy" width="12" />
                      {{ $t('sshSettings.copy') }}
                    </el-button>
                    <el-button
                      @click="loadServiceStatus"
                      :loading="statusLoading"
                      size="small"
                      class="log-action-btn"
                    >
                      <Icon icon="mdi:refresh" width="12" />
                      {{ $t('sshSettings.refresh') }}
                    </el-button>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- Aktywne połączenia -->
        <el-tab-pane :label="$t('sshSettings.activeConnections')" name="connections">
          <div class="tab-content">
            <el-card shadow="hover" class="compact-card">
              <div class="connections-header">
                <div class="connections-info">
                  <h4>{{ $t('sshSettings.currentConnections') }}</h4>
                  <el-tag v-if="connections.length > 0" type="info" size="small" class="connections-count">
                    {{ connections.length }} {{ $t('sshSettings.connections') }}
                  </el-tag>
                </div>
                
                <div class="connections-actions">
                  <el-button
                    @click="loadConnections"
                    :loading="connectionsLoading"
                    size="small"
                    class="connection-action-btn"
                  >
                    <Icon icon="mdi:refresh" width="12" />
                    {{ $t('sshSettings.refresh') }}
                  </el-button>
                  <el-button
                    @click="exportConnections"
                    size="small"
                    class="connection-action-btn"
                  >
                    <Icon icon="mdi:download" width="12" />
                    {{ $t('sshSettings.export') }}
                  </el-button>
                </div>
              </div>
              
              <div v-if="connections.length === 0" class="empty-state">
                <Icon icon="mdi:connection-off" size="48" />
                <p>{{ $t('sshSettings.noConnections') }}</p>
              </div>
              
              <div v-else class="connections-grid">
                <div 
                  v-for="conn in connections" 
                  :key="conn.pid" 
                  class="connection-card"
                  :class="{ 'connection-card-system': conn.user === 'root' }"
                >
                  <div class="connection-header">
                    <div class="connection-icon">
                      <Icon icon="mdi:account-network" width="20" />
                    </div>
                    <div class="conn-user">
                      <span class="conn-username">{{ conn.user || 'unknown' }}</span>
                      <el-tag :type="getConnectionStateType(conn.state)" size="small" class="conn-state">
                        {{ conn.state || 'ESTABLISHED' }}
                      </el-tag>
                    </div>
                    <div class="conn-pid">PID: {{ conn.pid }}</div>
                  </div>
                  
                  <div class="connection-details">
                    <div class="conn-address">
                      <div class="address-item">
                        <label>{{ $t('sshSettings.localAddress') }}</label>
                        <span class="address-value">{{ conn.local || 'N/A' }}</span>
                      </div>
                      <div class="address-item">
                        <label>{{ $t('sshSettings.remoteAddress') }}</label>
                        <span class="address-value">{{ conn.remote || 'N/A' }}</span>
                      </div>
                    </div>
                    
                    <div class="conn-meta">
                      <div class="meta-item">
                        <Icon icon="mdi:clock-outline" width="12" />
                        <span>{{ conn.duration || 'N/A' }}</span>
                      </div>
                      <div class="meta-item">
                        <Icon icon="mdi:memory" width="12" />
                        <span>{{ conn.memory || 'N/A' }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="connection-actions">
                    <el-tooltip :content="$t('sshSettings.killConnection')" placement="top">
                      <el-button
                        @click="killConnection(conn.pid)"
                        size="small"
                        type="danger"
                        circle
                        plain
                        class="kill-btn"
                      >
                        <Icon icon="mdi:close" width="14" />
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Szybka konfiguracja modal -->
    <el-dialog
      v-model="quickConfigVisible"
      :title="$t('sshSettings.quickConfig')"
      width="400px"
      class="quick-config-modal"
    >
      <el-form label-position="top" class="quick-form">
        <el-form-item :label="$t('sshSettings.changePort')">
          <el-input-number
            v-model="quickPort"
            :min="1"
            :max="65535"
            controls-position="right"
            class="compact-input"
          />
        </el-form-item>
        
        <el-form-item :label="$t('sshSettings.enableRoot')">
          <el-switch
            v-model="quickRootAccess"
            inline-prompt
            :active-text="$t('sshSettings.yes')"
            :inactive-text="$t('sshSettings.no')"
            active-color="var(--el-color-danger)"
            inactive-color="var(--el-color-success)"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="quickConfigVisible = false" class="dialog-btn">
          {{ $t('sshSettings.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="applyQuickConfig"
          class="dialog-btn"
        >
          {{ $t('sshSettings.apply') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()

const activeTab = ref('basic')
const statusLoading = ref(false)
const saveLoading = ref(false)
const connectionsLoading = ref(false)
const quickConfigVisible = ref(false)
const lastUpdate = ref('')

const serviceStatus = ref({
  installed: false,
  active: false,
  version: '',
  details: ''
})

const connections = ref([])

const defaultSettings = {
  port: 22,
  allowRootLogin: false,
  passwordAuthentication: true,
  publicKeyAuthentication: true,
  tcpForwarding: false,
  compression: false,
  maxSessions: 10,
  additionalOptions: ''
}

const settings = ref({ ...defaultSettings })
const quickPort = ref(22)
const quickRootAccess = ref(false)

// Aktualizuj czas ostatniej aktualizacji
const updateLastUpdateTime = () => {
  lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Funkcje pomocnicze
const getConnectionStateType = (state) => {
  if (!state) return 'info'
  if (state.includes('ESTAB')) return 'success'
  if (state.includes('TIME_WAIT')) return 'warning'
  return 'info'
}

const copyStatusOutput = () => {
  navigator.clipboard.writeText(serviceStatus.value.details)
    .then(() => ElMessage.success(t('sshSettings.copied')))
    .catch(() => ElMessage.error(t('sshSettings.copyError')))
}

const openQuickConfig = () => {
  quickPort.value = settings.value.port
  quickRootAccess.value = settings.value.allowRootLogin
  quickConfigVisible.value = true
}

const applyQuickConfig = async () => {
  try {
    settings.value.port = quickPort.value
    settings.value.allowRootLogin = quickRootAccess.value
    await saveSettings()
    quickConfigVisible.value = false
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const exportConnections = () => {
  const data = JSON.stringify(connections.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ssh-connections-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success(t('sshSettings.exported'))
}

const killConnection = async (pid) => {
  try {
    await ElMessageBox.confirm(
      t('sshSettings.confirmKillConnection', { pid }),
      t('sshSettings.warning'),
      {
        confirmButtonText: t('sshSettings.confirm'),
        cancelButtonText: t('sshSettings.cancel'),
        type: 'warning'
      }
    )
    
    const response = await axios.post('/services/ssh/kill-connection', { pid })
    
    if (response.data.success) {
      ElMessage.success(t('sshSettings.connectionKilled'))
      await loadConnections()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message)
    }
  }
}

// Funkcje API
const loadServiceStatus = async () => {
  try {
    statusLoading.value = true
    const response = await axios.get('/services/ssh/status')
    serviceStatus.value = response.data
    updateLastUpdateTime()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    statusLoading.value = false
  }
}

const loadSettings = async () => {
  try {
    const response = await axios.get('/services/ssh/config')
    if (response.data.config) {
      settings.value = { ...defaultSettings, ...response.data.config }
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  }
}

const loadConnections = async () => {
  try {
    connectionsLoading.value = true
    const response = await axios.get('/services/ssh/connections')
    connections.value = response.data.connections || []
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    connectionsLoading.value = false
  }
}

const toggleService = async () => {
  try {
    statusLoading.value = true
    const action = serviceStatus.value.active ? 'start' : 'stop'
    const response = await axios.post('/services/ssh/toggle', { action })
    
    if (response.data.success) {
      ElMessage.success(t('sshSettings.serviceToggleSuccess', { action }))
      await loadServiceStatus()
    }
  } catch (error) {
    serviceStatus.value.active = !serviceStatus.value.active
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    statusLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    saveLoading.value = true
    const response = await axios.post('/services/ssh/config', {
      config: settings.value
    })
    
    if (response.data.success) {
      ElMessage.success(t('sshSettings.settingsSaved'))
      await loadServiceStatus()
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    saveLoading.value = false
  }
}

const resetSettings = () => {
  settings.value = { ...defaultSettings }
  ElMessage.info(t('sshSettings.settingsReset'))
}

// Interval dla automatycznego odświeżania połączeń
let connectionsInterval = null

onMounted(() => {
  loadServiceStatus()
  loadSettings()
  loadConnections()
  
  // Automatyczne odświeżanie połączeń co 30 sekund
  connectionsInterval = setInterval(() => {
    if (activeTab.value === 'connections' && serviceStatus.value.active) {
      loadConnections()
    }
  }, 30000)
})

// Cleanup
onUnmounted(() => {
  if (connectionsInterval) {
    clearInterval(connectionsInterval)
  }
})
</script>

<style scoped lang="scss">
.ssh-settings-modern {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Nagłówek panelu */
.ssh-header-panel {
  margin-bottom: 24px;
}

.service-card {
  border-radius: 16px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-dark);
  }

  &:deep(.el-card__body) {
    padding: 0;
  }
}

.service-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: transparent;
}

.service-icon-container {
  position: relative;
  flex-shrink: 0;
}

.service-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.3);
}

.service-status-badge {
  position: absolute;
  top: -6px;
  right: -6px;
}

.status-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.service-info {
  flex: 1;
  min-width: 0;
}

.service-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.service-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
}

.version-info,
.port-info,
.update-time {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.service-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 180px;
}

.service-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.toggle-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.service-buttons {
  display: flex;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

/* Konfiguracja */
.config-section {
  margin-bottom: 24px;
}

.compact-tabs {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-bg-color);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.compact-tabs .el-tabs__header) {
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  margin-bottom: 0;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.compact-tabs .el-tabs__item) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 0 24px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s ease;
  
  &:hover {
    color: var(--el-color-primary);
  }
}

:deep(.compact-tabs .el-tabs__item.is-active) {
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border-radius: 12px 12px 0 0;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
    border-radius: 2px;
  }
}

.tab-content {
  padding: 24px;
}

.compact-card {
  border: none;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    box-shadow: var(--el-box-shadow-light);
  }
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.config-group {
  padding: 20px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.config-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
}

.config-switch-wrapper {
  margin: 4px 0;
}

.compact-input {
  width: 100%;
}

.config-hint {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.warning-hint {
  color: var(--el-color-warning);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.advanced-options {
  margin-top: 24px;
  padding: 20px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.advanced-options-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.advanced-textarea {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.4;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.save-btn {
  min-width: 140px;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border: none;
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(var(--el-color-primary-rgb), 0.3);
  }
}

.reset-btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

/* Status */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.status-card {
  background: var(--el-fill-color-light);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
  }
}

.status-icon {
  color: var(--el-color-primary);
}

.status-details {
  padding: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }
}

.status-item:last-child {
  margin-bottom: 0;
  border-bottom: none;
}

.status-item label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.status-value-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-value {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.875rem;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.logs-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logs-container {
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

.status-output {
  margin: 0;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  max-height: 300px;
  color: var(--el-text-color-primary);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(0, 0, 0, 0.2);
  }
}

.logs-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-fill-color-lighter);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.log-action-btn {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Połączenia */
.connections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.connections-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.connections-info h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.connections-count {
  font-weight: 600;
}

.connections-actions {
  display: flex;
  gap: 8px;
}

.connection-action-btn {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  text-align: center;
  padding: 60px 24px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
  border: 2px dashed color-mix(in srgb, var(--el-border-color) 50%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.connection-card {
  background: var(--el-fill-color-light);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-4px);
    box-shadow: var(--el-box-shadow-light);
  }
  
  &.connection-card-system {
    border-left: 4px solid var(--el-color-danger);
  }
}

.connection-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.connection-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  border-radius: 10px;
  color: white;
  flex-shrink: 0;
}

.conn-user {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conn-username {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--el-text-color-primary);
}

.conn-state {
  font-weight: 500;
  padding: 2px 8px;
}

.conn-pid {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', monospace;
  background: var(--el-fill-color-lighter);
  padding: 2px 8px;
  border-radius: 4px;
}

.connection-details {
  margin-bottom: 16px;
}

.conn-address {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.address-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.address-item label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.address-value {
  font-family: 'SF Mono', monospace;
  font-size: 0.75rem;
  color: var(--el-text-color-primary);
  font-weight: 500;
  background: var(--el-fill-color-lighter);
  padding: 4px 8px;
  border-radius: 4px;
}

.conn-meta {
  display: flex;
  gap: 20px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.connection-actions {
  position: absolute;
  top: 16px;
  right: 16px;
}

.kill-btn {
  width: 28px;
  height: 28px;
  
  &:hover {
    transform: scale(1.1);
  }
}

/* Modal */
.quick-config-modal :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.quick-form {
  padding: 0 24px;
}

.dialog-btn {
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 8px;
}

/* Responsywność */
@media (max-width: 1200px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ssh-settings-modern {
    padding: 16px;
  }
  
  .service-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    gap: 16px;
  }
  
  .service-actions {
    align-items: center;
    min-width: auto;
  }
  
  .service-toggle {
    align-items: center;
  }
  
  .connections-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .connections-actions {
    justify-content: flex-end;
  }
  
  .connections-grid {
    grid-template-columns: 1fr;
  }
  
  .config-actions {
    flex-direction: column;
  }
  
  .config-actions .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .service-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .conn-address {
    flex-direction: column;
    align-items: stretch;
  }
  
  .address-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .quick-config-modal {
    width: 95%;
  }
}

/* Animacje */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.connection-card {
  animation: fadeInUp 0.3s ease;
}

/* Focus styles for accessibility */
.action-btn:focus-visible,
.save-btn:focus-visible,
.reset-btn:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
  
  &:hover {
    background: var(--el-color-primary);
  }
}

:global(.dark) ::-webkit-scrollbar-track,
:global(body.dark) ::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

:global(.dark) ::-webkit-scrollbar-thumb,
:global(body.dark) ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>
