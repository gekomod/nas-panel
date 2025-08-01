<template>
  <div class="container-stats">
    <div class="header">
      <h3>Container Statistics</h3>
      <div class="controls">
        <el-button
          size="small"
          @click="refreshStats"
          :disabled="loading"
          circle
        >
          <Icon icon="mdi:refresh" />
        </el-button>
        <el-switch
          v-model="liveStats"
          active-text="Live"
          inactive-text="Static"
          :disabled="loading"
        />
        <el-button
          size="small"
          @click="showSettings = true"
          circle
        >
          <Icon icon="mdi:cog" />
        </el-button>
      </div>
    </div>

    <div v-if="initialLoading" class="loading-state">
      <Icon icon="mdi:loading" class="spin" />
      <span>Loading statistics...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle" />
      <span>{{ error }}</span>
      <el-button size="small" @click="refreshStats">Retry</el-button>
    </div>

    <div v-else class="stats-container">
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane label="Overview" name="overview">
          <div class="stats-grid">
            <!-- CPU Stats -->
            <el-card class="stat-card">
              <div class="stat-header">
                <Icon icon="mdi:cpu-64-bit" />
                <span>CPU Usage</span>
              </div>
              <div class="stat-value">{{ cpuPercentage }}%</div>
              <el-progress
                :percentage="cpuPercentage"
                :color="getProgressColor(cpuPercentage)"
                :show-text="false"
                :stroke-width="12"
              />
              <div class="stat-details">
                <div>Cores: {{ cpuCores }}</div>
                <div>Load: {{ cpuLoad }}</div>
              </div>
            </el-card>

            <!-- Memory Stats -->
            <el-card class="stat-card">
              <div class="stat-header">
                <Icon icon="mdi:memory" />
                <span>Memory Usage</span>
              </div>
              <div class="stat-value">{{ memPercentage }}%</div>
              <el-progress
                :percentage="memPercentage"
                :color="getProgressColor(memPercentage)"
                :show-text="false"
                :stroke-width="12"
              />
              <div class="stat-details">
                <div>Used: {{ formattedMemUsage.used }}</div>
                <div>Total: {{ formattedMemUsage.total }}</div>
              </div>
            </el-card>

            <!-- Network Stats -->
            <el-card class="stat-card">
              <div class="stat-header">
                <Icon icon="mdi:network" />
                <span>Network I/O</span>
              </div>
              <div class="network-stats">
                <div class="network-row">
                  <Icon icon="mdi:download" />
                  <span class="label">In:</span>
                  <span class="value">{{ formattedNetIO.rx }}</span>
                </div>
                <div class="network-row">
                  <Icon icon="mdi:upload" />
                  <span class="label">Out:</span>
                  <span class="value">{{ formattedNetIO.tx }}</span>
                </div>
              </div>
            </el-card>

            <!-- Disk Stats -->
            <el-card class="stat-card">
              <div class="stat-header">
                <Icon icon="mdi:harddisk" />
                <span>Disk I/O</span>
              </div>
              <div class="disk-stats">
                <div class="disk-row">
                  <Icon icon="mdi:download" />
                  <span class="label">Read:</span>
                  <span class="value">{{ formattedBlockIO.rx }}</span>
                </div>
                <div class="disk-row">
                  <Icon icon="mdi:upload" />
                  <span class="label">Write:</span>
                  <span class="value">{{ formattedBlockIO.tx }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Charts" name="charts">
          <div class="charts-container">
            <div ref="cpuChart" class="chart"></div>
            <div ref="memoryChart" class="chart"></div>
            <div ref="networkChart" class="chart"></div>
            <div ref="diskChart" class="chart"></div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="History" name="history">
          <el-table :data="historyStats" style="width: 100%" height="300">
            <el-table-column prop="timestamp" label="Time" width="180">
              <template #default="{row}">
                {{ new Date(row.timestamp).toLocaleTimeString() }}
              </template>
            </el-table-column>
            <el-table-column prop="cpu" label="CPU" width="100">
              <template #default="{row}">
                {{ row.cpu.toFixed(1) }}%
              </template>
            </el-table-column>
            <el-table-column prop="memory" label="Memory" width="100">
              <template #default="{row}">
                {{ row.memory.toFixed(1) }}%
              </template>
            </el-table-column>
            <el-table-column prop="networkIn" label="Network In">
              <template #default="{row}">
                {{ formatBytes(row.networkIn) }}
              </template>
            </el-table-column>
            <el-table-column prop="networkOut" label="Network Out">
              <template #default="{row}">
                {{ formatBytes(row.networkOut) }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Settings Dialog -->
    <el-dialog v-model="showSettings" title="Statistics Settings" width="500px">
      <el-form label-width="150px">
        <el-form-item label="Refresh Interval (ms)">
          <el-input-number
            v-model="refreshInterval"
            :min="1000"
            :max="30000"
            :step="1000"
          />
        </el-form-item>
        <el-form-item label="History Size">
          <el-input-number
            v-model="maxHistory"
            :min="10"
            :max="1000"
            :step="10"
          />
        </el-form-item>
        <el-form-item label="CPU Warning Threshold">
          <el-slider
            v-model="thresholds.cpu"
            :min="0"
            :max="100"
            :step="5"
            show-input
          />
        </el-form-item>
        <el-form-item label="Memory Warning Threshold">
          <el-slider
            v-model="thresholds.memory"
            :min="0"
            :max="100"
            :step="5"
            show-input
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">Cancel</el-button>
        <el-button type="primary" @click="saveSettings">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { Icon } from '@iconify/vue';

const props = defineProps({
  containerId: String
});

const stats = ref({});
const historyStats = ref([]);
const initialLoading = ref(true);
const loading = ref(false);
const error = ref(null);
const liveStats = ref(false);
const activeTab = ref('overview');
const showSettings = ref(false);

const refreshInterval = ref(2000);
const maxHistory = ref(100);
const thresholds = ref({
  cpu: 80,
  memory: 80
});

// Charts
const cpuChart = ref(null);
const memoryChart = ref(null);
const networkChart = ref(null);
const diskChart = ref(null);

// Computed
const formattedMemUsage = computed(() => {
  if (!stats.value.MemUsage) return { used: 'N/A', total: 'N/A' };
  const [used, total] = stats.value.MemUsage.split('/').map(s => s.trim());
  return { used, total };
});

const formattedNetIO = computed(() => {
  if (!stats.value.NetIO) return { rx: 'N/A', tx: 'N/A' };
  const cleaned = stats.value.NetIO.replace(/\n/g, '').trim();
  const [rx, tx] = cleaned.split('/').map(s => s.trim());
  return { rx, tx };
});

const formattedBlockIO = computed(() => {
  if (!stats.value.BlockIO) return { rx: 'N/A', tx: 'N/A' };
  const cleaned = stats.value.BlockIO.replace(/\n/g, '').trim();
  const [rx, tx] = cleaned.split('/').map(s => s.trim());
  return { rx, tx };
});

const cpuPercentage = computed(() => {
  const perc = parseFloat(stats.value.CPUPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc));
});

const memPercentage = computed(() => {
  const perc = parseFloat(stats.value.MemPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc));
});

