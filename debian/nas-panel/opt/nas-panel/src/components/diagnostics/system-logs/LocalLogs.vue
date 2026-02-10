<template>
  <div class="local-logs-container" :class="{ 'dark': isDark }">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>
          <el-icon><Icon icon="mdi:file-document-multiple-outline" /></el-icon>
          {{ $t('systemLogs.localLogs') }}
        </h1>
        <p class="subtitle">Monitorowanie logów systemowych</p>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button 
            @click="toggleTheme"
            :icon="themeIcon"
            circle
            size="large"
            class="theme-toggle"
          />
          <el-button 
            type="primary"
            @click="loadLogs"
            :loading="loading"
            size="large"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            Odśwież
          </el-button>
          <el-button 
            :type="autoTail ? 'warning' : 'default'"
            @click="toggleAutoTail"
            size="large"
          >
            <el-icon>
              <Icon :icon="autoTail ? 'mdi:pause' : 'mdi:play'" />
            </el-icon>
            {{ autoTail ? 'Pauza' : 'Auto' }}
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left Panel - Controls -->
      <el-card class="controls-panel">
        <!-- Log Selection -->
        <div class="control-section">
          <h3><el-icon><Icon icon="mdi:file-document" /></el-icon> Plik logu</h3>
          <el-select
            v-model="selectedLog"
            placeholder="Wybierz plik..."
            class="log-select"
            filterable
            size="large"
            @change="handleLogChange"
          >
            <el-option-group
              v-for="group in logGroups"
              :key="group.label"
              :label="group.label"
            >
              <el-option
                v-for="log in group.logs"
                :key="log.key"
                :label="log.name"
                :value="log"
              >
                <div class="log-option">
                  <span class="log-name">{{ log.name }}</span>
                  <el-tag size="small" :type="getLogType(log.key)">
                    {{ formatFileSize(log.size) }}
                  </el-tag>
                </div>
              </el-option>
            </el-option-group>
            
            <!-- Jeśli brak logów -->
            <el-option v-if="availableLogs.length === 0" disabled>
              <div class="no-logs-option">
                <el-icon><Icon icon="mdi:alert-circle" /></el-icon>
                <span>Brak dostępnych plików logów</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- Filters -->
        <div class="control-section">
          <h3><el-icon><Icon icon="mdi:filter" /></el-icon> Filtry</h3>
          
          <div class="filter-group">
            <div class="filter-item">
              <label>Poziom:</label>
              <el-select
                v-model="logLevel"
                placeholder="Wszystkie"
                clearable
                class="level-select"
              >
                <el-option label="Wszystkie" value="all" />
                <el-option value="error">
                  <span class="level-option error">
                    <el-icon><Icon icon="mdi:alert-circle" /></el-icon>
                    Błędy
                  </span>
                </el-option>
                <el-option value="warning">
                  <span class="level-option warning">
                    <el-icon><Icon icon="mdi:alert" /></el-icon>
                    Ostrzeżenia
                  </span>
                </el-option>
                <el-option value="info">
                  <span class="level-option info">
                    <el-icon><Icon icon="mdi:information" /></el-icon>
                    Informacje
                  </span>
                </el-option>
              </el-select>
            </div>
            
            <div class="filter-item">
              <label>Wyszukiwanie:</label>
              <el-input
                v-model="searchQuery"
                placeholder="Szukaj..."
                clearable
                class="search-input"
              >
                <template #prefix>
                  <el-icon><Icon icon="mdi:magnify" /></el-icon>
                </template>
              </el-input>
            </div>
          </div>
        </div>

        <!-- Display Settings -->
        <div class="control-section">
          <h3><el-icon><Icon icon="mdi:cog" /></el-icon> Wyświetlanie</h3>
          
          <div class="settings-group">
            <div class="setting-item">
              <label>Liczba linii:</label>
              <el-input-number
                v-model="linesToShow"
                :min="50"
                :max="5000"
                :step="50"
                controls-position="right"
                class="lines-input"
              />
            </div>
            
            <div class="setting-item">
              <el-checkbox v-model="wrapLines" label="Zawijaj linie" />
              <el-checkbox v-model="showLineNumbers" label="Numery linii" />
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div class="control-section">
          <h3><el-icon><Icon icon="mdi:chart-box" /></el-icon> Statystyki</h3>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">Wszystkie</div>
              <div class="stat-value">{{ totalLines }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Błędy</div>
              <div class="stat-value error">{{ errorCount }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Ostrzeżenia</div>
              <div class="stat-value warning">{{ warningCount }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Filtrowane</div>
              <div class="stat-value info">{{ filteredLines.length }}</div>
            </div>
          </div>
        </div>
        
        <!-- Debug Info (można ukryć) -->
        <div class="control-section debug-section" v-if="debugMode">
          <h3><el-icon><Icon icon="mdi:bug" /></el-icon> Debug</h3>
          <div class="debug-info">
            <p><strong>Wybrany log:</strong> {{ selectedLog.key || 'brak' }}</p>
            <p><strong>Ścieżka:</strong> {{ selectedLog.path || 'brak' }}</p>
            <p><strong>Dostępne:</strong> {{ availableLogs.length }} plików</p>
            <p><strong>Grupy:</strong> {{ logGroups.length }}</p>
          </div>
          <el-button size="small" @click="testApi" :loading="testingApi">
            Test API
          </el-button>
        </div>
      </el-card>

      <!-- Right Panel - Log Viewer -->
      <div class="viewer-panel">
        <el-card class="log-viewer">
          <!-- Viewer Header -->
          <div class="viewer-header">
            <div class="file-info">
              <h2>
                <el-icon>
                  <Icon :icon="getLogIcon(selectedLog?.key || '')" />
                </el-icon>
                {{ selectedLog?.name || 'Wybierz plik' }}
                <el-tag v-if="selectedLog?.key" size="small" class="key-tag">
                  {{ selectedLog.key }}
                </el-tag>
                <el-tag v-if="selectedLog?.size" size="small" class="size-tag">
                  {{ formatFileSize(selectedLog.size) }}
                </el-tag>
              </h2>
              <div class="file-meta">
                <el-tag v-if="totalLines > 0" size="small" type="info">
                  {{ totalLines }} linii
                </el-tag>
                <el-tag v-if="filteredLines.length !== totalLines && totalLines > 0" size="small" type="warning">
                  {{ filteredLines.length }} widocznych
                </el-tag>
                <el-tag v-if="errorCount > 0" size="small" type="danger">
                  {{ errorCount }} błędów
                </el-tag>
              </div>
            </div>
            
            <div class="viewer-actions">
              <el-button-group>
                <el-button 
                  size="small"
                  @click="scrollToTop"
                  :disabled="!filteredLines.length"
                >
                  <el-icon><Icon icon="mdi:arrow-up" /></el-icon>
                  Góra
                </el-button>
                <el-button 
                  size="small"
                  @click="scrollToBottom"
                  :disabled="!filteredLines.length"
                >
                  <el-icon><Icon icon="mdi:arrow-down" /></el-icon>
                  Dół
                </el-button>
                <el-button 
                  size="small"
                  @click="clearLogs"
                  :disabled="!logContent"
                >
                  <el-icon><Icon icon="mdi:eraser" /></el-icon>
                  Wyczyść
                </el-button>
                <el-dropdown @command="handleExport" size="small">
                  <el-button type="success">
                    <el-icon><Icon icon="mdi:export" /></el-icon>
                    Eksportuj
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="txt">TXT</el-dropdown-item>
                      <el-dropdown-item command="csv">CSV</el-dropdown-item>
                      <el-dropdown-item command="json">JSON</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </el-button-group>
            </div>
          </div>

          <!-- Log Content -->
          <div class="viewer-content">
            <div 
              v-if="loading" 
              class="loading-state"
            >
              <el-icon class="loading-icon" :size="48">
                <Icon icon="mdi:loading" />
              </el-icon>
              <p>Ładowanie logów...</p>
            </div>
            
            <div 
              v-else-if="!selectedLog.key" 
              class="empty-state"
            >
              <el-icon :size="64">
                <Icon icon="mdi:file-search-outline" />
              </el-icon>
              <h3>Wybierz plik logu</h3>
              <p>Wybierz plik z lewego panelu aby wyświetlić logi</p>
            </div>
            
            <div 
              v-else-if="!filteredLines.length" 
              class="empty-state"
            >
              <el-icon :size="64">
                <Icon icon="mdi:filter-off" />
              </el-icon>
              <h3>Brak wyników</h3>
              <p v-if="searchQuery || logLevel !== 'all'">
                Spróbuj zmienić filtry lub wyszukiwanie
              </p>
              <p v-else>Plik logu jest pusty lub nie można go odczytać</p>
            </div>
            
            <div 
              v-else 
              class="log-content"
              ref="logContentRef"
              :class="{ 'wrap-lines': wrapLines }"
            >
              <div 
                v-for="(line, index) in filteredLines" 
                :key="index"
                :class="[
                  'log-line',
                  { 'line-numbered': showLineNumbers },
                  getLineLevelClass(line)
                ]"
                @dblclick="copyLine(line)"
              >
                <div v-if="showLineNumbers" class="line-number">
                  {{ index + 1 }}
                </div>
                <div class="line-text">
                  <span 
                    v-for="(part, partIndex) in highlightLine(line)" 
                    :key="partIndex"
                    :class="[
                      'line-part',
                      { 'highlighted': part.highlight }
                    ]"
                  >
                    {{ part.text }}
                  </span>
                </div>
                <div class="line-actions">
                  <el-tooltip content="Kopiuj linię">
                    <el-button 
                      size="small" 
                      circle 
                      @click="copyLine(line)"
                      class="copy-button"
                    >
                      <el-icon><Icon icon="mdi:content-copy" /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>

          <!-- Viewer Footer -->
          <div class="viewer-footer">
            <div class="footer-info">
              <div class="info-item" v-if="lastRefreshTime">
                <el-icon><Icon icon="mdi:clock-outline" /></el-icon>
                <span>Ostatnie odświeżenie: {{ lastRefreshTime }}</span>
              </div>
              <div class="info-item" v-if="autoTail">
                <el-icon><Icon icon="mdi:sync" /></el-icon>
                <span>Auto-tail aktywny</span>
              </div>
              <div class="info-item" v-if="selectedLog.path">
                <el-icon><Icon icon="mdi:folder" /></el-icon>
                <span class="path-text">{{ selectedLog.path }}</span>
              </div>
            </div>
            
            <div class="footer-pagination" v-if="filteredLines.length > pageSize">
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :total="filteredLines.length"
                :page-sizes="[100, 250, 500, 1000]"
                layout="total, sizes, prev, pager, next"
                small
                background
              />
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Critical Alerts -->
    <div v-if="criticalAlerts.length > 0" class="alerts-container">
      <el-alert
        v-for="alert in criticalAlerts"
        :key="alert.id"
        :title="alert.title"
        :type="alert.type"
        :closable="true"
        show-icon
        @close="removeAlert(alert.id)"
        class="critical-alert"
      >
        {{ alert.message }}
      </el-alert>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElNotification } from 'element-plus'

