<template>
  <el-card class="filesystems-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:file-system" width="20" height="20" />
        <span>{{ t('storageFilesystems.title') }}</span>
        <div class="header-actions">
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

    <el-table :data="filesystems" style="width: 100%" v-loading="loading">
      <el-table-column :label="t('storageFilesystems.device')" prop="device" width="120">
        <template #default="{ row }">
          <div class="device-cell">
            <Icon :icon="getDeviceIcon(row.device)" width="18" height="18" />
            <span>{{ row.device }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.tags')" prop="tags" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.tags" size="small">
            {{ row.tags }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.type')" prop="type" width="100">
        <template #default="{ row }">
          <Icon :icon="getFsIcon(row.type)" width="16" height="16" />
          <span>{{ row.type }}</span>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.available')" prop="available" width="120">
        <template #default="{ row }">
          <div class="size-cell">
            <Icon icon="mdi:harddisk-plus" width="16" height="16" />
            <span>{{ formatBytes(row.available) }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.used')" prop="used" width="400">
        <template #default="{ row }">
          <el-progress 
            :percentage="row.usedPercent" 
            :color="getUsageColor(row.usedPercent)"
            :show-text="false"
            :stroke-width="14"
          />
          <span>{{ formatBytes(row.used) }} ({{ row.usedPercent }}%)</span>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.mounted')" prop="mounted">
        <template #default="{ row }">
          <div class="mount-cell">
            <Icon icon="mdi:folder-marker" width="16" height="16" />
            <span>{{ row.mounted }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageFilesystems.reference')" prop="reference" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.reference" size="small" type="info">
            {{ row.reference }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('storageFilesystems.status')" prop="status" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            <Icon :icon="getStatusIcon(row.status)" width="14" height="14" />
            <span>
              {{ row.status }}
              <span v-if="row.readOnly" class="read-only-badge">(RO)</span>
            </span>
          </el-tag>
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
  name: 'StorageFilesystemsWidget',
  displayName: 'Systemy plików'
}
</script>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const { t } = useI18n()

const filesystems = ref([
  {
    device: '/dev/sda1',
    tags: 'root',
    type: 'ext4',
    size: 500107862016,
    available: 250107862016,
    used: 250000000000,
    usedPercent: 50,
    mounted: '/',
    reference: 'UUID=1a2b3c',
    status: 'active'
  },
  {
    device: '/dev/sdb1',
    tags: 'data',
    type: 'xfs',
    size: 1000204886016,
    available: 800204886016,
    used: 200000000000,
    usedPercent: 20,
    mounted: '/data',
    reference: 'UUID=4d5e6f',
    status: 'active'
  }
])

const loading = ref(false)
const error = ref(null)

const getDeviceIcon = (device) => {
  if (device?.includes('nvme')) return 'mdi:memory'
  if (device?.includes('sd')) return 'mdi:harddisk'
  return 'mdi:harddisk'
}

const getFsIcon = (type) => {
  const icons = {
    ext4: 'mdi:linux',
    xfs: 'mdi:file-tree',
    ntfs: 'mdi:windows',
    fat: 'mdi:usb-flash-drive',
    zfs: 'mdi:database'
  }
  return icons[type] || 'mdi:file-question'
}

const getStatusIcon = (status) => {
  const icons = {
    active: 'mdi:check-circle',
    inactive: 'mdi:close-circle',
    readonly: 'mdi:lock',
    error: 'mdi:alert-circle',
    unknown: 'mdi:help-circle'
  }
  return icons[status] || 'mdi:help-circle'
}

const getStatusType = (status) => {
  const types = {
    active: 'success',
    inactive: 'info',
    readonly: 'warning',
    error: 'danger',
    unknown: ''
  }
  return types[status] || ''
}

const getUsageColor = (percent) => {
  if (percent > 90) return '#F56C6C'
  if (percent > 70) return '#E6A23C'
  return '#67C23A'
}

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

const refreshFilesystems = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/storage/filesystems')
    if (Array.isArray(response.data?.data)) {
      filesystems.value = response.data.data
    }
  } catch (err) {
    error.value = t('storageFilesystems.errorLoading')
    console.error('Error fetching filesystems:', err)
  } finally {
    loading.value = false
  }
}

onMounted(refreshFilesystems)
</script>

<style scoped>
.filesystems-widget {
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.device-cell,
.mount-cell,
.size-cell {
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

.read-only-badge {
  font-size: 0.8em;
  opacity: 0.8;
  margin-left: 4px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.el-progress {
  display: inline-block;
  width: 200px;
  margin-right: 10px;
  vertical-align: middle;
}
</style>
