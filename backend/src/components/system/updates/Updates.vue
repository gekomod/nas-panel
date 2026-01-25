<template>
  <el-container class="updates-container">
  <el-card class="updates-widget glassmorphic" :body-style="{ padding: 0 }">
    <template #header>
      <div class="widget-header">
        <div class="header-left">
          <Icon icon="mdi:package-variant-closed" width="24" height="24" class="header-icon" />
          <div>
            <h3>{{ t('systemUpdates.title') }}</h3>
            <p class="subtitle">{{ t('systemUpdates.subtitle') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button 
            type="primary" 
            :loading="isChecking" 
            @click="checkUpdates(true)"
            class="check-updates-btn"
            :disabled="isInstallingAll"
          >
            <template #icon>
              <Icon icon="mdi:refresh" width="16" :class="{ 'spin': isChecking }" />
            </template>
            {{ t('systemUpdates.checkNow') }}
          </el-button>
          
          <!-- DODAJ TEN PRZYCISK -->
          <el-button 
            v-if="hasUpdates"
            type="success" 
            @click="installUpdates"
            :loading="isInstallingAll"
            :disabled="isChecking"
            class="install-all-btn"
          >
            <template #icon>
              <Icon icon="mdi:download" width="16" />
            </template>
            {{ t('systemUpdates.installAll') }}
          </el-button>
          
          <el-dropdown @command="handleQuickActions">
            <el-button type="info" :disabled="isInstallingAll || isChecking">
              <template #icon>
                <Icon icon="mdi:dots-vertical" width="16" />
              </template>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="install-security">
                  <Icon icon="mdi:shield-check" width="16" />
                  {{ t('systemUpdates.installSecurity') }}
                </el-dropdown-item>
                <el-dropdown-item command="clear-cache">
                  <Icon icon="mdi:trash-can-outline" width="16" />
                  {{ t('systemUpdates.clearCache') }}
                </el-dropdown-item>
                <el-dropdown-item divided command="settings">
                  <Icon icon="mdi:cog" width="16" />
                  {{ t('systemUpdates.settings') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      
      <!-- Progress bar dla masowej instalacji -->
      <div v-if="isInstallingAll" class="bulk-progress">
        <div class="progress-header">
          <span>{{ t('systemUpdates.installingAll') }}</span>
          <span>{{ bulkProgress }}%</span>
        </div>
        <el-progress 
          :percentage="bulkProgress" 
          :stroke-width="8" 
          striped 
          striped-flow 
          :duration="10"
        />
        <div class="progress-stats">
          <span>{{ installedCount }} / {{ updates.length }} {{ t('systemUpdates.packages') }}</span>
          <el-button 
            size="small" 
            type="danger" 
            text 
            @click="cancelAllInstallations"
          >
            {{ t('common.cancel') }}
          </el-button>
        </div>
      </div>
    </template>

    <!-- Status bar -->
    <div class="status-bar">
      <div class="status-item">
        <Icon icon="mdi:package" width="16" />
        <span class="label">{{ t('systemUpdates.available') }}:</span>
        <span class="value highlight">{{ updates.length }}</span>
      </div>
      <div class="status-item">
        <Icon icon="mdi:security" width="16" />
        <span class="label">{{ t('systemUpdates.security') }}:</span>
        <span class="value warning">{{ securityUpdatesCount }}</span>
      </div>
      <div v-if="lastChecked" class="status-item">
        <Icon icon="mdi:clock-outline" width="16" />
        <span class="label">{{ t('systemUpdates.lastChecked') }}:</span>
        <span class="value">{{ lastCheckedFormatted }}</span>
      </div>
      <div v-if="updatesSize" class="status-item">
        <Icon icon="mdi:harddisk" width="16" />
        <span class="label">{{ t('systemUpdates.totalSize') }}:</span>
        <span class="value">{{ updatesSize }}</span>
      </div>
    </div>

    <!-- Error message -->
    <el-alert 
      v-if="error" 
      :title="error" 
      type="error" 
      show-icon 
      closable 
      @close="error = ''"
      class="error-alert"
    />

    <!-- Updates table -->
    <div class="table-container" v-loading="isChecking">
      <el-table 
        :data="filteredUpdates"
        style="width: 100%"
        :empty-text="t('systemUpdates.noUpdates')"
        class="modern-table"
        row-class-name="hover-row"
        @selection-change="handleSelectionChange"
        v-if="updates.length > 0"
      >
        <el-table-column type="selection" width="55" />
        
        <el-table-column 
          prop="name" 
          :label="t('systemUpdates.package')" 
          width="220"
          fixed="left"
        >
          <template #default="{ row }">
            <div class="package-cell">
              <div class="package-icon">
                <Icon 
                  :icon="getPackageIcon(row.name)" 
                  width="20" 
                  height="20" 
                  class="package-type-icon"
                />
              </div>
              <div class="package-info">
                <div class="package-name">{{ row.name }}</div>
                <div class="package-repo">
                  <el-tag size="small" effect="plain" class="repo-tag">
                    {{ getRepoFromName(row.name) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.version')" 
          width="180"
        >
          <template #default="{ row }">
            <div class="version-cell">
              <div class="version-current">
                <Icon icon="mdi:tag-outline" width="12" />
                <span class="version-text">{{ row.current_version }}</span>
              </div>
              <Icon icon="mdi:arrow-right-thin" width="16" class="arrow-icon" />
              <div class="version-new">
                <Icon icon="mdi:tag" width="12" />
                <span class="version-text highlight">{{ row.new_version }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          prop="description" 
          :label="t('systemUpdates.description')" 
          min-width="300"
        >
          <template #default="{ row }">
            <div class="description-cell">
              <div class="description-text" v-if="row.description">
                {{ row.description }}
              </div>
              <div v-else class="no-description">
                <el-tag size="small" type="info">{{ t('systemUpdates.noDescription') }}</el-tag>
              </div>
              <div v-if="row.changelog" class="changelog-link">
                <el-link type="primary" @click="showChangelog(row)">
                  <Icon icon="mdi:text-box-outline" width="12" />
                  {{ t('systemUpdates.viewChangelog') }}
                </el-link>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.priority')" 
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <PriorityBadge :priority="getPriority(row)" />
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.status')" 
          width="180"
        >
          <template #default="{ row }">
            <UpdateStatus 
              :status="getStatusForPackage(row.name)" 
              @retry="retryInstallation(row.name)"
            />
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.actions')" 
          width="150"
          fixed="right"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip :content="t('systemUpdates.details')" placement="top">
                <el-button 
                  size="small" 
                  text 
                  @click="showUpdateDetails(row)"
                  class="action-btn info"
                >
                  <Icon icon="mdi:information-outline" width="16" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip :content="t('systemUpdates.install')" placement="top">
                <el-button 
                  size="small" 
                  type="success" 
                  @click="installSingleUpdate(row)"
                  :loading="installationStatus[row.name]?.progress > 0"
                  :disabled="isInstallingAll"
                  class="action-btn install"
                >
                  <Icon icon="mdi:package-down" width="16" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- Empty state -->
      <div v-else class="empty-state">
        <Icon icon="mdi:check-circle-outline" width="64" class="empty-icon" />
        <h3>{{ t('systemUpdates.systemUpToDate') }}</h3>
        <p>{{ t('systemUpdates.noUpdatesAvailable') }}</p>
        <el-button type="primary" @click="checkUpdates(true)">
          {{ t('systemUpdates.checkAgain') }}
        </el-button>
      </div>
    </div>

    <!-- Bulk actions footer -->
    <div v-if="selectedUpdates.length > 0" class="bulk-actions">
      <div class="bulk-info">
        <span>{{ t('systemUpdates.selectedCount', { count: selectedUpdates.length }) }}</span>
        <span class="total-size">• {{ selectedUpdatesSize }}</span>
      </div>
      <div class="bulk-buttons">
        <el-button @click="clearSelection">
          {{ t('common.clear') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="installSelectedUpdates"
          :loading="isInstallingSelected"
          class="install-selected-btn"
        >
          <template #icon>
            <Icon icon="mdi:download" width="16" />
          </template>
          {{ t('systemUpdates.installSelected') }}
        </el-button>
      </div>
    </div>

    <!-- Update details dialog -->
    <UpdateDetailsDialog 
      v-model="detailsDialogVisible"
      :update="selectedUpdate"
      @install="installSingleUpdate(selectedUpdate)"
    />

    <!-- Automatic updates settings dialog -->
    <AutomaticUpdatesDialog 
      v-model="settingsDialogVisible"
      :settings="updateSettings"
      @save="saveAutomaticUpdatesSettings"
    />
  </el-card>
 </el-container>
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

// API konfiguracja
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
const updateSettings = ref({
  autoUpdate: false,
  autoInstall: false,
  schedule: '0 2 * * *', // 2:00 AM
  securityOnly: false,
  notifyOnUpdates: true,
  rebootAfterUpdate: false
})

// Computed properties
const hasUpdates = computed(() => updates.value.length > 0)
const lastCheckedFormatted = computed(() => {
  if (!lastChecked.value) return ''
  const date = new Date(lastChecked.value)
  return date.toLocaleString()
})
const securityUpdatesCount = computed(() => {
  return updates.value.filter(pkg => 
    pkg.name.includes('security') || 
    pkg.description?.toLowerCase().includes('security')
  ).length
})
const updatesSize = computed(() => {
  const totalSize = updates.value.reduce((sum, pkg) => sum + (pkg.size || 0), 0)
  if (totalSize < 1024) return `${totalSize} KB`
  return `${(totalSize / 1024).toFixed(1)} MB`
})
const selectedUpdatesSize = computed(() => {
  const totalSize = selectedUpdates.value.reduce((sum, pkg) => sum + (pkg.size || 0), 0)
  if (totalSize < 1024) return `${totalSize} KB`
  return `${(totalSize / 1024).toFixed(1)} MB`
})
const bulkProgress = computed(() => {
  const total = updates.value.length
  const installed = Object.values(installationStatus.value)
    .filter(status => status.progress === 100).length
  return Math.round((installed / total) * 100)
})
const installedCount = computed(() => {
  return Object.values(installationStatus.value)
    .filter(status => status.progress === 100).length
})
const filteredUpdates = computed(() => {
  return updates.value
})

// Methods
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
    'curl': 'mdi:download',
    'wget': 'mdi:download'
  }
  
  for (const [key, icon] of Object.entries(icons)) {
    if (packageName.includes(key)) return icon
  }
  
  return 'mdi:package-variant'
}

const getRepoFromName = (packageName) => {
  if (packageName.includes('-security')) return 'security'
  if (packageName.includes('-backports')) return 'backports'
  if (packageName.includes('-updates')) return 'updates'
  return 'main'
}

const getPriority = (pkg) => {
  if (pkg.name.includes('security')) return 'critical'
  if (pkg.name.includes('kernel')) return 'high'
  if (pkg.description?.toLowerCase().includes('bug')) return 'medium'
  return 'low'
}

const checkUpdates = async (force = false) => {
  isChecking.value = true
  error.value = ''
  
  try {
    const response = await api.get(`/system/updates/check?force=${force}`)
    updates.value = response.data.updates || []
    lastChecked.value = new Date().toISOString()
    
    // Pobierz dodatkowe informacje o pakietach
    if (updates.value.length > 0) {
      await fetchPackageDetails()
    }
    
    if (!hasUpdates.value && force) {
      ElNotification.success({
        title: t('systemUpdates.systemUpToDate'),
        message: t('systemUpdates.noUpdatesFound'),
        position: 'bottom-right'
      })
    } else if (hasUpdates.value) {
      ElNotification.info({
        title: t('systemUpdates.updatesFound'),
        message: t('systemUpdates.updatesCount', { count: updates.value.length }),
        position: 'bottom-right'
      })
    }
  } catch (err) {
    error.value = t('systemUpdates.checkFailed', { 
      error: err.response?.data?.message || err.message 
    })
    console.error('Update check error:', err)
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
    
    // Zaktualizuj pakiety z dodatkowymi danymi
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
    // Sprawdź zależności
    const deps = await api.get(`/system/updates/check-deps/${pkg.name}`)
    
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallSingle', { 
        name: pkg.name, 
        version: pkg.new_version,
        size: deps.data.totalSize
      }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'info',
        dangerouslyUseHTMLString: true
      }
    )

    startInstallation(pkg.name)
    
    const response = await api.post('/system/updates/install', {
      packages: [pkg.name],
      no_confirm: true
    })

    setupProgressTracking(pkg.name, response.data.processId)
    
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
        count: selectedUpdates.value.length,
        size: selectedUpdatesSize.value
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
    
    // Inicjalizuj statusy instalacji
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
        count: updates.value.length,
        size: updatesSize.value
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
    
    // Inicjalizuj statusy instalacji
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
  eventSources.value[key] = eventSource

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      // Aktualizuj status dla wszystkich pakietów w grupie
      const targetPackages = key === '_all' ? updates.value.map(p => p.name) : 
                           key === '_selected' ? packages : [packages[0]]
      
      targetPackages.forEach(pkgName => {
        updateInstallationStatus(pkgName, {
          progress: data.progress || 0,
          status: data.status || '',
          message: data.message || t('systemUpdates.installing'),
          indeterminate: data.progress < 30,
          details: data.details
        })
      })

      if (data.progress === 100) {
        setTimeout(() => {
          eventSource.close()
          delete eventSources.value[key]
          
          // Odśwież listę po zakończeniu
          if (key === '_all' || key === '_selected') {
            checkUpdates(true)
          }
        }, 2000)
      }
    } catch (e) {
      console.error('Error parsing SSE data:', e)
    }
  }

  eventSource.onerror = (err) => {
    console.error('SSE Error:', err)
    eventSource.close()
    delete eventSources.value[key]
  }
}

const startInstallation = (pkgName) => {
  installationStatus.value[pkgName] = {
    progress: 0,
    status: '',
    message: t('systemUpdates.startingInstallation'),
    time: new Date().toLocaleTimeString(),
    indeterminate: true,
    details: null
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
      customClass: 'changelog-dialog',
      dangerouslyUseHTMLString: true,
      width: '800px', // ZWIĘKSZ OKNO
      style: 'max-height: 80vh;' // DODAJ MAKSYMALNĄ WYSOKOŚĆ
    })
  } catch (err) {
    ElMessage.warning(t('systemUpdates.noChangelog'))
  }
}

const handleSelectionChange = (selection) => {
  selectedUpdates.value = selection
}

const clearSelection = () => {
  selectedUpdates.value = []
}

const cancelAllInstallations = () => {
  ElMessageBox.confirm(
    t('systemUpdates.confirmCancelAll'),
    t('common.warning'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
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
      ElMessage.error(t('systemUpdates.cancelFailed'))
    }
  })
}

