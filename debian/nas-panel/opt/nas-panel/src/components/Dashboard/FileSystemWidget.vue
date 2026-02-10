<template>
  <el-card 
    class="widget-card" 
    shadow="hover" 
    v-loading="loading"
  >
    <!-- Nagłówek -->
    <template #header>
      <div class="widget-header">
        <div class="header-main">
          <div class="header-icon">
            <Icon icon="mdi:harddisk" width="16" />
          </div>
          <span class="header-title">Dyski</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <span class="hostname">{{ fileSystems.length }} dysków</span>
          <span class="system">{{ totalUsedPercent }}% zajęte</span>
        </div>
      </div>
    </template>

    <!-- Zawartość widgetu -->
    <div class="widget-content">
      <div 
        v-for="disk in sortedDisks" 
        :key="disk.device" 
        class="disk-row"
      >
        <div class="disk-info">
          <Icon 
            :icon="getDiskIcon(disk.device)" 
            width="12" 
            class="disk-icon"
            :style="{ color: getDiskColor(disk.device) }"
          />
          <span class="disk-name">{{ formatDeviceName(disk.device) }}</span>
          <span class="mount-point" v-if="disk.mount" :title="disk.mount">
            {{ formatMountPoint(disk.mount) }}
          </span>
        </div>
        
        <div class="disk-stats">
          <div class="disk-usage">
            <div class="usage-bar">
              <div 
                class="bar-fill" 
                :style="{ width: `${disk.percentNumber}%` }"
                :class="getUsageClass(disk.percentNumber)"
              ></div>
            </div>
            <div class="usage-numbers">
              <span class="usage-percent" :class="getUsageClass(disk.percentNumber)">
                {{ disk.percentNumber }}%
              </span>
            </div>
          </div>
          <div class="disk-size-info">
            <span class="used-space">{{ formatSize(calculateUsed(disk)) }}</span>
            <span class="separator">/</span>
            <span class="total-space">{{ formatSize(parseSize(disk.size)) }}</span>
          </div>
        </div>
      </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

const fileSystems = ref([])
const loading = ref(true)
const lastUpdate = ref(t('common.loading'))
let intervalId = null

const sortedDisks = computed(() => {
  return [...fileSystems.value].sort((a, b) => b.percentNumber - a.percentNumber)
})

const totalUsedPercent = computed(() => {
  if (fileSystems.value.length === 0) return 0
  const total = fileSystems.value.reduce((sum, disk) => sum + disk.percentNumber, 0)
  return Math.round(total / fileSystems.value.length)
})

const getDiskIcon = (device) => {
  if (device.includes('nvme')) return 'ph:hard-drive'
  if (device.includes('sd') || device.includes('hd')) return 'ph:hard-drives'
  if (device.includes('mmc')) return 'mdi:sd-card'
  return 'mdi:harddisk'
}

const getDiskColor = (device) => {
  if (device.includes('nvme')) return 'var(--el-color-primary)'
  if (device.includes('sd')) return 'var(--el-color-success)'
  if (device.includes('hd')) return 'var(--el-color-warning)'
  if (device.includes('mmc')) return 'var(--el-color-info)'
  return 'var(--el-text-color-secondary)'
}

const formatDeviceName = (device) => {
  return device.replace(/^\/dev\//, '').toUpperCase()
}

const formatMountPoint = (mount) => {
  if (!mount) return ''
  // Skróć długie ścieżki montowania
  if (mount.length > 15) {
    return mount.split('/').pop() || mount
  }
  return mount
}

const getUsageClass = (percent) => {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warning'
  return 'normal'
}

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const parseSize = (size) => {
  if (!size) return 0
  
  // Jeśli rozmiar jest już w bajtach (liczba)
  if (typeof size === 'number') return size
  
  const units = { 
    'K': 1, 'KB': 1,
    'M': 2, 'MB': 2,
    'G': 3, 'GB': 3,
    'T': 4, 'TB': 4,
    'P': 5, 'PB': 5
  }
  
  const match = size.toString().match(/^(\d+\.?\d*)\s*([KMGTP]?B?)$/i)
  
  if (match) {
    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    return value * Math.pow(1024, units[unit] || 0)
  }
  
  return parseFloat(size) || 0
}

const calculateUsed = (disk) => {
  const total = parseSize(disk.size)
  return total * (disk.percentNumber / 100)
}

const fetchFileSystems = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/filesystems')
    const data = response.data
    const disks = Array.isArray(data) ? data : data.disks || Object.values(data)
    
    fileSystems.value = disks
      .map(disk => ({
        device: disk.device || 'Unknown',
        size: disk.size || '0B',
        percent: disk.percent || '0%',
        percentNumber: parseInt(disk.percent?.toString().replace('%', '')) || 0,
        mount: disk.mount || ''
      }))
      .filter(disk => !['tmpfs', 'devtmpfs'].includes(disk.device))
    
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
  } catch (err) {
    console.error('Błąd ładowania dysków:', err)
    lastUpdate.value = t('common.error')
    // Fallback data for development
    fileSystems.value = [
      {
        device: '/dev/sda1',
        size: '256GB',
        percent: '65%',
        percentNumber: 65,
        mount: '/'
      },
      {
        device: '/dev/nvme0n1p1',
        size: '512GB',
        percent: '42%',
        percentNumber: 42,
        mount: '/home'
      },
      {
        device: '/dev/mmcblk0p1',
        size: '128GB',
        percent: '18%',
        percentNumber: 18,
        mount: '/boot'
      }
    ]
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchFileSystems()
  intervalId = setInterval(fetchFileSystems, 30000)
})

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped lang="scss">
.widget-card {
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 280px;
  height: 100%;
  
  /* Ciemniejszy border w trybie dark */
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:deep(.el-card__header) {
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
    padding: 16px 20px;
    background: transparent;
    
    :global(.dark) &,
    :global(body.dark) & {
      border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    }
  }

  &:deep(.el-card__body) {
    padding: 12px 20px 16px;
  }
}

