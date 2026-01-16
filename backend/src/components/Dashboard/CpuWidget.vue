<template>
  <el-card class="cpu-widget" shadow="hover">
    <!-- Nagłówek - kompaktowy -->
    <template #header>
      <div class="widget-header">
        <div class="header-main">
          <div class="header-icon">
            <el-icon class="cpu-icon" :class="{ 'loading': loading }">
              <Cpu />
            </el-icon>
            <span class="header-title">{{ t('cpu.title') }}</span>
          </div>
          
          <div class="header-status">
            <div class="status-indicator" :class="cpuStatusType">
              <span class="status-dot"></span>
              <span class="status-text">{{ cpuStatusText }}</span>
            </div>
            
            <div class="header-actions">
              <span class="cores-badge">
                {{ cpuData.cores }} <span class="cores-label">rdz.</span>
              </span>
              
              <el-button 
                size="small" 
                circle 
                text 
                @click="fetchCpuData"
                :loading="loading"
                class="refresh-btn"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
    
    <!-- Główne metryki -->
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
      
      <!-- Temperatura - kompaktowa, bez ramki -->
      <div class="temperature-row" v-if="cpuData.temperature">
        <div class="temperature-info">
          <el-icon class="temp-icon">
            <HotWater />
          </el-icon>
          <span class="temp-label">{{ t('cpu.temperature') }}</span>
        </div>
        <div class="temp-value" :class="getTemperatureClass(cpuData.temperature)">
          {{ cpuData.temperature }}°C
        </div>
      </div>
      
      <!-- Load averages - bez ramki, w jednej linii -->
      <div class="load-container">
        <div class="load-header">
          <span class="load-title">{{ t('cpu.load') }}</span>
          <div class="load-legend">
            <div class="legend-item">
              <span class="legend-dot load-1m"></span>
              <span class="legend-label">1m</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot load-5m"></span>
              <span class="legend-label">5m</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot load-15m"></span>
              <span class="legend-label">15m</span>
            </div>
          </div>
        </div>
        
        <div class="load-bars">
          <div class="load-bar" v-for="(load, index) in loadAverages" :key="index">
            <div class="load-progress">
              <div 
                class="load-progress-fill" 
                :style="{ width: `${load.percentage}%` }"
              ></div>
            </div>
            <div class="load-value">{{ load.value }}</div>
          </div>
        </div>
      </div>
      
      <!-- Quick stats - minimalistyczne -->
      <div class="metrics-grid">
        <div class="metric-item" v-for="metric in metrics" :key="metric.label">
          <div class="metric-icon">
            <el-icon><component :is="metric.icon" /></el-icon>
          </div>
          <div class="metric-info">
            <div class="metric-label">{{ metric.label }}</div>
            <div class="metric-value">{{ metric.value }}</div>
          </div>
        </div>
      </div>
      
      <!-- Stopka - minimalistyczna -->
      <div class="widget-footer">
        <div class="update-time">
          <span class="update-text">Aktualizacja: {{ lastUpdate }}</span>
        </div>
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
import { 
  Cpu, 
  Refresh, 
  HotWater, 
  Clock,
  Timer,
  Histogram,
  Lightning,
  DataBoard
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { ElMessage } from 'element-plus'

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
const loading = ref(false)
const error = ref(null)
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
  if (num > 90) return 'var(--el-color-error)'
  if (num > 70) return 'var(--el-color-warning)'
  return 'var(--el-color-success)'
}

const getTemperatureClass = (temp) => {
  const num = safeNumber(temp)
  if (num > 80) return 'temp-critical'
  if (num > 65) return 'temp-warning'
  return 'temp-normal'
}

// Computed properties
const cpuStatusType = computed(() => {
  if (error.value) return 'error'
  if (cpuData.value.usage > 80) return 'warning'
  return 'success'
})

const cpuStatusText = computed(() => {
  if (error.value) return t('common.error')
  if (cpuData.value.usage > 80) return t('cpu.status.highLoad')
  if (cpuData.value.usage > 50) return t('cpu.status.mediumLoad')
  return t('cpu.status.normal')
})

const metrics = computed(() => [
  {
    label: 'Częstotliwość',
    value: cpuData.value.frequency ? `${cpuData.value.frequency} GHz` : '—',
    icon: Lightning
  },
  {
    label: 'Rdzenie',
    value: cpuData.value.cores,
    icon: DataBoard
  },
  {
    label: 'Obciążenie (5m)',
    value: formatLoadValue(cpuData.value.load5),
    icon: Timer
  },
  {
    label: 'Obciążenie (15m)',
    value: formatLoadValue(cpuData.value.load15),
    icon: Histogram
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
    error.value = null
    
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
    error.value = err.message
    
    // Fallback
    cpuData.value.usage = Math.min(100, Math.round(Math.random() * 40 + 10))
    cpuData.value.load1 = safeNumber(Math.random().toFixed(2))
    cpuData.value.load5 = safeNumber(Math.random().toFixed(2))
    cpuData.value.load15 = safeNumber(Math.random().toFixed(2))
    
    ElMessage.error({
      message: t('common.fetchError'),
      duration: 2000
    })
  } finally {
    loading.value = false
  }
}

// Lifecycle
onMounted(() => {
  fetchCpuData()
  intervalId = setInterval(fetchCpuData, 3000)
})

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style lang="scss" scoped>
.cpu-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  
  :deep(.el-card__header) {
    padding: 12px 16px 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: transparent;
  }
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    gap: 16px;
    background: transparent;
  }
}

