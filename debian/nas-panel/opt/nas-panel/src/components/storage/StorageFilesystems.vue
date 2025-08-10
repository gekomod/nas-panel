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

          <el-tooltip :content="$t('storageFilesystems.createRaid')">
            <el-button 
              size="small" 
              @click="showRaidDialog" 
              :disabled="loading"
              text
            >
              <Icon icon="mdi:disk" width="16" height="16" />
            </el-button>
          </el-tooltip>

          <el-tooltip :content="$t('storageFilesystems.partition')">
	    <el-button 
	      size="small" 
	      @click="showPartitionDialog" 
	      :disabled="loading"
	      text
	    >
	      <Icon icon="mdi:harddisk-plus" width="16" height="16" />
	    </el-button>
	  </el-tooltip>
          <el-tooltip :content="$t('storageFilesystems.editFstab')">
            <el-button 
	      size="small" 
	      @click="openFstabEditor" 
	      :disabled="loading"
	      text
              >
            <Icon icon="mdi:file-edit" width="16" height="16" />
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
    
    <el-dialog 
  v-model="fstabDialogVisible" 
  title="Edit /etc/fstab" 
  width="800px"
  :close-on-click-modal="false"
>
  <div class="fstab-editor-container">
    <el-alert type="warning" :closable="false" style="margin-bottom: 15px;">
      Warning: Incorrect modifications may prevent your system from booting properly.
    </el-alert>
    
    <el-input
      v-model="fstabContent"
      type="textarea"
      :rows="20"
      resize="none"
      placeholder="Loading fstab content..."
      :loading="fstabLoading"
    />
    
    <div class="editor-actions" style="margin-top: 15px;">
      <el-button @click="fetchFstabContent" :loading="fstabLoading">
        Reload
      </el-button>
      <el-button type="primary" @click="saveFstab" :loading="fstabLoading">
        Save
      </el-button>
    </div>
  </div>
</el-dialog>

<!-- Dodaj przed format dialog -->
<el-dialog v-model="raidDialogVisible" :title="$t('storageFilesystems.raidDialog.title')" width="600px">
  <el-form :model="raidForm" label-position="top">
    <el-form-item :label="$t('storageFilesystems.raidDialog.raidLevel')">
      <el-select v-model="raidForm.level" style="width: 100%">
        <el-option label="RAID 0 (Stripping)" value="0" />
        <el-option label="RAID 1 (Mirroring)" value="1" />
        <el-option label="RAID 5 (Parity)" value="5" />
        <el-option label="RAID 6 (Double Parity)" value="6" />
        <el-option label="RAID 10 (Striped Mirror)" value="10" />
      </el-select>
    </el-form-item>

    <el-form-item :label="$t('storageFilesystems.raidDialog.devices')">
      <el-select 
        v-model="raidForm.devices" 
        multiple
        style="width: 100%"
      >
        <el-option
          v-for="device in availableRaidDevices"
          :key="device.path"
          :label="device.path"
          :value="device.path"
          :disabled="device.mountpoint"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="$t('storageFilesystems.raidDialog.name')">
      <el-input v-model="raidForm.name" placeholder="md0" />
    </el-form-item>
  </el-form>
  
  <template #footer>
    <el-button @click="raidDialogVisible = false">
      {{ $t('common.cancel') }}
    </el-button>
    <el-button type="primary" @click="createRaid">
      {{ $t('storageFilesystems.raidDialog.create') }}
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
            <span>
              {{ row.device }}
              <el-tag v-if="row.device.includes('/dev/md')" size="mini" type="warning">
                {{ $t('storageFilesystems.raidArray') }}
              </el-tag>
            </span>
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
      
	<el-table-column label="Auto-mount" width="120">
	  <template #default="{ row }">
	    <el-switch
	      v-if="!row.isZfs"
	      v-model="row.inFstab"
	      @change="toggleFstabEntry(row.device, row.mounted, row.type, row.options, $event)"
	      :loading="row.fstabLoading"
	    />
	    <el-tag v-else type="info" size="small">ZFS</el-tag>
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

  <!-- Partition Dialog -->
