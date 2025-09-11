<template>
  <div class="interface-details-container">
    <!-- Header z breadcrumbs -->
    <div class="details-header">
      <el-button @click="$router.go(-1)" class="back-btn" size="large" text>
        <Icon icon="mdi:arrow-left" width="24" />
        {{ $t('common.back') }}
      </el-button>
      
      <div class="header-title">
        <Icon :icon="getInterfaceIcon()" width="28" class="title-icon" />
        <h1>{{ interfaceDetails.device }}</h1>
        <el-tag :type="getStatusType()" size="large" class="status-tag">
          <Icon :icon="getStatusIcon()" width="16" />
          {{ interfaceDetails.status?.toUpperCase() }}
        </el-tag>
      </div>
      
      <div class="header-actions">
        <el-button type="primary" @click="saveChanges" :loading="saving">
          <Icon icon="mdi:content-save" width="18" />
          {{ $t('common.save') }}
        </el-button>
        <el-button @click="refreshDetails">
          <Icon icon="mdi:refresh" width="18" />
        </el-button>
      </div>
    </div>

    <!-- Karty w układzie grid -->
    <div class="details-grid">
      <!-- Karta podstawowych informacji -->
      <el-card class="info-card" shadow="never">
        <template #header>
          <div class="card-header">
            <Icon icon="mdi:information" width="20" />
            <span>{{ $t('network.interfaces.basic_info') }}</span>
          </div>
        </template>
        
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <div class="form-grid">
            <el-form-item :label="$t('network.interfaces.device')">
              <el-input v-model="interfaceDetails.device" readonly>
                <template #prefix>
                  <Icon icon="mdi:network" width="18" />
                </template>
              </el-input>
            </el-form-item>

            <el-form-item :label="$t('network.interfaces.mac')">
              <el-input v-model="interfaceDetails.mac" readonly />
            </el-form-item>

            <el-form-item :label="$t('network.interfaces.method')" prop="method">
              <el-select v-model="form.method" class="w-full">
                <el-option value="dhcp" :label="$t('network.methods.dhcp')" />
                <el-option value="static" :label="$t('network.methods.static')" />
              </el-select>
            </el-form-item>

            <el-form-item :label="$t('network.interfaces.mtu')" prop="mtu">
              <el-input-number 
                v-model="form.mtu" 
                :min="576" 
                :max="9000"
                controls-position="right"
                class="w-full"
              />
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <!-- Karta adresacji IP -->
      <el-card class="ip-card" shadow="never" v-if="form.method === 'static'">
        <template #header>
          <div class="card-header">
            <Icon icon="mdi:ip-network" width="20" />
            <span>{{ $t('network.interfaces.ip_config') }}</span>
          </div>
        </template>

        <el-form :model="form" :rules="rules" ref="formRef">
          <div class="form-grid">
            <el-form-item :label="$t('network.interfaces.address')" prop="address">
              <el-input v-model="form.address" placeholder="192.168.1.100">
                <template #prefix>
                  <Icon icon="mdi:ip" width="18" />
                </template>
              </el-input>
            </el-form-item>

            <el-form-item :label="$t('network.interfaces.netmask')" prop="netmask">
              <el-input-number 
                v-model="form.netmask" 
                :min="0" 
                :max="32"
                controls-position="right"
                class="w-full"
              />
            </el-form-item>

            <el-form-item :label="$t('network.interfaces.gateway')" prop="gateway">
              <el-input v-model="form.gateway" placeholder="192.168.1.1">
                <template #prefix>
                  <Icon icon="mdi:gate" width="18" />
                </template>
              </el-input>
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <!-- Karta prędkości i statystyk -->
      <el-card class="stats-card" shadow="never">
        <template #header>
          <div class="card-header">
            <Icon icon="mdi:speedometer" width="20" />
            <span>{{ $t('network.interfaces.performance') }}</span>
          </div>
        </template>

        <div class="performance-grid">
          <!-- Prędkość interfejsu -->
          <div class="performance-item">
            <div class="performance-label">
              <Icon icon="mdi:ethernet-cable" width="18" />
              {{ $t('network.interfaces.speed') }}
            </div>
            <div class="performance-value" :class="getSpeedClass()">
              {{ interfaceDetails.ethtool?.speed || 'N/A' }}
            </div>
            <div class="performance-subtext">
              <el-tag :type="getDuplexType()" size="small">
                {{ getDuplexDisplay() }}
              </el-tag>
            </div>
          </div>

          <!-- Statystyki RX/TX -->
          <div class="performance-item">
            <div class="performance-label">
              <Icon icon="mdi:download" width="18" />
              {{ $t('network.interfaces.rx_bytes') }}
            </div>
            <div class="performance-value">
              {{ formatBytes(interfaceDetails.stats?.rx_bytes || 0) }}
            </div>
          </div>

          <div class="performance-item">
            <div class="performance-label">
              <Icon icon="mdi:upload" width="18" />
              {{ $t('network.interfaces.tx_bytes') }}
            </div>
            <div class="performance-value">
              {{ formatBytes(interfaceDetails.stats?.tx_bytes || 0) }}
            </div>
          </div>

          <!-- Driver info -->
          <div class="performance-item" v-if="interfaceDetails.ethtool?.driver">
            <div class="performance-label">
              <Icon icon="mdi:chip" width="18" />
              {{ $t('network.interfaces.driver') }}
            </div>
            <div class="performance-value small">
              {{ interfaceDetails.ethtool.driver }}
            </div>
          </div>
        </div>
      </el-card>

      <!-- Karta testu prędkości -->
      <el-card class="speedtest-card" shadow="never">
        <template #header>
          <div class="card-header">
            <Icon icon="mdi:internet" width="20" />
            <span>{{ $t('network.interfaces.speed_test') }}</span>
          </div>
        </template>

        <div class="speedtest-content">
          <div v-if="!speedTestRunning" class="test-controls">
            <el-button 
              type="primary" 
              @click="startSpeedTest" 
              :disabled="loading"
              size="large"
              class="test-button"
            >
              <Icon icon="mdi:play" width="18" />
              {{ $t('network.interfaces.start_test') }}
            </el-button>
          </div>

          <div v-else class="test-progress">
            <el-progress 
              :percentage="testProgress" 
              :status="testProgress < 100 ? 'success' : 'success'"
              :stroke-width="16"
              striped
              striped-flow
            />
            <div class="progress-text">
              <Icon icon="mdi:progress-clock" width="18" />
              {{ $t('network.interfaces.testing') }}...
            </div>
          </div>

          <div v-if="speedTestResults" class="test-results">
  <div class="results-header">
    <Icon icon="mdi:check-circle" width="20" color="var(--el-color-success)" />
    <span>Test completed</span>
    <el-tag size="small" type="info" class="server-tag">
      {{ speedTestResults.server }}
    </el-tag>
  </div>
            
              <div class="server-info" v-if="speedTestResults.serverHost">
    <small>Server: {{ speedTestResults.serverHost }}</small>
  </div>
            
            <div class="results-grid">
              <div class="result-item download">
                <div class="result-label">
                  <Icon icon="mdi:download" width="20" />
                  Download
                </div>
                <div class="result-value">
                  {{ speedTestResults.download }} Mbps
                </div>
              </div>
              
              <div class="result-item upload">
                <div class="result-label">
                  <Icon icon="mdi:upload" width="20" />
                  Upload
                </div>
                <div class="result-value">
                  {{ speedTestResults.upload }} Mbps
                </div>
              </div>
              
              <div class="result-item ping">
                <div class="result-label">
                  <Icon icon="mdi:ping" width="20" />
                  Ping
                </div>
                <div class="result-value">
                  {{ speedTestResults.ping }} ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
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
  ethtool: {}
})

