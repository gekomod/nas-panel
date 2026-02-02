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
          </el-button-group>
        </div>
      </div>
    </el-card>

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
                :disabled="servers.length >= 4"
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
          >
            <div class="server-header">
              <h3>
                <Icon icon="mdi:server" />
                Serwer {{ index + 1 }}
              </h3>
              <div class="server-actions">
                <el-button 
                  size="small" 
                  circle 
                  @click="editServer(index)"
                >
                  <Icon icon="mdi:pencil" />
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
              <div class="config-row">
                <div class="config-item">
                  <label>Adres IP:</label>
                  <span class="config-value">{{ server.ip || 'Nie skonfigurowano' }}</span>
                </div>
                <div class="config-item">
                  <label>Port:</label>
                  <span class="config-value">{{ server.port || '-' }}</span>
                </div>
              </div>
              
              <div class="config-row">
                <div class="config-item">
                  <label>Waga:</label>
                  <span class="config-value">{{ server.weight }}%</span>
                </div>
                <div class="config-item">
                  <label>Status:</label>
                  <el-tag 
                    :type="server.status === 'healthy' ? 'success' : server.status === 'degraded' ? 'warning' : 'danger'"
                    size="small"
                  >
                    {{ getStatusText(server.status) }}
                  </el-tag>
                </div>
              </div>
              
              <div class="weight-slider">
                <label>Rozkład obciążenia:</label>
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
              </div>
            </div>
            
            <div class="server-stats">
              <div class="stats-grid">
                <div class="stat-item">
                  <Icon icon="mdi:chart-line" class="stat-icon" />
                  <div class="stat-info">
                    <div class="stat-value">{{ server.requestsPerMinute || 0 }}</div>
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
          </div>
        </template>

        <div class="algorithm-config">
          <el-form :model="algorithm" label-width="200px">
            <el-form-item label="Typ algorytmu">
              <el-radio-group v-model="algorithm.type">
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
              <el-switch v-model="algorithm.healthCheck" />
              <span class="hint">Automatycznie wykrywaj i omijaj uszkodzone serwery</span>
            </el-form-item>

            <template v-if="algorithm.healthCheck">
              <el-form-item label="Interwał sprawdzania">
                <el-select v-model="algorithm.healthCheckInterval" style="width: 200px">
                  <el-option label="Co 30 sekund" value="30s" />
                  <el-option label="Co 1 minutę" value="1m" />
                  <el-option label="Co 5 minut" value="5m" />
                  <el-option label="Co 10 minut" value="10m" />
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
                />
                <span class="hint">{{ algorithm.failThreshold }} nieudanych prób z rzędu oznacza awarię</span>
              </el-form-item>
            </template>

            <el-form-item label="Sticky sessions">
              <el-switch v-model="algorithm.stickySessions" />
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
                :title="`Serwer ${server.ip}: ${server.weight}%`"
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
                <span class="legend-text">{{ server.ip || 'Serwer ' + server.id }}</span>
                <span class="legend-value">{{ server.weight }}%</span>
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-header">
                <Icon icon="mdi:swap-horizontal" class="metric-icon" />
                <h4>Całkowity ruch</h4>
              </div>
              <div class="metric-value">{{ totalRequests.toLocaleString() }}</div>
              <div class="metric-label">żądań dzisiaj</div>
              <div class="metric-trend">
                <Icon 
                  :icon="requestTrend > 0 ? 'mdi:arrow-up' : 'mdi:arrow-down'" 
                  :class="requestTrend > 0 ? 'trend-up' : 'trend-down'"
                />
                <span>{{ Math.abs(requestTrend) }}% w porównaniu do wczoraj</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <Icon icon="mdi:timer-outline" class="metric-icon" />
                <h4>Średni czas odpowiedzi</h4>
              </div>
              <div class="metric-value">{{ avgResponseTime }}ms</div>
              <div class="metric-label">średnio na żądanie</div>
              <div class="metric-trend">
                <Icon 
                  :icon="responseTrend < 0 ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                  :class="responseTrend < 0 ? 'trend-up' : 'trend-down'"
                />
                <span>{{ Math.abs(responseTrend) }}% w porównaniu do wczoraj</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <Icon icon="mdi:alert-circle" class="metric-icon" />
                <h4>Wskaźnik błędów</h4>
              </div>
              <div class="metric-value">{{ errorRate }}%</div>
              <div class="metric-label">nieudanych żądań</div>
              <div class="metric-trend">
                <Icon 
                  :icon="errorTrend < 0 ? 'mdi:arrow-down' : 'mdi:arrow-up'" 
                  :class="errorTrend < 0 ? 'trend-up' : 'trend-down'"
                />
                <span>{{ Math.abs(errorTrend) }}% w porównaniu do wczoraj</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-header">
                <Icon icon="mdi:server-network" class="metric-icon" />
                <h4>Wykorzystanie zasobów</h4>
              </div>
              <div class="metric-value">{{ avgResourceUsage }}%</div>
              <div class="metric-label">średnie CPU/RAM</div>
              <div class="progress-container">
                <el-progress 
                  :percentage="avgResourceUsage" 
                  :color="getResourceColor(avgResourceUsage)"
                  :show-text="false"
                />
              </div>
            </div>
          </div>

          <!-- Server Status Timeline -->
          <div class="timeline-container">
            <h3>Historia statusów serwerów</h3>
            <div class="timeline">
              <div 
                v-for="event in statusHistory" 
                :key="event.id"
                class="timeline-event"
                :class="`status-${event.status}`"
              >
                <div class="event-time">{{ formatTime(event.timestamp) }}</div>
                <div class="event-details">
                  <Icon :icon="getStatusIcon(event.status)" class="event-icon" />
                  <span class="event-text">{{ event.message }}</span>
                </div>
              </div>
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
      <el-form :model="serverForm" label-width="120px" ref="serverFormRef">
        <el-form-item label="Nazwa serwera" prop="name">
          <el-input v-model="serverForm.name" placeholder="np. Serwer produkcyjny 1" />
        </el-form-item>
        
        <el-form-item label="Adres IP" prop="ip" required>
          <el-input v-model="serverForm.ip" placeholder="192.168.1.100" />
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
            <el-option label="TCP" value="tcp" />
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
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showServerDialog = false">Anuluj</el-button>
          <el-button type="primary" @click="saveServer">
            {{ editingServerIndex !== null ? 'Zapisz zmiany' : 'Dodaj serwer' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElNotification, ElMessage, ElMessageBox } from 'element-plus'

// Stan komponentu
const servers = ref([
  {
    id: 1,
    ip: '192.168.1.100',
    port: 8080,
    weight: 50,
    status: 'healthy',
    name: 'Serwer główny',
    protocol: 'http',
    maxConnections: 1000,
    timeout: 5000,
    requestsPerMinute: 1200,
    responseTime: 45,
    cpuUsage: 65,
    memoryUsage: 70
  },
  {
    id: 2,
    ip: '192.168.1.101',
    port: 8080,
    weight: 50,
    status: 'healthy',
    name: 'Serwer zapasowy',
    protocol: 'http',
    maxConnections: 1000,
    timeout: 5000,
    requestsPerMinute: 1100,
    responseTime: 50,
    cpuUsage: 60,
    memoryUsage: 65
  }
])

const algorithm = ref({
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
const editingServerIndex = ref(null)
const serverForm = ref({
  name: '',
  ip: '',
  port: 8080,
  protocol: 'http',
  maxConnections: 1000,
  timeout: 5000
})

const statusHistory = ref([
  { id: 1, timestamp: new Date(Date.now() - 3600000), status: 'healthy', message: 'Serwer 1: Wszystkie testy zdrowia przeszły pomyślnie' },
  { id: 2, timestamp: new Date(Date.now() - 1800000), status: 'warning', message: 'Serwer 2: Wysokie użycie CPU (85%)' },
  { id: 3, timestamp: new Date(Date.now() - 900000), status: 'healthy', message: 'Serwer 2: CPU wróciło do normalnego poziomu' },
  { id: 4, timestamp: new Date(Date.now() - 300000), status: 'info', message: 'Zmieniono wagę serwera 1 na 60%' }
])

// Computed properties
const totalWeight = computed(() => {
  return servers.value.reduce((sum, server) => sum + server.weight, 0)
})

const serversReady = computed(() => {
  return servers.value.length >= 2 && totalWeight.value === 100
})

const totalRequests = computed(() => {
  return servers.value.reduce((sum, server) => sum + (server.requestsPerMinute || 0) * 60 * 24, 0)
})

const avgResponseTime = computed(() => {
  const total = servers.value.reduce((sum, server) => sum + (server.responseTime || 0), 0)
  return Math.round(total / servers.value.length)
})

const avgResourceUsage = computed(() => {
  const total = servers.value.reduce((sum, server) => sum + (server.cpuUsage || 0) + (server.memoryUsage || 0), 0)
  return Math.round(total / (servers.value.length * 2))
})

// Symulowane trendy
const requestTrend = ref(12)
const responseTrend = ref(-5)
const errorTrend = ref(-2)
const errorRate = ref(0.5)

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

function getServerColor(server) {
  const colors = {
    1: '#3b82f6',
    2: '#10b981',
    3: '#8b5cf6',
    4: '#f59e0b'
  }
  return colors[server.id] || '#64748b'
}

function getResourceColor(percentage) {
  if (percentage < 50) return '#10b981'
  if (percentage < 75) return '#f59e0b'
  return '#ef4444'
}

function formatTime(date) {
  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Funkcje zarządzania serwerami
function addServer() {
  if (servers.value.length >= 4) {
    ElMessage.warning('Maksymalnie można dodać 4 serwery')
    return
  }
  
  editingServerIndex.value = null
  serverForm.value = {
    name: `Serwer ${servers.value.length + 1}`,
    ip: '',
    port: 8080,
    protocol: 'http',
    maxConnections: 1000,
    timeout: 5000
  }
  showServerDialog.value = true
}

function editServer(index) {
  editingServerIndex.value = index
  const server = servers.value[index]
  serverForm.value = { ...server }
  showServerDialog.value = true
}

function removeServer(index) {
  if (servers.value.length <= 2) {
    ElMessage.warning('Musisz mieć co najmniej 2 serwery dla load balancingu')
    return
  }
  
  ElMessageBox.confirm(
    `Czy na pewno chcesz usunąć serwer ${servers.value[index].name || 'Serwer ' + (index + 1)}?`,
    'Potwierdzenie usunięcia',
    {
      type: 'warning',
      confirmButtonText: 'Usuń',
      cancelButtonText: 'Anuluj'
    }
  ).then(() => {
    servers.value.splice(index, 1)
    ElMessage.success('Serwer został usunięty')
    normalizeWeights()
  })
}

function saveServer() {
  if (!serverForm.value.ip) {
    ElMessage.error('Adres IP jest wymagany')
    return
  }
  
  if (editingServerIndex.value !== null) {
    // Aktualizuj istniejący serwer
    const server = {
      ...servers.value[editingServerIndex.value],
      ...serverForm.value,
      weight: servers.value[editingServerIndex.value].weight || 50,
      status: 'healthy'
    }
    servers.value[editingServerIndex.value] = server
    ElMessage.success('Serwer zaktualizowany')
  } else {
    // Dodaj nowy serwer
    const newServer = {
      id: Date.now(),
      ...serverForm.value,
      weight: Math.floor(100 / (servers.value.length + 1)),
      status: 'healthy',
      requestsPerMinute: Math.floor(Math.random() * 500) + 500,
      responseTime: Math.floor(Math.random() * 50) + 30,
      cpuUsage: Math.floor(Math.random() * 30) + 40,
      memoryUsage: Math.floor(Math.random() * 30) + 40
    }
    servers.value.push(newServer)
    ElMessage.success('Nowy serwer dodany')
    normalizeWeights()
  }
  
  showServerDialog.value = false
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

function normalizeWeights() {
  if (servers.value.length === 0) return
  
  const weightPerServer = Math.floor(100 / servers.value.length)
  const remainder = 100 - (weightPerServer * servers.value.length)
  
  servers.value.forEach((server, index) => {
    server.weight = weightPerServer + (index < remainder ? 1 : 0)
  })
}

// Funkcje load balancingu
async function applyLoadBalancing() {
  try {
    applying.value = true
    
    // Symulacja zapisu konfiguracji
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Aktualizuj statusy
    statusHistory.value.unshift({
      id: Date.now(),
      timestamp: new Date(),
      status: 'info',
      message: `Zastosowano konfigurację load balancingu (${algorithm.value.type})`
    })
    
    ElNotification({
      title: 'Sukces',
      message: 'Konfiguracja load balancingu została zastosowana',
      type: 'success',
      duration: 3000
    })
    
  } catch (error) {
    console.error('Error applying load balancing:', error)
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
    
    // Symulacja testów
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Aktualizuj statystyki serwerów
    servers.value.forEach(server => {
      server.requestsPerMinute = Math.floor(Math.random() * 300) + 800
      server.responseTime = Math.floor(Math.random() * 40) + 30
      server.cpuUsage = Math.floor(Math.random() * 30) + 40
      server.memoryUsage = Math.floor(Math.random() * 30) + 40
    })
    
    statusHistory.value.unshift({
      id: Date.now(),
      timestamp: new Date(),
      status: 'info',
      message: 'Przeprowadzono test load balancingu'
    })
    
    ElNotification({
      title: 'Test zakończony',
      message: 'Wszystkie serwery odpowiadają poprawnie',
      type: 'success',
      duration: 3000
    })
    
  } catch (error) {
    console.error('Error testing load balancing:', error)
    ElNotification({
      title: 'Błąd testu',
      message: 'Niektóre serwery nie odpowiadają',
      type: 'warning',
      duration: 3000
    })
  } finally {
    testing.value = false
  }
}

async function refreshStats() {
  try {
    refreshing.value = true
    
    // Symulacja odświeżania statystyk
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Losowe zmiany statystyk dla realizmu
    servers.value.forEach(server => {
      const change = Math.random() * 0.2 - 0.1 // -10% do +10%
      server.requestsPerMinute = Math.max(100, Math.round(server.requestsPerMinute * (1 + change)))
      server.responseTime = Math.max(10, Math.round(server.responseTime * (1 + change)))
      server.cpuUsage = Math.max(10, Math.min(95, Math.round(server.cpuUsage * (1 + change))))
      server.memoryUsage = Math.max(10, Math.min(95, Math.round(server.memoryUsage * (1 + change))))
    })
    
    // Sprawdź statusy na podstawie metryk
    servers.value.forEach(server => {
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
    console.error('Error refreshing stats:', error)
    ElMessage.error('Błąd podczas odświeżania statystyk')
  } finally {
    refreshing.value = false
  }
}

// Inicjalizacja
onMounted(() => {
  // Uruchom cykliczne odświeżanie statystyk
  setInterval(refreshStats, 30000)
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

.header-actions .el-button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
}

.server-item:last-child {
  border-bottom: none;
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.server-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #1e293b;
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

.config-row {
  display: flex;
  gap: 32px;
  margin-bottom: 12px;
}

.config-item {
  flex: 1;
}

.config-item label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.config-value {
  font-weight: 500;
  color: #1e293b;
}

.weight-slider {
  margin-top: 20px;
}

.weight-slider label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.server-stats {
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  border-radius: 8px;
  color: #3b82f6;
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
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
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.algorithm-option:hover {
  background-color: #f8fafc;
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
}

.traffic-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
}

.traffic-bar:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.bar-label {
  color: white;
  font-weight: 600;
  font-size: 13px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.traffic-legend {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-text {
  font-size: 14px;
  color: #1e293b;
}

.legend-value {
  font-weight: 600;
  color: #1e293b;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin: 32px 0;
}

.metric-card {
  background-color: #f8fafc;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.metric-icon {
  font-size: 24px;
  color: #3b82f6;
}

.metric-header h4 {
  margin: 0;
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.trend-up {
  color: #10b981;
}

.trend-down {
  color: #ef4444;
}

.progress-container {
  margin-top: 12px;
}

.timeline-container {
  margin-top: 32px;
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
  margin-bottom: 4px;
}

.event-details {
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

@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
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
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .config-row {
    flex-direction: column;
    gap: 12px;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.el-button--success) {
  background: #10b981;
  border-color: #10b981;
}

:deep(.el-button--success:hover) {
  background: #059669;
  border-color: #059669;
}

/* Radio group styling */
:deep(.el-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.el-radio) {
  margin-right: 0;
}

:deep(.el-radio__label) {
  padding-left: 0;
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
}

:deep(.el-slider__stop) {
  width: 4px;
  height: 4px;
}

/* Progress bar styling */
:deep(.el-progress-bar) {
  padding-right: 0;
}

/* Loading animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.el-icon.is-loading) {
  animation: spin 1s linear infinite;
}

/* Card hover effects */
.servers-card:hover,
.algorithm-card:hover,
.statistics-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}
</style>
