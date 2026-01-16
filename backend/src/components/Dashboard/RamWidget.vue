<template>
  <el-card class="ram-widget" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:memory" />
        <span>RAM</span>
        <span class="status-badge" :class="getStatusClass(usagePercentage)">
          {{ usagePercentage }}%
        </span>
      </div>
    </template>

    <div class="widget-content">
      <!-- Pasek progresu -->
      <div class="usage-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${usagePercentage}%` }"
            :class="getStatusClass(usagePercentage)"
          ></div>
        </div>
        <div class="progress-labels">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <!-- Statystyki główne -->
      <div class="main-stats">
        <div class="stat-row">
          <span class="stat-label">Użyte:</span>
          <span class="stat-value">{{ formatBytes(ramData.used) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Dostępne:</span>
          <span class="stat-value">{{ formatBytes(ramData.available) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Całkowita:</span>
          <span class="stat-value">{{ formatBytes(ramData.total) }}</span>
        </div>
      </div>

      <!-- Cache i Buffers -->
      <div class="cache-stats">
        <div class="cache-item">
          <Icon icon="mdi:database" />
          <span class="cache-label">Cache:</span>
          <span class="cache-value">{{ formatBytes(ramData.cached) }}</span>
        </div>
        <div class="cache-item">
          <Icon icon="mdi:buffer" />
          <span class="cache-label">Buffers:</span>
          <span class="cache-value">{{ formatBytes(ramData.buffers) }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'RamWidget',
  displayName: 'RAM'
}
</script>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const ramData = ref({
  total: 0,
  used: 0,
  free: 0,
  available: 0,
  buffers: 0,
  cached: 0
})

const usagePercentage = computed(() => {
  if (ramData.value.total === 0) return 0
  const used = ramData.value.total - ramData.value.available
  return Math.round((used / ramData.value.total) * 100)
})

const getStatusClass = (percent) => {
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'warning'
  return 'normal'
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const fetchRamData = async () => {
  try {
    const response = await axios.get('/api/ram')
    const data = response.data
    
    ramData.value = {
      total: data.total || 0,
      used: data.used || 0,
      free: data.free || 0,
      available: data.available || 0,
      buffers: data.buffers || 0,
      cached: data.cached || 0
    }
    
  } catch (err) {
    console.error('Błąd RAM:', err)
    // Fallback data
    ramData.value = {
      total: 8 * 1024 * 1024 * 1024, // 8GB
      used: 5.2 * 1024 * 1024 * 1024,
      free: 2.8 * 1024 * 1024 * 1024,
      available: 3.1 * 1024 * 1024 * 1024,
      buffers: 256 * 1024 * 1024,
      cached: 1.5 * 1024 * 1024 * 1024
    }
  }
}

onMounted(() => {
  fetchRamData()
  setInterval(fetchRamData, 3000)
})
</script>

<style scoped>
.ram-widget {
  height: 100%;
  border-radius: 8px;
}

.ram-widget :deep(.el-card__header) {
  padding: 8px 12px;
}

.ram-widget :deep(.el-card__body) {
  padding: 10px 12px;
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

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
  font-family: monospace;
}

.status-badge.normal {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-badge.warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.status-badge.critical {
  background: var(--el-color-error-light-9);
  color: var(--el-color-error);
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Pasek progresu */
.usage-progress {
  margin-top: 4px;
}

.progress-bar {
  height: 6px;
  background: var(--el-color-info-light-8);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.normal {
  background: var(--el-color-success);
}

.progress-fill.warning {
  background: var(--el-color-warning);
}

.progress-fill.critical {
  background: var(--el-color-error);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--el-text-color-secondary);
}

/* Statystyki główne */
.main-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.stat-label {
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: monospace;
}

/* Cache i Buffers */
.cache-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cache-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.cache-item .iconify {
  font-size: 10px;
  color: var(--el-color-info);
}

.cache-label {
  color: var(--el-text-color-secondary);
  flex: 1;
}

.cache-value {
  color: var(--el-text-color-primary);
  font-family: monospace;
}
</style>
