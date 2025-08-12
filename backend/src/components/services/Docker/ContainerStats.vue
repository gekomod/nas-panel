<template>
  <div class="container-stats">
    <el-card shadow="never" class="stats-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-icon size="24" class="stats-icon">
              <Icon icon="mdi:chart-line" />
            </el-icon>
            <h3>Container Statistics</h3>
            <el-tag type="info" size="small" class="container-id">
              {{ containerId.substring(0, 12) }}
            </el-tag>
          </div>
          <div class="header-actions">
            <el-button-group>
              <el-tooltip content="Refresh" placement="top">
                <el-button 
                  @click="refreshStats" 
                  :disabled="loading"
                  circle
                  size="small"
                >
                  <Icon icon="mdi:refresh" />
                </el-button>
              </el-tooltip>
              <el-tooltip content="Toggle Live Updates" placement="top">
                <el-button 
                  @click="liveStats = !liveStats"
                  :type="liveStats ? 'primary' : ''"
                  circle
                  size="small"
                >
                  <Icon icon="mdi:play" v-if="liveStats" />
                  <Icon icon="mdi:pause" v-else />
                </el-button>
              </el-tooltip>
            </el-button-group>
          </div>
        </div>
      </template>

      <div v-if="initialLoading" class="loading-state">
        <el-icon :size="32" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
        <span>Loading statistics...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <el-result icon="error" :title="error">
          <template #extra>
            <el-button @click="refreshStats">Retry</el-button>
          </template>
        </el-result>
      </div>

      <div v-else class="stats-content">
        <el-tabs v-model="activeTab" class="stats-tabs">
          <el-tab-pane label="Performance Metrics" name="metrics">
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-header">
                  <el-icon><Icon icon="mdi:cpu-64-bit" /></el-icon>
                  <span>CPU Usage</span>
                </div>
                <div class="metric-value">
                  {{ cpuPercentage.toFixed(1) }}%
                </div>
                <div ref="cpuChart" class="metric-chart"></div>
              </div>

              <div class="metric-card">
                <div class="metric-header">
                  <el-icon><Icon icon="mdi:memory" /></el-icon>
                  <span>Memory Usage</span>
                </div>
                <div class="metric-value">
                  {{ memPercentage.toFixed(1) }}%
                </div>
                <div ref="memoryChart" class="metric-chart"></div>
              </div>

              <div class="metric-card">
                <div class="metric-header">
                  <el-icon><Icon icon="mdi:network" /></el-icon>
                  <span>Network I/O</span>
                </div>
                <div class="metric-values">
                  <div class="network-in">
                    <Icon icon="mdi:download" />
                    {{ formatBytes(parseBytes(stats.NetIO?.split('/')[0] || '0B')) }}
                  </div>
                  <div class="network-out">
                    <Icon icon="mdi:upload" />
                    {{ formatBytes(parseBytes(stats.NetIO?.split('/')[1] || '0B')) }}
                  </div>
                </div>
                <div ref="networkChart" class="metric-chart"></div>
              </div>

              <div class="metric-card">
                <div class="metric-header">
                  <el-icon><Icon icon="mdi:harddisk" /></el-icon>
                  <span>Disk I/O</span>
                </div>
                <div class="metric-values">
                  <div class="disk-read">
                    <Icon icon="mdi:arrow-down" />
                    {{ formatBytes(parseBytes(stats.BlockIO?.split('/')[0] || '0B')) }}
                  </div>
                  <div class="disk-write">
                    <Icon icon="mdi:arrow-up" />
                    {{ formatBytes(parseBytes(stats.BlockIO?.split('/')[1] || '0B')) }}
                  </div>
                </div>
                <div ref="diskChart" class="metric-chart"></div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="Historical Data" name="history">
            <el-table 
              :data="historyStats" 
              style="width: 100%" 
              height="400"
              class="history-table"
            >
              <el-table-column prop="timestamp" label="Time" width="150">
                <template #default="{row}">
                  {{ new Date(row.timestamp).toLocaleTimeString() }}
                </template>
              </el-table-column>
              <el-table-column prop="cpu" label="CPU" width="100">
                <template #default="{row}">
                  <el-tag :type="getUsageTagType(row.cpu)" size="small">
                    {{ row.cpu.toFixed(1) }}%
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="memory" label="Memory" width="100">
                <template #default="{row}">
                  <el-tag :type="getUsageTagType(row.memory)" size="small">
                    {{ row.memory.toFixed(1) }}%
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="networkIn" label="Network In">
                <template #default="{row}">
                  <div class="data-cell">
                    <Icon icon="mdi:download" />
                    {{ formatBytes(row.networkIn) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="networkOut" label="Network Out">
                <template #default="{row}">
                  <div class="data-cell">
                    <Icon icon="mdi:upload" />
                    {{ formatBytes(row.networkOut) }}
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
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
const liveStats = ref(true);
const activeTab = ref('metrics');
const refreshInterval = ref(2000);

// Charts
const cpuChart = ref(null);
const memoryChart = ref(null);
const networkChart = ref(null);
const diskChart = ref(null);
let resizeObserver;

const chartInstances = ref({
  cpu: null,
  memory: null,
  network: null,
  disk: null
});

// Computed
const cpuPercentage = computed(() => {
  const perc = parseFloat(stats.value.CPUPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc));
});

const memPercentage = computed(() => {
  const perc = parseFloat(stats.value.MemPerc?.replace('%', '')) || 0;
  return Math.min(100, Math.max(0, perc));
});

// Methods
const fetchStats = async () => {
  try {
    loading.value = true;
    const response = await axios.get(`/services/docker/stats/container/${props.containerId}`);
    
    stats.value = response.data.stats || {};
    addHistoryRecord();
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
    networkIn: parseBytes(stats.value.NetIO?.split('/')[0] || '0B'),
    networkOut: parseBytes(stats.value.NetIO?.split('/')[1] || '0B'),
    diskRead: parseBytes(stats.value.BlockIO?.split('/')[0] || '0B'),
    diskWrite: parseBytes(stats.value.BlockIO?.split('/')[1] || '0B')
  };
  
  historyStats.value.unshift(record);
  if (historyStats.value.length > 50) {
    historyStats.value.pop();
  }
};

const refreshStats = () => {
  fetchStats();
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

const getUsageTagType = (value) => {
  if (value > 80) return 'danger';
  if (value > 60) return 'warning';
  return 'success';
};

const initCharts = () => {
  // Check if chart refs exist and are mounted
  if (!cpuChart.value || !memoryChart.value || !networkChart.value || !diskChart.value) {
    return;
  }

  // Destroy old instances if they exist
  [cpuChart, memoryChart, networkChart, diskChart].forEach(chart => {
    if (chart.value && echarts.getInstanceByDom(chart.value)) {
      echarts.dispose(chart.value);
    }
  });

  // Initialize new instances
  chartInstances.value.cpu = echarts.init(cpuChart.value);
  chartInstances.value.memory = echarts.init(memoryChart.value);
  chartInstances.value.network = echarts.init(networkChart.value);
  chartInstances.value.disk = echarts.init(diskChart.value);

  updateCharts();
};

const updateCharts = () => {
    if (historyStats.value.length === 0 || 
      !chartInstances.value.cpu || 
      !chartInstances.value.memory || 
      !chartInstances.value.network || 
      !chartInstances.value.disk) {
    return;
    }
  
  const timestamps = historyStats.value.map(r => new Date(r.timestamp).toLocaleTimeString()).reverse();
  const cpuData = historyStats.value.map(r => r.cpu).reverse();
  const memoryData = historyStats.value.map(r => r.memory).reverse();
  const networkInData = historyStats.value.map(r => r.networkIn / 1024 / 1024).reverse();
  const networkOutData = historyStats.value.map(r => r.networkOut / 1024 / 1024).reverse();
  const diskReadData = historyStats.value.map(r => r.diskRead / 1024 / 1024).reverse();
  const diskWriteData = historyStats.value.map(r => r.diskWrite / 1024 / 1024).reverse();
  
  const chartOptions = {
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    grid: { top: 40, right: 20, bottom: 20, left: 40 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let result = `${params[0].axisValue}<br>`;
        params.forEach(param => {
          result += `${param.marker} ${param.seriesName}: ${param.value}`;
          if (param.seriesName.includes('Usage')) result += '%';
          if (param.seriesName.includes('Traffic') || param.seriesName.includes('I/O')) result += ' MB';
          result += '<br>';
        });
        return result;
      }
    },
    xAxis: { 
      type: 'category', 
      data: timestamps,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: { type: 'value' }
  };

  chartInstances.value.cpu.setOption({
    ...chartOptions,
    title: { text: 'CPU Usage (%)', left: 'center' },
    series: [{
      name: 'CPU Usage',
      type: 'line',
      data: cpuData,
      itemStyle: { color: '#E6A23C' },
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(230, 162, 60, 0.3)' },
          { offset: 1, color: 'rgba(230, 162, 60, 0.1)' }
        ])
      }
    }]
  });

  chartInstances.value.memory.setOption({
    ...chartOptions,
    title: { text: 'Memory Usage (%)', left: 'center' },
    series: [{
      name: 'Memory Usage',
      type: 'line',
      data: memoryData,
      itemStyle: { color: '#67C23A' },
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
          { offset: 1, color: 'rgba(103, 194, 58, 0.1)' }
        ])
      }
    }]
  });

  chartInstances.value.network.setOption({
    ...chartOptions,
    title: { text: 'Network Traffic (MB)', left: 'center' },
    series: [
      {
        name: 'Network In',
        type: 'line',
        data: networkInData,
        itemStyle: { color: '#409EFF' },
        smooth: true
      },
      {
        name: 'Network Out',
        type: 'line',
        data: networkOutData,
        itemStyle: { color: '#F56C6C' },
        smooth: true
      }
    ]
  });

  chartInstances.value.disk.setOption({
    ...chartOptions,
    title: { text: 'Disk I/O (MB)', left: 'center' },
    series: [
      {
        name: 'Disk Read',
        type: 'line',
        data: diskReadData,
        itemStyle: { color: '#409EFF' },
        smooth: true
      },
      {
        name: 'Disk Write',
        type: 'line',
        data: diskWriteData,
        itemStyle: { color: '#F56C6C' },
        smooth: true
      }
    ]
  });
};

