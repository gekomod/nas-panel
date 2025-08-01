<template>
  <el-card class="widget-card" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="ph:hard-drives" width="18" />
        <span class="widget-title">Monitorowane dyski</span>
        <el-tag :type="overallStatus" size="small" :effect="overallStatus === 'danger' ? 'dark' : 'plain'" round>
          {{ overallStatusText }}
        </el-tag>
      </div>
    </template>
    
    <el-skeleton v-if="loading" :rows="3" animated />
    <div v-else>
    <div v-if="monitoredDisks.length > 0" class="disk-list">
      <div 
        v-for="(disk, index) in monitoredDisks" 
        :key="disk.device" 
        class="disk-item"
      >
        <div class="disk-content">
          <div class="disk-info">
            <Icon :icon="getDiskIcon(disk.device)" width="16" class="disk-icon" />
            <span class="disk-name">{{ formatDiskName(disk.device) }}</span>
            <span class="disk-path">{{ disk.device }}</span>
            <el-tooltip 
              v-if="hasCriticalIssues(disk)"
              effect="dark" 
              placement="top"
            >
              <template #content>
                <div v-if="disk.badSectors > 0">
                  <p>Znalezione bad sector: {{ disk.badSectors }}</p>
                </div>
                <div v-if="disk.outOfSpecParams.length > 0">
                  <p>Parametry poza normą:</p>
                  <ul>
                    <li v-for="param in disk.outOfSpecParams" :key="param.id">
                      {{ param.name }}: {{ param.value }} (norma: {{ param.threshold }})
                    </li>
                  </ul>
                </div>
              </template>
              <Icon 
                icon="ph:warning" 
                width="16" 
                class="warning-icon" 
                :style="{ color: 'var(--el-color-warning)' }" 
              />
            </el-tooltip>
          </div>
          
          <div class="disk-stats">
            <div class="temperature" :class="{ 'critical': isTempCritical(disk.temperature, disk.isSSD) }">
              <Icon icon="mdi:thermometer" width="14" />
              <span>{{ disk.temperature || '--' }}°C</span>
            </div>
            <div class="status" :class="getStatusClass(disk)">
              {{ getStatusText(disk) }}
            </div>
          </div>
        </div>
        <el-divider v-if="index < monitoredDisks.length - 1" />
      </div>
    </div>
    </div>
    
    <div v-else class="empty-state">
      <Icon icon="ph:info" width="16" />
      <span>Brak dysków objętych monitoringiem</span>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'SmartWidget',
  displayName: 'Status SMART'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import PromisePool from 'es6-promise-pool/es6-promise-pool.js'

const monitoredDisks = ref([])
const loading = ref(false)
const TEMP_LIMIT_SSD = 50
const TEMP_LIMIT_HDD = 55
let intervalId = null

const overallStatus = computed(() => {
  const hasErrors = monitoredDisks.value.some(d => !d.status || 
    d.badSectors > 0 || 
    d.outOfSpecParams.length > 0 ||
    isTempCritical(d.temperature, d.isSSD))
  return hasErrors ? 'danger' : 'success'
})

const overallStatusText = computed(() => {
  const errorCount = monitoredDisks.value.filter(d => 
    !d.status || 
    d.badSectors > 0 || 
    d.outOfSpecParams.length > 0 ||
    isTempCritical(d.temperature, d.isSSD)
  ).length
  return errorCount ? `${errorCount} BŁĘDY` : 'WSZYSTKO OK'
})

const getDiskIcon = (device) => {
  return device.includes('nvme') ? 'ph:hard-drive' : 'ph:hard-drives'
}

const formatDiskName = (device) => {
  return device.split('/').pop().toUpperCase()
}

const isTempCritical = (temp, isSSD = false) => {
  if (!temp) return false
  const limit = isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD
  return temp > limit
}

const hasCriticalIssues = (disk) => {
  return disk.badSectors > 0 || disk.outOfSpecParams.length > 0 || isTempCritical(disk.temperature, disk.isSSD)
}

const getStatusClass = (disk) => {
  if (!disk.status) return 'error'
  if (disk.badSectors > 0) return 'bad-sectors'
  if (hasCriticalIssues(disk)) return 'warning'
  return 'ok'
}

const getStatusText = (disk) => {
  if (disk.badSectors > 0) return 'BAD SEKTORY'
  return disk.status ? 'OK' : 'ERR'
}

const activeControllers = ref(new Set());

