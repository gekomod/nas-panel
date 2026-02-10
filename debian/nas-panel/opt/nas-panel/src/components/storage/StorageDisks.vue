<template>
  <div class="storage-disks-dashboard">
    <!-- Header -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:harddisk" />
          </div>
          <div class="header-text">
            <h2>{{ t('storageDisks.title') }}</h2>
            <p class="subtitle">{{ t('storageDisks.subtitle') }}</p>
          </div>
        </div>
        
        <div class="header-stats">
          <div class="stat-item">
            <div class="stat-icon">
              <Icon icon="mdi:harddisk" width="16" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ disks.length }}</div>
              <div class="stat-label">{{ t('storageDisks.disksCount') }}</div>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">
              <Icon icon="mdi:database" width="16" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatBytes(totalCapacity) }}</div>
              <div class="stat-label">{{ t('storageDisks.totalCapacity') }}</div>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">
              <Icon icon="mdi:update" width="16" />
            </div>
            <div class="stat-info">
              <div class="stat-label">{{ t('storageDisks.lastUpdated') }}</div>
              <div class="stat-value">{{ lastUpdatedTime }}</div>
            </div>
          </div>
        </div>
        
        <div class="header-actions">
          <el-button-group>
            <el-tooltip :content="t('storageDisks.refresh')" placement="top">
              <el-button 
                @click="refreshDisks" 
                :loading="loading"
                :disabled="scanning"
                size="small"
                circle
              >
                <Icon 
                  icon="mdi:refresh" 
                  width="14" 
                  :class="{ 'spin': loading }" 
                />
              </el-button>
            </el-tooltip>
            <el-tooltip :content="t('storageDisks.scanNew')" placement="top">
              <el-button 
                @click="scanNewDevices" 
                :loading="scanning"
                :disabled="loading"
                size="small"
                circle
              >
                <Icon 
                  icon="mdi:magnify-scan" 
                  width="14" 
                  :class="{ 'spin': scanning }" 
                />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Disks Table Card -->
    <el-card class="disks-list-card" shadow="hover">
      <!-- Search -->
      <div class="list-header">
        <el-input
          v-model="searchQuery"
          :placeholder="t('storageDisks.searchPlaceholder')"
          clearable
          size="small"
          class="search-input"
          @clear="searchQuery = ''"
        >
          <template #prefix>
            <Icon icon="mdi:magnify" width="14" />
          </template>
        </el-input>
        
        <div class="list-actions">
          <el-button 
            size="small" 
            @click="exportDisksData"
            :disabled="disks.length === 0"
            class="export-btn"
          >
            <Icon icon="mdi:export" width="14" />
            {{ t('storageDisks.export') }}
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
      <div v-if="loading && disks.length === 0" class="loading-state">
        <el-icon :size="20" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
        <span>{{ t('storageDisks.loading') }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="disks.length === 0 && !loading" class="empty-state">
        <Icon icon="mdi:harddisk-remove" width="48" />
        <div class="empty-text">
          <h4>{{ t('storageDisks.noDisksFound') }}</h4>
          <p>{{ t('storageDisks.noDisksDescription') }}</p>
          <el-button 
            type="primary" 
            size="small" 
            @click="scanNewDevices"
            :loading="scanning"
          >
            {{ t('storageDisks.scanForDisks') }}
          </el-button>
        </div>
      </div>

      <!-- Disks Table -->
      <div v-else class="disks-table-container">
        <el-table 
          :data="filteredDisks"
          style="width: 100%"
          v-loading="loading"
          :empty-text="t('storageDisks.noDisks')"
          :class="{ 'dark-table': isDarkMode }"
          class="compact-table"
          @sort-change="handleSortChange"
        >
          <el-table-column 
            :label="t('storageDisks.device')" 
            prop="device" 
            width="120"
            sortable
          >
            <template #default="{ row }">
              <div class="device-cell">
                <div class="icon-wrapper" :class="getDeviceType(row.device)">
                  <Icon :icon="getDeviceIcon(row.device)" width="16" />
                </div>
                <span class="device-name">{{ row.device }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            :label="t('storageDisks.model')" 
            prop="model" 
            min-width="180"
            sortable
          >
            <template #default="{ row }">
              <div class="model-cell">
                <span class="truncate-text" :title="row.model">{{ row.model }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            :label="t('storageDisks.vendor')" 
            prop="vendor" 
            width="150"
            sortable
          >
            <template #default="{ row }">
              <div class="vendor-cell">
                <div class="vendor-icon" v-if="getVendorIcon(row.vendor)">
                  <Icon :icon="getVendorIcon(row.vendor)" width="16" />
                </div>
                <span class="vendor-name">{{ row.vendor }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            :label="t('storageDisks.capacity')" 
            prop="size" 
            width="120"
            sortable
          >
            <template #default="{ row }">
              <div class="capacity-cell">
                <el-tag 
                  size="small" 
                  :type="getCapacityType(row.size)"
                  effect="plain"
                  class="capacity-tag"
                >
                  {{ formatBytes(row.size) }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            :label="t('storageDisks.serial')" 
            prop="serial" 
            width="180"
          >
            <template #default="{ row }">
              <div class="serial-cell">
                <el-tooltip :content="row.serial" placement="top">
                  <span class="serial-text">{{ truncateSerial(row.serial) }}</span>
                </el-tooltip>
                <el-button 
                  size="small" 
                  text 
                  @click="copyToClipboard(row.serial)"
                  class="copy-btn"
                >
                  <Icon icon="mdi:content-copy" width="12" />
                </el-button>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            :label="t('storageDisks.actions')" 
            width="100"
            align="right"
          >
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button 
                  size="small" 
                  text 
                  @click="showDiskDetails(row)"
                  class="action-btn"
                >
                  <Icon icon="mdi:information-outline" width="14" />
                </el-button>
                <el-button 
                  size="small" 
                  text 
                  @click="testDisk(row)"
                  class="action-btn"
                  :disabled="loading"
                >
                  <Icon icon="mdi:speedometer" width="14" />
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- Summary -->
        <div v-if="disks.length > 0" class="table-summary">
          <div class="summary-info">
            <span>{{ t('storageDisks.showing') }} {{ filteredDisks.length }}/{{ disks.length }} {{ t('storageDisks.disks') }}</span>
            <span class="summary-total">
              {{ t('storageDisks.total') }}: {{ formatBytes(totalCapacity) }}
            </span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElNotification, ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const { isDarkMode } = useTheme()

// Refs
const disks = ref([])
const loading = ref(false)
const scanning = ref(false)
const error = ref(null)
const searchQuery = ref('')
const lastUpdated = ref(null)
const sortConfig = ref({ prop: null, order: null })

// Ustawienie baseURL dla axios
if (import.meta.env.VITE_API_PORT) {
  axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}`
} else {
  axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}`
}

// Computed
const totalCapacity = computed(() => {
  return disks.value.reduce((sum, disk) => sum + (disk.size || 0), 0)
})

const lastUpdatedTime = computed(() => {
  if (!lastUpdated.value) return t('storageDisks.never')
  const date = new Date(lastUpdated.value)
  const now = new Date()
  const diffInMinutes = Math.floor((now - date) / (1000 * 60))
  
  if (diffInMinutes < 1) return t('storageDisks.justNow')
  if (diffInMinutes < 60) return t('storageDisks.minutesAgo', { minutes: diffInMinutes })
  if (diffInMinutes < 1440) return t('storageDisks.hoursAgo', { hours: Math.floor(diffInMinutes / 60) })
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const filteredDisks = computed(() => {
  let result = [...disks.value]
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(disk => 
      disk.device?.toLowerCase().includes(query) ||
      disk.model?.toLowerCase().includes(query) ||
      disk.vendor?.toLowerCase().includes(query) ||
      disk.serial?.toLowerCase().includes(query)
    )
  }
  
  // Sort
  if (sortConfig.value.prop) {
    result.sort((a, b) => {
      let aVal = a[sortConfig.value.prop]
      let bVal = b[sortConfig.value.prop]
      
      // Convert to numbers for size comparison
      if (sortConfig.value.prop === 'size') {
        aVal = Number(aVal) || 0
        bVal = Number(bVal) || 0
      }
      
      if (aVal < bVal) return sortConfig.value.order === 'ascending' ? -1 : 1
      if (aVal > bVal) return sortConfig.value.order === 'ascending' ? 1 : -1
      return 0
    })
  }
  
  return result
})

// Methods
const getDeviceIcon = (device) => {
  if (!device) return 'mdi:help-circle-outline'
  if (device.startsWith('nvme')) return 'mdi:memory'
  if (device.startsWith('sd')) return 'mdi:harddisk'
  if (device.startsWith('hd')) return 'mdi:harddisk'
  if (device.includes('ssd')) return 'mdi:memory'
  return 'mdi:harddisk'
}

const getDeviceType = (device) => {
  if (device.startsWith('nvme') || device.includes('ssd')) return 'ssd'
  return 'hdd'
}

const getVendorIcon = (vendor) => {
  if (!vendor) return null
  
  const vendors = {
    'Samsung': 'simple-icons:samsung',
    'Western Digital': 'simple-icons:westerndigital',
    'Seagate': 'simple-icons:seagate',
    'Toshiba': 'simple-icons:toshiba',
    'Intel': 'simple-icons:intel',
    'Kingston': 'simple-icons:kingston',
    'Crucial': 'simple-icons:crucial',
    'SanDisk': 'simple-icons:sandisk',
    'Micron': 'simple-icons:micron',
    'ADATA': 'simple-icons:adata'
  }
  
  for (const key in vendors) {
    if (vendor.toLowerCase().includes(key.toLowerCase())) {
      return vendors[key]
    }
  }
  
  return null
}

const formatBytes = (bytes, decimals = 1) => {
  if (bytes === 0 || bytes === undefined) return '0 B'
  if (typeof bytes !== 'number') return 'Invalid'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  const dec = i >= 4 ? Math.max(0, decimals - 1) : decimals
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dec)) + ' ' + sizes[i]
}

const getCapacityType = (size) => {
  if (!size) return 'info'
  const gb = size / (1024 * 1024 * 1024)
  if (gb < 128) return 'info'
  if (gb < 512) return 'success'
  if (gb < 1024) return 'warning'
  return 'danger'
}

const truncateSerial = (serial) => {
  if (!serial || serial.length <= 12) return serial
  return serial.substring(0, 6) + '...' + serial.substring(serial.length - 6)
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(t('storageDisks.copiedToClipboard'))
  }).catch(() => {
    ElMessage.error(t('storageDisks.copyFailed'))
  })
}

const fetchDisks = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await axios.get('/api/storage/disks', {
      timeout: 10000
    })
    
    let diskData = []
    if (response.data?.data && Array.isArray(response.data.data)) {
      diskData = response.data.data
    } else if (Array.isArray(response.data)) {
      diskData = response.data
    } else {
      throw new Error('Invalid data format')
    }
    
    disks.value = diskData.map(disk => ({
      device: disk.device || 'N/A',
      model: disk.model || 'N/A',
      serial: disk.serial || 'N/A',
      vendor: disk.vendor || 'N/A',
      size: parseInt(disk.size) || 0
    }))
    
    lastUpdated.value = new Date().toISOString()
  } catch (err) {
    error.value = err.response?.data?.message || t('storageDisks.errorLoading')
    console.error('Error fetching disks:', err)
  } finally {
    loading.value = false
  }
}

