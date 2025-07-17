<template>
  <el-card class="updates-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:update" width="20" height="20" />
        <span>{{ t('systemUpdates.title') }}</span>
        <div class="header-actions">
          <el-tooltip :content="t('systemUpdates.refresh')">
            <el-button 
              size="small" 
              @click="checkUpdates" 
              :loading="isChecking"
              text
            >
              <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': isChecking }" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <el-alert v-if="error" :title="error" type="error" show-icon style="margin: 0 16px 16px;" />
    
    <div class="table-container">
      <el-table 
        :data="updates"
        style="width: 100%"
        v-loading="isChecking"
        :empty-text="t('systemUpdates.noUpdates')"
        class="full-width-table"
        :layout="tableLayout"
      >
        <el-table-column 
          prop="name" 
          :label="t('systemUpdates.package')" 
          width="220"
          min-width="180"
          fixed="left"
        >
          <template #default="{ row }">
            <div class="package-name">
              <Icon icon="mdi:package-variant" width="16" />
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.version')" 
          width="330"
          min-width="160"
        >
          <template #default="{ row }">
            <div class="version-container">
              <el-tag size="small" effect="plain">{{ row.current_version }}</el-tag>
              <Icon icon="mdi:arrow-right" width="16" />
              <el-tag size="small" type="success" effect="dark">{{ row.new_version }}</el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          prop="description" 
          :label="t('systemUpdates.description')" 
          min-width="300"
        >
          <template #default="{ row }">
            <div class="package-description">
              <div class="description-text" v-if="row.description">
                {{ truncateDescription(row.description) }}
              </div>
              <div class="no-description" v-else>
                <el-tag size="small" type="info">{{ t('systemUpdates.noDescription') }}</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.status')" 
          width="220"
          min-width="180"
        >
          <template #default="{ row }">
            <UpdateStatus :status="getStatusForPackage(row.name)" />
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('systemUpdates.actions')" 
          width="180"
          min-width="150"
          fixed="right"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip :content="t('systemUpdates.details')" placement="top">
                <el-button 
                  size="small" 
                  type="info" 
                  @click="showUpdateDetails(row)"
                  circle
                >
                  <icon icon="mdi:information-outline" width="16" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip :content="t('systemUpdates.install')" placement="top">
                <el-button 
                  size="small" 
                  type="success" 
                  @click="installSingleUpdate(row)"
                  :loading="installationStatus[row.name]?.progress > 0"
                  circle
                >
                  <icon icon="mdi:package-down" width="16" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="updates.length > 0" class="update-actions">
      <el-button 
        type="primary" 
        @click="installUpdates"
        :loading="isInstallingAll"
        :disabled="isInstalling || updates.length === 0"
        class="install-all-btn"
      >
        <el-icon class="el-icon--left"><Download /></el-icon>
        {{ t('systemUpdates.installAll', { count: updates.length }) }}
      </el-button>
      <el-button 
        type="info" 
        @click="showAutomaticUpdatesDialog"
        plain
      >
        <el-icon class="el-icon--left"><Timer /></el-icon>
        {{ t('systemUpdates.automaticUpdates') }}
      </el-button>
    </div>

    <el-dialog
  v-model="detailsDialogVisible"
  :title="t('systemUpdates.updateDetails')"
  width="50%"
>
  <div v-if="selectedUpdate" class="update-details">
    <h3>{{ selectedUpdate.name }}</h3>
    
    <div class="version-display">
      <el-tag size="medium" effect="plain">{{ selectedUpdate.current_version }}</el-tag>
      <Icon icon="mdi:arrow-right" width="20" />
      <el-tag size="medium" type="success" effect="dark">{{ selectedUpdate.new_version }}</el-tag>
    </div>
    
    <el-divider />
    
    <h4>{{ t('systemUpdates.description') }}</h4>
    <div class="description-content">
      {{ selectedUpdate.fullDescription || t('systemUpdates.noDescription') }}
    </div>
  </div>
  
  <template #footer>
    <el-button @click="detailsDialogVisible = false">
      {{ t('common.close') }}
    </el-button>
  </template>
</el-dialog>

  </el-card>

</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Timer, Clock, CircleCheck, Warning, Loading } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const tableLayout = ref('fixed')
import UpdateStatus from './UpdateStatus.vue'

