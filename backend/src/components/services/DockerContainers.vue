<template>
  <div class="docker-containers">
    <!-- Error state -->
    <div v-if="errorState" class="error-state">
      <el-result icon="error" title="Failed to Load Containers" :sub-title="errorMessage">
        <template #extra>
          <el-button type="primary" @click="retryLoading">Retry</el-button>
        </template>
      </el-result>
    </div>

    <!-- Loading state -->
    <div v-else-if="initialLoading" class="loading-state">
      <div class="loading-content">
        <el-icon class="loading-icon" size="64"><Icon icon="mdi:docker" /></el-icon>
        <h3>Loading Docker Containers...</h3>
        <p>Please wait while we fetch your containers</p>
        <el-progress :percentage="loadingProgress" :show-text="false" status="success" />
      </div>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Header -->
      <div class="clean-header">
        <div class="header-left">
          <h2>
            <el-icon><Icon icon="mdi:docker" /></el-icon>
            Docker Containers
            <el-tag v-if="processedContainers.length > 0" type="info" size="small" class="ml-2">
              {{ processedContainers.length }} total
            </el-tag>
          </h2>
        </div>
        
        <div class="header-right">
          <el-input
            v-model="searchQuery"
            placeholder="Search containers..."
            clearable
            size="small"
            style="width: 250px;"
            @clear="fetchContainers"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          
          <div class="header-actions">
            <el-tooltip content="Refresh" placement="top">
              <el-button 
                type="info" 
                @click="fetchContainers" 
                size="small"
                :loading="loading"
                class="action-btn"
              >
                <el-icon><Icon icon="mdi:refresh" /></el-icon>
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="Create" placement="top">
              <el-button 
                type="primary" 
                @click="showCreateDialog = true" 
                size="small"
                class="action-btn"
              >
                <el-icon><Icon icon="mdi:plus" /></el-icon>
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="Debug" placement="top">
              <el-button 
                type="warning" 
                @click="showDebugInfo" 
                size="small"
                class="action-btn"
              >
                <el-icon><Icon icon="mdi:bug" /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <!-- Main table -->
      <div class="table-wrapper">
        <el-card shadow="never" class="clean-table-card" :class="{ 'empty': processedContainers.length === 0 }">
          <div v-if="processedContainers.length === 0 && !loading" class="empty-state">
            <el-icon size="64" class="empty-icon"><Icon icon="mdi:package-variant" /></el-icon>
            <h3>No containers found</h3>
            <p>There are no Docker containers running on this system</p>
            <el-button type="primary" @click="showCreateDialog = true" size="small" class="create-btn">
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Create your first container
            </el-button>
          </div>
          
          <div v-else class="table-container">
            <el-table
              :data="processedContainers"
              class="clean-table"
              stripe
              v-loading="loading"
              @row-click="handleRowClick"
              :row-class-name="tableRowClassName"
              :expand-row-keys="expandedRows"
              @expand-change="handleExpandChange"
              row-key="ID"
            >
              <el-table-column type="expand" width="40">
                <template #default="{row}">
                  <div class="expanded-row-content">
                    <ContainerStats 
                      :container-id="row.ID" 
                      :key="row.ID"
                      @error="handleStatsError"
                    />
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column prop="ID" label="ID" width="120">
                <template #default="{row}">
                  <el-tooltip :content="row.ID" placement="top">
                    <code class="container-id">{{ row.ID ? row.ID.substring(0, 12) : 'N/A' }}</code>
                  </el-tooltip>
                </template>
              </el-table-column>

              <el-table-column prop="Names" label="Name" min-width="180">
                <template #default="{row}">
                  <div class="name-cell">
                    <el-icon class="name-icon"><Icon icon="mdi:cube-outline" /></el-icon>
                    <span class="name-text">{{ row.Names ? row.Names.replace(/^\//, '') : 'unnamed' }}</span>
                    <el-tag 
                      v-if="row.Config?.Labels?.['com.docker.compose.project']" 
                      size="mini" 
                      effect="plain"
                      class="compose-tag"
                    >
                      compose
                    </el-tag>
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="Image" label="Image" min-width="200">
                <template #default="{row}">
                  <el-tooltip :content="row.Image || 'No image'" placement="top">
                    <span class="image-text">{{ formatImageName(row.Image) }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
              
              <el-table-column label="Status" width="100">
                <template #default="{row}">
                  <el-tag 
                    :type="getStatusType(row.Status)" 
                    size="small"
                    :class="getStatusClass(row.Status)"
                    class="status-tag"
                  >
                    <el-icon :size="10" class="status-icon">
                      <Icon :icon="getStatusIcon(row.Status)" />
                    </el-icon>
                    {{ getStatusText(row.Status) }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Uptime" width="120">
                <template #default="{row}">
                  <div class="uptime-cell">
                    <el-icon size="12" class="uptime-icon"><Icon icon="mdi:clock-outline" /></el-icon>
                    <span class="uptime-text">{{ extractUpTime(row.Status) }}</span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="Resources" width="150">
                <template #default="{row}">
                  <div class="resource-cell">
                    <div class="resource-row cpu-row">
                      <el-icon size="12" class="resource-icon"><Icon icon="mdi:cpu-64-bit" /></el-icon>
                      <el-progress 
                        :percentage="getSafePercentage(rowStats[row.ID]?.cpu)" 
                        :color="getProgressColor(getSafePercentage(rowStats[row.ID]?.cpu))"
                        :show-text="false"
                        :stroke-width="6"
                        class="resource-bar"
                      />
                      <span class="resource-value">{{ getFormattedValue(rowStats[row.ID]?.cpu) }}%</span>
                    </div>
                    <div class="resource-row memory-row">
                      <el-icon size="12" class="resource-icon"><Icon icon="mdi:memory" /></el-icon>
                      <el-progress 
                        :percentage="getSafePercentage(rowStats[row.ID]?.memory)" 
                        :color="getProgressColor(getSafePercentage(rowStats[row.ID]?.memory))"
                        :show-text="false"
                        :stroke-width="6"
                        class="resource-bar"
                      />
                      <span class="resource-value">{{ getFormattedValue(rowStats[row.ID]?.memory) }}%</span>
                    </div>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="Ports" width="180">
                <template #default="{row}">
                  <div class="ports-container">
                    <div v-if="row.Ports && formatPorts(row.Ports).length > 0" class="ports-cell">
                      <el-tag 
                        v-for="(port, index) in formatPorts(row.Ports).slice(0, 2)" 
                        :key="index"
                        size="small"
                        class="port-tag"
                      >
                        {{ port }}
                      </el-tag>
                      <el-tag 
                        v-if="formatPorts(row.Ports).length > 2" 
                        size="small" 
                        type="info"
                        class="more-ports"
                      >
                        +{{ formatPorts(row.Ports).length - 2 }}
                      </el-tag>
                    </div>
                    <span v-else class="no-ports">-</span>
                  </div>
                </template>
              </el-table-column>

<el-table-column label="Actions" width="320" fixed="right" class-name="actions-column">
  <template #default="{row}">
    <div class="actions-container">
      <div class="action-buttons-group">
        <!-- Grupa podstawowych akcji -->
        <el-button-group class="primary-actions">
          <el-tooltip content="Start/Stop" placement="top">
            <el-button
              :type="isContainerRunning(row.Status) ? 'danger' : 'success'"
              size="small"
              circle
              @click.stop="manageContainer(row.ID, isContainerRunning(row.Status) ? 'stop' : 'start')"
              :loading="loadingActions[row.ID] === 'start' || loadingActions[row.ID] === 'stop'"
              :disabled="!row.ID"
            >
              <el-icon>
                <Icon :icon="isContainerRunning(row.Status) ? 'mdi:stop' : 'mdi:play'" />
              </el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Restart" placement="top">
            <el-button
              type="warning"
              size="small"
              circle
              @click.stop="manageContainer(row.ID, 'restart')"
              :loading="loadingActions[row.ID] === 'restart'"
              :disabled="!row.ID || !isContainerRunning(row.Status)"
            >
              <el-icon><Icon icon="mdi:restart" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Logs" placement="top">
            <el-button
              type="info"
              size="small"
              circle
              @click.stop="showContainerLogs(row.ID)"
              :disabled="!row.ID"
            >
              <el-icon><Icon icon="mdi:file-document-outline" /></el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>

        <!-- Grupa zaawansowanych akcji -->
        <el-button-group class="secondary-actions">
          <el-tooltip content="Edit Config" placement="top">
            <el-button 
              type="primary" 
              size="small"
              circle
              @click="openEditor(row.ID, row.Config?.Labels?.['com.docker.compose.project.config_files'] || `${row.Names}.yml`)"
              :disabled="!row.ID || !isContainerRunning(row.Status)"
            >
              <el-icon><Icon icon="mdi:file-edit" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Terminal" placement="top">
            <el-button
              type="success"
              size="small"
              circle
              @click.stop="openSshDialog(row.ID, row.Names)"
              :disabled="!row.ID || !isContainerRunning(row.Status)"
            >
              <el-icon><Icon icon="mdi:console" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Test Stats" placement="top">
            <el-button
              type="warning"
              size="small"
              circle
              @click.stop="testStatsApiDirect(row.ID)"
              :disabled="!row.ID"
            >
              <el-icon><Icon icon="mdi:chart-line" /></el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>

        <!-- Grupa narzędzi i zarządzania -->
        <el-button-group class="tertiary-actions">
          <el-tooltip content="Debug" placement="top">
            <el-button
              type="info"
              size="small"
              circle
              @click.stop="debugContainer(row)"
              :disabled="!row.ID"
            >
              <el-icon><Icon icon="mdi:bug-outline" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Delete" placement="top">
            <el-button
              type="danger"
              size="small"
              circle
              @click.stop="confirmDeleteContainer(row)"
              :disabled="!row.ID"
            >
              <el-icon><Icon icon="mdi:delete-outline" /></el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </div>
  </template>
</el-table-column>              

            </el-table>
          </div>
          
          <!-- Table footer -->
          <div class="table-footer" v-if="processedContainers.length > 0">
            <div class="footer-info">
              <span class="footer-text">
                Showing {{ processedContainers.length }} containers
                <span v-if="runningContainers.length > 0" class="running-count">
                  ({{ runningContainers.length }} running)
                </span>
              </span>
            </div>
            <div class="footer-actions">
              <el-button size="small" @click="forceRefreshAllStats" class="footer-btn" :loading="refreshingStats">
                <el-icon><Icon icon="mdi:refresh" /></el-icon>
                Refresh Stats
              </el-button>
              <el-button size="small" @click="showAutoActions = !showAutoActions" class="footer-btn">
                <el-icon><Icon icon="mdi:robot" /></el-icon>
                Batch Actions
              </el-button>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Batch Actions Panel -->
      <el-collapse-transition>
        <el-card v-show="showAutoActions" class="batch-actions-panel" shadow="never">
          <div class="batch-header">
            <h4><el-icon><Icon icon="mdi:robot" /></el-icon> Batch Operations</h4>
          </div>
          <div class="batch-content">
            <div class="batch-buttons">
              <el-button @click="batchAction('start')" type="success" size="small" class="batch-btn">
                Start All Stopped
              </el-button>
              <el-button @click="batchAction('stop')" type="danger" size="small" class="batch-btn">
                Stop All Running
              </el-button>
              <el-button @click="batchAction('restart')" type="warning" size="small" class="batch-btn">
                Restart All Running
              </el-button>
              <el-button @click="showAutoActions = false" type="text" size="small" class="close-btn">
                <el-icon><Icon icon="mdi:close" /></el-icon>
              </el-button>
            </div>
          </div>
        </el-card>
      </el-collapse-transition>
    </template>

    <!-- Create Dialog -->
    <el-dialog 
      v-model="showCreateDialog" 
      title="Create Container" 
      width="600px"
      class="clean-dialog"
    >
      <el-form :model="createForm" label-width="120px" label-position="top">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Container Name" required>
              <el-input v-model="createForm.name" placeholder="my-container" />
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
              size="small"
            >
              {{ port }}
            </el-tag>
          </div>
          <el-input
            v-model="newPort"
            placeholder="8080:80"
            @keyup.enter="addPort"
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
              size="small"
            >
              {{ vol }}
            </el-tag>
          </div>
          <el-input
            v-model="newVolume"
            placeholder="/host/path:/container/path"
            @keyup.enter="addVolume"
          >
            <template #append>
              <el-button @click="addVolume"><Icon icon="mdi:plus" /></el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="createContainer" 
          :disabled="!createForm.name || !createForm.image"
          :loading="creatingContainer"
        >
          Create Container
        </el-button>
      </template>
    </el-dialog>

    <file-editor 
      ref="fileEditor" 
      :container-id="selectedContainerId" 
      @container-updated="fetchContainers" 
    />

    <!-- Debug Dialog -->
    <el-dialog
      v-model="debugDialogVisible"
      title="🔍 Docker Containers Debug Console"
      width="90%"
      top="5vh"
      class="debug-dialog"
    >
      <el-tabs v-model="activeDebugTab" class="debug-tabs">
        <el-tab-pane label="API Status" name="api">
          <div class="debug-section">
            <h3><el-icon><Icon icon="mdi:api" /></el-icon> API Endpoints Status</h3>
            <div class="api-grid">
              <div v-for="(endpoint, index) in apiEndpoints" :key="index" class="api-card" :class="endpoint.status">
                <div class="api-card-header">
                  <el-icon :class="endpoint.status"><Icon :icon="getEndpointIcon(endpoint.status)" /></el-icon>
                  <strong>{{ endpoint.name }}</strong>
                </div>
                <div class="api-card-url">
                  <code>{{ endpoint.url }}</code>
                </div>
                <div class="api-card-actions">
                  <el-button @click="testApiEndpoint(endpoint)" :loading="endpoint.loading" size="small">
                    Test Now
                  </el-button>
                  <el-tag :type="endpoint.status === 'success' ? 'success' : endpoint.status === 'error' ? 'danger' : 'warning'" size="small">
                    {{ endpoint.status.toUpperCase() }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="Containers Data" name="containers">
          <div class="debug-section">
            <h3><el-icon><Icon icon="mdi:docker" /></el-icon> Containers Loaded: {{ containers.length }}</h3>
            <div class="containers-grid">
              <div v-for="container in containers.slice(0, 30)" :key="container.ID" class="container-debug-card">
                <div class="container-debug-header">
                  <div class="container-name">
                    <strong>{{ container.Names || 'Unnamed' }}</strong>
                    <code class="container-id-small">{{ container.ID ? container.ID.substring(0, 12) : 'N/A' }}</code>
                  </div>
                  <el-tag :type="getStatusType(container.Status)" size="small">
                    {{ getStatusText(container.Status) }}
                  </el-tag>
                </div>
                <div class="container-debug-body">
                  <div class="debug-info-row">
                    <span>Image:</span>
                    <code>{{ container.Image || 'N/A' }}</code>
                  </div>
                  <div class="debug-info-row">
                    <span>Status:</span>
                    <span>{{ container.Status || 'N/A' }}</span>
                  </div>
                  <div class="debug-info-row">
                    <span>Stats:</span>
                    <span :class="rowStats[container.ID] ? 'text-success' : 'text-muted'">
                      {{ rowStats[container.ID] ? 'Loaded' : 'Not loaded' }}
                    </span>
                  </div>
                  <div v-if="rowStats[container.ID]" class="debug-stats">
                    <div class="debug-stat">
                      <span>CPU:</span>
                      <span :class="getStatClass(rowStats[container.ID].cpu)">{{ getFormattedValue(rowStats[container.ID].cpu) }}%</span>
                    </div>
                    <div class="debug-stat">
                      <span>MEM:</span>
                      <span :class="getStatClass(rowStats[container.ID].memory)">{{ getFormattedValue(rowStats[container.ID].memory) }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="Statistics" name="stats">
          <div class="debug-section">
            <h3><el-icon><Icon icon="mdi:chart-line" /></el-icon> Statistics Data</h3>
            <div class="stats-debug">
              <div class="stats-header">
                <el-button @click="forceRefreshAllStats" size="small">
                  Refresh All Stats
                </el-button>
                <span class="stats-count">{{ Object.keys(rowStats).length }} containers with stats</span>
              </div>
              <pre class="stats-json">{{ statsDebugInfo }}</pre>
            </div>
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
      
      <template #footer>
        <div class="debug-footer">
          <div class="debug-controls">
            <el-switch
              v-model="isDebugMode"
              active-text="Debug Mode"
              inactive-text="Normal Mode"
            />
            <el-button @click="runFullDiagnostic" type="primary" :loading="runningDiagnostic">
              <el-icon><Icon icon="mdi:play" /></el-icon>
              Run Full Diagnostic
            </el-button>
          </div>
          <el-button @click="debugDialogVisible = false">
            Close
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Logs Dialog -->
    <el-dialog
      v-model="logsDialogVisible"
      :title="`📄 Logs: ${selectedContainerId ? selectedContainerId.substring(0, 12) : 'Container'}`"
      width="80%"
      top="5vh"
      class="logs-dialog"
      @closed="stopLogsFollow"
    >
      <div class="logs-container">
        <div class="logs-toolbar">
          <el-button-group>
            <el-button @click="fetchLogs('tail=100')" size="small">
              Last 100 lines
            </el-button>
            <el-button @click="fetchLogs('tail=500')" size="small">
              Last 500 lines
            </el-button>
            <el-button @click="toggleFollowLogs" size="small" :type="followLogs ? 'primary' : ''">
              <el-icon><Icon :icon="followLogs ? 'mdi:pause' : 'mdi:play'" /></el-icon>
              {{ followLogs ? 'Following' : 'Follow' }}
            </el-button>
            <el-button @click="clearLogs" size="small">
              <el-icon><Icon icon="mdi:trash-can" /></el-icon>
              Clear
            </el-button>
          </el-button-group>
          
          <div class="logs-actions">
            <el-button @click="copyLogs" size="small">
              <el-icon><Icon icon="mdi:content-copy" /></el-icon>
              Copy
            </el-button>
            <el-button @click="downloadLogs" size="small">
              <el-icon><Icon icon="mdi:download" /></el-icon>
              Download
            </el-button>
          </div>
        </div>
        
        <div class="logs-content">
          <div class="logs-header">
            <div class="logs-info">
              <span class="logs-count">Lines: {{ logLinesCount }}</span>
              <span class="logs-updated" v-if="followLogs">Updating...</span>
            </div>
          </div>
          <div class="logs-output-wrapper">
            <pre class="logs-output" ref="logsOutputRef">{{ containerLogs }}</pre>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="logsDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>

    <!-- SSH Terminal Dialog -->
    <el-dialog
      v-model="sshDialogVisible"
      :title="`SSH Terminal: ${selectedContainerName}`"
      width="85%"
      top="5vh"
      @closed="handleClose"
    >
      <SSHTerminal
        v-if="sshDialogVisible"
        :container-id="selectedContainerId"
        :socket-url="socketUrl"
        @close="handleClose"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import ContainerStats from './ContainerStats.vue';
import SSHTerminal from './SSHTerminal.vue';
import FileEditor from './FileEditor.vue';

// Reactive state
const containers = ref([]);
const loading = ref(false);
const initialLoading = ref(true);
const loadingProgress = ref(0);
const searchQuery = ref('');
const logsDialogVisible = ref(false);
const containerLogs = ref('');
const selectedContainerId = ref('');
const loadingActions = ref({});
const rowStats = ref({});
const showCreateDialog = ref(false);
const debugDialogVisible = ref(false);
const sshDialogVisible = ref(false);
const selectedContainerName = ref('');
const showAutoActions = ref(false);
const activeDebugTab = ref('api');
const isDebugMode = ref(false);
const followLogs = ref(false);
const errorState = ref(false);
const errorMessage = ref('');
const refreshingStats = ref(false);
const creatingContainer = ref(false);
const runningDiagnostic = ref(false);
const expandedRows = ref([]);
const logsOutputRef = ref(null);
const fileEditor = ref(null);

// Create form
const createForm = ref({
  name: '',
  image: '',
  ports: [],
  volumes: []
});
const newPort = ref('');
const newVolume = ref('');
const availableImages = ref([]);

// Debug state
const apiEndpoints = ref([]);
const networkLogs = ref([]);
const apiErrors = ref([]);

// Intervals
let statsInterval = null;
let logsInterval = null;
let progressInterval = null;

// Computed
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
    Ports: container.Ports || container.PortBindings || '',
    Config: container.Config || {}
  }));
});

const runningContainers = computed(() => {
  return containers.value.filter(c => isContainerRunning(c.Status));
});

const logLinesCount = computed(() => {
  if (!containerLogs.value) return 0;
  return containerLogs.value.split('\n').length;
});

const totalMemoryUsage = computed(() => {
  const running = runningContainers.value;
  if (running.length === 0) return 0;
  
  const total = running.reduce((sum, container) => {
    const stats = rowStats.value[container.ID];
    return sum + (stats?.memory || 0);
  }, 0);
  
  return Math.round(total / running.length);
});

const totalCpuUsage = computed(() => {
  const running = runningContainers.value;
  if (running.length === 0) return 0;
  
  const total = running.reduce((sum, container) => {
    const stats = rowStats.value[container.ID];
    return sum + (stats?.cpu || 0);
  }, 0);
  
  return Math.round(total / running.length);
});

const statsDebugInfo = computed(() => {
  return JSON.stringify({
    totalStats: Object.keys(rowStats.value).length,
    stats: Object.entries(rowStats.value).reduce((acc, [id, stats]) => {
      acc[id.substring(0, 12)] = {
        cpu: stats.cpu,
        memory: stats.memory,
        error: stats.error,
        timestamp: new Date(stats.timestamp).toLocaleTimeString()
      };
      return acc;
    }, {}),
    apiErrors: apiErrors.value.slice(-5),
    containers: containers.value.length,
    running: runningContainers.value.length,
    timestamp: new Date().toISOString()
  }, null, 2);
});

const socketUrl = computed(() => {
  return `ws://${window.location.hostname}:1111`;
});

// Helper functions
const safeSplit = (str, delimiter = ',') => {
  if (!str) return [];
  return str.split(delimiter).map(s => s.trim()).filter(s => s);
};

const formatImageName = (image) => {
  if (!image) return 'No image';
  const parts = image.split('/');
  return parts[parts.length - 1];
};

const isContainerRunning = (status) => {
  return status?.toLowerCase().includes('up') || false;
};

const getStatusType = (status) => {
  if (!status) return 'info';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('up')) return 'success';
  if (lowerStatus.includes('exited')) return 'danger';
  if (lowerStatus.includes('paused')) return 'warning';
  return 'info';
};

const getStatusClass = (status) => {
  if (!status) return '';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('up')) return 'status-running';
  if (lowerStatus.includes('exited')) return 'status-stopped';
  return '';
};

