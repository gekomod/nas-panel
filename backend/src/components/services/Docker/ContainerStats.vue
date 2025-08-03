<template>
  <div class="container-stats">
    <div class="header">
      <h3>Container Statistics - {{ containerId }}</h3>
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
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Charts" name="charts">
          <div class="charts-container">
            <div ref="cpuChart" class="chart"></div>
            <div ref="memoryChart" class="chart"></div>
            <div ref="networkChart" class="chart"></div>
            <div ref="diskChart" class="chart"></div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="History" name="history">
          <el-table :data="historyStats" style="width: 100%" height="400">
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

const emit = defineEmits(['close']);

const stats = ref({});
const historyStats = ref([]);
const initialLoading = ref(true);
const loading = ref(false);
const error = ref(null);
const liveStats = ref(true);
const activeTab = ref('charts');
const refreshInterval = ref(2000);

// Charts
const cpuChart = ref(null);
const memoryChart = ref(null);
const networkChart = ref(null);
const diskChart = ref(null);

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
    networkOut: parseBytes(stats.value.NetIO?.split('/')[1] || '0B')
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

const initCharts = () => {
  if (!cpuChart.value || historyStats.value.length === 0) return;
  
  // Destroy old instances if they exist
  [cpuChart, memoryChart, networkChart, diskChart].forEach(chart => {
    if (chart.value && echarts.getInstanceByDom(chart.value)) {
      echarts.dispose(chart.value);
    }
  });

  // Initialize or reinitialize charts
  chartInstances.value.cpu = echarts.init(cpuChart.value);
  chartInstances.value.memory = echarts.init(memoryChart.value);
  chartInstances.value.network = echarts.init(networkChart.value);
  chartInstances.value.disk = echarts.init(diskChart.value);

  const updateCharts = () => {
  if (historyStats.value.length === 0 || 
      !chartInstances.value.cpu || 
      !chartInstances.value.memory || 
      !chartInstances.value.network || 
      !chartInstances.value.disk) return;
    
  const timestamps = historyStats.value.map(r => new Date(r.timestamp).toLocaleTimeString()).reverse();
  const cpuData = historyStats.value.map(r => r.cpu).reverse();
  const memoryData = historyStats.value.map(r => r.memory).reverse();
  const networkInData = historyStats.value.map(r => r.networkIn / 1024 / 1024).reverse();
  const networkOutData = historyStats.value.map(r => r.networkOut / 1024 / 1024).reverse();
  const diskReadData = historyStats.value.map(r => r.diskRead / 1024 / 1024).reverse();
  const diskWriteData = historyStats.value.map(r => r.diskWrite / 1024 / 1024).reverse();
  
  chartInstances.value.cpu.setOption(getChartOption('CPU Usage (%)', timestamps, cpuData, '#E6A23C'));
  chartInstances.value.memory.setOption(getChartOption('Memory Usage (%)', timestamps, memoryData, '#67C23C'));
  chartInstances.value.network.setOption(getChartOption('Network Traffic (MB)', timestamps, [
    { name: 'In', data: networkInData },
    { name: 'Out', data: networkOutData }
  ], ['#409EFF', '#F56C6C']));
  chartInstances.value.disk.setOption(getChartOption('Disk I/O (MB)', timestamps, [
    { name: 'Read', data: diskReadData },
    { name: 'Write', data: diskWriteData }
  ], ['#409EFF', '#F56C6C']));
};

const resizeCharts = () => {
  Object.values(chartInstances.value).forEach(instance => {
    if (instance) instance.resize();
  });
};

const disposeCharts = () => {
  Object.values(chartInstances.value).forEach(instance => {
    if (instance && !instance.isDisposed()) {
      instance.dispose();
    }
  });
  chartInstances.value = {
    cpu: null,
    memory: null,
    network: null,
    disk: null
  };
};
  
  const getChartOption = (title, xAxis, series, color) => ({
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    title: { text: title, left: 'center' },
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
  
  const resizeHandler = () => {
    cpuChartInstance.resize();
    memoryChartInstance.resize();
    networkChartInstance.resize();
    diskChartInstance.resize();
  };
  
  window.addEventListener('resize', resizeHandler);
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeHandler);
  });
  
  watch(historyStats, updateCharts, { deep: true });
};

watch(activeTab, (newTab) => {
  if (newTab === 'charts') {
    nextTick(() => {
      initCharts();
    });
  }
});

const resizeObserver = new ResizeObserver(() => {
  resizeCharts();
});

// Lifecycle hooks
onMounted(() => {
  fetchStats();

  if (cpuChart.value) {
    resizeObserver.observe(cpuChart.value);
  }
  
  watch(liveStats, (enabled) => {
    if (enabled) {
      const interval = setInterval(fetchStats, refreshInterval.value);
      onBeforeUnmount(() => clearInterval(interval));
    }
  }, { immediate: true });
  nextTick(() => {
    initCharts();
  });
});

onBeforeUnmount(() => {
  resizeObserver.disconnect();
  [cpuChart, memoryChart, networkChart, diskChart].forEach(chart => {
    if (chart.value && echarts.getInstanceByDom(chart.value)) {
      echarts.dispose(chart.value);
    }
  });
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

.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.chart {
  height: 300px;
  width: 100%;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>