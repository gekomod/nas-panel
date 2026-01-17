<template>
  <div class="webdav-modern">
    <!-- Główny panel statusu -->
    <div class="dashboard-header">
      <el-card shadow="never" class="status-panel">
        <div class="panel-header">
          <div class="header-left">
            <el-icon size="28" class="service-icon">
              <Icon icon="mdi:cloud-sync" />
            </el-icon>
            <div class="header-info">
              <h2>{{ $t('webdav.service') }}</h2>
              <div class="header-subtitle">
                <el-tag :type="statusClass" size="small" class="status-badge">
                  <el-icon :size="12">
                    <Icon :icon="statusIcon" />
                  </el-icon>
                  {{ statusText }}
                </el-tag>
                <span class="version-info" v-if="status.version">
                  v{{ status.version }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="service-controls">
            <el-button-group>
              <el-button
                v-if="!serviceStatus"
                type="success"
                @click="toggleService"
                :loading="serviceLoading"
                :class="{ 'pulse-animation': !serviceStatus }"
              >
                <el-icon><Icon icon="mdi:play" /></el-icon>
                {{ $t('webdav.start_service') }}
              </el-button>
              <el-button
                v-else
                type="danger"
                @click="toggleService"
                :loading="serviceLoading"
              >
                <el-icon><Icon icon="mdi:stop" /></el-icon>
                {{ $t('webdav.stop_service') }}
              </el-button>
              <el-button
                type="warning"
                @click="restartService"
                :loading="serviceLoading"
                :disabled="!serviceStatus"
              >
                <el-icon><Icon icon="mdi:restart" /></el-icon>
                {{ $t('webdav.restart_service') }}
              </el-button>
            </el-button-group>
          </div>
        </div>

        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading" :size="28">
            <Icon icon="mdi:loading" />
          </el-icon>
        </div>

        <div v-else class="connection-details">
          <div class="detail-grid">
            <div class="detail-item">
              <label>{{ $t('webdav.server_address') }}</label>
              <div class="detail-value">
                <el-tag size="large" class="address-tag">
                  {{ serverAddress }}
                </el-tag>
              </div>
            </div>
            
            <div class="detail-item">
              <label>{{ $t('webdav.port') }}</label>
              <div class="detail-value">
                <el-tag>{{ config.port }}</el-tag>
              </div>
            </div>
            
            <div class="detail-item">
              <label>{{ $t('webdav.protocol') }}</label>
              <div class="detail-value">
                <el-tag :type="config.protocol === 'https' ? 'success' : 'info'">
                  {{ config.protocol.toUpperCase() }}
                </el-tag>
              </div>
            </div>
            
            <div class="detail-item">
              <label>{{ $t('webdav.connection_url') }}</label>
              <div class="detail-value">
                <el-tag 
                  type="info" 
                  size="large" 
                  class="url-tag"
                  @click="copyToClipboard(connectionUrl)"
                >
                  {{ connectionUrl }}
                  <el-icon class="copy-btn">
                    <Icon icon="mdi:content-copy" />
                  </el-icon>
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Karty konfiguracyjne -->
    <div class="config-section">
      <el-tabs v-model="activeTab" type="border-card" class="compact-tabs">
        <el-tab-pane :label="$t('webdav.basic_config')" name="basic">
          <div class="tab-content">
            <el-card shadow="never" class="compact-card">
              <div class="config-group">
                <label class="config-label">{{ $t('webdav.service_switch') }}</label>
                <el-switch
                  v-model="config.enabled"
                  :active-text="$t('webdav.enabled')"
                  :inactive-text="$t('webdav.disabled')"
                  inline-prompt
                  active-color="#13ce66"
                  inactive-color="#ff4949"
                />
              </div>

              <el-divider />

              <div class="config-row">
                <div class="config-item">
                  <label class="config-label">{{ $t('webdav.port') }}</label>
                  <el-input-number
                    v-model="config.port"
                    :min="1"
                    :max="65535"
                    controls-position="right"
                    class="compact-input"
                  />
                </div>

                <div class="config-item">
                  <label class="config-label">{{ $t('webdav.protocol') }}</label>
                  <el-radio-group v-model="config.protocol" class="compact-radio">
                    <el-radio-button value="http">HTTP</el-radio-button>
                    <el-radio-button value="https">HTTPS</el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="$t('webdav.disk_selection')" name="disks">
          <div class="tab-content">
            <!-- Udostępnione zasoby -->
            <el-card shadow="never" class="compact-card">
              <div class="section-header">
                <el-icon size="20"><Icon icon="mdi:folder-shared" /></el-icon>
                <h3>{{ $t('webdav.shared_resources') }}</h3>
                <span class="badge-count">{{ sharedResources.length }}</span>
              </div>

              <div v-if="sharedResources.length === 0" class="empty-state">
                <el-icon size="48"><Icon icon="mdi:folder-off-outline" /></el-icon>
                <p>{{ $t('webdav.no_shared_resources') }}</p>
              </div>

              <div v-else class="shares-list">
                <div v-for="share in sharedResources" :key="share.path" class="share-item">
                  <div class="share-info">
                    <el-icon class="share-icon"><Icon icon="mdi:folder" /></el-icon>
                    <div class="share-details">
                      <div class="share-path">{{ share.path }}</div>
                      <div class="share-alias">
                        <el-input
                          v-model="share.alias"
                          size="small"
                          :placeholder="generateDefaultAlias(share)"
                          @change="updateShare(share)"
                          class="alias-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div class="share-actions">
                    <el-select
                      v-model="share.read_only"
                      @change="updateShare(share)"
                      size="small"
                      class="permission-select"
                    >
                      <el-option :value="false" :label="$t('webdav.read_write')" />
                      <el-option :value="true" :label="$t('webdav.read_only')" />
                    </el-select>
                    
                    <el-button
                      type="danger"
                      size="small"
                      :icon="Icon"
                      @click="removeShare(share)"
                      circle
                      plain
                    >
                      <Icon icon="mdi:delete-outline" />
                    </el-button>
                  </div>
                </div>
              </div>
            </el-card>

            <!-- Dostępne dyski -->
            <el-card shadow="never" class="compact-card">
              <div class="section-header">
                <el-icon size="20"><Icon icon="mdi:harddisk" /></el-icon>
                <h3>{{ $t('webdav.available_disks') }}</h3>
              </div>

              <div class="disks-grid">
                <el-card
                  v-for="disk in availableDisks"
                  :key="disk.path"
                  shadow="hover"
                  class="disk-card"
                >
                  <div class="disk-content">
                    <div class="disk-header">
                      <el-icon size="24" class="disk-icon">
                        <Icon icon="mdi:harddisk" />
                      </el-icon>
                      <div class="disk-info">
                        <h4>{{ disk.name }}</h4>
                        <div class="disk-meta">
                          <el-tag size="small" type="info">{{ disk.fsType }}</el-tag>
                          <span class="disk-size">{{ disk.size }}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="disk-path">
                      <el-icon><Icon icon="mdi:folder" /></el-icon>
                      <span>{{ disk.path }}</span>
                    </div>
                    
                    <el-button
                      type="primary"
                      size="small"
                      @click="openDirectoryBrowser(disk)"
                      class="add-share-btn"
                    >
                      <el-icon><Icon icon="mdi:folder-plus" /></el-icon>
                      {{ $t('webdav.add_share') }}
                    </el-button>
                  </div>
                </el-card>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="$t('webdav.advanced_settings')" name="advanced">
          <div class="tab-content">
            <el-card shadow="never" class="compact-card">
              <div class="advanced-grid">
                <div class="advanced-item">
                  <label class="config-label">{{ $t('webdav.allow_anonymous') }}</label>
                  <el-switch
                    v-model="config.allowAnonymous"
                    inline-prompt
                    :active-text="$t('webdav.yes')"
                    :inactive-text="$t('webdav.no')"
                  />
                </div>

                <div class="advanced-item">
                  <label class="config-label">{{ $t('webdav.read_only') }}</label>
                  <el-switch
                    v-model="config.readOnly"
                    inline-prompt
                    :active-text="$t('webdav.yes')"
                    :inactive-text="$t('webdav.no')"
                  />
                </div>

                <div class="advanced-item">
                  <label class="config-label">{{ $t('webdav.max_connections') }}</label>
                  <el-input-number
                    v-model="config.maxConnections"
                    :min="1"
                    :max="1000"
                    controls-position="right"
                    class="compact-input"
                  />
                </div>

                <div class="advanced-item">
                  <label class="config-label">{{ $t('webdav.nfs_enabled') }}</label>
                  <el-switch
                    v-model="config.nfs.enabled"
                    inline-prompt
                    active-color="#13ce66"
                  />
                  
                  <div v-if="config.nfs.enabled" class="nfs-options">
                    <label class="sub-label">{{ $t('webdav.nfs_versions') }}</label>
                    <el-select
                      v-model="selectedNfsVersions"
                      multiple
                      collapse-tags
                      collapse-tags-tooltip
                      class="nfs-select"
                    >
                      <el-option value="v2" label="NFS v2" />
                      <el-option value="v3" label="NFS v3" />
                      <el-option value="v4" label="NFS v4" />
                      <el-option value="v4_1" label="NFS v4.1" />
                      <el-option value="v4_2" label="NFS v4.2" />
                    </el-select>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Przyciski akcji -->
    <div class="action-footer">
      <el-button
        type="primary"
        @click="saveConfig"
        :loading="saving"
        size="large"
        class="save-btn"
      >
        <el-icon><Icon icon="mdi:content-save-check" /></el-icon>
        {{ $t('webdav.save_config') }}
      </el-button>
      
      <el-button
        @click="resetConfig"
        :loading="resetting"
        size="large"
      >
        <el-icon><Icon icon="mdi:restore" /></el-icon>
        {{ $t('webdav.reset') }}
      </el-button>
    </div>

    <!-- Modal wyboru katalogów -->
    <el-dialog
      v-model="directoryDialogVisible"
      :title="$t('webdav.select_directory')"
      width="500px"
      class="directory-modal"
    >
      <el-tree
        ref="directoryTreeRef"
        :data="directoryTree"
        :props="treeProps"
        :load="loadDirectories"
        lazy
        show-checkbox
        node-key="path"
        highlight-current
        @check="handleDirectorySelect"
        class="directory-tree"
      >
        <template #default="{ node, data }">
          <span class="tree-node">
            <el-icon :class="['node-icon', { 'is-leaf': node.isLeaf }]">
              <Icon :icon="node.isLeaf ? 'mdi:folder-outline' : 'mdi:folder-open-outline'" />
            </el-icon>
            <span class="node-label">{{ node.label }}</span>
          </span>
        </template>
      </el-tree>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="directoryDialogVisible = false">
            {{ $t('webdav.cancel') }}
          </el-button>
          <el-button
            type="primary"
            @click="confirmDirectorySelection"
            :disabled="selectedDirectories.length === 0"
          >
            {{ $t('webdav.add_selected') }} ({{ selectedDirectories.length }})
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElNotification, ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const { t, mergeLocaleMessage } = useI18n()

// Import tłumaczeń
import enLocales from './locales/en'
import plLocales from './locales/pl'

// Dodaj tłumaczenia do i18n
mergeLocaleMessage('en', enLocales)
mergeLocaleMessage('pl', plLocales)

// Dane usługi
const serviceStatus = ref(false)
const availableDisks = ref([])
const sharedResources = ref([])
const selectedNfsVersions = ref(['v3', 'v4'])
const loading = ref(true)
const serviceLoading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const activeTab = ref('basic')

// Zmienne dla przeglądania katalogów
const directoryDialogVisible = ref(false)
const directoryTree = ref([])
const currentDisk = ref(null)
const selectedDirectories = ref([])
const directoryTreeRef = ref(null)
const treeProps = ref({
  label: 'name',
  children: 'children',
  isLeaf: 'isLeaf'
})

const status = ref({
  installed: false,
  version: 'unknown',
  running: false,
  active: false
})

// Konfiguracja
const config = ref({
  enabled: false,
  port: 8080,
  protocol: 'http',
  allowAnonymous: false,
  readOnly: false,
  maxConnections: 50,
  shares: [],
  auth: {
    enabled: true,
    users: []
  },
  nfs: {
    enabled: false,
    versions: ['v3', 'v4']
  }
})

// Status usługi
const statusClass = computed(() => {
  return status.value.running ? 'success' : 'danger'
})

const statusIcon = computed(() => {
  return status.value.running ? 'mdi:check-circle' : 'mdi:alert-circle'
})

const statusText = computed(() => {
  return status.value.running ? t('webdav.running') : t('webdav.stopped')
})

// Adres serwera i URL
const serverAddress = window.location.hostname
const connectionUrl = computed(() => {
  return `${config.value.protocol}://${serverAddress}:${config.value.port}`
})

// Funkcje pomocnicze
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  ElMessage.success(t('webdav.copied_to_clipboard'))
}

