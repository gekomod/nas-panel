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
        <el-button type="warning" @click="showDebugInfo" size="large" class="debug-btn">
          <el-icon><Icon icon="mdi:bug" /></el-icon>
          Debug
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
                  v-if="rowStats[row.ID] && rowStats[row.ID].cpu !== undefined"
                  :percentage="getSafePercentage(rowStats[row.ID].cpu)" 
                  :color="getProgressColor(getSafePercentage(rowStats[row.ID].cpu))"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <el-progress 
                  v-else
                  :percentage="0" 
                  color="#6c757d"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <span class="meter-value" :class="{ 
                  'error-value': hasStatsError(row.ID),
                  'debug-value': isDebugMode 
                }">
                  {{ getFormattedValue(rowStats[row.ID]?.cpu) }}%
                  <span v-if="isDebugMode && rowStats[row.ID]" class="debug-info">
                    (ID: {{ row.ID.substring(0, 8) }})
                  </span>
                </span>
              </div>
              <div class="meter-row">
                <span class="meter-label">MEM</span>
                <el-progress 
                  v-if="rowStats[row.ID] && rowStats[row.ID].memory !== undefined"
                  :percentage="getSafePercentage(rowStats[row.ID].memory)" 
                  :color="getProgressColor(getSafePercentage(rowStats[row.ID].memory))"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <el-progress 
                  v-else
                  :percentage="0" 
                  color="#6c757d"
                  :show-text="false"
                  :stroke-width="10"
                  class="meter-bar"
                />
                <span class="meter-value" :class="{ 
                  'error-value': hasStatsError(row.ID),
                  'debug-value': isDebugMode 
                }">
                  {{ getFormattedValue(rowStats[row.ID]?.memory) }}%
                  <span v-if="isDebugMode" class="debug-info">
                    {{ rowStats[row.ID]?.errorMessage ? 'ERR' : 'OK' }}
                  </span>
                </span>
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
              
              <el-tooltip content="Test Stats API" placement="top">
                <el-button
                  size="small"
                  type="warning"
                  circle
                  @click.stop="testStatsApiDirect(row.ID)"
                >
                  <el-icon><Icon icon="mdi:test-tube" /></el-icon>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Debug Container" placement="top">
                <el-button
                  size="small"
                  type="info"
                  circle
                  plain
                  @click.stop="debugContainer(row)"
                >
                  <el-icon><Icon icon="mdi:bug" /></el-icon>
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

    <!-- Debug Info Dialog -->
    <el-dialog
      v-model="debugDialogVisible"
      title="Debug Information - Docker Containers"
      width="90%"
      class="debug-dialog"
      @closed="debugDialogVisible = false"
    >
      <div class="debug-content">
        <el-tabs type="border-card" v-model="activeDebugTab">
          <el-tab-pane label="API Status" name="api">
            <div class="api-status">
              <h3>Backend API Endpoints</h3>
              <div class="endpoint-list">
                <div class="endpoint-item" v-for="endpoint in apiEndpoints" :key="endpoint.name">
                  <div class="endpoint-info">
                    <strong>{{ endpoint.name }}:</strong> 
                    <code>{{ endpoint.url }}</code>
                    <span class="endpoint-status" :class="endpoint.status">
                      {{ endpoint.status === 'success' ? '✓' : endpoint.status === 'pending' ? '...' : '✗' }}
                    </span>
                  </div>
                  <div class="endpoint-actions">
                    <el-button size="small" @click="testApiEndpoint(endpoint)" :loading="endpoint.loading">
                      Test
                    </el-button>
                    <el-button size="small" @click="viewApiResponse(endpoint)" v-if="endpoint.response">
                      View Response
                    </el-button>
                  </div>
                </div>
              </div>
              
              <h3>Current API Errors ({{ apiErrors.length }})</h3>
              <div class="error-list" v-if="apiErrors.length > 0">
                <div class="error-item" v-for="(error, index) in apiErrors.slice(-10).reverse()" :key="index">
                  <span class="error-time">{{ new Date(error.time).toLocaleTimeString() }}</span>
                  <span class="error-type">{{ error.type }}</span>
                  <span class="error-message">{{ error.error || error.message }}</span>
                </div>
              </div>
              <p v-else>No recent API errors</p>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="Containers Data" name="containers">
            <div class="containers-debug">
              <h3>Containers Loaded: {{ containers.length }} (Running: {{ runningContainers.length }})</h3>
              <div class="container-list">
                <div class="container-item" v-for="container in containers.slice(0, 10)" :key="container.ID">
                  <div class="container-header">
                    <strong>{{ container.Names || 'Unnamed' }}</strong>
                    <span class="container-id">({{ container.ID.substring(0, 12) }})</span>
                    <el-tag size="small" :type="getStatusType(container.Status)">
                      {{ getStatusText(container.Status) }}
                    </el-tag>
                  </div>
                  <div class="container-stats">
                    <span>Stats loaded: {{ rowStats[container.ID] ? 'Yes' : 'No' }}</span>
                    <span v-if="rowStats[container.ID]">
                      CPU: {{ rowStats[container.ID].cpu || 0 }}%,
                      MEM: {{ rowStats[container.ID].memory || 0 }}%
                    </span>
                    <span v-else>No stats data</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="Stats Data" name="stats">
            <div class="stats-debug">
              <h3>Statistics Data ({{ Object.keys(rowStats).length }} containers)</h3>
              <pre class="stats-json">{{ statsDebugInfo }}</pre>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="Network Debug" name="network">
            <div class="network-debug">
              <h3>Network Requests</h3>
              <el-button @click="clearNetworkLogs">Clear Logs</el-button>
              <div class="network-logs">
                <div class="network-log" v-for="(log, index) in networkLogs.slice().reverse()" :key="index">
                  <span class="log-time">{{ log.time }}</span>
                  <span class="log-method" :class="log.method">{{ log.method }}</span>
                  <span class="log-url">{{ log.url }}</span>
                  <span class="log-status" :class="log.status">{{ log.status }}</span>
                  <span class="log-duration">{{ log.duration }}ms</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <div class="debug-footer">
          <el-button @click="debugDialogVisible = false">Close</el-button>
          <el-button type="primary" @click="runFullDiagnostic">Run Full Diagnostic</el-button>
          <el-button type="warning" @click="forceRefreshAllStats">Force Refresh All Stats</el-button>
          <el-switch
            v-model="isDebugMode"
            active-text="Debug Mode"
            inactive-text="Normal Mode"
          />
        </div>
      </template>
    </el-dialog>

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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
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
const fileEditor = ref(null);