// Theme
const isDark = ref(false)
const themeIcon = computed(() => 
  isDark.value ? 'mdi:weather-sunny' : 'mdi:weather-night'
)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

// State
const loading = ref(false)
const availableLogs = ref([]) // płaska lista
const logGroups = ref([])     // grupowane logi
const selectedLog = ref({})
const logContent = ref('')
const searchQuery = ref('')
const linesToShow = ref(200)
const logLevel = ref('all')
const autoTail = ref(false)
const autoTailInterval = ref(null)
const logContentRef = ref(null)
const wrapLines = ref(true)
const showLineNumbers = ref(true)
const currentPage = ref(1)
const pageSize = ref(100)
const lastRefreshTime = ref('')
const criticalAlerts = ref([])
const debugMode = ref(false) // ustaw na true dla debugowania
const testingApi = ref(false)

// Computed
const totalLines = computed(() => {
  return logContent.value ? logContent.value.split('\n').filter(line => line.trim()).length : 0
})

const logLines = computed(() => {
  return logContent.value ? logContent.value.split('\n').filter(line => line.trim()) : []
})

const groupedLogs = computed(() => {
  // Używamy logGroups z API
  return logGroups.value;
})

const errorCount = computed(() => {
  if (!logContent.value) return 0
  return logLines.value.filter(line => 
    line.toLowerCase().includes('error') || 
    line.toLowerCase().includes('err:') ||
    line.includes('[error]') ||
    line.includes('[ERROR]') ||
    line.includes('ERROR')
  ).length
})

