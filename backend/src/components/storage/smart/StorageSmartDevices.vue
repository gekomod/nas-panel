<template>
  <el-card class="storage-smart-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:harddisk-check" width="20" height="20" />
        <span>{{ t('storageSmart.title') }}</span>
        <div class="header-actions">
          <el-tooltip :content="t('storageSmart.refresh')">
            <el-button 
              size="small" 
              @click="fetchDevices" 
              :loading="loading"
              text
            >
              <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': loading }" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <el-alert
      v-if="smartNotAvailable"
      :title="t('storageSmart.notAvailableTitle')"
      type="warning"
      :description="t('storageSmart.notAvailableMessage')"
      show-icon
      :closable="false"
      class="mb-4"
    >
      <template #default>
        <p>{{ t('storageSmart.notAvailableSolution') }}</p>
        <el-input 
          :model-value="t('storageSmart.installCommand')" 
          readonly 
          class="mb-2"
        >
          <template #append>
            <el-button 
              @click="copyInstallCommand"
              :icon="CopyDocument"
            />
          </template>
        </el-input>
        <el-button type="primary" size="small" @click="fetchDevices">
          {{ t('storageSmart.retry') }}
        </el-button>
      </template>
    </el-alert>

    <el-table 
      :data="devices" 
      style="width: 100%" 
      v-loading="loading"
      row-key="device"
      :empty-text="emptyText"
    >
<el-table-column :label="t('storageSmart.monitored')" width="120">
  <template #default="{ row }">
      <el-switch
        v-model="row.monitored"
        @change="toggleMonitoring(row)"
        :loading="row.loading"
      />
  </template>
</el-table-column>
      
      <el-table-column :label="t('storageSmart.device')" prop="device" width="120">
        <template #default="{ row }">
          <div class="device-cell">
            <Icon :icon="getDeviceIcon(row.device)" width="18" height="18" />
            <span>{{ row.device }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageSmart.model')" prop="model" />
      
      <el-table-column :label="t('storageSmart.vendor')" prop="vendor">
        <template #default="{ row }">
          <div class="vendor-cell">
            <Icon :icon="getVendorIcon(row.vendor)" width="18" height="18" v-if="getVendorIcon(row.vendor)" />
            <span>{{ row.vendor }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="t('storageSmart.serial')" prop="serial" />
      
      <el-table-column :label="t('storageSmart.wwn')" prop="wwn" />
      
      <el-table-column :label="t('storageSmart.capacity')" prop="capacity" width="120">
        <template #default="{ row }">
          <div class="capacity-cell">
            <Icon icon="mdi:database" width="16" height="16" />
            <span>{{ formatBytes(row.capacity) }}</span>
          </div>
        </template>
      </el-table-column>
      
  <el-table-column :label="t('storageSmart.temperature')" prop="temperature" width="150">
    <template #default="{ row }">
      <div v-if="row.temperature !== null" class="temp-cell" :class="getTempClass(row.temperature)">
        <Icon icon="mdi:thermometer" width="16" height="16" />
        <span>{{ row.temperature }}°C</span>
        <el-tooltip v-if="row.rawData" content="Zobacz surowe dane SMART" placement="top">
          <el-button 
            size="small" 
            circle 
            @click="showRawData(row)"
            class="ml-2"
          >
            <Icon icon="mdi:code-braces" width="14" />
          </el-button>
        </el-tooltip>
      </div>
      <div v-else class="temp-cell temp-unknown">
        <Icon icon="mdi:thermometer-off" width="16" height="16" />
        <span>{{ t('common.na') }}</span>
        <el-tooltip v-if="row.error" :content="row.error" placement="top">
          <Icon icon="mdi:alert-circle" class="ml-2" />
        </el-tooltip>
      </div>
    </template>
  </el-table-column>
      
<el-table-column :label="t('storageSmart.statusS')" prop="status" width="150">
  <template #default="{ row }">
    <template v-if="row.available">
      <el-tag :type="getStatusTagType(row)" effect="dark">
        {{ getStatusText(row) }}
      </el-tag>
      <el-tooltip 
        v-if="hasCriticalIssues(row)"
        effect="dark" 
        placement="top"
        :content="getCriticalIssuesTooltip(row)"
      >
        <Icon 
          icon="mdi:alert-circle" 
          width="16" 
          :style="{ color: 'var(--el-color-warning)', marginLeft: '8px' }" 
        />
      </el-tooltip>
    </template>
    <template v-else>
      <el-tag type="info" effect="dark">
        {{ t('storageSmart.statusValues.unavailable') }}
      </el-tag>
      <el-tooltip v-if="row.error" :content="row.error">
        <Icon icon="mdi:alert-circle" class="ml-2" />
      </el-tooltip>
    </template>
  </template>
</el-table-column>

<el-table-column label="Akcje" width="120" align="right">
  <template #default="{ row }">
    <el-tooltip content="Pokaż szczegóły" placement="top">
      <el-button 
        size="small" 
        circle 
        @click="showDetails(row.device)"
        class="action-button"
      >
        <Icon icon="mdi:information-outline" width="16" />
      </el-button>
    </el-tooltip>
  </template>
</el-table-column>

    </el-table>


    <div v-if="error" class="error-message">
      <Icon icon="mdi:alert-circle" width="18" height="18" />
      <span>{{ error }}</span>
    </div>
  </el-card>

  <el-dialog v-model="rawDataDialog" title="Surowe dane SMART" width="70%">
    <pre>{{ currentRawData }}</pre>
    <template #footer>
      <el-button @click="rawDataDialog = false">Zamknij</el-button>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'StorageSmartDevices',
  displayName: 'Monitorowane urządzenia'
}
</script>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElNotification } from 'element-plus'
import { ElDialog } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router'