const getStatusIcon = (status) => {
  if (!status) return 'mdi:help-circle';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('up')) return 'mdi:check-circle';
  if (lowerStatus.includes('exited')) return 'mdi:stop-circle';
  if (lowerStatus.includes('paused')) return 'mdi:pause-circle';
  return 'mdi:help-circle';
};

const getStatusText = (status) => {
  if (!status) return 'Unknown';
  if (status.includes('Up')) return 'Running';
  if (status.includes('Exited')) return 'Stopped';
  if (status.includes('Paused')) return 'Paused';
  return status.split(' ')[0] || status;
};

const extractUpTime = (status) => {
  if (!status) return '-';
  const match = status.match(/Up\s+(.*)/);
  return match ? match[1] : '-';
};

const getProgressColor = (percentage) => {
  if (!percentage && percentage !== 0) return '#94a3b8';
  if (percentage < 30) return '#10B981';
  if (percentage < 70) return '#F59E0B';
  return '#EF4444';
};

const getSafePercentage = (value) => {
  if (value === undefined || value === null) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
};

const getFormattedValue = (value) => {
  if (value === undefined || value === null) return '0.0';
  const num = parseFloat(value);
  return isNaN(num) ? '0.0' : num.toFixed(1);
};

const getEndpointIcon = (status) => {
  switch (status) {
    case 'success': return 'mdi:check-circle';
    case 'error': return 'mdi:alert-circle';
    case 'pending': return 'mdi:clock-outline';
    default: return 'mdi:help-circle';
  }
};

