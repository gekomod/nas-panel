<template>
  <el-card class="storage-disks-widget dark-mode">
    <template #header>
      <div class="widget-header">
        <div class="header-title">
          <Icon icon="mdi:harddisk" width="22" height="22" class="header-icon" />
          <span class="header-text">{{ t('storageDisks.title') }}</span>
        </div>
        <div class="header-actions">
          <el-tooltip :content="t('storageDisks.refresh')" placement="top">
            <el-button 
              size="small" 
              @click="refreshDisks" 
              :loading="loading"
              :disabled="scanning"
              circle
              class="action-btn"
            >
              <Icon 
                icon="mdi:refresh" 
                width="16" 
                height="16" 
                :class="{ 'spin': loading }" 
              />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="t('storageDisks.scanNew')" placement="top">
            <el-button 
              size="small" 
              @click="scanNewDevices" 
              :loading="scanning"
              :disabled="loading"
              circle
              class="action-btn"
            >
              <Icon 
                icon="mdi:magnify-scan" 
                width="16" 
                height="16" 
                :class="{ 'spin': scanning }" 
              />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="widget-content">
      <el-table 
        :data="disks" 
        style="width: 100%" 
        v-loading="loading"
        :empty-text="t('storageDisks.noDisks')"
        class="disks-table"
        :class="{ 'dark': isDarkMode }"
      >
        <el-table-column 
          :label="t('storageDisks.device')" 
          prop="device" 
          width="130"
          sortable
        >
          <template #default="{ row }">
            <div class="device-cell">
              <div class="icon-wrapper">
                <Icon :icon="getDeviceIcon(row.device)" width="20" height="20" />
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
              <span class="truncate-text">{{ row.model }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('storageDisks.serial')" 
          prop="serial" 
          min-width="160"
        >
          <template #default="{ row }">
            <div class="serial-cell">
              <span class="serial-text">{{ row.serial }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('storageDisks.vendor')" 
          prop="vendor" 
          min-width="150"
          sortable
        >
          <template #default="{ row }">
            <div class="vendor-cell">
              <div class="icon-wrapper" v-if="getVendorIcon(row.vendor)">
                <Icon :icon="getVendorIcon(row.vendor)" width="20" height="20" />
              </div>
              <span class="vendor-name">{{ row.vendor }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column 
          :label="t('storageDisks.capacity')" 
          prop="size" 
          width="140"
          sortable
        >
          <template #default="{ row }">
            <div class="capacity-cell">
              <div class="icon-wrapper">
                <Icon icon="mdi:database" width="18" height="18" />
              </div>
              <span class="capacity-value">{{ formatBytes(row.size) }}</span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="error" class="error-message">
        <Icon icon="mdi:alert-circle-outline" width="20" height="20" />
        <span class="error-text">{{ error }}</span>
        <el-button 
          size="small" 
          @click="retryFetch" 
          class="retry-btn"
        >
          {{ t('storageDisks.retry') }}
        </el-button>
      </div>

      <div v-if="disks.length > 0" class="summary">
        <div class="summary-item">
          <Icon icon="mdi:harddisk" width="16" height="16" />
          <span>{{ disks.length }} {{ t('storageDisks.disksCount') }}</span>
        </div>
        <div class="summary-item">
          <Icon icon="mdi:database" width="16" height="16" />
          <span>{{ formatBytes(totalCapacity) }} {{ t('storageDisks.total') }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'StorageDisksWidget',
  displayName: 'Dyski magazynujące'
}
</script>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElNotification } from 'element-plus'

const { t } = useI18n()

const disks = ref([])
const loading = ref(false)
const scanning = ref(false)
const error = ref(null)

// Obsługa trybu ciemnego (przykład - w rzeczywistym projekcie można użyć vueuse, pinia itp.)
const isDarkMode = ref(false)

// Ustawienie baseURL dla axios
if (import.meta.env.VITE_API_PORT) {
  axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}`
} else {
  axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}`
}

// Komputowane wartości
const totalCapacity = computed(() => {
  return disks.value.reduce((sum, disk) => sum + (disk.size || 0), 0)
})

const getDeviceIcon = (device) => {
  if (!device) return 'mdi:help-circle-outline'
  if (device.startsWith('nvme')) return 'mdi:memory'
  if (device.startsWith('sd')) return 'mdi:harddisk'
  if (device.startsWith('hd')) return 'mdi:harddisk'
  if (device.includes('ssd')) return 'mdi:memory'
  return 'mdi:harddisk'
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
  
  // Wyszukiwanie z częściową zgodnością
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
  
  // Dla TB i większych używamy mniej miejsc dziesiętnych
  const dec = i >= 4 ? Math.max(0, decimals - 1) : decimals
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dec)) + ' ' + sizes[i]
}

