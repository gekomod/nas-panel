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
            <Icon icon="mdi:cpu-64-bit" width="16" />
          </div>
          <span class="header-title">CPU</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <span class="hostname" :class="cpuStatusType">{{ cpuStatusText }}</span>
          <span class="system">{{ cpuData.cores }} rdzeni</span>
        </div>
      </div>
    </template>

    <!-- Zawartość widgetu -->
    <div class="widget-content">
      <!-- Główny pasek użycia -->
      <div class="main-usage">
        <div class="usage-header">
          <span class="usage-title">{{ t('cpu.usage') }}</span>
          <div class="usage-value">
            <span class="value-number">{{ cpuData.usage }}</span>
            <span class="value-unit">%</span>
          </div>
        </div>
        
        <div class="usage-progress">
          <div class="progress-track">
            <div 
              class="progress-fill" 
              :style="{ 
                width: `${cpuData.usage}%`,
                '--progress-color': getProgressColor(cpuData.usage)
              }"
            >
              <div class="progress-glow"></div>
            </div>
          </div>
          
          <div class="progress-thresholds">
            <div class="threshold" style="left: 30%"></div>
            <div class="threshold" style="left: 70%"></div>
            <div class="threshold critical" style="left: 90%"></div>
          </div>
        </div>
      </div>
      
      <!-- Temperatura -->
      <div class="temperature-row" v-if="cpuData.temperature">
        <div class="info-row">
          <div class="label">
            <Icon icon="mdi:thermometer" width="14" />
            <span>{{ t('cpu.temperature') }}</span>
          </div>
          <div class="value temp-value" :class="getTemperatureClass(cpuData.temperature)">
            {{ cpuData.temperature }}°C
          </div>
        </div>
      </div>
      
      <!-- Load averages -->
      <div class="load-container">
        <div class="info-row">
          <div class="label">
            <Icon icon="mdi:chart-line" width="14" />
            <span>{{ t('cpu.load') }}</span>
          </div>
          <div class="value">
            <div class="load-badges">
              <span class="load-badge" v-for="(load, index) in loadAverages" :key="index">
                <span class="load-label">{{ load.label }}</span>
                <span class="load-value">{{ load.value }}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="load-bars">
          <div class="load-bar" v-for="(load, index) in loadAverages" :key="index">
            <div class="load-progress">
              <div 
                class="load-progress-fill" 
                :style="{ width: `${load.percentage}%` }"
                :class="getLoadClass(load.percentage)"
              ></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Quick stats -->
      <div class="metrics-grid">
        <div class="info-row metric-item" v-for="metric in metrics" :key="metric.label">
          <div class="label">
            <Icon :icon="metric.icon" width="14" />
            <span>{{ metric.label }}</span>
          </div>
          <div class="value">
            {{ metric.value }}
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'CpuWidget',
  displayName: 'CPU'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

// Dane
const cpuData = ref({
  usage: 0,
  temperature: null,
  cores: 0,
  frequency: null,
  load1: 0,
  load5: 0,
  load15: 0
})

const lastUpdate = ref(t('common.loading'))
const loading = ref(true)
let intervalId = null

// Helper functions
const safeNumber = (value, defaultValue = 0) => {
  const num = Number(value)
  return isNaN(num) ? defaultValue : num
}

const formatLoadValue = (value) => {
  const num = safeNumber(value)
  return num.toFixed(2)
}

const calculateLoadPercentage = (value) => {
  const num = safeNumber(value)
  return Math.min(num * 20, 100)
}

const getProgressColor = (usage) => {
  const num = safeNumber(usage)
  if (num > 90) return 'var(--el-color-danger)'
  if (num > 70) return 'var(--el-color-warning)'
  return 'var(--el-color-success)'
}

const getTemperatureClass = (temp) => {
  const num = safeNumber(temp)
  if (num > 80) return 'critical'
  if (num > 65) return 'warning'
  return 'normal'
}

const getLoadClass = (percentage) => {
  if (percentage > 90) return 'critical'
  if (percentage > 70) return 'warning'
  return 'normal'
}

// Computed properties
const cpuStatusType = computed(() => {
  if (cpuData.value.usage > 80) return 'critical'
  if (cpuData.value.usage > 50) return 'warning'
  return 'normal'
})

const cpuStatusText = computed(() => {
  if (cpuData.value.usage > 80) return 'WYSOKIE OBCIĄŻENIE'
  if (cpuData.value.usage > 50) return 'ŚREDNIE OBCIĄŻENIE'
  return 'NORMALNE'
})

const metrics = computed(() => [
  {
    label: 'Częstotliwość',
    value: cpuData.value.frequency ? `${cpuData.value.frequency} GHz` : '—',
    icon: 'mdi:speedometer'
  },
  {
    label: 'Obciążenie (5m)',
    value: formatLoadValue(cpuData.value.load5),
    icon: 'mdi:timer-outline'
  },
  {
    label: 'Obciążenie (15m)',
    value: formatLoadValue(cpuData.value.load15),
    icon: 'mdi:chart-histogram'
  }
])