const sshDialogVisible = ref(false);
const selectedContainerName = ref('');
const debugDialogVisible = ref(false);
const activeDebugTab = ref('api');
const isDebugMode = ref(false); // Włącz debug mode domyślnie

// Intervaly
let statsInterval = null;
let containersInterval = null;

// Debug state
const apiErrors = ref([]);
const networkLogs = ref([]);
const apiEndpoints = ref([]);

const columnWidths = ref({
  ID: '120px',
  Names: '180px',
  Image: '200px',
  Status: '120px',
  Uptime: '150px',
  Resources: '220px',
  Ports: '180px',
  Actions: '280px'
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
  if (!percentage && percentage !== 0) return '#6c757d';
  if (percentage < 30) return '#10B981'; // green
  if (percentage < 70) return '#F59E0B'; // yellow
  return '#EF4444'; // red
};

const getSafePercentage = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
};

const getFormattedValue = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? '0.0' : num.toFixed(1);
};

const hasStatsError = (containerId) => {
  return rowStats.value[containerId]?.error === true;
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
    Config: container.Config || {},
    RunningFor: container.RunningFor || '',
    CreatedAt: container.CreatedAt || ''
  }));
});

const runningContainers = computed(() => {
  return containers.value.filter(c => isContainerRunning(c.Status));
});

const baseUrl = computed(() => {
  return window.location.origin;
});

const statsDebugInfo = computed(() => {
  return JSON.stringify({
    totalStats: Object.keys(rowStats.value).length,
    stats: Object.entries(rowStats.value).reduce((acc, [id, stats]) => {
      acc[id.substring(0, 12)] = stats;
      return acc;
    }, {}),
    apiErrors: apiErrors.value.slice(-5),
    timestamp: new Date().toISOString()
  }, null, 2);
});

// Network logging
const logNetworkRequest = async (method, url, options = {}) => {
  const startTime = Date.now();
  const logEntry = {
    time: new Date().toLocaleTimeString(),
    method,
    url,
    status: 'pending',
    duration: 0
  };
  networkLogs.value.push(logEntry);
  
  try {
    const response = await axios({
      method,
      url,
      timeout: 8000,
      ...options
    });
    
    logEntry.status = 'success';
    logEntry.duration = Date.now() - startTime;
    logEntry.response = response.data;
    
    return response;
  } catch (error) {
    logEntry.status = 'error';
    logEntry.duration = Date.now() - startTime;
    logEntry.error = error.message;
    throw error;
  }
};

