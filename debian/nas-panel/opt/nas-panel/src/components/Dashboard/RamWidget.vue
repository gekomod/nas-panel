<template>
  <div>
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
              <Icon icon="mdi:memory" width="16" />
            </div>
            <span class="header-title">RAM</span>
            <div class="update-time">
              <Icon icon="mdi:update" width="12" />
              <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
            </div>
          </div>
          <div class="header-sub">
            <span class="hostname" :class="getStatusClass(actualUsage)">{{ actualUsage }}% użycia</span>
            <span class="system">{{ formatBytes(ramTotal) }} całkowitej</span>
          </div>
        </div>
      </template>

      <!-- Zawartość widgetu -->
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
            <span class="stat-value">{{ formatBytes(ramTotal) }}</span>
            <span class="stat-percentage">100%</span>
          </div>
        </div>

        <!-- Visual breakdown -->
        <div class="breakdown-section">
          <div class="breakdown-title">
            <span>Podział pamięci:</span>
            <span class="breakdown-total">{{ formatBytes(ramTotal) }}</span>
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
            <Icon icon="mdi:gauge" width="12" />
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

      <!-- Akcje w footerze -->
      <div class="widget-footer">
        <el-button 
          size="small" 
          text 
          @click="showUsageMetrics"
          class="footer-btn"
        >
          <Icon icon="mdi:calculator" width="12" />
          <span>Metryki</span>
        </el-button>
        <el-button 
          size="small" 
          text 
          @click="showDetailedDialog"
          class="footer-btn"
        >
          <Icon icon="mdi:information-outline" width="12" />
          <span>Szczegóły</span>
        </el-button>
    <el-button 
      size="small" 
      text 
      @click="clearRamCache"
      class="footer-btn"
      :loading="clearingCache"
    >
      <Icon icon="mdi:delete-sweep" width="12" />
      <span>Czyść cache</span>
    </el-button>
      </div>
    </el-card>

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

    <el-dialog
      v-model="detailedDialogVisible"
      title="Szczegółowe informacje o pamięci"
      width="700px"
    >
      <div v-if="detailedData" class="detailed-content">
        <!-- Szczegóły pamięci -->
        <div class="detailed-section">
          <h4>Detale pamięci:</h4>
          <pre>{{ JSON.stringify(detailedData, null, 2) }}</pre>
        </div>
      </div>
      <div v-else class="loading-details">
        <el-icon class="is-loading">
          <Loading />
        </el-icon>
        <span>Ładowanie szczegółowych danych...</span>
      </div>
    </el-dialog>
    
  <el-dialog
    v-model="confirmDialogVisible"
    title="Czyszczenie cache pamięci RAM"
    width="400px"
  >
    <div class="confirm-content">
      <p>Czy na pewno chcesz wyczyścić cache pamięci RAM?</p>
      <div class="cache-details">
        <p>Aktualny cache: <strong>{{ formatBytes(ramData.raw?.cached || 0) }}</strong></p>
        <p>Buffers: <strong>{{ formatBytes(ramData.raw?.buffers || 0) }}</strong></p>
      </div>
      <el-alert
        v-if="warningMessage"
        :title="warningMessage"
        type="warning"
        :closable="false"
        show-icon
        class="warning-alert"
      />
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="confirmDialogVisible = false">
          Anuluj
        </el-button>
        <el-button 
          type="primary" 
          @click="executeClearCache"
          :loading="clearingCache"
        >
          Potwierdź
        </el-button>
      </span>
    </template>
  </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'RamWidget',
  displayName: 'RAM'
}
</script>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElDialog, ElTooltip, ElButton, ElAlert, ElIcon } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useNotifications } from '@/services/NotificationService'

const { t } = useI18n()
const { addNotification } = useNotifications()

const ramData = ref({})
const detailedData = ref(null)
const usageMetricsVisible = ref(false)
const detailedDialogVisible = ref(false)
const showUsageExplanation = ref(true)
const lastUpdate = ref(t('common.loading'))
const loading = ref(true)
let intervalId = null

const clearCacheDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const warningMessage = ref('')
const clearingCache = ref(false)
const isRootUser = ref(false)
const clearOptions = ref({
  sync: true,
  safeMode: false
})

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

const showClearCacheDialog = () => {
  clearCacheDialogVisible.value = true
}

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
    loading.value = true
    const response = await axios.get('/api/ram')
    ramData.value = response.data
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    // Ukryj wyjaśnienie po kilku odświeżeniach
    setTimeout(() => {
      showUsageExplanation.value = false
    }, 15000)
    
  } catch (err) {
    console.error('Błąd RAM:', err)
    lastUpdate.value = t('common.error')
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
  } finally {
    loading.value = false
  }
}