// Import tłumaczeń
import enLocales from './locales/en'
import plLocales from './locales/pl'

const { t, mergeLocaleMessage } = useI18n()

// Dodaj tłumaczenia do i18n
mergeLocaleMessage('en', enLocales)
mergeLocaleMessage('pl', plLocales)

// Reactive state
const updates = ref([])
const isChecking = ref(false)
const isInstalling = ref(false)
const isInstallingAll = ref(false)
const lastChecked = ref('')
const error = ref('')
const detailsDialogVisible = ref(false)
const selectedUpdate = ref(null)
const automaticUpdatesDialogVisible = ref(false)
const installationStatus = ref({})
const eventSources = ref({})

// Automatic updates settings
const automaticUpdatesEnabled = ref(false)
const updateSchedule = ref('daily')
const updateType = ref('security')
const rebootAfterUpdate = ref(false)

const scheduleOptions = [
  { value: 'daily', label: t('systemUpdates.daily') },
  { value: 'weekly', label: t('systemUpdates.weekly') },
  { value: 'monthly', label: t('systemUpdates.monthly') }
]

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:3000`,
  timeout: 30000
})

const truncateDescription = (desc) => {
  if (!desc) return ''
  return desc.length > 100 
    ? `${desc.substring(0, 100)}...` 
    : desc
}

// Computed
const hasUpdates = computed(() => updates.value.length > 0)
const lastCheckedFormatted = computed(() => lastChecked.value ? new Date(lastChecked.value).toLocaleString() : '')

// Methods
const checkUpdates = async () => {
  isChecking.value = true;
  error.value = '';
  
  try {
    // Wysyłamy force=true aby zignorować cache przy ręcznym sprawdzaniu
    const response = await api.get('/system/updates/check?force=true');
    updates.value = response.data.updates || [];
    lastChecked.value = new Date().toISOString();
    
    if (!hasUpdates.value) {
      ElMessage.success(t('systemUpdates.systemUpToDate'));
    }
  } catch (err) {
    error.value = t('systemUpdates.checkFailed', { 
      error: err.response?.data?.message || err.message 
    });
    console.error('Update check error:', err);
  } finally {
    isChecking.value = false;
  }
};

const installUpdates = async () => {
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallAll', { count: updates.value.length }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    isInstallingAll.value = true
    const packageNames = updates.value.map(update => update.name)
    
    // Initialize installation status for all packages
    updates.value.forEach(update => {
      startInstallation(update.name)
    })

    // Start installation
    await api.post('/system/updates/install', {
      packages: packageNames,
      no_confirm: true
    })

    // Track progress via SSE
    const eventSource = new EventSource(`${api.defaults.baseURL}/system/updates/progress/_all`)
    eventSources.value['_all'] = eventSource

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      updates.value.forEach(update => {
        updateInstallationStatus(update.name, {
          progress: data.progress,
          status: data.status || '',
          message: data.message || t('systemUpdates.installing'),
          indeterminate: data.progress < 30
        })
      })

      if (data.progress === 100) {
        setTimeout(() => {
          eventSource.close()
          delete eventSources.value['_all']
          checkUpdates() // Refresh list after completion
        }, 1500)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      updates.value.forEach(update => {
        updateInstallationStatus(update.name, {
          progress: 0,
          status: 'exception',
          message: t('systemUpdates.connectionError')
        })
      })
      eventSource.close()
      delete eventSources.value['_all']
    }

  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('systemUpdates.installFailed', { error: err.response?.data?.message || err.message }))
    }
  } finally {
    isInstallingAll.value = false
  }
}

const installSingleUpdate = async (pkg) => {
  if (!pkg) return
  
  try {
    await ElMessageBox.confirm(
      t('systemUpdates.confirmInstallSingle', { name: pkg.name, version: pkg.new_version }),
      t('systemUpdates.confirmTitle'),
      {
        confirmButtonText: t('systemUpdates.install'),
        cancelButtonText: t('common.cancel'),
        type: 'info'
      }
    )

    startInstallation(pkg.name)
    isInstalling.value = true

    await api.post('/system/updates/install', {
      packages: [pkg.name],
      no_confirm: true
    })

    const eventSource = new EventSource(`${api.defaults.baseURL}/system/updates/progress/${pkg.name}`)
    eventSources.value[pkg.name] = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        updateInstallationStatus(pkg.name, {
          progress: data.progress,
          status: data.status || '',
          message: data.message || t('systemUpdates.installing'),
          indeterminate: data.progress < 30
        })

        if (data.progress === 100) {
          setTimeout(() => {
            eventSource.close()
            delete eventSources.value[pkg.name]
            checkUpdates() // Refresh list after completion
          }, 1500)
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      updateInstallationStatus(pkg.name, {
        progress: 0,
        status: 'exception',
        message: t('systemUpdates.connectionError')
      })
      eventSource.close()
      delete eventSources.value[pkg.name]
    }

  } catch (err) {
    if (err !== 'cancel') {
      updateInstallationStatus(pkg.name, {
        progress: 0,
        status: 'exception',
        message: err.response?.data?.message || err.message
      })
    }
  } finally {
    isInstalling.value = false
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
    time: new Date().toLocaleTimeString(),
    indeterminate: data.progress === 0 && data.message.includes('Downloading')
  }
}

const showUpdateDetails = (pkg) => {
  selectedUpdate.value = {
    ...pkg,
    fullDescription: pkg.description // Zachowaj pełny opis
  };
  detailsDialogVisible.value = true;
};

const showAutomaticUpdatesDialog = () => {
  automaticUpdatesDialogVisible.value = true
}

const saveAutomaticUpdatesSettings = async () => {
  try {
    await api.post('/system/updates/settings', {
      enabled: automaticUpdatesEnabled.value,
      schedule: updateSchedule.value,
      type: updateType.value,
      reboot: rebootAfterUpdate.value
    })
    
    ElMessage.success(t('systemUpdates.settingsSaved'))
    automaticUpdatesDialogVisible.value = false
  } catch (err) {
    ElMessage.error(t('systemUpdates.saveFailed', { error: err.message }))
  }
}

// Lifecycle hooks
onMounted(() => {
  checkUpdates()
  
  // Load automatic updates settings
//  api.get('/system/updates/settings').then(response => {
//    const settings = response.data
//    automaticUpdatesEnabled.value = settings.enabled
//    updateSchedule.value = settings.schedule || 'daily'
//    updateType.value = settings.type || 'security'
//    rebootAfterUpdate.value = settings.reboot || false
//  }).catch(console.error)
})

onBeforeUnmount(() => {
  Object.values(eventSources.value).forEach(source => source.close())
})
</script>

<style scoped>
.updates-widget {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  
  span {
    font-weight: 600;
    font-size: 16px;
  }
}

.header-actions {
  margin-left: auto;
}

.table-container {
  flex: 1;
  padding: 16px;
  width: 100%;
  overflow-x: auto;
}

.full-width-table {
  width: 100% !important;
  
  :deep(.el-table__header-wrapper),
  :deep(.el-table__body-wrapper) {
    width: 100% !important;
  }
  
  :deep(.el-table__cell) {
    padding: 12px 8px;
  }
}

.package-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  
  svg {
    color: var(--el-color-primary);
  }
}

.version-container {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .el-tag {
    font-family: monospace;
    font-size: 0.9em;
  }
}

.package-description {
  line-height: 1.4;
  
  .description-text {
    white-space: normal;
    word-break: break-word;
  }
  
  .no-description {
    opacity: 0.7;
  }
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  
  .el-button.is-circle {
    padding: 8px;
  }
}

.update-actions {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  gap: 12px;
  
  .install-all-btn {
    margin-right: auto;
  }
}

.update-details {
  padding: 0 20px;
  
  h3 {
    margin-top: 0;
    color: var(--el-color-primary);
  }
  
  .version-display {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 15px 0;
  }
  
  .description-content {
    white-space: pre-wrap;
    line-height: 1.6;
    max-height: 300px;
    overflow-y: auto;
    padding: 10px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
  }
}

/* Animacje */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsywność */
@media (max-width: 1200px) {
  .full-width-table {
    :deep(.el-table__cell) {
      padding: 10px 4px;
    }
  }
}

@media (max-width: 768px) {
  .table-container {
    padding: 8px;
  }
  
  .update-actions {
    flex-direction: column;
    
    .install-all-btn {
      margin-right: 0;
      width: 100%;
    }
  }
}
</style>
