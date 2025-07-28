<template>
  <el-card class="widget-card" v-loading="loading" shadow="hover">
    <template #header>
      <div class="widget-header">
        <el-icon class="header-icon"><Monitor /></el-icon>
        <span class="header-title">{{ t('ram.title') }}</span>
        <el-tag class="status-tag" size="small" :type="ramStatusType">{{ ramStatusText }}</el-tag>
      </div>
    </template>
    
    <div class="widget-body">
      <el-progress 
        :percentage="ramUsagePercentage" 
        :color="customColors"
        :format="formatRamText"
        :stroke-width="6"
        class="ram-progress"
      />
      
      <div class="metrics-grid">
        <div class="metric">
          <span class="metric__label">{{ t('ram.used') }}</span>
          <span class="metric__value">
            {{ formatBytes(ramData.used) }}
            <span class="metric__total">/ {{ formatBytes(ramData.total) }}</span>
          </span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('ram.available') }}</span>
          <span class="metric__value">{{ formatBytes(ramData.available) }}</span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('ram.buffers') }}</span>
          <span class="metric__value">{{ formatBytes(ramData.buffers) }}</span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('ram.cached') }}</span>
          <span class="metric__value">{{ formatBytes(ramData.cached) }}</span>
        </div>
      </div>
      
      <div class="update-info">
        <span class="update-info__label">{{ t('ram.lastUpdate') }}:</span>
        <span class="update-info__time">{{ lastUpdate }}</span>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'RamWidget',
  displayName: 'Informacje RAM'
}
</script>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import axios from 'axios'
import { Monitor } from '@element-plus/icons-vue'

// Dane
const ramData = ref({
  total: 0,
  used: 0,
  free: 0,
  available: 0,
  buffers: 0,
  cached: 0,
  active: 0
})

const customColors = [
  { color: '#67C23A', percentage: 50 },
  { color: '#E6A23C', percentage: 75 },
  { color: '#F56C6C', percentage: 90 }
]

const lastUpdate = ref('')
const loading = ref(true)
const error = ref(null)
let intervalId = null

// Oblicz procent użycia RAM
const ramUsagePercentage = computed(() => {
  if (ramData.value.total === 0) return 0
  return Math.round(((ramData.value.total - ramData.value.available) / ramData.value.total) * 100)
})

// Status RAM
const ramStatusType = computed(() => {
  if (error.value) return 'danger'
  if (ramUsagePercentage.value > 90) return 'warning'
  return 'success'
})

const ramStatusText = computed(() => {
  if (error.value) return t('ram.status.error')
  if (ramUsagePercentage.value > 90) return t('ram.status.critical')
  if (ramUsagePercentage.value > 75) return t('ram.status.high')
  return t('ram.status.normal')
})

// Formatowanie tekstu
const formatRamText = () => {
  return `RAM: ${ramUsagePercentage.value}%`
}

// Formatowanie bajtów
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

// Pobieranie danych z API
const fetchRamData = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/ram')
    
    const data = response.data
    ramData.value = {
      total: data.total,
      used: data.used,
      free: data.free,
      available: data.available || (data.free + data.buffers + data.cached),
      buffers: data.buffers || 0,
      cached: data.cached || 0,
      active: data.active || data.used
    }
    lastUpdate.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (err) {
    console.error('Błąd pobierania danych RAM:', err)
    error.value = err.message
    // Fallback - generuj losowe dane jeśli API nie działa
    const total = 8 * 1024 * 1024 * 1024 // 8GB
    const available = Math.floor(Math.random() * 6 * 1024 * 1024 * 1024) // 0-6GB
    ramData.value = {
      total,
      used: total - available,
      free: available,
      available,
      buffers: 0,
      cached: 0,
      active: total - available
    }
  } finally {
    loading.value = false
  }
}

// Uruchom odświeżanie co 5 sekund
onMounted(() => {
  fetchRamData()
  intervalId = setInterval(fetchRamData, 5000)
})

// Sprzątanie
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style lang="scss" scoped>
.widget-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  :deep(.el-card__header) {
    padding: 8px 12px;
  }
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 8px 12px 10px;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .header-icon {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
  
  .header-title {
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  }
  
  .status-tag {
    font-size: 12px;
    padding: 0 6px;
    height: 20px;
    line-height: 20px;
  }
}

.ram-progress {
  margin: 4px 0 8px;
  
  :deep(.el-progress-bar) {
    padding-right: 0;
    margin-right: 0;
  }
  
  :deep(.el-progress__text) {
    font-size: 12px !important;
    margin-left: 8px;
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.metric {
  &__label {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &__value {
    display: block;
    font-size: 11px;
    font-weight: 500;
  }
  
  &__total {
    font-size: 9px;
    color: var(--el-text-color-secondary);
    margin-left: 2px;
  }
}

.update-info {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-light);
  text-align: right;
  
  &__label {
    font-size: 9px;
    color: var(--el-text-color-secondary);
    margin-right: 4px;
  }
  
  &__time {
    font-size: 9px;
    font-family: monospace;
  }
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
