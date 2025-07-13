<template>
  <div class="interface-details">
    <el-button icon @click="$router.go(-1)" class="back-button">
      <Icon icon="mdi:arrow-left" width="20" />
    </el-button>

    <h2 class="details-title">
      <Icon icon="mdi:ethernet-cable" width="24" class="title-icon" />
      {{ $t('network.interfaces.details_for') }} {{ interfaceDetails.device }}
    </h2>

    <el-card class="details-card" shadow="hover" v-loading="loading">
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-row :gutter="20">
          <el-col :span="12" :md="8">
            <el-form-item :label="$t('network.interfaces.device')">
              <el-input v-model="interfaceDetails.device" readonly>
                <template #prefix>
                  <Icon icon="mdi:network" width="18" />
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          
      <el-col :span="12" :md="8">
        <el-form-item :label="$t('network.interfaces.method')" prop="method">
          <el-select v-model="form.method">
            <el-option value="dhcp" :label="$t('network.methods.dhcp')" />
            <el-option value="static" :label="$t('network.methods.static')" />
          </el-select>
        </el-form-item>
      </el-col>

          <el-col :span="12" :md="8">
            <el-form-item :label="$t('network.interfaces.status')">
              <el-tag :type="interfaceDetails.status === 'up' ? 'success' : 'danger'">
                {{ interfaceDetails.status }}
              </el-tag>
            </el-form-item>
          </el-col>

          <el-col :span="12" :md="8">
            <el-form-item :label="$t('network.interfaces.mac')">
              <el-input v-model="interfaceDetails.mac" readonly />
            </el-form-item>
          </el-col>

          <el-col :span="12" :md="8">
            <el-form-item :label="$t('network.interfaces.address')">
              <el-input v-model="interfaceDetails.ipv4.local" />
            </el-form-item>
          </el-col>

          <el-col :span="12" :md="8">
            <el-form-item :label="$t('network.interfaces.netmask')">
              <el-input v-model="interfaceDetails.ipv4.prefixlen" />
            </el-form-item>
          </el-col>

      <el-col :span="12" :md="8">
        <el-form-item :label="$t('network.interfaces.mtu')" prop="mtu">
          <el-input-number 
            v-model="form.mtu" 
            :min="576" 
            :max="9000" 
            controls-position="right" 
          />
        </el-form-item>
      </el-col>

          <el-col :span="24">
            <el-form-item>
              <el-button type="primary" @click="saveChanges">
                <Icon icon="mdi:content-save" width="18" class="button-icon" />
                {{ $t('network.interfaces.save') }}
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>

    <el-row :gutter="20">

      <el-col :span="12" :md="8" v-if="form.method === 'static'">
        <el-form-item :label="$t('network.interfaces.address')" prop="address">
          <el-input v-model="form.address" />
        </el-form-item>
      </el-col>

      <el-col :span="12" :md="8" v-if="form.method === 'static'">
        <el-form-item :label="$t('network.interfaces.netmask')" prop="netmask">
          <el-input-number 
            v-model="form.netmask" 
            :min="0" 
            :max="32" 
            controls-position="right" 
          />
        </el-form-item>
      </el-col>

      <el-col :span="12" :md="8" v-if="form.method === 'static'">
        <el-form-item :label="$t('network.interfaces.gateway')" prop="gateway">
          <el-input v-model="form.gateway" />
        </el-form-item>
      </el-col>

    </el-row>
  </el-form>
    </el-card>

    <el-card class="stats-card" shadow="hover">
      <div class="card-header">
        <Icon icon="mdi:chart-line" width="20" class="header-icon" />
        <span>{{ $t('network.interfaces.statistics') }}</span>
      </div>
      <el-descriptions :column="1" border>
        <el-descriptions-item :label="$t('network.interfaces.rx_bytes')">
          {{ interfaceDetails.stats?.rx_bytes || 0 }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('network.interfaces.tx_bytes')">
          {{ interfaceDetails.stats?.tx_bytes || 0 }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="speedtest-card" shadow="hover">
      <div class="card-header">
        <Icon icon="mdi:speedometer" width="20" class="header-icon" />
        <span>{{ $t('network.interfaces.speed_test') }}</span>
      </div>

      <div v-if="!speedTestRunning" class="test-controls">
        <el-button type="primary" @click="startSpeedTest" :disabled="loading">
          <Icon icon="mdi:play" width="16" class="button-icon" />
          {{ $t('network.interfaces.start_test') }}
        </el-button>
      </div>

      <div v-else class="test-progress">
        <el-progress :percentage="testProgress" status="success" />
        <div class="progress-text">
          <Icon icon="mdi:progress-clock" width="18" class="progress-icon" />
          {{ $t('network.interfaces.testing') }}
        </div>
      </div>

      <div v-if="speedTestResults" class="test-results">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="$t('network.interfaces.download')">
            {{ speedTestResults.download }} Mbps
          </el-descriptions-item>
          <el-descriptions-item :label="$t('network.interfaces.upload')">
            {{ speedTestResults.upload }} Mbps
          </el-descriptions-item>
          <el-descriptions-item :label="$t('network.interfaces.ping')">
            {{ speedTestResults.ping }} ms
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElNotification } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus';

const route = useRoute()
const interfaceDetails = ref({
  device: '',
  status: '',
  mac: '',
  mtu: 1500,
  ipv4: { local: '', prefixlen: '' },
  stats: {}
})

const form = reactive({
  method: 'dhcp',
  address: '',
  netmask: 24,
  gateway: '',
  mtu: 1500
})

const loading = ref(false)
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

// Funkcja walidacji IP
const validateIP = (ip) => {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
};

const fetchInterfaceDetails = async () => {
  try {
    loading.value = true
    const response = await axios.get(`/network/interfaces/details/${route.params.interface}`)
    interfaceDetails.value = response.data
  } catch (error) {
    console.error('Failed to fetch interface details:', error)
    ElNotification({
      title: 'Error',
      message: 'Failed to load interface details',
      type: 'error'
    })
  } finally {
    loading.value = false
  }
}

const saveChanges = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;
    
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
    await fetchInterfaceDetails(); // Odśwież dane
  } catch (error) {
    if (error.response) {
      ElMessage.error(`${error.response.data.error}: ${error.response.data.details}`);
    } else {
      ElMessage.error(error.message);
    }
  } finally {
    loading.value = false;
  }
};

