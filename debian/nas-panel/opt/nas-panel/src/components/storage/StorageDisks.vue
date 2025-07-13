<template>
  <el-card class="storage-disks-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:harddisk" width="20" height="20" />
        <span>{{ t('storageDisks.title') }}</span>
        <div class="header-actions">
          <el-tooltip :content="t('storageDisks.refresh')">
            <el-button 
              size="small" 
              @click="refreshDisks" 
              :loading="loading"
              text
            >
              <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': loading }" />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="t('storageDisks.scanNew')">
            <el-button 
              size="small" 
              @click="scanNewDevices" 
              :loading="scanning"
              text
            >
              <Icon icon="mdi:magnify-scan" width="16" height="16" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <el-table :data="disks" style="width: 100%" v-loading="loading">
      <el-table-column :label="t('storageDisks.device')" prop="device" width="120">
        <template #default="{ row }">
          <div class="device-cell">
            <Icon :icon="getDeviceIcon(row.device)" width="18" height="18" />
            <span>{{ row.device }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('storageDisks.model')" prop="model" />
      <el-table-column :label="t('storageDisks.serial')" prop="serial" />
      <el-table-column :label="t('storageDisks.vendor')" prop="vendor">
        <template #default="{ row }">
          <div class="vendor-cell">
            <Icon :icon="getVendorIcon(row.vendor)" width="18" height="18" v-if="getVendorIcon(row.vendor)" />
            <span>{{ row.vendor }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('storageDisks.capacity')" prop="size" width="120">
        <template #default="{ row }">
          <div class="capacity-cell">
            <Icon icon="mdi:database" width="16" height="16" />
            <span>{{ formatBytes(row.size) }}</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="error" class="error-message">
      <Icon icon="mdi:alert-circle" width="18" height="18" />
      <span>{{ error }}</span>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElNotification } from 'element-plus'

const { t } = useI18n()

const disks = ref([])
const loading = ref(false)
const scanning = ref(false)
const error = ref(null)

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

const getDeviceIcon = (device) => {
  if (device.startsWith('nvme')) return 'mdi:memory'
  if (device.startsWith('sd')) return 'mdi:harddisk'
  return 'mdi:harddisk'
}

const getVendorIcon = (vendor) => {
  const vendors = {
    'Samsung': 'simple-icons:samsung',
    'Western Digital': 'simple-icons:westerndigital',
    'Seagate': 'simple-icons:seagate',
    'Toshiba': 'simple-icons:toshiba',
    'Intel': 'simple-icons:intel'
  }
  return vendors[vendor] || null
}

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

// Funkcja do pobierania dysków
const fetchDisks = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/storage/disks')
    
    if (Array.isArray(response.data?.data)) {
      disks.value = response.data.data.map(disk => ({
        device: disk.device || 'Unknown',
        model: disk.model || 'Unknown',
        serial: disk.serial || 'Unknown',
        vendor: disk.vendor || 'Unknown',
        size: disk.size || 0
      }))
    }
  } catch (err) {
    error.value = t('storageDisks.errorLoading')
    console.error('Error fetching disks:', err)
  } finally {
    loading.value = false
  }
}

// Funkcja odświeżająca
const refreshDisks = async () => {
  await fetchDisks()
}

// Funkcja skanująca nowe urządzenia
const scanNewDevices = async () => {
  try {
    scanning.value = true
    await axios.post('/api/storage/rescan') // Nowy endpoint w backendzie
    await fetchDisks()
    ElNotification.success({
      title: t('storageDisks.scanSuccess'),
      message: t('storageDisks.scanComplete')
    })
  } catch (err) {
    ElNotification.error({
      title: t('storageDisks.scanError'),
      message: err.message
    })
  } finally {
    scanning.value = false
  }
}

onMounted(fetchDisks)
</script>

<style scoped>
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.storage-disks-widget {
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-cell,
.vendor-cell,
.capacity-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-message {
  margin-top: 15px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