/* Nagłówek - minimalistyczny */
.widget-header {
  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  
  .header-icon {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .cpu-icon {
    font-size: 14px;
    color: var(--el-color-primary);
    transition: all 0.3s ease;
    
    &.loading {
      animation: pulse 2s infinite;
    }
  }
  
  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    letter-spacing: -0.1px;
  }
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  
  &.success {
    background: var(--el-color-success-light-9);
    
    .status-dot {
      background: var(--el-color-success);
    }
    
    .status-text {
      color: var(--el-color-success);
    }
  }
  
  &.warning {
    background: var(--el-color-warning-light-9);
    
    .status-dot {
      background: var(--el-color-warning);
    }
    
    .status-text {
      color: var(--el-color-warning);
    }
  }
  
  &.error {
    background: var(--el-color-danger-light-9);
    
    .status-dot {
      background: var(--el-color-danger);
    }
    
    .status-text {
      color: var(--el-color-danger);
    }
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.status-text {
  font-size: 11px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cores-badge {
  font-size: 11px;
  padding: 3px 8px;
  background: var(--el-color-info-light-8);
  color: var(--el-text-color-secondary);
  border-radius: 6px;
  font-weight: 500;
  
  .cores-label {
    font-size: 10px;
    opacity: 0.7;
  }
}

.refresh-btn {
  padding: 4px;
  
  &:hover {
    transform: rotate(90deg);
    transition: transform 0.3s ease;
  }
}

/* Główny pasek użycia - bez ramki */
.main-usage {
  margin-top: 4px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
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
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
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
  background: var(--el-color-info-light-8);
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
  background: var(--el-border-color-light);
  
  &.critical {
    background: var(--el-color-error-light-3);
  }
}

/* Temperatura - minimalistyczna, bez ramki */
.temperature-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.temperature-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.temp-icon {
  font-size: 14px;
  color: var(--el-color-primary);
}

.temp-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.temp-value {
  font-size: 16px;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
  
  &.temp-normal {
    color: var(--el-color-success);
  }
  
  &.temp-warning {
    color: var(--el-color-warning);
  }
  
  &.temp-critical {
    color: var(--el-color-error);
  }
}

/* Load container - bez ramki */
.load-container {
  margin: 8px 0;
}

.load-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.load-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.load-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  
  &.load-1m {
    background: var(--el-color-primary);
  }
  
  &.load-5m {
    background: var(--el-color-info);
  }
  
  &.load-15m {
    background: var(--el-color-success);
  }
}

.legend-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.load-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.load-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.load-progress {
  flex: 1;
  height: 4px;
  background: var(--el-color-info-light-8);
  border-radius: 2px;
  overflow: hidden;
}

.load-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}

.load-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: 'SF Mono', monospace;
  min-width: 40px;
  text-align: right;
}

/* Load bar colors */
.load-bar:nth-child(1) .load-progress-fill {
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
}

.load-bar:nth-child(2) .load-progress-fill {
  background: linear-gradient(90deg, var(--el-color-info), var(--el-color-info-light-3));
}

.load-bar:nth-child(3) .load-progress-fill {
  background: linear-gradient(90deg, var(--el-color-success), var(--el-color-success-light-3));
}

/* Metrics grid - minimalistyczny */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 12px 0;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background: var(--el-color-info-light-9);
  transition: all 0.3s ease;
  
  &:hover {
    background: var(--el-color-info-light-8);
    transform: translateY(-1px);
  }
}

.metric-icon {
  padding: 6px;
  border-radius: 6px;
  background: var(--el-bg-color);
  
  .el-icon {
    font-size: 12px;
    color: var(--el-color-primary);
  }
}

.metric-info {
  flex: 1;
}

.metric-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: 'SF Mono', monospace;
}

/* Stopka - minimalistyczna */
.widget-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.update-time {
  display: flex;
  justify-content: flex-end;
}

.update-text {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', monospace;
}

/* Animacje */
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Dark mode optimizations */
:deep(.el-card) {
  .dark & {
    background: var(--el-bg-color);
    
    .metric-item {
      background: var(--el-color-info-dark-9);
      
      &:hover {
        background: var(--el-color-info-dark-8);
      }
    }
    
    .progress-track {
      background: var(--el-color-info-dark-8);
    }
    
    .cores-badge {
      background: var(--el-color-info-dark-8);
    }
    
    .status-indicator {
      &.success {
        background: var(--el-color-success-dark-9);
      }
      
      &.warning {
        background: var(--el-color-warning-dark-9);
      }
      
      &.error {
        background: var(--el-color-danger-dark-9);
      }
    }
  }
}

/* Responsywność */
@media (max-width: 768px) {
  .cpu-widget {
    :deep(.el-card__body) {
      padding: 10px 12px;
      gap: 14px;
    }
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .load-legend {
    gap: 8px;
  }
}
</style>