const fetchDeviceDetails = async (device) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
  activeControllers.value.add(controller);

  try {
    const detailsRes = await axios.get(
      `/api/storage/smart/details/${encodeURIComponent(device)}`, 
      {
        timeout: 5000,
        signal: controller.signal
      }
    );

    const smartData = detailsRes.data.data;
    const isSSD = smartData.rotation_rate === 0;
    
    // Check for bad sectors
    let badSectors = 0;
    if (smartData.ata_smart_attributes?.table) {
      const reallocated = smartData.ata_smart_attributes.table.find(a => a.id === 5);
      const pending = smartData.ata_smart_attributes.table.find(a => a.id === 197);
      const offline = smartData.ata_smart_attributes.table.find(a => a.id === 198);
      
      badSectors = (reallocated?.raw?.value || 0) + 
                   (pending?.raw?.value || 0) + 
                   (offline?.raw?.value || 0);
    }

    // Check for out of spec parameters
    const outOfSpecParams = [];
    if (smartData.ata_smart_attributes?.table) {
      smartData.ata_smart_attributes.table.forEach(attr => {
        if (attr.value && attr.thresh && attr.value <= attr.thresh) {
          outOfSpecParams.push({
            id: attr.id,
            name: attr.name,
            value: attr.value,
            threshold: attr.thresh
          });
        }
      });
    }

    return {
      device,
      status: smartData.smart_status?.passed || false,
      temperature: smartData.temperature?.current || extractTemperature(smartData),
      isSSD,
      badSectors,
      outOfSpecParams,
      rawData: smartData
    };
  } catch (error) {
    if (!axios.isCancel(error)) {
      console.error(`Error fetching ${device} details:`, error);
    }
    return {
      device,
      status: false,
      temperature: null,
      isSSD: false,
      badSectors: 0,
      outOfSpecParams: [],
      rawData: null
    };
  } finally {
        clearTimeout(timeout);
        activeControllers.value.delete(controller);
  }
};

const extractTemperature = (smartData) => {
  if (smartData.nvme_smart_health_information_log?.temperature) {
    return smartData.nvme_smart_health_information_log.temperature - 273;
  }
  
  if (smartData.temperature?.current) return smartData.temperature.current;
  
  if (smartData.ata_smart_attributes?.table) {
    const tempAttr = smartData.ata_smart_attributes.table.find(
      attr => ['Temperature_Celsius', 'Temperature_Internal'].includes(attr.name) || attr.id === 194
    );
    if (tempAttr?.raw?.value) return parseInt(tempAttr.raw.value);
  }
  
  return null;
};

const abortAllRequests = () => {
  activeControllers.value.forEach(controller => {
    controller.abort();
  });
  activeControllers.value.clear();
};

const fetchData = async () => {
  abortAllRequests();
  loading.value = true;

  try {
    const monitoringRes = await axios.get('/api/storage/smart/monitoring', {
      timeout: 10000 // 10s timeout
    });
    
    const monitoredDevices = Object.keys(monitoringRes.data.devices)
      .filter(device => monitoringRes.data.devices[device].monitored);
    
    // Ogranicz do 2 równoległych zapytań
    const pool = new PromisePool(
      () => monitoredDevices.length ? fetchDeviceDetails(monitoredDevices.shift()) : null,
      2
    );
    
    monitoredDisks.value = [];
    for await (const result of pool) {
      if (result) monitoredDisks.value.push(result);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    monitoredDisks.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshData = async () => {
  await fetchData()
}

defineExpose({
  refreshData
})

onMounted(() => {
  if (intervalId) clearInterval(intervalId);
  
  const fetchWithErrorHandling = async () => {
    try {
      await fetchData();
    } catch (error) {
      console.error('Interval fetch error:', error);
      // Możesz dodać opóźnienie przed ponowną próbą
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  };
  
  fetchWithErrorHandling();
  intervalId = setInterval(fetchWithErrorHandling, 15000);
});


onBeforeUnmount(() => {
  abortAllRequests();
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped lang="scss">
.widget-card {
  border-radius: 8px;
  height: 100%;
  
  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  
  :deep(.el-card__body) {
    padding: 0;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .widget-title {
    font-size: 14px;
    font-weight: 500;
    flex-grow: 1;
  }
  
  .el-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 0 8px;
    height: 20px;
  }
}

.disk-list {
  display: flex;
  flex-direction: column;
}

.disk-item {
  padding: 12px 16px;
}

.disk-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.disk-info {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .disk-icon {
    color: var(--el-text-color-secondary);
  }
  
  .disk-name {
    font-size: 13px;
    font-weight: 500;
    font-family: var(--el-font-family-mono);
  }
  
  .disk-path {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    opacity: 0.7;
  }
  
  .warning-icon {
    margin-left: 4px;
  }
}

.disk-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.temperature {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  
  span {
    font-feature-settings: 'tnum';
  }
  
  &.critical {
    color: var(--el-color-danger);
  }
}

.status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  
  &.ok {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }
  
  &.warning {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
  
  &.bad-sectors {
    color: var(--el-color-warning-dark-2);
    background: var(--el-color-warning-light-8);
  }
  
  &.error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  
  svg {
    opacity: 0.6;
  }
}

:deep(.el-divider) {
  margin: 0;
}
</style>