const cpuCores = computed(() => {
  return stats.value.CPUCores || 'N/A';
});

const cpuLoad = computed(() => {
  return stats.value.CPULoad || 'N/A';
});

// Methods
const fetchStats = async () => {
  try {
    loading.value = true;
    const response = await axios.get(`/services/docker/stats/container/${props.containerId}`);
    
    stats.value = response.data.stats || {};
    addHistoryRecord();
    checkThresholds();
    error.value = null;
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch stats';
    console.error('Error fetching stats:', err);
  } finally {
    initialLoading.value = false;
    loading.value = false;
  }
};

const addHistoryRecord = () => {
  const record = {
    timestamp: new Date().toISOString(),
    cpu: cpuPercentage.value,
    memory: memPercentage.value,
    networkIn: parseBytes(formattedNetIO.value.rx),
    networkOut: parseBytes(formattedNetIO.value.tx),
    diskRead: parseBytes(formattedBlockIO.value.rx),
    diskWrite: parseBytes(formattedBlockIO.value.tx)
  };
  
  historyStats.value.unshift(record);
  if (historyStats.value.length > maxHistory.value) {
    historyStats.value.pop();
  }
};

const checkThresholds = () => {
  if (cpuPercentage.value > thresholds.value.cpu) {
    showAlert('CPU', cpuPercentage.value, `High CPU usage: ${cpuPercentage.value}%`);
  }
  
  if (memPercentage.value > thresholds.value.memory) {
    showAlert('Memory', memPercentage.value, `High Memory usage: ${memPercentage.value}%`);
  }
};

const showAlert = (metric, value, message) => {
  console.warn(`[ALERT] ${message}`);
};