const clearNetworkLogs = () => {
  networkLogs.value = [];
};

// API endpoints setup
const setupApiEndpoints = () => {
  apiEndpoints.value = [
    {
      name: 'Get Containers',
      url: `${baseUrl.value}/services/docker/containers`,
      method: 'GET',
      status: 'pending',
      loading: false,
      response: null
    },
    {
      name: 'Stats Endpoint Template',
      url: `${baseUrl.value}/services/docker/stats/container/{ID}`,
      method: 'GET',
      status: 'pending',
      loading: false,
      response: null
    }
  ];
};

// Test API endpoint
const testApiEndpoint = async (endpoint) => {
  endpoint.loading = true;
  endpoint.status = 'pending';
  
  try {
    // Replace {ID} with actual container ID if needed
    let testUrl = endpoint.url;
    if (testUrl.includes('{ID}') && containers.value.length > 0) {
      const containerId = containers.value[0].ID;
      testUrl = testUrl.replace('{ID}', containerId);
    }
    
    const response = await logNetworkRequest('GET', testUrl.replace(baseUrl.value, ''));
    endpoint.response = response.data;
    endpoint.status = 'success';
    ElMessage.success(`API ${endpoint.name} is working!`);
  } catch (error) {
    endpoint.status = 'error';
    endpoint.error = error.message;
    ElMessage.error(`API ${endpoint.name} failed: ${error.message}`);
  } finally {
    endpoint.loading = false;
  }
};

const viewApiResponse = (endpoint) => {
  if (endpoint.response) {
    ElMessageBox.alert(
      `<pre>${JSON.stringify(endpoint.response, null, 2)}</pre>`,
      `API Response: ${endpoint.name}`,
      {
        dangerouslyUseHTMLString: true,
        customClass: 'api-response-dialog',
        width: '80%'
      }
    );
  }
};