const form = reactive({
  method: 'dhcp',
  address: '',
  netmask: 24,
  gateway: '',
  mtu: 1500
})

const loading = ref(false)
const saving = ref(false)
const speedTestRunning = ref(false)
const speedTestResults = ref(null)
const testProgress = ref(0)
const formRef = ref(null)

const rules = reactive({
  address: [
    { 
      validator: (rule, value, callback) => {
        if (form.method === 'static' && !validateIP(value)) {
          callback(new Error('Invalid IP address'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  netmask: [
    {
      validator: (rule, value, callback) => {
        if (form.method === 'static' && (value < 0 || value > 32)) {
          callback(new Error('Netmask must be between 0-32'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  gateway: [
    {
      validator: (rule, value, callback) => {
        if (form.method === 'static' && value && !validateIP(value)) {
          callback(new Error('Invalid gateway IP'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
});

// Computed properties
const isInterfaceUp = computed(() => {
  const status = interfaceDetails.value.status?.toLowerCase();
  return status === 'up' || status === 'unknown';
});

// Funkcje pomocnicze
const validateIP = (ip) => {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getInterfaceIcon = () => {
  const device = interfaceDetails.value.device?.toLowerCase() || '';
  if (device.includes('eth') || device.includes('en')) return 'mdi:ethernet-cable';
  if (device.includes('wlan') || device.includes('wlp')) return 'mdi:wifi';
  if (device.includes('tun') || device.includes('tap')) return 'mdi:tunnel';
  return 'mdi:network';
};

const getStatusType = () => {
  const status = interfaceDetails.value.status?.toLowerCase();
  if (status === 'up' || status === 'unknown') return 'success';
  return 'danger';
};

const getStatusIcon = () => {
  const status = interfaceDetails.value.status?.toLowerCase();
  if (status === 'up' || status === 'unknown') return 'mdi:check-circle';
  return 'mdi:close-circle';
};

const getSpeedClass = () => {
  const speed = interfaceDetails.value.ethtool?.speed;
  if (!speed || speed === 'unknown' || speed === 'N/A') return 'unknown';
  
  const speedValue = parseInt(speed.replace(/[^\d]/g, ''));
  if (speedValue >= 1000) return 'gigabit';
  if (speedValue >= 100) return 'fast';
  return 'slow';
};

const getDuplexType = () => {
  const duplex = interfaceDetails.value.ethtool?.duplex?.toLowerCase();
  if (duplex === 'full') return 'success';
  if (duplex === 'half') return 'warning';
  return 'info'; // Dla unknown
};

const getDuplexDisplay = () => {
  const duplex = interfaceDetails.value.ethtool?.duplex?.toLowerCase();
  if (duplex === 'full') return 'Full Duplex';
  if (duplex === 'half') return 'Half Duplex';
  return 'Unknown Duplex';
};

// API calls
const fetchInterfaceDetails = async () => {
  try {
    loading.value = true;
    const response = await axios.get(`/network/interfaces/details/${route.params.interface}`);
    interfaceDetails.value = response.data;
    
    // Debug: sprawdź co przychodzi z API
    console.log('Interface details:', response.data);
    
    // Uzupełnij formularz danymi
    form.method = response.data.config?.['IP4.ADDRESS[1]'] ? 'static' : 'dhcp';
    form.mtu = response.data.mtu || 1500;
    
    if (response.data.ipv4) {
      form.address = response.data.ipv4.local || '';
      form.netmask = response.data.ipv4.prefixlen || 24;
    }
    
  } catch (error) {
    ElNotification({
      title: 'Error',
      message: 'Failed to load interface details',
      type: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const saveChanges = async () => {
  try {
    await formRef.value.validate();
    saving.value = true;
    
    const response = await axios.post(
      `/network/interfaces/details/${route.params.interface}`,
      {
        method: form.method,
        address: form.method === 'static' ? form.address : null,
        netmask: form.method === 'static' ? form.netmask : null,
        gateway: form.method === 'static' ? form.gateway : null,
        mtu: form.mtu
      }
    );

    ElMessage.success(response.data.message);
    await fetchInterfaceDetails();
  } catch (error) {
    ElMessage.error(error.response?.data?.details || error.message);
  } finally {
    saving.value = false;
  }
};

const startSpeedTest = async () => {
  try {
    speedTestRunning.value = true;
    testProgress.value = 0;
    speedTestResults.value = null;
    
    const progressInterval = setInterval(() => {
      testProgress.value = Math.min(testProgress.value + 2, 90);
    }, 300);

    const response = await axios.post(
      `/network/interfaces/details/${route.params.interface}/speedtest`
    );

    clearInterval(progressInterval);
    testProgress.value = 100;
    
    if (response.data.success) {
      speedTestResults.value = response.data.data;
      ElMessage.success(`Speed test completed using ${response.data.data.server} server`);
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || 'Speed test failed');
  } finally {
    speedTestRunning.value = false;
  }
};

const refreshDetails = () => {
  fetchInterfaceDetails();
};

onMounted(() => {
  fetchInterfaceDetails();
});
</script>

<style scoped>
.interface-details-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 300px;
}

.header-title h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.title-icon {
  color: var(--el-color-primary);
}

.status-tag {
  margin-left: 12px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-grid {
  display: grid;
  gap: 16px;
}

.w-full {
  width: 100%;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.performance-item {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.performance-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.performance-value {
  font-size: 20px;
  font-weight: 700;
}

.performance-value.gigabit { color: var(--el-color-success); }
.performance-value.fast { color: var(--el-color-warning); }
.performance-value.slow { color: var(--el-color-danger); }
.performance-value.unknown { 
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.performance-value.small {
  font-size: 14px;
  font-weight: 600;
}

.performance-subtext {
  margin-top: 6px;
}

.speedtest-content {
  padding: 8px 0;
}

.test-button {
  width: 100%;
  height: 60px;
  font-size: 16px;
  font-weight: 600;
}

.test-progress {
  margin: 20px 0;
}

.progress-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}

.test-results {
  margin-top: 24px;
}

.results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.result-item {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.result-item.download { border-left: 4px solid var(--el-color-success); }
.result-item.upload { border-left: 4px solid var(--el-color-warning); }
.result-item.ping { border-left: 4px solid var(--el-color-info); }

.result-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.result-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.server-tag {
  margin-left: 8px;
}

.server-info {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* Responsywność */
@media (max-width: 1024px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .header-title {
    min-width: auto;
  }
}

@media (max-width: 768px) {
  .interface-details-container {
    padding: 16px;
  }
  
  .details-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-title {
    justify-content: center;
    text-align: center;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .performance-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .results-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .performance-grid {
    grid-template-columns: 1fr;
  }
  
  .form-grid {
    gap: 12px;
  }
  
  .header-title h1 {
    font-size: 24px;
  }
}
</style>
