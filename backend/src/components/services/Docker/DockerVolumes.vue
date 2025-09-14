<template>
  <div class="docker-volumes">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search volumes..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>

      <div class="actions">
      <el-button type="primary" @click="fetchVolumes">
        <Icon icon="mdi:refresh" class="icon" />
        Refresh
      </el-button>
      <el-button type="success" @click="showCreateDialog = true">
        <Icon icon="mdi:plus" class="icon" />
        Create Volume
      </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredVolumes"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="Name" label="Name" />
      <el-table-column prop="Driver" label="Driver" width="120" />
      <el-table-column prop="Mountpoint" label="Mount Point" />
      <el-table-column label="Actions" width="150">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="danger"
              @click="deleteVolume(row.Name)"
            >
              <Icon icon="mdi:delete" />
            </el-button>
            <el-button
              size="small"
              type="info"
              @click="inspectVolume(row.Name)"
            >
              <Icon icon="mdi:information" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="Create Volume" width="40%">
      <el-form :model="volumeForm" label-width="120px">
        <el-form-item label="Volume Name">
          <el-input v-model="volumeForm.name" />
        </el-form-item>
        <el-form-item label="Driver">
          <el-select v-model="volumeForm.driver">
            <el-option label="local" value="local" />
            <el-option label="nfs" value="nfs" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="volumeForm.driver === 'nfs'" label="NFS Options">
          <el-input v-model="volumeForm.options.server" placeholder="Server" />
          <el-input v-model="volumeForm.options.path" placeholder="Path" style="margin-top: 10px;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="createVolume">Create</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectDialogVisible" title="Volume Details" width="60%">
      <pre class="inspect-data">{{ inspectData }}</pre>
      <template #footer>
        <el-button @click="inspectDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const volumes = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const inspectDialogVisible = ref(false);
const inspectData = ref('');
const reloadKey = inject('reloadKey');
const volumeForm = ref({
  name: '',
  driver: 'local',
  options: {
    server: '',
    path: ''
  }
});

const filteredVolumes = computed(() => {
  if (!searchQuery.value) return volumes.value;
  const query = searchQuery.value.toLowerCase();
  return volumes.value.filter(volume => 
    volume.Name.toLowerCase().includes(query) ||
    volume.Driver.toLowerCase().includes(query)
  );
});

const fetchVolumes = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/volumes');
    volumes.value = response.data.volumes;
  } catch (error) {
    ElMessage.error('Failed to fetch volumes');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const createVolume = async () => {
  try {
    const payload = {
      name: volumeForm.value.name,
      driver: volumeForm.value.driver
    };

    if (volumeForm.value.driver === 'nfs') {
      payload.driver_opts = {
        type: 'nfs',
        o: `addr=${volumeForm.value.options.server},nfsvers=4`,
        device: `:${volumeForm.value.options.path}`
      };
    }

    await axios.post('/services/docker/volumes', payload);
    ElMessage.success('Volume created successfully');
    showCreateDialog.value = false;
    volumeForm.value = { name: '', driver: 'local', options: { server: '', path: '' } };
    await fetchVolumes();
  } catch (error) {
    ElMessage.error('Failed to create volume');
    console.error(error);
  }
};

const deleteVolume = async (name) => {
  try {
    await ElMessageBox.confirm(
      `Delete volume "${name}"? This action cannot be undone.`,
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    await axios.delete(`/services/docker/volumes/${name}`);
    ElMessage.success('Volume deleted successfully');
    await fetchVolumes();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete volume');
      console.error(error);
    }
  }
};

const inspectVolume = async (name) => {
  try {
    const response = await axios.get(`/services/docker/volumes/${name}/inspect`);
    inspectData.value = JSON.stringify(response.data, null, 2);
    inspectDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to inspect volume');
    console.error(error);
  }
};

watch(reloadKey, () => {
  fetchVolumes();
});

onMounted(() => {
  fetchVolumes();
});
</script>

<style scoped>
.docker-volumes {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 10px;
}

.icon {
  margin-right: 5px;
}

.inspect-data {
  max-height: 60vh;
  overflow: auto;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
