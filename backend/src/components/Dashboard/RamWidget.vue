<template>
  <el-card class="ram-widget" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:memory" />
        <span>RAM</span>
        <span class="status-badge" :class="getStatusClass(actualUsage)">
          {{ actualUsage }}%
        </span>
        <div class="header-actions">
          <el-tooltip content="Różne metryki użycia" placement="top">
            <el-button 
              size="small" 
              text 
              @click="showUsageMetrics"
            >
              <Icon icon="mdi:calculator" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="Szczegóły pamięci" placement="top">
            <el-button 
              size="small" 
              text 
              @click="showDetailedDialog"
            >
              <Icon icon="mdi:information-outline" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="widget-content">
      <!-- Sekcja informacyjna o różnych metrykach -->
      <div class="usage-info" v-if="showUsageExplanation">
        <div class="info-row">
          <Icon icon="mdi:information" class="info-icon" />
          <span class="info-text">
            Linux używa wolnej pamięci jako cache. Prawdziwe użycie wynosi <strong>{{ actualUsage }}%</strong>.
          </span>
        </div>
      </div>

      <!-- Pasek progresu z dwoma wskaźnikami -->
      <div class="usage-progress">
        <div class="progress-labels-top">
          <span>Użycie rzeczywiste: {{ actualUsage }}%</span>
          <span>Z cache: {{ withCacheUsage }}%</span>
        </div>
        
        <div class="progress-bar">
          <!-- Rzeczywiste użycie (część kolorowa) -->
          <div 
            class="progress-fill actual" 
            :style="{ width: `${actualUsage}%` }"
            :class="getStatusClass(actualUsage)"
          ></div>
          
          <!-- Cache (część półprzezroczysta) -->
          <div 
            class="progress-fill cached" 
            :style="{ 
              width: `${Math.max(0, withCacheUsage - actualUsage)}%`,
              left: `${actualUsage}%`
            }"
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
          <span class="stat-label">
            <el-tooltip content="Pamięć faktycznie używana przez aplikacje">
              <span style="border-bottom: 1px dotted #ccc">Rzeczywiste użycie:</span>
            </el-tooltip>
          </span>
          <span class="stat-value">{{ formatBytes(actualUsed) }}</span>
          <span class="stat-percentage">{{ actualUsage }}%</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">
            <el-tooltip content="Pamięć wykorzystana jako cache systemowy">
              <span style="border-bottom: 1px dotted #ccc">Cache:</span>
            </el-tooltip>
          </span>
          <span class="stat-value">{{ formatBytes(ramData.raw?.cached || 0) }}</span>
          <span class="stat-percentage">{{ cachePercentage }}%</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">
            <el-tooltip content="Pamięć gotowa do natychmiastowego użycia">
              <span style="border-bottom: 1px dotted #ccc">Dostępna:</span>
            </el-tooltip>
          </span>
          <span class="stat-value">{{ formatBytes(ramData.raw?.available || 0) }}</span>
          <span class="stat-percentage">{{ availablePercentage }}%</span>
        </div>
        
        <div class="stat-row">
          <span class="stat-label">Całkowita:</span>
          <span class="stat-value">{{ formatBytes(ramData.raw?.total || 0) }}</span>
          <span class="stat-percentage">100%</span>
        </div>
      </div>

      <!-- Visual breakdown -->
      <div class="breakdown-section">
        <div class="breakdown-title">
          <span>Podział pamięci:</span>
          <span class="breakdown-total">{{ formatBytes(ramData.raw?.total || 0) }}</span>
        </div>
        
        <div class="breakdown-visual">
          <!-- Użyta przez aplikacje -->
          <div 
            class="breakdown-segment actual-segment"
            :style="{ flex: actualUsed / ramTotal }"
            :class="getStatusClass(actualUsage)"
          >
            <div class="segment-tooltip">
              Aplikacje: {{ formatBytes(actualUsed) }} ({{ actualUsage }}%)
            </div>
          </div>
          
          <!-- Cache -->
          <div 
            class="breakdown-segment cache-segment"
            :style="{ flex: (ramData.raw?.cached || 0) / ramTotal }"
          >
            <div class="segment-tooltip">
              Cache: {{ formatBytes(ramData.raw?.cached || 0) }} ({{ cachePercentage }}%)
            </div>
          </div>
          
          <!-- Buffers -->
          <div 
            class="breakdown-segment buffers-segment"
            :style="{ flex: (ramData.raw?.buffers || 0) / ramTotal }"
          >
            <div class="segment-tooltip">
              Buffers: {{ formatBytes(ramData.raw?.buffers || 0) }} ({{ buffersPercentage }}%)
            </div>
          </div>
          
          <!-- Wolna -->
          <div 
            class="breakdown-segment free-segment"
            :style="{ flex: (ramData.raw?.free || 0) / ramTotal }"
          >
            <div class="segment-tooltip">
              Wolna: {{ formatBytes(ramData.raw?.free || 0) }} ({{ freePercentage }}%)
            </div>
          </div>
        </div>
        
        <div class="breakdown-legend">
          <div class="legend-item">
            <span class="legend-color actual-color"></span>
            <span>Aplikacje</span>
          </div>
          <div class="legend-item">
            <span class="legend-color cache-color"></span>
            <span>Cache</span>
          </div>
          <div class="legend-item">
            <span class="legend-color buffers-color"></span>
            <span>Buffers</span>
          </div>
          <div class="legend-item">
            <span class="legend-color free-color"></span>
            <span>Wolna</span>
          </div>
        </div>
      </div>

      <!-- Memory pressure -->
      <div class="pressure-section" v-if="ramData.pressure">
        <div class="pressure-header">
          <Icon icon="mdi:gauge" />
          <span>Memory Pressure</span>
          <span class="pressure-value" :class="getPressureClass(ramData.pressure.some)">
            {{ ramData.pressure.some.toFixed(2) }}
          </span>
        </div>
        <div class="pressure-info">
          <small>avg10: some:{{ ramData.pressure.some.toFixed(2) }} full:{{ ramData.pressure.full.toFixed(2) }}</small>
        </div>
      </div>
    </div>

    <!-- Dialog z różnymi metrykami użycia -->
    <el-dialog
      v-model="usageMetricsVisible"
      title="Różne metryki użycia pamięci"
      width="500px"
    >
      <div class="metrics-content">
        <div class="metrics-explanation">
          <p><strong>Jak Linux zarządza pamięcią:</strong></p>
          <ul>
            <li><strong>Cache</strong> - dane z dysku przechowywane w RAM dla szybkiego dostępu</li>
            <li><strong>Buffers</strong> - dane oczekujące na zapis na dysk</li>
            <li><strong>Available</strong> - pamięć gotowa do natychmiastowego użycia</li>
          </ul>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-title">Tradycyjne użycie</div>
            <div class="metric-value">{{ traditionalUsage }}%</div>
            <div class="metric-desc">(total - free) / total</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-title">Rzeczywiste użycie</div>
            <div class="metric-value">{{ actualUsage }}%</div>
            <div class="metric-desc">(total - available) / total</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-title">Użycie z cache</div>
            <div class="metric-value">{{ withCacheUsage }}%</div>
            <div class="metric-desc">used / total</div>
          </div>
        </div>
        
        <div class="memory-breakdown">
          <h4>Szczegółowy podział:</h4>
          <div class="breakdown-list">
            <div class="breakdown-item">
              <span class="item-label">Pamięć całkowita:</span>
              <span class="item-value">{{ formatBytes(ramTotal) }}</span>
            </div>
            <div class="breakdown-item">
              <span class="item-label">Użyta przez aplikacje:</span>
              <span class="item-value">{{ formatBytes(actualUsed) }} ({{ actualUsage }}%)</span>
            </div>
            <div class="breakdown-item">
              <span class="item-label">Cache:</span>
              <span class="item-value">{{ formatBytes(ramData.raw?.cached || 0) }} ({{ cachePercentage }}%)</span>
            </div>
            <div class="breakdown-item">
              <span class="item-label">Buffers:</span>
              <span class="item-value">{{ formatBytes(ramData.raw?.buffers || 0) }} ({{ buffersPercentage }}%)</span>
            </div>
            <div class="breakdown-item">
              <span class="item-label">Dostępna:</span>
              <span class="item-value">{{ formatBytes(ramData.raw?.available || 0) }} ({{ availablePercentage }}%)</span>
            </div>
            <div class="breakdown-item">
              <span class="item-label">Wolna:</span>
              <span class="item-value">{{ formatBytes(ramData.raw?.free || 0) }} ({{ freePercentage }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- Dialog ze szczegółowymi informacjami -->
    <el-dialog
      v-model="detailedDialogVisible"
      title="Szczegółowe informacje o pamięci"
      width="700px"
    >
      <div v-if="detailedData" class="detailed-content">
        <!-- Pozostała część tego dialogu bez zmian -->
        <!-- ... -->
      </div>
    </el-dialog>
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
import { ElDialog, ElTooltip, ElButton } from 'element-plus'

const ramData = ref({})
const detailedData = ref(null)
const usageMetricsVisible = ref(false)
const detailedDialogVisible = ref(false)
const showUsageExplanation = ref(true) // Pokazuj wyjaśnienie dla nowych użytkowników

// Obliczenia na podstawie danych z API
const ramTotal = computed(() => ramData.value.raw?.total || 0)

// RZECZYWISTE używanie - najważniejsza metryka (Linux way)
const actualUsed = computed(() => {
  if (ramTotal.value === 0) return 0
  return ramTotal.value - (ramData.value.raw?.available || 0)
})

const actualUsage = computed(() => {
  if (ramTotal.value === 0) return 0
  return Math.round((actualUsed.value / ramTotal.value) * 100)
})

// Tradycyjne użycie (jak w większości monitorów - może wprowadzać w błąd)
const traditionalUsage = computed(() => {
  if (ramTotal.value === 0) return 0
  const free = ramData.value.raw?.free || 0
  return Math.round(((ramTotal.value - free) / ramTotal.value) * 100)
})

// Użycie z cache (najbardziej pesymistyczne)
const withCacheUsage = computed(() => {
  if (ramTotal.value === 0) return 0
  const used = ramData.value.raw?.used || 0
  return Math.round((used / ramTotal.value) * 100)
})

// Procentowe wartości poszczególnych komponentów
const cachePercentage = computed(() => {
  if (ramTotal.value === 0) return 0
  return Math.round(((ramData.value.raw?.cached || 0) / ramTotal.value) * 100)
})

const buffersPercentage = computed(() => {
  if (ramTotal.value === 0) return 0
  return Math.round(((ramData.value.raw?.buffers || 0) / ramTotal.value) * 100)
})

const availablePercentage = computed(() => {
  if (ramTotal.value === 0) return 0
  return Math.round(((ramData.value.raw?.available || 0) / ramTotal.value) * 100)
})

const freePercentage = computed(() => {
  if (ramTotal.value === 0) return 0
  return Math.round(((ramData.value.raw?.free || 0) / ramTotal.value) * 100)
})

const getStatusClass = (percent) => {
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'warning'
  return 'normal'
}

const getPressureClass = (pressure) => {
  if (pressure >= 0.8) return 'critical'
  if (pressure >= 0.5) return 'warning'
  return 'normal'
}

const formatBytes = (bytes) => {
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

const fetchRamData = async () => {
  try {
    const response = await axios.get('/api/ram')
    ramData.value = response.data
    
    // Ukryj wyjaśnienie po kilku odświeżeniach
    setTimeout(() => {
      showUsageExplanation.value = false
    }, 15000)
    
  } catch (err) {
    console.error('Błąd RAM:', err)
    // Fallback data z poprawnymi metrykami
    ramData.value = {
      raw: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: 10 * 1024 * 1024 * 1024,  // 10GB "używane" (w tym cache)
        free: 6 * 1024 * 1024 * 1024,   // 6GB wolne
        available: 13 * 1024 * 1024 * 1024, // 13GB dostępne
        buffers: 256 * 1024 * 1024,     // 256MB
        cached: 6.5 * 1024 * 1024 * 1024, // 6.5GB cache
      },
      percentages: {
        used: 63,
        free: 38,
        cached: 41,
        buffers: 2,
        available: 81
      },
      usage: {
        traditional: 63,  // (16-6)/16 = 63%
        actual: 19,       // (16-13)/16 = 19%
        withCache: 63     // 10/16 = 63%
      },
      pressure: {
        some: 0.05,
        full: 0.01
      }
    }
  }
}

const fetchDetailedData = async () => {
  try {
    const response = await axios.get('/api/ram/detailed')
    detailedData.value = response.data
  } catch (err) {
    console.error('Błąd szczegółowych danych RAM:', err)
  }
}

const showUsageMetrics = () => {
  usageMetricsVisible.value = true
}

const showDetailedDialog = async () => {
  detailedDialogVisible.value = true
  if (!detailedData.value) {
    await fetchDetailedData()
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

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
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

/* Info o różnych metrykach */
.usage-info {
  background: var(--el-color-info-light-9);
  border-radius: 4px;
  padding: 6px 8px;
  border-left: 3px solid var(--el-color-info);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.info-icon {
  color: var(--el-color-info);
  font-size: 14px;
  margin-top: 1px;
  flex-shrink: 0;
}

.info-text {
  font-size: 11px;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

/* Pasek progresu z podwójnym wskaźnikiem */
.usage-progress {
  margin-top: 4px;
}

.progress-labels-top {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.progress-bar {
  height: 8px;
  background: var(--el-color-info-light-8);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
  position: relative;
}

.progress-fill {
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  transition: width 0.3s ease;
}

.progress-fill.actual {
  border-radius: 4px 0 0 4px;
  z-index: 2;
}

.progress-fill.actual.normal {
  background: var(--el-color-success);
}

.progress-fill.actual.warning {
  background: var(--el-color-warning);
}

.progress-fill.actual.critical {
  background: var(--el-color-error);
}

.progress-fill.cached {
  background: rgba(32, 128, 240, 0.3);
  z-index: 1;
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
  cursor: help;
}

.stat-value {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: monospace;
  min-width: 70px;
  text-align: right;
}

.stat-percentage {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  min-width: 35px;
  text-align: right;
  font-family: monospace;
}

/* Wizualny podział pamięci */
.breakdown-section {
  margin-top: 8px;
}

.breakdown-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.breakdown-total {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: monospace;
}

.breakdown-visual {
  display: flex;
  height: 16px;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
  position: relative;
}

.breakdown-segment {
  position: relative;
  transition: flex 0.3s ease;
}

.breakdown-segment:hover .segment-tooltip {
  display: block;
}

.segment-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  white-space: nowrap;
  z-index: 10;
  margin-bottom: 4px;
}

.segment-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

.actual-segment.normal {
  background: var(--el-color-success);
}

.actual-segment.warning {
  background: var(--el-color-warning);
}

.actual-segment.critical {
  background: var(--el-color-error);
}

.cache-segment {
  background: var(--el-color-info);
}

.buffers-segment {
  background: var(--el-color-primary-light-3);
}

.free-segment {
  background: var(--el-color-info-light-5);
}

.breakdown-legend {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.actual-color {
  background: var(--el-color-success);
}

.cache-color {
  background: var(--el-color-info);
}

.buffers-color {
  background: var(--el-color-primary-light-3);
}

.free-color {
  background: var(--el-color-info-light-5);
}

/* Memory pressure */
.pressure-section {
  padding: 8px;
  background: var(--el-color-info-light-9);
  border-radius: 4px;
  border-left: 3px solid var(--el-color-info);
}

.pressure-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 2px;
}

.pressure-header .iconify {
  font-size: 12px;
  color: var(--el-color-info);
}

.pressure-value {
  margin-left: auto;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
}

.pressure-value.normal {
  color: var(--el-color-success);
}

.pressure-value.warning {
  color: var(--el-color-warning);
}

.pressure-value.critical {
  color: var(--el-color-error);
}

.pressure-info {
  font-size: 9px;
  color: var(--el-text-color-secondary);
}

/* Dialog z metrykami */
.metrics-content {
  max-height: 60vh;
  overflow-y: auto;
}

.metrics-explanation {
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
  border-left: 4px solid var(--el-color-info);
}

.metrics-explanation p {
  margin: 0 0 8px 0;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.metrics-explanation ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.metrics-explanation li {
  margin-bottom: 4px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.metric-card {
  background: var(--el-color-info-light-9);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border: 1px solid var(--el-border-color-lighter);
  transition: transform 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-title {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
  font-family: monospace;
  margin-bottom: 4px;
}

.metric-desc {
  font-size: 9px;
  color: var(--el-text-color-placeholder);
  line-height: 1.2;
}

.memory-breakdown {
  margin-top: 20px;
}

.memory-breakdown h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.breakdown-list {
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  padding: 12px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.breakdown-item:last-child {
  border-bottom: none;
}

.item-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.item-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: monospace;
  text-align: right;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .breakdown-legend {
    justify-content: flex-start;
  }
}
</style>
