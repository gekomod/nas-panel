<template>
  <el-card class="widget-card" v-loading="loading">
    <template #header>
      <div class="widget-header">
        <el-icon><Cpu /></el-icon>
        <span>{{ t('cpu.title') }}</span>
        <el-tag size="small" :type="cpuStatusType">{{ cpuStatusText }}</el-tag>
      </div>
    </template>
    <div class="widget-content">
      <el-progress 
        :percentage="cpuData.usage" 
        :color="customColors"
        :format="formatCpuText"
      />
      <div class="metrics">
        <div class="metric-row">
          <span>{{ t('cpu.usage') }}:</span>
          <span>{{ cpuData.usage }}%</span>
        </div>
        <div class="metric-row">
          <span>{{ t('cpu.temperature') }}:</span>
          <span>{{ cpuData.temperature || t('common.na') }}°C</span>
        </div>
        <div class="metric-row">
          <span>{{ t('systemInfo.cores') }}:</span>
          <span>{{ cpuData.cores }}</span>
        </div>
        <div class="metric-row">
          <span>{{ t('systemInfo.lastUpdate') }}:</span>
          <span>{{ lastUpdate }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'CpuWidget',
  displayName: 'Informacje o CPU'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Cpu } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

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
    const response = await fetch('http://localhost:3000/api/cpu')
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
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

<style scoped>
.widget-card {
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metrics {
  margin-top: 15px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.9em;
}

.metric-row span:first-child {
  color: #888;
}
</style>