const getStatClass = (value) => {
  if (value === undefined || value === null) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  if (num > 80) return 'text-danger';
  if (num > 60) return 'text-warning';
  return 'text-success';
};

// Funkcja do formatowania portów - naprawiona
const formatPorts = (ports) => {
  if (!ports) return [];
  
  // Jeśli ports jest stringiem, rozdziel go
  if (typeof ports === 'string') {
    return ports.split(',').map(p => p.trim()).filter(p => p);
  }
  
  // Jeśli ports jest tablicą
  if (Array.isArray(ports)) {
    return ports.map(port => {
      if (typeof port === 'string') return port;
      if (port && port.PublicPort && port.PrivatePort && port.Type) {
        return `${port.IP || '0.0.0.0'}:${port.PublicPort}->${port.PrivatePort}/${port.Type.toLowerCase()}`;
      }
      return String(port);
    }).filter(p => p);
  }
  
  return [];
};

const handleError = (error, context = '') => {
  console.error(`Error in ${context}:`, error);
  errorState.value = true;
  errorMessage.value = `${context}: ${error.message || 'Unknown error occurred'}`;
  
  if (!context.includes('stats')) {
    ElMessage.error(`Error: ${error.message || 'Failed to load containers'}`);
  }
  
  return null;
};

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

const retryLoading = () => {
  errorState.value = false;
  errorMessage.value = '';
  initialLoading.value = true;
  fetchContainers();
};