.widget-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;

  .header-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.25);
    flex-shrink: 0;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .update-time {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-weight: 400;
    padding: 4px 8px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    flex-shrink: 0;
    white-space: nowrap;
  }
}

.header-sub {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 8px;

  .hostname, .system {
    font-weight: 500;
    color: var(--el-text-color-regular);
    padding: 4px 8px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: center;
  }

  .system {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.disk-row {
  padding: 8px 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: auto;
  
  &:hover {
    background: var(--el-fill-color-lighter);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, transparent);
    
    :global(.dark) &,
    :global(body.dark) & {
      border-color: color-mix(in srgb, var(--el-border-color) 30%, #334155);
    }
  }
  
  &:not(:last-child) {
    margin-bottom: 2px;
  }
}

.disk-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  
  .disk-icon {
    flex-shrink: 0;
  }
  
  .disk-name {
    font-weight: 500;
    color: var(--el-text-color-primary);
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
    font-size: 11px;
  }
  
  .mount-point {
    font-size: 10px;
    color: var(--el-text-color-secondary);
    opacity: 0.8;
    font-weight: 400;
    margin-left: auto;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.disk-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.disk-usage {
  display: flex;
  align-items: center;
  gap: 10px;
}

.usage-bar {
  flex: 1;
  height: 4px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
  
  &.normal {
    background: var(--el-color-success);
  }
  
  &.warning {
    background: var(--el-color-warning);
  }
  
  &.critical {
    background: var(--el-color-danger);
  }
}

.usage-numbers {
  min-width: 35px;
  text-align: right;
}

.usage-percent {
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  padding: 2px 6px;
  border-radius: 10px;
  display: inline-block;
  min-width: 30px;
  text-align: center;
  
  &.normal {
    color: var(--el-color-success);
    background: rgba(var(--el-color-success-rgb), 0.1);
  }
  
  &.warning {
    color: var(--el-color-warning);
    background: rgba(var(--el-color-warning-rgb), 0.1);
  }
  
  &.critical {
    color: var(--el-color-danger);
    background: rgba(var(--el-color-danger-rgb), 0.1);
  }
}

.disk-size-info {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  
  .used-space,
  .total-space {
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  }
  
  .separator {
    opacity: 0.5;
  }
}

/* Compact mode for very small screens */
@media (max-width: 480px) {
  .widget-card {
    border-radius: 10px;
    
    &:deep(.el-card__header) {
      padding: 12px 16px;
    }
    
    &:deep(.el-card__body) {
      padding: 10px 16px 12px;
    }
  }

  .header-main {
    .header-icon {
      width: 28px;
      height: 28px;
    }
    
    .header-title {
      font-size: 13px;
    }
    
    .update-time {
      font-size: 10px;
      padding: 3px 6px;
    }
  }
  
  .header-sub {
    font-size: 11px;
    
    .hostname, .system {
      padding: 3px 6px;
    }
  }
  
  .disk-row {
    padding: 6px 8px;
  }
  
  .disk-info {
    font-size: 11px;
    gap: 6px;
    margin-bottom: 4px;
    
    .disk-name {
      font-size: 10px;
    }
    
    .mount-point {
      font-size: 9px;
      max-width: 60px;
    }
  }
  
  .disk-usage {
    gap: 8px;
  }
  
  .usage-bar {
    height: 3px;
  }
  
  .usage-percent {
    font-size: 10px;
    padding: 1px 4px;
    min-width: 25px;
  }
  
  .disk-size-info {
    font-size: 9px;
    gap: 3px;
  }
}

@media (max-width: 360px) {
  .disk-info {
    .mount-point {
      display: none;
    }
  }
  
  .disk-stats {
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
  }
  
  .disk-usage {
    width: 100%;
  }
  
  .usage-bar {
    min-width: 60px;
  }
}
</style>
