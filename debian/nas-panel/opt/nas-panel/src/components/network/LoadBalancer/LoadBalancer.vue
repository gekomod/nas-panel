<template>
  <div class="load-balancer-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:server-network" />
          </div>
          <div class="header-text">
            <h1>Równoważenie obciążenia</h1>
            <p class="subtitle">Zarządzaj rozkładem obciążenia między serwerami</p>
          </div>
        </div>
        <div class="header-actions">
          <el-tag 
            :type="overallStatus === 'operational' ? 'success' : overallStatus === 'degraded' ? 'warning' : 'danger'"
            size="large"
            class="status-tag"
          >
            <Icon :icon="overallStatus === 'operational' ? 'mdi:check-circle' : 'mdi:alert-circle'" />
            {{ overallStatusText }}
          </el-tag>
          <el-button-group>
            <el-button 
              type="primary" 
              @click="applyLoadBalancing"
              :disabled="applying || !serversReady"
              :loading="applying"
            >
              <Icon :icon="applying ? 'mdi:loading' : 'mdi:check'" />
              {{ applying ? 'Stosowanie...' : 'Zastosuj konfigurację' }}
            </el-button>
            <el-button 
              type="success" 
              @click="testLoadBalancing"
              :disabled="testing || !serversReady"
              :loading="testing"
            >
              <Icon :icon="testing ? 'mdi:loading' : 'mdi:play'" />
              {{ testing ? 'Testowanie...' : 'Testuj konfigurację' }}
            </el-button>
            <el-button 
              type="info" 
              @click="refreshAll"
              :loading="refreshing"
            >
              <Icon :icon="refreshing ? 'mdi:loading' : 'mdi:refresh'" />
              Odśwież
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Stats Overview -->
    <div class="stats-overview">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <Icon icon="mdi:server" class="stat-icon" />
          <div class="stat-info">
            <div class="stat-value">{{ totalServers }}</div>
            <div class="stat-label">Aktywnych serwerów</div>
            <div class="stat-sub">
              <el-tag size="small" type="success">{{ healthyServers }} zdrowych</el-tag>
              <el-tag v-if="totalServers - healthyServers > 0" size="small" type="warning">{{ totalServers - healthyServers }} z problemami</el-tag>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <Icon icon="mdi:chart-line" class="stat-icon" />
          <div class="stat-info">
            <div class="stat-value">{{ totalRequests.toLocaleString() }}/min</div>
            <div class="stat-label">Żądań na minutę</div>
            <div class="stat-trend">
              <Icon 
                :icon="statsTrends.requestTrend > 0 ? 'mdi:arrow-up' : 'mdi:arrow-down'" 
                :class="statsTrends.requestTrend > 0 ? 'trend-up' : 'trend-down'"
              />
              <span>{{ Math.abs(statsTrends.requestTrend) }}%</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <Icon icon="mdi:timer-outline" class="stat-icon" />
          <div class="stat-info">
            <div class="stat-value">{{ avgResponseTime }}ms</div>
            <div class="stat-label">Średni czas odpowiedzi</div>
            <div class="stat-trend">
              <Icon 
                :icon="statsTrends.responseTrend < 0 ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                :class="statsTrends.responseTrend < 0 ? 'trend-up' : 'trend-down'"
              />
              <span>{{ Math.abs(statsTrends.responseTrend) }}%</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <Icon icon="mdi:alert-circle" class="stat-icon" />
          <div class="stat-info">
            <div class="stat-value">{{ errorRate.toFixed(2) }}%</div>
            <div class="stat-label">Wskaźnik błędów</div>
            <div class="stat-trend">
              <Icon 
                :icon="statsTrends.errorTrend < 0 ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                :class="statsTrends.errorTrend < 0 ? 'trend-up' : 'trend-down'"
              />
              <span>{{ Math.abs(statsTrends.errorTrend) }}%</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Main Content -->
    <div class="load-balancer-content">
      <!-- Servers Configuration Card -->
      <el-card class="servers-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:server" />
              Konfiguracja serwerów
            </h2>
            <div class="card-header-actions">
              <el-button 
                type="primary" 
                @click="addServer"
                :disabled="servers.length >= 10"
              >
                <Icon icon="mdi:plus" />
                Dodaj serwer
              </el-button>
            </div>
          </div>
        </template>

        <div class="servers-list">
          <div 
            v-for="(server, index) in servers" 
            :key="server.id"
            class="server-item"
            :class="`status-${server.status}`"
          >
            <div class="server-header">
              <div class="server-title">
                <h3>
                  <Icon :icon="getServerStatusIcon(server.status)" />
                  {{ server.name || `Serwer ${index + 1}` }}
                  <el-tag 
                    v-if="server.status !== 'healthy'" 
                    :type="server.status === 'degraded' ? 'warning' : 'danger'"
                    size="small"
                    class="status-tag-inline"
                  >
                    {{ getStatusText(server.status) }}
                  </el-tag>
                </h3>
                <div class="server-address">
                  <Icon icon="mdi:ip-network" />
                  {{ server.ip }}:{{ server.port }}
                  <span class="server-protocol">{{ server.protocol?.toUpperCase() }}</span>
                </div>
              </div>
              <div class="server-actions">
                <el-button 
                  size="small" 
                  circle 
                  @click="editServer(index)"
                  :disabled="server.status === 'down'"
                >
                  <Icon icon="mdi:pencil" />
                </el-button>
                <el-button 
                  size="small" 
                  circle 
                  @click="checkServerHealth(index)"
                  :loading="server.healthCheckLoading"
                >
                  <Icon icon="mdi:heart-pulse" />
                </el-button>
                <el-button 
                  size="small" 
                  type="danger" 
                  circle 
                  @click="removeServer(index)"
                  :disabled="servers.length <= 2"
                >
                  <Icon icon="mdi:delete" />
                </el-button>
              </div>
            </div>
            
            <div class="server-config">
              <div class="config-grid">
                <div class="config-item">
                  <label>Waga:</label>
                  <span class="config-value">{{ server.weight }}%</span>
                </div>
                <div class="config-item">
                  <label>Max połączeń:</label>
                  <span class="config-value">{{ server.maxConnections?.toLocaleString() || '1000' }}</span>
                </div>
                <div class="config-item">
                  <label>Timeout:</label>
                  <span class="config-value">{{ server.timeout }}ms</span>
                </div>
                <div class="config-item">
                  <label>Ostatnie sprawdzenie:</label>
                  <span class="config-value">{{ formatTime(server.lastChecked) }}</span>
                </div>
              </div>
              
              <div class="weight-control">
                <label>Rozkład obciążenia:</label>
                <div class="weight-slider-container">
                  <el-slider
                    v-model="server.weight"
                    :min="1"
                    :max="100"
                    :step="1"
                    show-stops
                    show-input
                    :disabled="server.status === 'down'"
                    @change="updateWeights(index)"
                  />
                  <el-tooltip content="Automatyczne równoważenie wag" placement="top">
                    <el-button 
                      size="small" 
                      circle 
                      @click="autoBalanceWeights"
                    >
                      <Icon icon="mdi:scale-balance" />
                    </el-button>
                  </el-tooltip>
                </div>
              </div>
            </div>
            
            <div class="server-stats">
              <div class="stats-grid">
                <div class="stat-item">
                  <Icon icon="mdi:chart-line" class="stat-icon" />
                  <div class="stat-info">
                    <div class="stat-value">{{ server.requestsPerMinute?.toLocaleString() || 0 }}</div>
                    <div class="stat-label">Żądań/min</div>
                  </div>
                </div>
                <div class="stat-item">
                  <Icon icon="mdi:timer-outline" class="stat-icon" />
                  <div class="stat-info">
                    <div class="stat-value">{{ server.responseTime || 0 }}ms</div>
                    <div class="stat-label">Czas odpowiedzi</div>
                  </div>
                </div>
                <div class="stat-item">
                  <Icon icon="mdi:memory" class="stat-icon" />
                  <div class="stat-info">
                    <div class="stat-value">{{ server.cpuUsage || 0 }}%</div>
                    <div class="stat-label">CPU</div>
                  </div>
                </div>
                <div class="stat-item">
                  <Icon icon="mdi:memory" class="stat-icon" />
                  <div class="stat-info">
                    <div class="stat-value">{{ server.memoryUsage || 0 }}%</div>
                    <div class="stat-label">RAM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="total-weight-info">
          <el-alert 
            :title="`Suma wag: ${totalWeight}%`" 
            :type="totalWeight === 100 ? 'success' : 'warning'"
            :closable="false"
            show-icon
          >
            <template #default>
              <span v-if="totalWeight === 100">
                Konfiguracja poprawna. Obciążenie będzie rozłożone zgodnie z wagami.
              </span>
              <span v-else>
                Suma wag musi wynosić 100%. Aktualnie: {{ totalWeight }}%
                <el-button type="text" @click="autoBalanceWeights">Automatycznie równoważ</el-button>
              </span>
            </template>
          </el-alert>
        </div>
      </el-card>

      <!-- Load Balancing Algorithm Card -->
      <el-card class="algorithm-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:algorithm" />
              Algorytm równoważenia
            </h2>
            <div class="card-header-actions">
              <el-switch
                v-model="algorithm.enabled"
                active-text="Włączony"
                inactive-text="Wyłączony"
                @change="toggleLoadBalancer"
              />
            </div>
          </div>
        </template>

        <div class="algorithm-config">
          <el-form :model="algorithm" label-width="200px">
            <el-form-item label="Typ algorytmu">
              <el-radio-group v-model="algorithm.type" :disabled="!algorithm.enabled">
                <el-radio label="round-robin">
                  <div class="algorithm-option">
                    <Icon icon="mdi:refresh" class="option-icon" />
                    <div class="option-text">
                      <div class="option-title">Round Robin</div>
                      <div class="option-desc">Równomierne przełączanie między serwerami</div>
                    </div>
                  </div>
                </el-radio>
                <el-radio label="weighted">
                  <div class="algorithm-option">
                    <Icon icon="mdi:scale-balance" class="option-icon" />
                    <div class="option-text">
                      <div class="option-title">Waży (Weighted)</div>
                      <div class="option-desc">Rozkład proporcjonalny do wagi serwerów</div>
                    </div>
                  </div>
                </el-radio>
                <el-radio label="least-connections">
                  <div class="algorithm-option">
                    <Icon icon="mdi:connection" class="option-icon" />
                    <div class="option-text">
                      <div class="option-title">Najmniej połączeń</div>
                      <div class="option-desc">Kierowanie do serwera z najmniejszą liczbą połączeń</div>
                    </div>
                  </div>
                </el-radio>
                <el-radio label="ip-hash">
                  <div class="algorithm-option">
                    <Icon icon="mdi:fingerprint" class="option-icon" />
                    <div class="option-text">
                      <div class="option-title">Hash IP</div>
                      <div class="option-desc">Klient zawsze trafia do tego samego serwera</div>
                    </div>
                  </div>
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="Sprawdzanie zdrowia">
              <el-switch v-model="algorithm.healthCheck" :disabled="!algorithm.enabled" />
              <span class="hint">Automatycznie wykrywaj i omijaj uszkodzone serwery</span>
            </el-form-item>

            <template v-if="algorithm.healthCheck">
              <el-form-item label="Interwał sprawdzania">
                <el-select v-model="algorithm.healthCheckInterval" style="width: 200px" :disabled="!algorithm.enabled">
                  <el-option label="Co 10 sekund" value="10s" />
                  <el-option label="Co 30 sekund" value="30s" />
                  <el-option label="Co 1 minutę" value="1m" />
                  <el-option label="Co 5 minut" value="5m" />
                </el-select>
              </el-form-item>

              <el-form-item label="Próg awarii">
                <el-slider
                  v-model="algorithm.failThreshold"
                  :min="1"
                  :max="10"
                  :step="1"
                  show-stops
                  show-input
                  :disabled="!algorithm.enabled"
                />
                <span class="hint">{{ algorithm.failThreshold }} nieudanych prób z rzędu oznacza awarię</span>
              </el-form-item>
            </template>

            <el-form-item label="Sticky sessions">
              <el-switch v-model="algorithm.stickySessions" :disabled="!algorithm.enabled" />
              <span class="hint">Zachowaj sesję użytkownika na tym samym serwerze</span>
            </el-form-item>

            <template v-if="algorithm.stickySessions">
              <el-form-item label="Czas trwania sesji">
                <el-input-number
                  v-model="algorithm.sessionTimeout"
                  :min="1"
                  :max="120"
                  :step="1"
                  controls-position="right"
                  :disabled="!algorithm.enabled"
                />
                <span class="hint">minut</span>
              </el-form-item>
            </template>
          </el-form>
        </div>
      </el-card>

      <!-- Statistics Card -->
      <el-card class="statistics-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:chart-bar" />
              Statystyki i monitoring
            </h2>
            <div class="card-header-actions">
              <el-button 
                type="info" 
                @click="refreshStats"
                :loading="refreshing"
              >
                <Icon :icon="refreshing ? 'mdi:loading' : 'mdi:refresh'" />
                Odśwież
              </el-button>
              <el-button 
                type="default" 
                @click="showLogsDialog = true"
              >
                <Icon icon="mdi:text-box-outline" />
                Pokaż logi
              </el-button>
            </div>
          </div>
        </template>

        <div class="statistics-content">
          <!-- Traffic Distribution Chart -->
          <div class="chart-container">
            <h3>Rozkład ruchu</h3>
            <div class="traffic-chart">
              <div 
                v-for="server in servers" 
                :key="server.id"
                class="traffic-bar"
                :style="{
                  width: `${server.weight}%`,
                  backgroundColor: getServerColor(server)
                }"
                :title="`${server.name || server.ip}: ${server.weight}%`"
              >
                <span class="bar-label">{{ server.weight }}%</span>
              </div>
            </div>
            <div class="traffic-legend">
              <div 
                v-for="server in servers" 
                :key="server.id"
                class="legend-item"
              >
                <span 
                  class="legend-color" 
                  :style="{ backgroundColor: getServerColor(server) }"
                />
                <span class="legend-text">{{ server.name || server.ip }}</span>
                <span class="legend-value">{{ server.weight }}%</span>
                <el-tag 
                  size="small"
                  :type="server.status === 'healthy' ? 'success' : server.status === 'degraded' ? 'warning' : 'danger'"
                >
                  {{ getStatusText(server.status) }}
                </el-tag>
              </div>
            </div>
          </div>

          <!-- Server Status Timeline -->
          <div class="timeline-container">
            <h3>Historia statusów</h3>
            <div class="timeline">
              <div 
                v-for="event in statusHistory" 
                :key="event.id"
                class="timeline-event"
                :class="`status-${event.status || 'info'}`"
              >
                <div class="event-time">{{ formatTime(event.timestamp) }}</div>
                <div class="event-details">
                  <Icon :icon="getStatusIcon(event.status || 'info')" class="event-icon" />
                  <span class="event-text">{{ event.message }}</span>
                </div>
                <el-tag 
                  v-if="event.type" 
                  size="small" 
                  :type="getEventTypeColor(event.type)"
                  class="event-type"
                >
                  {{ event.type }}
                </el-tag>
              </div>
              <div v-if="statusHistory.length === 0" class="no-events">
                <Icon icon="mdi:information-outline" />
                <span>Brak historii zdarzeń</span>
              </div>
            </div>
          </div>

          <!-- Test Results -->
          <div v-if="testResults" class="test-results">
            <h3>Ostatni test konfiguracji</h3>
            <div class="results-grid">
              <div 
                v-for="result in testResults.results" 
                :key="result.ip"
                class="result-card"
                :class="`result-${result.status}`"
              >
                <div class="result-header">
                  <Icon :icon="getTestResultIcon(result.status)" />
                  <span class="result-server">{{ result.ip }}:{{ result.port }}</span>
                </div>
                <div class="result-stats">
                  <div class="result-stat">
                    <span class="stat-label">Sukces:</span>
                    <span class="stat-value">{{ result.successRate.toFixed(1) }}%</span>
                  </div>
                  <div class="result-stat">
                    <span class="stat-label">Średni czas:</span>
                    <span class="stat-value">{{ result.avgResponseTime }}ms</span>
                  </div>
                  <div class="result-stat">
                    <span class="stat-label">Testy:</span>
                    <span class="stat-value">{{ result.successful }}/{{ result.successful + result.failed }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="results-summary">
              <el-tag 
                :type="testResults.summary.overallStatus === 'PASS' ? 'success' : 'danger'"
                size="large"
              >
                {{ testResults.summary.overallStatus === 'PASS' ? 'TEST PRZESZŁY' : 'TEST NIEUDANY' }}
              </el-tag>
              <span class="summary-text">
                {{ testResults.summary.serversPassing }}/{{ testResults.summary.totalServers }} serwerów działa poprawnie
              </span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Server Configuration Dialog -->
    <el-dialog
      v-model="showServerDialog"
      :title="editingServerIndex !== null ? 'Edytuj serwer' : 'Dodaj nowy serwer'"
      width="500px"
    >
      <el-form :model="serverForm" label-width="120px" ref="serverFormRef" :rules="serverRules">
        <el-form-item label="Nazwa serwera" prop="name">
          <el-input v-model="serverForm.name" placeholder="np. Serwer produkcyjny 1" />
        </el-form-item>
        
        <el-form-item label="Adres IP" prop="ip" required>
          <el-input v-model="serverForm.ip" placeholder="192.168.1.100">
            <template #append>
              <el-button @click="testServerConnection" :loading="testingConnection">
                <Icon :icon="testingConnection ? 'mdi:loading' : 'mdi:connection'" />
                Testuj
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="Port" prop="port" required>
          <el-input-number
            v-model="serverForm.port"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="Protokół">
          <el-select v-model="serverForm.protocol" style="width: 100%">
            <el-option label="HTTP" value="http" />
            <el-option label="HTTPS" value="https" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Maks. połączeń">
          <el-input-number
            v-model="serverForm.maxConnections"
            :min="1"
            :max="10000"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="Timeout (ms)">
          <el-input-number
            v-model="serverForm.timeout"
            :min="100"
            :max="30000"
            :step="100"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="Waga początkowa">
          <el-slider
            v-model="serverForm.weight"
            :min="1"
            :max="100"
            :step="1"
            show-input
            :disabled="editingServerIndex === null"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showServerDialog = false">Anuluj</el-button>
          <el-button type="primary" @click="saveServer" :loading="savingServer">
            {{ editingServerIndex !== null ? 'Zapisz zmiany' : 'Dodaj serwer' }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Logs Dialog -->
    <el-dialog
      v-model="showLogsDialog"
      title="Logi Load Balancera"
      width="800px"
      top="5vh"
    >
      <div class="logs-container">
        <div class="logs-header">
          <el-input
            v-model="logFilter"
            placeholder="Filtruj logi..."
            clearable
            style="width: 300px"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" />
            </template>
          </el-input>
          <el-select v-model="logTypeFilter" placeholder="Filtruj typ" clearable style="width: 150px">
            <el-option label="INFO" value="INFO" />
            <el-option label="WARNING" value="WARNING" />
            <el-option label="ERROR" value="ERROR" />
            <el-option label="CONFIG" value="CONFIG" />
          </el-select>
          <el-button @click="loadLogs" :loading="loadingLogs">
            <Icon :icon="loadingLogs ? 'mdi:loading' : 'mdi:refresh'" />
            Odśwież
          </el-button>
          <el-button type="danger" @click="clearLogs" :disabled="logs.length === 0">
            <Icon icon="mdi:delete" />
            Wyczyść logi
          </el-button>
        </div>

        <div class="logs-content">
          <div 
            v-for="log in filteredLogs" 
            :key="log.timestamp"
            class="log-entry"
            :class="`log-${log.type?.toLowerCase()}`"
          >
            <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
            <div class="log-type">
              <el-tag :type="getLogTypeColor(log.type)" size="small">
                {{ log.type }}
              </el-tag>
            </div>
            <div class="log-message">{{ log.message }}</div>
            <el-button 
              v-if="log.details" 
              size="small" 
              type="text"
              @click="showLogDetails(log)"
            >
              <Icon icon="mdi:information-outline" />
              Szczegóły
            </el-button>
          </div>
          <div v-if="filteredLogs.length === 0" class="no-logs">
            <Icon icon="mdi:text-box-remove-outline" />
            <span>Brak logów do wyświetlenia</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElNotification, ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

// Stan komponentu
const servers = ref([])
const algorithm = ref({
  enabled: false,
  type: 'weighted',
  healthCheck: true,
  healthCheckInterval: '30s',
  failThreshold: 3,
  stickySessions: true,
  sessionTimeout: 30
})

const applying = ref(false)
const testing = ref(false)
const refreshing = ref(false)
const showServerDialog = ref(false)
const showLogsDialog = ref(false)
const editingServerIndex = ref(null)
const savingServer = ref(false)
const testingConnection = ref(false)
const loadingLogs = ref(false)

const serverForm = ref({
  name: '',
  ip: '',
  port: 8080,
  protocol: 'http',
  maxConnections: 1000,
  timeout: 5000,
  weight: 50
})

const statusHistory = ref([])
const logs = ref([])
const logFilter = ref('')
const logTypeFilter = ref('')
const testResults = ref(null)
const overallStatus = ref('unknown')
const statsTrends = ref({
  requestTrend: 0,
  responseTrend: 0,
  errorTrend: 0
})

// Computed properties
const totalWeight = computed(() => {
  return servers.value.reduce((sum, server) => sum + (server.weight || 0), 0)
})

const serversReady = computed(() => {
  return servers.value.length >= 2 && totalWeight.value === 100 && algorithm.value.enabled
})

const totalServers = computed(() => servers.value.length)
const healthyServers = computed(() => servers.value.filter(s => s.status === 'healthy').length)
const totalRequests = computed(() => servers.value.reduce((sum, s) => sum + (s.requestsPerMinute || 0), 0))
const avgResponseTime = computed(() => {
  const healthyServersList = servers.value.filter(s => s.status === 'healthy' && s.responseTime)
  if (healthyServersList.length === 0) return 0
  return Math.round(healthyServersList.reduce((sum, s) => sum + s.responseTime, 0) / healthyServersList.length)
})
const errorRate = computed(() => {
  if (servers.value.length === 0) return 0
  const errorCount = servers.value.filter(s => s.status !== 'healthy').length
  return (errorCount / servers.value.length) * 100
})

const overallStatusText = computed(() => {
  switch (overallStatus.value) {
    case 'operational': return 'Działa poprawnie'
    case 'degraded': return 'Obniżona wydajność'
    case 'failed': return 'Awaria'
    default: return 'Nieznany'
  }
})

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchesText = !logFilter.value || 
      log.message.toLowerCase().includes(logFilter.value.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(logFilter.value.toLowerCase())
    const matchesType = !logTypeFilter.value || log.type === logTypeFilter.value
    return matchesText && matchesType
  }).slice(0, 100) // Limit to 100 logs
})