const tableRowClassName = ({ row }) => {
  return expandedRows.value.includes(row.ID) ? 'expanded-row' : '';
};

const handleExpandChange = (row, expandedRowsArray) => {
  expandedRows.value = expandedRowsArray.map(r => r.ID);
};

// Progress simulation
const startProgressSimulation = () => {
  if (progressInterval) clearInterval(progressInterval);
  
  loadingProgress.value = 0;
  progressInterval = setInterval(() => {
    if (loadingProgress.value < 90) {
      loadingProgress.value += 10;
    } else {
      clearInterval(progressInterval);
    }
  }, 200);
};

// API functions
const setupApiEndpoints = () => {
  apiEndpoints.value = [
    {
      name: 'Get Containers',
      url: `/services/docker/containers`,
      method: 'GET',
      status: 'pending',
      loading: false
    },
    {
      name: 'Container Stats',
      url: `/services/docker/stats/container/{ID}`,
      method: 'GET',
      status: 'pending',
      loading: false
    },
    {
      name: 'Docker Info',
      url: `/services/docker/info`,
      method: 'GET',
      status: 'pending',
      loading: false
    }
  ];
};

const testApiEndpoint = async (endpoint) => {
  endpoint.loading = true;
  endpoint.status = 'pending';
  
  try {
    let testUrl = endpoint.url;
    if (testUrl.includes('{ID}') && containers.value.length > 0) {
      const containerId = containers.value[0]?.ID;
      if (containerId) {
        testUrl = testUrl.replace('{ID}', containerId);
      }
    }
    
    const response = await logNetworkRequest('GET', testUrl.replace(baseUrl.value, ''));
    //const response = await axios.get(testUrl, { timeout: 5000 });
    endpoint.response = response.data;
    endpoint.status = 'success';
    ElMessage.success(`${endpoint.name} is working`);
  } catch (error) {
    endpoint.status = 'error';
    endpoint.error = error.message;
    ElMessage.error(`${endpoint.name} failed: ${error.message}`);
  } finally {
    endpoint.loading = false;
  }
};

