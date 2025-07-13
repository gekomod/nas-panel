<template>
  <el-card class="filesystems-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:file-tree" width="20" height="20" />
        <span>{{ t('storageFilesystems.title') }}</span>
        <div class="header-actions">
          <el-tooltip :content="t('storageFilesystems.mount')">
            <el-button 
              size="small" 
              @click="showMountDialog" 
              :disabled="loading"
              text
            >
              <Icon icon="mdi:usb-flash-drive" width="16" height="16" />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="t('storageFilesystems.format')">
            <el-button 
              size="small" 
              @click="showFormatDialog" 
              :disabled="loading"
              text
            >
              <Icon icon="mdi:format-list-checks" width="16" height="16" />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="t('storageFilesystems.refresh')">
            <el-button 
              size="small" 
              @click="refreshFilesystems" 
              :loading="loading"
              text
            >
              <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': loading }" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <!-- Mount Dialog -->
    <el-dialog v-model="mountDialogVisible" :title="t('storageFilesystems.mountDialog.title')" width="500px">
      <el-form :model="mountForm" label-position="top">
        <el-form-item :label="t('storageFilesystems.mountDialog.device')">
          <el-select v-model="mountForm.device" placeholder="Select device" style="width: 100%">
            <el-option
              v-for="device in unmountedDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.mountDialog.mountPoint')">
          <el-input v-model="mountForm.mountPoint" placeholder="/mnt/new_disk" />
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.mountDialog.fsType')">
          <el-select v-model="mountForm.fsType" placeholder="Select filesystem type" style="width: 100%">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs"
              :value="fs"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.mountDialog.options')">
          <el-input v-model="mountForm.options" placeholder="defaults,nofail" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mountDialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="mountDevice" :loading="mountLoading">
          {{ t('storageFilesystems.mountDialog.mount') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Format Dialog -->
    <el-dialog v-model="formatDialogVisible" :title="t('storageFilesystems.formatDialog.title')" width="500px">
      <el-form :model="formatForm" label-position="top">
        <el-form-item :label="t('storageFilesystems.formatDialog.device')">
          <el-select v-model="formatForm.device" placeholder="Select device" style="width: 100%">
            <el-option
              v-for="device in formatableDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.formatDialog.fsType')">
          <el-select v-model="formatForm.fsType" placeholder="Select filesystem type" style="width: 100%">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs"
              :value="fs"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.formatDialog.label')" v-if="formatForm.fsType">
          <el-input v-model="formatForm.label" :placeholder="`${formatForm.fsType}_VOLUME`" />
        </el-form-item>
        <el-form-item :label="t('storageFilesystems.formatDialog.force')">
          <el-switch v-model="formatForm.force" />
        </el-form-item>
      </el-form>
      <div class="warning-message" v-if="formatForm.device">
        <el-alert type="warning" :closable="false">
          {{ t('storageFilesystems.formatDialog.warning', { device: formatForm.device }) }}
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="formatDialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="danger" @click="formatDevice" :loading="formatLoading">
          {{ t('storageFilesystems.formatDialog.format') }}
        </el-button>
      </template>
    </el-dialog>

    <el-table :data="filesystems" style="width: 100%" v-loading="loading">

        <el-table-column prop="name" label="Package" width="180" />
        <el-table-column prop="current_version" label="Current Version" />
        <el-table-column prop="new_version" label="New Version" />
        <el-table-column prop="description" label="Description" show-overflow-tooltip />
        <el-table-column label="Actions" width="120">
          <template #default="{ row }">
            <el-button 
              size="small" 
              type="primary" 
              plain
              @click="showUpdateDetails(row)"
            >
              Details
            </el-button>
          </template>
        </el-table-column>
        
  <el-table-column label="Status" width="220">
    <template #default="{ row }">
      <div v-if="isInstallingAll || installationStatus[row.name]" class="status-container">
        <div class="progress-container">
          <el-progress 
            :percentage="installationStatus[row.name].progress"
            :status="installationStatus[row.name].status"
            :text-inside="true"
            :stroke-width="18"
            :indeterminate="installationStatus[row.name].indeterminate"
            class="progress-bar"
          />
          <el-button
            v-if="installationStatus[row.name].progress < 100"
            size="small"
            type="danger"
            plain
            circle
            @click="cancelInstallation(row.name)"
            class="cancel-btn"
          >
            <icon icon="mdi:close" width="16" />
          </el-button>
        </div>
        <div class="status-details">
          <span class="status-message">
            <icon 
              v-if="installationStatus[row.name].status === 'success'" 
              icon="mdi:check-circle" 
              width="14" 
              class="status-icon"
            />
            <icon 
              v-else-if="installationStatus[row.name].status === 'exception'" 
              icon="mdi:alert-circle" 
              width="14" 
              class="status-icon"
            />
            <icon 
              v-else 
              icon="mdi:progress-clock" 
              width="14" 
              class="status-icon"
            />
            {{ installationStatus[row.name].message }}
          </span>
          <span class="status-time">
            {{ installationStatus[row.name].time }}
          </span>
        </div>
      </div>
      <span v-else class="status-pending">
        <icon icon="mdi:clock-outline" width="14" class="status-icon" />
        Pending
      </span>
    </template>
  </el-table-column>
  
      </el-table>

      <div v-if="updates.length > 0" class="update-actions">
	<el-button 
	  type="primary" 
	  @click="installUpdates"
	  :loading="isInstalling"
	  :disabled="updates.length === 0 || Object.values(installationStatus).some(s => s.progress > 0 && s.progress < 100)"
	>
	  <el-icon class="el-icon--left"><Download /></el-icon>
	  {{ isInstalling ? 'Installing...' : `Install All (${updates.length})` }}
	</el-button>
        <el-button 
          type="danger" 
          @click="showAutomaticUpdatesDialog"
        >
          <el-icon class="el-icon--left"><Timer /></el-icon>
          Automatic Updates
        </el-button>
      </div>

      <el-dialog v-model="detailsDialogVisible" title="Update Details" width="50%">
        <div v-if="selectedUpdate">
          <h4>{{ selectedUpdate.name }}</h4>
          <el-divider />
          <p><strong>Current Version:</strong> {{ selectedUpdate.current_version }}</p>
          <p><strong>New Version:</strong> {{ selectedUpdate.new_version }}</p>
          <p><strong>Description:</strong></p>
          <pre class="update-description">{{ selectedUpdate.description }}</pre>
          <p v-if="selectedUpdate.changelog"><strong>Changelog:</strong></p>
          <pre v-if="selectedUpdate.changelog" class="update-changelog">{{ selectedUpdate.changelog }}</pre>
        </div>
        <template #footer>
          <el-button @click="detailsDialogVisible = false">Close</el-button>
          <el-button 
            type="primary" 
            @click="installSingleUpdate(selectedUpdate)"
          >
            Install This Update
          </el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="automaticUpdatesDialogVisible" title="Automatic Updates Settings" width="40%">
        <el-form label-position="top">
          <el-form-item label="Enable Automatic Updates">
            <el-switch v-model="automaticUpdatesEnabled" />
          </el-form-item>
          
          <el-form-item label="Update Schedule" v-if="automaticUpdatesEnabled">
            <el-select v-model="updateSchedule" placeholder="Select schedule">
              <el-option label="Daily" value="daily" />
              <el-option label="Weekly" value="weekly" />
              <el-option label="Monthly" value="monthly" />
            </el-select>
          </el-form-item>

          <el-form-item label="Security Updates Only" v-if="automaticUpdatesEnabled">
            <el-switch v-model="securityUpdatesOnly" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="automaticUpdatesDialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="saveAutomaticUpdatesSettings">Save</el-button>
        </template>
      </el-dialog>
    </el-card>

</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Download, Timer } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const updates = ref([])
const isChecking = ref(false)
const isInstalling = ref(false)
const lastChecked = ref('')
const error = ref('')
const detailsDialogVisible = ref(false)
const selectedUpdate = ref(null)
const automaticUpdatesDialogVisible = ref(false)
const automaticUpdatesEnabled = ref(false)
const updateSchedule = ref('daily')
const securityUpdatesOnly = ref(true)
const installationStatus = ref({})
const eventSources = ref({})
const isInstallingAll = ref(false)

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:3000`,
  timeout: 30000 // dłuższy timeout dla operacji apt
})

const checkUpdates = async () => {
  isChecking.value = true
  error.value = ''
  
  try {
    const response = await api.get('/system/updates/check')
    updates.value = response.data.updates
    lastChecked.value = new Date().toLocaleString()
    if (updates.value.length === 0) {
      ElMessage.success('System is up to date')
    }
  } catch (err) {
    error.value = 'Failed to check updates: ' + (err.response?.data?.message || err.message)
    console.error('Update check error:', err)
  } finally {
    isChecking.value = false
  }
}

const installUpdates = async () => {
  try {
    await ElMessageBox.confirm(
      `This will install ${updates.value.length} updates. Continue?`,
      'Confirm Updates',
      {
        confirmButtonText: 'Install',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
    
    isInstalling.value = true
    const packageNames = updates.value.map(update => update.name)
    
    // Rozpocznij śledzenie dla wszystkich pakietów
    updates.value.forEach(update => {
      startInstallation(update.name)
    })

    const response = await api.post('/system/updates/install', {
      packages: packageNames,
      no_confirm: true
    })

    // Utwórz EventSource dla całej instalacji
    const eventSource = new EventSource(`${window.location.protocol}//${window.location.hostname}:3000/system/updates/progress/_all`)
    eventSources.value['_all'] = eventSource

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      // Aktualizuj status dla wszystkich pakietów
      updates.value.forEach(update => {
        updateInstallationStatus(update.name, {
          progress: data.progress,
          status: data.status || '',
          message: data.message || 'Installing...',
          indeterminate: data.progress < 30
        })
      })

      if (data.progress === 100) {
        setTimeout(() => {
          eventSource.close()
          delete eventSources.value['_all']
          checkUpdates() // Odśwież listę po zakończeniu
        }, 1500)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      updates.value.forEach(update => {
        updateInstallationStatus(update.name, {
          progress: 0,
          status: 'exception',
          message: 'Connection error'
        })
      })
      eventSource.close()
      delete eventSources.value['_all']
    }

  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('Installation failed: ' + (err.response?.data?.message || err.message))
    }
  } finally {
    isInstalling.value = false
  }
}