const warningCount = computed(() => {
  if (!logContent.value) return 0
  return logLines.value.filter(line => 
    line.toLowerCase().includes('warn') || 
    line.toLowerCase().includes('warning') ||
    line.includes('[warn]') ||
    line.includes('[WARNING]') ||
    line.includes('WARNING')
  ).length
})

const filteredLines = computed(() => {
  if (!logContent.value) return []
  
  let lines = [...logLines.value]
  
  // Filtrowanie po poziomie
  if (logLevel.value !== 'all') {
    const levelPatterns = {
      'error': /(error|err:|\[error\]|\[ERROR\]|ERROR)/i,
      'warning': /(warn|warning|\[warn\]|\[WARNING\]|WARNING)/i,
      'info': /(info|\[info\]|\[INFO\]|INFO|notice)/i
    }
    
    const pattern = levelPatterns[logLevel.value]
    if (pattern) {
      lines = lines.filter(line => pattern.test(line))
    }
  }
  
  // Filtrowanie po wyszukiwaniu
  if (searchQuery.value) {
    const searchLower = searchQuery.value.toLowerCase()
    lines = lines.filter(line => line.toLowerCase().includes(searchLower))
  }
  
  // Paginacja
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  
  return lines.slice(-linesToShow.value).slice(start, end)
})

