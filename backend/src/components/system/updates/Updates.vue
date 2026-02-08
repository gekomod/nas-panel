<template>
  <div class="updates-dashboard">
    <!-- Compact Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:package-variant-closed" />
          </div>
          <div class="header-text">
            <h2>{{ t('systemUpdates.title') }}</h2>
            <p class="subtitle">{{ t('systemUpdates.subtitle') }}</p>
          </div>
        </div>
        
        <!-- Stats Section - Properly Aligned -->
        <div class="header-stats">
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:package-variant" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ updates.length }}</div>
              <div class="stat-label">{{ t('systemUpdates.updates') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:shield-alert" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ securityUpdatesCount }}</div>
              <div class="stat-label">{{ t('systemUpdates.security') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:clock-outline" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-label">{{ t('systemUpdates.lastChecked') }}</div>
              <div class="stat-value">{{ lastCheckedTime }}</div>
            </div>
          </div>
        </div>
        
        <!-- Filter Buttons -->
        <div class="header-actions compact">
          <el-button-group>
            <el-button 
              :type="viewFilter === 'all' ? 'primary' : 'default'"
              @click="viewFilter = 'all'"
              size="small"
            >
              {{ t('systemUpdates.all') }}
            </el-button>
            <el-button 
              :type="viewFilter === 'security' ? 'primary' : 'default'"
              @click="viewFilter = 'security'"
              size="small"
            >
              {{ t('systemUpdates.security') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Quick Actions & Stats Combined -->
    <el-card class="combined-card" shadow="hover">
      <div class="combined-content">
        <!-- Quick Actions -->
        <div class="quick-actions">
          <el-button 
            type="primary" 
            size="small"
            @click="checkUpdates(true)"
            :loading="isChecking"
            :disabled="isInstallingAll"
          >
            <Icon icon="mdi:refresh" width="14" />
            {{ t('systemUpdates.checkNow') }}
          </el-button>
          
          <el-button 
            v-if="hasUpdates"
            type="success" 
            size="small"
            @click="installUpdates"
            :loading="isInstallingAll"
            :disabled="isChecking || isInstallingAll"
          >
            <Icon icon="mdi:download" width="14" />
            {{ t('systemUpdates.installAll') }}
          </el-button>
          
          <el-button 
            v-if="selectedUpdates.length > 0"
            type="warning" 
            size="small"
            @click="installSelectedUpdates"
            :loading="isInstallingSelected"
            :disabled="isInstallingAll"
          >
            <Icon icon="mdi:download-multiple" width="14" />
            {{ t('systemUpdates.installSelected') }}
          </el-button>
        </div>

        <!-- Progress Bar (if installing) -->
        <div v-if="isInstallingAll" class="compact-progress">
          <div class="progress-info">
            <span class="progress-text">{{ t('systemUpdates.installing') }}</span>
            <span class="progress-percentage">{{ bulkProgress }}%</span>
          </div>
          <el-progress 
            :percentage="bulkProgress" 
            :stroke-width="6" 
            striped 
            :duration="10"
            :color="bulkProgressColor"
          />
          <div class="progress-details">
            <span>{{ installedCount }}/{{ updates.length }} {{ t('systemUpdates.packages') }}</span>
            <el-button 
              size="mini" 
              type="danger" 
              text
              @click="cancelAllInstallations"
            >
              {{ t('common.cancel') }}
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Updates List -->
    <el-card class="updates-list-card" shadow="hover">
      <!-- Search & Filters -->
      <div class="list-header">
        <div class="search-section">
          <el-input
            v-model="searchQuery"
            :placeholder="t('systemUpdates.searchPlaceholder')"
            clearable
            size="small"
            class="search-input compact"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" width="14" />
            </template>
          </el-input>
          
          <el-select 
            v-model="priorityFilter" 
            :placeholder="t('systemUpdates.priority')" 
            clearable
            size="small"
            class="filter-select"
          >
            <el-option :label="t('systemUpdates.critical')" value="critical" />
            <el-option :label="t('systemUpdates.high')" value="high" />
            <el-option :label="t('systemUpdates.medium')" value="medium" />
            <el-option :label="t('systemUpdates.low')" value="low" />
          </el-select>
        </div>
        
        <div class="selection-info" v-if="selectedUpdates.length > 0">
          <span class="selected-count">
            {{ t('systemUpdates.selectedCount', { count: selectedUpdates.length }) }}
          </span>
          <el-button 
            size="small" 
            text 
            @click="clearSelection"
            class="clear-btn"
          >
            {{ t('common.clear') }}
          </el-button>
        </div>
      </div>

      <!-- Error Alert -->
      <el-alert 
        v-if="error" 
        :title="error" 
        type="error" 
        show-icon 
        closable 
        @close="error = ''"
        size="small"
        class="compact-alert"
      />

      <!-- Loading State -->
      <div v-if="isChecking && updates.length === 0" class="loading-state">
        <el-icon :size="24" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
        <span>{{ t('systemUpdates.checkingUpdates') }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredUpdates.length === 0 && !isChecking" class="empty-state compact">
        <Icon icon="mdi:check-circle-outline" width="48" />
        <div class="empty-text">
          <h4>{{ t('systemUpdates.systemUpToDate') }}</h4>
          <p>{{ emptyMessage }}</p>
          <el-button type="primary" size="small" @click="checkUpdates(true)">
            {{ t('systemUpdates.checkAgain') }}
          </el-button>
        </div>
      </div>

      <!-- Updates List -->
      <div v-else class="updates-list compact">
        <div 
          v-for="update in paginatedUpdates" 
          :key="update.name"
          :class="['update-item', { 
            'selected': isSelected(update),
            'installing': getStatusForPackage(update.name).progress > 0,
            'security': getPriority(update) === 'critical'
          }]"
        >
          <div class="update-checkbox">
            <el-checkbox 
              :model-value="isSelected(update)"
              @change="toggleSelection(update)"
              size="small"
            />
          </div>
          
          <div class="update-icon">
            <el-icon 
              :size="20"
              :color="getPriorityColor(getPriority(update))"
            >
              <Icon :icon="getPackageIcon(update.name)" />
            </el-icon>
          </div>
          
          <div class="update-content">
            <div class="update-header">
              <div class="update-name">
                <span class="name-text">{{ update.name }}</span>
                <PriorityBadge :priority="getPriority(update)" size="small" />
                <span class="version-change">
                  {{ update.current_version }}
                  <Icon icon="mdi:arrow-right-thin" width="12" />
                  <strong>{{ update.new_version }}</strong>
                </span>
              </div>
              
              <div class="update-actions">
                <UpdateStatus 
                  :status="getStatusForPackage(update.name)" 
                  @retry="retryInstallation(update.name)"
                  compact
                />
                
                <div class="action-buttons">
                  <el-button 
                    v-if="update.changelog"
                    size="small" 
                    text 
                    @click="showChangelog(update)"
                    class="mini-btn"
                  >
                    <Icon icon="mdi:text-box-outline" width="12" />
                  </el-button>
                  
                  <el-button 
                    size="small" 
                    text 
                    @click="showUpdateDetails(update)"
                    class="mini-btn"
                  >
                    <Icon icon="mdi:information-outline" width="12" />
                  </el-button>
                  
                  <el-button 
                    size="small" 
                    type="success" 
                    @click="installSingleUpdate(update)"
                    :loading="getStatusForPackage(update.name).progress > 0"
                    :disabled="isInstallingAll"
                    class="mini-btn"
                  >
                    <Icon icon="mdi:package-down" width="12" />
                  </el-button>
                </div>
              </div>
            </div>
            
            <div class="update-description">
              <span class="desc-text">{{ truncateDescription(update.description) }}</span>
              <span class="update-meta">
                <el-tag size="mini" effect="plain">
                  {{ getRepoFromName(update.name) }}
                </el-tag>
                <span v-if="update.size" class="size-text">
                  {{ formatSize(update.size) }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!isChecking && filteredUpdates.length > 0" class="pagination compact">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredUpdates.length"
          :page-sizes="[10, 20, 30]"
          layout="total, sizes, prev, pager, next"
          size="small"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- Update Details Dialog -->
    <UpdateDetailsDialog 
      v-model="detailsDialogVisible"
      :update="selectedUpdate"
      @install="installSingleUpdate(selectedUpdate)"
    />

    <!-- Automatic Updates Settings Dialog -->
    <AutomaticUpdatesDialog 
      v-model="settingsDialogVisible"
      :settings="updateSettings"
      @save="saveAutomaticUpdatesSettings"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import UpdateStatus from './UpdateStatus.vue'
import UpdateDetailsDialog from './UpdateDetailsDialog.vue'
import AutomaticUpdatesDialog from './AutomaticUpdatesDialog.vue'
import PriorityBadge from './PriorityBadge.vue'

const { t } = useI18n()

// API configuration
const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3001}`,
  timeout: 45000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// Reactive state
const updates = ref([])
const isChecking = ref(false)
const isInstallingAll = ref(false)
const isInstallingSelected = ref(false)
const lastChecked = ref(null)
const error = ref('')
const detailsDialogVisible = ref(false)
const settingsDialogVisible = ref(false)
const selectedUpdate = ref(null)
const selectedUpdates = ref([])
const installationStatus = ref({})
const eventSources = ref({})
const cancelling = ref(false)

// UI State
const currentPage = ref(1)
const pageSize = ref(10)
const viewFilter = ref('all')
const searchQuery = ref('')
const priorityFilter = ref('')

// Settings
const updateSettings = ref({
  autoUpdate: false,
  autoInstall: false,
  schedule: '0 2 * * *',
  securityOnly: false,
  notifyOnUpdates: true,
  rebootAfterUpdate: false
})

// Computed properties
const hasUpdates = computed(() => updates.value.length > 0)
const securityUpdatesCount = computed(() => {
  return updates.value.filter(pkg => getPriority(pkg) === 'critical').length
})
const updatesSize = computed(() => {
  const totalSize = updates.value.reduce((sum, pkg) => sum + (pkg.size || 0), 0)
  return formatSize(totalSize)
})
const selectedUpdatesSize = computed(() => {
  const totalSize = selectedUpdates.value.reduce((sum, pkg) => sum + (pkg.size || 0), 0)
  return formatSize(totalSize)
})
const bulkProgress = computed(() => {
  const total = updates.value.length
  const installed = Object.values(installationStatus.value)
    .filter(status => status.progress === 100).length
  return Math.round((installed / total) * 100)
})
const bulkProgressColor = computed(() => {
  if (bulkProgress.value < 30) return '#e6a23c'
  if (bulkProgress.value < 70) return '#409eff'
  return '#67c23a'
})
const installedCount = computed(() => {
  return Object.values(installationStatus.value)
    .filter(status => status.progress === 100).length
})
const lastCheckedTime = computed(() => {
  if (!lastChecked.value) return t('systemUpdates.never')
  const date = new Date(lastChecked.value)
  const now = new Date()
  const diffInMinutes = Math.floor((now - date) / (1000 * 60))
  
  if (diffInMinutes < 1) return t('systemUpdates.justNow')
  if (diffInMinutes < 60) return t('systemUpdates.minutesAgo', { minutes: diffInMinutes })
  if (diffInMinutes < 1440) return t('systemUpdates.hoursAgo', { hours: Math.floor(diffInMinutes / 60) })
  
  return date.toLocaleDateString()
})
const filteredUpdates = computed(() => {
  let result = [...updates.value]
  
  if (viewFilter.value === 'security') {
    result = result.filter(pkg => getPriority(pkg) === 'critical')
  }
  
  if (priorityFilter.value) {
    result = result.filter(pkg => getPriority(pkg) === priorityFilter.value)
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(pkg => 
      pkg.name.toLowerCase().includes(query) ||
      (pkg.description && pkg.description.toLowerCase().includes(query))
    )
  }
  
  return result
})
const paginatedUpdates = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredUpdates.value.slice(start, end)
})
const emptyMessage = computed(() => {
  if (viewFilter.value !== 'all' || searchQuery.value || priorityFilter.value) {
    return t('systemUpdates.noUpdatesFilter')
  }
  return t('systemUpdates.noUpdatesAvailable')
})

// Methods
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const truncateDescription = (desc) => {
  if (!desc) return t('systemUpdates.noDescription')
  if (desc.length > 80) return desc.substring(0, 80) + '...'
  return desc
}

const getPackageIcon = (packageName) => {
  const icons = {
    'kernel': 'mdi:chip',
    'firefox': 'mdi:firefox',
    'chrome': 'mdi:google-chrome',
    'docker': 'mdi:docker',
    'nginx': 'mdi:nginx',
    'apache': 'mdi:apache',
    'python': 'mdi:language-python',
    'php': 'mdi:language-php',
    'node': 'mdi:nodejs',
    'mysql': 'mdi:database',
    'postgresql': 'mdi:database',
    'redis': 'mdi:database',
    'vim': 'mdi:code-tags',
    'git': 'mdi:git',
    'ssh': 'mdi:lock',
    'ssl': 'mdi:security',
    'security': 'mdi:shield-check',
    'updates': 'mdi:update'
  }
  
  for (const [key, icon] of Object.entries(icons)) {
    if (packageName.toLowerCase().includes(key)) return icon
  }
  
  return 'mdi:package-variant'
}

const getPriorityColor = (priority) => {
  const colors = {
    'critical': '#f56c6c',
    'high': '#e6a23c',
    'medium': '#409eff',
    'low': '#909399'
  }
  return colors[priority] || '#909399'
}

const getRepoFromName = (packageName) => {
  if (packageName.includes('-security')) return 'security'
  if (packageName.includes('-backports')) return 'backports'
  if (packageName.includes('-updates')) return 'updates'
  return 'main'
}

const getPriority = (pkg) => {
  if (pkg.name.includes('security') || pkg.name.toLowerCase().includes('sec')) return 'critical'
  if (pkg.name.includes('kernel')) return 'high'
  if (pkg.description?.toLowerCase().includes('bug')) return 'medium'
  if (pkg.name.includes('-backports')) return 'low'
  return 'low'
}

const isSelected = (update) => {
  return selectedUpdates.value.some(u => u.name === update.name)
}

const toggleSelection = (update) => {
  const index = selectedUpdates.value.findIndex(u => u.name === update.name)
  if (index === -1) {
    selectedUpdates.value.push(update)
  } else {
    selectedUpdates.value.splice(index, 1)
  }
}

const checkUpdates = async (force = false) => {
  isChecking.value = true
  error.value = ''
  
  try {
    const response = await api.get(`/system/updates/check?force=${force}`)
    updates.value = response.data.updates || []
    lastChecked.value = new Date().toISOString()
    
    if (updates.value.length > 0) {
      await fetchPackageDetails()
    }
    
    if (!hasUpdates.value && force) {
      ElNotification.success({
        title: t('systemUpdates.systemUpToDate'),
        message: t('systemUpdates.noUpdatesFound'),
        position: 'bottom-right'
      })
    }
  } catch (err) {
    error.value = t('systemUpdates.checkFailed', { 
      error: err.response?.data?.message || err.message 
    })
  } finally {
    isChecking.value = false
  }
}

const fetchPackageDetails = async () => {
  const packageNames = updates.value.map(pkg => pkg.name)
  try {
    const response = await api.post('/system/updates/details', {
      packages: packageNames
    })
    
    updates.value = updates.value.map(pkg => ({
      ...pkg,
      ...response.data[pkg.name],
      size: response.data[pkg.name]?.size || 0
    }))
  } catch (err) {
    console.warn('Failed to fetch package details:', err)
  }
}

const installSingleUpdate = async (pkg) => {
  if (!pkg || isInstallingAll.value) return
  
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallSingle', { 
        name: pkg.name, 
        version: pkg.new_version
      }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'info'
      }
    )

    startInstallation(pkg.name)
    
    const response = await api.post('/system/updates/install', {
      packages: [pkg.name],
      no_confirm: true
    })

    setupProgressTracking(pkg.name, response.data.processId, [pkg.name])
    
  } catch (err) {
    if (err !== 'cancel') {
      updateInstallationStatus(pkg.name, {
        progress: 0,
        status: 'exception',
        message: err.response?.data?.message || err.message
      })
      ElMessage.error(t('systemUpdates.installFailed', { 
        error: err.response?.data?.message || err.message 
      }))
    }
  }
}

const installSelectedUpdates = async () => {
  if (selectedUpdates.value.length === 0 || isInstallingAll.value) return
  
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallSelected', { 
        count: selectedUpdates.value.length
      }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    isInstallingSelected.value = true
    const packageNames = selectedUpdates.value.map(pkg => pkg.name)
    
    packageNames.forEach(name => startInstallation(name))
    
    const response = await api.post('/system/updates/install', {
      packages: packageNames,
      no_confirm: true
    })
    
    setupProgressTracking('_selected', response.data.processId, packageNames)
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.installFailed', { error: err.message }))
    }
  } finally {
    isInstallingSelected.value = false
  }
}

const installUpdates = async () => {
  if (updates.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallAll', { 
        count: updates.value.length
      }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.installAll'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    isInstallingAll.value = true
    const packageNames = updates.value.map(pkg => pkg.name)
    
    packageNames.forEach(name => startInstallation(name))
    
    const response = await api.post('/system/updates/install', {
      packages: packageNames,
      no_confirm: true
    })
    
    setupProgressTracking('_all', response.data.processId, packageNames)
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.installFailed', { error: err.message }))
    }
    isInstallingAll.value = false
  }
}

const setupProgressTracking = (key, processId, packages = []) => {
  const eventSource = new EventSource(`${api.defaults.baseURL}/system/updates/progress/${processId}`)
  eventSources.value[processId] = eventSource

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      if (key === '_all') {
        updates.value.forEach(pkg => {
          updateInstallationStatus(pkg.name, data)
        })
      } else if (key === '_selected') {
        packages.forEach(pkgName => {
          updateInstallationStatus(pkgName, data)
        })
      } else {
        updateInstallationStatus(packages[0], data)
      }

      if (data.progress === 100) {
        setTimeout(() => {
          eventSource.close()
          delete eventSources.value[processId]
          
          setTimeout(() => {
            checkUpdates(true)
          }, 2000)
        }, 1000)
      }
    } catch (e) {
      console.error('Error parsing SSE data:', e)
    }
  }

  eventSource.onerror = (err) => {
    console.error('SSE Error:', err)
    eventSource.close()
    delete eventSources.value[processId]
  }
}

const startInstallation = (pkgName) => {
  installationStatus.value[pkgName] = {
    progress: 0,
    status: '',
    message: t('systemUpdates.startingInstallation'),
    time: new Date().toLocaleTimeString(),
    indeterminate: true
  }
}

const updateInstallationStatus = (pkgName, data) => {
  installationStatus.value[pkgName] = {
    ...(installationStatus.value[pkgName] || {}),
    ...data,
    time: new Date().toLocaleTimeString()
  }
}

const getStatusForPackage = (pkgName) => {
  return installationStatus.value[pkgName] || {
    progress: 0,
    status: '',
    message: t('systemUpdates.pending'),
    time: ''
  }
}

const retryInstallation = (pkgName) => {
  const pkg = updates.value.find(p => p.name === pkgName)
  if (pkg) {
    installSingleUpdate(pkg)
  }
}

const showUpdateDetails = (pkg) => {
  selectedUpdate.value = pkg
  detailsDialogVisible.value = true
}

const showChangelog = async (pkg) => {
  try {
    const response = await api.get(`/system/updates/changelog/${pkg.name}`)
    ElMessageBox.alert(response.data.changelog, `Changelog: ${pkg.name}`, {
      confirmButtonText: t('common.close'),
      dangerouslyUseHTMLString: true,
      width: '600px'
    })
  } catch (err) {
    ElMessage.warning(t('systemUpdates.noChangelog'))
  }
}

const clearSelection = () => {
  selectedUpdates.value = []
}

const cancelAllInstallations = async () => {
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmCancelAll'),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    cancelling.value = true
    await api.delete('/system/updates/cancel/_all')
    
    Object.keys(installationStatus.value).forEach(key => {
      updateInstallationStatus(key, {
        progress: 0,
        status: 'exception',
        message: t('systemUpdates.cancelled')
      })
    })
    
    isInstallingAll.value = false
    isInstallingSelected.value = false
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.cancelFailed'))
    }
  } finally {
    cancelling.value = false
  }
}

const showSettingsDialog = () => {
  settingsDialogVisible.value = true
}

const saveAutomaticUpdatesSettings = async (settings) => {
  try {
    await api.post('/system/updates/settings', settings)
    updateSettings.value = settings
    ElMessage.success(t('systemUpdates.settingsSaved'))
    settingsDialogVisible.value = false
  } catch (err) {
    ElMessage.error(t('systemUpdates.saveFailed', { error: err.message }))
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

// Lifecycle hooks
onMounted(() => {
  checkUpdates(false)
})

onBeforeUnmount(() => {
  Object.values(eventSources.value).forEach(source => source.close())
})

watch(searchQuery, () => {
  currentPage.value = 1
})

watch(priorityFilter, () => {
  currentPage.value = 1
})

watch(viewFilter, () => {
  currentPage.value = 1
})
</script>

<style scoped>
.updates-dashboard {
  padding: 16px;
  min-height: 100vh;
  background: #f5f7fa;
}

:root[data-theme="dark"] .updates-dashboard {
  background: #1a202c;
}

/* Compact Header */
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
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 10px;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
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

:root[data-theme="dark"] .header-text h2 {
  color: #e4e7ed;
}

.header-text .subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
}

:root[data-theme="dark"] .header-text .subtitle {
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
  color: #409eff;
}

.stat-item.small .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[data-theme="dark"] .stat-item.small .stat-value {
  color: #e4e7ed;
}

.stat-item.small .stat-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

:root[data-theme="dark"] .stat-item.small .stat-label {
  color: #a0aec0;
}

.stat-item.small:last-child .stat-value {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
}

:root[data-theme="dark"] .stat-item.small:last-child .stat-value {
  color: #a0aec0;
}

.stat-item.small:last-child .stat-label {
  margin-bottom: 2px;
}


.header-actions.compact {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Combined Card */
.combined-card {
  border-radius: 12px;
  margin-bottom: 16px;
}

.combined-content {
  padding: 16px;
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

/* Compact Progress */
.compact-progress {
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

:root[data-theme="dark"] .compact-progress {
  border-top-color: #4a5568;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}

.progress-text {
  color: #606266;
}

:root[data-theme="dark"] .progress-text {
  color: #a0aec0;
}

.progress-percentage {
  font-weight: 600;
  color: #409eff;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: #909399;
}

/* Updates List Card */
.updates-list-card {
  border-radius: 12px;
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

:root[data-theme="dark"] .list-header {
  border-bottom-color: #4a5568;
}

.search-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input.compact {
  width: 200px;
}

.filter-select {
  width: 120px;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-count {
  font-size: 12px;
  color: #409eff;
  font-weight: 500;
}

.clear-btn {
  padding: 2px 6px;
  height: auto;
}

/* Compact Alert */
.compact-alert {
  margin: 0 16px 16px;
  border-radius: 6px;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
  font-size: 14px;
  gap: 8px;
}

:root[data-theme="dark"] .loading-state {
  color: #a0aec0;
}

/* Empty State */
.empty-state.compact {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 16px;
  text-align: left;
}

.empty-text h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

:root[data-theme="dark"] .empty-text h4 {
  color: #e4e7ed;
}

.empty-text p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}

:root[data-theme="dark"] .empty-text p {
  color: #a0aec0;
}

/* Updates List */
.updates-list.compact {
  padding: 0;
}

.update-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  transition: background-color 0.2s;
  cursor: pointer;
}

:root[data-theme="dark"] .update-item {
  border-bottom-color: #2d3748;
}

.update-item:hover {
  background-color: #fafafa;
}

:root[data-theme="dark"] .update-item:hover {
  background-color: #2d3748;
}

.update-item.selected {
  background-color: rgba(64, 158, 255, 0.05);
}

.update-item.security {
  border-left: 3px solid #f56c6c;
  padding-left: 13px;
}

.update-item.installing {
  background-color: rgba(245, 158, 11, 0.05);
}

.update-checkbox {
  margin-top: 2px;
}

.update-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.update-content {
  flex: 1;
  min-width: 0;
}

.update-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 8px;
}

.update-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.name-text {
  font-weight: 500;
  font-size: 13px;
  color: #303133;
}

:root[data-theme="dark"] .name-text {
  color: #e4e7ed;
}

.version-change {
  font-size: 11px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

:root[data-theme="dark"] .version-change {
  color: #a0aec0;
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.mini-btn {
  padding: 4px;
  min-width: auto;
}

.update-description {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #606266;
}

:root[data-theme="dark"] .update-description {
  color: #a0aec0;
}

.desc-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

.update-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.size-text {
  font-size: 11px;
  color: #909399;
}

/* Pagination */
.pagination.compact {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
}

:root[data-theme="dark"] .pagination.compact {
  border-top-color: #4a5568;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-left {
    min-width: auto;
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
  
  .stat-item.small .stat-icon {
    width: 28px;
    height: 28px;
  }
  
  .header-actions.compact {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .updates-dashboard {
    padding: 12px;
  }
  
  .header-stats {
    display: none;
  }
  
  .search-input.compact {
    width: 160px;
  }
  
  .list-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-section {
    width: 100%;
  }
  
  .search-input.compact {
    flex: 1;
  }
  
  .update-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .update-actions {
    justify-content: space-between;
  }
}

@media (max-width: 480px) {
  .header-stats {
    flex-wrap: wrap;
  }
  
  .stat-item.small {
    flex: 0 0 calc(50% - 8px);
    margin-bottom: 8px;
  }
  
  .stat-item.small:last-child {
    flex: 0 0 100%;
    margin-bottom: 0;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .update-name {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .update-description {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .desc-text {
    margin-right: 0;
    white-space: normal;
  }
}
</style>