const refreshDisks = async () => {
  await fetchDisks()
  ElNotification.success({
    title: t('storageDisks.refreshed'),
    message: t('storageDisks.refreshComplete'),
    position: 'bottom-right',
    duration: 3000
  })
}

const scanNewDevices = async () => {
  try {
    scanning.value = true
    await axios.post('/api/storage/rescan', {}, {
      timeout: 15000
    })
    await fetchDisks()
    
    ElNotification.success({
      title: t('storageDisks.scanSuccess'),
      message: t('storageDisks.scanComplete'),
      position: 'bottom-right',
      duration: 3000
    })
  } catch (err) {
    ElNotification.error({
      title: t('storageDisks.scanError'),
      message: err.response?.data?.message || err.message,
      position: 'bottom-right',
      duration: 5000
    })
  } finally {
    scanning.value = false
  }
}

const showDiskDetails = (disk) => {
  ElNotification.info({
    title: t('storageDisks.diskDetails'),
    message: `
      <div style="line-height: 1.6; font-size: 13px;">
        <strong>${t('storageDisks.device')}:</strong> ${disk.device}<br>
        <strong>${t('storageDisks.model')}:</strong> ${disk.model}<br>
        <strong>${t('storageDisks.vendor')}:</strong> ${disk.vendor}<br>
        <strong>${t('storageDisks.serial')}:</strong> ${disk.serial}<br>
        <strong>${t('storageDisks.capacity')}:</strong> ${formatBytes(disk.size)}
      </div>
    `,
    position: 'bottom-right',
    duration: 5000,
    dangerouslyUseHTMLString: true
  })
}