// Funkcje zarządzania usługą (niezmienione, bo działają poprawnie)
const toggleService = async () => {
  try {
    serviceLoading.value = true
    const action = status.value.running ? 'stop' : 'start'
    const response = await axios.post('/services/webdav/toggle', { action })
    
    if (response.data.success) {
      await fetchStatus()
      ElNotification.success({
        title: t('webdav.success'),
        message: response.data.message
      })
    }
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: error.response?.data?.error || t('webdav.service_toggle_error')
    })
  } finally {
    serviceLoading.value = false
  }
}

const restartService = async () => {
  try {
    serviceLoading.value = true
    const response = await axios.post('/services/webdav/toggle', { action: 'restart' })
    
    if (response.data.success) {
      await fetchStatus()
      ElNotification.success({
        title: t('webdav.success'),
        message: response.data.message
      })
    }
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: error.response?.data?.error || t('webdav.service_restart_error')
    })
  } finally {
    serviceLoading.value = false
  }
}

const saveConfig = async () => {
  try {
    saving.value = true
    
    // Walidacja aliasów
    const aliases = config.value.shares?.map(share => share.alias) || []
    const uniqueAliases = new Set(aliases)
    if (aliases.length !== uniqueAliases.size) {
      throw new Error(t('webdav.alias_must_be_unique'))
    }

    const fullConfig = {
      ...config.value,
      nfs: {
        enabled: config.value.nfs.enabled,
        versions: selectedNfsVersions.value
      }
    }

    const response = await axios.post('/services/webdav/config', { config: fullConfig })
    
    if (response.data.success) {
      ElNotification.success({
        title: t('webdav.success'),
        message: response.data.message
      })
      await fetchConfig()
    }
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: error.response?.data?.error || error.message || t('webdav.config_save_error')
    })
  } finally {
    saving.value = false
  }
}

