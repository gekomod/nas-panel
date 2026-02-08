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
                <div v-if="hasPhysicalShocks(row)" class="shock-indicator">
                  <Icon icon="ph:warning" width="10" />
                </div>
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
                  v-if="needsRepair(row)"
                  effect="dark" 
                  placement="top"
                  :content="getRepairTooltip(row)"
                >
                  <div class="repair-needed-indicator">
                    <Icon icon="ph:wrench" width="12" />
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

        <el-table-column :label="t('storageSmart.repair')" width="160" align="center">
          <template #default="{ row }">
            <div class="repair-buttons">
              <el-dropdown 
                size="small" 
                @command="handleRepairCommand($event, row)"
                v-if="row.available && needsRepair(row)"
              >
                <el-button size="small" type="warning" plain>
                  <Icon icon="ph:wrench" width="12" />
                  <span class="button-text">{{ t('storageSmart.repair') }}</span>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="bad-sectors" :disabled="row.badSectors === 0">
                      <Icon icon="ph:warning-circle" />
                      {{ t('storageSmart.repairBadSectors') }} ({{ row.badSectors }})
                    </el-dropdown-item>
                    <el-dropdown-item command="physical-issues" :disabled="!hasPhysicalShocks(row)">
                      <Icon icon="ph:activity" />
                      {{ t('storageSmart.fixPhysicalIssues') }} {{ hasPhysicalShocks(row) ? '🚨' : '' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="extended-test">
                      <Icon icon="ph:hourglass" />
                      {{ t('storageSmart.runExtendedTest') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="load-cycle">
                      <Icon icon="ph:cycle" />
                      {{ t('storageSmart.fixLoadCycle') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="refresh-attrs">
                      <Icon icon="ph:arrows-clockwise" />
                      {{ t('storageSmart.refreshAttributes') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="auto-offline" divided>
                      <Icon icon="ph:robot" />
                      {{ t('storageSmart.enableAutoRepair') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="secure-erase" :disabled="!row.isSSD">
                      <Icon icon="ph:shield-check" />
                      {{ t('storageSmart.ataSecureErase') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="check-status">
                      <Icon icon="ph:chart-line" />
                      {{ t('storageSmart.checkRepairStatus') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="sector-details">
                      <Icon icon="ph:info" />
                      {{ t('storageSmart.sectorDetailsBtn') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip 
                v-else 
                :content="getRepairTooltip(row)" 
                placement="top"
              >
                <el-button 
                  size="small" 
                  type="info" 
                  plain 
                  :disabled="!row.available || row.badSectors === 0"
                  @click="showSectorDetails(row)"
                >
                  <template v-if="row.badSectors > 0">
                    <Icon icon="ph:warning-circle" width="12" />
                    <span class="button-text">{{ row.badSectors }}</span>
                  </template>
                  <template v-else-if="hasPhysicalShocks(row)">
                    <Icon icon="ph:activity" width="12" />
                    <span class="button-text">!</span>
                  </template>
                  <template v-else>
                    <Icon icon="ph:check-circle" width="12" />
                    <span class="button-text">OK</span>
                  </template>
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('storageSmart.actions')" width="80" align="center">
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

    <el-dialog 
      v-model="sectorDialog" 
      :title="t('storageSmart.sectorDetails')" 
      width="60%"
      class="sector-details-dialog"
    >
      <div v-if="currentSectorDetails" class="sector-details-container">
        <div class="sector-summary">
          <h4>{{ t('storageSmart.totalBadSectors') }}: {{ currentSectorDetails.total }}</h4>
          <div v-if="currentSectorDetails.gsense > 1000" class="shock-warning">
            <Icon icon="ph:warning" width="16" />
            <span>{{ t('storageSmart.shockDetected') }}: {{ currentSectorDetails.gsense }}</span>
          </div>
        </div>
        
        <el-table :data="sectorDetailsTable" style="width: 100%" size="small">
          <el-table-column prop="type" :label="t('storageSmart.sectorType')" />
          <el-table-column prop="count" :label="t('storageSmart.count')" align="right" />
          <el-table-column prop="description" :label="t('storageSmart.description')" />
        </el-table>
        
        <div class="sector-actions mt-4">
          <el-button type="warning" @click="repairBadSectors(currentDevice)">
            {{ t('storageSmart.startRepair') }}
          </el-button>
          <el-button @click="runExtendedTest(currentDevice)">
            {{ t('storageSmart.runExtendedTest') }}
          </el-button>
          <el-button v-if="currentSectorDetails.gsense > 1000" type="danger" @click="fixPhysicalIssues(currentDevice)">
            {{ t('storageSmart.fixPhysicalIssues') }}
          </el-button>
          <el-button @click="checkRepairStatus(currentDevice)">
            {{ t('storageSmart.checkStatus') }}
          </el-button>
        </div>
        
        <div class="sector-info mt-4">
          <el-alert type="info" :closable="false">
            <template #title>
              {{ t('storageSmart.sectorInfoTitle') }}
            </template>
            <div class="info-content">
              <p>{{ t('storageSmart.sectorInfo1') }}</p>
              <p>{{ t('storageSmart.sectorInfo2') }}</p>
              <p>{{ t('storageSmart.sectorInfo3') }}</p>
              <p v-if="currentSectorDetails.gsense > 1000" class="shock-info">
                <strong>{{ t('storageSmart.shockWarning') }}</strong><br>
                {{ t('storageSmart.shockAdvice') }}
              </p>
            </div>
          </el-alert>
        </div>
      </div>
    </el-dialog>

    <el-dialog 
      v-model="testProgressDialog" 
      :title="t('storageSmart.testProgress')"
      width="50%"
      class="test-progress-dialog"
    >
      <div v-if="currentTestDevice" class="progress-container">
        <div class="progress-info">
          <p>{{ t('storageSmart.testingDevice') }}: <strong>{{ currentTestDevice.device }}</strong></p>
          <p v-if="testProgress > 0">{{ t('storageSmart.progress') }}: {{ testProgress }}%</p>
          <p v-else>{{ t('storageSmart.testStarting') }}</p>
        </div>
        
        <el-progress 
          v-if="testProgress > 0"
          :percentage="testProgress" 
          :status="testProgress === 100 ? 'success' : 'warning'"
          :stroke-width="12"
          :text-inside="true"
        />
        
        <div class="test-actions mt-4">
          <el-button @click="stopTestMonitoring">{{ t('common.stop') }}</el-button>
          <el-button type="primary" @click="checkTestProgressNow">{{ t('storageSmart.checkNow') }}</el-button>
        </div>
      </div>
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
import { ElNotification, ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Loading, Check, Close } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()

const devices = ref([])
const loading = ref(false)
const error = ref(null)
const smartNotAvailable = ref(false)
const rawDataDialog = ref(false)
const currentRawData = ref('')
const sectorDialog = ref(false)
const currentSectorDetails = ref(null)
const currentDevice = ref(null)
const testProgressDialog = ref(false)
const currentTestDevice = ref(null)
const testProgress = ref(0)
const testMonitorInterval = ref(null)
const router = useRouter()

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}`

const emptyText = computed(() => {
  if (smartNotAvailable.value) return t('storageSmart.smartNotAvailable')
  if (error.value) return t('storageSmart.errorLoading')
  return t('storageSmart.noDevices')
})

const sectorDetailsTable = computed(() => {
  if (!currentSectorDetails.value) return []
  
  const details = currentSectorDetails.value
  const t = useI18n().t
  
  const tableData = [
    {
      type: t('storageSmart.sectorTypes.reallocated'),
      count: details.reallocated,
      description: t('storageSmart.sectorDesc.reallocated')
    },
    {
      type: t('storageSmart.sectorTypes.pending'),
      count: details.pending,
      description: t('storageSmart.sectorDesc.pending')
    },
    {
      type: t('storageSmart.sectorTypes.offline'),
      count: details.offline,
      description: t('storageSmart.sectorDesc.offline')
    },
    {
      type: t('storageSmart.sectorTypes.reported'),
      count: details.reported,
      description: t('storageSmart.sectorDesc.reported')
    },
    {
      type: t('storageSmart.sectorTypes.timeout'),
      count: details.timeout,
      description: t('storageSmart.sectorDesc.timeout')
    }
  ]
  
  if (details.gsense > 0) {
    tableData.push({
      type: t('storageSmart.sectorTypes.gsense'),
      count: details.gsense,
      description: t('storageSmart.sectorDesc.gsense')
    })
  }
  
  return tableData
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
  if (hasPhysicalShocks(device)) return 'ph:activity'
  
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
  if (hasPhysicalShocks(device)) {
    return t('storageSmart.statusValues.shocks')
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
  if (hasPhysicalShocks(device)) {
    return 'danger'
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

const hasPhysicalShocks = (device) => {
  if (!device.rawData?.ata_smart_attributes?.table) return false
  
  const gsenseAttr = device.rawData.ata_smart_attributes.table.find(
    attr => attr.id === 191 || attr.name === 'G-Sense_Error_Rate'
  )
  
  if (gsenseAttr?.raw?.value) {
    const gsenseValue = parseInt(gsenseAttr.raw.value)
    return gsenseValue > 1000
  }
  
  return false
}

const getShockLevelText = (device) => {
  if (!device.rawData?.ata_smart_attributes?.table) return null
  
  const gsenseAttr = device.rawData.ata_smart_attributes.table.find(
    attr => attr.id === 191 || attr.name === 'G-Sense_Error_Rate'
  )
  
  if (!gsenseAttr?.raw?.value) return null
  
  const value = parseInt(gsenseAttr.raw.value)
  
  if (value < 100) return null
  if (value < 1000) return t('storageSmart.shockLevel.minor')
  if (value < 10000) return t('storageSmart.shockLevel.moderate')
  if (value < 100000) return t('storageSmart.shockLevel.severe')
  return t('storageSmart.shockLevel.critical')
}

const needsRepair = (device) => {
  return (
    device.badSectors > 0 ||
    (device.outOfSpecParams && device.outOfSpecParams.length > 0) ||
    device.status === 'warning' ||
    device.status === 'error' ||
    isTempCritical(device.temperature, device.isSSD) ||
    hasHighLoadCycleCount(device.rawData) ||
    hasEndToEndErrors(device.rawData) ||
    hasPhysicalShocks(device)
  )
}

const getSectorDetails = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return null
  
  const details = {
    reallocated: 0,
    pending: 0,
    offline: 0,
    reported: 0,
    timeout: 0,
    gsense: 0,
    total: 0
  }
  
  const attributeMap = [
    { id: 5, key: 'reallocated', name: 'Reallocated Sectors' },
    { id: 197, key: 'pending', name: 'Pending Sectors' },
    { id: 198, key: 'offline', name: 'Offline Uncorrectable' },
    { id: 187, key: 'reported', name: 'Reported Uncorrectable' },
    { id: 188, key: 'timeout', name: 'Command Timeout' },
    { id: 191, key: 'gsense', name: 'G-Sense Error Rate' }
  ]
  
  attributeMap.forEach(item => {
    const attr = smartData.ata_smart_attributes.table.find(a => a.id === item.id)
    if (attr?.raw?.value !== undefined) {
      details[item.key] = parseInt(attr.raw.value)
    }
  })
  
  details.total = details.reallocated + details.pending + details.offline + details.reported + details.timeout
  
  return details
}

const getRepairTooltip = (device) => {
  if (!device.available) {
    return t('storageSmart.deviceUnavailable')
  }
  
  const issues = []
  const sectorDetails = getSectorDetails(device.rawData)
  const shockLevel = getShockLevelText(device)
  
  if (shockLevel) {
    issues.push(`🚨 ${shockLevel}`)
  }
  
  if (sectorDetails) {
    if (sectorDetails.reallocated > 0) {
      issues.push(`${t('storageSmart.sectorTypes.reallocated')}: ${sectorDetails.reallocated}`)
    }
    if (sectorDetails.pending > 0) {
      issues.push(`${t('storageSmart.sectorTypes.pending')}: ${sectorDetails.pending}`)
    }
    if (sectorDetails.offline > 0) {
      issues.push(`${t('storageSmart.sectorTypes.offline')}: ${sectorDetails.offline}`)
    }
    if (sectorDetails.reported > 0) {
      issues.push(`${t('storageSmart.sectorTypes.reported')}: ${sectorDetails.reported}`)
    }
    if (sectorDetails.timeout > 0) {
      issues.push(`${t('storageSmart.sectorTypes.timeout')}: ${sectorDetails.timeout}`)
    }
    if (sectorDetails.gsense > 1000) {
      issues.push(`${t('storageSmart.sectorTypes.gsense')}: ${sectorDetails.gsense}`)
    }
  }
  
  if (device.outOfSpecParams && device.outOfSpecParams.length > 0) {
    issues.push(`${t('storageSmart.outOfSpecParams')}: ${device.outOfSpecParams.length}`)
  }
  
  if (device.status && device.status !== 'healthy') {
    issues.push(`${t('storageSmart.status')}: ${device.status}`)
  }
  
  if (hasHighLoadCycleCount(device.rawData)) {
    issues.push(t('storageSmart.highLoadCycle'))
  }
  
  if (hasEndToEndErrors(device.rawData)) {
    issues.push(t('storageSmart.endToEndErrors'))
  }
  
  if (isTempCritical(device.temperature, device.isSSD)) {
    issues.push(t('storageSmart.criticalTemperature'))
  }
  
  if (issues.length > 0) {
    return `${t('storageSmart.needsRepair')}:\n${issues.join('\n• ')}`
  }
  
  return t('storageSmart.deviceHealthy')
}

const hasHighLoadCycleCount = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return false
  
  const loadCycleAttr = smartData.ata_smart_attributes.table.find(
    attr => attr.id === 193 || attr.name === 'Load_Cycle_Count'
  )
  
  if (loadCycleAttr?.raw?.value) {
    return parseInt(loadCycleAttr.raw.value) > 300000
  }
  
  return false
}

const hasEndToEndErrors = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return false
  
  const e2eAttr = smartData.ata_smart_attributes.table.find(
    attr => attr.id === 184 || attr.name === 'End-to-End_Error'
  )
  
  return e2eAttr?.raw?.value > 0
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
  
  const attributeIds = {
    reallocated: 5,
    pending: 197,
    offline: 198,
    reported: 187,
    commandTimeout: 188
  }
  
  let total = 0
  for (const [key, id] of Object.entries(attributeIds)) {
    const attr = smartData.ata_smart_attributes.table.find(a => a.id === id)
    if (attr?.raw?.value !== undefined) {
      total += parseInt(attr.raw.value)
    }
  }
  
  return total
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

const handleRepairCommand = async (command, device) => {
  switch (command) {
    case 'bad-sectors':
      await repairBadSectors(device)
      break
    case 'extended-test':
      await runExtendedTest(device)
      break
    case 'load-cycle':
      await fixLoadCycleCount(device)
      break
    case 'refresh-attrs':
      await refreshAttributes(device)
      break
    case 'auto-offline':
      await enableAutoOffline(device)
      break
    case 'secure-erase':
      await secureErase(device)
      break
    case 'check-status':
      await checkRepairStatus(device)
      break
    case 'sector-details':
      await showSectorDetails(device)
      break
    case 'physical-issues':
      await fixPhysicalIssues(device)
      break
  }
}

const repairBadSectors = async (device) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/repair-bad-sectors', {
      device: device.device
    })
    
    if (response.data.testStarted) {
      ElNotification.success({
        title: t('storageSmart.repairStarted'),
        message: `Test SMART dla ${device.device} został uruchomiony`,
        duration: 3000
      })
      
      startTestMonitoring(device, response.data.testActive)
    } else {
      ElNotification.warning({
        title: t('storageSmart.repairWarning'),
        message: response.data.message || t('storageSmart.testMayNotStart'),
        duration: 5000
      })
    }
    
  } catch (error) {
    ElNotification.error({
      title: t('storageSmart.repairError'),
      message: error.response?.data?.error || t('storageSmart.failedToStartRepair'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const startTestMonitoring = (device, isActive) => {
  currentTestDevice.value = device
  testProgress.value = 0
  testProgressDialog.value = true
  
  if (isActive) {
    testMonitorInterval.value = setInterval(() => {
      checkTestProgress()
    }, 10000)
  }
}

const checkTestProgress = async () => {
  if (!currentTestDevice.value) return
  
  try {
    const response = await axios.get(`/api/storage/smart/test-status/${encodeURIComponent(currentTestDevice.value.device)}`)
    
    if (response.data.testActive) {
      testProgress.value = response.data.progress
    } else {
      stopTestMonitoring()
      ElNotification.success({
        title: t('storageSmart.testCompleted'),
        message: t('storageSmart.testFinishedSuccess'),
        duration: 5000
      })
      fetchDevices()
    }
  } catch (error) {
    console.error('Error checking test progress:', error)
  }
}

const checkTestProgressNow = () => {
  if (testMonitorInterval.value) {
    clearInterval(testMonitorInterval.value)
  }
  checkTestProgress()
  testMonitorInterval.value = setInterval(() => {
    checkTestProgress()
  }, 10000)
}

const stopTestMonitoring = () => {
  if (testMonitorInterval.value) {
    clearInterval(testMonitorInterval.value)
    testMonitorInterval.value = null
  }
  testProgressDialog.value = false
  currentTestDevice.value = null
}

const runExtendedTest = async (device) => {
  const confirmed = await ElMessageBox.confirm(
    `${t('storageSmart.extendedTestWarning1')} ${device.device} ${t('storageSmart.extendedTestWarning2')}<br>${t('storageSmart.continueQuestion')}`,
    t('storageSmart.runExtendedTest'),
    {
      confirmButtonText: t('common.run'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
      dangerouslyUseHTMLString: true
    }
  )
  
  if (!confirmed) return
  
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/run-extended-test', {
      device: device.device
    })
    
    ElNotification.success({
      title: t('storageSmart.testStarted'),
      message: response.data.message,
      duration: 5000
    })
    
    startTestMonitoring(device, true)
    
  } catch (error) {
    ElNotification.error({
      title: t('common.error'),
      message: error.response?.data?.error || t('storageSmart.failedToStartTest'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const fixLoadCycleCount = async (device) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/fix-load-cycle-count', {
      device: device.device
    })
    
    ElNotification.success({
      title: t('storageSmart.loadCycleRepair'),
      message: response.data.message,
      duration: 5000
    })
    
  } catch (error) {
    ElNotification.error({
      title: t('common.error'),
      message: error.response?.data?.error || t('storageSmart.failedToApplyFixes'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const refreshAttributes = async (device) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/refresh-attributes', {
      device: device.device
    })
    
    ElNotification.success({
      title: t('storageSmart.attributesRefreshed'),
      message: t('storageSmart.smartAttributesRefreshed'),
      duration: 3000
    })
    
    fetchDevices()
    
  } catch (error) {
    ElNotification.error({
      title: t('common.error'),
      message: error.response?.data?.error || t('storageSmart.failedToRefreshAttributes'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const enableAutoOffline = async (device) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/enable-automatic-offline', {
      device: device.device
    })
    
    ElNotification.success({
      title: t('storageSmart.autoRepairEnabled'),
      message: response.data.message,
      duration: 5000
    })
    
  } catch (error) {
    ElNotification.error({
      title: t('common.error'),
      message: error.response?.data?.error || t('storageSmart.failedToEnableAutoRepair'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const secureErase = async (device) => {
  const confirmed = await ElMessageBox.confirm(
    `${t('storageSmart.secureEraseWarning1')} ${device.device}!<br><br>
    <strong>${t('storageSmart.secureEraseWarning2')}</strong><br>
    ${t('storageSmart.continueQuestion')}`,
    t('storageSmart.ataSecureErase'),
    {
      confirmButtonText: t('storageSmart.yesEraseAll'),
      cancelButtonText: t('common.cancel'),
      type: 'error',
      dangerouslyUseHTMLString: true,
      confirmButtonClass: 'el-button--danger'
    }
  )
  
  if (!confirmed) return
  
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/ata-secure-erase', {
      device: device.device
    })
    
    ElNotification.success({
      title: t('storageSmart.secureEraseCompleted'),
      message: t('storageSmart.allDataSecurelyErased'),
      duration: 10000
    })
    
    fetchDevices()
    
  } catch (error) {
    ElNotification.error({
      title: t('storageSmart.secureEraseError'),
      message: error.response?.data?.error || t('storageSmart.operationFailed'),
      duration: 10000
    })
  } finally {
    loading.value = false
  }
}

const checkRepairStatus = async (device) => {
  try {
    loading.value = true
    const response = await axios.get(`/api/storage/smart/repair-status/${encodeURIComponent(device.device)}`)
    
    const statusText = response.data.testsInProgress 
      ? t('storageSmart.testsInProgress') 
      : t('storageSmart.noActiveTests')
    
    let message = `<pre>${t('storageSmart.repairStatus')}: ${statusText}\n\n${t('storageSmart.attributes')}:\n`
    message += `• ${t('storageSmart.sectorTypes.reallocated')}: ${response.data.attributes.badSectors}\n`
    message += `• ${t('storageSmart.sectorTypes.pending')}: ${response.data.attributes.pendingSectors}\n`
    message += `• ${t('storageSmart.sectorTypes.offline')}: ${response.data.attributes.offlineUncorrectable}\n`
    message += `• ${t('storageSmart.loadCycleCount')}: ${response.data.attributes.loadCycleCount}\n`
    message += `• ${t('storageSmart.endToEndError')}: ${response.data.attributes.endToEndError}\n`
    message += `• ${t('storageSmart.gSenseErrorRate')}: ${response.data.attributes.gSenseErrorRate}\n`
    message += `• ${t('storageSmart.temperature')}: ${response.data.attributes.temperature}°C\n</pre>`
    
    ElMessageBox.alert(
      message,
      t('storageSmart.repairStatus'),
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: 'OK',
        customClass: 'repair-status-dialog'
      }
    )
    
  } catch (error) {
    ElNotification.error({
      title: t('common.error'),
      message: error.response?.data?.error || t('storageSmart.failedToGetStatus'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
}

const showSectorDetails = async (device) => {
  try {
    loading.value = true
    currentDevice.value = device
    
    const response = await axios.get(`/api/storage/smart/sector-details/${encodeURIComponent(device.device)}`)
    
    if (response.data.success) {
      currentSectorDetails.value = response.data.sectorDetails
      sectorDialog.value = true
    }
  } catch (error) {
    currentSectorDetails.value = getSectorDetails(device.rawData)
    sectorDialog.value = true
  } finally {
    loading.value = false
  }
}

const fixPhysicalIssues = async (device) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/smart/fix-physical-issues', {
      device: device.device
    })
    
    ElMessageBox.alert(
      `<strong>${t('storageSmart.physicalIssuesDiagnosis')}:</strong><br><br>
      <strong>${t('storageSmart.gSenseErrorRate')}:</strong> ${response.data.gSenseErrorRate}<br>
      <strong>${t('storageSmart.shockLevel')}:</strong> ${response.data.shockLevel}<br><br>
      <strong>${t('storageSmart.recommendations')}:</strong><br>
      ${response.data.recommendations.join('<br>')}`,
      t('storageSmart.physicalShockProblem'),
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: t('common.understand'),
        customClass: 'shock-alert-dialog'
      }
    )
    
    startTestMonitoring(device, true)
    
  } catch (error) {
    ElNotification.error({
      title: t('storageSmart.diagnosisError'),
      message: error.response?.data?.error || t('storageSmart.failedToDiagnosePhysical'),
      duration: 5000
    })
  } finally {
    loading.value = false
  }
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
  white-space: nowrap !important;
  overflow: visible !important;
}

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
  position: relative;
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

.shock-indicator {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--el-color-danger);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  animation: shake 0.5s infinite alternate;
}

@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  50% { transform: translateX(1px); }
  75% { transform: translateX(-1px); }
  100% { transform: translateX(0); }
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

.repair-needed-indicator {
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
  animation: pulse 2s infinite;
}

.repair-needed-indicator:hover {
  background: var(--el-color-warning-light-6);
}

@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

.repair-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
}

.repair-buttons .el-button {
  display: flex;
  align-items: center;
  gap: 4px;
}

.button-text {
  margin-left: 4px;
  font-size: 12px;
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

.sector-details-dialog {
  border-radius: 8px;
}

.sector-details-container {
  max-height: 70vh;
  overflow-y: auto;
}

.sector-summary {
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-8);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
  text-align: center;
  position: relative;
}

.sector-summary h4 {
  margin: 0;
  color: var(--el-color-warning);
  font-size: 18px;
}

.shock-warning {
  margin-top: 10px;
  padding: 8px;
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
  color: var(--el-color-danger);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
}

.sector-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.sector-info {
  margin-top: 16px;
}

.info-content p {
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.4;
}

.shock-info {
  padding: 10px;
  background: var(--el-color-danger-light-8);
  border-radius: 4px;
  margin-top: 15px !important;
  border-left: 4px solid var(--el-color-danger);
}

.test-progress-dialog {
  border-radius: 8px;
}

.progress-container {
  padding: 20px;
}

.progress-info {
  margin-bottom: 20px;
  text-align: center;
}

.progress-info p {
  margin: 8px 0;
  font-size: 14px;
}

.test-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

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

:global(.dark) .shock-indicator {
  background: var(--el-color-danger);
  color: white;
  animation: shake-dark 0.5s infinite alternate;
}

@keyframes shake-dark {
  0% { transform: translateX(0); opacity: 0.8; }
  25% { transform: translateX(-1px); opacity: 0.9; }
  50% { transform: translateX(1px); opacity: 1; }
  75% { transform: translateX(-1px); opacity: 0.9; }
  100% { transform: translateX(0); opacity: 0.8; }
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

:global(.dark) .repair-needed-indicator {
  background: var(--el-color-warning-dark-8);
  color: var(--el-color-warning-light-3);
  animation: pulse-dark 2s infinite;
}

@keyframes pulse-dark {
  0% { opacity: 0.5; }
  50% { opacity: 0.8; }
  100% { opacity: 0.5; }
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

:global(.dark) .sector-summary {
  background: var(--el-color-warning-dark-9);
  border-color: var(--el-color-warning-dark-8);
}

:global(.dark) .sector-summary h4 {
  color: var(--el-color-warning-light-3);
}

:global(.dark) .shock-warning {
  background: var(--el-color-danger-dark-9);
  color: var(--el-color-danger-light-3);
}

:global(.dark) .shock-info {
  background: var(--el-color-danger-dark-8);
  border-left-color: var(--el-color-danger);
}

:global(.dark) .raw-data-container::-webkit-scrollbar-track {
  background: var(--el-fill-color-dark);
}

:global(.dark) .raw-data-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
}

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
  
  .repair-buttons .el-button {
    font-size: 11px;
  }
  
  .button-text {
    font-size: 11px;
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
  
  .repair-buttons {
    flex-direction: column;
    gap: 4px;
  }
}

@media (max-width: 768px) {
  .device-cell {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .device-info {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  
  .sector-details-dialog,
  .test-progress-dialog {
    width: 95% !important;
  }
}

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

.sector-details-container::-webkit-scrollbar {
  width: 6px;
}

.sector-details-container::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 3px;
}

.sector-details-container::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}
</style>
