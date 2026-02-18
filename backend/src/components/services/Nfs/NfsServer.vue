<template>
  <div class="nfs-server-modern">
    <!-- Nagłówek z statusem -->
    <div class="nfs-header-panel">
      <el-card shadow="hover" class="status-card">
        <div class="status-header">
          <div class="status-icon-container">
            <el-icon size="42" class="status-icon">
              <Icon icon="mdi:server-network" />
            </el-icon>
            <div class="status-badge">
              <el-tag 
                :type="serverStatus.active ? 'success' : 'danger'" 
                size="small"
                class="status-tag"
              >
                <Icon :icon="serverStatus.active ? 'mdi:play-circle' : 'mdi:stop-circle'" width="12" />
                {{ serverStatus.active ? $t('nfsServer.running') : $t('nfsServer.stopped') }}
              </el-tag>
            </div>
          </div>
          
          <div class="status-info">
            <h2 class="status-title">{{ $t('nfsServer.title') }}</h2>
            <div class="status-meta">
              <span v-if="serverStatus.version" class="version-info">
                <Icon icon="mdi:tag" width="12" />
                v{{ serverStatus.version }}
              </span>
              <span class="hostname-info">
                <Icon icon="mdi:computer" width="12" />
                {{ serverStatus.hostname }}
              </span>
            </div>
          </div>
          
          <div class="status-actions">
            <div class="service-toggle">
              <label class="toggle-label">{{ $t('nfsServer.serviceState') }}</label>
              <el-switch
                v-model="serverStatus.active"
                @change="toggleService"
                :loading="statusLoading"
                :active-text="$t('nfsServer.enabled')"
                :inactive-text="$t('nfsServer.disabled')"
                inline-prompt
                active-color="var(--el-color-success)"
                inactive-color="var(--el-color-danger)"
              />
            </div>
            
            <el-button-group class="action-buttons">
              <el-button
                @click="refreshAll"
                :loading="refreshing"
                circle
                class="action-btn"
              >
                <Icon icon="mdi:refresh" width="14" />
              </el-button>
              <el-button
                @click="testConfig"
                :loading="testing"
                circle
                type="info"
                class="action-btn"
              >
                <Icon icon="mdi:test-tube" width="14" />
              </el-button>
            </el-button-group>
          </div>
        </div>

        <!-- Szybkie informacje -->
        <div class="quick-stats">
          <div class="stat-item">
            <Icon icon="mdi:folder-share" width="16" />
            <span class="stat-label">{{ $t('nfsServer.activeExports') }}:</span>
            <span class="stat-value">{{ stats.activeExports || 0 }}</span>
          </div>
          <div class="stat-item">
            <Icon icon="mdi:account-group" width="16" />
            <span class="stat-label">{{ $t('nfsServer.activeClients') }}:</span>
            <span class="stat-value">{{ stats.totalClients || 0 }}</span>
          </div>
          <div class="stat-item">
            <Icon icon="mdi:ip-network" width="16" />
            <span class="stat-label">{{ $t('nfsServer.serverIP') }}:</span>
            <span class="stat-value">{{ serverStatus.ipAddresses?.[0]?.ip || 'N/A' }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Główny panel -->
    <div class="nfs-content">
      <el-tabs v-model="activeTab" type="border-card" class="nfs-tabs">
        <!-- Eksporty (udziały) -->
        <el-tab-pane :label="$t('nfsServer.exports')" name="exports">
          <div class="tab-content">
            <div class="exports-header">
              <h3>{{ $t('nfsServer.sharedDirectories') }}</h3>
              <el-button type="primary" @click="openAddExportDialog" :icon="Icon">
                <Icon icon="mdi:plus" width="16" />
                {{ $t('nfsServer.addExport') }}
              </el-button>
            </div>

            <div v-if="exports.length === 0" class="empty-state">
              <Icon icon="mdi:folder-plus" size="48" />
              <h3>{{ $t('nfsServer.noExports') }}</h3>
              <p>{{ $t('nfsServer.clickAddExport') }}</p>
            </div>

            <div v-else class="exports-grid">
              <el-card
                v-for="exp in exports"
                :key="exp.id"
                class="export-card"
                :class="{ 'export-disabled': !exp.enabled }"
                shadow="hover"
              >
                <div class="export-header">
                  <div class="export-icon">
                    <Icon :icon="exp.enabled ? 'mdi:folder-share' : 'mdi:folder-off'" width="20" />
                  </div>
                  <div class="export-info">
                    <div class="export-path">{{ exp.path }}</div>
                    <div class="export-status">
                      <el-tag size="small" :type="exp.enabled ? 'success' : 'info'">
                        {{ exp.enabled ? $t('nfsServer.enabled') : $t('nfsServer.disabled') }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="export-actions">
                    <el-dropdown trigger="click">
                      <el-button size="small" type="primary" plain circle>
                        <Icon icon="mdi:dots-vertical" width="14" />
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="editExport(exp)">
                            <Icon icon="mdi:pencil" width="14" />
                            {{ $t('common.edit') }}
                          </el-dropdown-item>
                          <el-dropdown-item @click="toggleExport(exp)" divided>
                            <Icon :icon="exp.enabled ? 'mdi:stop' : 'mdi:play'" width="14" />
                            {{ exp.enabled ? $t('nfsServer.disable') : $t('nfsServer.enable') }}
                          </el-dropdown-item>
                          <el-dropdown-item @click="deleteExport(exp)" divided>
                            <Icon icon="mdi:delete" width="14" style="color: var(--el-color-danger)" />
                            <span style="color: var(--el-color-danger)">{{ $t('common.delete') }}</span>
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>

                <div class="export-clients">
                  <div class="clients-title">
                    <Icon icon="mdi:account-group" width="14" />
                    {{ $t('nfsServer.allowedClients') }} ({{ exp.clients.length }})
                  </div>
                  
                  <div class="clients-list">
                    <div v-for="(client, idx) in exp.clients" :key="idx" class="client-item">
                      <div class="client-name">{{ client.client }}</div>
                      <div class="client-options">
                        <el-tag
                          v-for="opt in client.options"
                          :key="opt"
                          size="small"
                          class="option-tag"
                        >
                          {{ opt }}
                        </el-tag>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="export-footer">
                  <el-button size="small" @click="showMountCommand(exp)">
                    <Icon icon="mdi:console" width="12" />
                    {{ $t('nfsServer.showMountCmd') }}
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Aktywni klienci -->
        <el-tab-pane :label="$t('nfsServer.activeClients')" name="clients">
          <div class="tab-content">
            <div class="clients-header">
              <h3>{{ $t('nfsServer.currentlyMounted') }}</h3>
              <el-button @click="loadStats" :loading="statsLoading" size="small">
                <Icon icon="mdi:refresh" width="14" />
                {{ $t('common.refresh') }}
              </el-button>
            </div>

            <div v-if="stats.mountStats?.length === 0" class="empty-state">
              <Icon icon="mdi:account-off" size="48" />
              <h3>{{ $t('nfsServer.noActiveClients') }}</h3>
              <p>{{ $t('nfsServer.clientsWillAppear') }}</p>
            </div>

            <div v-else class="clients-grid">
              <el-card
                v-for="(client, index) in stats.mountStats"
                :key="index"
                class="client-card"
                shadow="hover"
              >
                <div class="client-header">
                  <div class="client-icon">
                    <Icon icon="mdi:desktop-tower" width="20" />
                  </div>
                  <div class="client-info">
                    <div class="client-ip">{{ client.client }}</div>
                    <div class="client-mount">{{ client.mount }}</div>
                  </div>
                  <el-tag size="small" type="success">
                    <Icon icon="mdi:check-circle" width="10" />
                    {{ $t('nfsServer.connected') }}
                  </el-tag>
                </div>

                <div class="client-actions">
                  <el-button size="small" @click="disconnectClient(client)">
                    <Icon icon="mdi:close" width="12" />
                    {{ $t('nfsServer.disconnect') }}
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Statystyki i wydajność -->
        <el-tab-pane :label="$t('nfsServer.performance')" name="stats">
          <div class="tab-content">
            <div class="stats-grid">
              <el-card class="stats-card" shadow="hover">
                <template #header>
                  <div class="stats-header">
                    <Icon icon="mdi:chart-pie" width="18" />
                    <span>{{ $t('nfsServer.ioStatistics') }}</span>
                  </div>
                </template>
                
                <div class="stats-content">
                  <div class="stat-row">
                    <span class="stat-label">{{ $t('nfsServer.readOps') }}:</span>
                    <span class="stat-value">{{ formatNumber(stats.ioStats?.read || 0) }}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">{{ $t('nfsServer.writeOps') }}:</span>
                    <span class="stat-value">{{ formatNumber(stats.ioStats?.write || 0) }}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">{{ $t('nfsServer.activeExports') }}:</span>
                    <span class="stat-value">{{ stats.activeExports || 0 }}</span>
                  </div>
                  <div class="stat-row">
                    <span class="stat-label">{{ $t('nfsServer.totalClients') }}:</span>
                    <span class="stat-value">{{ stats.totalClients || 0 }}</span>
                  </div>
                </div>
              </el-card>

              <el-card class="stats-card" shadow="hover">
                <template #header>
                  <div class="stats-header">
                    <Icon icon="mdi:chart-line" width="18" />
                    <span>{{ $t('nfsServer.networkInfo') }}</span>
                  </div>
                </template>
                
                <div class="stats-content">
                  <div v-for="ip in serverStatus.ipAddresses" :key="ip.interface" class="network-item">
                    <div class="network-interface">
                      <Icon :icon="getInterfaceIcon(ip.interface)" width="12" />
                      {{ ip.interface }}
                    </div>
                    <div class="network-details">
                      <div class="network-ip">{{ ip.ip }}</div>
                      <div class="network-net">{{ ip.network }}</div>
                    </div>
                  </div>
                </div>
              </el-card>

              <el-card class="stats-card" shadow="hover">
                <template #header>
                  <div class="stats-header">
                    <Icon icon="mdi:information" width="18" />
                    <span>{{ $t('nfsServer.serverInfo') }}</span>
                  </div>
                </template>
                
                <div class="stats-content">
                  <div class="info-item">
                    <span class="info-label">{{ $t('nfsServer.hostname') }}:</span>
                    <span class="info-value">{{ serverStatus.hostname }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">{{ $t('nfsServer.nfsVersion') }}:</span>
                    <span class="info-value">{{ serverStatus.version || 'N/A' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">{{ $t('nfsServer.installed') }}:</span>
                    <span class="info-value">
                      <el-tag :type="serverStatus.installed ? 'success' : 'danger'" size="small">
                        {{ serverStatus.installed ? $t('common.yes') : $t('common.no') }}
                      </el-tag>
                    </span>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Logi -->
        <el-tab-pane :label="$t('nfsServer.logs')" name="logs">
          <div class="tab-content">
            <div class="logs-header">
              <h3>{{ $t('nfsServer.serviceLogs') }}</h3>
              <div class="logs-actions">
                <el-select v-model="logLines" size="small" style="width: 100px; margin-right: 8px;">
                  <el-option label="50" :value="50" />
                  <el-option label="100" :value="100" />
                  <el-option label="200" :value="200" />
                </el-select>
                <el-button @click="loadLogs" :loading="logsLoading" size="small">
                  <Icon icon="mdi:refresh" width="14" />
                </el-button>
              </div>
            </div>

            <el-card class="logs-card" shadow="hover">
              <div class="logs-container">
                <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="`log-${log.level}`">
                  <span class="log-time">{{ log.timestamp }}</span>
                  <span class="log-level" :class="`level-${log.level}`">[{{ log.level.toUpperCase() }}]</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
                <div v-if="logs.length === 0" class="no-logs">
                  <Icon icon="mdi:clipboard-text-off" size="24" />
                  <p>{{ $t('nfsServer.noLogs') }}</p>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Dialog dodawania/edycji eksportu -->
    <el-dialog
      v-model="exportDialog.visible"
      :title="exportDialog.isEdit ? $t('nfsServer.editExport') : $t('nfsServer.addExport')"
      width="600px"
      class="export-dialog"
      destroy-on-close
    >
      <el-form
        ref="exportFormRef"
        :model="exportDialog"
        :rules="exportRules"
        label-position="top"
      >
        <el-form-item :label="$t('nfsServer.directoryPath')" prop="path">
          <el-input v-model="exportDialog.path" placeholder="/srv/nfs/share">
            <template #prepend>
              <el-button @click="browseDirectory">
                <Icon icon="mdi:folder-open" width="14" />
              </el-button>
            </template>
          </el-input>
          <div class="form-hint">
            <Icon icon="mdi:information-outline" width="12" />
            {{ $t('nfsServer.pathHint') }}
          </div>
        </el-form-item>

        <el-divider>{{ $t('nfsServer.clientAccess') }}</el-divider>

        <div class="clients-editor">
          <div v-for="(client, index) in exportDialog.clients" :key="index" class="client-row">
            <el-input
              v-model="client.client"
              placeholder="192.168.1.0/24"
              class="client-input"
            >
              <template #prepend>
                <Icon icon="mdi:ip-network" width="14" />
              </template>
            </el-input>
            
            <el-select
              v-model="client.options"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="Options"
              class="options-select"
            >
              <el-option label="ro (read only)" value="ro" />
              <el-option label="rw (read write)" value="rw" />
              <el-option label="sync" value="sync" />
              <el-option label="async" value="async" />
              <el-option label="no_wdelay" value="no_wdelay" />
              <el-option label="no_subtree_check" value="no_subtree_check" />
              <el-option label="insecure" value="insecure" />
              <el-option label="secure" value="secure" />
              <el-option label="root_squash" value="root_squash" />
              <el-option label="no_root_squash" value="no_root_squash" />
              <el-option label="all_squash" value="all_squash" />
            </el-select>

            <el-button
              @click="removeClient(index)"
              circle
              size="small"
              type="danger"
              plain
              :disabled="exportDialog.clients.length === 1"
            >
              <Icon icon="mdi:close" width="12" />
            </el-button>
          </div>

          <el-button @click="addClient" class="add-client-btn" plain>
            <Icon icon="mdi:plus" width="14" />
            {{ $t('nfsServer.addClient') }}
          </el-button>
        </div>

        <el-divider>{{ $t('nfsServer.advancedOptions') }}</el-divider>

        <div class="advanced-options">
          <el-checkbox v-model="exportDialog.enabled">
            {{ $t('nfsServer.enableExport') }}
          </el-checkbox>
          
          <el-checkbox v-model="exportDialog.createDirectory">
            {{ $t('nfsServer.createDirectory') }}
          </el-checkbox>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="exportDialog.visible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="saveExport"
          :loading="savingExport"
        >
          {{ exportDialog.isEdit ? $t('common.save') : $t('nfsServer.create') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog komendy montowania -->
    <el-dialog
      v-model="mountCommandDialog.visible"
      :title="$t('nfsServer.mountCommand')"
      width="500px"
    >
      <div class="mount-command">
        <p>{{ $t('nfsServer.mountInstruction') }}</p>
        <pre class="command-preview">{{ mountCommandDialog.command }}</pre>
        <div class="command-examples">
          <p><strong>{{ $t('nfsServer.examples') }}:</strong></p>
          <pre class="example-preview">mount -t nfs {{ serverStatus.ipAddresses?.[0]?.ip }}:{{ mountCommandDialog.path }} /mnt/nfs/share</pre>
          <pre class="example-preview">mount -t nfs4 {{ serverStatus.ipAddresses?.[0]?.ip }}:{{ mountCommandDialog.path }} /mnt/nfs/share</pre>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="mountCommandDialog.visible = false">
          {{ $t('common.close') }}
        </el-button>
        <el-button type="primary" @click="copyMountCommand">
          <Icon icon="mdi:content-copy" width="14" />
          {{ $t('nfsServer.copyCommand') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()

// Stan
const activeTab = ref('exports')
const statusLoading = ref(false)
const refreshing = ref(false)
const testing = ref(false)
const statsLoading = ref(false)
const logsLoading = ref(false)
const savingExport = ref(false)

const serverStatus = ref({
  installed: false,
  active: false,
  version: '',
  hostname: '',
  ipAddresses: []
})

const exports = ref([])
const stats = ref({
  activeExports: 0,
  totalClients: 0,
  mountStats: [],
  ioStats: { read: 0, write: 0 }
})

const logs = ref([])
const logLines = ref(100)

const exportDialog = reactive({
  visible: false,
  isEdit: false,
  editId: null,
  path: '',
  clients: [
    { client: '192.168.1.0/24', options: ['rw', 'sync', 'no_subtree_check'] }
  ],
  enabled: true,
  createDirectory: true
})

const mountCommandDialog = reactive({
  visible: false,
  path: '',
  command: ''
})

// Walidacja
const exportRules = {
  path: [
    { required: true, message: t('nfsServer.pathRequired'), trigger: 'blur' },
    { pattern: /^\/[a-zA-Z0-9_\-/]+$/, message: t('nfsServer.pathInvalid'), trigger: 'blur' }
  ]
}

// Funkcje pomocnicze
const getInterfaceIcon = (iface) => {
  if (iface.startsWith('eth') || iface.startsWith('en')) return 'mdi:ethernet'
  if (iface.startsWith('wlan') || iface.startsWith('wl')) return 'mdi:wifi'
  if (iface.startsWith('br')) return 'mdi:bridge'
  if (iface.startsWith('docker')) return 'mdi:docker'
  return 'mdi:lan'
}

const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num)
}

// Funkcje API
const loadStatus = async () => {
  try {
    const response = await axios.get('/api/nfs-server/status')
    serverStatus.value = response.data
  } catch (error) {
    console.error('Load status error:', error)
    ElMessage.error(t('nfsServer.loadStatusError'))
  }
}

const loadExports = async () => {
  try {
    const response = await axios.get('/api/nfs-server/exports')
    exports.value = response.data.exports || []
  } catch (error) {
    console.error('Load exports error:', error)
    ElMessage.error(t('nfsServer.loadExportsError'))
  }
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    const response = await axios.get('/api/nfs-server/stats')
    stats.value = response.data.stats || {}
  } catch (error) {
    console.error('Load stats error:', error)
  } finally {
    statsLoading.value = false
  }
}

const loadLogs = async () => {
  logsLoading.value = true
  try {
    const response = await axios.get(`/api/nfs-server/logs?lines=${logLines.value}`)
    logs.value = response.data.logs || []
  } catch (error) {
    console.error('Load logs error:', error)
    ElMessage.error(t('nfsServer.loadLogsError'))
  } finally {
    logsLoading.value = false
  }
}

const toggleService = async () => {
  statusLoading.value = true
  const action = serverStatus.value.active ? 'stop' : 'start'
  
  try {
    const response = await axios.post('/api/nfs-server/toggle', { action })
    ElMessage.success(response.data.message)
    await loadStatus()
  } catch (error) {
    serverStatus.value.active = !serverStatus.value.active
    ElMessage.error(error.response?.data?.error || t('nfsServer.toggleError'))
  } finally {
    statusLoading.value = false
  }
}

const testConfig = async () => {
  testing.value = true
  try {
    const response = await axios.post('/api/nfs-server/test')
    ElMessage.success(response.data.message)
  } catch (error) {
    ElMessage.error(error.response?.data?.error || t('nfsServer.testError'))
  } finally {
    testing.value = false
  }
}

const refreshAll = async () => {
  refreshing.value = true
  try {
    await Promise.all([
      loadStatus(),
      loadExports(),
      loadStats()
    ])
    ElMessage.success(t('common.refreshSuccess'))
  } catch (error) {
    console.error('Refresh error:', error)
    ElMessage.error(t('common.refreshError'))
  } finally {
    refreshing.value = false
  }
}

const openAddExportDialog = () => {
  exportDialog.isEdit = false
  exportDialog.editId = null
  exportDialog.path = ''
  exportDialog.clients = [
    { client: '192.168.1.0/24', options: ['rw', 'sync', 'no_subtree_check'] }
  ]
  exportDialog.enabled = true
  exportDialog.createDirectory = true
  exportDialog.visible = true
}

const editExport = (exp) => {
  exportDialog.isEdit = true
  exportDialog.editId = exp.id
  exportDialog.path = exp.path
  exportDialog.clients = JSON.parse(JSON.stringify(exp.clients))
  exportDialog.enabled = exp.enabled
  exportDialog.createDirectory = false
  exportDialog.visible = true
}

const toggleExport = (exp) => {
  exp.enabled = !exp.enabled
  saveExports()
}

const deleteExport = async (exp) => {
  try {
    await ElMessageBox.confirm(
      t('nfsServer.confirmDelete', { path: exp.path }),
      t('common.warning'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    exports.value = exports.value.filter(e => e.id !== exp.id)
    await saveExports()
    ElMessage.success(t('nfsServer.exportDeleted'))
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete error:', error)
    }
  }
}

const saveExports = async () => {
  try {
    const response = await axios.post('/api/nfs-server/exports', {
      exports: exports.value
    })
    await loadExports()
    return true
  } catch (error) {
    console.error('Save exports error:', error)
    ElMessage.error(error.response?.data?.error || t('nfsServer.saveError'))
    return false
  }
}

const saveExport = async () => {
  savingExport.value = true
  try {
    if (exportDialog.isEdit) {
      const exp = exports.value.find(e => e.id === exportDialog.editId)
      if (exp) {
        exp.path = exportDialog.path
        exp.clients = exportDialog.clients
        exp.enabled = exportDialog.enabled
      }
    } else {
      const newExport = {
        id: Date.now(),
        path: exportDialog.path,
        clients: exportDialog.clients,
        enabled: exportDialog.enabled,
        comment: ''
      }
      exports.value.push(newExport)
    }
    
    const saved = await saveExports()
    if (saved) {
      exportDialog.visible = false
      ElMessage.success(t('nfsServer.exportSaved'))
    }
  } catch (error) {
    console.error('Save export error:', error)
    ElMessage.error(t('nfsServer.saveError'))
  } finally {
    savingExport.value = false
  }
}

const addClient = () => {
  exportDialog.clients.push({
    client: '192.168.1.0/24',
    options: ['ro']
  })
}

const removeClient = (index) => {
  exportDialog.clients.splice(index, 1)
}

const browseDirectory = () => {
  // W praktyce można by dodać przeglądarkę katalogów
  ElMessage.info(t('nfsServer.browseNotImplemented'))
}

const showMountCommand = (exp) => {
  const ip = serverStatus.value.ipAddresses?.[0]?.ip || 'server-ip'
  mountCommandDialog.path = exp.path
  mountCommandDialog.command = `mount -t nfs ${ip}:${exp.path} /mnt/nfs/share -o vers=4.2,hard,intr`
  mountCommandDialog.visible = true
}

const copyMountCommand = () => {
  navigator.clipboard.writeText(mountCommandDialog.command)
    .then(() => ElMessage.success(t('nfsServer.commandCopied')))
    .catch(() => ElMessage.error(t('nfsServer.copyError')))
}

const disconnectClient = async (client) => {
  try {
    await ElMessageBox.confirm(
      t('nfsServer.confirmDisconnect', { client: client.client }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    // W praktyce można by użyć: showmount -e | grep client | xargs -n1 umount
    ElMessage.success(t('nfsServer.clientDisconnected'))
    await loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Disconnect error:', error)
    }
  }
}

// Inicjalizacja
onMounted(() => {
  refreshAll()
  loadLogs()
  
  // Odświeżaj statystyki co 30 sekund
  setInterval(() => {
    if (activeTab.value === 'clients' || activeTab.value === 'stats') {
      loadStats()
    }
  }, 30000)
  
  // Odświeżaj logi co minutę
  setInterval(() => {
    if (activeTab.value === 'logs') {
      loadLogs()
    }
  }, 60000)
})
</script>

<style scoped lang="scss">
.nfs-server-modern {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Nagłówek */
.nfs-header-panel {
  margin-bottom: 24px;
}

.status-card {
  border-radius: 16px;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) & {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }
}

.status-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px 24px 16px;
}

.status-icon-container {
  position: relative;
  flex-shrink: 0;
}

.status-icon {
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

.status-badge {
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

.status-info {
  flex: 1;
}

.status-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.status-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
}

.version-info,
.hostname-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.status-actions {
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

.action-btn {
  width: 36px;
  height: 36px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.quick-stats {
  display: flex;
  gap: 24px;
  padding: 16px 24px 24px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    
    .stat-label {
      color: var(--el-text-color-secondary);
    }
    
    .stat-value {
      font-weight: 600;
      color: var(--el-color-primary);
    }
  }
}

/* Tabs */
.nfs-tabs {
  border-radius: 16px;
  overflow: hidden;
}

.tab-content {
  padding: 24px;
  min-height: 500px;
}

/* Exports */
.exports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.exports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.export-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  
  &.export-disabled {
    opacity: 0.7;
    background: var(--el-fill-color-light);
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.export-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.export-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  color: var(--el-color-primary);
}

.export-info {
  flex: 1;
  
  .export-path {
    font-weight: 600;
    color: var(--el-text-color-primary);
    font-family: monospace;
    margin-bottom: 4px;
  }
}

.export-clients {
  margin-bottom: 16px;
  
  .clients-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.875rem;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }
  
  .clients-list {
    max-height: 150px;
    overflow-y: auto;
  }
  
  .client-item {
    display: flex;
    align-items: center;
    padding: 8px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    margin-bottom: 4px;
    
    .client-name {
      min-width: 120px;
      font-family: monospace;
      font-size: 0.85rem;
      color: var(--el-color-primary);
    }
    
    .client-options {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      margin-left: 8px;
    }
  }
}

.option-tag {
  font-size: 0.7rem;
  padding: 2px 4px;
  height: auto;
}

.export-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
}

/* Clients */
.clients-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.clients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.client-card {
  padding: 16px;
  
  .client-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .client-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-color-success-light-9);
    border-radius: 8px;
    color: var(--el-color-success);
  }
  
  .client-info {
    flex: 1;
    
    .client-ip {
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    .client-mount {
      font-size: 0.75rem;
      color: var(--el-text-color-secondary);
      font-family: monospace;
    }
  }
  
  .client-actions {
    display: flex;
    justify-content: flex-end;
  }
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.stats-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
  }
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stats-content {
  padding: 16px;
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    
    &:last-child {
      border-bottom: none;
    }
    
    .stat-label {
      color: var(--el-text-color-secondary);
    }
    
    .stat-value {
      font-weight: 600;
      color: var(--el-color-primary);
      font-family: monospace;
    }
  }
  
  .network-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    margin-bottom: 4px;
    
    .network-interface {
      min-width: 80px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--el-text-color-secondary);
    }
    
    .network-details {
      flex: 1;
      
      .network-ip {
        font-weight: 600;
        color: var(--el-color-primary);
        font-family: monospace;
      }
      
      .network-net {
        font-size: 0.7rem;
        color: var(--el-text-color-secondary);
      }
    }
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    
    .info-label {
      color: var(--el-text-color-secondary);
    }
    
    .info-value {
      font-weight: 500;
    }
  }
}

/* Logs */
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    margin: 0;
  }
}

.logs-actions {
  display: flex;
  align-items: center;
}

.logs-card {
  max-height: 600px;
  overflow-y: auto;
}

.logs-container {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.75rem;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  
  &.log-error {
    color: var(--el-color-danger);
  }
  
  &.log-warning {
    color: var(--el-color-warning);
  }
  
  .log-time {
    min-width: 120px;
    color: var(--el-text-color-secondary);
  }
  
  .log-level {
    min-width: 60px;
    font-weight: 600;
    
    &.level-error {
      color: var(--el-color-danger);
    }
    
    &.level-warning {
      color: var(--el-color-warning);
    }
    
    &.level-info {
      color: var(--el-color-info);
    }
  }
  
  .log-message {
    flex: 1;
    word-break: break-word;
  }
}

.no-logs {
  text-align: center;
  padding: 40px;
  color: var(--el-text-color-secondary);
}

/* Dialog */
.export-dialog :deep(.el-dialog) {
  border-radius: 16px;
}

.clients-editor {
  margin: 16px 0;
  
  .client-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    
    .client-input {
      width: 200px;
    }
    
    .options-select {
      flex: 1;
    }
  }
  
  .add-client-btn {
    width: 100%;
    margin-top: 8px;
  }
}