const resetConfig = async () => {
  try {
    resetting.value = true
    await fetchConfig(true)
    ElNotification.success({
      title: t('webdav.success'),
      message: t('webdav.config_reset')
    })
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: t('webdav.config_reset_error')
    })
  } finally {
    resetting.value = false
  }
}

const fetchStatus = async () => {
  try {
    loading.value = true
    const response = await axios.get('/services/webdav/status')
    status.value = response.data
    serviceStatus.value = response.data.running
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: t('webdav.status_fetch_error')
    })
  } finally {
    loading.value = false
  }
}

const fetchConfig = async () => {
  try {
    loading.value = true
    const response = await axios.get('/services/webdav/config')
    
    if (response.data.success) {
      config.value = response.data.config
      selectedNfsVersions.value = response.data.config.nfs?.versions || ['v3', 'v4']
      await fetchAvailableDisks()
    }
  } catch (error) {
    ElNotification.error({
      title: t('webdav.error'),
      message: t('webdav.config_fetch_error')
    })
  } finally {
    loading.value = false
  }
}

const fetchAvailableDisks = async () => {
  try {
    loading.value = true
    const response = await axios.get('/services/webdav/available-disks')
    
    if (response.data.success) {
      availableDisks.value = response.data.data.map(disk => ({
        name: disk.name,
        path: disk.mountpoint,
        size: formatSize(disk.size),
        fsType: disk.fstype || 'unknown',
        model: disk.model,
        isSystem: disk.isSystem
      }))
      
      updateSharedResourcesList()
      
      if (availableDisks.value.length === 0) {
        ElNotification.warning({
          title: t('webdav.warning'),
          message: t('webdav.no_disks_found'),
          duration: 5000
        })
      }
    } else {
      throw new Error(response.data.error || 'No disks available')
    }
  } catch (error) {
    console.error('Error fetching disks:', error)
    ElNotification.error({
      title: t('webdav.error'),
      message: t('webdav.disk_fetch_error'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const updateSharedResourcesList = () => {
  if (!config.value.shares) {
    sharedResources.value = []
    return
  }
  
  sharedResources.value = config.value.shares.map(share => ({
    path: share.path,
    alias: share.alias || generateDefaultAlias({ path: share.path }),
    read_only: share.read_only || false,
    auth_required: share.auth_required !== false
  }))
}

const generateDefaultAlias = (resource) => {
  // Dla dysków - użyj nazwy dysku
  const disk = availableDisks.value.find(d => d.path === resource.path)
  if (disk) {
    return disk.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  
  // Dla folderów - użyj ostatniej części ścieżki
  return resource.path.split('/').filter(Boolean).pop()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const updateShare = (resource) => {
  if (!config.value.shares) {
    config.value.shares = []
  }

  // Sprawdź czy alias jest unikalny
  const isAliasUnique = !config.value.shares.some(
    s => s.alias === resource.alias && s.path !== resource.path
  )
  
  if (!isAliasUnique) {
    ElMessage.error(t('webdav.alias_must_be_unique'))
    return
  }

  const existingShare = config.value.shares.find(s => s.path === resource.path)
  if (existingShare) {
    // Aktualizuj istniejące udostępnienie
    existingShare.alias = resource.alias
    existingShare.read_only = resource.read_only
    existingShare.auth_required = resource.auth_required
  } else {
    // Dodaj nowe udostępnienie
    config.value.shares.push({
      path: resource.path,
      alias: resource.alias,
      read_only: resource.read_only,
      auth_required: resource.auth_required
    })
  }
  
  ElMessage.success(t('webdav.share_updated'))
}

const removeShare = (resource) => {
  if (!config.value.shares) return

  config.value.shares = config.value.shares.filter(s => s.path !== resource.path)
  updateSharedResourcesList()
  ElMessage.success(t('webdav.share_removed'))
}

const openDirectoryBrowser = (disk) => {
  currentDisk.value = disk
  directoryTree.value = [{
    name: disk.name,
    path: disk.path,
    isLeaf: false,
    children: []
  }]
  selectedDirectories.value = []
  directoryDialogVisible.value = true
}

const loadDirectories = async (node, resolve) => {
  if (node.level === 0) {
    return resolve([{ 
      name: currentDisk.value.name, 
      path: currentDisk.value.path,
      isLeaf: false 
    }])
  }

  try {
    const response = await axios.post('/api/filesystems/list-directories', {
      path: node.data.path
    })
    
    const directories = response.data.directories.map(dir => ({
      name: dir.name,
      path: dir.path,
      isLeaf: dir.isLeaf
    }))
    
    resolve(directories)
  } catch (error) {
    console.error('Error loading directories:', error)
    resolve([])
  }
}

const handleDirectorySelect = (data, { checkedKeys }) => {
  selectedDirectories.value = checkedKeys
}

const confirmDirectorySelection = () => {
  if (selectedDirectories.value.length > 0) {
    if (!config.value.shares) {
      config.value.shares = []
    }
    
    selectedDirectories.value.forEach(path => {
      if (!config.value.shares.some(share => share.path === path)) {
        const alias = generateDefaultAlias({ path })
        config.value.shares.push({
          path,
          alias,
          read_only: false,
          auth_required: true
        })
      }
    })
    
    updateSharedResourcesList()
    directoryDialogVisible.value = false
    ElMessage.success(t('webdav.directories_added'))
    
    // Resetuj zaznaczenie w drzewie
    if (directoryTreeRef.value) {
      directoryTreeRef.value.setCheckedKeys([])
    }
  } else {
    ElMessage.warning(t('webdav.no_directories_selected'))
  }
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`
}

// Inicjalizacja komponentu
onMounted(() => {
  fetchStatus()
  fetchConfig()
})
</script>

<style scoped>
.webdav-modern {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Panel statusu */
.dashboard-header {
  margin-bottom: 24px;
}

.status-panel {
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.service-icon {
  color: var(--el-color-primary);
  background: white;
  padding: 12px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-info h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-subtitle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.status-badge {
  font-weight: 500;
}

.version-info {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.service-controls .el-button-group {
  display: flex;
  gap: 8px;
}

/* Szczegóły połączenia */
.connection-details {
  padding: 8px 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.detail-value {
  min-height: 40px;
  display: flex;
  align-items: center;
}

.address-tag {
  font-size: 1.125rem;
  font-weight: 600;
  padding: 8px 16px;
}

.url-tag {
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  padding: 8px 16px;
}

.url-tag:hover {
  background-color: var(--el-color-info-light-9);
  transform: translateY(-1px);
}

.copy-btn {
  margin-left: 8px;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.url-tag:hover .copy-btn {
  opacity: 1;
}

/* Karty konfiguracyjne */
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
  margin-bottom: 16px;
}

.compact-card:last-child {
  margin-bottom: 0;
}

.config-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-label {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.config-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.compact-input {
  width: 100%;
}

.compact-radio {
  width: 100%;
}

/* Sekcje zasobów */
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.badge-count {
  background: var(--el-color-primary);
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

/* Lista udostępnionych zasobów */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--el-text-color-secondary);
}

.empty-state .el-icon {
  color: var(--el-color-info-light-5);
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.shares-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  transition: background-color 0.3s;
}

.share-item:hover {
  background: var(--el-fill-color);
}

.share-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.share-icon {
  color: var(--el-color-primary);
  font-size: 24px;
  flex-shrink: 0;
}

.share-details {
  flex: 1;
  min-width: 0;
}

.share-path {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.alias-input {
  width: 200px;
}

.permission-select {
  width: 120px;
}

/* Karty dysków */
.disks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.disk-card {
  border: none;
  border-radius: 12px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.disk-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.disk-content {
  padding: 16px;
}

.disk-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.disk-icon {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 8px;
  border-radius: 8px;
}

.disk-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
}

.disk-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.disk-size {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.disk-path {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-share-btn {
  width: 100%;
  margin-top: 8px;
}

/* Ustawienia zaawansowane */
.advanced-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.advanced-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.sub-label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

.nfs-select {
  width: 100%;
}

/* Stopka z przyciskami */
.action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.save-btn {
  min-width: 140px;
}

/* Modal wyboru katalogów */
.directory-modal {
  border-radius: 16px;
}

.directory-tree {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.node-icon {
  color: var(--el-color-primary);
  font-size: 18px;
}

.node-icon.is-leaf {
  color: var(--el-text-color-secondary);
}

.node-label {
  font-size: 0.9375rem;
}

/* Animacje */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(103, 194, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(103, 194, 58, 0); }
}

.pulse-animation {
  animation: pulse 2s infinite;
}

/* Responsywność */
@media (max-width: 992px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .service-controls .el-button-group {
    justify-content: center;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .disks-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .webdav-modern {
    padding: 16px;
  }
  
  .share-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .share-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .alias-input {
    width: 100%;
  }
  
  .action-footer {
    flex-direction: column;
  }
  
  .action-footer .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .config-row {
    grid-template-columns: 1fr;
  }
  
  .advanced-grid {
    grid-template-columns: 1fr;
  }
  
  .disks-grid {
    grid-template-columns: 1fr;
  }
}
</style>
