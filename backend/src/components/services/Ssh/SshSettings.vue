<template>
  <div class="ssh-settings-modern">
    <!-- Nagłówek panelu -->
    <div class="ssh-header-panel">
      <el-card shadow="never" class="service-card">
        <div class="service-header">
          <div class="service-icon-container">
            <el-icon size="36" class="service-icon">
              <Icon icon="mdi:console-network" />
            </el-icon>
            <div class="service-status-badge">
              <el-tag :type="serviceStatus.active ? 'success' : 'danger'" size="small">
                <Icon :icon="serviceStatus.active ? 'mdi:play-circle' : 'mdi:stop-circle'" />
                {{ serviceStatus.active ? $t('sshSettings.running') : $t('sshSettings.stopped') }}
              </el-tag>
            </div>
          </div>
          
          <div class="service-info">
            <h2>{{ $t('sshSettings.title') }}</h2>
            <div class="service-meta">
              <span v-if="serviceStatus.version" class="version-info">
                <Icon icon="mdi:tag" />
                v{{ serviceStatus.version }}
              </span>
              <span class="port-info">
                <Icon icon="mdi:network-port" />
                Port: {{ settings.port || 22 }}
              </span>
            </div>
          </div>
          
          <div class="service-actions">
            <div class="service-toggle">
              <label class="toggle-label">{{ $t('sshSettings.serviceState') }}</label>
              <el-switch
                v-model="serviceStatus.active"
                :active-text="$t('sshSettings.enabled')"
                :inactive-text="$t('sshSettings.disabled')"
                @change="toggleService"
                :loading="statusLoading"
                active-color="#13ce66"
                inactive-color="#ff4949"
              />
            </div>
            
            <el-button-group>
              <el-button
                @click="loadServiceStatus"
                :loading="statusLoading"
                size="small"
                circle
              >
                <Icon icon="mdi:refresh" />
              </el-button>
              <el-button
                @click="openQuickConfig"
                size="small"
                circle
                type="primary"
              >
                <Icon icon="mdi:cog" />
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
            <el-card shadow="never" class="compact-card">
              <div class="config-grid">
                <div class="config-group">
                  <h4>{{ $t('sshSettings.connectionSettings') }}</h4>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.port') }}</label>
                    <el-input-number
                      v-model="settings.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                      class="compact-input"
                    />
                  </div>
                </div>

                <div class="config-group">
                  <h4>{{ $t('sshSettings.authentication') }}</h4>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.passwordAuth') }}</label>
                    <el-switch
                      v-model="settings.passwordAuthentication"
                      :active-text="$t('sshSettings.enabled')"
                      :inactive-text="$t('sshSettings.disabled')"
                      inline-prompt
                      active-color="#13ce66"
                    />
                    <div class="config-hint">{{ $t('sshSettings.passwordAuthHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.publicKeyAuth') }}</label>
                    <el-switch
                      v-model="settings.publicKeyAuthentication"
                      :active-text="$t('sshSettings.enabled')"
                      :inactive-text="$t('sshSettings.disabled')"
                      inline-prompt
                      active-color="#13ce66"
                    />
                    <div class="config-hint">{{ $t('sshSettings.publicKeyAuthHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.rootLogin') }}</label>
                    <el-switch
                      v-model="settings.allowRootLogin"
                      :active-text="$t('sshSettings.enabled')"
                      :inactive-text="$t('sshSettings.disabled')"
                      inline-prompt
                      active-color="#ff4949"
                      inactive-color="#13ce66"
                    />
                    <div class="config-hint warning-hint">
                      <Icon icon="mdi:alert" />
                      {{ $t('sshSettings.rootLoginHint') }}
                    </div>
                  </div>
                </div>

                <div class="config-group">
                  <h4>{{ $t('sshSettings.advancedSettings') }}</h4>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.tcpForwarding') }}</label>
                    <el-switch
                      v-model="settings.tcpForwarding"
                      :active-text="$t('sshSettings.enabled')"
                      :inactive-text="$t('sshSettings.disabled')"
                      inline-prompt
                      active-color="#13ce66"
                    />
                    <div class="config-hint">{{ $t('sshSettings.tcpForwardingHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('sshSettings.compression') }}</label>
                    <el-switch
                      v-model="settings.compression"
                      :active-text="$t('sshSettings.enabled')"
                      :inactive-text="$t('sshSettings.disabled')"
                      inline-prompt
                      active-color="#13ce66"
                    />
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
                  </div>
                </div>
              </div>
              
              <div class="advanced-options">
                <h4>{{ $t('sshSettings.additionalOptions') }}</h4>
                <el-input
                  v-model="settings.additionalOptions"
                  type="textarea"
                  :rows="4"
                  :placeholder="$t('sshSettings.additionalOptionsPlaceholder')"
                  class="advanced-textarea"
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
                  <Icon icon="mdi:content-save" />
                  {{ $t('sshSettings.saveSettings') }}
                </el-button>
                <el-button
                  @click="resetSettings"
                  size="large"
                >
                  <Icon icon="mdi:restore" />
                  {{ $t('sshSettings.reset') }}
                </el-button>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- Status usługi -->
        <el-tab-pane :label="$t('sshSettings.serviceStatus')" name="status">
          <div class="tab-content">
            <el-card shadow="never" class="compact-card">
              <div class="status-grid">
                <div class="status-card">
                  <div class="status-header">
                    <Icon icon="mdi:information" size="24" class="status-icon" />
                    <h4>{{ $t('sshSettings.serviceDetails') }}</h4>
                  </div>
                  
                  <div class="status-details">
                    <div class="status-item">
                      <label>{{ $t('sshSettings.status') }}</label>
                      <el-tag :type="serviceStatus.active ? 'success' : 'danger'">
                        <Icon :icon="serviceStatus.active ? 'mdi:check-circle' : 'mdi:close-circle'" />
                        {{ serviceStatus.active ? $t('sshSettings.running') : $t('sshSettings.stopped') }}
                      </el-tag>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.version') }}</label>
                      <span class="status-value">{{ serviceStatus.version || 'N/A' }}</span>
                    </div>
                    
                    <div class="status-item">
                      <label>{{ $t('sshSettings.installed') }}</label>
                      <el-tag :type="serviceStatus.installed ? 'success' : 'warning'">
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
                    <Icon icon="mdi:clipboard-text" size="24" class="status-icon" />
                    <h4>{{ $t('sshSettings.statusOutput') }}</h4>
                  </div>
                  
                  <div class="logs-container">
                    <pre class="status-output">{{ serviceStatus.details || $t('sshSettings.noStatusData') }}</pre>
                  </div>
                  
                  <div class="logs-actions">
                    <el-button
                      @click="copyStatusOutput"
                      size="small"
                    >
                      <Icon icon="mdi:content-copy" />
                      {{ $t('sshSettings.copy') }}
                    </el-button>
                    <el-button
                      @click="loadServiceStatus"
                      :loading="statusLoading"
                      size="small"
                    >
                      <Icon icon="mdi:refresh" />
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
            <el-card shadow="never" class="compact-card">
              <div class="connections-header">
                <div class="connections-info">
                  <h4>{{ $t('sshSettings.currentConnections') }}</h4>
                  <el-tag v-if="connections.length > 0" type="info" size="small">
                    {{ connections.length }} {{ $t('sshSettings.connections') }}
                  </el-tag>
                </div>
                
                <div class="connections-actions">
                  <el-button
                    @click="loadConnections"
                    :loading="connectionsLoading"
                    size="small"
                  >
                    <Icon icon="mdi:refresh" />
                    {{ $t('sshSettings.refresh') }}
                  </el-button>
                  <el-button
                    @click="exportConnections"
                    size="small"
                    plain
                  >
                    <Icon icon="mdi:download" />
                    {{ $t('sshSettings.export') }}
                  </el-button>
                </div>
              </div>
              
              <div v-if="connections.length === 0" class="empty-state">
                <Icon icon="mdi:connection-off" size="48" />
                <p>{{ $t('sshSettings.noConnections') }}</p>
              </div>
              
              <div v-else class="connections-grid">
                <div v-for="conn in connections" :key="conn.pid" class="connection-card">
                  <div class="connection-header">
                    <Icon icon="mdi:account-network" size="20" class="conn-icon" />
                    <div class="conn-user">
                      <span class="conn-username">{{ conn.user || 'unknown' }}</span>
                      <el-tag :type="getConnectionStateType(conn.state)" size="small">
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
                        <Icon icon="mdi:clock-outline" />
                        <span>{{ conn.duration || 'N/A' }}</span>
                      </div>
                      <div class="meta-item">
                        <Icon icon="mdi:memory" />
                        <span>{{ conn.memory || 'N/A' }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="connection-actions">
                    <el-tooltip :content="$t('sshSettings.killConnection')">
                      <el-button
                        @click="killConnection(conn.pid)"
                        size="small"
                        type="danger"
                        circle
                        plain
                      >
                        <Icon icon="mdi:close" />
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
      <el-form label-position="top">
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
            :active-text="$t('sshSettings.yes')"
            :inactive-text="$t('sshSettings.no')"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="quickConfigVisible = false">
          {{ $t('sshSettings.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="applyQuickConfig"
        >
          {{ $t('sshSettings.apply') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'  // DODAJ onUnmounted
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

<style scoped>
.ssh-settings-modern {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Nagłówek panelu */
.ssh-header-panel {
  margin-bottom: 24px;
}

.service-card {
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.service-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
}

.service-icon-container {
  position: relative;
}

.service-icon {
  color: var(--el-color-primary);
  background: white;
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.service-status-badge {
  position: absolute;
  top: -8px;
  right: -8px;
}

.service-info {
  flex: 1;
}

.service-info h2 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.service-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.version-info,
.port-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.service-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 200px;
}

.service-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.toggle-label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

/* Konfiguracja */
.config-section {
  margin-bottom: 24px;
}

.compact-tabs {
  border-radius: 12px;
  overflow: hidden;
}

.tab-content {
  padding: 16px;
}

.compact-card {
  border: none;
  border-radius: 12px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.config-group {
  padding: 20px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.config-group h4 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
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
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
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
  gap: 4px;
}

.advanced-options {
  margin-top: 24px;
  padding: 20px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.advanced-options h4 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
}

.advanced-textarea {
  font-family: monospace;
  font-size: 0.875rem;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.save-btn {
  min-width: 140px;
}

/* Status */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.status-card {
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-light);
}

.status-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
}

.status-icon {
  color: var(--el-color-primary);
}

.status-details {
  padding: 16px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-item label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.status-value {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--el-text-color-primary);
}

.logs-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logs-container {
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

.status-output {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  max-height: 300px;
}

.logs-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}

/* Połączenia */
.connections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
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
}

.connections-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--el-text-color-secondary);
}

.empty-state .iconify {
  color: var(--el-color-info-light-5);
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.connection-card {
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
}

.connection-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.connection-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.conn-icon {
  color: var(--el-color-primary);
}

.conn-user {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conn-username {
  font-weight: 500;
  font-size: 0.875rem;
}

.conn-pid {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.connection-details {
  margin-bottom: 12px;
}

.conn-address {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.address-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.address-item label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.address-value {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--el-text-color-primary);
}

.conn-meta {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.connection-actions {
  position: absolute;
  top: 16px;
  right: 16px;
}

/* Modal */
.quick-config-modal .el-dialog__body {
  padding: 20px;
}

/* Responsywność */
@media (max-width: 992px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .connections-grid {
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
  
  .config-actions {
    flex-direction: column;
  }
  
  .config-actions .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .conn-address {
    flex-direction: column;
    align-items: stretch;
  }
  
  .address-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
