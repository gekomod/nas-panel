<template>
  <el-card class="widget-card" shadow="hover">
  <template #header>
    <div class="widget-header">
      <div class="header-left">
        <Icon icon="mdi:harddisk" width="18" height="18" color="#409EFF" />
        <h3>{{ t('fileSystem.title') }}</h3>
      </div>
      <div class="header-actions">
        <el-tooltip :content="autoRefresh ? t('fileSystem.autoRefreshOff') : t('fileSystem.autoRefreshOn')">
          <el-button 
            size="small" 
            @click="toggleAutoRefresh" 
            text
          >
            <Icon :icon="autoRefresh ? 'mdi:pause-circle' : 'mdi:play-circle'" width="16" height="16" />
          </el-button>
        </el-tooltip>
        <el-button 
          size="small" 
          @click="fetchFileSystems" 
          :loading="loading"
          text
        >
          <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': loading }" />
        </el-button>
      </div>
    </div>
  </template>

    
    <transition-group name="disk-list" tag="div" class="disk-container">
      <div v-for="disk in sortedDisks" :key="disk.device" class="disk-item">
        <div class="disk-main">
          <Icon :icon="getDiskIcon(disk)" width="20" height="20" class="disk-icon" />
          <div class="disk-info">
            <span class="device">{{ disk.device }}</span>
            <span class="mount">{{ disk.mount || '–' }}</span>
          </div>
          <span class="size">{{ formatSize(disk.size) }}</span>
        </div>
        
        <div class="disk-usage">
          <span class="percent">{{ disk.percentNumber }}%</span>
          <div class="progress-container">
            <div 
              class="progress-bar" 
              :style="{ width: disk.percentNumber + '%' }"
              :class="getUsageClass(disk.percentNumber)"
            ></div>
          </div>
        </div>
      </div>
    </transition-group>

    <div v-if="error" class="error-message">
      <Icon icon="mdi:alert-circle" width="16" height="16" color="#F56C6C" />
      <span>{{ error }}</span>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'FileSystemWidget',
  displayName: 'Dyski'
}
</script>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

// Dane
const fileSystems = ref([])
const loading = ref(false)
const error = ref(null)
const autoRefresh = ref(true)
const refreshInterval = ref(null)
const sortBy = ref('usage') // 'usage', 'name', 'size'

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

// Computed
const sortedDisks = computed(() => {
  return [...fileSystems.value].sort((a, b) => {
    if (sortBy.value === 'name') return a.device.localeCompare(b.device)
    if (sortBy.value === 'size') return parseSize(b.size) - parseSize(a.size)
    return b.percentNumber - a.percentNumber
  })
})

// Metody
const fetchFileSystems = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await axios.get('/api/filesystems')
    fileSystems.value = processDiskData(response.data)
  } catch (err) {
    error.value = 'Błąd ładowania danych dyskowych'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const processDiskData = (data) => {
  let disks = Array.isArray(data) ? data : data.disks || Object.values(data)
  return disks.map(disk => ({
    device: disk.device || 'Unknown',
    size: disk.size || '0B',
    percent: disk.percent || '0%',
    percentNumber: parsePercent(disk.percent),
    mount: disk.mount || ''
  })).filter(disk => !['tmpfs', 'devtmpfs'].includes(disk.device))
}

const parsePercent = (percent) => {
  return parseInt(percent?.toString().replace('%', '')) || 0
}

const parseSize = (size) => {
  const units = { 'K': 1, 'M': 2, 'G': 3, 'T': 4 }
  const match = size?.match(/^(\d+\.?\d*)\s*([KMGTP]?)B?$/i)
  return match ? parseFloat(match[1]) * Math.pow(1024, units[match[2].toUpperCase()] || 0) : 0
}

const formatSize = (size) => {
  if (!size) return '0B'
  return size.replace(/(\d+\.?\d*)\s*([KMGTP]?)B?/i, '$1 $2B').trim()
}

const getDiskIcon = (disk) => {
  if (disk.device.startsWith('/dev/sd')) return 'mdi:harddisk'
  if (disk.device.startsWith('/dev/dm')) return 'mdi:memory'
  if (disk.device.startsWith('/dev/md')) return 'mdi:database'
  return 'mdi:harddisk'
}

const getUsageClass = (percent) => {
  return {
    'low': percent < 70,
    'medium': percent >= 70 && percent < 90,
    'high': percent >= 90
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) setupAutoRefresh()
  else clearAutoRefresh()
}

const setupAutoRefresh = () => {
  clearAutoRefresh()
  refreshInterval.value = setInterval(fetchFileSystems, 30000)
}

const clearAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// Hooks
onMounted(() => {
  fetchFileSystems()
  setupAutoRefresh()
})

onBeforeUnmount(() => {
  clearAutoRefresh()
})
</script>

<style scoped>
.widget-card {
  border-radius: 8px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;

}

.header-actions {
  display: flex;
  gap: 4px;
}

.disk-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.disk-item {
  padding: 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.disk-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.disk-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.disk-icon {
  flex-shrink: 0;
  color: #909399;
}

.disk-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.device {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mount {
  font-size: 11px;
  color: #909399;
}

.size {
  font-size: 12px;
  font-weight: 500;
  color: #409EFF;
  white-space: nowrap;
}

.disk-usage {
  display: flex;
  align-items: center;
  gap: 8px;
}

.percent {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  min-width: 32px;
  text-align: right;
}

.progress-container {
  flex-grow: 1;
  height: 6px;
  background: #e0e6ed;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.progress-bar.low {
  background: #67C23A;
}

.progress-bar.medium {
  background: #E6A23C;
}

.progress-bar.high {
  background: #F56C6C;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #F56C6C;
  font-size: 12px;
  margin-top: 8px;
}

/* Animacje */
.disk-list-move,
.disk-list-enter-active,
.disk-list-leave-active {
  transition: all 0.3s ease;
}

.disk-list-enter-from,
.disk-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.disk-list-leave-active {
  position: absolute;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