// Methods
const loadAvailableLogs = async () => {
  try {
    loading.value = true;
    console.log('Ładowanie dostępnych logów...');
    
    const response = await axios.get('/api/diagnostics/system-logs');
    console.log('Odpowiedź API system-logs:', response.data);
    
    if (response.data.success) {
      // Używamy logGroups z API
      logGroups.value = response.data.logGroups || [];
      
      // Płaska lista dla kompatybilności
      availableLogs.value = response.data.logs || [];
      
      console.log('Załadowane grupy:', logGroups.value);
      console.log('Załadowane logi:', availableLogs.value);
      
      // Automatycznie wybierz pierwszy dostępny log
      if (availableLogs.value.length > 0 && !selectedLog.value.key) {
        selectedLog.value = availableLogs.value[0];
        console.log('Auto-wybrano:', selectedLog.value);
        await loadLogs();
      } else if (availableLogs.value.length === 0) {
        console.warn('API nie zwróciło żadnych plików logów');
        ElMessage.warning({
          message: 'Brak dostępnych plików logów. Sprawdź czy pliki istnieją.',
          duration: 5000
        });
      }
    } else {
      throw new Error(response.data.error || 'Invalid API response');
    }
  } catch (error) {
    console.error('Błąd ładowania dostępnych logów:', error);
    
    // Szczegółowe logowanie błędu
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    // Fallback: ręczna lista TYLKO podstawowych plików
    availableLogs.value = [
      { key: 'syslog', name: 'System Log', path: '/var/log/syslog', size: 0, group: 'system' },
      { key: 'auth', name: 'Authentication', path: '/var/log/auth.log', size: 0, group: 'system' },
      { key: 'nas-panel-error', name: 'NAS Panel Error', path: '/var/nas-panel/error.log', size: 0, group: 'nas-panel' },
      { key: 'nas-panel-info', name: 'NAS Panel Info', path: '/var/nas-panel/info.log', size: 0, group: 'nas-panel' }
    ];
    
    logGroups.value = [
      {
        label: 'Systemowe',
        logs: availableLogs.value.filter(log => log.group === 'system')
      },
      {
        label: 'NAS Panel',
        logs: availableLogs.value.filter(log => log.group === 'nas-panel')
      }
    ].filter(group => group.logs.length > 0);
    
    ElMessage.error({
      message: `Błąd ładowania listy logów: ${error.message}. Używam domyślnej listy.`,
      duration: 5000
    });
    
    // Auto-wybierz pierwszy
    if (availableLogs.value.length > 0 && !selectedLog.value.key) {
      selectedLog.value = availableLogs.value[0];
      await loadLogs();
    }
  } finally {
    loading.value = false;
  }
}

const handleLogChange = () => {
  if (selectedLog.value?.key) {
    console.log('Zmieniono log na:', selectedLog.value);
    currentPage.value = 1;
    loadLogs();
  }
}