const refreshStats = () => {
  if (!liveStats.value) {
    fetchStats();
  }
};

const parseBytes = (str) => {
  if (!str || str === 'N/A') return 0;
  const units = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
  const match = str.match(/^([\d.]+)\s*([KMGTP]?B)/i);
  if (!match) return 0;
  return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
};

const formatBytes = (bytes) => {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getProgressColor = (percentage) => {
  if (percentage < 50) return '#67C23A';
  if (percentage < 80) return '#E6A23C';
  return '#F56C6C';
};

const initCharts = () => {
  if (!cpuChart.value) return;
  
  const cpuChartInstance = echarts.init(cpuChart.value);
  const memoryChartInstance = echarts.init(memoryChart.value);
  const networkChartInstance = echarts.init(networkChart.value);
  const diskChartInstance = echarts.init(diskChart.value);
  
  const updateCharts = () => {
    if (historyStats.value.length === 0) return;
    
    const timestamps = historyStats.value.map(r => new Date(r.timestamp).toLocaleTimeString()).reverse();
    const cpuData = historyStats.value.map(r => r.cpu).reverse();
    const memoryData = historyStats.value.map(r => r.memory).reverse();
    const networkInData = historyStats.value.map(r => r.networkIn / 1024 / 1024).reverse(); // MB
    const networkOutData = historyStats.value.map(r => r.networkOut / 1024 / 1024).reverse(); // MB
    const diskReadData = historyStats.value.map(r => r.diskRead / 1024 / 1024).reverse(); // MB
    const diskWriteData = historyStats.value.map(r => r.diskWrite / 1024 / 1024).reverse(); // MB
    
    cpuChartInstance.setOption(getChartOption('CPU Usage (%)', timestamps, cpuData, '#E6A23C'));
    memoryChartInstance.setOption(getChartOption('Memory Usage (%)', timestamps, memoryData, '#67C23C'));
    networkChartInstance.setOption(getChartOption('Network Traffic (MB)', timestamps, [
      { name: 'In', data: networkInData },
      { name: 'Out', data: networkOutData }
    ], ['#409EFF', '#F56C6C']));
    diskChartInstance.setOption(getChartOption('Disk I/O (MB)', timestamps, [
      { name: 'Read', data: diskReadData },
      { name: 'Write', data: diskWriteData }
    ], ['#409EFF', '#F56C6C']));
  };
  
  const getChartOption = (title, xAxis, series, color) => ({
    title: { text: title, left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xAxis },
    yAxis: { type: 'value' },
    series: Array.isArray(series) 
      ? series.map((s, i) => ({
          name: s.name,
          type: 'line',
          data: s.data,
          itemStyle: { color: Array.isArray(color) ? color[i] : color },
          smooth: true
        }))
      : [{
          type: 'line',
          data: series,
          itemStyle: { color },
          smooth: true
        }],
    grid: { top: 40, right: 20, bottom: 20, left: 40 }
  });
  
  updateCharts();
  window.addEventListener('resize', () => {
    cpuChartInstance.resize();
    memoryChartInstance.resize();
    networkChartInstance.resize();
    diskChartInstance.resize();
  });
  
  watch(historyStats, updateCharts, { deep: true });
};

const saveSettings = () => {
  showSettings.value = false;
};

// Lifecycle hooks
onMounted(() => {
  fetchStats();
  nextTick(initCharts);
  
  watch(liveStats, (enabled) => {
    if (enabled) {
      const interval = setInterval(fetchStats, refreshInterval.value);
      onBeforeUnmount(() => clearInterval(interval));
    }
  }, { immediate: true });
});

onBeforeUnmount(() => {
  if (cpuChart.value) {
    echarts.dispose(cpuChart.value);
    echarts.dispose(memoryChart.value);
    echarts.dispose(networkChart.value);
    echarts.dispose(diskChart.value);
  }
});
</script>

<style scoped>
.container-stats {
  padding: 15px;
  height: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 10px;
}

.error-state {
  color: var(--el-color-error);
}

.stats-container {
  height: calc(100% - 50px);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.stat-card {
  height: 100%;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: bold;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
}

.stat-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.network-stats,
.disk-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.network-row,
.disk-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  min-width: 40px;
  color: var(--el-text-color-secondary);
}

.value {
  font-weight: bold;
}

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 15px;
}

.chart {
  height: 250px;
  width: 100%;
}

:deep(.el-tabs__content) {
  padding: 15px 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