const { t } = useI18n()

const devices = ref([])
const loading = ref(false)
const error = ref(null)
const smartNotAvailable = ref(false);
const emptyText = ref('');
const rawDataDialog = ref(false);
const currentRawData = ref('');
const router = useRouter()

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

const getDeviceIcon = (device) => {
  if (device.startsWith('nvme')) return 'mdi:memory'
  if (device.startsWith('sd')) return 'mdi:harddisk'
  return 'mdi:harddisk'
}

const showRawData = (row) => {
  currentRawData.value = JSON.stringify(row.rawData, null, 2);
  rawDataDialog.value = true;
};

const getVendorIcon = (vendor) => {
  const vendors = {
    'Samsung': 'simple-icons:samsung',
    'Western Digital': 'simple-icons:westerndigital',
    'Seagate': 'simple-icons:seagate',
    'Toshiba': 'simple-icons:toshiba',
    'Intel': 'simple-icons:intel'
  }
  return vendors[vendor] || null
}

const formatBytes = (bytes, decimals = 2) => {
  if (isNaN(bytes)) return t('common.na');
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

const getTempClass = (temp) => {
  if (temp === undefined || temp === null) return 'temp-unknown'
  if (temp > 60) return 'temp-high'
  if (temp > 50) return 'temp-warning'
  return 'temp-normal'
}

const getStatusText = (device) => {
  if (device.badSectors > 0) {
    return t('storageSmart.statusValues.badSectors');
  }
  return t(`storageSmart.statusValues.${device.status}`);
};

const getStatusTagType = (device) => {
  if (device.badSectors > 0) {
    return 'warning'; // pomarańczowy dla bad sectorów
  }
  switch (device.status) {
    case 'healthy': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'danger'
    default: return 'info'
  }
};

const showDetails = (device) => {
  router.push(`/storage/smart/devices/details/${encodeURIComponent(device)}`)
}

const copyInstallCommand = () => {
  navigator.clipboard.writeText(t('storageSmart.installCommand'));
  ElMessage.success(t('storageSmart.commandCopied'));
};

const hasCriticalIssues = (device) => {
  return device.badSectors > 0 || 
         (device.outOfSpecParams && device.outOfSpecParams.length > 0) ||
         isTempCritical(device.temperature, device.isSSD);
};

const getCriticalIssuesTooltip = (device) => {
  const issues = [];
  
  if (device.badSectors > 0) {
    issues.push(`Bad sectors: ${device.badSectors}`);
  }
  
  if (device.outOfSpecParams && device.outOfSpecParams.length > 0) {
    issues.push(`Out of spec parameters: ${device.outOfSpecParams.length}`);
  }
  
  if (isTempCritical(device.temperature, device.isSSD)) {
    const limit = device.isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD;
    issues.push(`High temperature: ${device.temperature}°C (max ${limit}°C)`);
  }
  
  return issues.join('\n');
};

const isTempCritical = (temp, isSSD = false) => {
  if (!temp) return false;
  const limit = isSSD ? TEMP_LIMIT_SSD : TEMP_LIMIT_HDD;
  return temp > limit;
};

const TEMP_LIMIT_SSD = 50; // Próg temperatury dla SSD
const TEMP_LIMIT_HDD = 55; // Próg temperatury dla HDD

const fetchDevices = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const [smartResponse, monitoringResponse] = await Promise.all([
      axios.get('/api/storage/smart'),
      axios.get('/api/storage/smart/monitoring')
    ]);
    
    devices.value = smartResponse.data.data.map(device => {
      const monitoredStatus = monitoringResponse.data.devices[device.device]?.monitored || false;
      
      // Dodaj informacje o bad sectorach i parametrach poza normą
      const badSectors = calculateBadSectors(device.rawData);
      const outOfSpecParams = checkOutOfSpecParams(device.rawData);
      const isSSD = device.rawData?.rotation_rate === 0;
      
      return {
        ...device,
        monitored: monitoredStatus,
        loading: false,
        badSectors,
        outOfSpecParams,
        isSSD,
        temperature: extractTemperature(device.rawData) || device.temperature
      };
    });
  } catch (err) {
    error.value = t('storageSmart.errorLoading')
    console.error('Error fetching devices:', err)
    
    // Jeśli błąd dotyczy tylko monitorowania, spróbuj pobrać same dane SMART
    if (err.response?.config?.url.includes('monitoring')) {
      try {
        const smartResponse = await axios.get('/api/storage/smart')
        devices.value = smartResponse.data.data.map(device => ({
          ...device,
          monitored: false, // Domyślnie false jeśli nie można sprawdzić statusu
          loading: false
        }))
      } catch (smartErr) {
        console.error('Error fetching SMART data:', smartErr)
      }
    }
  } finally {
    loading.value = false
  }
}