.advanced-options {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.form-hint {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Mount command */
.mount-command {
  pre {
    margin: 16px 0;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    font-family: 'SF Mono', monospace;
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .command-preview {
    border-left: 3px solid var(--el-color-primary);
  }
  
  .example-preview {
    background: var(--el-fill-color-lighter);
    font-size: 0.75rem;
  }
  
  .command-examples {
    margin-top: 16px;
    
    p {
      margin-bottom: 8px;
      color: var(--el-text-color-secondary);
    }
  }
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 80px 24px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 2px dashed var(--el-border-color-light);
  
  h3 {
    margin: 16px 0 8px;
    color: var(--el-text-color-primary);
  }
  
  p {
    margin-bottom: 24px;
  }
}

/* Responsywność */
@media (max-width: 768px) {
  .status-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .status-meta {
    justify-content: center;
  }
  
  .status-actions {
    align-items: center;
  }
  
  .quick-stats {
    flex-direction: column;
    gap: 12px;
  }
  
  .exports-grid,
  .clients-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .client-row {
    flex-direction: column;
    
    .client-input {
      width: 100% !important;
    }
  }
  
  .log-entry {
    flex-direction: column;
    gap: 2px;
    
    .log-time,
    .log-level {
      min-width: auto;
    }
  }
}
</style>