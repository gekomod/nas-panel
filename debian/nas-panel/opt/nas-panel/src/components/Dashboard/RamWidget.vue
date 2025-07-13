<template>
  <el-card class="widget-card" v-loading="loading">
    <template #header>
      <div class="widget-header">
        <el-icon><Monitor /></el-icon>
        <span>{{ t('ram.title') }}</span>
        <el-tag size="small" :type="ramStatusType">{{ ramStatusText }}</el-tag>
      </div>
    </template>
    <div class="widget-content">
      <el-progress 
        :percentage="ramData.percentage" 
        :color="customColors"
        :format="formatRamText"
      />
      <div class="metrics">
        <div class="metric-row">
          <span>{{ t('ram.used') }}:</span>
          <span>{{ formatBytes(ramData.used) }} / {{ formatBytes(ramData.total) }}</span>
        </div>
        <div class="metric-row">
          <span>{{ t('ram.free') }}:</span>
          <span>{{ formatBytes(ramData.free) }}</span>
        </div>
        <div class="metric-row">
          <span>{{ t('ram.active') }}:</span>
          <span>{{ formatBytes(ramData.active) }}</span>
        </div>
        <div class="metric-row">
          <span>{{ t('ram.lastUpdate') }}:</span>
          <span>{{ lastUpdate }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'RamWidget',
  displayName: 'Informacje Ram'
}
</script>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Monitor } from '@element-plus/icons-vue'

// Dane
const ramData = ref({
  total: 0,
  used: 0,
  free: 0,
  active: 0,
  percentage: 0
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

// Status RAM
const ramStatusType = computed(() => {
  if (error.value) return 'danger'
  if (ramData.value.percentage > 90) return 'warning'
  return 'success'
})

const ramStatusText = computed(() => {
  if (error.value) return t('ram.status.error')
  if (ramData.value.percentage > 90) return t('ram.status.critical')
  if (ramData.value.percentage > 75) return t('ram.status.high')
  return t('ram.status.normal')
})

// Formatowanie tekstu
const formatRamText = () => {
  return `RAM: ${ramData.value.percentage}%`
}

// Formatowanie bajtów
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

// Pobieranie danych z API
const fetchRamData = async () => {
  try {
    loading.value = true
    const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/ram`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    ramData.value = {
      total: data.total,
      used: data.used,
      free: data.free,
      active: data.active,
      percentage: data.percentage
    }
    lastUpdate.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (err) {
    console.error('Błąd pobierania danych RAM:', err)
    error.value = err.message
    // Fallback - generuj losowe dane jeśli API nie działa
    const total = 8 * 1024 * 1024 * 1024 // 8GB
    const used = Math.floor(Math.random() * 6 * 1024 * 1024 * 1024) // 0-6GB
    ramData.value = {
      total,
      used,
      free: total - used,
      active: used,
      percentage: Math.round((used / total) * 100)
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