const toggleMonitoring = async (device) => {
  const originalState = device.monitored
  device.loading = true
  try {
    const response = await axios.post('/api/storage/smart/monitoring', {
      device: device.device,
      enabled: originalState // Wysyłamy nowy stan (przełączony)
    })
    
    // Aktualizuj lokalny stan tylko po sukcesie
    device.monitored = originalState
    
    ElNotification.success({
      title: t('storageSmart.title'),
      message: response.data.message || 
        (device.monitored ? t('storageSmart.enableMonitoring') : t('storageSmart.disableMonitoring'))
    })
  } catch (err) {
    // Przywróć poprzedni stan w przypadku błędu
    device.monitored = originalState
    
    ElNotification.error({
      title: t('storageSmart.title'),
      message: err.response?.data?.error || t('common.error'),
      duration: 3000
    })
  } finally {
    device.loading = false
  }
}

const calculateBadSectors = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return 0;
  
  const reallocated = smartData.ata_smart_attributes.table.find(a => a.id === 5);
  const pending = smartData.ata_smart_attributes.table.find(a => a.id === 197);
  const offline = smartData.ata_smart_attributes.table.find(a => a.id === 198);
  
  return (reallocated?.raw?.value || 0) + 
         (pending?.raw?.value || 0) + 
         (offline?.raw?.value || 0);
};

const checkOutOfSpecParams = (smartData) => {
  if (!smartData?.ata_smart_attributes?.table) return [];
  
  return smartData.ata_smart_attributes.table
    .filter(attr => attr.value && attr.thresh && attr.value <= attr.thresh)
    .map(attr => ({
      id: attr.id,
      name: attr.name,
      value: attr.value,
      threshold: attr.thresh
    }));
};

const extractTemperature = (smartData) => {
  if (!smartData) return null;
  
  // Dla dysków NVMe
  if (smartData.nvme_smart_health_information_log?.temperature) {
    return smartData.nvme_smart_health_information_log.temperature - 273;
  }
  
  // Dla tradycyjnych dysków
  if (smartData.temperature?.current) return smartData.temperature.current;
  
  // Z atrybutów SMART
  if (smartData.ata_smart_attributes?.table) {
    const tempAttr = smartData.ata_smart_attributes.table.find(
      attr => ['Temperature_Celsius', 'Temperature_Internal'].includes(attr.name) || attr.id === 194
    );
    if (tempAttr?.raw?.value) return parseInt(tempAttr.raw.value);
  }
  
  return null;
};

onMounted(async () => {
  await fetchDevices()
  
  // Sprawdź czy SMART jest dostępny
  if (devices.value.length === 0 && !error.value) {
    smartNotAvailable.value = true
  }
})
</script>

<style scoped>
.el-switch {
  --el-switch-on-color: var(--el-color-success);
  --el-switch-off-color: var(--el-color-info);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.storage-smart-widget {
  height: 100%;
}

.device-cell,
.vendor-cell,
.capacity-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.temp-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.temp-normal {
  color: var(--el-color-success);
}

.temp-warning {
  color: var(--el-color-warning);
}

.temp-high {
  color: var(--el-color-danger);
}

.temp-unknown {
  color: var(--el-color-info);
}

.error-message {
  margin-top: 15px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-button {
  margin-left: auto;
}

/* Dodaj to do istniejących stylów */
.device-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.el-table .cell {
  display: flex;
  align-items: center;
}

.warning-icon {
  color: var(--el-color-warning);
  margin-left: 8px;
}
</style>