<el-dialog v-model="partitionDialogVisible" :title="$t('storageFilesystems.partitionDialog.title')" width="700px">
  <el-form :model="partitionForm" label-position="top">
    <el-form-item :label="$t('storageFilesystems.partitionDialog.device')">
      <el-select 
        v-model="partitionForm.device" 
        :placeholder="$t('storageFilesystems.partitionDialog.selectDevice')" 
        style="width: 100%"
        @change="checkSystemDisk"
      >
        <el-option
          v-for="device in partitionableDevices"
          :key="device.path"
          :label="`${device.path} (${device.model || 'Unknown'})`"
          :value="device.path"
          :disabled="isSystemDisk(device.path)"
        />
      </el-select>
    </el-form-item>
    
    <el-form-item :label="$t('storageFilesystems.partitionDialog.diskSize')" v-if="partitionForm.device">
  <div class="disk-usage-container">
    <el-progress 
      :percentage="diskUsagePercentage"
      :color="getUsageColor(diskUsagePercentage)"
      :show-text="false"
      :stroke-width="20"
    />
    <div class="disk-size-info">
      <span>{{ formatBytes(usedDiskSpace) }} / {{ formatBytes(totalDiskSize) }}</span>
      <span>({{ diskUsagePercentage }}%)</span>
    </div>
  </div>
</el-form-item>
    
    <el-form-item :label="$t('storageFilesystems.partitionDialog.scheme')">
      <el-radio-group v-model="partitionForm.scheme">
        <el-radio value="gpt">GPT</el-radio>
        <el-radio value="mbr">MBR</el-radio>
      </el-radio-group>
    </el-form-item>
    
    <el-form-item :label="$t('storageFilesystems.partitionDialog.partitions')">
      <div class="partition-list">
    <div v-for="(part, index) in partitionForm.partitions" :key="index" class="partition-item">

        <el-input-number 
  v-model="part.size" 
  :min="1" 
  :max="getMaxSize(part)" 
  :step="part.unit === '%' ? 1 : (part.unit === 'G' ? 10 : 100)"
  :precision="0"
/>
        <el-select 
  v-model="part.unit" 
  style="width: 100px; margin-left: 10px;"
  @change="(val) => changePartitionUnit(part, val)"
>
          <el-option label="MB" value="M" />
          <el-option label="GB" value="G" />
          <el-option label="%" value="%" />
        </el-select>
        <el-select v-model="part.type" style="width: 150px; margin-left: 10px;">
          <el-option label="Linux" value="8300" />
          <el-option label="Linux swap" value="8200" />
          <el-option label="EFI System" value="EF00" />
          <el-option label="Microsoft basic data" value="0700" />
        </el-select>
        <el-button 
          @click="removePartition(index)" 
          type="danger" 
          size="small"
        >
        <Icon icon="mdi:delete" /> 
        </el-button>
        
              <span class="partition-size-info">
        {{ calculatePartitionSize(part) }}
      </span>
    </div>
  </div>
 
      <el-button @click="addPartition" type="primary" size="small">
        {{ $t('storageFilesystems.partitionDialog.addPartition') }}
      </el-button>
    </el-form-item>
  </el-form>
  
  <template #footer>
    <el-button @click="partitionDialogVisible = false">
      {{ $t('common.cancel') }}
    </el-button>
    <el-button 
      type="primary" 
      @click="createPartitions" 
      :loading="partitionLoading"
      :disabled="partitionForm.partitions.length === 0"
    >
      {{ $t('storageFilesystems.partitionDialog.create') }}
    </el-button>
  </template>
</el-dialog>
</template>

<script>
export default {
  name: 'StorageFilesystemsWidget',
  displayName: 'Systemy plików'
}
</script>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'

const abortController = ref(new AbortController())