const fetchDetailedData = async () => {
  try {
    const response = await axios.get('/api/ram/detailed')
    detailedData.value = response.data
  } catch (err) {
    console.error('Błąd szczegółowych danych RAM:', err)
    detailedData.value = null
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

const clearRamCache = () => {
  confirmDialogVisible.value = true
  
  // Sprawdź czy cache jest znaczący
  const cacheSize = ramData.value.raw?.cached || 0
  if (cacheSize < 50 * 1024 * 1024) { // Mniej niż 50MB
    warningMessage.value = 'Cache jest już mały, czyszczenie może nie być potrzebne.'
  } else {
    warningMessage.value = ''
  }
}

const executeClearCache = async () => {
  try {
    clearingCache.value = true
    confirmDialogVisible.value = false
    
    // Zapisz stan przed czyszczeniem
    const cacheBefore = ramData.value.raw?.cached || 0
    const buffersBefore = ramData.value.raw?.buffers || 0
    
    // Wykonaj zapytanie do API
    const response = await axios.post('/api/ram/clear-cache')
    
    if (response.data.success) {
      // Dodaj powiadomienie używając istniejącego serwisu
      const cacheAfter = response.data.ramAfter?.cached || 0
      const buffersAfter = response.data.ramAfter?.buffers || 0
      const freedCache = cacheBefore - cacheAfter
      const freedBuffers = buffersBefore - buffersAfter
      
      addNotification({
        type: 'success',
        title: 'Cache RAM wyczyszczony',
        message: `Zwolniono ${formatBytes(freedCache)} cache i ${formatBytes(freedBuffers)} buffers`,
        details: response.data.message,
        autoClose: true,
        timeout: 5000
      })
      
      // Pokazuj również krótkie powiadomienie element-plus
      ElMessage({
        message: `Cache wyczyszczony! Zwolniono ${formatBytes(freedCache)}`,
        type: 'success',
        duration: 3000
      })
      
      // Odśwież dane RAM
      await fetchRamData()
      
    } else {
      throw new Error(response.data.error || 'Nieznany błąd')
    }
    
  } catch (error) {
    console.error('Błąd czyszczenia cache:', error)
    
    // Dodaj powiadomienie o błędzie
    addNotification({
      type: 'error',
      title: 'Błąd czyszczenia cache RAM',
      message: error.response?.data?.details || error.message,
      details: 'Operacja może wymagać uprawnień administratora.',
      autoClose: false
    })
    
    // Spróbuj alternatywną metodę
    try {
      const safeResponse = await axios.post('/api/ram/clear-cache-safe', {
        ramBefore: {
          cached: ramData.value.raw?.cached || 0,
          buffers: ramData.value.raw?.buffers || 0
        }
      })
      
      if (safeResponse.data.success) {
        addNotification({
          type: 'success',
          title: 'Cache RAM wyczyszczony (tryb bezpieczny)',
          message: 'Cache został pomyślnie wyczyszczony',
          autoClose: true,
          timeout: 4000
        })
        
        await fetchRamData()
      }
    } catch (safeError) {
      console.error('Błąd bezpiecznego czyszczenia:', safeError)
    }
    
  } finally {
    clearingCache.value = false
  }
}

onMounted(() => {
  fetchRamData()
  intervalId = setInterval(fetchRamData, 30000)
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
  gap: 12px;
}

/* Info o różnych metrykach */
.usage-info {
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 3px solid var(--el-color-info);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-icon {
  color: var(--el-color-info);
  width: 14px;
  height: 14px;
  margin-top: 1px;
  flex-shrink: 0;
}

.info-text {
  font-size: 12px;
  color: var(--el-text-color-primary);
  line-height: 1.4;
}

/* Pasek progresu z podwójnym wskaźnikiem */
.usage-progress {
  margin-top: 4px;
}

.progress-labels-top {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.progress-bar {
  height: 8px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
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
  background: var(--el-color-danger);
}

.progress-fill.cached {
  background: rgba(var(--el-color-info-rgb), 0.4);
  z-index: 1;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

/* Statystyki główne */
.main-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  gap: 8px;
}

.stat-label {
  color: var(--el-text-color-regular);
  cursor: help;
  flex: 1;
}

.stat-value {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  min-width: 80px;
  text-align: right;
}

.stat-percentage {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  min-width: 40px;
  text-align: right;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
}

/* Wizualny podział pamięci */
.breakdown-section {
  margin-top: 8px;
}

.breakdown-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.breakdown-total {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
}

.breakdown-visual {
  display: flex;
  height: 16px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
}

.breakdown-segment {
  position: relative;
  transition: flex 0.3s ease;
  
  &:hover .segment-tooltip {
    display: block;
  }
}

.segment-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  margin-bottom: 6px;
  backdrop-filter: blur(4px);
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
  }
}

.actual-segment.normal {
  background: var(--el-color-success);
}

.actual-segment.warning {
  background: var(--el-color-warning);
}

.actual-segment.critical {
  background: var(--el-color-danger);
}

.cache-segment {
  background: var(--el-color-info);
}

.buffers-segment {
  background: var(--el-color-primary-light-3);
}

.free-segment {
  background: color-mix(in srgb, var(--el-text-color-secondary) 20%, transparent);
}

.breakdown-legend {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.actual-color.normal {
  background: var(--el-color-success);
}

.actual-color.warning {
  background: var(--el-color-warning);
}

.actual-color.critical {
  background: var(--el-color-danger);
}

.cache-color {
  background: var(--el-color-info);
}

.buffers-color {
  background: var(--el-color-primary-light-3);
}

.free-color {
  background: color-mix(in srgb, var(--el-text-color-secondary) 20%, transparent);
}

/* Memory pressure */
.pressure-section {
  padding: 10px 12px;
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-radius: 8px;
  border-left: 4px solid var(--el-color-info);
}

.pressure-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.pressure-header .iconify {
  color: var(--el-color-info);
}

.pressure-value {
  margin-left: auto;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 13px;
  font-weight: 600;
  
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

.pressure-info {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
}

/* Footer z przyciskami */
.widget-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  
  &:hover {
    color: var(--el-color-primary);
  }
}

/* Dialog styles (rendered outside widget) */
.metrics-content {
  max-height: 60vh;
  overflow-y: auto;
}

.metrics-explanation {
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  border-left: 4px solid var(--el-color-info);
}

.metrics-explanation p {
  margin: 0 0 10px 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.metrics-explanation ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.metrics-explanation li {
  margin-bottom: 6px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: rgba(var(--el-color-info-rgb), 0.08);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    background: rgba(var(--el-color-primary-rgb), 0.05);
  }
}

.metric-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  margin-bottom: 6px;
}

.metric-desc {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  line-height: 1.3;
}

.memory-breakdown {
  margin-top: 20px;
  
  h4 {
    margin: 0 0 12px 0;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    padding-bottom: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  }
}

.breakdown-list {
  background: rgba(var(--el-color-info-rgb), 0.05);
  border-radius: 8px;
  padding: 16px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
  
  &:last-child {
    border-bottom: none;
  }
}

.item-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.item-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  text-align: right;
}

.loading-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--el-text-color-secondary);
}