const fetchContainers = async () => {
  if (loading.value) return;
  
  try {
    loading.value = true;
    initialLoading.value = true;
    startProgressSimulation();
    
    const response = await logNetworkRequest('GET', '/services/docker/containers', {
      params: { all: true }
    });

    if (!response.data) {
      throw new Error('No response data received');
    }

    containers.value = Array.isArray(response.data.containers) 
      ? response.data.containers
      : response.data;

    if (!Array.isArray(containers.value)) {
      containers.value = [];
    }

    setupApiEndpoints();
    startStatsFetching();
    
    loadingProgress.value = 100;
    setTimeout(() => {
      initialLoading.value = false;
    }, 500);
    
    ElMessage.success(`Loaded ${containers.value.length} containers`);

  } catch (error) {
    handleError(error, 'Fetching containers');
    apiErrors.value.push({
      type: 'containers',
      time: new Date().toISOString(),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    containers.value = [];
    ElMessage.error(`Failed to fetch containers: ${error.message}`);
  } finally {
    loading.value = false;
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }
};

const fetchContainerStats = async (containerId) => {
  if (!containerId) return null;
  
  try {
    const statsEndpoint = `/services/docker/stats/container/${containerId}`;
    console.log(`Using endpoint: ${statsEndpoint}`);
    
    const response = await logNetworkRequest('GET', statsEndpoint, { 
      timeout: 8000 
    });

    const statsData = response.data?.stats || response.data;
    
    if (!statsData) {
      throw new Error('No stats data received');
    }
    
    const cpuField = statsData.cpu_percent || statsData.cpuPercent || statsData.cpu || 
                     statsData.CPUPerc || statsData.cpuPercentage || statsData.CPU || 0;
    
    const memField = statsData.memory_percent || statsData.memoryPercent || statsData.memory || 
                     statsData.MemPerc || statsData.memoryPercentage || statsData.MEM || 0;
    
    let cpuValue = 0;
    let memValue = 0;
    
    if (typeof cpuField === 'string') {
      cpuValue = parseFloat(cpuField.replace('%', '')) || 0;
    } else if (typeof cpuField === 'number') {
      cpuValue = cpuField;
    }
    
    if (typeof memField === 'string') {
      memValue = parseFloat(memField.replace('%', '')) || 0;
    } else if (typeof memField === 'number') {
      memValue = memField;
    }
    
    rowStats.value = {
      ...rowStats.value,
      [containerId]: {
        cpu: cpuValue,
        memory: memValue,
        timestamp: Date.now(),
        success: true
      }
    };

    return rowStats.value[containerId];
    
  } catch (error) {
    console.warn(`Error fetching stats for ${containerId}:`, error.message);
    
    apiErrors.value.push({
      type: 'stats',
      containerId: shortId,
      time: new Date().toISOString(),
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    rowStats.value = {
      ...rowStats.value,
      [containerId]: { 
        cpu: 0, 
        memory: 0, 
        error: true, 
        timestamp: Date.now(),
        errorMessage: error.message
      }
    };
    
    return { cpu: 0, memory: 0, error: true };
  }
};

const handleStatsError = (error) => {
  console.warn('Stats component error:', error);
};

const fetchAllStats = async () => {
  const running = runningContainers.value;
  
  if (running.length === 0) {
    return;
  }

  for (const container of running.slice(0, 10)) {
    if (container.ID && isContainerRunning(container.Status)) {
      await fetchContainerStats(container.ID);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
};

const forceRefreshAllStats = async () => {
  try {
    refreshingStats.value = true;
    await fetchAllStats();
    ElMessage.success('Stats refreshed');
  } catch (error) {
    console.error('Error refreshing stats:', error);
    ElMessage.error('Failed to refresh stats');
  } finally {
    refreshingStats.value = false;
  }
};

const startStatsFetching = () => {
  stopStatsFetching();
  
  setTimeout(() => fetchAllStats(), 1000);
  
  statsInterval = setInterval(() => {
    if (containers.value.length > 0) {
      fetchAllStats();
    }
  }, 10000);
};

const stopStatsFetching = () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
};

// Debug functions
const showDebugInfo = () => {
  debugDialogVisible.value = true;
  activeDebugTab.value = 'api';
  setupApiEndpoints();
};

const runFullDiagnostic = async () => {
  try {
    runningDiagnostic.value = true;
    ElMessage.info('Running full diagnostic...');
    
    for (const endpoint of apiEndpoints.value) {
      await testApiEndpoint(endpoint);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    ElMessage.success('Diagnostic complete');
  } catch (error) {
    console.error('Diagnostic failed:', error);
    ElMessage.error('Diagnostic failed');
  } finally {
    runningDiagnostic.value = false;
  }
};

// Container management
const manageContainer = async (id, action) => {
  if (!id) {
    ElMessage.error('Container ID is required');
    return;
  }
  
  try {
    loadingActions.value[id] = action;
    
    await axios.post(`/services/docker/container/${id}/${action}`, {}, {
      timeout: 15000
    });
    
    ElMessage.success(`Container ${action} successful`);
    
    setTimeout(() => {
      fetchContainers();
    }, 1500);
    
  } catch (error) {
    ElMessage.error(`Failed to ${action} container: ${error.message}`);
    console.error(error);
  } finally {
    setTimeout(() => {
      loadingActions.value[id] = null;
    }, 1000);
  }
};

// Batch actions
const batchAction = async (action) => {
  try {
    const containersToProcess = action === 'start' 
      ? processedContainers.value.filter(c => !isContainerRunning(c.Status))
      : processedContainers.value.filter(c => isContainerRunning(c.Status));
    
    if (containersToProcess.length === 0) {
      ElMessage.info(`No containers to ${action}`);
      return;
    }
    
    await ElMessageBox.confirm(
      `This will ${action} ${containersToProcess.length} containers. Continue?`,
      `Confirm ${action} all`,
      {
        confirmButtonText: 'Proceed',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );
    
    const promises = containersToProcess.map(container => 
      axios.post(`/services/docker/container/${container.ID}/${action}`, {}, {
        timeout: 10000
      }).catch(err => {
        console.error(`Failed to ${action} container ${container.ID}:`, err);
        return null;
      })
    );
    
    await Promise.all(promises);
    ElMessage.success(`${action}ed ${containersToProcess.length} containers`);
    fetchContainers();
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`Batch ${action} failed: ${error.message}`);
    }
  }
};

const deleteContainer = async (containerId) => {
  if (!containerId) {
    ElMessage.error('Container ID is required');
    return;
  }
  
  try {
    loadingActions.value[containerId] = 'delete';
    await axios.delete(`/services/docker/container/${containerId}`, {
      params: { force: true },
      timeout: 15000
    });
    ElMessage.success('Container deleted');
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to delete: ${error.response?.data?.message || error.message}`);
    throw error;
  } finally {
    loadingActions.value[containerId] = null;
  }
};

const confirmDeleteContainer = (container) => {
  if (!container?.ID) {
    ElMessage.error('Invalid container');
    return;
  }
  
  ElMessageBox.confirm(
    `Delete container ${container.Names || container.ID.substring(0, 12)}?`,
    'Confirm',
    {
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  ).then(async () => {
    await deleteContainer(container.ID);
  }).catch(() => {});
};

const showContainerLogs = async (id) => {
  if (!id) {
    ElMessage.error('Container ID is required');
    return;
  }
  
  try {
    selectedContainerId.value = id;
    await fetchLogs('tail=100');
    logsDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(`Failed to get logs: ${error.message}`);
  }
};

const fetchLogs = async (params = 'tail=100') => {
  if (!selectedContainerId.value) {
    containerLogs.value = 'No container selected';
    return;
  }
  
  try {
    const response = await axios.get(`/services/docker/container/logs/${selectedContainerId.value}?${params}`, {
      timeout: 15000
    });
    
    let newLogs = response.data?.logs || response.data || 'No logs available';
    
    // Jeśli follow jest włączone, dodaj nowe logi do istniejących
    if (params.includes('follow=true') && followLogs.value && containerLogs.value) {
      containerLogs.value += '\n' + newLogs;
    } else {
      containerLogs.value = newLogs;
    }
    
    // Auto-scroll do końca
    await nextTick();
    if (logsOutputRef.value) {
      logsOutputRef.value.scrollTop = logsOutputRef.value.scrollHeight;
    }
    
  } catch (error) {
    containerLogs.value = `Error loading logs: ${error.message}`;
  }
};

const startLogsFollow = () => {
  stopLogsFollow();
  logsInterval = setInterval(async () => {
    await fetchLogs('tail=10&follow=true');
  }, 2000);
};

const stopLogsFollow = () => {
  if (logsInterval) {
    clearInterval(logsInterval);
    logsInterval = null;
  }
  followLogs.value = false;
};

const toggleFollowLogs = () => {
  followLogs.value = !followLogs.value;
  if (followLogs.value) {
    startLogsFollow();
  } else {
    stopLogsFollow();
  }
};

const clearLogs = () => {
  containerLogs.value = '';
  ElMessage.info('Logs cleared');
};

const copyLogs = () => {
  if (!containerLogs.value) {
    ElMessage.warning('No logs to copy');
    return;
  }
  
  navigator.clipboard.writeText(containerLogs.value)
    .then(() => ElMessage.success('Copied to clipboard'))
    .catch(() => ElMessage.error('Failed to copy'));
};

const downloadLogs = () => {
  if (!containerLogs.value) {
    ElMessage.warning('No logs to download');
    return;
  }
  
  const blob = new Blob([containerLogs.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `container-${selectedContainerId.value ? selectedContainerId.value.substring(0, 12) : 'logs'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  ElMessage.success('Logs downloaded');
};

// Container creation
const searchImages = async (query) => {
  if (!query) {
    availableImages.value = [];
    return;
  }
  
  try {
    const response = await axios.get('/services/docker/images/search', {
      params: { q: query },
      timeout: 10000
    });
    availableImages.value = response.data?.images || [];
  } catch (error) {
    console.error('Error searching images:', error);
    availableImages.value = [];
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

const createContainer = async () => {
  if (!createForm.value.name || !createForm.value.image) {
    ElMessage.error('Name and image are required');
    return;
  }
  
  try {
    creatingContainer.value = true;
    
    const response = await axios.post('/services/docker/container/create', {
      name: createForm.value.name,
      image: createForm.value.image,
      ports: createForm.value.ports,
      volumes: createForm.value.volumes
    }, {
      timeout: 30000
    });

    ElMessage.success(response.data?.message || 'Container created successfully');
    showCreateDialog.value = false;
    resetCreateForm();
    await fetchContainers();
  } catch (error) {
    ElMessage.error(`Failed to create container: ${error.response?.data?.message || error.message}`);
  } finally {
    creatingContainer.value = false;
  }
};

const resetCreateForm = () => {
  createForm.value = {
    name: '',
    image: '',
    ports: [],
    volumes: []
  };
  newPort.value = '';
  newVolume.value = '';
};

const handleRowClick = async (row, column, event) => {
  // Nie rozwijaj jeśli kliknięto w akcje
  if (event.target.closest('.quick-actions') || event.target.closest('.el-button')) {
    return;
  }
  
  if (row.ID && !rowStats.value[row.ID]) {
    await fetchContainerStats(row.ID);
  }
};

const openEditor = (id, name) => {
  selectedContainerId.value = id;
  fileEditor.value.openEditor(id, name);
};

const openSshDialog = (containerId, containerName) => {
  if (!containerId) {
    ElMessage.error('Container ID is required');
    return;
  }
  
  selectedContainerId.value = containerId;
  selectedContainerName.value = containerName || 'Container';
  sshDialogVisible.value = true;
};

const handleClose = () => {
  sshDialogVisible.value = false;
  stopLogsFollow();
};

const testStatsApiDirect = async (containerId) => {
  if (!containerId) {
    ElMessage.error('Container ID is required');
    return;
  }
  
  const container = containers.value.find(c => c.ID === containerId);
  if (!container) {
    ElMessage.error('Container not found');
    return;
  }
  
  try {
    const stats = await fetchContainerStats(containerId);
    
    ElMessageBox.alert(
      `<div class="stats-test-result">
        <h4>Stats Test: ${container.Names || container.ID.substring(0, 12)}</h4>
        <pre>${JSON.stringify(stats, null, 2)}</pre>
        <p><strong>Status:</strong> ${stats.error ? '❌ Failed' : '✅ Success'}</p>
        ${stats.error ? `<p><strong>Error:</strong> ${stats.errorMessage}</p>` : ''}
      </div>`,
      `Stats Test - ${containerId.substring(0, 12)}`,
      {
        dangerouslyUseHTMLString: true,
        width: '60%'
      }
    );
  } catch (error) {
    ElMessage.error(`Test failed: ${error.message}`);
  }
};

const debugContainer = (container) => {
  if (!container) {
    ElMessage.error('Container data is missing');
    return;
  }
  
  const stats = rowStats.value[container.ID];
  
  let debugInfo = `
    <div class="container-debug-popup">
      <h4>${container.Names || 'Unnamed'}</h4>
      <p><strong>ID:</strong> ${container.ID ? container.ID.substring(0, 12) : 'N/A'}</p>
      <p><strong>Status:</strong> ${container.Status || 'N/A'}</p>
      <p><strong>Image:</strong> ${container.Image || 'N/A'}</p>
      <p><strong>Running:</strong> ${isContainerRunning(container.Status) ? '✅ Yes' : '❌ No'}</p>
      <p><strong>Stats loaded:</strong> ${stats ? '✅ Yes' : '❌ No'}</p>
  `;
  
  if (stats) {
    debugInfo += `
      <p><strong>CPU Usage:</strong> ${stats.cpu || 0}%</p>
      <p><strong>Memory Usage:</strong> ${stats.memory || 0}%</p>
      <p><strong>Last update:</strong> ${new Date(stats.timestamp).toLocaleTimeString()}</p>
      <p><strong>Error:</strong> ${stats.error ? '✅ Yes' : '❌ No'}</p>
    `;
  }
  
  debugInfo += `</div>`;
  
  ElMessageBox.alert(debugInfo, `🔍 Debug: ${container.Names || 'Container'}`, {
    dangerouslyUseHTMLString: true,
    width: '500px'
  });
};

// Lifecycle
onMounted(() => {
  fetchContainers();
  setupApiEndpoints();
});

onBeforeUnmount(() => {
  stopStatsFetching();
  stopLogsFollow();
  if (progressInterval) {
    clearInterval(progressInterval);
  }
});
</script>

<style scoped>
.docker-containers {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  overflow: hidden;
}

/* Error state */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin: 20px;
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading-content {
  text-align: center;
  max-width: 350px;
  padding: 30px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.loading-icon {
  color: #3b82f6;
  margin-bottom: 16px;
  animation: pulse 1.5s infinite;
}

.loading-content h3 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.loading-content p {
  margin: 0 0 20px 0;
  color: #64748b;
  font-size: 14px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Main content styles */
.clean-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h2 .el-icon {
  font-size: 22px;
  color: #2496ed;
}

.ml-2 {
  margin-left: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  min-width: auto;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Table wrapper */
.table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 0 20px 20px 20px;
}

.clean-table-card {
  height: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.clean-table-card.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.table-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

/* Table styling */
.clean-table {
  flex: 1;
  border: none;
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  width: 100% !important;
  min-height: 300px;
}

:deep(.clean-table .el-table__header-wrapper) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  flex-shrink: 0;
}

:deep(.clean-table .el-table__header) {
  width: 100% !important;
}

:deep(.clean-table .el-table__header th) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  padding: 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.clean-table .el-table__body-wrapper) {
  flex: 1;
  overflow: auto;
  min-height: 200px;
}

:deep(.clean-table .el-table__body) {
  width: 100% !important;
}

:deep(.clean-table .el-table__row) {
  transition: all 0.2s ease;
  height: 60px;
}

:deep(.clean-table .el-table__row:hover > td) {
  background-color: #f8fafc !important;
}

:deep(.clean-table .el-table__row.el-table__row--striped) {
  background-color: #f8fafc;
}

:deep(.clean-table .el-table__row.el-table__row--striped:hover > td) {
  background-color: #f1f5f9 !important;
}

/* Expanded row */
:deep(.expanded-row) {
  background-color: #f8fafc !important;
}

:deep(.expanded-row + .el-table__row) {
  border-top: 2px solid #e2e8f0;
}

.expanded-row-content {
  padding: 16px;
  background: white;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  margin: 0;
  max-height: 300px;
  overflow: auto;
}

/* Cells */
.container-id {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  color: #475569;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-block;
  border: 1px solid #e2e8f0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}

.name-icon {
  color: #64748b;
  font-size: 16px;
  flex-shrink: 0;
}

.name-text {
  font-weight: 500;
  color: #1e293b;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-tag {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #0369a1;
  border: none;
  font-size: 10px;
  padding: 1px 6px;
  height: 18px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.image-text {
  color: #475569;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  background: #f8fafc;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
  max-width: 100%;
}

/* Status tags */
.status-tag {
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 11px;
  white-space: nowrap;
  max-width: 100%;
}

.status-icon {
  font-size: 12px !important;
  flex-shrink: 0;
}

.status-running {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.status-stopped {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fecaca;
}

.status-paused {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #fde68a;
}

.uptime-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}

.uptime-icon {
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}

.uptime-text {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Resource cells */
.resource-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
  min-width: 0;
}

.resource-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 20px;
  min-width: 0;
}

.cpu-row {
  margin-bottom: 1px;
}

.memory-row {
  margin-top: 1px;
}

.resource-icon {
  color: #64748b;
  width: 16px;
  flex-shrink: 0;
  font-size: 12px;
}

.resource-bar {
  flex: 1;
  min-width: 60px;
  margin: 0;
}

:deep(.resource-bar .el-progress-bar__outer) {
  border-radius: 8px;
  background-color: #f1f5f9;
  height: 6px;
  min-width: 60px;
}

:deep(.resource-bar .el-progress-bar__inner) {
  border-radius: 8px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.resource-value {
  width: 40px;
  text-align: right;
  font-weight: 600;
  color: #1e293b;
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  flex-shrink: 0;
}

/* Ports */
.ports-container {
  width: 100%;
}

.ports-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  max-width: 100%;
}

.port-tag {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 10px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  margin: 2px;
}

.more-ports {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-block;
}

.no-ports {
  color: #94a3b8;
  font-style: italic;
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}

/* Actions cell */
.actions-container {
  width: 100%;
  min-width: 0;
}

.quick-actions {
  display: flex;
  justify-content: flex-start;
  flex-wrap: nowrap;
  overflow: visible;
  min-width: 0;
}

.icon-btn {
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 14px;
  min-width: auto;
  width: auto;
  height: auto;
}

.icon-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 16px;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  color: #cbd5e1;
  font-size: 60px !important;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 24px 0;
  max-width: 350px;
  line-height: 1.5;
  color: #64748b;
  font-size: 14px;
}

.create-btn {
  border-radius: 8px;
  padding: 8px 20px;
  font-weight: 600;
  font-size: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  transition: all 0.2s ease;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* Table footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #f1f5f9;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  flex-shrink: 0;
}

.footer-info {
  color: #64748b;
  font-size: 12px;
}

.footer-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.running-count {
  color: #10b981;
  font-weight: 600;
  background: #d1fae5;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* Batch actions */
.batch-actions-panel {
  margin: 0 20px 20px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.batch-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border-radius: 8px 8px 0 0;
}

.batch-header h4 {
  margin: 0;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.batch-content {
  padding: 16px;
}

.batch-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.batch-btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.2s ease;
}

.batch-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.close-btn {
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Debug Dialog styles */
.debug-dialog :deep(.el-dialog__header) {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  margin: 0;
}

.debug-dialog :deep(.el-dialog__body) {
  padding: 0;
  max-height: 60vh;
  overflow: hidden;
}

.debug-dialog :deep(.el-dialog__footer) {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
}

.debug-tabs {
  height: 100%;
}

.debug-tabs :deep(.el-tabs__content) {
  height: calc(100% - 45px);
  overflow: auto;
  padding: 16px;
}

.debug-section {
  margin-bottom: 24px;
}

.debug-section h3 {
  margin: 0 0 16px 0;
  color: #2d3748;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* API Grid */
.api-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.api-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s ease;
}

.api-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.api-card.success {
  border-left: 3px solid #10b981;
}

.api-card.error {
  border-left: 3px solid #ef4444;
}

.api-card.pending {
  border-left: 3px solid #f59e0b;
}

.api-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.api-card-header .el-icon {
  font-size: 16px;
}

.api-card-header .el-icon.success {
  color: #10b981;
}

.api-card-header .el-icon.error {
  color: #ef4444;
}

.api-card-header .el-icon.pending {
  color: #f59e0b;
}

.api-card-url {
  margin-bottom: 8px;
}

.api-card-url code {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 3px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.api-card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Containers grid */
.containers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.container-debug-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s ease;
}

.container-debug-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.container-debug-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.container-name {
  flex: 1;
}

.container-name strong {
  display: block;
  color: #2d3748;
  margin-bottom: 2px;
  font-size: 13px;
}

.container-id-small {
  font-family: 'Roboto Mono', monospace;
  font-size: 10px;
  color: #64748b;
  background: #f8fafc;
  padding: 1px 4px;
  border-radius: 3px;
}

.container-debug-body {
  font-size: 12px;
}

.debug-info-row {
  display: flex;
  margin-bottom: 4px;
  line-height: 1.4;
}

.debug-info-row span:first-child {
  width: 50px;
  color: #64748b;
  font-weight: 500;
  font-size: 11px;
}

.debug-info-row code {
  font-family: 'Roboto Mono', monospace;
  color: #475569;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
}

.debug-stats {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
}

.debug-stat {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
}

.debug-stat span:first-child {
  color: #64748b;
  font-weight: 500;
}

.text-success {
  color: #10b981;
  font-weight: 600;
}

.text-warning {
  color: #f59e0b;
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
  font-weight: 600;
}

.text-muted {
  color: #94a3b8;
}

/* Stats debug */
.stats-debug {
  background: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
}

.stats-count {
  color: #94a3b8;
  font-size: 11px;
}

.stats-json {
  margin: 0;
  padding: 12px;
  color: #f0f0f0;
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  max-height: 300px;
  overflow: auto;
}

/* Logs Dialog Styles */
.logs-dialog :deep(.el-dialog__header) {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  margin: 0;
}

.logs-dialog :deep(.el-dialog__body) {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logs-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  flex-shrink: 0;
}

.logs-actions {
  display: flex;
  gap: 8px;
}

.logs-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logs-header {
  padding: 8px 16px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.logs-info {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 12px;
  color: #64748b;
}

.logs-count {
  font-weight: 600;
  color: #475569;
}

.logs-updated {
  color: #10b981;
  font-weight: 600;
  animation: pulse 1.5s infinite;
}

.logs-output-wrapper {
  flex: 1;
  overflow: auto;
  padding: 0;
  background: #1e1e1e;
}

.logs-output {
  margin: 0;
  padding: 16px;
  color: #f0f0f0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 100%;
}

/* Log colors */
.logs-output :deep(.log-line) {
  display: block;
  margin-bottom: 2px;
}

.logs-output :deep(.log-info) {
  color: #60a5fa;
}

.logs-output :deep(.log-warning) {
  color: #fbbf24;
}

.logs-output :deep(.log-error) {
  color: #f87171;
}

.logs-output :deep(.log-debug) {
  color: #a78bfa;
}

.logs-dialog :deep(.el-dialog__footer) {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
}

/* Responsive */
@media (max-width: 1400px) {
  .clean-table {
    font-size: 12px;
  }
}

@media (max-width: 1200px) {
  .clean-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-right {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  
  :deep(.clean-table .el-table__header th),
  :deep(.clean-table .el-table__cell) {
    padding: 8px 6px;
  }
  
  .api-grid,
  .containers-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}

@media (max-width: 992px) {
  .docker-containers {
    padding: 0;
  }
  
  .header-left h2 {
    font-size: 18px;
  }
  
  .table-wrapper {
    padding: 0 12px 12px 12px;
  }
  
  .quick-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  
  .api-grid,
  .containers-grid {
    grid-template-columns: 1fr;
  }
  
  .logs-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .logs-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .clean-header {
    padding: 12px;
  }
  
  .header-left h2 {
    font-size: 16px;
  }
  
  .table-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .footer-actions {
    justify-content: center;
  }
  
  .batch-buttons {
    justify-content: center;
  }
  
  :deep(.clean-table) {
    font-size: 11px;
  }
  
  .resource-cell {
    min-width: 150px;
  }
  
  .resource-value {
    font-size: 10px;
    width: 35px;
  }
  
  .quick-actions {
    gap: 3px;
  }
  
  .icon-btn {
    padding: 5px;
    font-size: 13px;
  }
  
  .logs-dialog {
    width: 95% !important;
  }
}

@media (max-width: 576px) {
  .clean-table-card {
    border-radius: 8px;
  }
  
  .action-btn {
    padding: 5px 10px;
  }
  
  .empty-state {
    padding: 40px 12px;
  }
  
  .empty-state h3 {
    font-size: 16px;
  }
  
  .create-btn {
    padding: 6px 16px;
    font-size: 12px;
  }
  
  .debug-dialog {
    width: 95% !important;
  }
  
  .ports-cell {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  
  .logs-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .logs-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-card, .clean-table-card {
  animation: fadeIn 0.3s ease-out;
}

/* Custom scrollbar */
:deep(.clean-table .el-table__body-wrapper) {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f1f5f9;
  border-radius: 3px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #cbd5e1;
  border-radius: 3px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #94a3b8;
}

/* Logs scrollbar */
.logs-output-wrapper::-webkit-scrollbar {
  width: 8px;
}

.logs-output-wrapper::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.logs-output-wrapper::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.logs-output-wrapper::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Fix for table column widths */
:deep(.clean-table .el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

:deep(.clean-table .el-table__cell .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

:deep(.actions-column .cell) {
  padding: 0 8px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* Ensure table takes full width */
:deep(.el-table) {
  width: 100% !important;
}

/* Fix expanded row */
:deep(.el-table__expanded-cell) {
  padding: 0 !important;
  background: white;
}

/* Global styles for debug popup */
.stats-test-result {
  max-height: 300px;
  overflow: auto;
}

.api-status, .containers-debug, .stats-debug, .network-debug {
  padding: 10px;
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

.stats-test-result pre {
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  margin: 8px 0;
}

.container-debug-popup {
  color: #2d3748;
  font-size: 12px;
}

.container-debug-popup h4 {
  margin: 0 0 12px 0;
  color: #2d3748;
  font-size: 14px;
}

.container-debug-popup p {
  margin: 6px 0;
  line-height: 1.4;
}

.container-debug-popup strong {
  color: #475569;
  min-width: 100px;
  display: inline-block;
  font-size: 11px;
}

/* Fix for port display */
.port-tag {
  display: inline-block;
  margin: 2px;
  line-height: 1.2;
}

/* Make sure table doesn't overflow */
:deep(.el-table__body) {
  overflow: visible !important;
}

:deep(.el-table__row--level-0) {
  border-bottom: 1px solid #f1f5f9;
}

/* Ensure container height */
:deep(.el-table__body-wrapper) {
  min-height: 200px !important;
}

.actions-column {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.action-buttons-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.el-button-group {
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.el-button-group .el-button {
  border-radius: 0;
  padding: 8px;
  transition: all 0.3s ease;
}

.el-button-group .el-button:first-child {
  border-radius: 8px 0 0 8px;
}

.el-button-group .el-button:last-child {
  border-radius: 0 8px 8px 0;
}

.el-button-group .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.el-button-group.primary-actions {
  border: 1px solid #e4e7ed;
}

.el-button-group.secondary-actions {
  border: 1px solid #d9ecff;
}

.el-button-group.tertiary-actions {
  border: 1px solid #fde2e2;
}

.el-button {
  border: none;
}

/* Tooltip styling */
:deep(.el-tooltip__trigger) {
  margin: 0;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .action-buttons-group {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .el-button-group {
    flex-wrap: nowrap;
  }
}
</style>