const { t } = useI18n()

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:3000`,
  signal: abortController.value.signal
})

const filesystems = ref([])
const allDevices = ref([])
const loading = ref(false)
const error = ref(null)
const fstabDialogVisible = ref(false);
const fstabContent = ref('');
const fstabLoading = ref(false);
const fstabEntries = ref([]);

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

const totalDiskSize = ref(0);
const usedDiskSpace = ref(0);
const diskUsagePercentage = ref(0);

const raidDialogVisible = ref(false);
const raidForm = ref({
  level: '1',
  devices: [],
  name: ''
});

const availableRaidDevices = computed(() => {
  return allDevices.value.filter(dev => 
    !dev.path.includes('md') && 
    !dev.path.includes('loop') &&
    !dev.mountpoint
  );
});

const showRaidDialog = () => {
  raidDialogVisible.value = true;
  raidForm.value = {
    level: '1',
    devices: [],
    name: ''
  };
};

const loadFstabEntries = async () => {
  try {
    const response = await api.get('/api/storage/fstab-check');
    fstabEntries.value = response.data.entries;
  } catch (error) {
    console.error('Error loading fstab entries:', error);
  }
};

const isAutoMounted = (device, mountPoint) => {
  return fstabEntries.value.some(entry => {
    const deviceMatch = entry.device === device || 
                       device.includes(entry.device) || 
                       entry.device.includes(device);

    const mountMatch = entry.mountPoint === mountPoint;
    return deviceMatch || mountMatch;
  });
};

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
  return allDevices.value.filter(device => 
    !mountedPaths.includes(device.path) && 
    !device.path.includes('loop') &&
    !device.path.includes('ram') &&
    device.type === 'disk' &&
    !isSystemDisk(device.path) // Exclude system disks
  );
});

const unmountedPartitions = computed(() => {
  const mountedPaths = filesystems.value.map(fs => fs.device);
  return allDevices.value.flatMap(device => 
    (device.partitions || [])
      .filter(part => 
        !mountedPaths.includes(part.path) &&
        !part.path.includes('loop') &&
        !part.path.includes('ram')
      )
      .map(part => ({
        ...part,
        model: device.model || 'Unknown'
      }))
  );
});

// Helper function to identify system disks
function isSystemDisk(devicePath) {
  const systemDiskPatterns = ['/dev/sda', '/dev/nvme0n1']; // Add more patterns if needed
  return systemDiskPatterns.some(pattern => devicePath.startsWith(pattern));
}

const availablePartitions = ref([]);
const updatePartitions = (devicePath) => {
  const device = allDevices.value.find(d => d.path === devicePath);
  availablePartitions.value = device?.partitions || [];
  mountForm.value.partition = availablePartitions.value[0]?.path || '';
}

// FSTAB
const fetchFstabContent = async () => {
  try {
    fstabLoading.value = true;
    const response = await api.get('/api/storage/fstab-content');
    fstabContent.value = response.data.content;
  } catch (error) {
    ElNotification({
      title: 'Error',
      message: error.response?.data?.details || error.message,
      type: 'error'
    });
  } finally {
    fstabLoading.value = false;
  }
}

const saveFstab = async () => {
  try {
    fstabLoading.value = true;
    await api.post('/api/storage/save-fstab', { content: fstabContent.value });
    ElNotification({
      title: 'Success',
      message: 'Fstab saved successfully',
      type: 'success'
    });
    fstabDialogVisible.value = false;
  } catch (error) {
    ElNotification({
      title: 'Error',
      message: error.response?.data?.details || error.message,
      type: 'error'
    });
  } finally {
    fstabLoading.value = false;
  }
}

const openFstabEditor = async () => {
  try {
    await ElMessageBox.confirm(
      'You are about to edit system fstab file. Make sure you know what you are doing.',
      'Warning',
      {
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );
    fstabDialogVisible.value = true;
    await fetchFstabContent();
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification({
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    }
  }
}

const createRaid = async () => {
  try {
    if (raidForm.value.devices.length < 2) {
      throw new Error(t('storageFilesystems.raidDialog.minDevicesError'));
    }

    const response = await axios.post('/api/storage/create-raid', {
      devices: raidForm.value.devices,
      raidLevel: raidForm.value.level,
      name: raidForm.value.name
    });

    if (response.data.success) {
      ElNotification({
        title: t('common.success'),
        message: t('storageFilesystems.raidDialog.createSuccess'),
        type: 'success'
      });
      raidDialogVisible.value = false;
      await fetchDevices();
    }
  } catch (error) {
    ElNotification({
      title: t('common.error'),
      message: error.response?.data?.details || error.message,
      type: 'error'
    });
  }
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

const checkFstabEntry = async (device, mountPoint) => {
  try {
    const response = await axios.post('/api/storage/fstab', {
      action: 'check',
      device,
      mountPoint
    });
    return response.data.exists;
  } catch (error) {
    console.error('Error checking fstab:', error);
    return false;
  }
}

const toggleFstabEntry = async (device, mountPoint, fsType, options, enabled) => {
  try {
    const response = await axios.post('/api/storage/fstab', {
      action: enabled ? 'add' : 'remove',
      device,
      mountPoint,
      fsType,
      options
    });
    
    if (response.data.success) {
      // Aktualizujemy stan w tablicy filesystems
      const fsIndex = filesystems.value.findIndex(fs => 
        fs.device === device && fs.mounted === mountPoint
      );
      
      if (fsIndex !== -1) {
        filesystems.value[fsIndex].inFstab = enabled;
      }
      
      ElNotification({
        title: 'Success',
        message: response.data.message,
        type: 'success'
      });
      return true;
    }
    return false;
  } catch (error) {
    ElNotification({
      title: 'Error',
      message: error.response?.data?.details || error.message,
      type: 'error'
    });
    return false;
  }
}

const mountDevice = async () => {
  try {
    mountLoading.value = true;
    error.value = null;
    
    const deviceToMount = mountForm.value.partition || mountForm.value.device;
    const isZfs = mountForm.value.fsType === 'zfs';
    
    const mountPoint = isZfs && !mountForm.value.mountPoint ? 
      mountForm.value.zfsPoolName || 'zpool' : 
      mountForm.value.mountPoint;

    // For non-ZFS, ask about fstab
    let addToFstab = false;
    if (!isZfs) {
      try {
        await ElMessageBox.confirm(
          'Czy dodać to montowanie do /etc/fstab dla automatycznego montowania przy starcie systemu?',
          'Dodawanie do fstab',
          {
            confirmButtonText: 'Tak, dodaj do fstab',
            cancelButtonText: 'Nie',
            type: 'info'
          }
        );
        addToFstab = true;
      } catch {
        // User canceled
      }
    }

    await fetchDevices();

    const response = await axios.post('/api/storage/mount', {
      device: deviceToMount,
      mountPoint: mountPoint,
      fsType: mountForm.value.fsType,
      options: mountForm.value.options,
      zfsPoolName: mountForm.value.zfsPoolName
    });

    if (response.data.success) {
      // If user wanted to add to fstab but it wasn't added automatically (e.g., already exists)
      if (addToFstab && !response.data.addedToFstab && !isZfs) {
        await toggleFstabEntry(
          deviceToMount,
          mountPoint,
          mountForm.value.fsType,
          mountForm.value.options,
          true
        );
      }

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
}

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
  abortController.value.abort();
  abortController.value = new AbortController();
  api.defaults.signal = abortController.value.signal;

  try {
    loading.value = true;
    const [fsResponse, fstabResponse] = await Promise.all([
      api.get('/api/storage/filesystems'),
      api.get('/api/storage/fstab-check')
    ]);
    
    if (Array.isArray(fsResponse.data?.data)) {
      filesystems.value = fsResponse.data.data.map(fs => ({
        ...fs,
        inFstab: isAutoMounted(fs.device, fs.mounted),
        fstabLoading: false
      }));
    }
    
    fstabEntries.value = fstabResponse.data.entries || [];
  } catch (error) {
    if (!axios.isCancel(error)) {
      error.value = t('storageFilesystems.errorLoading');
      console.error('Error fetching filesystems:', error);
    }
  } finally {
    loading.value = false;
  }
};

const editFstabManually = async () => {
  let timeoutId;
  try {
    await ElMessageBox.confirm(
      'To będzie otwierać plik /etc/fstab w edytorze systemowym. Kontynuować?',
      'Ręczna edycja fstab',
      {
        confirmButtonText: 'Tak, otwórz',
        cancelButtonText: 'Anuluj',
        type: 'warning'
      }
    );

    // Używamy axios zamiast bezpośrednio execAsync
    const response = await api.post('/api/storage/edit-fstab');
    
    ElNotification({
      title: 'Success',
      message: response.data.message || 'Fstab opened in editor',
      type: 'success'
    });
  } catch (error) {
    if (error.response) {
      // Błąd z serwera
      ElNotification({
        title: 'Error',
        message: error.response.data.details || error.message,
        type: 'error'
      });
    } else if (error !== 'cancel') {
      // Inny błąd (nie anulowanie przez użytkownika)
      ElNotification({
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    }
  } finally {
    clearTimeout(timeoutId);
    // Resetujemy controller dla następnych operacji
    abortController.value = new AbortController();
    api.defaults.signal = abortController.value.signal;
  }
};

const getFstabOptions = (device, mountPoint) => {
  const entry = fstabEntries.value.find(e => 
    e.device === device || e.mountPoint === mountPoint
  );
  return entry?.options || 'defaults';
};

const toggleAutoMount = async (row) => {
  try {
    row.fstabLoading = true;
    const isAuto = isAutoMounted(row.device, row.mounted);
    
    if (isAuto) {
      // Usuń z fstab
      await api.post('/api/storage/fstab-remove', {
        device: row.device,
        mountPoint: row.mounted
      });
    } else {
      // Dodaj do fstab
      await api.post('/api/storage/fstab-add', {
        device: row.device,
        mountPoint: row.mounted,
        fsType: row.type,
        options: 'defaults,nofail'
      });
    }
    
    await loadFstabEntries();
    ElNotification({
      title: 'Sukces',
      message: isAuto ? 'Usunięto z auto-montowania' : 'Dodano do auto-montowania',
      type: 'success'
    });
  } catch (error) {
    ElNotification({
      title: 'Błąd',
      message: error.response?.data?.error || error.message,
      type: 'error'
    });
  } finally {
    row.fstabLoading = false;
  }
};


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

const renderDeviceLabel = (device) => {
  let label = device.path;
  if (device.isRaid) {
    label += ' [RAID]';
  } else if (device.model && device.model !== 'Unknown') {
    label += ` (${device.model})`;
  }
  if (device.fstype) {
    label += ` [${device.fstype}]`;
  }
  if (device.label) {
    label += ` - ${device.label}`;
  }
  return label;
};

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

// Partition dialog
const partitionDialogVisible = ref(false);
const partitionLoading = ref(false);
const partitionForm = ref({
  device: '',
  scheme: 'gpt',
  partitions: [
    { size: 100, unit: '%', type: '8300' }
  ]
});

const partitionableDevices = computed(() => {
  return allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path)
  );
});

const showPartitionDialog = async () => {
  try {
    loading.value = true;
    await fetchDevices();
    partitionDialogVisible.value = true;
  } catch (err) {
    error.value = t('storageFilesystems.errorLoadingDevices');
    console.error('Error loading devices:', err);
  } finally {
    loading.value = false;
  }
};

const addPartition = () => {
  partitionForm.value.partitions.push({ size: 10, unit: 'G', type: '8300' });
};

const removePartition = (index) => {
  partitionForm.value.partitions.splice(index, 1);
};

const checkSystemDisk = (devicePath) => {
  if (isSystemDisk(devicePath)) {
    ElMessage.warning('This appears to be a system disk. Partitioning system disks is not recommended.');
  }
};

const createPartitions = async () => {
  try {
    partitionLoading.value = true;
    
    // Validate
    validatePartitions();
    if (isSystemDisk(partitionForm.value.device)) {
      throw new Error('Cannot partition system disk');
    }
    
    // Create partition command
    let cmd = `sudo sgdisk --zap-all ${partitionForm.value.device} && `;
    cmd += `sudo parted -s ${partitionForm.value.device} mklabel ${partitionForm.value.scheme} && `;
    
    partitionForm.value.partitions.forEach((part, index) => {
      const size = part.unit === '%' ? `${part.size}%` : `${part.size}${part.unit}`;
      cmd += `sudo sgdisk -n ${index + 1}:0:+${size} -t ${index + 1}:${part.type} ${partitionForm.value.device} && `;
    });
    
    cmd += `sudo partprobe ${partitionForm.value.device}`;
    
    const response = await axios.post('/api/storage/exec-command', { 
      command: cmd,
      timeout: 60000 
    });
    
    ElNotification({
      title: 'Success',
      message: 'Partitions created successfully',
      type: 'success'
    });
    
    partitionDialogVisible.value = false;
    await fetchDevices();
    await refreshFilesystems();
  } catch (error) {
    ElNotification({
      title: 'Error',
      message: error.response?.data?.details || error.message,
      type: 'error'
    });
  } finally {
    partitionLoading.value = false;
  }
};

// Nowe metody
const getDiskSize = async (devicePath) => {
  try {
    const response = await axios.get('/api/storage/disk-size', {
      params: { device: devicePath }
    });
    totalDiskSize.value = response.data.size;
    updateDiskUsage();
  } catch (error) {
    console.error('Error getting disk size:', error);
    totalDiskSize.value = 0;
  }
};

const updateDiskUsage = () => {
  let used = 0;
  
  partitionForm.value.partitions.forEach(part => {
    if (part.unit === '%') {
      used += (part.size / 100) * totalDiskSize.value;
    } else if (part.unit === 'G') {
      used += part.size * 1024 * 1024 * 1024;
    } else { // MB
      used += part.size * 1024 * 1024;
    }
  });
  
  usedDiskSpace.value = Math.min(used, totalDiskSize.value);
  diskUsagePercentage.value = Math.round((usedDiskSpace.value / totalDiskSize.value) * 100);
};

const calculatePartitionSize = (part) => {
  if (part.unit === '%') {
    const size = (part.size / 100) * totalDiskSize.value;
    return formatBytes(size);
  } else if (part.unit === 'G') {
    return `${part.size} GB`;
  } else {
    return `${part.size} MB`;
  }
};

const getMaxSize = (part) => {
  if (part.unit === '%') {
    return 100;
  } else if (part.unit === 'G') {
    return Math.floor(totalDiskSize.value / (1024 * 1024 * 1024));
  } else {
    return Math.floor(totalDiskSize.value / (1024 * 1024));
  }
};

const getMaxSizeForUnit = (unit) => {
  if (!totalDiskSize.value) return 100;
  
  if (unit === '%') return 100;
  if (unit === 'G') return Math.floor(totalDiskSize.value / (1024 * 1024 * 1024));
  return Math.floor(totalDiskSize.value / (1024 * 1024));
};

const changePartitionUnit = (part, newUnit) => {
  const oldUnit = part.unit;
  part.unit = newUnit;
  
  if (oldUnit === '%' && newUnit !== '%') {
    // Konwersja z % na MB/GB
    const sizeInBytes = (part.size / 100) * totalDiskSize.value;
    if (newUnit === 'G') {
      part.size = Math.floor(sizeInBytes / (1024 * 1024 * 1024));
    } else {
      part.size = Math.floor(sizeInBytes / (1024 * 1024));
    }
  } else if (oldUnit !== '%' && newUnit === '%') {
    // Konwersja z MB/GB na %
    const sizeInBytes = oldUnit === 'G' 
      ? part.size * 1024 * 1024 * 1024 
      : part.size * 1024 * 1024;
    part.size = Math.floor((sizeInBytes / totalDiskSize.value) * 100);
  }
  
  // Upewnij się, że nie przekraczamy maksimum
  const maxSize = getMaxSizeForUnit(newUnit);
  if (part.size > maxSize) {
    part.size = maxSize;
  }
};

const validatePartitions = () => {
  let totalPercent = 0;
  let totalBytes = 0;
  
  for (const part of partitionForm.value.partitions) {
    if (part.unit === '%') {
      totalPercent += part.size;
    } else {
      const bytes = part.unit === 'G' 
        ? part.size * 1024 * 1024 * 1024 
        : part.size * 1024 * 1024;
      totalBytes += bytes;
    }
  }
  
  if (totalPercent > 100) {
    throw new Error('Suma partycji procentowych nie może przekroczyć 100%');
  }
  
  if (totalBytes > totalDiskSize.value) {
    throw new Error('Suma partycji nie może przekroczyć rozmiaru dysku');
  }
  
  return true;
};

const isPartitionExceeding = (part) => {
  if (part.unit === '%') {
    return part.size > 100;
  }
  
  const sizeInBytes = part.unit === 'G' 
    ? part.size * 1024 * 1024 * 1024 
    : part.size * 1024 * 1024;
  
  return sizeInBytes > totalDiskSize.value;
};

// Aktualizujemy watch na zmianę urządzenia
watch(() => partitionForm.value.device, (newVal) => {
  if (newVal) {
    getDiskSize(newVal);
  } else {
    totalDiskSize.value = 0;
    usedDiskSpace.value = 0;
    diskUsagePercentage.value = 0;
  }
});

// Aktualizujemy watch na zmianę partycji
watch(() => partitionForm.value.partitions, () => {
  updateDiskUsage();
}, { deep: true });

onMounted(() => {
  refreshFilesystems()
  fetchDevices()  // Fixed typo here
  loadFstabEntries();
});

onUnmounted(() => {
  abortController.value.abort();
});
</script>

<style scoped>
.error-text {
  color: var(--el-color-danger);
}

.partition-item .el-icon {
  margin-left: 5px;
  vertical-align: middle;
}

.disk-usage-container {
  width: 100%;
  margin-bottom: 15px;
}

.disk-size-info {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
}

.partition-list {
  width: 100%;
}

.partition-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.partition-size-info {
  margin-left: auto;
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
}

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
  width: 100%;
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

.fstab-editor-container {
  font-family: monospace;
}

.fstab-editor-container .el-textarea__inner {
  font-family: monospace;
  white-space: pre;
  overflow-x: auto;
}

.raid-device-badge {
  margin-left: 8px;
  background-color: #f0ad4e;
  color: white;
}
</style>