// Funkcja do pobierania dysków
const fetchDisks = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await axios.get('/api/storage/disks', {
      timeout: 10000 // 10 sekund timeout
    })
    
    if (response.data?.data && Array.isArray(response.data.data)) {
      disks.value = response.data.data.map(disk => ({
        device: disk.device || 'N/A',
        model: disk.model || 'N/A',
        serial: disk.serial || 'N/A',
        vendor: disk.vendor || 'N/A',
        size: parseInt(disk.size) || 0
      }))
    } else if (Array.isArray(response.data)) {
      // Obsługa przypadku gdy dane są bezpośrednio tablicą
      disks.value = response.data.map(disk => ({
        device: disk.device || 'N/A',
        model: disk.model || 'N/A',
        serial: disk.serial || 'N/A',
        vendor: disk.vendor || 'N/A',
        size: parseInt(disk.size) || 0
      }))
    } else {
      throw new Error('Invalid data format')
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('storageDisks.errorLoading')
    console.error('Error fetching disks:', err)
  } finally {
    loading.value = false
  }
}

// Funkcja ponawiania
const retryFetch = () => {
  error.value = null
  fetchDisks()
}

// Funkcja odświeżająca
const refreshDisks = async () => {
  await fetchDisks()
}

// Funkcja skanująca nowe urządzenia
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

onMounted(() => {
  // Sprawdzenie trybu ciemnego
  isDarkMode.value = document.documentElement.classList.contains('dark')
  
  // Obserwowanie zmian trybu
  const observer = new MutationObserver(() => {
    isDarkMode.value = document.documentElement.classList.contains('dark')
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  
  fetchDisks()
})
</script>

<style scoped>
.storage-disks-widget {
  height: 100%;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  border: 1px solid var(--el-border-color-light);
}

.storage-disks-widget:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  color: var(--el-color-primary);
}

.header-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  transition: all 0.2s ease;
  border: none;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.action-btn:hover {
  background: var(--el-color-primary-light-7);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.widget-content {
  margin-top: 8px;
}

.disks-table {
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-border: 1px solid var(--el-table-border-color);
}

.disks-table :deep(.el-table__header-wrapper) th {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-size: 13px;
}

.disks-table :deep(.el-table__row) {
  transition: background-color 0.2s ease;
}

.disks-table :deep(.el-table__row:hover) {
  background-color: var(--el-color-primary-light-9);
}

.device-cell,
.vendor-cell,
.capacity-cell,
.model-cell,
.serial-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.device-name,
.vendor-name,
.capacity-value {
  font-weight: 500;
  font-size: 14px;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.serial-text {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.error-message {
  margin-top: 16px;
  padding: 16px;
  border-radius: 10px;
  background: var(--el-color-error-light-9);
  border: 1px solid var(--el-color-error-light-5);
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--el-color-error);
}

.error-text {
  flex: 1;
  font-size: 14px;
}

.retry-btn {
  margin-left: auto;
  background: var(--el-color-error);
  color: white;
  border: none;
}

.retry-btn:hover {
  background: var(--el-color-error-dark-2);
}

.summary {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

/* Tryb ciemny */
:global(.dark) .storage-disks-widget {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color-dark);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:global(.dark) .storage-disks-widget:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

:global(.dark) .icon-wrapper {
  background: var(--el-color-primary-dark-9);
  color: var(--el-color-primary-light-3);
}

:global(.dark) .action-btn {
  background: var(--el-color-primary-dark-9);
  color: var(--el-color-primary-light-3);
}

:global(.dark) .action-btn:hover {
  background: var(--el-color-primary-dark-7);
}

:global(.dark) .disks-table :deep(.el-table__header-wrapper) th {
  background-color: var(--el-color-primary-dark-9);
  color: var(--el-text-color-primary);
}

:global(.dark) .disks-table :deep(.el-table__row:hover) {
  background-color: var(--el-color-primary-dark-9);
}

:global(.dark) .serial-text {
  background: var(--el-fill-color-dark);
  border-color: var(--el-border-color-dark);
}

:global(.dark) .summary {
  border-top-color: var(--el-border-color-dark);
}
</style>