// Obsługa błędów testu prędkości
const startSpeedTest = async () => {
  try {
    speedTestRunning.value = true;
    testProgress.value = 0;
    speedTestResults.value = null;
    
    // Progress simulation
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
      ElMessage.success({
        message: `Speed test completed using ${response.data.data.server} server`,
        duration: 5000
      });
    } else {
      ElMessage.error(response.data.error);
    }
  } catch (error) {
    console.error('Speed test failed:', error);
    ElMessage.error({
      message: error.response?.data?.error || 'Speed test failed',
      description: error.response?.data?.details || 'Please check your connection',
      duration: 7000
    });
  } finally {
    speedTestRunning.value = false;
  }
};

onMounted(() => {
  fetchInterfaceDetails()
})
</script>

<style scoped>
.interface-details {
  padding: 20px;
}

.back-button {
  margin-bottom: 20px;
}

.details-title {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.title-icon {
  margin-right: 12px;
}

.details-card,
.stats-card,
.speedtest-card {
  margin-bottom: 24px;
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #ebeef5;
}

.header-icon {
  margin-right: 8px;
}

.test-controls,
.test-progress,
.test-results {
  padding: 20px;
  text-align: center;
}

.test-progress {
  margin: 20px 0;
}

.progress-text {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.progress-icon {
  margin-right: 8px;
}

.button-icon {
  margin-right: 8px;
}

.el-form-item {
  margin-bottom: 18px;
}

@media (max-width: 768px) {
  .el-col {
    margin-bottom: 10px;
  }
}
</style>
