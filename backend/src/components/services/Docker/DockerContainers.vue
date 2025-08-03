<template>
  <div class="docker-containers">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search containers..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <el-icon><Icon icon="mdi:magnify" /></el-icon>
        </template>
      </el-input>

      <el-button type="primary" @click="fetchContainers">
        <el-icon><Icon icon="mdi:refresh" /></el-icon>
        Refresh
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="processedContainers"
      @row-click="handleRowClick"
      style="width: 100%"
      stripe
    >
      <el-table-column type="expand">
        <template #default="{row}" >
         <ContainerStats :containerId="row.ID" />
        </template>
      </el-table-column>
      
      <el-table-column prop="ID" label="ID" width="100">
        <template #default="{row}">
          <el-tooltip :content="row.ID" placement="top">
            <span>{{ safeSubstring(row.ID, 0, 12) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column prop="Names" label="Name">
        <template #default="{row}">
          <el-tooltip :content="row.Names" placement="top">
            <span>{{ safeSubstring(row.Names, 0, 20) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column prop="image" label="Image">
        <template #default="{row}">
          {{ row.image || '-' }}
        </template>
      </el-table-column>
      
      <el-table-column prop="command" label="Command">
        <template #default="{row}">
          <el-tooltip v-if="row.command" :content="row.command" placement="top">
            <span>{{ safeSubstring(row.command, 0, 20) }}</span>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column label="CPU" width="120">
        <template #default="{row}">
          <div v-if="rowStats[row.ID]">
            {{ rowStats[row.ID].cpu }}%
            <el-progress 
              :percentage="rowStats[row.ID].cpu" 
              :color="getProgressColor(rowStats[row.ID].cpu)"
              :show-text="false"
              :stroke-width="12"
            />
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="Memory" width="120">
        <template #default="{row}">
          <div v-if="rowStats[row.ID]">
            {{ rowStats[row.ID].memory }}%
            <el-progress 
              :percentage="rowStats[row.ID].memory" 
              :color="getProgressColor(rowStats[row.ID].memory)"
              :show-text="false"
              :stroke-width="12"
            />
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column prop="status" label="Status">
        <template #default="{row}">
          <el-tag :type="getStatusType(row.status)">
            {{ row.status || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="ports" label="Ports">
        <template #default="{row}">
          <div v-if="row.ports">
            <el-tag 
              v-for="(port, index) in safeSplit(row.ports)" 
              :key="index"
              size="small"
              style="margin-right: 5px; margin-bottom: 5px;"
            >
              {{ port }}
            </el-tag>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="Actions" width="240">
        <template #default="{row}">
          <el-button-group>

            <el-tooltip
              class="box-item"
              effect="dark"
              content="Edit Configuration File"
              placement="top-start"
            >
                <el-button 
                  type="primary" 
                  size="small"
                  v-if="isContainerRunning(row.status)"
                  @click="openEditor(row.ID, row.Config?.Labels?.['com.docker.compose.project.config_files'] || `${row.Names}.yml`)"
                >
                  <Icon icon="mdi:file-edit" />
                </el-button>
            </el-tooltip>



      <el-tooltip
        class="box-item"
        effect="dark"
        content="Start/Stop Container"
        placement="top-start"
      >
            <el-button
              v-if="!isContainerRunning(row.status)"
              size="small"
              type="success"
              @click="manageContainer(row.ID, 'start')"
            >
              <el-icon><Icon icon="mdi:play" /></el-icon>
            </el-button>
     
            <el-button
              v-else
              size="small"
              type="danger"
              @click="manageContainer(row.ID, 'stop')"
            >
              <el-icon><Icon icon="mdi:stop" /></el-icon>
            </el-button>
            <el-button
              size="small"
              type="warning"
              @click="manageContainer(row.ID, 'restart')"
              :loading="loadingActions[row.ID] === 'restart'"
            >
              <el-icon><Icon icon="mdi:restart" /></el-icon>
            </el-button>
            </el-tooltip>
                  <el-tooltip
        class="box-item"
        effect="dark"
        content="Restart"
        placement="top-start"
      >
            <el-button size="small" v-if="isContainerRunning(row.status)" type="warning" @click="handleRestart(row.ID)"><el-icon><Icon icon="mdi:restart" /></el-icon></el-button>
      </el-tooltip>
       
      <el-tooltip
        class="box-item"
        effect="dark"
        content="Show Container Logs"
        placement="top-start"
      >
            <el-button
              size="small"
              type="primary"
              @click="showContainerLogs(row.ID)"
            >
              <el-icon><Icon icon="mdi:file-document" /></el-icon>
            </el-button>
      </el-tooltip>
            
      <el-tooltip
        class="box-item"
        effect="dark"
        content="Delete Container"
        placement="top-start"
      >
            <el-button
              size="small"
              type="danger"
              plain
              @click.stop="confirmDeleteContainer(row)"
            >
            <el-icon><Icon icon="mdi:delete" /></el-icon>
            </el-button>
      </el-tooltip>
      
      
      
      <el-tooltip
        class="box-item"
        effect="dark"
        content="Open SSH"
        placement="top-start"
      >
      <el-button
        size="small"
        type="success"
        v-if="isContainerRunning(row.status)"
        @click.stop="openSshDialog(row.ID)"
      >
        <el-icon><Icon icon="mdi:console" /></el-icon>
      </el-button>
      </el-tooltip>
      
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

        <el-dialog
      v-model="logsDialogVisible"
      title="Container Logs"
      width="70%"
    >
      <div class="logs">
        <pre>{{ containerLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="logsDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>
<file-editor 
  ref="fileEditor" 
  :container-id="selectedContainerId" 
  @container-updated="fetchContainers" 
/>
<el-dialog
  v-model="statsDialogVisible"
  title="Container Stats"
  width="70%"
>
  <ContainerStats v-if="statsDialogVisible" :containerId="selectedContainerId" />
  <template #footer>
    <el-button @click="statsDialogVisible = false">Close</el-button>
  </template>
</el-dialog>

  <el-dialog
    v-model="sshDialogVisible"
    title="SSH Connection"
    width="70%"
  >
    <div class="ssh-terminal">
      <div class="ssh-output">
        <pre>KIEDYŚ</pre>
      </div>
    </div>
    <template #footer>
      <el-button @click="sshDialogVisible = false">Close</el-button>
    </template>
  </el-dialog>

  </div>

    <el-dialog v-model="showCreateDialog" title="Create New Container" width="60%">
    <el-form :model="createForm" label-width="120px">
      <el-form-item label="Container Name">
        <el-input v-model="createForm.name" />
      </el-form-item>
      <el-form-item label="Image">
        <el-select
          v-model="createForm.image"
          filterable
          remote
          :remote-method="searchImages"
          placeholder="e.g. nginx:latest"
        >
          <el-option
            v-for="img in availableImages"
            :key="img"
            :label="img"
            :value="img"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Ports">
        <el-tag
          v-for="(port, index) in createForm.ports"
          :key="index"
          closable
          @close="removePort(index)"
        >
          {{ port }}
        </el-tag>
        <el-input
          v-model="newPort"
          placeholder="e.g. 8080:80"
          style="width: 150px; margin-left: 10px"
          @keyup.enter="addPort"
        >
          <template #append>
            <el-button icon="plus" @click="addPort" />
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="Volumes">
        <el-tag
          v-for="(vol, index) in createForm.volumes"
          :key="index"
          closable
          @close="removeVolume(index)"
        >
          {{ vol }}
        </el-tag>
        <el-input
          v-model="newVolume"
          placeholder="e.g. /host/path:/container/path"
          style="width: 250px; margin-left: 10px"
          @keyup.enter="addVolume"
        >
          <template #append>
            <el-button icon="plus" @click="addVolume" />
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="Environment">
        <div v-for="(env, index) in createForm.env" :key="index" class="env-row">
          <el-input v-model="env.key" placeholder="Key" style="width: 150px" />
          <el-input v-model="env.value" placeholder="Value" style="width: 250px" />
          <el-button icon="delete" @click="removeEnv(index)" />
        </div>
        <el-button @click="addEnv">Add Environment Variable</el-button>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showCreateDialog = false">Cancel</el-button>
      <el-button type="primary" @click="createContainer">Create</el-button>
    </template>
  </el-dialog>

</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox, ElTooltip } from 'element-plus';
import ContainerStats from './ContainerStats.vue';
import FileEditor from './FileEditor.vue';

const containers = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const logsDialogVisible = ref(false);
const statsDialogVisible = ref(false);
const containerLogs = ref('');
const selectedContainerId = ref('');
const loadingActions = ref({});
const expandedRow = ref(null);
const containerStats = ref({});
const reloadKey = inject('reloadKey');
const sshDialogVisible = ref(false);
const currentSshContainer = ref('');
const showCreateDialog = ref(false);
const rowStats = ref({});
const createForm = ref({
  name: '',
  image: '',
  ports: [],
  volumes: [],
  env: []
});
const newPort = ref('');
const newVolume = ref('');
const availableImages = ref([]);
const refreshInterval = ref(5000);
let statsInterval = null;

const fileEditor = ref(null);

const emit = defineEmits(['restart-container', 'show-stats']);

// Then when you need to emit these events, use:
const handleRestart = (containerId) => {
  emit('restart-container', containerId);
};

const handleShowStats = (containerId) => {
  emit('show-stats', containerId);
};

const handleRowClick = async (row) => {
          expandedRow.value = row.ID;
	    if (!containerStats.value[row.ID]) {
	      await fetchContainerStats(row.ID);
	    }
    }

const toggleRowExpansion = async (row) => {
  if (expandedRow.value === row.ID) {
    expandedRow.value = null;
  } else {
    expandedRow.value = row.ID;
    if (!containerStats.value[row.ID]) {
      await fetchContainerStats(row.ID);
    }
  }
};

const fetchContainerStats = async (containerId) => {
  try {
    const response = await axios.get(`/services/docker/stats/container/${containerId}`);
    containerStats.value[containerId] = response.data.stats;
    const stats = response.data.stats || {};
    
    rowStats.value[containerId] = {
      cpu: parseFloat(stats.CPUPerc?.replace('%', '')) || 0,
      memory: parseFloat(stats.MemPerc?.replace('%', '')) || 0
    };
  } catch (error) {
    ElMessage.error('Failed to fetch container stats');
    console.error(error);
  }
};

const startStatsRefresh = () => {
  stopStatsRefresh();
  statsInterval = setInterval(() => {
    containers.value.forEach(container => {
      fetchContainerStats(container.ID);
    });
  }, refreshInterval.value);
};

const stopStatsRefresh = () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
};

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#67C23A';
  if (percentage < 70) return '#E6A23C';
  return '#F56C6C';
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper functions
const safeSubstring = (str, start, end) => {
  if (!str) return '-';
  return str.length > end ? str.substring(start, end) + '...' : str;
};

const safeSplit = (str, delimiter = ',') => {
  if (!str) return [];
  return str.split(delimiter).map(s => s.trim()).filter(s => s);
};

const isContainerRunning = (status) => {
  return status?.toLowerCase().includes('up');
};

const getStatusType = (status) => {
  if (!status) return 'info';
  if (status.includes('Up')) return 'success';
  if (status.includes('Exited')) return 'danger';
  if (status.includes('Paused')) return 'warning';
  return 'info';
};

// Process containers data to ensure all fields exist
const processedContainers = computed(() => {
  const filtered = searchQuery.value ? containers.value.filter(container => {
      const search = searchQuery.value.toLowerCase();
      return (container.id?.toLowerCase().includes(search)) || (container.image?.toLowerCase().includes(search)) || (container.status?.toLowerCase().includes(search));
    }) : containers.value;

  return filtered.map(container => ({
    ID: container.ID || container.id || '',
    Names: container.Names || container.names || '',
    image: container.Image || container.image || '',
    command: container.Command || container.command || '',
    status: container.Status || container.status || '',
    ports: container.Ports || container.ports || ''
  }));
});

const fetchContainers = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/containers', {
      params: { all: true }
    });
    containers.value = Array.isArray(response.data?.containers) ? 
      response.data.containers.map(container => ({
        ...container,
        Config: {
          ...container.Config,
          Labels: container.Config?.Labels || {}
        }
      })) : [];

    containers.value.forEach(container => {
      fetchContainerStats(container.ID);
    });
  } catch (error) {
    ElMessage.error('Failed to fetch containers');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const manageContainer = async (id, action) => {
  try {
    loadingActions.value[id] = action;
    await axios.post(`/services/docker/container/${id}/${action}`);
    ElMessage.success(`Container ${action}ed successfully`);
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to ${action} container`);
    console.error(error);
  } finally {
    loadingActions.value[id] = null;
  }
};

const deleteContainer = async (containerId) => {
  try {
    loadingActions.value[containerId] = 'delete';
    
    const response = await axios.delete(`/services/docker/container/${containerId}`, {
      params: {
        removeVolumes: true,
        removeImage: true,
        force: true
      }
    });
    
    await fetchContainers();
    ElMessage.success(response.data.message || 'Container deleted successfully');
  } catch (error) {
    const errorMsg = error.response?.data?.details || 
                    error.response?.data?.error || 
                    'Failed to delete container';
    ElMessage.error(errorMsg);
    console.error('Delete error:', error);
    throw error; // Rzuć błąd dalej dla obsługi w confirmDeleteContainer
  } finally {
    loadingActions.value[containerId] = null;
  }
};

const confirmDeleteContainer = (container) => {
  ElMessageBox.confirm(
    `This will permanently delete container ${container.ID} with all associated resources. Continue?`,
    'Delete Confirmation',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
      beforeClose: async (action, instance, done) => {
        if (action === 'confirm') {
          instance.confirmButtonLoading = true;
          try {
            await deleteContainer(container.ID);
            done();
          } catch {
            instance.confirmButtonLoading = false;
          }
        } else {
          done();
        }
      }
    }
  ).catch(() => {});
};

const showContainerLogs = async (id) => {
  try {
    selectedContainerId.value = id;
    const response = await axios.get(`/services/docker/container/logs/${id}`);
    containerLogs.value = response.data.logs;
    logsDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to get container logs');
    console.error(error);
  }
};

const showContainerStats = (id) => {

  if (!id) {
    ElMessage.warning('No container ID provided');
    return;
  }
  selectedContainerId.value = id;
  statsDialogVisible.value = true;
};

const openSshDialog = (containerId) => {
  currentSshContainer.value = containerId;
  sshDialogVisible.value = true;
};

const searchImages = async (query) => {
  if (query) {
    try {
      const response = await axios.get('https://registry.hub.docker.com/v1/search', {
        params: { q: query }
      });
      availableImages.value = response.data.results.map(r => r.name);
    } catch (error) {
      console.error('Error searching images:', error);
    }
  }
};

const addPort = () => {
  if (newPort.value) {
    createForm.value.ports.push(newPort.value);
    newPort.value = '';
  }
};

const removePort = (index) => {
  createForm.value.ports.splice(index, 1);
};

const addVolume = () => {
  if (newVolume.value) {
    createForm.value.volumes.push(newVolume.value);
    newVolume.value = '';
  }
};

const removeVolume = (index) => {
  createForm.value.volumes.splice(index, 1);
};

const addEnv = () => {
  createForm.value.env.push({ key: '', value: '' });
};

const removeEnv = (index) => {
  createForm.value.env.splice(index, 1);
};

const createContainer = async () => {
  try {
    const envVars = {};
    createForm.value.env.forEach(e => {
      if (e.key) envVars[e.key] = e.value;
    });
    
    const response = await axios.post('/services/docker/container/create', {
      name: createForm.value.name,
      image: createForm.value.image,
      ports: createForm.value.ports,
      volumes: createForm.value.volumes,
      env: envVars
    });
    
    ElMessage.success(response.data.message);
    showCreateDialog.value = false;
    await fetchContainers();
  } catch (error) {
    ElMessage.error('Failed to create container');
    console.error(error);
  }
};

const openEditor = (id, name) => {
  selectedContainerId.value = id; // Upewnij się, że to jest ustawione
  fileEditor.value.openEditor(id, name); // Przekazuj obie wartości
};

watch(reloadKey, () => {
  fetchContainers();
});

onMounted(() => {
  fetchContainers();
  startStatsRefresh();
});

onBeforeUnmount(() => {
  stopStatsRefresh();
});
</script>

<style scoped>
.docker-containers {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 10px;
}

.el-progress {
  margin-top: 5px;
}

.icon {
  margin-right: 5px;
}

.logs {
  max-height: 60vh;
  overflow: auto;
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
}

.container-info {
  padding: 10px;
}

.container-info h3 {
  margin-bottom: 15px;
  color: #606266;
}

.stats-container {
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  margin: 5px 0;
}

.stat-item {
  margin-bottom: 15px;
}

.stat-item span {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #606266;
}

.stat-detail {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.network-stats {
  display: flex;
  gap: 15px;
}

.loading-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #909399;
}

.loading-stats .el-icon {
  margin-right: 8px;
  font-size: 16px;
}

/* Dodaj nowe style */
.ssh-terminal {
  height: 60vh;
  display: flex;
  flex-direction: column;
}

.ssh-output {
  flex-grow: 1;
  overflow: auto;
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  margin-top: 10px;
}
</style>
