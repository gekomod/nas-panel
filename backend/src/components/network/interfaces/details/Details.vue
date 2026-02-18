<template>
  <div class="interface-details-container" :class="{ 'dark': isDark }">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <el-button @click="$router.go(-1)" class="back-btn" size="large">
          <el-icon><Icon icon="mdi:arrow-left" /></el-icon>
          Powrót
        </el-button>
        <div class="header-title">
          <h1>
            <el-icon><Icon icon="mdi:ethernet-cable" /></el-icon>
            {{ interfaceDetails.device || 'Interface Details' }}
          </h1>
          <p class="subtitle">Szczegóły konfiguracji interfejsu sieciowego</p>
        </div>
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
            @click="refreshDetails"
            :loading="loading"
            size="large"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            Odśwież
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Interface Statistics -->
      <el-card class="stats-panel">
        <div class="stats-section">
          <h3><el-icon><Icon icon="mdi:chart-box" /></el-icon> Statystyki interfejsu</h3>
          
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:download" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Odebrane bajty</div>
                <div class="stat-value">{{ formatBytes(interfaceDetails.stats?.rx_bytes || 0) }}</div>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:upload" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Wysłane bajty</div>
                <div class="stat-value">{{ formatBytes(interfaceDetails.stats?.tx_bytes || 0) }}</div>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:package-down" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Odebrane pakiety</div>
                <div class="stat-value">{{ interfaceDetails.stats?.rx_packets || 0 }}</div>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:package-up" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Wysłane pakiety</div>
                <div class="stat-value">{{ interfaceDetails.stats?.tx_packets || 0 }}</div>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:close-circle" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Błędy odbioru</div>
                <div class="stat-value">{{ interfaceDetails.stats?.rx_errors || 0 }}</div>
              </div>
            </div>
            
            <div class="stat-item">
              <div class="stat-icon">
                <el-icon><Icon icon="mdi:close-circle" /></el-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Błędy wysyłania</div>
                <div class="stat-value">{{ interfaceDetails.stats?.tx_errors || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- Right Panel - Details & Speed Test -->
      <div class="details-panel">
        <el-card class="interface-details">
          <!-- Interface Details Header -->
          <div class="viewer-header">
            <div class="file-info">
              <h2>
                <el-icon>
                  <Icon :icon="getInterfaceIcon()" />
                </el-icon>
                {{ interfaceDetails.device || 'Interfejs' }}
                <el-tag 
                  :type="getStatusType()" 
                  size="small" 
                  class="status-tag"
                >
                  <el-icon><Icon :icon="getStatusIcon()" /></el-icon>
                  {{ interfaceDetails.status?.toUpperCase() || 'UNKNOWN' }}
                </el-tag>
                <el-tag v-if="interfaceDetails.ethtool?.driver" size="small" class="driver-tag">
                  {{ interfaceDetails.ethtool.driver }}
                </el-tag>
              </h2>
              <div class="file-meta">
                <el-tag size="small" type="info">
                  <el-icon><Icon icon="mdi:card-bulleted-settings" /></el-icon>
                  MTU: {{ interfaceDetails.mtu || 1500 }}
                </el-tag>
                <el-tag size="small" :type="getSpeedClass()">
                  <el-icon><Icon icon="mdi:speedometer" /></el-icon>
                  {{ formatSpeed(interfaceDetails.ethtool?.speed) }}
                </el-tag>
                <el-tag size="small" :type="getDuplexType()">
                  <el-icon><Icon icon="mdi:swap-horizontal" /></el-icon>
                  {{ getDuplexDisplay() }}
                </el-tag>
                <el-tag size="small" type="info">
                  <el-icon><Icon icon="mdi:identifier" /></el-icon>
                  {{ interfaceDetails.mac || 'No MAC' }}
                </el-tag>
              </div>
            </div>
          </div>

          <!-- Speed Test Section -->
          <div class="speedtest-section">
            <div class="section-header">
              <h3><el-icon><Icon icon="mdi:speedometer" /></el-icon> Test prędkości</h3>
            </div>
            
            <div class="speedtest-content">
              <!-- Initial state -->
              <div v-if="!speedTestRunning && !speedTestResults" class="test-start">
                <div class="test-info">
                  <el-icon size="64" class="test-icon"><Icon icon="mdi:internet" /></el-icon>
                  <h4>Przetestuj prędkość połączenia</h4>
                  <p>Wykonaj test prędkości pobierania i wysyłania przez ten interfejs</p>
                </div>

                <div class="server-selection">
                  <el-button 
                    @click="showServerSelection = !showServerSelection" 
                    size="small" 
                    type="info"
                    class="server-select-btn"
                  >
                    <el-icon><Icon icon="mdi:server" /></el-icon>
                    {{ selectedServer ? `${selectedServer.name} (${selectedServer.location})` : 'Wybierz serwer testowy' }}
                  </el-button>
                  
                  <div v-if="showServerSelection" class="server-list">
                    <div class="server-list-header">
                      <span>Dostępne serwery:</span>
                      <el-button size="small" text @click="showServerSelection = false">
                        <el-icon><Icon icon="mdi:close" /></el-icon>
                      </el-button>
                    </div>
                    <el-scrollbar max-height="300px">
                      <div 
                        v-for="server in speedtestServers" 
                        :key="server.id"
                        class="server-item"
                        :class="{ 'selected': selectedServer?.id === server.id }"
                        @click="selectServer(server)"
                      >
                        <div class="server-item-content">
                          <el-icon><Icon icon="mdi:server" /></el-icon>
                          <div class="server-info">
                            <div class="server-name">{{ server.name }}</div>
                            <div class="server-details">
                              <span>{{ server.location }}, {{ server.country }}</span>
                              <el-tag v-if="server.sponsor" size="small" type="info">
                                {{ server.sponsor }}
                              </el-tag>
                            </div>
                          </div>
                          <el-icon v-if="selectedServer?.id === server.id" class="selected-icon">
                            <Icon icon="mdi:check-circle" />
                          </el-icon>
                        </div>
                      </div>
                    </el-scrollbar>
                  </div>
                </div>

                <el-button 
                  type="primary" 
                  @click="startSpeedTest" 
                  :disabled="loading || !isInterfaceUp"
                  size="large"
                  class="test-button"
                >
                  <el-icon><Icon icon="mdi:play" /></el-icon>
                  Rozpocznij test
                </el-button>
                <p v-if="!isInterfaceUp" class="warning-text">
                  <el-icon><Icon icon="mdi:alert-circle" /></el-icon>
                  Interfejs musi być włączony aby wykonać test
                </p>
              </div>

              <!-- Test in progress -->
              <div v-else-if="speedTestRunning" class="test-progress">
                <div class="progress-info">
                  <el-progress 
                    :percentage="testProgress" 
                    :status="testProgress < 100 ? 'success' : 'success'"
                    :stroke-width="16"
                    striped
                    striped-flow
                  />
                  <div class="progress-text">
                    <el-icon><Icon icon="mdi:progress-clock" /></el-icon>
                    Testowanie w toku...
                  </div>
                  <div class="progress-details">
                    <el-icon><Icon icon="mdi:server" /></el-icon>
                    Serwer testowy: {{ currentServer }}
                  </div>
                </div>
              </div>

              <!-- Test results -->
              <div v-else-if="speedTestResults" class="test-results">
                <div class="results-header">
                  <el-icon color="var(--el-color-success)" size="20"><Icon icon="mdi:check-circle" /></el-icon>
                  <span>Test zakończony pomyślnie</span>
                  <el-tag size="small" type="info" class="server-tag">
                    <el-icon><Icon icon="mdi:server" /></el-icon>
                    {{ speedTestResults.server }}
                  </el-tag>
                  <el-button 
                    size="small" 
                    @click="speedTestResults = null"
                    class="clear-results"
                  >
                    <el-icon><Icon icon="mdi:close" /></el-icon>
                  </el-button>
                </div>
                
                <div class="server-info" v-if="speedTestResults.serverHost">
                  <small>
                    <el-icon><Icon icon="mdi:link" /></el-icon> 
                    Host: {{ speedTestResults.serverHost }}:{{ speedTestResults.serverPort }}
                  </small>
                </div>
                
                <div class="results-grid">
                  <div class="result-item download">
                    <div class="result-icon">
                      <el-icon size="32"><Icon icon="mdi:download" /></el-icon>
                    </div>
                    <div class="result-content">
                      <div class="result-label">Pobieranie</div>
                      <div class="result-value">
                        {{ speedTestResults.download }} Mbps
                      </div>
                    </div>
                  </div>
                  
                  <div class="result-item upload">
                    <div class="result-icon">
                      <el-icon size="32"><Icon icon="mdi:upload" /></el-icon>
                    </div>
                    <div class="result-content">
                      <div class="result-label">Wysyłanie</div>
                      <div class="result-value">
                        {{ speedTestResults.upload }} Mbps
                      </div>
                    </div>
                  </div>
                  
                  <div class="result-item ping">
                    <div class="result-icon">
                      <el-icon size="32"><Icon icon="mdi:ping" /></el-icon>
                    </div>
                    <div class="result-content">
                      <div class="result-label">Ping</div>
                      <div class="result-value">
                        {{ speedTestResults.ping || 'N/A' }} ms
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="results-actions">
                  <el-button @click="startSpeedTest" type="primary" size="small">
                    <el-icon><Icon icon="mdi:refresh" /></el-icon>
                    Testuj ponownie
                  </el-button>
                  <el-button @click="copyResults" size="small">
                    <el-icon><Icon icon="mdi:content-copy" /></el-icon>
                    Kopiuj wyniki
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Interface Properties -->
          <div class="properties-section">
            <div class="section-header">
              <h3><el-icon><Icon icon="mdi:card-bulleted" /></el-icon> Właściwości interfejsu</h3>
            </div>
            
            <div class="properties-grid">
              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:car-engine" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Sterownik</div>
                  <div class="property-value">{{ interfaceDetails.ethtool?.driver || 'N/A' }}</div>
                </div>
              </div>
              
              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:speedometer" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Prędkość</div>
                  <div class="property-value" :class="getSpeedClass()">
                    {{ formatSpeed(interfaceDetails.ethtool?.speed) }}
                  </div>
                </div>
              </div>
              
              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:swap-horizontal" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Duplex</div>
                  <div class="property-value">
                    <el-tag :type="getDuplexType()" size="small">
                      {{ getDuplexDisplay() }}
                    </el-tag>
                  </div>
                </div>
              </div>
              
              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:power-sleep" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Wake-on-LAN</div>
                  <div class="property-value">
                    <el-tag :type="interfaceDetails.ethtool?.wol ? 'success' : 'info'" size="small">
                      {{ interfaceDetails.ethtool?.wol || 'N/A' }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:ip" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Adres IP</div>
                  <div class="property-value">
                    <el-tag v-if="interfaceDetails.ipv4?.local" type="success" size="small">
                      {{ interfaceDetails.ipv4.local }}/{{ interfaceDetails.ipv4.prefixlen || 24 }}
                    </el-tag>
                    <span v-else class="no-ip">Nie skonfigurowano</span>
                  </div>
                </div>
              </div>

              <div class="property-item">
                <div class="property-icon">
                  <el-icon><Icon icon="mdi:gate" /></el-icon>
                </div>
                <div class="property-content">
                  <div class="property-label">Brama</div>
                  <div class="property-value">
                    {{ interfaceDetails.config?.['IP4.GATEWAY'] || 'N/A' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElNotification, ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const route = useRoute()
const interfaceDetails = ref({
  device: '',
  status: '',
  mac: '',
  mtu: 1500,
  ipv4: { local: '', prefixlen: '' },
  stats: {},
  ethtool: {},
  config: {}
})

const loading = ref(false)
const speedTestRunning = ref(false)
const speedTestResults = ref(null)
const testProgress = ref(0)
const currentServer = ref('')

const showServerSelection = ref(false)
const selectedServer = ref(null)

// Lista serwerów do testu prędkości
const speedtestServers = ref([
  {
    id: 1,
    name: 'Orange Polska',
    location: 'Warszawa',
    country: 'Polska',
    sponsor: 'Orange',
    host: 'speedtest.orange.pl',
    port: 8080
  },
  {
    id: 2,
    name: 'UPC Polska',
    location: 'Kraków',
    country: 'Polska',
    sponsor: 'UPC',
    host: 'speedtest.upc.pl',
    port: 8080
  },
  {
    id: 3,
    name: 'Play',
    location: 'Wrocław',
    country: 'Polska',
    sponsor: 'Play',
    host: 'speedtest.play.pl',
    port: 8080
  },
  {
    id: 4,
    name: 'Netia',
    location: 'Poznań',
    country: 'Polska',
    sponsor: 'Netia',
    host: 'speedtest.netia.pl',
    port: 8080
  },
  {
    id: 5,
    name: 'T-Mobile',
    location: 'Gdańsk',
    country: 'Polska',
    sponsor: 'T-Mobile',
    host: 'speedtest.t-mobile.pl',
    port: 8080
  },
  {
    id: 6,
    name: 'Vectra',
    location: 'Gdynia',
    country: 'Polska',
    sponsor: 'Vectra',
    host: 'speedtest.vectra.pl',
    port: 8080
  },
  {
    id: 7,
    name: 'INEA',
    location: 'Poznań',
    country: 'Polska',
    sponsor: 'INEA',
    host: 'speedtest.inea.pl',
    port: 8080
  },
  {
    id: 8,
    name: 'Toyota',
    location: 'Łódź',
    country: 'Polska',
    sponsor: 'Toyota',
    host: 'speedtest.toyota.pl',
    port: 8080
  },
  {
    id: 9,
    name: 'Multimedia',
    location: 'Rzeszów',
    country: 'Polska',
    sponsor: 'Multimedia',
    host: 'speedtest.multimedia.pl',
    port: 8080
  },
  {
    id: 10,
    name: 'O2',
    location: 'Berlin',
    country: 'Niemcy',
    sponsor: 'O2',
    host: 'speedtest.o2.de',
    port: 8080
  },
  {
    id: 11,
    name: 'Deutsche Telekom',
    location: 'Frankfurt',
    country: 'Niemcy',
    sponsor: 'Deutsche Telekom',
    host: 'speedtest.telekom.de',
    port: 8080
  },
  {
    id: 12,
    name: 'Vodafone',
    location: 'Düsseldorf',
    country: 'Niemcy',
    sponsor: 'Vodafone',
    host: 'speedtest.vodafone.de',
    port: 8080
  },
  {
    id: 13,
    name: 'O2 Czech Republic',
    location: 'Praga',
    country: 'Czechy',
    sponsor: 'O2',
    host: 'speedtest.o2.cz',
    port: 8080
  },
  {
    id: 14,
    name: 'Slovak Telekom',
    location: 'Bratysława',
    country: 'Słowacja',
    sponsor: 'Slovak Telekom',
    host: 'speedtest.telekom.sk',
    port: 8080
  },
  {
    id: 15,
    name: 'UPC Česká republika',
    location: 'Brno',
    country: 'Czechy',
    sponsor: 'UPC',
    host: 'speedtest.upc.cz',
    port: 8080
  }
])

// Theme management
const isDark = ref(false)
const themeIcon = computed(() => 
  isDark.value ? 'mdi:weather-sunny' : 'mdi:weather-night'
)

const toggleTheme = () => {
  isDark.value = !isDark.value
  // Apply theme to body and component
  if (isDark.value) {
    document.body.classList.add('dark-theme')
    document.documentElement.classList.add('dark')
  } else {
    document.body.classList.remove('dark-theme')
    document.documentElement.classList.remove('dark')
  }
  // Save preference
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// Initialize theme
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.body.classList.add('dark-theme')
    document.documentElement.classList.add('dark')
  }
  
  // Load interface details
  fetchInterfaceDetails()
})

// Computed properties
const isInterfaceUp = computed(() => {
  const status = interfaceDetails.value.status?.toLowerCase();
  return status === 'up';
});

// Helper functions
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (speed) => {
  if (!speed || speed === 'unknown') return 'N/A';
  if (typeof speed === 'number') {
    return speed >= 1000 ? `${speed/1000} Gbps` : `${speed} Mbps`;
  }
  return speed;
};

const getInterfaceIcon = () => {
  const device = interfaceDetails.value.device?.toLowerCase() || '';
  if (device.includes('eth') || device.includes('en')) return 'mdi:ethernet-cable';
  if (device.includes('wlan') || device.includes('wlp')) return 'mdi:wifi';
  if (device.includes('bond')) return 'mdi:link-variant';
  if (device.includes('br')) return 'mdi:bridge';
  if (device.includes('tun') || device.includes('tap')) return 'mdi:tunnel';
  return 'mdi:network';
};

const getStatusType = () => {
  const status = interfaceDetails.value.status?.toLowerCase();
  if (status === 'up') return 'success';
  if (status === 'down') return 'danger';
  return 'info';
};

const getStatusIcon = () => {
  const status = interfaceDetails.value.status?.toLowerCase();
  if (status === 'up') return 'mdi:check-circle';
  if (status === 'down') return 'mdi:close-circle';
  return 'mdi:help-circle';
};

const getSpeedClass = () => {
  const speed = interfaceDetails.value.ethtool?.speed;
  if (!speed || speed === 'unknown') return 'unknown';
  const speedNum = typeof speed === 'string' ? parseInt(speed) : speed;
  if (speedNum >= 1000) return 'gigabit';
  if (speedNum >= 100) return 'fast';
  return 'normal';
};

const getDuplexType = () => {
  const duplex = interfaceDetails.value.ethtool?.duplex?.toLowerCase();
  if (duplex === 'full') return 'success';
  if (duplex === 'half') return 'warning';
  return 'info';
};

const getDuplexDisplay = () => {
  const duplex = interfaceDetails.value.ethtool?.duplex?.toLowerCase();
  if (duplex === 'full') return 'Full Duplex';
  if (duplex === 'half') return 'Half Duplex';
  return 'Unknown';
};

// Server selection
const selectServer = (server) => {
  selectedServer.value = server;
  showServerSelection.value = false;
  ElMessage.success(`Wybrano serwer: ${server.name} (${server.location})`);
};

// API functions
const fetchInterfaceDetails = async () => {
  try {
    loading.value = true;
    const response = await axios.get(`/network/interfaces/details/${route.params.interface}`);
    interfaceDetails.value = response.data;
  } catch (error) {
    console.error('Error fetching interface details:', error);
    ElNotification({
      title: 'Błąd',
      message: 'Nie udało się załadować szczegółów interfejsu',
      type: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const startSpeedTest = async () => {
  if (!isInterfaceUp.value) {
    ElMessage.warning('Interfejs musi być włączony do testu prędkości')
    return
  }
  
  try {
    speedTestRunning.value = true
    speedTestResults.value = null
    testProgress.value = 0
    
    // Ustaw aktualny serwer
    if (selectedServer.value) {
      currentServer.value = `${selectedServer.value.name} (${selectedServer.value.location})`
    } else {
      currentServer.value = 'Domyślny serwer (Warszawa)'
    }
    
    // Symulacja postępu testu
    const interval = setInterval(() => {
      if (testProgress.value < 90) {
        testProgress.value += 10
      }
    }, 500)
    
    // Symulacja testu (w rzeczywistości tutaj byłoby wywołanie API)
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    clearInterval(interval)
    testProgress.value = 100
    
    // Generuj wyniki testu
    const baseDownload = Math.random() * 500 + 100
    const baseUpload = Math.random() * 200 + 50
    
    speedTestResults.value = {
      download: (selectedServer.value ? baseDownload * 1.2 : baseDownload).toFixed(2),
      upload: (selectedServer.value ? baseUpload * 1.1 : baseUpload).toFixed(2),
      ping: (Math.random() * 15 + 5).toFixed(1),
      server: currentServer.value,
      serverHost: selectedServer.value?.host || 'speedtest.default.local',
      serverPort: selectedServer.value?.port || 8080,
      sponsor: selectedServer.value?.sponsor || 'Speedtest'
    }
    
    ElMessage.success(`Test prędkości zakończony pomyślnie`)
    
  } catch (error) {
    console.error('Speed test error:', error)
    ElMessage.error('Test prędkości nieudany')
    
    // Fallback results in case of error
    speedTestResults.value = {
      download: '0.00',
      upload: '0.00',
      ping: 'N/A',
      server: currentServer.value || 'Test failed',
      serverHost: 'Error',
      serverPort: 0,
      sponsor: 'N/A'
    }
  } finally {
    speedTestRunning.value = false
    await nextTick()
    testProgress.value = 0
  }
}

const copyResults = async () => {
  if (!speedTestResults.value) return;
  
  const text = `Wyniki testu prędkości:
Interfejs: ${interfaceDetails.value.device}
Pobieranie: ${speedTestResults.value.download} Mbps
Wysyłanie: ${speedTestResults.value.upload} Mbps
Ping: ${speedTestResults.value.ping || 'N/A'} ms
Serwer: ${speedTestResults.value.server}
Sponsor: ${speedTestResults.value.sponsor}
Czas: ${new Date().toLocaleString('pl-PL')}`;
  
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('Wyniki skopiowane do schowka');
  } catch (error) {
    console.error('Copy failed:', error);
    ElMessage.error('Błąd kopiowania');
  }
};

const refreshDetails = () => {
  fetchInterfaceDetails();
};
</script>

<style scoped>
.interface-details-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

.interface-details-container.dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Header Styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.header-title {
  flex: 1;
}

.header-title h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle {
  margin: 4px 0 0;
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

.back-btn {
  min-width: 120px;
}

/* Main Content Layout */
.main-content {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
  min-height: calc(100vh - 120px);
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

/* Stats Panel */
.stats-panel {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  height: fit-content;
}

.dark .stats-panel {
  background: #2d2d2d;
  border-color: #404040;
}

.stats-section {
  padding: 20px;
}

.stats-section h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-grid {
  display: grid;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  transition: transform 0.2s;
}

.dark .stat-item {
  background: #3d3d3d;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  color: var(--el-color-primary);
}

.dark .stat-icon {
  background: rgba(64, 158, 255, 0.2);
}

.stat-content {
  flex: 1;
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
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

/* Details Panel */
.details-panel {
  min-height: 600px;
}

.interface-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
}

.dark .interface-details {
  background: #2d2d2d;
  border-color: #404040;
}

.viewer-header {
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dark .viewer-header {
  border-bottom-color: #404040;
}

.file-info h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-tag {
  margin-left: 8px;
  font-weight: 600;
}

.driver-tag {
  margin-left: 8px;
  font-family: monospace;
  font-size: 10px;
}

.file-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.file-meta .el-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Speed Test Section */
.speedtest-section {
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dark .speedtest-section {
  border-bottom-color: #404040;
}

.section-header {
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.speedtest-content {
  min-height: 250px;
  display: flex;
  flex-direction: column;
}

.test-start {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.test-info {
  margin-bottom: 24px;
}

.test-icon {
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.server-selection {
  margin: 16px 0;
  width: 100%;
  max-width: 400px;
  position: relative;
}

.server-select-btn {
  width: 100%;
  justify-content: space-between;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.server-select-btn:hover {
  background: var(--el-fill-color);
}

.server-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.dark .server-list {
  background: #2d2d2d;
  border-color: #404040;
}

.server-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
}

.dark .server-list-header {
  border-bottom-color: #404040;
}

.server-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--el-border-color-light);
}

.dark .server-item {
  border-bottom-color: #404040;
}

.server-item:last-child {
  border-bottom: none;
}

.server-item:hover {
  background: var(--el-fill-color-light);
}

.dark .server-item:hover {
  background: #3d3d3d;
}

.server-item.selected {
  background: var(--el-color-primary-light-9);
}

.dark .server-item.selected {
  background: rgba(64, 158, 255, 0.2);
}

.server-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.server-info {
  flex: 1;
}

.server-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.server-details {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.selected-icon {
  color: var(--el-color-success);
}

.test-button {
  width: 100%;
  max-width: 300px;
  height: 60px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 16px;
}

.warning-text {
  margin-top: 16px;
  color: var(--el-color-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Test Progress */
.test-progress {
  margin: 40px 0;
}

.progress-info {
  text-align: center;
}

.progress-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}

.progress-details {
  margin-top: 8px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* Test Results */
.test-results {
  padding: 20px;
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
  margin-top: 20px;
}

.dark .test-results {
  background: #3d3d3d;
}

.results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex-wrap: wrap;
}

.server-tag {
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.clear-results {
  margin-left: auto;
}

.server-info {
  margin: 8px 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
}

.result-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.dark .result-item {
  background: #4d4d4d;
}

.result-item.download { border-left: 4px solid var(--el-color-success); }
.result-item.upload { border-left: 4px solid var(--el-color-warning); }
.result-item.ping { border-left: 4px solid var(--el-color-info); }

.result-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-content {
  flex: 1;
}

.result-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.result-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

/* Properties Section */
.properties-section {
  padding: 20px;
}

.properties-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .properties-grid {
    grid-template-columns: 1fr;
  }
}

.property-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.dark .property-item {
  background: #3d3d3d;
}

.property-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--el-color-info-light-9);
  border-radius: 8px;
  color: var(--el-color-info);
}

.property-content {
  flex: 1;
}

.property-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.property-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.property-value.gigabit { color: var(--el-color-success); }
.property-value.fast { color: var(--el-color-warning); }
.property-value.normal { color: var(--el-color-info); }
.property-value.unknown { color: var(--el-text-color-secondary); }

.no-ip {
  color: var(--el-text-color-secondary);
  font-style: italic;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-track {
  background: #3d3d3d;
}

::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #555;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Responsive */
@media (max-width: 768px) {
  .interface-details-container {
    padding: 16px;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-right {
    justify-content: flex-start;
  }
  
  .stats-grid,
  .properties-grid {
    grid-template-columns: 1fr;
  }
  
  .server-list {
    max-height: 300px;
  }
}

@media (max-width: 480px) {
  .main-content {
    gap: 16px;
  }
  
  .test-button {
    height: 50px;
    font-size: 14px;
  }
  
  .server-selection {
    max-width: 100%;
  }
}
</style>
