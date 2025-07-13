<template>
  <el-card class="filesystems-widget">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:file-tree" width="20" height="20" />
        <span>{{ $t('storageFilesystems.title') }}</span>
        <div class="header-actions">
          <el-tooltip :content="$t('storageFilesystems.mount')">
            <el-button 
              size="small" 
              @click="showMountDialog" 
              :disabled="loading"
              text
            >
              <Icon icon="mdi:usb-flash-drive" width="16" height="16" />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="$t('storageFilesystems.format')">
            <el-button 
              size="small" 
              @click="showFormatDialog" 
              :disabled="loading"
              text
            >
              <Icon icon="mdi:format-list-checks" width="16" height="16" />
            </el-button>
          </el-tooltip>
          <el-tooltip :content="$t('storageFilesystems.refresh')">
            <el-button 
              size="small" 
              @click="refreshFilesystems" 
              :loading="loading"
              text
            >
              <Icon icon="mdi:refresh" width="16" height="16" :class="{ 'spin': loading }" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <!-- Mount Dialog -->
    <el-dialog v-model="mountDialogVisible" :title="$t('storageFilesystems.mountDialog.title')" width="500px">
      <el-form :model="mountForm" label-position="top">
        <el-form-item :label="$t('storageFilesystems.mountDialog.device')">
          <el-select v-model="mountForm.device" :placeholder="$t('storageFilesystems.mountDialog.selectDevice')" @change="updatePartitions" style="width: 100%">
            <el-option
              v-for="device in unmountedDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
            />
          </el-select>
        </el-form-item>
        <el-form-item 
          v-if="availablePartitions.length > 0" 
          :label="$t('storageFilesystems.mountDialog.partition')"
        >
          <el-select 
            v-model="mountForm.partition" 
            placeholder="Select partition"
            style="width: 100%"
          >
            <el-option
              v-for="part in availablePartitions"
              :key="part.path"
              :label="part.path"
              :value="part.path"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('storageFilesystems.mountDialog.mountPoint')" v-if="mountForm.fsType !== 'zfs'">
          <el-input v-model="mountForm.mountPoint" :placeholder="'/mnt/new_disk'" />
        </el-form-item>
        <el-form-item :label="$t('storageFilesystems.mountDialog.fsType')">
          <el-select v-model="mountForm.fsType" :placeholder="$t('storageFilesystems.mountDialog.selectFsType')" style="width: 100%">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs"
              :value="fs.toLowerCase()"
            />
          </el-select>
        </el-form-item>
        <el-form-item 
          v-if="mountForm.fsType === 'zfs'"
          :label="$t('storageFilesystems.mountDialog.zfsPoolName')"
        >
          <el-input v-model="mountForm.zfsPoolName" placeholder="mypool" />
        </el-form-item>
        <el-form-item :label="$t('storageFilesystems.mountDialog.options')" v-if="mountForm.fsType !== 'zfs'">
          <el-input v-model="mountForm.options" placeholder="defaults,nofail" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mountDialogVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="mountDevice" :loading="mountLoading">
          {{ $t('storageFilesystems.mountDialog.mount') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Format Dialog -->
    <el-dialog v-model="formatDialogVisible" :title="$t('storageFilesystems.formatDialog.title')" width="500px">
      <el-form :model="formatForm" label-position="top">
        <el-form-item :label="$t('storageFilesystems.formatDialog.device')">
          <el-select v-model="formatForm.device" :placeholder="$t('storageFilesystems.formatDialog.selectDevice')" style="width: 100%">
            <el-option
              v-for="partition in unmountedPartitions"
              :key="partition.path"
              :label="`${partition.path} (${partition.model || 'Unknown'}) ${partition.fstype ? `[${partition.fstype}]` : ''}`"
              :value="partition.path"
            />
            <el-option
              v-for="device in unmountedDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('storageFilesystems.formatDialog.fsType')">
          <el-select v-model="formatForm.fsType" :placeholder="$t('storageFilesystems.formatDialog.selectFsType')" style="width: 100%">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs"
              :value="fs.toLowerCase()"
            />
          </el-select>
        </el-form-item>
        <el-form-item 
          v-if="formatForm.fsType === 'zfs'"
          :label="$t('storageFilesystems.formatDialog.zfsPoolName')"
        >
          <el-input v-model="formatForm.zfsPoolName" placeholder="mypool" />
        </el-form-item>
        <el-form-item 
	  v-if="formatForm.fsType === 'zfs'" 
	  label="Urządzenie (automatycznie wybrano cały dysk)"
	>
	  <el-input 
	    :value="formatForm.device.replace(/[0-9]+$/, '')" 
	    disabled
	  />
	  <div class="el-form-item__description">
	    ZFS wymaga całego dysku (np. /dev/sda zamiast /dev/sda1)
	  </div>
	</el-form-item>
        <el-form-item 
          v-else
          :label="$t('storageFilesystems.formatDialog.label')"
        >
          <el-input v-model="formatForm.label" :placeholder="`${formatForm.fsType.toUpperCase()}_VOLUME`" />
        </el-form-item>
        <el-form-item :label="$t('storageFilesystems.formatDialog.force')">
          <el-switch v-model="formatForm.force" />
        </el-form-item>
      </el-form>
      <div class="warning-message" v-if="formatForm.device">
        <el-alert type="warning" :closable="false">
          {{ $t('storageFilesystems.formatDialog.warning', { device: formatForm.device }) }}
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="formatDialogVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="danger" @click="formatDevice" :loading="formatLoading">
          {{ $t('storageFilesystems.formatDialog.format') }}
        </el-button>
      </template>
    </el-dialog>

    <el-table :data="filesystems" style="width: 100%" v-loading="loading">
      <el-table-column :label="$t('storageFilesystems.device')" prop="device" width="120">
        <template #default="{ row }">
          <div class="device-cell">
            <Icon :icon="getDeviceIcon(row.device)" width="18" height="18" />
            <span>{{ row.device }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.tags')" prop="tags" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.tags" size="small">
            {{ row.tags }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.type')" prop="type" width="100">
        <template #default="{ row }">
          <Icon :icon="getFsIcon(row.type)" width="16" height="16" />
          <span>{{ row.type }}</span>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.available')" prop="available" width="120">
        <template #default="{ row }">
          <div class="size-cell">
            <Icon icon="mdi:harddisk-plus" width="16" height="16" />
            <span>{{ formatBytes(row.available) }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.used')" prop="used" width="400">
        <template #default="{ row }">
          <el-progress 
            :percentage="row.usedPercent" 
            :color="getUsageColor(row.usedPercent)"
            :show-text="false"
            :stroke-width="14"
          />
          <span>{{ formatBytes(row.used) }} ({{ row.usedPercent }}%)</span>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.mounted')" prop="mounted">
        <template #default="{ row }">
          <div class="mount-cell">
            <Icon icon="mdi:folder-marker" width="16" height="16" />
            <span>{{ row.mounted }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column :label="$t('storageFilesystems.reference')" prop="reference" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.reference" size="small" type="info">
            {{ row.reference }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('storageFilesystems.status')" prop="status" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            <Icon :icon="getStatusIcon(row.status)" width="14" height="14" />
            <span>
              {{ row.status }}
              <span v-if="row.readOnly" class="read-only-badge">(RO)</span>
            </span>
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('storageFilesystems.actions')" width="150">
        <template #default="{ row }">
          <el-button 
            size="small" 
            @click="unmountFilesystem(row.mounted)" 
            :disabled="row.status !== 'active'"
            text
          >
            <Icon icon="mdi:eject" width="16" height="16" />
            {{ $t('storageFilesystems.unmount') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="error" class="error-message">
      <Icon icon="mdi:alert-circle" width="18" height="18" />
      <span>{{ error }}</span>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'StorageFilesystemsWidget',
  displayName: 'Systemy plików'
}
</script>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'

const { t } = useI18n()

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

const filesystems = ref([])
const allDevices = ref([])
const loading = ref(false)
const error = ref(null)

// Mount dialog
const mountDialogVisible = ref(false)
const mountLoading = ref(false)
const mountForm = ref({
  device: '',
  partition: '',
  mountPoint: '',
  fsType: 'ext4',
  options: 'defaults,nofail',
  zfsPoolName: ''
});

// Format dialog
const formatDialogVisible = ref(false)
const formatLoading = ref(false)
const formatForm = ref({
  device: '',
  fsType: 'ext4',
  label: '',
  zfsPoolName: 'zpool',
  force: false
});

const supportedFilesystems = ref([
  'bcachefs',
  'btrfs',
  'ext4',
  'f2fs',
  'jfs',
  'xfs',
  'zfs'
])

const formatableDevices = computed(() => {
  return allDevices.value.flatMap(device => {
    const base = {
      path: device.path,
      model: device.model,
      type: device.type
    };
    
    const partitions = device.partitions?.map(p => ({
      path: p.path,
      model: device.model,
      type: p.type
    })) || [];
    
    return [base, ...partitions];
  }).filter(d => !d.path.includes('loop'));
});

// Computed properties
const unmountedDevices = computed(() => {
  const mountedPaths = filesystems.value.map(fs => fs.device);
  const allPartitions = allDevices.value.flatMap(device => 
    device.partitions.map(part => ({
      ...part,
      model: device.model,
      serial: device.serial
    }))
  );

  return allPartitions.filter(part => 
    !mountedPaths.includes(part.path) && 
    !part.path.includes('loop') &&
    !part.path.includes('ram') &&
    part.type === 'part'
  );
});

const unmountedPartitions = computed(() => {
  const mountedPaths = filesystems.value.map(fs => fs.device);
  return allDevices.value.flatMap(device => 
    device.partitions
      .filter(part => 
        !mountedPaths.includes(part.path) &&
        !part.path.includes('loop') &&
        !part.path.includes('ram')
      )
      .map(part => ({
        ...part,
        model: part.model || 'Unknown'
      }))
  );
});

const availablePartitions = ref([]);
const updatePartitions = (devicePath) => {
  const device = allDevices.value.find(d => d.path === devicePath);
  availablePartitions.value = device?.partitions || [];
  mountForm.value.partition = availablePartitions.value[0]?.path || '';
};

// Methods
const showMountDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    mountDialogVisible.value = true
  } catch (err) {
    error.value = t('storageFilesystems.errorLoadingDevices')
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const showFormatDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    formatDialogVisible.value = true
  } catch (err) {
    error.value = t('storageFilesystems.errorLoadingDevices')
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const mountDevice = async () => {
  try {
    mountLoading.value = true;
    error.value = null;
    
    const deviceToMount = mountForm.value.partition || mountForm.value.device;
    const isZfs = mountForm.value.fsType === 'zfs';
    
    // Dla ZFS używamy nazwy puli jako mountPoint jeśli nie podano
    const mountPoint = isZfs && !mountForm.value.mountPoint ? 
      mountForm.value.zfsPoolName || 'zpool' : 
      mountForm.value.mountPoint;

    const response = await axios.post('/api/storage/mount', {
      device: deviceToMount,
      mountPoint: mountPoint,
      fsType: mountForm.value.fsType,
      options: mountForm.value.options,
      zfsPoolName: mountForm.value.zfsPoolName
    });

    if (response.data.success) {
      ElNotification({
        title: 'Success',
        message: response.data.isZfs ? 
          `ZFS pool ${mountForm.value.zfsPoolName || 'zpool'} mounted successfully` : 
          'Device mounted successfully',
        type: 'success'
      });
      mountDialogVisible.value = false;
      await refreshFilesystems();
    }
  } catch (err) {
    error.value = err.response?.data?.details || err.message;
    ElNotification({
      title: 'Mount Error',
      message: error.value,
      type: 'error',
      duration: 0
    });
  } finally {
    mountLoading.value = false;
  }
};

const formatDevice = async () => {
  try {
    formatLoading.value = true;
    
    // Dla ZFS - pokaż specjalne ostrzeżenie
    if (formatForm.value.fsType === 'zfs') {
      // Wyciągnij bazową nazwę dysku
      const baseDevice = formatForm.value.device.replace(/[0-9]+$/, '');
      
      try {
        await ElMessageBox.confirm(
          `<strong>UWAGA: ZFS wymaga całego dysku!</strong><br><br>
          Będziemy używać <strong>${baseDevice}</strong> zamiast ${formatForm.value.device}.<br>
          <span style="color:red;">WSZYSTKIE DANE NA DYSKU ZOSTANĄ USUNIĘTE.</span><br><br>
          Kontynuować?`,
          'Potwierdzenie tworzenia ZFS',
          {
            confirmButtonText: 'Tak, utwórz ZFS',
            cancelButtonText: 'Anuluj',
            type: 'error',
            dangerouslyUseHTMLString: true
          }
        );
      } catch {
        return; // Użytkownik anulował
      }
    }

    const response = await axios.post('/api/storage/format', {
      device: formatForm.value.device,
      fsType: formatForm.value.fsType,
      label: formatForm.value.zfsPoolName,
      force: true
    });

    // Komunikat sukcesu z użytym urządzeniem
    ElNotification.success({
      title: 'Sukces',
      message: `Utworzono ${formatForm.value.fsType.toUpperCase()} na ${response.data.deviceUsed}`,
      duration: 5000
    });

    formatDialogVisible.value = false;
    await refreshFilesystems();

  } catch (error) {
    let message = error.response?.data?.details || error.message;
    
    // Specjalne komunikaty dla ZFS
    if (message.includes('no such device')) {
      message = `Urządzenie ${error.response?.data?.targetDevice} nie istnieje`;
    }

    ElNotification.error({
      title: 'Błąd formatowania',
      message: message,
      duration: 0
    });
  } finally {
    formatLoading.value = false;
  }
};

const unmountFilesystem = async (mountPoint) => {
  try {
    loading.value = true;
    const response = await axios.post('/api/storage/unmount', { mountPoint });
    
    ElNotification({
      title: 'Success',
      message: response.data.isZfs ?
        'ZFS pool unmounted successfully' :
        'Filesystem unmounted successfully',
      type: 'success'
    });
    
    await refreshFilesystems();
  } catch (err) {
    error.value = err.response?.data?.details || err.message;
    ElNotification({
      title: 'Unmount Error',
      message: error.value,
      type: 'error',
      duration: 0
    });
  } finally {
    loading.value = false;
  }
};

const fetchDevices = async () => {
  try {
    const response = await axios.get('/api/storage/devices')
    allDevices.value = response.data.data || []
  } catch (err) {
    console.error('Error fetching devices:', err)
    throw err
  }
}

const refreshFilesystems = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/storage/filesystems')
    if (Array.isArray(response.data?.data)) {
      filesystems.value = response.data.data
    }
  } catch (err) {
    error.value = t('storageFilesystems.errorLoading')
    console.error('Error fetching filesystems:', err)
  } finally {
    loading.value = false
  }
}

const getDeviceIcon = (device) => {
  if (device?.includes('nvme')) return 'mdi:memory'
  if (device?.includes('sd')) return 'mdi:harddisk'
  if (device?.includes('hd')) return 'mdi:harddisk'
  if (device?.includes('md')) return 'mdi:raid'
  if (device?.includes('zfs')) return 'mdi:database'
  return 'mdi:harddisk'
}

const getFsIcon = (type) => {
  const icons = {
    ext4: 'mdi:linux',
    xfs: 'mdi:file-tree',
    ntfs: 'mdi:windows',
    fat: 'mdi:usb-flash-drive',
    zfs: 'mdi:database',
    btrfs: 'mdi:database',
    bcachefs: 'mdi:database',
    f2fs: 'mdi:flash',
    jfs: 'mdi:file-tree'
  }
  return icons[type.toLowerCase()] || 'mdi:file-question'
}

const getStatusIcon = (status) => {
  const icons = {
    active: 'mdi:check-circle',
    inactive: 'mdi:close-circle',
    readonly: 'mdi:lock',
    error: 'mdi:alert-circle',
    unknown: 'mdi:help-circle'
  }
  return icons[status.toLowerCase()] || 'mdi:help-circle'
}

const getStatusType = (status) => {
  const types = {
    active: 'success',
    inactive: 'info',
    readonly: 'warning',
    error: 'danger',
    unknown: ''
  }
  return types[status.toLowerCase()] || ''
}

const getUsageColor = (percent) => {
  if (percent > 90) return '#F56C6C'
  if (percent > 70) return '#E6A23C'
  return '#67C23A'
}

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

onMounted(() => {
  refreshFilesystems()
  fetchDevices()  // Fixed typo here
})
</script>

<style scoped>
.filesystems-widget {
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.device-cell,
.mount-cell,
.size-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-message {
  margin-top: 15px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 8px;
}

.read-only-badge {
  font-size: 0.8em;
  opacity: 0.8;
  margin-left: 4px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.el-progress {
  display: inline-block;
  width: 200px;
  margin-right: 10px;
  vertical-align: middle;
}

.warning-message {
  margin-top: 15px;
  margin-bottom: 15px;
}

.zfs-options {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
</style>