const testDisk = (disk) => {
  ElNotification.warning({
    title: t('storageDisks.featureNotAvailable'),
    message: t('storageDisks.diskTestComingSoon'),
    position: 'bottom-right',
    duration: 4000
  })
}

const exportDisksData = () => {
  const data = JSON.stringify(disks.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `disks-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success(t('storageDisks.exportSuccess'))
}

const handleSortChange = ({ prop, order }) => {
  sortConfig.value = {
    prop,
    order: order === 'ascending' ? 'ascending' : 'descending'
  }
}

// Lifecycle
onMounted(() => {
  fetchDisks()
})

// Auto-refresh every 30 seconds
let refreshInterval
onMounted(() => {
  refreshInterval = setInterval(fetchDisks, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.storage-disks-dashboard {
  padding: 16px;
  min-height: 100vh;
  background: #f5f7fa;
}

:root[data-theme="dark"] .storage-disks-dashboard {
  background: #1a202c;
}

/* Header */
.dashboard-header {
  border-radius: 12px;
  margin-bottom: 16px;
}

.dashboard-header .header-content {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.header-icon {
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

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.stat-item .stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
  color: #409eff;
}

:root[data-theme="dark"] .stat-item .stat-icon {
  background: #2d3748;
}

.stat-item .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[data-theme="dark"] .stat-item .stat-value {
  color: #e4e7ed;
}

.stat-item .stat-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

:root[data-theme="dark"] .stat-item .stat-label {
  color: #a0aec0;
}

.stat-item:last-child .stat-value {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
}

:root[data-theme="dark"] .stat-item:last-child .stat-value {
  color: #a0aec0;
}

.stat-item:last-child .stat-label {
  margin-bottom: 2px;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Disks List Card */
.disks-list-card {
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

.search-input {
  width: 250px;
}

.list-actions {
  display: flex;
  gap: 8px;
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
.empty-state {
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

/* Disks Table */
.disks-table-container {
  padding: 0 16px 16px;
}

.compact-table {
  --el-table-border-color: transparent;
  --el-table-border: none;
}

.compact-table :deep(.el-table__header-wrapper) th {
  background-color: transparent;
  color: #606266;
  font-weight: 600;
  font-size: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

:root[data-theme="dark"] .compact-table :deep(.el-table__header-wrapper) th {
  color: #a0aec0;
  border-bottom-color: #4a5568;
}

.compact-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.compact-table :deep(.el-table__row:hover) {
  background-color: #fafafa;
}

:root[data-theme="dark"] .compact-table :deep(.el-table__row:hover) {
  background-color: #2d3748;
}

.compact-table :deep(.el-table__cell) {
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}

:root[data-theme="dark"] .compact-table :deep(.el-table__cell) {
  border-bottom-color: #2d3748;
}

/* Cell Styles */
.device-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-wrapper {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
}

.icon-wrapper.ssd {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
  color: white;
}

.icon-wrapper.hdd {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  color: white;
}

.device-name {
  font-size: 12px;
  font-weight: 500;
  color: #303133;
}

:root[data-theme="dark"] .device-name {
  color: #e4e7ed;
}

.model-cell, .vendor-cell, .capacity-cell, .serial-cell {
  font-size: 12px;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vendor-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #909399;
  flex-shrink: 0;
}

.vendor-name {
  color: #606266;
}

:root[data-theme="dark"] .vendor-name {
  color: #a0aec0;
}

.capacity-tag {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  padding: 1px 6px;
}

.serial-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.serial-text {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  color: #909399;
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

:root[data-theme="dark"] .serial-text {
  background: #2d3748;
  border-color: #4a5568;
  color: #a0aec0;
}

.copy-btn {
  padding: 2px;
  min-width: auto;
}

.action-buttons {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
}

.action-btn {
  padding: 4px;
  min-width: auto;
}

/* Table Summary */
.table-summary {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
  color: #909399;
}

:root[data-theme="dark"] .table-summary {
  border-top-color: #4a5568;
  color: #a0aec0;
}

.summary-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-total {
  font-weight: 500;
  color: #303133;
}

:root[data-theme="dark"] .summary-total {
  color: #e4e7ed;
}

/* Animations */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard-header .header-content {
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
  
  .stat-item {
    flex-direction: column;
    text-align: center;
    gap: 4px;
  }
  
  .stat-item .stat-icon {
    width: 28px;
    height: 28px;
  }
  
  .header-actions {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .storage-disks-dashboard {
    padding: 12px;
  }
  
  .header-stats {
    flex-wrap: wrap;
  }
  
  .stat-item {
    flex: 0 0 calc(50% - 8px);
    margin-bottom: 8px;
  }
  
  .stat-item:last-child {
    flex: 0 0 100%;
    margin-bottom: 0;
  }
  
  .search-input {
    width: 100%;
  }
  
  .list-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .list-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .compact-table :deep(.el-table__body-wrapper) {
    overflow-x: auto;
  }
  
  .serial-cell {
    flex-wrap: wrap;
  }
}
</style>