const loadLogs = async () => {
  if (!selectedLog.value?.key) {
    console.log('Nie wybrano pliku logu');
    return;
  }
  
  console.log('Ładowanie logu:', selectedLog.value);
  
  loading.value = true;
  try {
    const response = await axios.get(
      `/api/diagnostics/system-logs/${selectedLog.value.key}`,
      {
        params: { 
          lines: linesToShow.value
        }
      }
    );
    
    console.log('Odpowiedź API (log):', response.data);
    
    if (response.data.success) {
      // Obsługa odpowiedzi
      if (response.data.lines) {
        logContent.value = response.data.lines
          .map(line => line.raw || line.message || '')
          .filter(line => line.trim())
          .join('\n');
      } else if (response.data.raw) {
        logContent.value = response.data.raw;
      } else {
        logContent.value = 'Brak danych w odpowiedzi API';
      }
      
      lastRefreshTime.value = new Date().toLocaleTimeString('pl-PL');
      
      if (autoTail.value) {
        scrollToBottom();
      }
      
      ElMessage.success(`Załadowano: ${selectedLog.value.name} (${response.data.totalLines} linii)`);
      
    } else {
      throw new Error(response.data.error || 'API returned error');
    }
    
  } catch (error) {
    console.error('Błąd ładowania logów:', error);
    
    // Szczegółowe logowanie błędu
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
      
      logContent.value = `BŁĄD ${error.response.status}: ${error.response.data?.error || 'Unknown error'}\n\nSzczegóły: ${JSON.stringify(error.response.data, null, 2)}`;
    } else if (error.request) {
      console.error('Request:', error.request);
      logContent.value = `BŁĄD: Brak odpowiedzi z serwera. Czy API jest uruchomione?`;
    } else {
      console.error('Error message:', error.message);
      logContent.value = `BŁĄD: ${error.message}`;
    }
    
    ElMessage.error({
      message: `Błąd ładowania logów: ${error.message}`,
      duration: 5000
    });
  } finally {
    loading.value = false;
  }
}

const clearLogs = () => {
  logContent.value = ''
  currentPage.value = 1
  ElMessage.success('Logi wyczyszczone')
}

const toggleAutoTail = () => {
  autoTail.value = !autoTail.value
  
  if (autoTail.value) {
    startAutoTail()
  } else {
    stopAutoTail()
  }
}

const startAutoTail = () => {
  stopAutoTail()
  autoTailInterval.value = setInterval(loadLogs, 2000)
  ElMessage.info('Auto-tail włączony')
}

const stopAutoTail = () => {
  if (autoTailInterval.value) {
    clearInterval(autoTailInterval.value)
    autoTailInterval.value = null
  }
}

const getLogIcon = (key) => {
  const keyLower = (key || '').toLowerCase();
  
  // TYLKO nasze pliki
  if (keyLower.includes('syslog') || keyLower.includes('auth') || 
      keyLower.includes('kern') || keyLower.includes('daemon') || 
      keyLower.includes('user') || keyLower.includes('docker')) {
    return 'mdi:server';
  }
  if (keyLower.includes('nas-panel')) {
    return 'mdi:application';
  }
  if (keyLower.includes('nas-web') || keyLower.includes('nas-wen')) {
    return 'mdi:web';
  }
  return 'mdi:file-document';
}

const getLogType = (key) => {
  const keyLower = (key || '').toLowerCase()
  if (keyLower.includes('error') || keyLower.includes('fail')) return 'danger'
  if (keyLower.includes('warn') || keyLower.includes('warning')) return 'warning'
  if (keyLower.includes('access')) return 'success'
  if (keyLower.includes('info') || keyLower.includes('debug')) return 'info'
  return ''
}