const handleQuickActions = (command) => {
  switch (command) {
    case 'install-security':
      installSecurityUpdates()
      break
    case 'clear-cache':
      clearUpdateCache()
      break
    case 'settings':
      showSettingsDialog()
      break
  }
}

const installSecurityUpdates = async () => {
  const securityUpdates = updates.value.filter(pkg => 
    pkg.name.includes('security') || getPriority(pkg) === 'critical'
  )
  
  if (securityUpdates.length === 0) {
    ElMessage.info(t('systemUpdates.noSecurityUpdates'))
    return
  }
  
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallSecurity', { count: securityUpdates.length }),
      t('systemUpdates.securityUpdates'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    const packageNames = securityUpdates.map(pkg => pkg.name)
    packageNames.forEach(name => startInstallation(name))
    
    const response = await api.post('/system/updates/install', {
      packages: packageNames,
      no_confirm: true
    })
    
    setupProgressTracking('_security', response.data.processId, packageNames)
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.installFailed', { error: err.message }))
    }
  }
}

const clearUpdateCache = async () => {
  try {
    await api.delete('/system/updates/cache')
    ElMessage.success(t('systemUpdates.cacheCleared'))
    checkUpdates(true)
  } catch (err) {
    ElMessage.error(t('systemUpdates.clearCacheFailed'))
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

// Lifecycle hooks
onMounted(() => {
  checkUpdates(false)
  
  // Automatyczne odświeżanie co 5 minut
  const refreshInterval = setInterval(() => {
    if (!isChecking.value && !isInstallingAll.value) {
      checkUpdates(false)
    }
  }, 5 * 60 * 1000)
})

onBeforeUnmount(() => {
  Object.values(eventSources.value).forEach(source => source.close())
})

watch(updates, (newUpdates) => {
  if (newUpdates.length === 0 && isInstallingAll.value) {
    isInstallingAll.value = false
  }
}, { deep: true })
</script>

<style scoped>
.updates-container {
  height: 100%;
  min-height: 600px;
}


.updates-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.glassmorphic {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0; /* Zapobiega kurczeniu się nagłówka */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.header-icon {
  color: var(--el-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.check-updates-btn,
.install-all-btn {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
  }
}

.bulk-progress {
  margin-top: 16px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  
  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  
  .progress-stats {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.status-bar {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
    
    .value {
      font-size: 14px;
      font-weight: 600;
      
      &.highlight {
        color: var(--el-color-primary);
      }
      
      &.warning {
        color: var(--el-color-warning);
      }
    }
  }
}

.error-alert {
  margin: 16px 20px 0;
  border-radius: 8px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.modern-table {
  border-radius: 8px;
  overflow: hidden;
  
  :deep(.el-table) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  :deep(.el-table__body-wrapper) {
    flex: 1;
    overflow: auto;
  }
  
  :deep(.hover-row) {
    transition: all 0.2s ease;
    
    &:hover {
      background-color: var(--el-fill-color-light);
      transform: translateX(2px);
    }
  }
  
  :deep(.el-table__header) {
    th {
      background: var(--el-fill-color-lighter);
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
  
  :deep(.el-table__cell) {
    padding: 16px 8px;
  }
}

.package-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .package-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--el-color-primary-light-9);
    border-radius: 8px;
    
    .package-type-icon {
      color: var(--el-color-primary);
    }
  }
  
  .package-info {
    flex: 1;
    
    .package-name {
      font-weight: 500;
      margin-bottom: 4px;
      word-break: break-word;
    }
    
    .repo-tag {
      font-size: 10px;
      padding: 0 6px;
      height: 20px;
    }
  }
}

.version-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .version-current,
  .version-new {
    display: flex;
    align-items: center;
    gap: 4px;
    
    .version-text {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
    }
  }
  
  .version-current {
    color: var(--el-text-color-secondary);
  }
  
  .version-new .version-text {
    color: var(--el-color-success);
    font-weight: 600;
  }
  
  .arrow-icon {
    color: var(--el-text-color-placeholder);
  }
}

.description-cell {
  .description-text {
    line-height: 1.5;
    margin-bottom: 8px;
    color: var(--el-text-color-regular);
  }
  
  .changelog-link {
    :deep(.el-link) {
      font-size: 12px;
    }
  }
  
  .no-description {
    opacity: 0.7;
  }
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  
  .action-btn {
    padding: 8px;
    transition: all 0.2s ease;
    
    &.info:hover {
      background: var(--el-color-info-light-9);
      border-color: var(--el-color-info-light-7);
    }
    
    &.install:hover {
      background: var(--el-color-success-light-9);
      border-color: var(--el-color-success-light-7);
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  flex: 1; /* Rozciąga się aby wypełnić przestrzeń */
  min-height: 400px; /* Minimalna wysokość dla pustego stanu */
  
  .empty-icon {
    color: var(--el-color-success);
    margin-bottom: 20px;
    opacity: 0.8;
  }
  
  h3 {
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }
  
  p {
    margin: 0 0 20px;
    color: var(--el-text-color-secondary);
  }
}

.bulk-actions {
  position: sticky;
  bottom: 0;
  padding: 16px 20px;
  background: var(--el-color-primary-light-9);
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  
  .bulk-info {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .total-size {
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }
  
  .bulk-buttons {
    display: flex;
    gap: 12px;
  }
  
  .install-selected-btn {
    min-width: 140px;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

/* Responsywność */
@media (max-width: 1200px) {
  .status-bar {
    flex-wrap: wrap;
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .updates-widget {
    min-height: 500px; /* Mniejsza minimalna wysokość na mobile */
  }

  .widget-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-actions {
    justify-content: flex-start;
  }
  
  .status-bar {
    flex-direction: column;
    gap: 12px;
  }
  
  .bulk-actions {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    
    .bulk-buttons {
      width: 100%;
      
      .el-button {
        flex: 1;
      }
    }
  }
}
</style>
