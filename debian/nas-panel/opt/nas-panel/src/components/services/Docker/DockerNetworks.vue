<template>
  <div class="docker-networks">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search networks..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>

      <div class="actions">
      <el-button type="primary" @click="fetchNetworks">
        <Icon icon="mdi:refresh" class="icon" />
        Refresh
      </el-button>
      <el-button type="success" @click="showCreateDialog = true">
        <Icon icon="mdi:plus" class="icon" />
        Create Network
      </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredNetworks"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="ID" label="ID" width="100" />
      <el-table-column prop="Name" label="Name" />
      <el-table-column prop="Driver" label="Driver" width="120" />
      <el-table-column prop="Scope" label="Scope" width="120" />
      <el-table-column label="Actions" width="150">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="danger"
              @click="deleteNetwork(row.ID, row.Name)"
            >
              <Icon icon="mdi:delete" />
            </el-button>
            <el-button
              size="small"
              type="info"
              @click="inspectNetwork(row.ID)"
            >
              <Icon icon="mdi:information" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="Create Network" width="40%">
      <el-form :model="networkForm" label-width="120px">
        <el-form-item label="Network Name">
          <el-input v-model="networkForm.name" />
        </el-form-item>
        <el-form-item label="Driver">
          <el-select v-model="networkForm.driver">
            <el-option label="bridge" value="bridge" />
            <el-option label="host" value="host" />
            <el-option label="overlay" value="overlay" />
            <el-option label="macvlan" value="macvlan" />
          </el-select>
        </el-form-item>
        <el-form-item label="Attachable">
          <el-switch v-model="networkForm.attachable" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="createNetwork">Create</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectDialogVisible" title="Network Details" width="60%">
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

const networks = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const inspectDialogVisible = ref(false);
const inspectData = ref('');
const reloadKey = inject('reloadKey');
const networkForm = ref({
  name: '',
  driver: 'bridge',
  attachable: false
});

const filteredNetworks = computed(() => {
  if (!searchQuery.value) return networks.value;
  const query = searchQuery.value.toLowerCase();
  return networks.value.filter(network => 
    network.Name.toLowerCase().includes(query) ||
    network.ID.toLowerCase().includes(query)
  );
});

const fetchNetworks = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/networks');
    networks.value = response.data.networks;
  } catch (error) {
    ElMessage.error('Failed to fetch networks');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const createNetwork = async () => {
  try {
    await axios.post('/services/docker/networks', networkForm.value);
    ElMessage.success('Network created successfully');
    showCreateDialog.value = false;
    networkForm.value = { name: '', driver: 'bridge', attachable: false };
    await fetchNetworks();
  } catch (error) {
    ElMessage.error('Failed to create network');
    console.error(error);
  }
};

const deleteNetwork = async (id, name) => {
  try {
    await ElMessageBox.confirm(
      `Delete network "${name}" (${id})? This action cannot be undone.`,
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    await axios.delete(`/services/docker/networks/${id}`);
    ElMessage.success('Network deleted successfully');
    await fetchNetworks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete network');
      console.error(error);
    }
  }
};

const inspectNetwork = async (id) => {
  try {
    const response = await axios.get(`/services/docker/networks/${id}/inspect`);
    inspectData.value = JSON.stringify(response.data, null, 2);
    inspectDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to inspect network');
    console.error(error);
  }
};

watch(reloadKey, () => {
  fetchNetworks();
});

onMounted(() => {
  fetchNetworks();
});
</script>

<style scoped>
.docker-networks {
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
