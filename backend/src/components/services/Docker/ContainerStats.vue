<template>
  <div class="container-stats">
    <div class="controls">
      <button @click="refreshStats" :disabled="loading" class="refresh-btn">
        <Icon icon="mdi:refresh" :class="{ 'spin': loading }" />
        <span>Refresh</span>
      </button>
      <label class="switch">
        <input type="checkbox" v-model="liveStats" :disabled="loading">
        <span class="slider">{{ liveStats ? 'Live' : 'Static' }}</span>
      </label>
    </div>

    <div v-if="initialLoading" class="loading">
      <Icon icon="mdi:loading" class="spin" />
      <span>Loading...</span>
    </div>

    <div v-else-if="error" class="error">
      <Icon icon="mdi:alert-circle" />
      <span>{{ error }}</span>
    </div>

    <div v-else class="stats">
      <!-- Memory -->
      <div class="stat">
        <div class="title">
          <Icon icon="mdi:memory" />
          <span>Memory</span>
        </div>
        <div class="values">
          <span class="main">{{ formattedMemUsage.used || 'N/A' }}</span>
          <span class="secondary">/ {{ formattedMemUsage.total || 'N/A' }}</span>
        </div>
        <div class="progress-row">
          <div class="progress-bar" :style="progressStyle(memPercentage)"></div>
          <span class="percent">{{ memPercentage.toFixed(0) }}%</span>
        </div>
      </div>

      <!-- CPU -->
      <div class="stat">
        <div class="title">
          <Icon icon="mdi:cpu-64-bit" />
          <span>CPU</span>
        </div>
        <div class="values">
          <span class="main">{{ stats.CPUPerc || 'N/A' }}</span>
        </div>
        <div class="progress-row">
          <div class="progress-bar" :style="progressStyle(cpuPercentage)"></div>
          <span class="percent">{{ cpuPercentage.toFixed(0) }}%</span>
        </div>
      </div>

      <!-- Network -->
      <div class="stat">
        <div class="title">
          <Icon icon="mdi:network" />
          <span>Network</span>
        </div>
        <div class="io">
          <div class="io-row">
            <Icon icon="mdi:download" />
            <span>{{ formattedNetIO.rx || 'N/A' }}</span>
          </div>
          <div class="io-row">
            <Icon icon="mdi:upload" />
            <span>{{ formattedNetIO.tx || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- Disk -->
      <div class="stat">
        <div class="title">
          <Icon icon="mdi:harddisk" />
          <span>Disk</span>
        </div>
        <div class="io">
          <div class="io-row">
            <Icon icon="mdi:download" />
            <span>{{ formattedBlockIO.rx || 'N/A' }}</span>
          </div>
          <div class="io-row">
            <Icon icon="mdi:upload" />
            <span>{{ formattedBlockIO.tx || 'N/A' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';

const props = defineProps({
  containerId: String
});

const emit = defineEmits(['loading', 'error']);

const stats = ref({});
const initialLoading = ref(true);
const loading = ref(false);
const error = ref(null);
const liveStats = ref(false);
let statsInterval = null;

// Computed properties
const formattedMemUsage = computed(() => {
  if (!stats.value.MemUsage) return {};
  const [used, total] = stats.value.MemUsage.split('/').map(s => s.trim());
  return { used, total };
});

const formattedNetIO = computed(() => {
  if (!stats.value.NetIO) return {};
  const cleaned = stats.value.NetIO.replace(/\n/g, '').trim();
  const [rx, tx] = cleaned.split('/').map(s => s.trim());
  return { rx, tx };
});

const formattedBlockIO = computed(() => {
  if (!stats.value.BlockIO) return {};
  const cleaned = stats.value.BlockIO.replace(/\n/g, '').trim();
  const [rx, tx] = cleaned.split('/').map(s => s.trim());
  return { rx, tx };
});

const memPercentage = computed(() => {
  const perc = parseFloat(stats.value.MemPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc)); // Ensure value is between 0-100
});

const cpuPercentage = computed(() => {
  const perc = parseFloat(stats.value.CPUPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc)); // Ensure value is between 0-100
});

const getProgressColor = (percentage) => {
  if (percentage < 50) return '#67C23A';
  if (percentage < 80) return '#E6A23C';
  return '#F56C6C';
};

// Optimized stats fetching
const fetchStats = async () => {
  try {
    emit('loading', true);
    initialLoading.value = true;
    error.value = null;
    
    const response = await axios.get(`/services/docker/stats/container/${props.containerId}`, {
      params: { stream: liveStats.value },
      timeout: 5000
    });
    
    stats.value = response.data.stats || response.data.rawStats || {};
    error.value = null;
    emit('error', null);
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch stats';
    emit('error', error.value);
    console.error('Error fetching stats:', error.value);
    
    if (initialLoading.value) {
      stats.value = {};
    }
  } finally {
    initialLoading.value = false;
    loading.value = false;
    emit('loading', false);
  }
};

const refreshStats = () => {
  if (!liveStats.value) {
    fetchStats();
  }
};

// Improved live stats handling
watch(liveStats, (newVal) => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  if (newVal) {
    fetchStats(); // Immediate fetch
    statsInterval = setInterval(fetchStats, 3000); // Refresh every 3 seconds
  }
}, { immediate: true });

watch(() => props.containerId, (newId) => {
  if (newId) {
    initialLoading.value = true;
    stats.value = {};
    fetchStats();
  }
}, { immediate: true });

const progressStyle = (percent) => {
  const color = percent > 90 ? '#f56c6c' : percent > 70 ? '#e6a23c' : '#67c23a';
  return {
    width: `${percent}%`,
    'background-color': color
  };
};

onMounted(() => {
  fetchStats();
});

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval);
  }
});
</script>

<style scoped>
.container-stats {
  font-family: 'Segoe UI', system-ui, sans-serif;
  padding: 16px;
}

.controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--el-text-color-regular);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.refresh-btn:hover {
  background: var(--el-fill-color-light);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch {
  position: relative;
  display: inline-block;
  width: 80px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--el-fill-color-light);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: .2s;
}

.switch input:checked + .slider {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.loading, .error {
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.error {
  color: var(--el-color-error);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  height: 120px;
  display: flex;
  flex-direction: column;
}

.title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.values {
  margin-bottom: 8px;
}

.main {
  font-size: 18px;
  font-weight: 500;
}

.secondary {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  flex-grow: 1;
}

.percent {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  min-width: 24px;
  text-align: right;
}

.io {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.io-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.io-row:first-child {
  color: var(--el-color-success);
}

.io-row:last-child {
  color: var(--el-color-warning);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