const resizeCharts = () => {
  Object.values(chartInstances.value).forEach(instance => {
    if (instance) instance.resize();
  });
};

// Lifecycle hooks
onMounted(() => {
  fetchStats();
  
  // Initialize charts after first data load
  const initChartsAfterData = () => {
    if (historyStats.value.length > 0) {
      initCharts();
    } else {
      setTimeout(initChartsAfterData, 100);
    }
  };
  
  initChartsAfterData();

  const interval = setInterval(() => {
    if (liveStats.value) {
      fetchStats();
    }
  }, refreshInterval.value);

  resizeObserver = new ResizeObserver(() => {
    resizeCharts();
  });
  
  if (cpuChart.value) {
    resizeObserver.observe(cpuChart.value);
  }

  onBeforeUnmount(() => {
    clearInterval(interval);
    disposeCharts();
  });
});

const disposeCharts = () => {
  Object.values(chartInstances.value).forEach(instance => {
    if (instance && !instance.isDisposed()) {
      instance.dispose();
    }
  });

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  chartInstances.value = {
    cpu: null,
    memory: null,
    network: null,
    disk: null
  };
};

watch(historyStats, () => {
  updateCharts();
}, { deep: true });

watch(activeTab, (newTab) => {
  if (newTab === 'metrics') {
    nextTick(() => {
      resizeCharts();
    });
  }
});
</script>

<style scoped>
.container-stats {
  height: 100%;
}

.stats-card {
  border: none;
  border-radius: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-icon {
  color: var(--el-color-primary);
}

.container-id {
  font-family: monospace;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 16px;
}

.error-state {
  color: var(--el-color-error);
}

.stats-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.stats-tabs {
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
}

.stats-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
}

.metric-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 280px;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 500;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 12px;
  color: var(--el-color-primary);
}

.metric-values {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.network-in,
.network-out,
.disk-read,
.disk-write {
  display: flex;
  align-items: center;
  gap: 6px;
}

.network-in {
  color: var(--el-color-primary);
}

.network-out {
  color: var(--el-color-danger);
}

.disk-read {
  color: var(--el-color-success);
}

.disk-write {
  color: var(--el-color-warning);
}

.metric-chart {
  flex: 1;
  width: 100%;
}

.history-table {
  padding: 0 16px;
}

.data-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>