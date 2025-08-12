<template>
  <div class="docker-containers">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search containers..."
        clearable
        class="search-input"
        size="large"
        @clear="fetchContainers"
      >
        <template #prefix>
          <el-icon><Icon icon="mdi:magnify" /></el-icon>
        </template>
      </el-input>

      <div class="header-actions">
        <el-button type="primary" @click="showCreateDialog = true" size="large" class="create-btn">
          <el-icon><Icon icon="mdi:plus" /></el-icon>
          Create
        </el-button>
        <el-button type="info" @click="fetchContainers" size="large" class="refresh-btn" :loading="loading">
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          Refresh
        </el-button>
      </div>
    </div>

    <el-card class="table-card" shadow="never" v-loading="loading" :element-loading-text="loadingText">
      <template v-if="processedContainers.length === 0 && !loading">
        <el-empty description="No containers found">
          <el-button type="primary" @click="fetchContainers">Try Again</el-button>
        </el-empty>
      </template>

      <el-table
        v-else
        :data="processedContainers"
        @row-click="handleRowClick"
        class="full-width-table"
        :header-cell-style="headerStyle"
        :cell-style="cellStyle"
        stripe
        empty-text="No containers available"
        style="flex-grow: 1;"
      >
        <el-table-column type="expand">
          <template #default="{row}">
            <ContainerStats :container-id="row.ID" />
          </template>
        </el-table-column>
        
        <el-table-column prop="ID" label="ID" :width="columnWidths.ID">
          <template #default="{row}">
            <el-tooltip :content="row.ID" placement="top">
              <span class="container-id">{{ safeSubstring(row.ID, 0, 12) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column prop="Names" label="Name" :width="columnWidths.Names">
          <template #default="{row}">
            <div class="name-cell">
              <el-tooltip :content="row.Names" placement="top">
                <span class="name-text">{{ safeSubstring(row.Names, 0, 20) }}</span>
              </el-tooltip>
              <el-tag 
                v-if="row.Config?.Labels?.['com.docker.compose.project']" 
                size="small" 
                effect="light"
                class="compose-tag"
              >
                {{ row.Config.Labels['com.docker.compose.project'] }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="Image" label="Image" :width="columnWidths.Image">
          <template #default="{row}">
            <el-tooltip :content="row.Image" placement="top">
              <span class="image-text">{{ safeSubstring(row.Image, 0, 25) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column label="Status" :width="columnWidths.Status">
          <template #default="{row}">
            <el-tag :type="getStatusType(row.Status)" effect="dark" round>
              {{ getStatusText(row.Status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="Uptime" :width="columnWidths.Uptime">
          <template #default="{row}">
            <div class="uptime-container">
              <el-tooltip :content="`Created: ${row.CreatedAt}`" placement="top">
                <span class="uptime-item">
                  <el-icon><Icon icon="mdi:calendar-clock" /></el-icon>
                  {{ formatTimeAgo(row.RunningFor) }}
                </span>
              </el-tooltip>
              <el-tooltip content="Time since last start" placement="top">
                <span class="uptime-item" v-if="isContainerRunning(row.Status)">
                  <el-icon><Icon icon="mdi:clock-start" /></el-icon>
                  {{ extractUpTime(row.Status) }}
                </span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Resources" :width="columnWidths.Resources">
          <template #default="{row}">
            <div class="resource-meters">
              <div class="meter-row">
                <span class="meter-label">CPU</span>
                <el-progress 
                  v-if="rowStats[row.ID]"
                  :percentage="rowStats[row.ID].cpu" 
                  :color="getProgressColor(rowStats[row.ID].cpu)"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <span class="meter-value">{{ rowStats[row.ID]?.cpu || 0 }}%</span>
              </div>
              <div class="meter-row">
                <span class="meter-label">MEM</span>
                <el-progress 
                  v-if="rowStats[row.ID]"
                  :percentage="rowStats[row.ID].memory" 
                  :color="getProgressColor(rowStats[row.ID].memory)"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <span class="meter-value">{{ rowStats[row.ID]?.memory || 0 }}%</span>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="Ports" :width="columnWidths.Ports">
          <template #default="{row}">
            <div v-if="row.Ports" class="ports-container">
              <el-tag 
                v-for="(port, index) in safeSplit(row.Ports)" 
                :key="index"
                size="small"
                effect="plain"
                class="port-tag"
              >
                {{ port }}
              </el-tag>
            </div>
            <span v-else class="empty-value">-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="Actions" :width="columnWidths.Actions" fixed="right">
          <template #default="{row}">
            <div class="action-buttons">
              <el-tooltip content="Start/Stop" placement="top">
                <el-button
                  v-if="!isContainerRunning(row.Status)"
                  size="small"
                  type="success"
                  circle
                  @click.stop="manageContainer(row.ID, 'start')"
                  :loading="loadingActions[row.ID] === 'start'"
                >
                  <el-icon><Icon icon="mdi:play" /></el-icon>
                </el-button>
                <el-button
                  v-else
                  size="small"
                  type="danger"
                  circle
                  @click.stop="manageContainer(row.ID, 'stop')"
                  :loading="loadingActions[row.ID] === 'stop'"
                >
                  <el-icon><Icon icon="mdi:stop" /></el-icon>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Restart" placement="top">
                <el-button
                  size="small"
                  type="warning"
                  circle
                  @click.stop="manageContainer(row.ID, 'restart')"
                  :loading="loadingActions[row.ID] === 'restart'"
                >
                  <el-icon><Icon icon="mdi:restart" /></el-icon>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Logs" placement="top">
                <el-button
                  size="small"
                  type="info"
                  circle
                  @click.stop="showContainerLogs(row.ID)"
                >
                  <el-icon><Icon icon="mdi:file-document" /></el-icon>
                </el-button>
              </el-tooltip>

              <el-tooltip
                content="Edit Configuration File"
                placement="top"
              >
                <el-button 
                  type="primary" 
                  size="small"
                  circle
                  v-if="isContainerRunning(row.Status)"
                  @click="openEditor(row.ID, row.Config?.Labels?.['com.docker.compose.project.config_files'] || `${row.Names}.yml`)"
                >
                  <el-icon><Icon icon="mdi:file-edit" /></el-icon>
                </el-button>
              </el-tooltip>

              <el-tooltip content="SSH Terminal" placement="top">
                <el-button
                  size="small"
                  type="success"
                  circle
                  @click.stop="openSshDialog(row.ID, row.Names)"
                  :disabled="!isContainerRunning(row.Status)"
                >
                  <el-icon><Icon icon="mdi:console" /></el-icon>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Delete" placement="top">
                <el-button
                  size="small"
                  type="danger"
                  circle
                  plain
                  @click.stop="confirmDeleteContainer(row)"
                >
                  <el-icon><Icon icon="mdi:delete" /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <file-editor 
      ref="fileEditor" 
      :container-id="selectedContainerId" 
      @container-updated="fetchContainers" 
    />


  <!-- SSH Dialog -->
  <el-dialog
    v-model="sshDialogVisible"
    :title="`SSH: ${selectedContainerName}`"
    width="80%"
    class="terminal-dialog"
    @closed="handleClose"
  >
    <SSHTerminal
      v-if="sshDialogVisible"
      :container-id="selectedContainerId"
      :socket-url="socketUrl"
      @close="handleClose"
    />
  </el-dialog>

    <!-- Logs Dialog -->
    <el-dialog
      v-model="logsDialogVisible"
      :title="`Logs: ${selectedContainerId}`"
      width="70%"
      class="modern-dialog"
    >
      <div class="logs-content">
        <div class="logs-header">
          <el-button @click="copyLogs" type="" class="copy-btn">
            <el-icon><Icon icon="mdi:content-copy" /></el-icon>
            Copy
          </el-button>
        </div>
        <pre class="logs-output">{{ containerLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="logsDialogVisible = false" class="dialog-btn">Close</el-button>
      </template>
    </el-dialog>

    <!-- Create Container Dialog -->
    <el-dialog v-model="showCreateDialog" title="Create New Container" width="60%" class="modern-dialog">
      <el-form :model="createForm" label-width="120px" label-position="top">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Container Name" required>
              <el-input v-model="createForm.name" placeholder="my-container" size="large" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Image" required>
              <el-select
                v-model="createForm.image"
                filterable
                remote
                :remote-method="searchImages"
                placeholder="nginx:latest"
                size="large"
                style="width: 100%"
              >
                <el-option
                  v-for="img in availableImages"
                  :key="img"
                  :label="img"
                  :value="img"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Ports">
          <div class="tags-container">
            <el-tag
              v-for="(port, index) in createForm.ports"
              :key="index"
              closable
              @close="removePort(index)"
              size="large"
              class="form-tag"
            >
              {{ port }}
            </el-tag>
          </div>
          <el-input
            v-model="newPort"
            placeholder="8080:80"
            size="large"
            @keyup.enter="addPort"
            class="add-input"
          >
            <template #append>
              <el-button @click="addPort"><Icon icon="mdi:plus" /></el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Volumes">
          <div class="tags-container">
            <el-tag
              v-for="(vol, index) in createForm.volumes"
              :key="index"
              closable
              @close="removeVolume(index)"
              size="large"
              class="form-tag"
            >
              {{ vol }}
            </el-tag>
          </div>
          <el-input
            v-model="newVolume"
            placeholder="/host/path:/container/path"
            size="large"
            @keyup.enter="addVolume"
            class="add-input"
          >
            <template #append>
              <el-button @click="addVolume"><Icon icon="mdi:plus" /></el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Environment Variables">
          <div class="env-container">
            <div v-for="(env, index) in createForm.env" :key="index" class="env-row">
              <el-input v-model="env.key" placeholder="Key" size="large" class="env-input" />
              <el-input v-model="env.value" placeholder="Value" size="large" class="env-input" />
              <el-button icon="delete" @click="removeEnv(index)" circle plain />
            </div>
            <el-button @click="addEnv" type="primary" plain size="large" class="add-env-btn">
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Add Variable
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false" class="dialog-btn">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="createContainer" 
          class="dialog-btn primary"
          :disabled="!createForm.name || !createForm.image"
        >
          Create
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ContainerStats from './ContainerStats.vue';
import FileEditor from './FileEditor.vue';
import SSHTerminal from './SSHTerminal.vue';

// Reactive state
const containers = ref([]);
const loading = ref(false);
const loadingText = ref('Loading containers...');
const searchQuery = ref('');
const logsDialogVisible = ref(false);
const containerLogs = ref('');
const selectedContainerId = ref('');
const loadingActions = ref({});
const rowStats = ref({});
const showCreateDialog = ref(false);
const expandedRow = ref(null);
const containerStats = ref({});
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
const fileEditor = ref(null);

const sshDialogVisible = ref(false);
const selectedContainerName = ref('');

let statsInterval = null;

const columnWidths = ref({
  ID: '120px',
  Names: '180px',
  Image: '200px',
  Status: '120px',
  Uptime: '150px',
  Resources: '220px',
  Ports: '180px',
  Actions: '220px'
});

const headerStyle = {
  backgroundColor: '#f8f9fa',
  color: '#495057',
  padding: '12px 0',
  width: '100%'
};

const cellStyle = {
  padding: '12px 0',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
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
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('up')) return 'success';
  if (lowerStatus.includes('exited')) return 'danger';
  if (lowerStatus.includes('paused')) return 'warning';
  if (lowerStatus.includes('created')) return 'info';
  return 'info';
};

const getStatusText = (status) => {
  if (!status) return 'Unknown';
  if (status.includes('Up')) return 'Running';
  if (status.includes('Exited')) return 'Stopped';
  if (status.includes('Paused')) return 'Paused';
  return status.split(' ')[0] || status;
};

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#10B981'; // green
  if (percentage < 70) return '#F59E0B'; // yellow
  return '#EF4444'; // red
};

// Data processing
const processedContainers = computed(() => {
  if (!Array.isArray(containers.value)) return [];
  
  const filtered = searchQuery.value 
    ? containers.value.filter(container => {
        const search = searchQuery.value.toLowerCase();
        return (
          (container.ID?.toLowerCase().includes(search)) ||
          (container.Names?.toLowerCase().includes(search)) ||
          (container.Image?.toLowerCase().includes(search)) ||
          (container.Status?.toLowerCase().includes(search))
        );
      })
    : containers.value;

  return filtered.map(container => ({
    ...container,
    ID: container.ID || container.Id || '',
    Names: container.Names || container.Name || '',
    Image: container.Image || container.Config?.Image || '',
    Status: container.Status || container.State || '',
    Ports: container.Ports || '',
    Config: container.Config || {}
  }));
});

// API calls
const fetchContainers = async () => {
  try {
    loading.value = true;
    loadingText.value = 'Loading containers...';
    
    const response = await axios.get('/services/docker/containers', {
      params: { all: true },
      timeout: 10000
    });

    if (!response.data?.containers) {
      throw new Error('Invalid response structure');
    }

    containers.value = Array.isArray(response.data.containers) 
      ? response.data.containers
      : [];

    // Fetch stats for visible containers
    containers.value.slice(0, 10).forEach(container => {
      fetchContainerStats(container.ID);
    });

  } catch (error) {
    console.error('Error fetching containers:', error);
    ElMessage.error(`Failed to fetch containers: ${error.message}`);
    containers.value = [];
  } finally {
    loading.value = false;
  }
};

const fetchContainerStats = async (containerId) => {
  if (!containerId) return;

  try {
    const response = await axios.get(`/services/docker/stats/container/${containerId}`, {
      timeout: 5000
    });

    const stats = response.data?.stats || {};
    const cpu = parseFloat(stats.cpu_percent || stats.CPUPerc?.replace('%', '') || 0);
    const memory = parseFloat(stats.memory_percent || stats.MemPerc?.replace('%', '') || 0);

    rowStats.value[containerId] = {
      cpu: Math.min(100, cpu),
      memory: Math.min(100, memory)
    };

  } catch (error) {
    console.error(`Error fetching stats for ${containerId}:`, error);
    rowStats.value[containerId] = { cpu: 0, memory: 0 };
  }
};

const manageContainer = async (id, action) => {
  try {
    loadingActions.value[id] = action;
    await axios.post(`/services/docker/container/${id}/${action}`);
    ElMessage.success(`Container ${action} successful`);
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to ${action} container: ${error.response?.data?.message || error.message}`);
  } finally {
    loadingActions.value[id] = null;
  }
};

const deleteContainer = async (containerId) => {
  try {
    loadingActions.value[containerId] = 'delete';
    await axios.delete(`/services/docker/container/${containerId}`, {
      params: { force: true }
    });
    ElMessage.success('Container deleted successfully');
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to delete container: ${error.response?.data?.message || error.message}`);
    throw error;
  } finally {
    loadingActions.value[containerId] = null;
  }
};

const confirmDeleteContainer = (container) => {
  ElMessageBox.confirm(
    `Delete container ${container.ID}? This action cannot be undone.`,
    'Confirm Deletion',
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
    containerLogs.value = response.data?.logs || 'No logs available';
    logsDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(`Failed to get logs: ${error.message}`);
    containerLogs.value = `Error loading logs: ${error.message}`;
    logsDialogVisible.value = true;
  }
};

const copyLogs = () => {
  navigator.clipboard.writeText(containerLogs.value)
    .then(() => ElMessage.success('Logs copied to clipboard'))
    .catch(() => ElMessage.error('Failed to copy logs'));
};

// Container creation
const searchImages = async (query) => {
  if (!query) return;
  try {
    const response = await axios.get('/services/docker/images/search', {
      params: { q: query }
    });
    availableImages.value = response.data?.images || [];
  } catch (error) {
    console.error('Error searching images:', error);
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
    const envVars = createForm.value.env
      .filter(e => e.key)
      .reduce((acc, {key, value}) => ({ ...acc, [key]: value }), {});

    const response = await axios.post('/services/docker/container/create', {
      name: createForm.value.name,
      image: createForm.value.image,
      ports: createForm.value.ports,
      volumes: createForm.value.volumes,
      env: envVars
    });

    ElMessage.success(response.data?.message || 'Container created successfully');
    showCreateDialog.value = false;
    resetCreateForm();
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to create container: ${error.response?.data?.message || error.message}`);
  }
};

const resetCreateForm = () => {
  createForm.value = {
    name: '',
    image: '',
    ports: [],
    volumes: [],
    env: []
  };
  newPort.value = '';
  newVolume.value = '';
};

const handleRowClick = async (row) => {
          expandedRow.value = row.ID;
	    if (!containerStats.value[row.ID]) {
	      await fetchContainerStats(row.ID);
	    }
}

const openEditor = (id, name) => {
  selectedContainerId.value = id; // Upewnij się, że to jest ustawione
  fileEditor.value.openEditor(id, name); // Przekazuj obie wartości
};

const openSshDialog = (containerId, containerName) => {
  selectedContainerId.value = containerId;
  selectedContainerName.value = containerName || 'Container';
  sshDialogVisible.value = true;
};

// Formatuje czas typu "X days ago"
const formatTimeAgo = (timeStr) => {
  if (!timeStr) return '-';
  return timeStr.replace('ago', '').trim();
};

// Wyciąga czas z pola Status (np. "Up 19 hours")
const extractUpTime = (status) => {
  if (!status) return '-';
  const match = status.match(/Up\s+(.*)/);
  return match ? match[1] : '-';
};

const socketUrl = computed(() => {
  return `ws://${window.location.hostname}:1111`;
});

const closeTerminal = () => {
  sshDialogVisible.value = false;
};

const handleClose = () => {
  sshDialogVisible.value = false;
};

// Lifecycle hooks
onMounted(() => {
  fetchContainers();
  startStatsRefresh();
});

onBeforeUnmount(() => {
  stopStatsRefresh();
});

const startStatsRefresh = () => {
  stopStatsRefresh();
  statsInterval = setInterval(() => {
    containers.value.slice(0, 10).forEach(container => {
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
</script>

<style scoped>
.docker-containers {
  padding: 0;
  margin: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.table-card {
  flex: 1;
  margin: 0;
  padding: 0;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* TOTALNA KONTROLA NAD TABELĄ */
:deep(.el-table) {
  width: 100% !important;
  margin: 0;
  border: none;
  background: transparent;
  flex: 1;
}


:deep(.el-table__header),
:deep(.el-table__body) {
  width: 100% !important;
}

:deep(.el-table__header-wrapper),
:deep(.el-table__body-wrapper) {
  width: 100% !important;
  flex: 1;
}

/* TRYB NOCNY - JAWNE STYLE */
.dark :deep(.el-table) {
  color: var(--el-text-color-primary);
}

.dark :deep(.el-table th) {
  background-color: var(--el-bg-color) !important;
}

.dark :deep(.el-table tr) {
  background-color: var(--el-bg-color) !important;
}

.dark :deep(.el-table tr:hover > td) {
  background-color: var(--el-fill-color-dark) !important;
}

/* KOLUMNY - STAŁE SZEROKOŚCI */
:deep(.el-table__cell) {
  width: auto !important;
}

/* PROGRESS BARY */
.meter-bar {
  min-width: 80px;
  margin-right: 8px;
}
.search-input {
  flex-grow: 1;
  max-width: 400px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.create-btn {
  background-color: #10b981;
  border-color: #10b981;
  height: 20px;
}

.refresh-btn {
  background-color: #3b82f6;
  border-color: #3b82f6;
  height: 20px;
}

.modern-table {
  --el-table-border-color: #e9ecef;
  --el-table-header-bg-color: #f8f9fa;
  --el-table-row-hover-bg-color: #f1f3f5;
  flex-grow: 1;
  width: 100% !important; /* Nadpisanie domyślnych stylów Element Plus */
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-text {
  font-weight: 500;
  color: #212529;
}

.compose-tag {
  background-color: #e0f2fe;
  color: #0369a1;
}

.image-text {
  color: #495057;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9em;
}

.container-id {
  font-family: 'Roboto Mono', monospace;
  color: #6c757d;
  font-size: 0.85em;
}

.resource-meters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meter-label {
  width: 40px;
  color: #6c757d;
  font-size: 0.85em;
}

.meter-bar {
  flex-grow: 1;
  margin-right: 8px;
}

.meter-value {
  width: 40px;
  text-align: right;
  font-size: 0.85em;
  color: #495057;
}

.ports-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.port-tag {
  background-color: #e9ecef;
  color: #495057;
  border: none;
}

.empty-value {
  color: #adb5bd;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

/* Dialog Styles */
.modern-dialog {
  border-radius: 12px;
}

.logs-content {
  display: flex;
  flex-direction: column;
  height: 60vh;
}

.logs-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.logs-output {
  flex-grow: 1;
  overflow: auto;
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Roboto Mono', monospace;
  white-space: pre-wrap;
  line-height: 1.5;
}

.copy-btn {
  color: #6c757d;
}

.copy-btn:hover {
  color: #3b82f6;
}

/* Form Styles */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.form-tag {
  background-color: #e9ecef;
  color: #495057;
  border: none;
}

.add-input {
  max-width: 300px;
}

.env-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.env-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.env-input {
  flex-grow: 1;
}

.add-env-btn {
  margin-top: 8px;
  width: fit-content;
}

.dialog-btn {
  padding: 10px 20px;
  border-radius: 8px;
}

.dialog-btn.primary {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.ssh-dialog {
  height: 70vh;
}

.ssh-terminal {
  display: flex;
  flex-direction: column;
  height: 60vh;
}

.ssh-controls {
  margin-bottom: 15px;
}

.ssh-output {
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  background-color: #1e1e1e;
  color: #e0e0e0;
  padding: 10px;
  border-radius: 4px;
  overflow-y: auto;
  max-height: 60vh;
}

.ssh-output pre {
  margin: 0;
  font-family: inherit;
}

/* Color classes for different output types */
.ssh-output .error {
  color: #ff6b6b;
}

.ssh-output .success {
  color: #5cb85c;
}

/* Nowy wrapper dla tabeli */
.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.full-width-table {
  width: 100%;
  table-layout: fixed;
    --el-table-border-color: #e9ecef;
  --el-table-header-bg-color: #f8f9fa;
  --el-table-row-hover-bg-color: #f1f3f5;
}

:deep(.el-table__header-wrapper),
:deep(.el-table__body-wrapper) {
  width: 100% !important;
}

:deep(.el-table__header) th {
  padding: 12px 0;
  background-color: #f8f9fa;
}

:deep(.el-table__body) td {
  padding: 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-table__inner-wrapper) {
  width: 100% !important;
}

.terminal-dialog {
  height: 70vh;
}

:deep(.el-dialog__body) {
  padding: 0;
  height: calc(100% - 60px);
}

.uptime-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uptime-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
  color: #495057;
}

.dark .uptime-item {
  color: var(--el-text-color-secondary);
}

/* Responsywność kolumn */
@media (max-width: 100%) {
  :deep(.el-table__body) td,
  :deep(.el-table__header) th {
    padding: 8px 0;
  }
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    max-width: 100%;
  }
  
  .header-actions {
    justify-content: flex-end;
  }
  
  .env-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-buttons {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>