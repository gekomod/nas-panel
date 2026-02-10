<template>
  <div class="docker-networks">
    <!-- Nagłówek z statystykami -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:lan" class="stat-icon network-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ networks.length }}</div>
              <div class="stat-label">Total Networks</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:bridge" class="stat-icon bridge-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ driverStats.bridge || 0 }}</div>
              <div class="stat-label">Bridge</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:server-network" class="stat-icon overlay-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ driverStats.overlay || 0 }}</div>
              <div class="stat-label">Overlay</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:check-circle" class="stat-icon attachable-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ attachableCount }}</div>
              <div class="stat-label">Attachable</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Panel wyszukiwania i akcji -->
    <el-card shadow="never" class="search-card">
      <div class="header">
        <div class="search-section">
          <el-input
            v-model="searchQuery"
            placeholder="Search networks by name or ID..."
            clearable
            class="search-input"
            size="large"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" class="search-icon" />
            </template>
          </el-input>
          <el-select
            v-model="filterDriver"
            placeholder="Filter by driver"
            clearable
            class="filter-select"
            size="large"
          >
            <el-option label="All Drivers" value="" />
            <el-option label="Bridge" value="bridge" />
            <el-option label="Host" value="host" />
            <el-option label="Overlay" value="overlay" />
            <el-option label="Macvlan" value="macvlan" />
          </el-select>
        </div>

        <div class="actions">
          <el-button 
            type="primary" 
            @click="fetchNetworks"
            :loading="loading"
            class="action-btn"
          >
            <Icon icon="mdi:refresh" class="icon" />
            Refresh
          </el-button>
          <el-button 
            type="success" 
            @click="showCreateDialog = true"
            class="action-btn"
          >
            <Icon icon="mdi:plus" class="icon" />
            Create Network
          </el-button>
          <el-button 
            type="info" 
            @click="showQuickActions = !showQuickActions"
            class="action-btn"
          >
            <Icon icon="mdi:dots-vertical" class="icon" />
            Quick Actions
          </el-button>
        </div>
      </div>

      <!-- Quick Actions Menu -->
      <el-collapse-transition>
        <div v-show="showQuickActions" class="quick-actions">
          <el-button-group class="quick-buttons">
            <el-button @click="pruneUnusedNetworks" size="small">
              <Icon icon="mdi:delete-sweep" />
              Prune Unused
            </el-button>
            <el-button @click="exportNetworks" size="small">
              <Icon icon="mdi:export" />
              Export JSON
            </el-button>
            <el-button @click="showAllNetworks" size="small">
              <Icon icon="mdi:eye" />
              Show All Details
            </el-button>
          </el-button-group>
        </div>
      </el-collapse-transition>
    </el-card>

    <!-- Tabela sieci -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="paginatedNetworks"
        style="width: 100%"
        stripe
        border
        :default-sort="{ prop: 'Name', order: 'ascending' }"
        :row-class-name="tableRowClassName"
        @row-click="handleRowClick"
      >
        <el-table-column prop="Name" label="Network Name" sortable width="200">
          <template #default="{ row }">
            <div class="network-name-cell">
              <Icon 
                :icon="getNetworkIcon(row.Driver)" 
                class="network-type-icon"
                :class="row.Driver"
              />
              <span class="name-text">{{ row.Name }}</span>
              <el-tag 
                v-if="row.Internal === 'true'" 
                size="small" 
                type="info"
                class="tag"
              >
                Internal
              </el-tag>
              <el-tag 
                v-if="row.Attachable === 'true'" 
                size="small" 
                type="success"
                class="tag"
              >
                Attachable
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="ID" label="ID" width="120">
          <template #default="{ row }">
            <span class="network-id">{{ row.ID.substring(0, 12) }}...</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="Driver" label="Driver" width="120" sortable>
          <template #default="{ row }">
            <el-tag 
              :type="getDriverTagType(row.Driver)"
              effect="plain"
            >
              {{ row.Driver }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="Scope" label="Scope" width="100" sortable>
          <template #default="{ row }">
            <el-tag 
              :type="row.Scope === 'local' ? '' : 'warning'"
              size="small"
            >
              {{ row.Scope }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="Created" width="150">
          <template #default="{ row }">
            {{ formatDate(row.CreatedAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="Containers" width="100" align="center">
          <template #default="{ row }">
            <el-badge :value="row.Containers || 0" :max="99" class="container-badge">
              <Icon icon="mdi:docker" />
            </el-badge>
          </template>
        </el-table-column>
        
        <el-table-column label="Actions" width="180" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip content="Inspect" placement="top">
                <el-button
                  size="small"
                  type="primary"
                  @click.stop="inspectNetwork(row.ID)"
                  circle
                >
                  <Icon icon="mdi:information" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Connect Container" placement="top">
                <el-button
                  size="small"
                  type="warning"
                  @click.stop="showConnectDialog(row)"
                  circle
                >
                  <Icon icon="mdi:link" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Disconnect All" placement="top" v-if="(row.Containers || 0) > 0">
                <el-button
                  size="small"
                  type="warning"
                  @click.stop="disconnectAllContainers(row)"
                  circle
                >
                  <Icon icon="mdi:link-off" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Delete" placement="top">
                <el-button
                  size="small"
                  type="danger"
                  @click.stop="deleteNetwork(row.ID, row.Name)"
                  circle
                >
                  <Icon icon="mdi:delete" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container" v-if="filteredNetworks.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredNetworks.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <!-- No data message -->
      <div v-if="filteredNetworks.length === 0" class="no-data">
        <Icon icon="mdi:lan-disconnect" class="no-data-icon" />
        <p>No networks found</p>
        <el-button type="primary" @click="showCreateDialog = true">
          Create Your First Network
        </el-button>
      </div>
    </el-card>

    <!-- Dialog tworzenia sieci -->
    <el-dialog 
      v-model="showCreateDialog" 
      title="Create New Network" 
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form 
        :model="networkForm" 
        label-width="120px" 
        :rules="networkRules"
        ref="networkFormRef"
      >
        <el-form-item label="Network Name" prop="name">
          <el-input 
            v-model="networkForm.name" 
            placeholder="e.g., my-network"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="Driver" prop="driver">
          <el-select v-model="networkForm.driver" style="width: 100%">
            <el-option label="bridge" value="bridge">
              <div class="driver-option">
                <Icon icon="mdi:bridge" />
                <span>bridge - Default bridge network</span>
              </div>
            </el-option>
            <el-option label="host" value="host">
              <div class="driver-option">
                <Icon icon="mdi:server" />
                <span>host - Use host's network stack</span>
              </div>
            </el-option>
            <el-option label="overlay" value="overlay">
              <div class="driver-option">
                <Icon icon="mdi:server-network" />
                <span>overlay - Multi-host networking</span>
              </div>
            </el-option>
            <el-option label="macvlan" value="macvlan">
              <div class="driver-option">
                <Icon icon="mdi:ethernet" />
                <span>macvlan - Assign MAC addresses</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="Subnet" prop="subnet">
          <el-input 
            v-model="networkForm.subnet" 
            placeholder="e.g., 172.20.0.0/16"
          />
          <div class="form-tip">Optional - Leave empty for auto assignment</div>
        </el-form-item>
        
        <el-form-item label="Gateway" prop="gateway">
          <el-input 
            v-model="networkForm.gateway" 
            placeholder="e.g., 172.20.0.1"
          />
          <div class="form-tip">Optional - Required if subnet is specified</div>
        </el-form-item>
        
        <el-form-item label="Options">
          <el-checkbox v-model="networkForm.attachable" label="Attachable" />
          <el-checkbox v-model="networkForm.internal" label="Internal" />
          <el-checkbox v-model="networkForm.ipv6" label="Enable IPv6" />
        </el-form-item>
        
        <el-form-item label="Labels">
          <div class="labels-input">
            <el-input
              v-model="labelKey"
              placeholder="Key"
              style="width: 45%; margin-right: 5%"
            />
            <el-input
              v-model="labelValue"
              placeholder="Value"
              style="width: 45%"
            />
            <el-button 
              @click="addLabel" 
              type="primary" 
              circle 
              size="small"
              :disabled="!labelKey || !labelValue"
            >
              <Icon icon="mdi:plus" />
            </el-button>
          </div>
          <div v-if="networkForm.labels && networkForm.labels.length > 0" class="labels-list">
            <el-tag
              v-for="(label, index) in networkForm.labels"
              :key="index"
              closable
              @close="removeLabel(index)"
              class="label-tag"
            >
              {{ label.key }}: {{ label.value }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="createNetwork"
          :loading="creatingNetwork"
        >
          Create Network
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog inspekcji sieci -->
    <el-dialog 
      v-model="inspectDialogVisible" 
      :title="`Network: ${selectedNetworkName}`"
      width="70%"
      class="inspect-dialog"
    >
      <div v-if="inspectData" class="inspect-content">
        <el-tabs v-model="activeInspectTab">
          <el-tab-pane label="JSON View" name="json">
            <pre class="json-viewer">{{ formatJson(inspectData) }}</pre>
          </el-tab-pane>
          <el-tab-pane label="Tree View" name="tree">
            <div class="tree-view">
              <div class="tree-section">
                <h4>Network Information</h4>
                <div class="tree-item">
                  <span class="tree-key">Name:</span>
                  <span class="tree-value">{{ inspectData.Name }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">ID:</span>
                  <span class="tree-value">{{ inspectData.Id?.substring(0, 12) }}...</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Driver:</span>
                  <span class="tree-value">{{ inspectData.Driver }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Scope:</span>
                  <span class="tree-value">{{ inspectData.Scope }}</span>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.IPAM">
                <h4>IP Address Management</h4>
                <div class="tree-item">
                  <span class="tree-key">Driver:</span>
                  <span class="tree-value">{{ inspectData.IPAM.Driver }}</span>
                </div>
                <div v-if="inspectData.IPAM.Config && inspectData.IPAM.Config.length > 0">
                  <div class="tree-item" v-for="(config, idx) in inspectData.IPAM.Config" :key="idx">
                    <span class="tree-key">Subnet:</span>
                    <span class="tree-value">{{ config.Subnet }}</span>
                    <span v-if="config.Gateway" class="tree-subitem">
                      <span class="tree-key">Gateway:</span>
                      <span class="tree-value">{{ config.Gateway }}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.Containers">
                <h4>Connected Containers ({{ Object.keys(inspectData.Containers).length }})</h4>
                <div class="tree-item" v-for="(container, id) in inspectData.Containers" :key="id">
                  <span class="tree-key">Name:</span>
                  <span class="tree-value">{{ container.Name }}</span>
                  <div class="tree-subitem" v-if="container.IPv4Address">
                    <span class="tree-key">IPv4:</span>
                    <span class="tree-value">{{ container.IPv4Address }}</span>
                  </div>
                  <div class="tree-subitem" v-if="container.MacAddress">
                    <span class="tree-key">MAC:</span>
                    <span class="tree-value">{{ container.MacAddress }}</span>
                  </div>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.Options">
                <h4>Options</h4>
                <div class="tree-item" v-for="(value, key) in inspectData.Options" :key="key">
                  <span class="tree-key">{{ key }}:</span>
                  <span class="tree-value">{{ value }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Containers" name="containers" v-if="inspectData.Containers">
            <el-table :data="Object.values(inspectData.Containers)" size="small">
              <el-table-column prop="Name" label="Container" />
              <el-table-column prop="IPv4Address" label="IPv4 Address" />
              <el-table-column prop="IPv6Address" label="IPv6 Address" />
              <el-table-column prop="MacAddress" label="MAC Address" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
      <div v-else class="loading-inspect">
        <el-skeleton :rows="5" animated />
      </div>
      
      <template #footer>
        <el-button @click="copyInspectData" type="primary">
          <Icon icon="mdi:content-copy" />
          Copy JSON
        </el-button>
        <el-button @click="inspectDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>

    <!-- Dialog łączenia kontenera -->
    <el-dialog v-model="connectDialogVisible" title="Connect Container" width="400px">
      <el-form :model="connectForm" label-width="100px">
        <el-form-item label="Container">
          <el-select 
            v-model="connectForm.containerId" 
            placeholder="Select container"
            style="width: 100%"
          >
            <el-option
              v-for="container in availableContainers"
              :key="container.ID"
              :label="`${container.Names} (${container.Image})`"
              :value="container.ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="IP Address" v-if="selectedNetworkDriver === 'bridge'">
          <el-input v-model="connectForm.ipAddress" placeholder="Optional" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="connectDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="connectContainer">Connect</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { 
  ElMessage, 
  ElMessageBox, 
  ElNotification,
  ElCollapseTransition
} from 'element-plus';

const networks = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterDriver = ref('');
const showCreateDialog = ref(false);
const inspectDialogVisible = ref(false);
const connectDialogVisible = ref(false);
const showQuickActions = ref(false);
const creatingNetwork = ref(false);
const activeInspectTab = ref('json');
const inspectData = ref(null);
const selectedNetworkName = ref('');
const selectedNetworkDriver = ref('');
const availableContainers = ref([]);
const currentPage = ref(1);
const pageSize = ref(20);
const labelKey = ref('');
const labelValue = ref('');
const networkFormRef = ref(null);

const reloadKey = inject('reloadKey');

const networkForm = ref({
  name: '',
  driver: 'bridge',
  subnet: '',
  gateway: '',
  attachable: false,
  internal: false,
  ipv6: false,
  labels: []
});

const connectForm = ref({
  networkId: '',
  containerId: '',
  ipAddress: ''
});

const networkRules = {
  name: [
    { required: true, message: 'Please input network name', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: 'Invalid network name', trigger: 'blur' }
  ],
  driver: [
    { required: true, message: 'Please select driver', trigger: 'change' }
  ]
};

// Obliczone właściwości
const driverStats = computed(() => {
  const stats = {};
  networks.value.forEach(network => {
    stats[network.Driver] = (stats[network.Driver] || 0) + 1;
  });
  return stats;
});

const attachableCount = computed(() => {
  return networks.value.filter(n => n.Attachable === 'true').length;
});

const filteredNetworks = computed(() => {
  let result = networks.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(network => 
      network.Name?.toLowerCase().includes(query) ||
      network.ID?.toLowerCase().includes(query)
    );
  }
  
  if (filterDriver.value) {
    result = result.filter(network => 
      network.Driver === filterDriver.value
    );
  }
  
  return result;
});

const paginatedNetworks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredNetworks.value.slice(start, end);
});

// Metody
const fetchNetworks = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/networks');
    
    if (response.data.success && Array.isArray(response.data.networks)) {
      networks.value = response.data.networks;
      ElMessage.success(`Loaded ${networks.value.length} networks`);
    } else {
      networks.value = [];
      ElMessage.warning('No networks found or invalid response format');
    }
  } catch (error) {
    ElMessage.error('Failed to fetch networks');
    console.error('Network fetch error:', error);
    networks.value = [];
  } finally {
    loading.value = false;
  }
};

const createNetwork = async () => {
  if (!networkFormRef.value) return;
  
  try {
    await networkFormRef.value.validate();
    creatingNetwork.value = true;
    
    const networkData = {
      name: networkForm.value.name,
      driver: networkForm.value.driver,
      attachable: networkForm.value.attachable,
      internal: networkForm.value.internal,
      enableIPv6: networkForm.value.ipv6
    };
    
    // Add optional fields if provided
    if (networkForm.value.subnet) {
      networkData.subnet = networkForm.value.subnet;
    }
    
    if (networkForm.value.gateway) {
      networkData.gateway = networkForm.value.gateway;
    }
    
    if (networkForm.value.labels.length > 0) {
      networkData.labels = networkForm.value.labels.reduce((acc, label) => {
        acc[label.key] = label.value;
        return acc;
      }, {});
    }
    
    await axios.post('/services/docker/networks', networkData);
    
    ElNotification.success({
      title: 'Success',
      message: `Network "${networkForm.value.name}" created successfully`,
      duration: 3000
    });
    
    showCreateDialog.value = false;
    resetNetworkForm();
    await fetchNetworks();
  } catch (error) {
    if (error.name !== 'ValidationError') {
      ElMessage.error(`Failed to create network: ${error.response?.data?.error || error.message}`);
      console.error('Network creation error:', error);
    }
  } finally {
    creatingNetwork.value = false;
  }
};

const deleteNetwork = async (id, name) => {
  try {
    await ElMessageBox.confirm(
      `<div>
        <p><strong>Are you sure you want to delete this network?</strong></p>
        <p>Network: <code>${name}</code></p>
        <p>ID: <code>${id?.substring(0, 12) || id}...</code></p>
        <p class="warning-text">⚠️ This action cannot be undone!</p>
      </div>`,
      'Confirm Deletion',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
        dangerouslyUseHTMLString: true,
        beforeClose: async (action, instance, done) => {
          if (action === 'confirm') {
            instance.confirmButtonLoading = true;
            instance.confirmButtonText = 'Deleting...';
            
            try {
              await axios.delete(`/services/docker/networks/${id}`);
              ElMessage.success('Network deleted successfully');
              done();
              await fetchNetworks();
            } catch (err) {
              ElMessage.error('Failed to delete network');
              console.error(err);
            } finally {
              instance.confirmButtonLoading = false;
            }
          } else {
            done();
          }
        }
      }
    );
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete error:', error);
    }
  }
};

const inspectNetwork = async (id) => {
  try {
    const response = await axios.get(`/services/docker/networks/${id}/inspect`);
    
    if (response.data.success) {
      inspectData.value = response.data.data?.[0] || response.data.data;
      selectedNetworkName.value = inspectData.value?.Name || 'Unknown';
      activeInspectTab.value = 'json';
      inspectDialogVisible.value = true;
    } else {
      ElMessage.error('Failed to inspect network');
    }
  } catch (error) {
    ElMessage.error('Failed to inspect network');
    console.error('Inspect error:', error);
  }
};

const showConnectDialog = async (network) => {
  try {
    selectedNetworkDriver.value = network.Driver;
    connectForm.value.networkId = network.ID;
    
    // Fetch available containers
    const response = await axios.get('/services/docker/containers?all=true');
    if (response.data.success) {
      availableContainers.value = response.data.containers || [];
    }
    
    connectDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to load containers');
    console.error(error);
  }
};

const connectContainer = async () => {
  try {
    await axios.post(`/services/docker/container/${connectForm.value.containerId}/connect-network`, {
      network: connectForm.value.networkId,
      ipAddress: connectForm.value.ipAddress
    });
    
    ElMessage.success('Container connected to network');
    connectDialogVisible.value = false;
    resetConnectForm();
    await fetchNetworks();
  } catch (error) {
    ElMessage.error('Failed to connect container');
    console.error(error);
  }
};

const disconnectAllContainers = async (network) => {
  try {
    await ElMessageBox.confirm(
      `Disconnect all containers from network "${network.Name}"?`,
      'Confirm Disconnect',
      {
        confirmButtonText: 'Disconnect',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    // Note: You'll need to add this endpoint to your backend
    await axios.post(`/services/docker/networks/${network.ID}/disconnect-all`);
    ElMessage.success('All containers disconnected');
    await fetchNetworks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to disconnect containers');
      console.error(error);
    }
  }
};

const pruneUnusedNetworks = async () => {
  try {
    await ElMessageBox.confirm(
      'Remove all unused networks?',
      'Confirm Prune',
      {
        confirmButtonText: 'Prune',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    // Note: You'll need to add this endpoint to your backend
    await axios.post('/services/docker/networks/prune');
    ElMessage.success('Unused networks pruned successfully');
    await fetchNetworks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to prune networks');
      console.error(error);
    }
  }
};

const exportNetworks = () => {
  const dataStr = JSON.stringify(networks.value, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `docker-networks-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  
  ElMessage.success('Networks exported successfully');
};

const showAllNetworks = () => {
  filterDriver.value = '';
  searchQuery.value = '';
  currentPage.value = 1;
  ElMessage.info('Showing all networks');
};

const copyInspectData = () => {
  const text = JSON.stringify(inspectData.value, null, 2);
  navigator.clipboard.writeText(text)
    .then(() => {
      ElMessage.success('JSON copied to clipboard');
    })
    .catch(err => {
      console.error('Clipboard error:', err);
      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      ElMessage.success('JSON copied to clipboard');
    });
};

const addLabel = () => {
  if (labelKey.value && labelValue.value) {
    networkForm.value.labels.push({
      key: labelKey.value,
      value: labelValue.value
    });
    labelKey.value = '';
    labelValue.value = '';
  }
};

const removeLabel = (index) => {
  networkForm.value.labels.splice(index, 1);
};

const resetNetworkForm = () => {
  networkForm.value = {
    name: '',
    driver: 'bridge',
    subnet: '',
    gateway: '',
    attachable: false,
    internal: false,
    ipv6: false,
    labels: []
  };
  if (networkFormRef.value) {
    networkFormRef.value.clearValidate();
  }
};

const resetConnectForm = () => {
  connectForm.value = {
    networkId: '',
    containerId: '',
    ipAddress: ''
  };
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
};

const formatJson = (data) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const getNetworkIcon = (driver) => {
  const icons = {
    bridge: 'mdi:bridge',
    host: 'mdi:server',
    overlay: 'mdi:server-network',
    macvlan: 'mdi:ethernet',
    default: 'mdi:lan'
  };
  return icons[driver] || icons.default;
};

const getDriverTagType = (driver) => {
  const types = {
    bridge: 'primary',
    host: 'success',
    overlay: 'warning',
    macvlan: 'info',
    default: ''
  };
  return types[driver] || types.default;
};

const tableRowClassName = ({ row }) => {
  if (row.Internal === 'true') return 'internal-row';
  if (row.Attachable === 'true') return 'attachable-row';
  return '';
};

const handleRowClick = (row) => {
  inspectNetwork(row.ID);
};

const handleSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const handleCurrentChange = (page) => {
  currentPage.value = page;
};

// Watch i lifecycle hooks
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
  background: #f8f9fa;
  min-height: calc(100vh - 120px);
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 10px;
  border: none;
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
  padding: 10px;
}

.stat-icon {
  font-size: 2.5rem;
  margin-right: 15px;
  padding: 10px;
  border-radius: 50%;
}

.network-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.bridge-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.overlay-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.attachable-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  font-size: 0.9rem;
  color: #7f8c8d;
}

.search-card, .table-card {
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
}

.search-card {
  background: white;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.search-section {
  display: flex;
  gap: 10px;
  flex: 1;
  min-width: 300px;
}

.search-input, .filter-select {
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.search-icon {
  color: #909399;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn {
  border-radius: 8px;
  padding: 10px 20px;
}

.quick-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.quick-buttons {
  display: flex;
  gap: 10px;
}

.table-card {
  min-height: 400px;
}

.network-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-type-icon {
  font-size: 1.2rem;
  color: #409eff;
}

.network-type-icon.bridge { color: #f56c6c; }
.network-type-icon.host { color: #67c23a; }
.network-type-icon.overlay { color: #e6a23c; }
.network-type-icon.macvlan { color: #909399; }

.name-text {
  font-weight: 500;
}

.tag {
  margin-left: 5px;
}

.network-id {
  font-family: 'Courier New', monospace;
  color: #666;
  font-size: 0.9rem;
}

.container-badge {
  margin-top: 5px;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.action-buttons button {
  width: 32px;
  height: 32px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.no-data {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.no-data-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.driver-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.labels-input {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
}

.labels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.label-tag {
  margin: 2px;
}

.form-tip {
  font-size: 0.8rem;
  color: #999;
  margin-top: 5px;
}

.inspect-dialog {
  max-width: 90%;
}

.inspect-content {
  max-height: 60vh;
  overflow: auto;
}

.json-viewer {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
  overflow: auto;
  max-height: 50vh;
}

.loading-inspect {
  padding: 20px;
}

.warning-text {
  color: #f56c6c;
  font-weight: bold;
  margin-top: 10px;
}

.tree-view {
  padding: 10px;
}

.tree-section {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.tree-section h4 {
  margin-bottom: 10px;
  color: #409eff;
  font-weight: 500;
}

.tree-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  padding: 5px;
  background: #f8f9fa;
  border-radius: 4px;
}

.tree-key {
  font-weight: 600;
  color: #2c3e50;
  min-width: 100px;
  margin-right: 10px;
}

.tree-value {
  flex: 1;
  color: #34495e;
  word-break: break-all;
}

.tree-subitem {
  margin-left: 20px;
  margin-top: 4px;
  padding-left: 10px;
  border-left: 2px solid #e0e0e0;
}

/* Custom row styles */
:deep(.internal-row) {
  background-color: #f0f9ff !important;
}

:deep(.attachable-row) {
  background-color: #f0fff4 !important;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa !important;
  cursor: pointer;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-section {
    min-width: 100%;
  }
  
  .actions {
    width: 100%;
    justify-content: center;
  }
  
  .stats-row .el-col {
    margin-bottom: 10px;
  }
}
</style>
