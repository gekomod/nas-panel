<template>
  <el-card class="fs-widget" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:harddisk" />
        <span>Dyski</span>
        <span class="disk-count">{{ fileSystems.length }}</span>
      </div>
    </template>

    <div class="widget-content">
      <div 
        v-for="disk in sortedDisks" 
        :key="disk.device" 
        class="disk-row"
      >
        <div class="disk-info">
          <span class="disk-name">{{ formatDeviceName(disk.device) }}</span>
          <span class="disk-size">{{ formatSize(disk.size) }}</span>
        </div>
        
        <div class="disk-usage">
          <div class="usage-numbers">
            <span class="used-space">{{ formatSize(calculateUsed(disk)) }}</span>
            <span class="usage-percent" :class="getUsageClass(disk.percentNumber)">
              {{ disk.percentNumber }}%
            </span>
          </div>
          <div class="usage-bar">
            <div 
              class="bar-fill" 
              :style="{ width: `${disk.percentNumber}%` }"
              :class="getUsageClass(disk.percentNumber)"
            ></div>
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
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const fileSystems = ref([])

const sortedDisks = computed(() => {
  return [...fileSystems.value].sort((a, b) => b.percentNumber - a.percentNumber)
})

const formatDeviceName = (device) => {
  return device.replace(/^\/dev\//, '')
}

const getUsageClass = (percent) => {
  if (percent >= 90) return 'high'
  if (percent >= 70) return 'medium'
  return 'low'
}

const formatSize = (size) => {
  if (!size) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let bytes = parseSize(size)
  let unitIndex = 0
  
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024
    unitIndex++
  }
  
  return `${bytes.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const parseSize = (size) => {
  if (!size) return 0
  
  const units = { 'K': 1, 'M': 2, 'G': 3, 'T': 4 }
  const match = size.toString().match(/^(\d+\.?\d*)\s*([KMGTP]?)B?$/i)
  
  if (match) {
    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    return value * Math.pow(1024, units[unit] || 0)
  }
  
  return 0
}

const calculateUsed = (disk) => {
  const total = parseSize(disk.size)
  return total * (disk.percentNumber / 100)
}

const fetchFileSystems = async () => {
  try {
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
      
  } catch (err) {
    console.error('Błąd ładowania dysków:', err)
  }
}

onMounted(() => {
  fetchFileSystems()
  setInterval(fetchFileSystems, 30000)
})
</script>

<style scoped>
.fs-widget {
  height: 100%;
  border-radius: 8px;
}

.fs-widget :deep(.el-card__header) {
  padding: 8px 12px;
}

.fs-widget :deep(.el-card__body) {
  padding: 8px 12px;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.widget-header .iconify {
  font-size: 14px;
  color: var(--el-color-primary);
}

.disk-count {
  font-size: 11px;
  background: var(--el-color-info-light-8);
  color: var(--el-text-color-secondary);
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: auto;
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.disk-row {
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.disk-row:last-child {
  border-bottom: none;
}

.disk-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
}

.disk-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.disk-size {
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.disk-usage {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-numbers {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.used-space {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.usage-percent {
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.usage-percent.low {
  color: var(--el-color-success);
}

.usage-percent.medium {
  color: var(--el-color-warning);
}

.usage-percent.high {
  color: var(--el-color-error);
}

.usage-bar {
  height: 4px;
  background: var(--el-color-info-light-8);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.bar-fill.low {
  background: var(--el-color-success);
}

.bar-fill.medium {
  background: var(--el-color-warning);
}

.bar-fill.high {
  background: var(--el-color-error);
}
</style>
