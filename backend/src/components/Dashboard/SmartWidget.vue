<template>
  <el-card 
    class="widget-card" 
    shadow="hover" 
    v-loading="loading"
  >
    <!-- Nagłówek -->
    <template #header>
      <div class="widget-header">
        <div class="header-main">
          <div class="header-icon">
            <Icon icon="ph:hard-drives" width="16" />
          </div>
          <span class="header-title">{{ t('storageSmart.title') }}</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <span class="hostname">{{ overallStatusText }}</span>
          <span class="system" :class="overallStatus">{{ monitoredDisks.length }} {{ t('storageSmart.disks') }}</span>
        </div>
      </div>
    </template>

    <!-- Lista dysków -->
    <div v-if="monitoredDisks.length > 0" class="widget-content">
      <div 
        v-for="(disk, index) in monitoredDisks" 
        :key="disk.device" 
        class="info-row disk-item"
        :class="{ 'warning-row': hasCriticalIssues(disk) }"
      >
        <div class="label">
          <Icon :icon="getDiskIcon(disk.device)" width="14" />
          <span>{{ formatDiskName(disk.device) }}</span>
          <el-tooltip 
            v-if="hasCriticalIssues(disk)"
            effect="dark" 
            placement="top"
          >
            <template #content>
              <div v-if="disk.badSectors > 0">
                <p>{{ t('storageSmart.statusValues.badSectors') }}: {{ disk.badSectors }}</p>
              </div>
              <div v-if="disk.outOfSpecParams.length > 0">
                <p>{{ t('storageSmart.details.outOfSpec') }}:</p>
                <ul>
                  <li v-for="param in disk.outOfSpecParams" :key="param.id">
                    {{ param.name }}: {{ param.value }} ({{ t('storageSmart.details.threshold') }}: {{ param.threshold }})
                  </li>
                </ul>
              </div>
            </template>
            <Icon 
              icon="ph:warning" 
              width="12" 
              class="warning-icon" 
            />
          </el-tooltip>
        </div>
        <div class="value">
          <div class="disk-stats">
            <div class="temperature" :class="{ 'critical': isTempCritical(disk.temperature, disk.isSSD) }">
              <Icon icon="mdi:thermometer" width="12" />
              <span>{{ disk.temperature || '--' }}°C</span>
            </div>
            <div class="status" :class="getStatusClass(disk)">
              {{ getStatusText(disk) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <Icon icon="ph:info" width="16" />
      <span>{{ t('storageSmart.notAvailableMessage') }}</span>
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const monitoredDisks = ref([])
const loading = ref(false)
const lastUpdate = ref(t('common.loading'))
const TEMP_LIMIT_SSD = 50
const TEMP_LIMIT_HDD = 55
let intervalId = null
const activeControllers = ref(new Set())

const STATUS_TEXTS = {
  OK: t('common.yes'),
  ERROR: t('common.error'),
  BAD_SECTORS: t('storageSmart.statusValues.badSectors')
}

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
  return errorCount ? `${errorCount} ${t('common.errors')}` : t('common.allOk')
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
  if (disk.badSectors > 0) return STATUS_TEXTS.BAD_SECTORS
  return disk.status ? STATUS_TEXTS.OK : STATUS_TEXTS.ERROR
}

const fetchDeviceDetails = async (device) => {
  const controller = new AbortController();
  activeControllers.value.add(controller);

  try {
    const detailsRes = await axios.get(
      `/api/storage/smart/details/${encodeURIComponent(device)}`, 
      {
        timeout: 8000,
        signal: controller.signal
      }
    );

    const smartData = detailsRes.data?.data || {};
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
    activeControllers.value.delete(controller);
  }
};

const extractTemperature = (smartData) => {
  if (!smartData) return null;

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
  monitoredDisks.value = [];

  try {
    const monitoringRes = await axios.get('/api/storage/smart/monitoring', {
      timeout: 5000
    });

    const devices = monitoringRes.data.devices || {};
    const monitoredDevices = Object.keys(devices).filter(
      device => devices[device]?.monitored === true
    );

    if (monitoredDevices.length === 0 && process.env.NODE_ENV === 'development') {
      console.warn('Brak monitorowanych dysków - tryb developerski');
      monitoredDisks.value = [
        {
          device: '/dev/sda',
          status: true,
          temperature: 42,
          isSSD: false,
          badSectors: 0,
          outOfSpecParams: []
        }
      ];
      lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return;
    }

    for (let i = 0; i < monitoredDevices.length; i += 2) {
      const batch = monitoredDevices.slice(i, i + 2);
      const batchResults = await Promise.all(
        batch.map(device => fetchDeviceDetails(device))
      );
      monitoredDisks.value.push(...batchResults);
    }
    
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
  } catch (error) {
    if (!axios.isCancel(error)) {
      console.error('Error:', error);
      lastUpdate.value = t('common.error')
    }
    monitoredDisks.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshData = async () => {
  await fetchData();
}

defineExpose({
  refreshData
})

onMounted(() => {
  if (intervalId) clearInterval(intervalId);
  
  fetchData().finally(() => {
    intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    }, 30000);
  });
});

onBeforeUnmount(() => {
  abortAllRequests();
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped lang="scss">
.widget-card {
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 280px;
  height: 100%;
  
  /* Ciemniejszy border w trybie dark */
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:deep(.el-card__header) {
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
    padding: 16px 20px;
    background: transparent;
    
    :global(.dark) &,
    :global(body.dark) & {
      border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    }
  }

  &:deep(.el-card__body) {
    padding: 16px 20px;
  }
}

.widget-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;

  .header-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.25);
    flex-shrink: 0;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .update-time {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-weight: 400;
    padding: 4px 8px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    flex-shrink: 0;
    white-space: nowrap;
  }
}

.header-sub {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 8px;

  .hostname, .system {
    font-weight: 500;
    color: var(--el-text-color-regular);
    padding: 4px 8px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: center;
  }

  .system {
    color: var(--el-color-primary);
    font-weight: 600;
    
    &.danger {
      color: var(--el-color-danger);
      background: rgba(var(--el-color-danger-rgb), 0.1);
    }
    
    &.success {
      color: var(--el-color-success);
      background: rgba(var(--el-color-success-rgb), 0.1);
    }
  }
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: 36px;

  &:hover {
    background: var(--el-fill-color-lighter);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, transparent);
    
    :global(.dark) &,
    :global(body.dark) & {
      border-color: color-mix(in srgb, var(--el-border-color) 30%, #334155);
    }
  }

  .label {
    font-weight: 500;
    color: var(--el-text-color-regular);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    
    .warning-icon {
      color: var(--el-color-warning);
    }
  }

  .value {
    font-weight: 400;
    color: var(--el-text-color-primary);
    text-align: right;
    flex: 1;
    margin-left: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.warning-row {
  background: linear-gradient(135deg, rgba(var(--el-color-warning-rgb), 0.1) 0%, rgba(var(--el-color-warning-dark-2-rgb), 0.1) 100%);
  border-color: rgba(var(--el-color-warning-rgb), 0.2) !important;
  color: var(--el-color-warning);

  .label, .value {
    color: inherit !important;
  }
}

.disk-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
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
  min-width: 60px;
  text-align: center;
  
  &.ok {
    color: var(--el-color-success);
    background: rgba(var(--el-color-success-rgb), 0.1);
  }
  
  &.warning {
    color: var(--el-color-warning);
    background: rgba(var(--el-color-warning-rgb), 0.1);
  }
  
  &.bad-sectors {
    color: var(--el-color-warning-dark-2);
    background: rgba(var(--el-color-warning-rgb), 0.2);
  }
  
  &.error {
    color: var(--el-color-danger);
    background: rgba(var(--el-color-danger-rgb), 0.1);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  height: 120px;
  
  svg {
    opacity: 0.6;
  }
}

/* Compact mode for very small screens */
@media (max-width: 480px) {
  .widget-card {
    border-radius: 10px;
    
    &:deep(.el-card__header) {
      padding: 12px 16px;
    }
    
    &:deep(.el-card__body) {
      padding: 12px 16px;
    }
  }

  .header-main {
    .header-icon {
      width: 28px;
      height: 28px;
    }
    
    .header-title {
      font-size: 13px;
    }
    
    .update-time {
      font-size: 10px;
      padding: 3px 6px;
    }
  }
  
  .header-sub {
    font-size: 11px;
    
    .hostname, .system {
      padding: 3px 6px;
    }
  }
  
  .info-row {
    font-size: 12px;
    padding: 6px 8px;
    min-height: 32px;
  }
  
  .disk-stats {
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
    
    .temperature, .status {
      font-size: 10px !important;
    }
    
    .status {
      min-width: 50px;
    }
  }
}
</style>