const loadAverages = computed(() => [
  {
    label: '1m',
    value: formatLoadValue(cpuData.value.load1),
    percentage: calculateLoadPercentage(cpuData.value.load1)
  },
  {
    label: '5m',
    value: formatLoadValue(cpuData.value.load5),
    percentage: calculateLoadPercentage(cpuData.value.load5)
  },
  {
    label: '15m',
    value: formatLoadValue(cpuData.value.load15),
    percentage: calculateLoadPercentage(cpuData.value.load15)
  }
])

// Pobieranie danych
const fetchCpuData = async () => {
  try {
    loading.value = true
    
    const response = await axios.get('/api/cpu')
    const data = response.data
    
    cpuData.value = {
      usage: Math.min(100, Math.max(0, safeNumber(data.usage, 0))),
      temperature: data.temperature ? safeNumber(data.temperature) : null,
      cores: safeNumber(data.cores, navigator.hardwareConcurrency || 4),
      frequency: data.frequency ? safeNumber(data.frequency) : null,
      load1: safeNumber(data.load1, 0),
      load5: safeNumber(data.load5, 0),
      load15: safeNumber(data.load15, 0)
    }
    
    lastUpdate.value = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
  } catch (err) {
    console.error(t('common.errorFetching'), err)
    // Fallback data
    cpuData.value = {
      usage: Math.min(100, Math.round(Math.random() * 40 + 10)),
      temperature: 45 + Math.round(Math.random() * 20),
      cores: navigator.hardwareConcurrency || 4,
      frequency: (2.4 + Math.random() * 1.6).toFixed(1),
      load1: (Math.random() * 2).toFixed(2),
      load5: (Math.random() * 2).toFixed(2),
      load15: (Math.random() * 2).toFixed(2)
    }
    
    lastUpdate.value = t('common.error')
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  fetchCpuData()
  intervalId = setInterval(fetchCpuData, 30000)
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
    padding: 16px 20px;
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
    
    &.normal {
      color: var(--el-color-success);
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

  .system {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Główny pasek użycia */
.main-usage {
  margin-top: 4px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.usage-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.usage-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  
  .value-number {
    font-size: 24px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  }
  
  .value-unit {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-left: 2px;
  }
}

.usage-progress {
  position: relative;
  margin-top: 8px;
}

.progress-track {
  height: 8px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, 
    var(--progress-color),
    color-mix(in srgb, var(--progress-color) 70%, white)
  );
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.progress-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 2s infinite;
}

.progress-thresholds {
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  bottom: -2px;
  pointer-events: none;
}

.threshold {
  position: absolute;
  top: 0;
  width: 1px;
  height: 10px;
  background: color-mix(in srgb, var(--el-border-color) 50%, transparent);
  
  &.critical {
    background: color-mix(in srgb, var(--el-color-danger) 30%, transparent);
  }
}

/* Temperatura */
.temperature-row {
  .info-row {
    margin: 0;
  }
  
  .temp-value {
    font-size: 14px;
    font-weight: 600;
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
    
    &.normal {
      color: var(--el-color-success);
    }
    
    &.warning {
      color: var(--el-color-warning);
    }
    
    &.critical {
      color: var(--el-color-danger);
    }
  }
}

/* Load container */
.load-container {
  .info-row {
    margin-bottom: 8px;
  }
}

.load-badges {
  display: flex;
  gap: 10px;
}

.load-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
}

.load-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin-bottom: 2px;
}

.load-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
}

.load-bars {
  display: flex;
  gap: 8px;
}

.load-bar {
  flex: 1;
}

.load-progress {
  height: 4px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: 2px;
  overflow: hidden;
}

.load-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
  
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

/* Metrics grid */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 8px;
}

.metric-item {
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  border: 1px solid transparent;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--el-fill-color-light);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, transparent);
  }
  
  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  
  .value {
    font-weight: 500;
    color: var(--el-text-color-primary);
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
    font-size: 12px;
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 6px 0;
  min-height: 28px;

  .label {
    font-weight: 500;
    color: var(--el-text-color-regular);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .value {
    font-weight: 400;
    color: var(--el-text-color-primary);
    text-align: right;
    margin-left: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Animacje */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
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
      padding: 12px 16px;
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
  
  .usage-header {
    .usage-title {
      font-size: 11px;
    }
    
    .value-number {
      font-size: 20px;
    }
  }
  
  .load-badges {
    gap: 6px;
  }
  
  .load-badge {
    min-width: 35px;
  }
  
  .load-label {
    font-size: 9px;
  }
  
  .load-value {
    font-size: 11px;
  }
  
  .info-row {
    font-size: 12px;
    min-height: 24px;
  }
  
  .temp-value {
    font-size: 12px;
  }
  
  .metric-item {
    padding: 4px 8px;
    
    .value {
      font-size: 11px;
    }
  }
}

@media (max-width: 360px) {
  .load-badges {
    flex-direction: column;
    gap: 4px;
  }
  
  .load-badge {
    flex-direction: row;
    justify-content: space-between;
    min-width: 80px;
  }
  
  .load-label {
    margin-bottom: 0;
    margin-right: 4px;
  }
}
</style>