.clear-cache-content {
  padding: 10px 0;
}

.warning-section {
  margin-bottom: 20px;
}

.info-section {
  margin-bottom: 20px;
  
  p {
    margin: 10px 0;
    color: var(--el-text-color-primary);
    font-size: 14px;
  }
}

.cache-list {
  margin: 10px 0 10px 20px;
  padding: 0;
  
  li {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    
    strong {
      color: var(--el-text-color-primary);
    }
  }
}

.current-cache {
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 15px;
  
  p {
    margin: 5px 0;
    font-size: 13px;
  }
}

.cache-options {
  margin-top: 20px;
  
  .el-checkbox {
    display: block;
    margin-bottom: 10px;
  }
}

.confirm-content {
  padding: 10px 0;
  
  p {
    margin: 10px 0;
    color: var(--el-text-color-primary);
    font-size: 14px;
  }
}

.cache-details {
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-radius: 8px;
  padding: 12px;
  margin: 15px 0;
  
  p {
    margin: 5px 0;
    font-size: 13px;
    
    strong {
      color: var(--el-color-primary);
      font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
    }
  }
}

.warning-alert {
  margin-top: 15px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.footer-btn {
  &:deep(.el-icon) {
    transition: transform 0.3s ease;
  }
  
  &:hover:deep(.el-icon) {
    transform: rotate(15deg);
  }
  
  &.is-loading {
    opacity: 0.7;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
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
  
  .progress-labels-top {
    font-size: 10px;
  }
  
  .stat-row {
    font-size: 11px;
  }
  
  .stat-value, .stat-percentage {
    font-size: 10px;
    min-width: 70px;
  }
  
  .breakdown-title {
    font-size: 11px;
  }
  
  .legend-item {
    font-size: 10px;
  }
  
  .pressure-header {
    font-size: 11px;
  }
  
  .pressure-info {
    font-size: 9px;
  }
  
  .footer-btn {
    font-size: 10px;
  }
}
</style>