// API calls
const fetchContainers = async () => {
  if (loading.value) return;
  
  try {
    loading.value = true;
    loadingText.value = 'Loading containers...';
    
    console.log('=== FETCHING CONTAINERS ===');
    console.log('URL:', `${baseUrl.value}/services/docker/containers`);
    
    const response = await logNetworkRequest('GET', '/services/docker/containers', {
      params: { all: true }
    });

    console.log('Containers API Raw Response:', response);
    console.log('Response data:', response.data);

    if (!response.data?.containers) {
      console.error('Invalid response structure - no containers field');
      throw new Error('Invalid response structure: No containers field');
    }

    const newContainers = Array.isArray(response.data.containers) 
      ? response.data.containers
      : [];

    console.log(`Found ${newContainers.length} containers`);

    containers.value = newContainers.map(container => {
      const containerData = {
        ...container,
        ID: container.ID || container.Id || '',
        Names: container.Names || container.Name || '',
        Image: container.Image || container.Config?.Image || '',
        Status: container.Status || container.State || '',
        Ports: container.Ports || '',
        Config: container.Config || {},
        RunningFor: container.RunningFor || '',
        CreatedAt: container.CreatedAt || ''
      };
      
      console.log(`Container: ${containerData.Names} (${containerData.ID.substring(0, 12)}) - Status: ${containerData.Status}`);
      return containerData;
    });

    // Update API endpoints with actual container IDs
    setupApiEndpoints();
    
    // Start fetching stats for running containers
    startStatsFetching();

  } catch (error) {
    console.error('=== ERROR FETCHING CONTAINERS ===');
    console.error('Error:', error);
    console.error('Error response:', error.response);
    
    apiErrors.value.push({
      type: 'containers',
      time: new Date().toISOString(),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    ElMessage.error(`Failed to fetch containers: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

// Pobieranie statystyk - BARDZO DETALICZNE DEBUGOWANIE
const fetchContainerStats = async (containerId) => {
  if (!containerId) {
    console.warn('No container ID provided for stats');
    return null;
  }

  const shortId = containerId.substring(0, 12);
  console.log(`=== FETCHING STATS FOR CONTAINER: ${shortId} ===`);
  
  try {
    const statsEndpoint = `/services/docker/stats/container/${containerId}`;
    console.log(`Using endpoint: ${statsEndpoint}`);
    
    const response = await logNetworkRequest('GET', statsEndpoint, { 
      timeout: 8000 
    });

    console.log(`Stats API Response for ${shortId}:`, response);
    console.log(`Response data for ${shortId}:`, response.data);

    if (!response.data) {
      console.warn(`No data in response for ${shortId}`);
      throw new Error('No data in response');
    }

    // Check response structure
    const statsData = response.data.stats || response.data;
    console.log(`Stats data for ${shortId}:`, statsData);
    
    // EXTREME DEBUG: Log all fields in the response
    console.log(`All fields in response for ${shortId}:`, Object.keys(statsData));
    
    // Try to find CPU and MEM fields - check ALL possible field names
    const cpuField = statsData.cpu_percent || statsData.cpuPercent || statsData.cpu || 
                     statsData.CPUPerc || statsData.cpuPercentage || statsData.CPU || 0;
    
    const memField = statsData.memory_percent || statsData.memoryPercent || statsData.memory || 
                     statsData.MemPerc || statsData.memoryPercentage || statsData.MEM || 0;
    
    console.log(`Raw CPU field for ${shortId}:`, cpuField);
    console.log(`Raw MEM field for ${shortId}:`, memField);
    
    // Parse values
    let cpuValue = 0;
    let memValue = 0;
    
    if (typeof cpuField === 'string') {
      // Remove % sign if present
      cpuValue = parseFloat(cpuField.replace('%', '')) || 0;
    } else if (typeof cpuField === 'number') {
      cpuValue = cpuField;
    }
    
    if (typeof memField === 'string') {
      // Remove % sign if present
      memValue = parseFloat(memField.replace('%', '')) || 0;
    } else if (typeof memField === 'number') {
      memValue = memField;
    }
    
    console.log(`Parsed CPU for ${shortId}:`, cpuValue);
    console.log(`Parsed MEM for ${shortId}:`, memValue);
    
    const formattedStats = {
      cpu: cpuValue,
      memory: memValue,
      cpu_raw: cpuField,
      memory_raw: memField,
      timestamp: Date.now(),
      success: true,
      endpoint: statsEndpoint,
      rawResponse: statsData // Store the entire response for debugging
    };

    console.log(`Formatted stats for ${shortId}:`, formattedStats);
    
    // Update stats
    rowStats.value = {
      ...rowStats.value,
      [containerId]: formattedStats
    };

    return formattedStats;
    
  } catch (error) {
    console.error(`=== ERROR FETCHING STATS FOR ${shortId} ===`);
    console.error('Error:', error);
    console.error('Error response:', error.response);
    
    apiErrors.value.push({
      type: 'stats',
      containerId: shortId,
      time: new Date().toISOString(),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Set error state
    rowStats.value = {
      ...rowStats.value,
      [containerId]: { 
        cpu: 0, 
        memory: 0, 
        error: true, 
        timestamp: Date.now(),
        errorMessage: error.message,
        endpoint: `/services/docker/stats/container/${containerId}`
      }
    };
    
    return { cpu: 0, memory: 0, error: true };
  }
};

// Direct test of stats API
const testStatsApiDirect = async (containerId) => {
  const container = containers.value.find(c => c.ID === containerId);
  if (!container) {
    ElMessage.error('Container not found');
    return;
  }
  
  const shortId = containerId.substring(0, 12);
  
  try {
    ElMessageBox.confirm(
      `Test stats API for container: ${container.Names} (${shortId})?`,
      'Test Stats API',
      {
        confirmButtonText: 'Test',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    ).then(async () => {
      console.log(`=== DIRECT STATS API TEST FOR ${shortId} ===`);
      
      const response = await fetchContainerStats(containerId);
      
      ElMessageBox.alert(
        `<h3>Stats API Test Result for ${shortId}</h3>
         <pre>${JSON.stringify(response, null, 2)}</pre>
         <p><strong>Container:</strong> ${container.Names}</p>
         <p><strong>Status:</strong> ${container.Status}</p>
         <p><strong>Running:</strong> ${isContainerRunning(container.Status) ? 'Yes' : 'No'}</p>`,
        `Stats API Test - ${shortId}`,
        {
          dangerouslyUseHTMLString: true,
          customClass: 'stats-test-dialog',
          width: '80%'
        }
      );
    });
  } catch (error) {
    console.error('Direct stats test error:', error);
    ElMessage.error(`Test failed: ${error.message}`);
  }
};

// Debug container
const debugContainer = (container) => {
  const shortId = container.ID.substring(0, 12);
  const stats = rowStats.value[container.ID];
  
  let debugInfo = `
    <h3>Container Debug: ${container.Names}</h3>
    <p><strong>ID:</strong> ${shortId}</p>
    <p><strong>Status:</strong> ${container.Status}</p>
    <p><strong>Running:</strong> ${isContainerRunning(container.Status) ? 'Yes' : 'No'}</p>
    <p><strong>Stats loaded:</strong> ${stats ? 'Yes' : 'No'}</p>
  `;
  
  if (stats) {
    debugInfo += `
      <p><strong>CPU:</strong> ${stats.cpu || 0}% (raw: ${stats.cpu_raw || 'N/A'})</p>
      <p><strong>MEM:</strong> ${stats.memory || 0}% (raw: ${stats.memory_raw || 'N/A'})</p>
      <p><strong>Error:</strong> ${stats.error ? 'Yes' : 'No'}</p>
      <p><strong>Error message:</strong> ${stats.errorMessage || 'None'}</p>
      <p><strong>Timestamp:</strong> ${new Date(stats.timestamp).toLocaleTimeString()}</p>
    `;
  }
  
  ElMessageBox.alert(debugInfo, `Debug: ${container.Names}`, {
    dangerouslyUseHTMLString: true
  });
};

// Pobierz statystyki dla wszystkich działających kontenerów
const fetchAllStats = async () => {
  const running = runningContainers.value;
  
  if (running.length === 0) {
    console.log('No running containers for stats');
    return;
  }

  console.log(`=== FETCHING STATS FOR ${running.length} RUNNING CONTAINERS ===`);

  // Fetch stats sequentially to avoid overwhelming the backend
  for (const container of running.slice(0, 50)) { // Limit to 50 containers
    if (isContainerRunning(container.Status)) {
      await fetchContainerStats(container.ID);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
};

const forceRefreshAllStats = async () => {
  console.log('=== FORCE REFRESHING ALL STATS ===');
  await fetchAllStats();
  ElMessage.success('Stats force refreshed');
};

// Uruchom interwał pobierania statystyk
const startStatsFetching = () => {
  stopStatsFetching();
  
  // First fetch after 2 seconds
  setTimeout(() => fetchAllStats(), 2000);
  
  // Interval every 5 seconds
  statsInterval = setInterval(() => {
    if (containers.value.length > 0) {
      fetchAllStats();
    }
  }, 5000);
};

const stopStatsFetching = () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
};

// Debug funkcje
const showDebugInfo = () => {
  debugDialogVisible.value = true;
  activeDebugTab.value = 'api';
  setupApiEndpoints();
};

const runFullDiagnostic = async () => {
  ElMessage.info('Running full diagnostic...');
  
  // Test containers endpoint
  try {
    await testApiEndpoint(apiEndpoints.value[0]);
  } catch (error) {
    console.error('Containers endpoint test failed:', error);
  }
  
  // If we have containers, test stats endpoint
  if (containers.value.length > 0) {
    const testEndpoint = {
      ...apiEndpoints.value[1],
      url: `${baseUrl.value}/services/docker/stats/container/${containers.value[0].ID}`
    };
    await testApiEndpoint(testEndpoint);
  }
  
  ElMessage.success('Diagnostic complete');
};

// Zarządzanie kontenerem
const manageContainer = async (id, action) => {
  try {
    loadingActions.value[id] = action;
    
    await axios.post(`/services/docker/container/${id}/${action}`, null, {
      timeout: 10000
    });
    
    ElMessage.success(`Container ${action} successful`);
    
    // Odśwież kontenery po chwili
    setTimeout(() => {
      fetchContainers();
    }, 1000);
    
  } catch (error) {
    ElMessage.error(`Failed to ${action} container: ${error.message}`);
    console.error(error);
  } finally {
    setTimeout(() => {
      loadingActions.value[id] = null;
    }, 1000);
  }
};

const deleteContainer = async (containerId) => {
  try {
    loadingActions.value[containerId] = 'delete';
    await axios.delete(`/services/docker/container/${containerId}`, {
      params: { force: true },
      timeout: 10000
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
    const response = await axios.get(`/services/docker/container/logs/${id}`, {
      timeout: 15000
    });
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
      params: { q: query },
      timeout: 10000
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
    }, {
      timeout: 30000
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
  if (!rowStats.value[row.ID]) {
    await fetchContainerStats(row.ID);
  }
};

const openEditor = (id, name) => {
  selectedContainerId.value = id;
  fileEditor.value.openEditor(id, name);
};

const openSshDialog = (containerId, containerName) => {
  selectedContainerId.value = containerId;
  selectedContainerName.value = containerName || 'Container';
  sshDialogVisible.value = true;
};

const formatTimeAgo = (timeStr) => {
  if (!timeStr) return '-';
  return timeStr.replace('ago', '').trim();
};

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
  startContainerRefresh();
  setupApiEndpoints();
});

onBeforeUnmount(() => {
  stopStatsFetching();
  if (containersInterval) clearInterval(containersInterval);
});

// Watch dla debugowania
watch(rowStats, (newStats) => {
  console.log('Row stats updated:', newStats);
}, { deep: true });

// Interwał dla kontenerów (rzadziej)
const startContainerRefresh = () => {
  if (containersInterval) clearInterval(containersInterval);
  
  containersInterval = setInterval(() => {
    if (!loading.value) {
      fetchContainers();
    }
  }, 120000); // 30 sekund
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

.debug-btn {
  background-color: #f59e0b;
  border-color: #f59e0b;
  height: 20px;
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
  width: 60px;
  text-align: right;
  font-size: 0.85em;
  color: #495057;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.meter-value.error-value {
  color: #ef4444;
}

.meter-value.debug-value {
  color: #8b5cf6;
  font-weight: bold;
}

.debug-info {
  font-size: 0.7em;
  color: #6c757d;
  margin-top: 2px;
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
  gap: 4px;
  flex-wrap: wrap;
}

/* Debug Dialog Styles */
.debug-dialog {
  border-radius: 12px;
}

.debug-content {
  max-height: 70vh;
  overflow-y: auto;
}

.api-status, .containers-debug, .stats-debug, .network-debug {
  padding: 10px;
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.endpoint-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.endpoint-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.endpoint-status {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.endpoint-status.success {
  background-color: #10b98120;
  color: #10b981;
}

.endpoint-status.error {
  background-color: #ef444420;
  color: #ef4444;
}

.endpoint-status.pending {
  background-color: #f59e0b20;
  color: #f59e0b;
}

.endpoint-actions {
  display: flex;
  gap: 8px;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.error-item {
  padding: 8px;
  background: #fee2e2;
  border-radius: 6px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 0.9em;
}

.error-time {
  color: #6c757d;
  min-width: 80px;
}

.error-type {
  background: #ef4444;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
}

.error-message {
  flex: 1;
  color: #dc2626;
}

.container-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.container-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.container-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 5px;
}

.container-id {
  color: #6c757d;
  font-family: monospace;
}

.container-stats {
  display: flex;
  gap: 15px;
  font-size: 0.9em;
  color: #495057;
}

.stats-json {
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 15px;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9em;
}

.network-logs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 10px;
}

.network-log {
  padding: 6px;
  background: #f8f9fa;
  border-radius: 4px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 0.85em;
  font-family: 'Roboto Mono', monospace;
}

.log-time {
  color: #6c757d;
  min-width: 60px;
}

.log-method {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

.log-method.GET {
  background: #10b98120;
  color: #10b981;
}

.log-method.POST {
  background: #3b82f620;
  color: #3b82f6;
}

.log-url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
}

.log-status.success {
  background: #10b98120;
  color: #10b981;
}

.log-status.error {
  background: #ef444420;
  color: #ef4444;
}

.log-status.pending {
  background: #f59e0b20;
  color: #f59e0b;
}

.log-duration {
  color: #6c757d;
  min-width: 50px;
  text-align: right;
}

.debug-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* Other Dialog Styles */
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

/* TABLE STYLES */
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

:deep(.el-table__cell) {
  width: auto !important;
}

.full-width-table {
  width: 100%;
  table-layout: fixed;
  --el-table-border-color: #e9ecef;
  --el-table-header-bg-color: #f8f9fa;
  --el-table-row-hover-bg-color: #f1f3f5;
}

:deep(.el-table__header) th {
  padding: 12px 0;
  background-color: #f8f9fa;
}

:deep(.el-table__body) td {
  padding: 12px 0;
  white-space: nowrap;
  overflow: hidden;
  textOverflow: ellipsis;
}

/* Responsywność */
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
  
  .debug-footer {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
}
</style>