const formatLogName = (key) => {
  const names = {
    'syslog': 'System Log',
    'auth': 'Authentication',
    'kern': 'Kernel',
    'daemon': 'Daemon',
    'user': 'User',
    'docker': 'Docker',
    'info': 'Info',
    'debug': 'Debug',
    'warn': 'Warning',
    'access': 'Access',
    'error': 'Error',
    'nas-panel-info': 'NAS Panel Info',
    'nas-panel-debug': 'NAS Panel Debug',
    'nas-panel-warn': 'NAS Panel Warning',
    'nas-panel-access': 'NAS Panel Access',
    'nas-panel-error': 'NAS Panel Error',
    'nas-web-error': 'NAS Web Error',
    'nas-wen-output': 'NAS Wen Output'
  }
  
  return names[key] || key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getLineLevelClass = (line) => {
  const lineLower = line.toLowerCase()
  if (lineLower.includes('error') || lineLower.includes('err:')) return 'line-error'
  if (lineLower.includes('warn')) return 'line-warning'
  if (lineLower.includes('info')) return 'line-info'
  if (lineLower.includes('debug')) return 'line-debug'
  return ''
}

const highlightLine = (line) => {
  if (!searchQuery.value) {
    return [{ text: line, highlight: false }]
  }
  
  const searchLower = searchQuery.value.toLowerCase()
  const lineLower = line.toLowerCase()
  const index = lineLower.indexOf(searchLower)
  
  if (index === -1) {
    return [{ text: line, highlight: false }]
  }
  
  return [
    {
      text: line.substring(0, index),
      highlight: false
    },
    {
      text: line.substring(index, index + searchQuery.value.length),
      highlight: true
    },
    {
      text: line.substring(index + searchQuery.value.length),
      highlight: false
    }
  ]
}

const showAlert = (alert) => {
  ElNotification({
    title: alert.title,
    message: alert.message,
    type: alert.type,
    duration: 5000
  })
}

const removeAlert = (id) => {
  criticalAlerts.value = criticalAlerts.value.filter(alert => alert.id !== id)
}

const copyLine = async (line) => {
  try {
    await navigator.clipboard.writeText(line)
    ElMessage.success('Linia skopiowana do schowka')
  } catch (err) {
    console.error('Błąd kopiowania:', err)
    ElMessage.error('Błąd kopiowania do schowka')
  }
}

const scrollToTop = () => {
  if (logContentRef.value) {
    logContentRef.value.scrollTop = 0
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight
    }
  })
}

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleExport = async (format) => {
  try {
    const response = await axios.post('/api/diagnostics/export-logs', {
      logs: logLines.value.map(line => ({ raw: line })),
      filename: selectedLog.value.name || 'logs',
      format: format
    }, {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${selectedLog.value.name || 'logs'}-${new Date().toISOString().split('T')[0]}.${format}`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    ElMessage.success(`Logi wyeksportowane jako ${format.toUpperCase()}`)
  } catch (error) {
    console.error('Błąd eksportu:', error)
    ElMessage.error('Błąd podczas eksportowania logów')
  }
}

const testApi = async () => {
  testingApi.value = true;
  try {
    const response = await axios.get('/api/diagnostics/debug-logs-config');
    console.log('Debug API Response:', response.data);
    ElNotification({
      title: 'Debug Info',
      message: `API działa. Znaleziono ${response.data.currentConfig.totalFiles} plików.`,
      type: 'success',
      duration: 5000
    });
  } catch (error) {
    console.error('Debug API Error:', error);
    ElNotification({
      title: 'Debug Error',
      message: error.message,
      type: 'error',
      duration: 5000
    });
  } finally {
    testingApi.value = false;
  }
}

// Watchers
watch(autoTail, (newVal) => {
  if (newVal) {
    loadLogs()
  }
})

watch([searchQuery, logLevel], () => {
  currentPage.value = 1
})

// Lifecycle
onMounted(async () => {
  console.log('LocalLogs component mounted');
  await loadAvailableLogs();
  
  // Ustaw początkowy czas odświeżenia
  lastRefreshTime.value = new Date().toLocaleTimeString('pl-PL');
})

onUnmounted(() => {
  stopAutoTail()
})
</script>

<style scoped>
.local-logs-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

.local-logs-container.dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Header Styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.dark .subtitle {
  color: #a0a0a0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  margin-right: 8px;
}

/* Main Content Layout */
.main-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  min-height: calc(100vh - 120px);
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

/* Controls Panel */
.controls-panel {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
}

.dark .controls-panel {
  background: #2d2d2d;
  border-color: #404040;
}

.control-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dark .control-section {
  border-bottom-color: #404040;
}

.control-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.control-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-select {
  width: 100%;
}

.log-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.log-name {
  font-weight: 500;
}

.no-logs-option {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-warning);
  padding: 8px 0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.dark .filter-item label {
  color: #a0a0a0;
}

.level-select,
.search-input {
  width: 100%;
}

.level-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-option.error {
  color: var(--el-color-error);
}

.level-option.warning {
  color: var(--el-color-warning);
}

.level-option.info {
  color: var(--el-color-info);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lines-input {
  width: 100%;
}

.setting-item :deep(.el-checkbox) {
  margin-right: 16px;
}

/* Statistics */
.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  text-align: center;
}

.dark .stat-item {
  background: #3d3d3d;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.dark .stat-label {
  color: #a0a0a0;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stat-value.error {
  color: var(--el-color-error);
}

.stat-value.warning {
  color: var(--el-color-warning);
}

.stat-value.info {
  color: var(--el-color-info);
}

/* Debug Section */
.debug-section {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 16px;
}

.dark .debug-section {
  background: rgba(255, 255, 255, 0.05);
}

.debug-info p {
  margin: 4px 0;
  font-size: 12px;
  font-family: monospace;
}

.path-text {
  font-family: monospace;
  font-size: 11px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Viewer Panel */
.viewer-panel {
  min-height: 600px;
}

.log-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
}

.dark .log-viewer {
  background: #2d2d2d;
  border-color: #404040;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-wrap: wrap;
  gap: 16px;
}

.dark .viewer-header {
  border-bottom-color: #404040;
}

.file-info h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.key-tag {
  margin-left: 8px;
  font-family: monospace;
  font-size: 10px;
}

.size-tag {
  margin-left: 8px;
}

.file-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.viewer-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Viewer Content */
.viewer-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 20px;
  height: 100%;
  text-align: center;
}

.loading-icon {
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: var(--el-text-color-primary);
}

.empty-state p {
  color: var(--el-text-color-secondary);
  margin: 0;
}

.dark .empty-state p {
  color: #a0a0a0;
}

.log-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.log-content.wrap-lines {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.log-line {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
  transition: background-color 0.2s;
  align-items: flex-start;
  cursor: default;
}

.log-line:hover {
  background: var(--el-fill-color-light);
}

.dark .log-line:hover {
  background: #3d3d3d;
}

.log-line.line-numbered {
  grid-template-columns: 60px 1fr auto;
}

.log-line.line-error {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--el-color-error);
}

.dark .log-line.line-error {
  background: rgba(239, 68, 68, 0.15);
}

.log-line.line-warning {
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid var(--el-color-warning);
}

.dark .log-line.line-warning {
  background: rgba(245, 158, 11, 0.15);
}

.log-line.line-info {
  background: rgba(59, 130, 246, 0.05);
  border-left: 3px solid var(--el-color-info);
}

.dark .log-line.line-info {
  background: rgba(59, 130, 246, 0.1);
}

.log-line.line-debug {
  background: rgba(139, 92, 246, 0.05);
  border-left: 3px solid #8b5cf6;
}

.dark .log-line.line-debug {
  background: rgba(139, 92, 246, 0.1);
}

.line-number {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: right;
  user-select: none;
  padding-top: 2px;
}

.dark .line-number {
  color: #666;
}

.line-text {
  color: var(--el-text-color-primary);
  white-space: pre;
  font-family: inherit;
}

.dark .line-text {
  color: #e0e0e0;
}

.line-part.highlighted {
  background-color: var(--el-color-warning-light-9);
  padding: 2px 4px;
  border-radius: 2px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
}

.dark .line-part.highlighted {
  background-color: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.line-actions {
  opacity: 0;
  transition: opacity 0.2s;
}

.log-line:hover .line-actions {
  opacity: 1;
}

.copy-button {
  width: 28px;
  height: 28px;
  font-size: 14px;
}

/* Viewer Footer */
.viewer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  flex-wrap: wrap;
  gap: 16px;
}

.dark .viewer-footer {
  background: #3d3d3d;
  border-top-color: #404040;
}

.footer-info {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dark .info-item {
  color: #a0a0a0;
}

.footer-pagination {
  display: flex;
  align-items: center;
}

/* Alerts */
.alerts-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-width: calc(100vw - 40px);
  z-index: 1000;
}

.critical-alert {
  margin-bottom: 12px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Custom Scrollbar */
.log-content::-webkit-scrollbar {
  width: 10px;
}

.log-content::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.dark .log-content::-webkit-scrollbar-track {
  background: #3d3d3d;
}

.log-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.dark .log-content::-webkit-scrollbar-thumb {
  background: #555;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

.dark .log-content::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Responsive */
@media (max-width: 768px) {
  .local-logs-container {
    padding: 16px;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: flex-start;
  }
  
  .viewer-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .viewer-actions {
    justify-content: flex-end;
  }
  
  .alerts-container {
    width: calc(100vw - 32px);
    right: 16px;
    bottom: 16px;
  }
}

@media (max-width: 480px) {
  .main-content {
    gap: 16px;
  }
  
  .controls-panel {
    padding: 16px;
  }
  
  .stats {
    grid-template-columns: 1fr;
  }
  
  .footer-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