// Validation rules
const serverRules = {
  name: [
    { required: true, message: 'Nazwa serwera jest wymagana', trigger: 'blur' }
  ],
  ip: [
    { required: true, message: 'Adres IP jest wymagany', trigger: 'blur' },
    { 
      validator: (rule, value, callback) => {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
        if (!ipRegex.test(value)) {
          callback(new Error('Nieprawidłowy adres IP'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  port: [
    { required: true, message: 'Port jest wymagany', trigger: 'blur' }
  ]
}

// Funkcje pomocnicze
function getStatusText(status) {
  const statuses = {
    'healthy': 'Działa',
    'degraded': 'Obniżona wydajność',
    'down': 'Nie działa',
    'warning': 'Ostrzeżenie',
    'info': 'Informacja'
  }
  return statuses[status] || status
}

function getServerStatusIcon(status) {
  const icons = {
    'healthy': 'mdi:server',
    'degraded': 'mdi:server-network',
    'down': 'mdi:server-off',
    'warning': 'mdi:server-alert',
    'info': 'mdi:server-security'
  }
  return icons[status] || 'mdi:help-circle'
}

function getStatusIcon(status) {
  const icons = {
    'healthy': 'mdi:check-circle',
    'degraded': 'mdi:alert-circle',
    'down': 'mdi:close-circle',
    'warning': 'mdi:alert',
    'info': 'mdi:information'
  }
  return icons[status] || 'mdi:help-circle'
}

function getEventTypeColor(type) {
  const colors = {
    'INFO': 'info',
    'WARNING': 'warning',
    'ERROR': 'danger',
    'CONFIG': 'success',
    'SERVER_ADD': 'success',
    'SERVER_REMOVE': 'danger',
    'SERVER_UPDATE': 'warning'
  }
  return colors[type] || 'default'
}

function getLogTypeColor(type) {
  const colors = {
    'INFO': 'info',
    'WARNING': 'warning',
    'ERROR': 'danger',
    'CONFIG': 'success',
    'TEST': 'primary'
  }
  return colors[type] || 'default'
}

function getTestResultIcon(status) {
  const icons = {
    'excellent': 'mdi:check-circle',
    'good': 'mdi:check',
    'degraded': 'mdi:alert-circle',
    'poor': 'mdi:close-circle'
  }
  return icons[status] || 'mdi:help-circle'
}

function getServerColor(server) {
  const colors = {
    'healthy': '#10b981',
    'degraded': '#f59e0b',
    'down': '#ef4444',
    'warning': '#f59e0b',
    'info': '#3b82f6'
  }
  return colors[server.status] || '#64748b'
}

function formatTime(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Funkcje zarządzania serwerami
function addServer() {
  if (servers.value.length >= 10) {
    ElMessage.warning('Maksymalnie można dodać 10 serwerów')
    return
  }
  
  editingServerIndex.value = null
  serverForm.value = {
    name: `Serwer ${servers.value.length + 1}`,
    ip: '',
    port: 8080,
    protocol: 'http',
    maxConnections: 1000,
    timeout: 5000,
    weight: Math.floor(100 / (servers.value.length + 1))
  }
  showServerDialog.value = true
}

function editServer(index) {
  editingServerIndex.value = index
  const server = servers.value[index]
  serverForm.value = { 
    name: server.name,
    ip: server.ip,
    port: server.port,
    protocol: server.protocol || 'http',
    maxConnections: server.maxConnections || 1000,
    timeout: server.timeout || 5000,
    weight: server.weight
  }
  showServerDialog.value = true
}

async function testServerConnection() {
  if (!serverForm.value.ip || !serverForm.value.port) {
    ElMessage.warning('Podaj adres IP i port serwera')
    return
  }

  testingConnection.value = true
  try {
    const response = await axios.get(`/api/loadbalancer/test-server`, {
      params: {
        ip: serverForm.value.ip,
        port: serverForm.value.port
      }
    })

    if (response.data.success) {
      ElMessage.success('Serwer odpowiada poprawnie')
    } else {
      ElMessage.warning('Serwer nie odpowiada lub zwraca błąd')
    }
  } catch (error) {
    ElMessage.error('Nie udało się połączyć z serwerem')
  } finally {
    testingConnection.value = false
  }
}

async function checkServerHealth(index) {
  const server = servers.value[index]
  server.healthCheckLoading = true
  
  try {
    const response = await axios.get(`/api/loadbalancer/check-health`, {
      params: {
        ip: server.ip,
        port: server.port
      }
    })

    if (response.data.healthy) {
      server.status = 'healthy'
      server.responseTime = response.data.responseTime
      server.lastChecked = new Date().toISOString()
      ElMessage.success('Serwer działa poprawnie')
    } else {
      server.status = 'down'
      ElMessage.warning('Serwer nie odpowiada')
    }
  } catch (error) {
    server.status = 'down'
    ElMessage.error('Błąd podczas sprawdzania zdrowia serwera')
  } finally {
    server.healthCheckLoading = false
  }
}

async function removeServer(index) {
  if (servers.value.length <= 2) {
    ElMessage.warning('Musisz mieć co najmniej 2 serwery dla load balancingu')
    return
  }
  
  const server = servers.value[index]
  
  try {
    const result = await ElMessageBox.confirm(
      `Czy na pewno chcesz usunąć serwer "${server.name || server.ip}"?`,
      'Potwierdzenie usunięcia',
      {
        type: 'warning',
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj',
        distinguishCancelAndClose: true
      }
    )

    if (result === 'confirm') {
      const response = await axios.delete(`/api/loadbalancer/servers/${server.id}`)
      
      if (response.data.success) {
        servers.value.splice(index, 1)
        ElMessage.success('Serwer został usunięty')
        normalizeWeights()
      } else {
        throw new Error(response.data.error)
      }
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('Błąd podczas usuwania serwera: ' + error.message)
    }
  }
}

async function saveServer() {
  try {
    savingServer.value = true
    
    if (!serverForm.value.ip) {
      ElMessage.error('Adres IP jest wymagany')
      return
    }

    if (editingServerIndex.value !== null) {
      // Aktualizuj istniejący serwer
      const response = await axios.put(`/api/loadbalancer/servers/${servers.value[editingServerIndex.value].id}`, serverForm.value)
      
      if (response.data.success) {
        servers.value[editingServerIndex.value] = {
          ...servers.value[editingServerIndex.value],
          ...serverForm.value
        }
        ElMessage.success('Serwer zaktualizowany')
      }
    } else {
      // Dodaj nowy serwer
      const response = await axios.post('/api/loadbalancer/servers', { server: serverForm.value })
      
      if (response.data.success) {
        servers.value.push({
          ...response.data.server,
          status: 'healthy',
          requestsPerMinute: Math.floor(Math.random() * 500) + 500,
          responseTime: Math.floor(Math.random() * 50) + 30,
          cpuUsage: Math.floor(Math.random() * 30) + 40,
          memoryUsage: Math.floor(Math.random() * 30) + 40,
          lastChecked: new Date().toISOString()
        })
        ElMessage.success('Nowy serwer dodany')
        normalizeWeights()
      }
    }
    
    showServerDialog.value = false
  } catch (error) {
    ElMessage.error('Błąd podczas zapisywania serwera: ' + (error.response?.data?.error || error.message))
  } finally {
    savingServer.value = false
  }
}

function updateWeights(changedIndex) {
  // Normalizuj wagi tak żeby suma wynosiła 100%
  const total = servers.value.reduce((sum, server) => sum + server.weight, 0)
  
  if (total !== 100) {
    const difference = total - 100
    const otherServers = servers.value.filter((_, index) => index !== changedIndex)
    
    if (otherServers.length > 0) {
      const weightPerServer = difference / otherServers.length
      
      servers.value.forEach((server, index) => {
        if (index !== changedIndex) {
          server.weight = Math.max(1, Math.min(100, Math.round(server.weight - weightPerServer)))
        }
      })
      
      // Rekurencyjnie dopracuj jeśli nadal nie 100%
      const newTotal = servers.value.reduce((sum, server) => sum + server.weight, 0)
      if (newTotal !== 100) {
        servers.value[changedIndex].weight += (100 - newTotal)
        servers.value[changedIndex].weight = Math.max(1, Math.min(100, servers.value[changedIndex].weight))
      }
    }
  }
}

function autoBalanceWeights() {
  if (servers.value.length === 0) return
  
  const weightPerServer = Math.floor(100 / servers.value.length)
  const remainder = 100 - (weightPerServer * servers.value.length)
  
  servers.value.forEach((server, index) => {
    server.weight = weightPerServer + (index < remainder ? 1 : 0)
  })
  
  ElMessage.success('Wagi automatycznie zrównoważone')
}

function normalizeWeights() {
  if (servers.value.length === 0) return
  
  const weightPerServer = Math.floor(100 / servers.value.length)
  const remainder = 100 - (weightPerServer * servers.value.length)
  
  servers.value.forEach((server, index) => {
    server.weight = weightPerServer + (index < remainder ? 1 : 0)
  })
}

// Funkcje load balancingu
async function toggleLoadBalancer(enabled) {
  try {
    const config = {
      ...algorithm.value,
      enabled,
      servers: servers.value.map(s => ({
        ip: s.ip,
        port: s.port,
        weight: s.weight,
        name: s.name
      }))
    }

    const response = await axios.post('/api/loadbalancer/config', { config })
    
    if (response.data.success) {
      algorithm.value.enabled = enabled
      ElNotification({
        title: enabled ? 'Włączono' : 'Wyłączono',
        message: enabled ? 'Load balancer został włączony' : 'Load balancer został wyłączony',
        type: 'success',
        duration: 3000
      })
    }
  } catch (error) {
    algorithm.value.enabled = !enabled // Revert
    ElNotification({
      title: 'Błąd',
      message: 'Nie udało się zmienić stanu load balancera',
      type: 'error',
      duration: 3000
    })
  }
}

async function applyLoadBalancing() {
  try {
    applying.value = true
    
    const config = {
      ...algorithm.value,
      servers: servers.value.map(s => ({
        ip: s.ip,
        port: s.port,
        weight: s.weight,
        name: s.name,
        protocol: s.protocol,
        maxConnections: s.maxConnections,
        timeout: s.timeout
      }))
    }

    const response = await axios.post('/api/loadbalancer/apply', { config })
    
    if (response.data.success) {
      // Aktualizuj statusy
      statusHistory.value.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: 'info',
        type: 'CONFIG',
        message: `Zastosowano konfigurację load balancingu (${algorithm.value.type})`
      })
      
      ElNotification({
        title: 'Sukces',
        message: 'Konfiguracja load balancingu została zastosowana',
        type: 'success',
        duration: 3000
      })
      
      await refreshAll()
    }
  } catch (error) {
    ElNotification({
      title: 'Błąd',
      message: 'Nie udało się zastosować konfiguracji',
      type: 'error',
      duration: 3000
    })
  } finally {
    applying.value = false
  }
}

async function testLoadBalancing() {
  try {
    testing.value = true
    
    const config = {
      ...algorithm.value,
      servers: servers.value.map(s => ({
        ip: s.ip,
        port: s.port,
        weight: s.weight
      }))
    }

    const response = await axios.post('/api/loadbalancer/test', { config })
    
    if (response.data.success) {
      testResults.value = response.data
      
      // Aktualizuj statystyki serwerów
      response.data.results.forEach((result, index) => {
        if (servers.value[index]) {
          servers.value[index].responseTime = result.avgResponseTime
          servers.value[index].status = result.successRate >= 95 ? 'healthy' : 
                                       result.successRate >= 80 ? 'degraded' : 'down'
        }
      })
      
      statusHistory.value.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: testResults.value.summary.overallStatus === 'PASS' ? 'healthy' : 'warning',
        type: 'TEST',
        message: `Przeprowadzono test load balancingu: ${testResults.value.summary.overallStatus}`
      })
      
      ElNotification({
        title: 'Test zakończony',
        message: response.data.message,
        type: testResults.value.summary.overallStatus === 'PASS' ? 'success' : 'warning',
        duration: 3000
      })
    }
  } catch (error) {
    ElNotification({
      title: 'Błąd testu',
      message: 'Nie udało się przeprowadzić testu',
      type: 'error',
      duration: 3000
    })
  } finally {
    testing.value = false
  }
}

async function refreshAll() {
  await Promise.all([
    refreshStats(),
    loadLogs(),
    fetchLoadBalancerStatus()
  ])
}

async function refreshStats() {
  try {
    refreshing.value = true
    
    const response = await axios.get('/api/loadbalancer/stats')
    
    if (response.data.success) {
      statusHistory.value = response.data.history || []
      statsTrends.value = response.data.trends || {}
    }
    
    // Aktualizuj statystyki serwerów
    servers.value.forEach(server => {
      const change = Math.random() * 0.2 - 0.1 // -10% do +10%
      server.requestsPerMinute = Math.max(100, Math.round((server.requestsPerMinute || 500) * (1 + change)))
      server.responseTime = Math.max(10, Math.round((server.responseTime || 50) * (1 + change)))
      server.cpuUsage = Math.max(10, Math.min(95, Math.round((server.cpuUsage || 50) * (1 + change))))
      server.memoryUsage = Math.max(10, Math.min(95, Math.round((server.memoryUsage || 50) * (1 + change))))
      
      // Sprawdź statusy na podstawie metryk
      if (server.cpuUsage > 80 || server.memoryUsage > 85) {
        server.status = 'degraded'
      } else if (server.cpuUsage > 90 || server.memoryUsage > 95) {
        server.status = 'warning'
      } else {
        server.status = 'healthy'
      }
    })
    
    ElMessage.success('Statystyki odświeżone')
  } catch (error) {
    ElMessage.error('Błąd podczas odświeżania statystyk')
  } finally {
    refreshing.value = false
  }
}

async function fetchLoadBalancerStatus() {
  try {
    const response = await axios.get('/api/loadbalancer/status')
    
    if (response.data.success) {
      servers.value = response.data.config.servers || []
      algorithm.value = {
        enabled: response.data.config.enabled || false,
        type: response.data.config.algorithm || 'weighted',
        healthCheck: response.data.config.healthCheck || true,
        healthCheckInterval: response.data.config.healthCheckInterval || '30s',
        failThreshold: response.data.config.failThreshold || 3,
        stickySessions: response.data.config.stickySessions || true,
        sessionTimeout: response.data.config.sessionTimeout || 30
      }
      
      overallStatus.value = response.data.overallStatus || 'unknown'
    }
  } catch (error) {
    console.error('Failed to fetch load balancer status:', error)
  }
}

async function loadLogs() {
  try {
    loadingLogs.value = true
    
    const response = await axios.get('/api/loadbalancer/logs')
    
    if (response.data.success) {
      logs.value = response.data.logs || []
    }
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania logów')
  } finally {
    loadingLogs.value = false
  }
}

async function clearLogs() {
  try {
    const result = await ElMessageBox.confirm(
      'Czy na pewno chcesz wyczyścić wszystkie logi?',
      'Potwierdzenie',
      {
        type: 'warning',
        confirmButtonText: 'Wyczyść',
        cancelButtonText: 'Anuluj'
      }
    )

    if (result === 'confirm') {
      const response = await axios.delete('/api/loadbalancer/logs')
      
      if (response.data.success) {
        logs.value = []
        ElMessage.success('Logi zostały wyczyszczone')
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas czyszczenia logów')
    }
  }
}

function showLogDetails(log) {
  ElMessageBox.alert(
    `<pre>${JSON.stringify(log.details, null, 2)}</pre>`,
    'Szczegóły logu',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: 'OK',
      customClass: 'log-details-dialog'
    }
  )
}

// Inicjalizacja
onMounted(async () => {
  await fetchLoadBalancerStatus()
  await loadLogs()
  
  // Uruchom cykliczne odświeżanie co 30 sekund
  setInterval(async () => {
    if (!refreshing.value) {
      await fetchLoadBalancerStatus()
    }
  }, 30000)
})

// Watch for algorithm changes
watch(() => algorithm.value, (newAlgorithm) => {
  if (newAlgorithm.enabled) {
    ElMessage.info('Load balancer włączony')
  }
}, { deep: true })

// Watch for total weight changes
watch(totalWeight, (newTotal) => {
  if (newTotal !== 100 && servers.value.length > 0) {
    ElMessage.warning(`Suma wag musi wynosić 100% (aktualnie: ${newTotal}%)`)
  }
})
</script>

<style scoped>
.load-balancer-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.status-tag {
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions .el-button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 12px;
  color: white;
  font-size: 24px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-sub {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
}

.trend-up {
  color: #10b981;
}

.trend-down {
  color: #ef4444;
}

.load-balancer-content {
  display: grid;
  gap: 24px;
}

.servers-card,
.algorithm-card,
.statistics-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.servers-card:hover,
.algorithm-card:hover,
.statistics-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
}

.card-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.servers-list {
  padding: 0 24px;
}

.server-item {
  padding: 20px 0;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.server-item:last-child {
  border-bottom: none;
}

.server-item:hover {
  background-color: #f8fafc;
  border-radius: 8px;
  margin: 0 -24px;
  padding: 20px 24px;
}

.server-item.status-degraded {
  border-left: 4px solid #f59e0b;
  padding-left: 20px;
}

.server-item.status-down {
  border-left: 4px solid #ef4444;
  padding-left: 20px;
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.server-title {
  flex: 1;
}

.server-title h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
  margin-bottom: 4px;
}

.status-tag-inline {
  margin-left: 8px;
}

.server-address {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}

.server-protocol {
  background-color: #e2e8f0;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.server-actions {
  display: flex;
  gap: 8px;
}

.server-config {
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
}

.config-item label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.weight-control {
  margin-top: 16px;
}

.weight-control label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.weight-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.server-stats {
  background-color: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f1f5f9;
  border-radius: 8px;
  color: #3b82f6;
  font-size: 18px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.total-weight-info {
  margin: 24px;
}

.algorithm-config {
  padding: 0 24px 24px;
}

.algorithm-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.algorithm-option:hover {
  background-color: #f8fafc;
  border-color: #3b82f6;
}

.el-radio.is-checked .algorithm-option {
  background-color: #eff6ff;
  border-color: #3b82f6;
}

.option-icon {
  font-size: 24px;
  color: #3b82f6;
  margin-top: 4px;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
}

.option-title {
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.option-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.4;
}

.hint {
  margin-left: 12px;
  color: #64748b;
  font-size: 13px;
}

.statistics-content {
  padding: 0 24px 24px;
}

.chart-container {
  margin-bottom: 32px;
}

.chart-container h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
}

.traffic-chart {
  display: flex;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
}

.traffic-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  min-width: 20px;
}

.traffic-bar:hover {
  opacity: 0.9;
  transform: scale(1.02);
  z-index: 1;
}

.bar-label {
  color: white;
  font-weight: 600;
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.traffic-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background-color: #f8fafc;
  border-radius: 6px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-text {
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
}

.legend-value {
  font-weight: 600;
  color: #1e293b;
}

.timeline-container {
  margin: 32px 0;
}

.timeline-container h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
}

.timeline {
  border-left: 2px solid #e2e8f0;
  margin-left: 8px;
  padding-left: 20px;
}

.timeline-event {
  position: relative;
  padding: 12px 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.timeline-event::before {
  content: '';
  position: absolute;
  left: -26px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  z-index: 1;
}

.timeline-event.status-healthy::before {
  background-color: #10b981;
}

.timeline-event.status-degraded::before,
.timeline-event.status-warning::before {
  background-color: #f59e0b;
}

.timeline-event.status-down::before {
  background-color: #ef4444;
}

.timeline-event.status-info::before {
  background-color: #3b82f6;
}

.event-time {
  font-size: 12px;
  color: #64748b;
  min-width: 80px;
}

.event-details {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.event-icon {
  font-size: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.event-text {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.4;
}

.event-type {
  flex-shrink: 0;
}

.no-events {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #94a3b8;
  font-style: italic;
}

.test-results {
  margin-top: 32px;
  padding: 20px;
  background-color: #f8fafc;
  border-radius: 8px;
}

.test-results h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.result-card {
  padding: 16px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.result-card.result-excellent {
  border-color: #10b981;
}

.result-card.result-good {
  border-color: #3b82f6;
}

.result-card.result-degraded {
  border-color: #f59e0b;
}

.result-card.result-poor {
  border-color: #ef4444;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.result-server {
  color: #1e293b;
}

.result-stats {
  display: grid;
  gap: 8px;
}

.result-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #64748b;
  font-size: 12px;
}

.stat-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 13px;
}

.results-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.summary-text {
  color: #64748b;
  font-size: 14px;
}

.logs-container {
  height: 60vh;
  display: flex;
  flex-direction: column;
}

.logs-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  background-color: #f8fafc;
}

.log-entry {
  display: grid;
  grid-template-columns: 120px 100px 1fr auto;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  align-items: center;
  font-size: 13px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.log-error {
  background-color: #fef2f2;
}

.log-entry.log-warning {
  background-color: #fffbeb;
}

.log-entry.log-info {
  background-color: #eff6ff;
}

.log-entry.log-config {
  background-color: #f0fdf4;
}

.log-timestamp {
  color: #64748b;
}

.log-message {
  color: #1e293b;
  word-break: break-word;
}

.no-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #94a3b8;
  gap: 12px;
}

.no-logs .iconify {
  font-size: 48px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .config-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .log-entry {
    grid-template-columns: 100px 90px 1fr;
  }
  
  .log-entry .el-button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .server-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .server-actions {
    justify-content: flex-end;
  }
  
  .log-entry {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  
  .log-timestamp, .log-type {
    font-size: 11px;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
  transform: translateY(-1px);
}

:deep(.el-button--success) {
  background: #10b981;
  border-color: #10b981;
}

:deep(.el-button--success:hover) {
  background: #059669;
  border-color: #059669;
  transform: translateY(-1px);
}

/* Radio group styling */
:deep(.el-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:deep(.el-radio) {
  margin-right: 0;
}

:deep(.el-radio__label) {
  padding-left: 0;
  width: 100%;
}

/* Dialog styling */
:deep(.el-dialog) {
  border-radius: 16px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #f1f5f9;
  padding: 20px 24px;
  margin: 0;
}

:deep(.el-dialog__body) {
  padding: 20px 24px;
}

:deep(.el-dialog__footer) {
  border-top: 1px solid #f1f5f9;
  padding: 20px 24px;
  margin: 0;
}

:deep(.dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Slider styling */
:deep(.el-slider__button) {
  width: 16px;
  height: 16px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

:deep(.el-slider__stop) {
  width: 4px;
  height: 4px;
}

/* Loading animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.el-icon.is-loading) {
  animation: spin 1s linear infinite;
}

/* Log details dialog */
:deep(.log-details-dialog .el-message-box__message) {
  max-height: 400px;
  overflow-y: auto;
}

:deep(.log-details-dialog pre) {
  background-color: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
</style>