const installSingleUpdate = async (pkg) => {
  try {
    await ElMessageBox.confirm(
      `Install ${pkg.name} (${pkg.new_version})?`,
      'Confirm Update',
      {
        confirmButtonText: 'Install',
        cancelButtonText: 'Cancel',
        type: 'info'
      }
    )

    startInstallation(pkg.name)

    // Rozpocznij instalację i śledzenie postępu
    const response = await api.post('/system/updates/install', {
      packages: [pkg.name],
      no_confirm: true
    })

    // Utwórz EventSource po rozpoczęciu instalacji
    const eventSource = new EventSource(`${window.location.protocol}//${window.location.hostname}:3000/system/updates/progress/${pkg.name}`)
    eventSources.value[pkg.name] = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        updateInstallationStatus(pkg.name, {
          progress: data.progress,
          status: data.status || '',
          message: data.message || 'Installing...',
          indeterminate: data.progress < 30
        })

        if (data.progress === 100) {
          setTimeout(() => {
            eventSource.close()
            delete eventSources.value[pkg.name]
            checkUpdates() // Odśwież listę po zakończeniu
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
        message: 'Connection error'
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
  }
}

const startInstallation = (pkgName) => {
  installationStatus.value[pkgName] = {
    progress: 0,
    status: '',
    message: 'Starting installation...',
    time: new Date().toLocaleTimeString(),
    indeterminate: true
  }
}

const updateInstallationStatus = (pkgName, data) => {
  installationStatus.value[pkgName] = {
    ...(installationStatus.value[pkgName] || {}),
    ...data,
    time: new Date().toLocaleTimeString(),
    // Wyłącz animację indeterministic po 1% postępu
    indeterminate: data.progress === 0 && data.message.includes('Downloading')
  }
}

const cancelInstallation = async (pkgName) => {
  try {
    await ElMessageBox.confirm(
      `Cancel installation of ${pkgName}?`,
      'Confirm Cancellation',
      { type: 'warning' }
    )
    
    await axios.delete(`/system/updates/cancel/${pkgName}`)
    
    if (eventSources.value[pkgName]) {
      eventSources.value[pkgName].close()
      delete eventSources.value[pkgName]
    }
    
    updateInstallationStatus(pkgName, {
      progress: 0,
      status: 'exception',
      message: 'Installation cancelled'
    })
    
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(`Failed to cancel: ${err.message}`)
    }
  }
}

const removeInstallationStatus = (pkgName) => {
  delete installationStatus.value[pkgName]
}

const showUpdateDetails = (pkg) => {
  selectedUpdate.value = pkg
  detailsDialogVisible.value = true
}

const showAutomaticUpdatesDialog = () => {
  automaticUpdatesDialogVisible.value = true
}

const saveAutomaticUpdatesSettings = () => {
  ElMessage.success('Automatic updates settings saved!')
  automaticUpdatesDialogVisible.value = false
}

onMounted(() => {
  checkUpdates()
})

onBeforeUnmount(() => {
  Object.values(eventSources.value).forEach(source => source.close())
})
</script>

<style scoped>
.status-container {
  width: 100%;
}

.updates-container {
  padding: 20px;
}

.updates-card {
  height: 100%;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.status-alert {
  margin-bottom: 20px;
}

.update-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.update-description, .update-changelog {
  white-space: pre-wrap;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
}

.status-message {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  text-align: center;
}

.el-progress {
  margin: 8px 0;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-bar {
  flex-grow: 1;
  min-width: 120px;
}

.cancel-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 6px;
}

.status-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  width: 100%;
}

.status-time {
  color: var(--el-text-color-placeholder);
  margin-left: 8px;
  font-size: 11px;
}

.status-pending {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
}

.status-icon {
  vertical-align: middle;
}

.status-message {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

/* Kolory dla różnych statusów */
:deep(.el-progress-bar__inner) {
  transition: all 0.5s ease;
}

:deep(.el-progress-bar__innerText) {
  color: white;
  font-weight: bold;
  text-shadow: 0 0 2px rgba(0,0,0,0.5);
}

:deep(.el-progress--success .el-progress-bar__inner) {
  background-color: var(--el-color-success);
}

:deep(.el-progress--exception .el-progress-bar__inner) {
  background-color: var(--el-color-error);
}

/* Animacje */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.error-message {
  margin-bottom: 20px;
}
</style>
