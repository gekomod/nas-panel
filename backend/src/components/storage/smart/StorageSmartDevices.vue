<template>
  <el-card class="storage-smart-widget">
    <template #header>
      <div class="widget-header">
        <div class="header-left">
          <Icon icon="ph:hard-drives" width="20" height="20" class="header-icon" />
          <div class="title-wrapper">
            <h3 class="widget-title">{{ t('storageSmart.title') }}</h3>
          </div>
        </div>
        <div class="header-actions">
          <el-tooltip :content="t('storageSmart.refresh')" placement="top">
            <el-button 
              size="small" 
              @click="fetchDevices" 
              :loading="loading"
              :icon="Loading" 
              circle
              class="refresh-btn"
            />
          </el-tooltip>
        </div>
      </div>
    </template>

    <el-alert
      v-if="smartNotAvailable"
      :title="t('storageSmart.notAvailableTitle')"
      type="warning"
      :description="t('storageSmart.notAvailableMessage')"
      show-icon
      :closable="false"
      class="availability-alert mb-4"
    >
      <div class="alert-content">
        <p class="alert-description">{{ t('storageSmart.notAvailableSolution') }}</p>
        <el-input 
          :model-value="t('storageSmart.installCommand')" 
          readonly 
          class="install-command-input mb-3"
        >
          <template #append>
            <el-button 
              @click="copyInstallCommand"
              :icon="CopyDocument"
              size="small"
            />
          </template>
        </el-input>
        <el-button type="primary" size="small" @click="fetchDevices" :loading="loading">
          {{ t('storageSmart.retry') }}
        </el-button>
      </div>
    </el-alert>

    <div v-if="error" class="error-container mb-4">
      <el-alert
        :title="t('common.error')"
        :description="error"
        type="error"
        show-icon
        closable
        @close="error = null"
      />
    </div>

    <div class="table-container">
      <el-table 
        :data="devices" 
        v-loading="loading"
        row-key="device"
        :empty-text="emptyText"
        class="devices-table"
        :class="{ 'empty': devices.length === 0 }"
        style="width: 100%"
      >
        <el-table-column prop="monitored" :label="t('storageSmart.monitored')" align="center" width="100">
          <template #default="{ row }">
            <div class="monitor-cell">
              <el-switch
                v-model="row.monitored"
                @change="toggleMonitoring(row)"
                :loading="row.loading"
                size="small"
                inline-prompt
                :active-icon="Check"
                :inactive-icon="Close"
                style="--el-switch-on-color: var(--el-color-success); --el-switch-off-color: var(--el-border-color)"
              />
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="device" :label="t('storageSmart.device')">
          <template #default="{ row }">
            <div class="device-cell">
              <div class="device-icon" :class="{ 'ssd': row.isSSD, 'hdd': !row.isSSD }">
                <Icon :icon="getDeviceIcon(row)" width="14" height="14" />
              </div>
              <div class="device-info">
                <span class="device-name">{{ row.device }}</span>
                <span :class="['device-type', row.isSSD ? 'ssd-tag' : 'hdd-tag']">
                  {{ row.isSSD ? 'SSD' : 'HDD' }}
                </span>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="model" :label="t('storageSmart.model')" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="model-text">{{ row.model || '—' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="vendor" :label="t('storageSmart.vendor')" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="vendor-cell">
              <Icon 
                v-if="getVendorIcon(row.vendor)" 
                :icon="getVendorIcon(row.vendor)" 
                width="14" 
                height="14" 
                class="vendor-icon"
              />
              <span class="vendor-name">{{ row.vendor || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="serial" :label="t('storageSmart.serial')" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="serial-text">{{ row.serial || '—' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="capacity" :label="t('storageSmart.capacity')" align="right">
          <template #default="{ row }">
            <div class="capacity-cell">
              <span class="capacity-value">{{ formatBytes(row.capacity) }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="temperature" :label="t('storageSmart.temperature')" align="center">
          <template #default="{ row }">
            <div v-if="row.temperature !== null && row.temperature !== undefined" 
                 class="temp-cell" 
                 :class="getTempClass(row.temperature, row.isSSD)">
              <Icon :icon="getTempIcon(row.temperature, row.isSSD)" width="12" height="12" />
              <span class="temp-value">{{ row.temperature }}°C</span>
              <el-tooltip 
                v-if="row.rawData" 
                :content="t('storageSmart.viewRawData')" 
                placement="top"
              >
                <el-button 
                  size="small" 
                  circle 
                  @click="showRawData(row)"
                  class="raw-data-btn"
                >
                  <Icon icon="ph:code" width="10" />
                </el-button>
              </el-tooltip>
            </div>
            <div v-else class="temp-cell temp-unknown">
              <Icon icon="ph:thermometer-simple" width="12" height="12" />
              <span class="temp-na">—</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" :label="t('storageSmart.statusS')">
          <template #default="{ row }">
            <template v-if="row.available !== false">
              <div class="status-container">
                <el-tag 
                  :type="getStatusTagType(row)" 
                  effect="plain"
                  class="status-tag"
                  size="small"
                >
                  <Icon :icon="getStatusIcon(row)" width="10" height="10" class="status-icon" />
                  {{ getStatusText(row) }}
                </el-tag>
                <el-tooltip 
                  v-if="hasCriticalIssues(row)"
                  effect="dark" 
                  placement="top"
                  :content="getCriticalIssuesTooltip(row)"
                >
                  <div class="warning-indicator">
                    <Icon icon="ph:warning" width="12" />
                  </div>
                </el-tooltip>
              </div>
            </template>
            <template v-else>
              <el-tag type="info" effect="plain" class="status-tag" size="small">
                <Icon icon="ph:question" width="10" height="10" class="status-icon" />
                {{ t('storageSmart.statusValues.unavailable') }}
              </el-tag>
            </template>
          </template>
        </el-table-column>

        <el-table-column label="Akcje" width="80" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip :content="t('storageSmart.viewDetails')" placement="top">
                <el-button 
                  size="small" 
                  circle 
                  plain
                  @click="showDetails(row.device)"
                  class="action-btn"
                >
                  <Icon icon="ph:info" width="12" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog 
      v-model="rawDataDialog" 
      :title="t('storageSmart.rawDataTitle')" 
      width="80%"
      class="raw-data-dialog"
    >
      <div class="raw-data-container">
        <pre class="raw-data-content">{{ currentRawData }}</pre>
      </div>
      <template #footer>
        <el-button @click="rawDataDialog = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script>
export default {
  name: 'StorageSmartDevices',
  displayName: 'Monitorowane urządzenia'
}
</script>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElNotification, ElMessage } from 'element-plus'
import { CopyDocument, Loading, Check, Close } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()

const devices = ref([])
const loading = ref(false)
const error = ref(null)
const smartNotAvailable = ref(false)
const rawDataDialog = ref(false)
const currentRawData = ref('')
const router = useRouter()

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}`

const emptyText = computed(() => {
  if (smartNotAvailable.value) return t('storageSmart.smartNotAvailable')
  if (error.value) return t('storageSmart.errorLoading')
  return t('storageSmart.noDevices')
})

const getDeviceIcon = (device) => {
  if (device.isSSD) return 'ph:circle-wavy-warning'
  if (device.device?.startsWith('nvme')) return 'ph:chip'
  if (device.device?.startsWith('sd')) return 'ph:hard-drive'
  return 'ph:hard-drive'
}

const getVendorIcon = (vendor) => {
  if (!vendor) return null
  
  const vendorLower = vendor.toLowerCase()
  if (vendorLower.includes('samsung')) return 'ph:device-tablet'
  if (vendorLower.includes('western') || vendorLower.includes('wd')) return 'ph:circle-wavy'
  if (vendorLower.includes('seagate')) return 'ph:wave-sawtooth'
  if (vendorLower.includes('toshiba')) return 'ph:lightning'
  if (vendorLower.includes('intel')) return 'ph:cpu'
  if (vendorLower.includes('kingston')) return 'ph:crown'
  if (vendorLower.includes('crucial')) return 'ph:star'
  if (vendorLower.includes('sandisk')) return 'ph:flashlight'
  
  return null
}

const getTempIcon = (temp, isSSD) => {
  const tempClass = getTempClass(temp, isSSD)
  switch (tempClass) {
    case 'temp-critical': return 'ph:fire'
    case 'temp-warning': return 'ph:thermometer-hot'
    case 'temp-normal': return 'ph:thermometer'
    default: return 'ph:thermometer-simple'
  }
}

const getStatusIcon = (device) => {
  if (device.badSectors > 0) return 'ph:warning-circle'
  
  switch (device.status) {
    case 'healthy': return 'ph:check-circle'
    case 'warning': return 'ph:warning'
    case 'error': return 'ph:x-circle'
    default: return 'ph:question'
  }
}

const showRawData = (row) => {
  currentRawData.value = JSON.stringify(row.rawData, null, 2)
  rawDataDialog.value = true
}

const formatBytes = (bytes, decimals = 1) => {
  if (isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

const getTempClass = (temp, isSSD = false) => {
  if (temp === undefined || temp === null) return 'temp-unknown'
  
  const limit = isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD
  const warningLimit = limit - 10
  
  if (temp > limit) return 'temp-critical'
  if (temp > warningLimit) return 'temp-warning'
  return 'temp-normal'
}

const getStatusText = (device) => {
  if (device.badSectors > 0) {
    return t('storageSmart.statusValues.badSectors')
  }
  if (device.status) {
    return t(`storageSmart.statusValues.${device.status}`) || device.status
  }
  return t('storageSmart.statusValues.unknown')
}

const getStatusTagType = (device) => {
  if (device.badSectors > 0) {
    return 'warning'
  }
  switch (device.status) {
    case 'healthy': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'danger'
    default: return 'info'
  }
}

const showDetails = (device) => {
  router.push(`/storage/smart/devices/details/${encodeURIComponent(device)}`)
}

const copyInstallCommand = async () => {
  try {
    await navigator.clipboard.writeText(t('storageSmart.installCommand'))
    ElMessage.success(t('storageSmart.commandCopied'))
  } catch (err) {
    ElMessage.error(t('common.copyFailed'))
  }
}

const hasCriticalIssues = (device) => {
  return device.badSectors > 0 || 
         (device.outOfSpecParams && device.outOfSpecParams.length > 0) ||
         isTempCritical(device.temperature, device.isSSD)
}

const getCriticalIssuesTooltip = (device) => {
  const issues = []
  
  if (device.badSectors > 0) {
    issues.push(`${t('storageSmart.badSectors')}: ${device.badSectors}`)
  }
  
  if (device.outOfSpecParams && device.outOfSpecParams.length > 0) {
    issues.push(`${t('storageSmart.outOfSpecParams')}: ${device.outOfSpecParams.length}`)
  }
  
  if (isTempCritical(device.temperature, device.isSSD)) {
    const limit = device.isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD
    issues.push(`${t('storageSmart.highTemp')}: ${device.temperature}°C (${t('storageSmart.max')} ${limit}°C)`)
  }
  
  return issues.join('\n')
}

const isTempCritical = (temp, isSSD = false) => {
  if (!temp) return false
  const limit = isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD
  return temp > limit
}

const TEMP_LIMIT_SSD = 50
const TEMP_LIMIT_HDD = 55

const fetchDevices = async () => {
  try {
    loading.value = true
    error.value = null
    smartNotAvailable.value = false
    
    const [smartResponse, monitoringResponse] = await Promise.all([
      axios.get('/api/storage/smart'),
      axios.get('/api/storage/smart/monitoring')
    ])
    
    devices.value = smartResponse.data.data.map(device => {
      const monitoredStatus = monitoringResponse.data.devices?.[device.device]?.monitored || false
      
      const badSectors = calculateBadSectors(device.rawData)
      const outOfSpecParams = checkOutOfSpecParams(device.rawData)
      const isSSD = device.rawData?.rotation_rate === 0 || device.model?.toLowerCase().includes('ssd')
      
      return {
        ...device,
        monitored: monitoredStatus,
        loading: false,
        badSectors,
        outOfSpecParams,
        isSSD,
        temperature: extractTemperature(device.rawData) || device.temperature,
        available: device.available !== false
      }
    })
    
    if (devices.value.length === 0) {
      smartNotAvailable.value = true
    }
    
  } catch (err) {
    console.error('Error fetching devices:', err)
    
    if (err.response?.status === 404 || err.response?.data?.error?.includes('SMART')) {
      smartNotAvailable.value = true
      error.value = t('storageSmart.smartNotAvailable')
    } else {
      error.value = err.response?.data?.error || t('storageSmart.errorLoading')
    }
    
    if (err.response?.config?.url.includes('monitoring')) {
      try {
        const smartResponse = await axios.get('/api/storage/smart')
        devices.value = smartResponse.data.data.map(device => ({
          ...device,
          monitored: false,
          loading: false,
          badSectors: calculateBadSectors(device.rawData),
          outOfSpecParams: checkOutOfSpecParams(device.rawData),
          isSSD: device.rawData?.rotation_rate === 0 || device.model?.toLowerCase().includes('ssd'),
          temperature: extractTemperature(device.rawData) || device.temperature,
          available: true
        }))
      } catch (smartErr) {
        console.error('Error fetching SMART data:', smartErr)
      }
    }
  } finally {
    loading.value = false
  }
}

const toggleMonitoring = async (device) => {
  const originalState = device.monitored
  device.loading = true
  
  try {
    await axios.post('/api/storage/smart/monitoring', {
      device: device.device,
      enabled: device.monitored
    })
    
    ElNotification.success({
      title: t('storageSmart.title'),
      message: device.monitored 
        ? t('storageSmart.enableMonitoringSuccess') 
        : t('storageSmart.disableMonitoringSuccess'),
      duration: 2000
    })
  } catch (err) {
    device.monitored = !originalState
    
    ElNotification.error({
      title: t('storageSmart.title'),
      message: err.response?.data?.error || t('common.error'),
      duration: 3000
    })
  } finally {
    device.loading = false
  }
}

const calculateBadSectors = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return 0
  
  const reallocated = smartData.ata_smart_attributes.table.find(a => a.id === 5)
  const pending = smartData.ata_smart_attributes.table.find(a => a.id === 197)
  const offline = smartData.ata_smart_attributes.table.find(a => a.id === 198)
  
  return (reallocated?.raw?.value || 0) + 
         (pending?.raw?.value || 0) + 
         (offline?.raw?.value || 0)
}

const checkOutOfSpecParams = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return []
  
  return smartData.ata_smart_attributes.table
    .filter(attr => attr.value && attr.thresh && attr.value <= attr.thresh)
    .map(attr => ({
      id: attr.id,
      name: attr.name,
      value: attr.value,
      threshold: attr.thresh
    }))
}

const extractTemperature = (smartData) => {
  if (!smartData) return null
  
  if (smartData.nvme_smart_health_information_log?.temperature) {
    return Math.round(smartData.nvme_smart_health_information_log.temperature - 273)
  }
  
  if (smartData.temperature?.current) return smartData.temperature.current
  
  if (smartData.ata_smart_attributes?.table) {
    const tempAttr = smartData.ata_smart_attributes.table.find(
      attr => ['Temperature_Celsius', 'Temperature_Internal'].includes(attr.name) || attr.id === 194
    )
    if (tempAttr?.raw?.value) return parseInt(tempAttr.raw.value)
  }
  
  return null
}

onMounted(async () => {
  await fetchDevices()
})
</script>

<style scoped>
.storage-smart-widget {
  height: 100%;
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  color: var(--el-color-primary);
}

.title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.widget-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.refresh-btn {
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  width: 32px;
  height: 32px;
}

.refresh-btn:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.availability-alert {
  border-radius: 6px;
  border: 1px solid var(--el-color-warning-light-8);
  background: var(--el-color-warning-light-9);
  margin: 16px;
}

.alert-content {
  padding: 4px 0;
}

.alert-description {
  margin: 0 0 10px 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.4;
}

.install-command-input {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
}

.error-container {
  border-radius: 6px;
  overflow: hidden;
  margin: 16px;
}

.table-container {
  overflow-x: auto;
  padding: 0 16px 16px;
}

.devices-table {
  width: 100%;
  font-size: 13px;
}

/* KLUCZOWA POPRAWKA: Naprawa łamania tekstu w nagłówkach */
.devices-table :deep(.el-table) {
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-header-bg-color: var(--el-fill-color-light);
  --el-table-row-hover-bg-color: var(--el-fill-color-lighter);
  --el-table-text-color: var(--el-text-color-primary);
  --el-table-header-text-color: var(--el-text-color-primary);
}

.devices-table :deep(.el-table__header-wrapper) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.devices-table :deep(.el-table__header tr) {
  background: var(--el-fill-color-light);
}

.devices-table :deep(.el-table__header th) {
  padding: 12px 8px !important;
  font-weight: 600;
  font-size: 12px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border: none;
  height: 40px;
  vertical-align: middle;
  white-space: nowrap !important; /* NIE łam tekstu! */
  overflow: visible !important;
}

/* TO JEST KLUCZOWE: Style dla komórek nagłówka */
.devices-table :deep(.el-table__header .cell) {
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  line-height: 1.2;
}

/* Dla kolumn z align center i right */
.devices-table :deep(.el-table__header th.is-center .cell) {
  justify-content: center;
}

.devices-table :deep(.el-table__header th.is-right .cell) {
  justify-content: flex-end;
}

.devices-table :deep(.el-table__body tr) {
  background: transparent;
  height: 48px;
}

.devices-table :deep(.el-table__body tr:hover) {
  background: var(--el-fill-color-lighter);
}

.devices-table :deep(.el-table__body td) {
  padding: 8px 8px !important;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
  border: none;
  height: 48px;
  vertical-align: middle;
}

.devices-table :deep(.el-table__cell) {
  border: none;
}

.devices-table.empty {
  min-height: 200px;
}

.monitor-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.device-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.device-icon.ssd {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.device-icon.hdd {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-name {
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.device-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  width: fit-content;
}

.ssd-tag {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary-dark-2);
}

.hdd-tag {
  background: var(--el-color-info-light-8);
  color: var(--el-color-info-dark-2);
}

.model-text {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vendor-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vendor-icon {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.vendor-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.serial-text {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capacity-cell {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: 100%;
}

.capacity-value {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-weight: 500;
}

.temp-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.temp-cell.temp-normal {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.temp-cell.temp-warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.temp-cell.temp-critical {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.temp-cell.temp-unknown {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}

.temp-value {
  font-size: 13px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
}

.temp-na {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.raw-data-btn {
  border: none;
  background: transparent;
  color: inherit;
  padding: 2px;
  width: 22px;
  height: 22px;
  opacity: 0.7;
}

.raw-data-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  opacity: 1;
}

.status-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-tag {
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
}

.status-tag.el-tag--success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border: 1px solid var(--el-color-success-light-7);
}

.status-tag.el-tag--warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-7);
}

.status-tag.el-tag--danger {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border: 1px solid var(--el-color-danger-light-7);
}

.status-tag.el-tag--info {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
  border: 1px solid var(--el-color-info-light-7);
}

.status-icon {
  flex-shrink: 0;
}

.warning-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.warning-indicator:hover {
  background: var(--el-color-warning-light-6);
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
}

.action-btn {
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  width: 28px;
  height: 28px;
}

.action-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.raw-data-dialog {
  border-radius: 8px;
}

.raw-data-container {
  max-height: 60vh;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.raw-data-content {
  margin: 0;
  padding: 16px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

/* TRYB CIEMNY - POPRAWIŁEM */
:global(.dark) .storage-smart-widget {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
}

:global(.dark) .widget-header {
  background: var(--el-fill-color-dark);
  border-bottom-color: var(--el-border-color);
}

:global(.dark) .header-icon {
  color: var(--el-color-primary-light-3);
}

:global(.dark) .widget-title {
  color: var(--el-text-color-primary);
}

:global(.dark) .refresh-btn {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
}

:global(.dark) .refresh-btn:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-dark-9);
  color: var(--el-color-primary-light-3);
}

:global(.dark) .availability-alert {
  background: var(--el-color-warning-dark-9);
  border-color: var(--el-color-warning-dark-8);
}

:global(.dark) .alert-description {
  color: var(--el-text-color-secondary);
}

:global(.dark) .install-command-input {
  background: var(--el-fill-color-dark);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

/* NAPRAWIŁEM TABELĘ W TRYBIE CIEMNYM */
:global(.dark) .devices-table :deep(.el-table) {
  --el-table-border-color: var(--el-border-color);
  --el-table-header-bg-color: var(--el-fill-color-dark);
  --el-table-row-hover-bg-color: var(--el-fill-color-darker);
  --el-table-text-color: var(--el-text-color-primary);
  --el-table-header-text-color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
}

:global(.dark) .devices-table :deep(.el-table__header-wrapper) {
  border-bottom-color: var(--el-border-color);
}

:global(.dark) .devices-table :deep(.el-table__header tr) {
  background: var(--el-fill-color-dark);
}

:global(.dark) .devices-table :deep(.el-table__header th) {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-primary);
  white-space: nowrap !important;
  overflow: visible !important;
}

:global(.dark) .devices-table :deep(.el-table__header .cell) {
  white-space: nowrap !important;
  overflow: visible !important;
  color: var(--el-text-color-primary);
}

:global(.dark) .devices-table :deep(.el-table__body tr) {
  background: var(--el-bg-color-overlay);
}

:global(.dark) .devices-table :deep(.el-table__body tr:hover) {
  background: var(--el-fill-color-darker);
}

:global(.dark) .devices-table :deep(.el-table__body td) {
  border-bottom-color: var(--el-border-color);
  background: var(--el-bg-color-overlay);
}

:global(.dark) .device-icon.ssd {
  background: var(--el-color-primary-dark-9);
  color: var(--el-color-primary-light-3);
}

:global(.dark) .device-icon.hdd {
  background: var(--el-color-info-dark-9);
  color: var(--el-color-info-light-3);
}

:global(.dark) .ssd-tag {
  background: var(--el-color-primary-dark-8);
  color: var(--el-color-primary-light-3);
}

:global(.dark) .hdd-tag {
  background: var(--el-color-info-dark-8);
  color: var(--el-color-info-light-3);
}

:global(.dark) .temp-cell.temp-normal {
  background: var(--el-color-success-dark-9);
  color: var(--el-color-success-light-3);
}

:global(.dark) .temp-cell.temp-warning {
  background: var(--el-color-warning-dark-9);
  color: var(--el-color-warning-light-3);
}

:global(.dark) .temp-cell.temp-critical {
  background: var(--el-color-danger-dark-9);
  color: var(--el-color-danger-light-3);
}

:global(.dark) .temp-cell.temp-unknown {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-placeholder);
}

:global(.dark) .raw-data-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .status-tag.el-tag--success {
  background: var(--el-color-success-dark-9);
  color: var(--el-color-success-light-3);
  border-color: var(--el-color-success-dark-7);
}

:global(.dark) .status-tag.el-tag--warning {
  background: var(--el-color-warning-dark-9);
  color: var(--el-color-warning-light-3);
  border-color: var(--el-color-warning-dark-7);
}

:global(.dark) .status-tag.el-tag--danger {
  background: var(--el-color-danger-dark-9);
  color: var(--el-color-danger-light-3);
  border-color: var(--el-color-danger-dark-7);
}

:global(.dark) .status-tag.el-tag--info {
  background: var(--el-color-info-dark-9);
  color: var(--el-color-info-light-3);
  border-color: var(--el-color-info-dark-7);
}

:global(.dark) .warning-indicator {
  background: var(--el-color-warning-dark-8);
  color: var(--el-color-warning-light-3);
}

:global(.dark) .warning-indicator:hover {
  background: var(--el-color-warning-dark-6);
}

:global(.dark) .action-btn {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
}

:global(.dark) .action-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-dark-9);
}

:global(.dark) .raw-data-container {
  background: var(--el-fill-color-dark);
  border-color: var(--el-border-color);
}

/* Scrollbar styling dla trybu ciemnego */
:global(.dark) .raw-data-container::-webkit-scrollbar-track {
  background: var(--el-fill-color-dark);
}

:global(.dark) .raw-data-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
}

/* Animacje */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.storage-smart-widget {
  animation: fadeIn 0.2s ease-out;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.refresh-btn.is-loading {
  animation: spin 1s linear infinite;
}

/* Responsywność */
@media (max-width: 1400px) {
  .devices-table {
    font-size: 12px;
  }
  
  .devices-table :deep(.el-table__header th) {
    font-size: 11px;
    padding: 10px 6px !important;
  }
  
  .devices-table :deep(.el-table__body td) {
    padding: 6px 6px !important;
  }
  
  .widget-title {
    font-size: 15px;
  }
  
  .device-name,
  .model-text,
  .vendor-name,
  .capacity-value,
  .temp-value {
    font-size: 12px;
  }
  
  .serial-text {
    font-size: 11px;
  }
  
  .status-tag {
    font-size: 11px;
    padding: 3px 8px;
  }
}

@media (max-width: 1200px) {
  .widget-header {
    padding: 12px 14px;
  }
  
  .table-container {
    padding: 0 14px 14px;
  }
  
  .availability-alert,
  .error-container {
    margin: 14px;
  }
}

/* Scrollbar styling */
.raw-data-container::-webkit-scrollbar {
  width: 6px;
}

.raw-data-container::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 3px;
}

.raw-data-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}
</style>
