<template>
  <el-card class="widget-card" v-loading="loading" shadow="hover">
    <template #header>
      <div class="widget-header">
        <el-icon class="header-icon"><Cpu /></el-icon>
        <span class="header-title">{{ t('cpu.title') }}</span>
        <el-tag class="status-tag" size="small" :type="cpuStatusType">{{ cpuStatusText }}</el-tag>
      </div>
    </template>
    
    <div class="widget-body">
      <el-progress 
        :percentage="cpuData.usage" 
        :color="customColors"
        :format="formatCpuText"
        :stroke-width="6"
        class="cpu-progress"
      />
      
      <div class="metrics-grid">
        <div class="metric">
          <span class="metric__label">{{ t('cpu.usage') }}</span>
          <span class="metric__value">{{ cpuData.usage }}%</span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('cpu.temperature') }}</span>
          <span class="metric__value">{{ cpuData.temperature || t('common.na') }}°C</span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('systemInfo.cores') }}</span>
          <span class="metric__value">{{ cpuData.cores }}</span>
        </div>
        
        <div class="metric">
          <span class="metric__label">{{ t('cpu.load') }} (1m)</span>
          <span class="metric__value">{{ cpuData.load1 }}</span>
        </div>
      </div>
      
      <div class="update-info">
        <span class="update-info__label">{{ t('systemInfo.lastUpdate') }}:</span>
        <span class="update-info__time">{{ lastUpdate }}</span>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'CpuWidget',
  displayName: 'CPU Status'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Cpu } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

const { t } = useI18n()

// Dane
const cpuData = ref({
  usage: 0,
  temperature: null,
  cores: 0,
  load1: 0,
  load5: 0,
  load15: 0
})

const customColors = [
  { color: '#67C23A', percentage: 30 },
  { color: '#E6A23C', percentage: 70 },
  { color: '#F56C6C', percentage: 90 }
]

const lastUpdate = ref(t('common.loading'))
const loading = ref(true)
const error = ref(null)
let intervalId = null

// Status CPU
const cpuStatusType = computed(() => {
  if (error.value) return 'danger'
  if (cpuData.value.usage > 80) return 'warning'
  return 'success'
})

const cpuStatusText = computed(() => {
  if (error.value) return t('common.error')
  if (cpuData.value.usage > 80) return t('cpu.status.highLoad')
  return t('cpu.status.normal')
})

// Formatowanie tekstu
const formatCpuText = () => {
  return `${t('cpu.title')}: ${cpuData.value.usage}%`
}

// Pobieranie danych z API
const fetchCpuData = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/cpu')

    const data = response.data
    cpuData.value = {
      usage: data.usage,
      temperature: data.temperature,
      cores: data.cores || navigator.hardwareConcurrency || 4,
      load1: data.load1,
      load5: data.load5,
      load15: data.load15
    }
    lastUpdate.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (err) {
    console.error(t('common.errorFetching'), err)
    error.value = err.message
    // Fallback - generuj losowe dane jeśli API nie działa
    cpuData.value = {
      usage: Math.min(100, Math.round(Math.random() * 40 + 10)),
      temperature: Math.round(Math.random() * 10 + 50),
      cores: navigator.hardwareConcurrency || 4,
      load1: Math.random().toFixed(2),
      load5: Math.random().toFixed(2),
      load15: Math.random().toFixed(2)
    }
  } finally {
    loading.value = false
  }
}

// Uruchom odświeżanie co 5 sekund
onMounted(() => {
  fetchCpuData()
  intervalId = setInterval(fetchCpuData, 5000)
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

.cpu-progress {
  margin: 4px 0 8px;
  
  :deep(.el-progress-bar) {
    padding-right: 0;
    margin-right: 0;
  }
  
  :deep(.el-progress__text) {
    font-size: 11px !important;
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
