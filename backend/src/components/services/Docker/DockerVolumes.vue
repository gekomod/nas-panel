<template>
  <div class="docker-volumes">
    <!-- Nagłówek z statystykami -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:database" class="stat-icon volume-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ volumes.length }}</div>
              <div class="stat-label">Total Volumes</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:harddisk" class="stat-icon local-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ driverStats.local || 0 }}</div>
              <div class="stat-label">Local Volumes</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:server-network" class="stat-icon nfs-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ driverStats.nfs || 0 }}</div>
              <div class="stat-label">NFS Volumes</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon icon="mdi:chart-pie" class="stat-icon size-icon" />
            <div class="stat-info">
              <div class="stat-value">{{ formatSize(totalSize) }}</div>
              <div class="stat-label">Total Size</div>
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
            placeholder="Search volumes by name or driver..."
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
            <el-option label="Local" value="local" />
            <el-option label="NFS" value="nfs" />
            <el-option label="Other" value="other" />
          </el-select>
        </div>

        <div class="actions">
          <el-button 
            type="primary" 
            @click="fetchVolumes"
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
            Create Volume
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
            <el-button @click="pruneUnusedVolumes" size="small">
              <Icon icon="mdi:delete-sweep" />
              Prune Unused
            </el-button>
            <el-button @click="exportVolumes" size="small">
              <Icon icon="mdi:export" />
              Export JSON
            </el-button>
            <el-button @click="showAllVolumes" size="small">
              <Icon icon="mdi:eye" />
              Show All Details
            </el-button>
          </el-button-group>
        </div>
      </el-collapse-transition>
    </el-card>

    <!-- Tabela woluminów -->
    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="paginatedVolumes"
        style="width: 100%"
        stripe
        border
        :default-sort="{ prop: 'Name', order: 'ascending' }"
        :row-class-name="tableRowClassName"
        @row-click="handleRowClick"
      >
        <el-table-column prop="Name" label="Volume Name" sortable width="200">
          <template #default="{ row }">
            <div class="volume-name-cell">
              <Icon 
                :icon="getVolumeIcon(row.Driver)" 
                class="volume-type-icon"
                :class="row.Driver"
              />
              <span class="name-text">{{ row.Name }}</span>
              <el-tag 
                v-if="isAnonymous(row)" 
                size="small" 
                type="info"
                class="tag"
              >
                Anonymous
              </el-tag>
            </div>
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
        
        <el-table-column prop="Mountpoint" label="Mount Point" sortable>
          <template #default="{ row }">
            <div class="mountpoint-cell">
              <code class="mountpoint-text">{{ truncatePath(row.Mountpoint) }}</code>
              <el-tooltip content="Copy path" placement="top">
                <el-button
                  size="small"
                  text
                  @click.stop="copyToClipboard(row.Mountpoint)"
                >
                  <Icon icon="mdi:content-copy" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="Size" width="120" align="right">
          <template #default="{ row }">
            {{ formatVolumeSize(row) }}
          </template>
        </el-table-column>
        
        <el-table-column label="Created" width="150">
          <template #default="{ row }">
            {{ formatDate(row.CreatedAt) }}
          </template>
        </el-table-column>
        
        <el-table-column label="Containers" width="100" align="center">
          <template #default="{ row }">
            <el-badge :value="getContainerCount(row)" :max="99" class="container-badge">
              <Icon icon="mdi:docker" />
            </el-badge>
          </template>
        </el-table-column>
        
        <el-table-column label="Actions" width="200" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip content="Inspect" placement="top">
                <el-button
                  size="small"
                  type="primary"
                  @click.stop="inspectVolume(row.Name)"
                  circle
                >
                  <Icon icon="mdi:information" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Browse Files" placement="top" v-if="row.Driver === 'local'">
                <el-button
                  size="small"
                  type="warning"
                  @click.stop="browseVolume(row)"
                  circle
                >
                  <Icon icon="mdi:folder-open" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Mount Info" placement="top">
                <el-button
                  size="small"
                  type="info"
                  @click.stop="showMountInfo(row)"
                  circle
                >
                  <Icon icon="mdi:link" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Delete" placement="top">
                <el-button
                  size="small"
                  type="danger"
                  @click.stop="deleteVolume(row.Name)"
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
      <div class="pagination-container" v-if="filteredVolumes.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredVolumes.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <!-- No data message -->
      <div v-if="filteredVolumes.length === 0" class="no-data">
        <Icon icon="mdi:database-remove" class="no-data-icon" />
        <p>No volumes found</p>
        <el-button type="primary" @click="showCreateDialog = true">
          Create Your First Volume
        </el-button>
      </div>
    </el-card>

    <!-- Dialog tworzenia woluminu -->
    <el-dialog 
      v-model="showCreateDialog" 
      title="Create New Volume" 
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form 
        :model="volumeForm" 
        label-width="140px" 
        :rules="volumeRules"
        ref="volumeFormRef"
      >
        <el-form-item label="Volume Name" prop="name">
          <el-input 
            v-model="volumeForm.name" 
            placeholder="e.g., my-app-data"
            clearable
          />
          <div class="form-tip">Leave empty for anonymous volume</div>
        </el-form-item>
        
        <el-form-item label="Driver" prop="driver">
          <el-select v-model="volumeForm.driver" style="width: 100%" @change="handleDriverChange">
            <el-option label="local - Default local storage" value="local">
              <div class="driver-option">
                <Icon icon="mdi:harddisk" />
                <span>local - Default local storage</span>
              </div>
            </el-option>
            <el-option label="nfs - Network File System" value="nfs">
              <div class="driver-option">
                <Icon icon="mdi:server-network" />
                <span>nfs - Network File System</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <!-- Local driver options -->
        <template v-if="volumeForm.driver === 'local'">
          <el-form-item label="Storage Driver">
            <el-select v-model="volumeForm.options.type" placeholder="Select storage driver">
              <el-option label="Default" value="" />
              <el-option label="btrfs" value="btrfs" />
              <el-option label="zfs" value="zfs" />
              <el-option label="overlay2" value="overlay2" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="Device">
            <el-input 
              v-model="volumeForm.options.device" 
              placeholder="e.g., /dev/sdb1"
            />
            <div class="form-tip">Optional - Block device for volume</div>
          </el-form-item>
          
          <el-form-item label="Size Limit">
            <el-input 
              v-model="volumeForm.options.size" 
              placeholder="e.g., 10G"
            />
            <div class="form-tip">Optional - Size limit (e.g., 10G, 500M)</div>
          </el-form-item>
        </template>
        
        <!-- NFS driver options -->
        <template v-if="volumeForm.driver === 'nfs'">
          <el-form-item label="NFS Server" prop="options.server">
            <el-input 
              v-model="volumeForm.options.server" 
              placeholder="e.g., 192.168.1.100 or nfs-server.local"
            />
          </el-form-item>
          
          <el-form-item label="NFS Path" prop="options.path">
            <el-input 
              v-model="volumeForm.options.path" 
              placeholder="e.g., /exports/data"
            />
          </el-form-item>
          
          <el-form-item label="NFS Version">
            <el-select v-model="volumeForm.options.nfsvers" placeholder="Select NFS version">
              <el-option label="NFSv3" value="3" />
              <el-option label="NFSv4" value="4" />
              <el-option label="NFSv4.1" value="4.1" />
              <el-option label="NFSv4.2" value="4.2" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="Mount Options">
            <el-input 
              v-model="volumeForm.options.o" 
              placeholder="e.g., rw,noatime,hard,nolock"
            />
            <div class="form-tip">Additional mount options separated by commas</div>
          </el-form-item>
        </template>
        
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
          <div v-if="volumeForm.labels && volumeForm.labels.length > 0" class="labels-list">
            <el-tag
              v-for="(label, index) in volumeForm.labels"
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
          @click="createVolume"
          :loading="creatingVolume"
        >
          Create Volume
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog inspekcji woluminu -->
    <el-dialog 
      v-model="inspectDialogVisible" 
      :title="`Volume: ${selectedVolumeName}`"
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
                <h4>Volume Information</h4>
                <div class="tree-item">
                  <span class="tree-key">Name:</span>
                  <span class="tree-value">{{ inspectData.Name }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Driver:</span>
                  <span class="tree-value">{{ inspectData.Driver }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Mountpoint:</span>
                  <span class="tree-value">{{ inspectData.Mountpoint }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Created:</span>
                  <span class="tree-value">{{ formatDate(inspectData.CreatedAt) }}</span>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.Options && Object.keys(inspectData.Options).length > 0">
                <h4>Options</h4>
                <div class="tree-item" v-for="(value, key) in inspectData.Options" :key="key">
                  <span class="tree-key">{{ key }}:</span>
                  <span class="tree-value">{{ value }}</span>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.Labels && Object.keys(inspectData.Labels).length > 0">
                <h4>Labels</h4>
                <div class="tree-item" v-for="(value, key) in inspectData.Labels" :key="key">
                  <span class="tree-key">{{ key }}:</span>
                  <span class="tree-value">{{ value }}</span>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.UsageData">
                <h4>Usage Data</h4>
                <div class="tree-item">
                  <span class="tree-key">Size:</span>
                  <span class="tree-value">{{ formatSize(inspectData.UsageData.Size) }}</span>
                </div>
                <div class="tree-item">
                  <span class="tree-key">Ref Count:</span>
                  <span class="tree-value">{{ inspectData.UsageData.RefCount }}</span>
                </div>
              </div>
              
              <div class="tree-section" v-if="inspectData.Status">
                <h4>Status</h4>
                <div class="tree-item" v-for="(value, key) in inspectData.Status" :key="key">
                  <span class="tree-key">{{ key }}:</span>
                  <span class="tree-value">{{ value }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Mount Info" name="mount" v-if="mountInfoData">
            <el-table :data="mountInfoData" size="small">
              <el-table-column prop="container" label="Container" />
              <el-table-column prop="source" label="Source" />
              <el-table-column prop="destination" label="Destination" />
              <el-table-column prop="mode" label="Mode" />
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

    <!-- Dialog informacji o montowaniu -->
    <el-dialog 
      v-model="mountInfoDialogVisible" 
      :title="`Mount Info: ${selectedVolumeName}`"
      width="800px"
    >
      <el-table :data="mountInfoData" stripe border>
        <el-table-column prop="containerName" label="Container" width="200">
          <template #default="{ row }">
            <div class="container-cell">
              <Icon icon="madi:docker" class="container-icon" />
              <span>{{ row.containerName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="Source" />
        <el-table-column prop="destination" label="Destination" />
        <el-table-column prop="mode" label="Mode" width="100">
          <template #default="{ row }">
            <el-tag :type="row.mode === 'rw' ? 'success' : 'info'">
              {{ row.mode }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="100">
          <template #default="{ row }">
            <el-button 
              size="small" 
              @click="inspectContainer(row.containerId)"
              type="primary"
            >
              <Icon icon="mdi:information" />
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Dialog przeglądania plików -->
    <el-dialog 
      v-model="browseDialogVisible" 
      :title="`Browse: ${browsingVolumeName}`"
      width="80%"
      height="70vh"
      class="browse-dialog"
    >
      <div v-if="browsingVolume" class="browse-container">
        <div class="browser-toolbar">
          <el-button @click="refreshFileBrowser" size="small">
            <Icon icon="mdi:refresh" />
            Refresh
          </el-button>
          <el-button @click="createFolder" size="small">
            <Icon icon="mdi:folder-plus" />
            New Folder
          </el-button>
          <el-button @click="uploadFile" size="small">
            <Icon icon="mdi:upload" />
            Upload File
          </el-button>
          <el-input
            v-model="fileSearch"
            placeholder="Search files..."
            size="small"
            style="width: 200px"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" />
            </template>
          </el-input>
        </div>
        
        <div class="path-bar">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item 
              v-for="(part, index) in currentPath.split('/').filter(Boolean)" 
              :key="index"
              @click="navigateToPath(part, index)"
            >
              {{ part }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="file-browser">
          <div v-if="filesLoading" class="loading-files">
            <el-skeleton :rows="3" animated />
          </div>
          <div v-else-if="files.length === 0" class="empty-folder">
            <Icon icon="mdi:folder-open-outline" class="empty-icon" />
            <p>Folder is empty</p>
          </div>
          <div v-else class="file-grid">
            <div 
              v-for="file in filteredFiles" 
              :key="file.name"
              class="file-item"
              :class="{ 'is-directory': file.isDirectory }"
              @dblclick="handleFileDblClick(file)"
              @contextmenu.prevent="showFileContextMenu($event, file)"
            >
              <div class="file-icon">
                <Icon 
                  :icon="getFileIcon(file)" 
                  class="file-type-icon"
                />
              </div>
              <div class="file-info">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-size">{{ formatFileSize(file.size) }}</div>
                <div class="file-modified">{{ formatDate(file.modified) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="loading-browse">
        <el-skeleton :rows="5" animated />
      </div>
      
      <template #footer>
        <el-button @click="browseDialogVisible = false">Close</el-button>
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

const volumes = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const filterDriver = ref('');
const showCreateDialog = ref(false);
const inspectDialogVisible = ref(false);
const mountInfoDialogVisible = ref(false);
const browseDialogVisible = ref(false);
const showQuickActions = ref(false);
const creatingVolume = ref(false);
const activeInspectTab = ref('json');
const inspectData = ref(null);
const mountInfoData = ref([]);
const selectedVolumeName = ref('');
const browsingVolumeName = ref('');
const browsingVolume = ref(null);
const currentPage = ref(1);
const pageSize = ref(20);
const labelKey = ref('');
const labelValue = ref('');
const volumeFormRef = ref(null);
const currentPath = ref('/');
const files = ref([]);
const filesLoading = ref(false);
const fileSearch = ref('');

const reloadKey = inject('reloadKey');

const volumeForm = ref({
  name: '',
  driver: 'local',
  options: {
    type: '',
    device: '',
    size: '',
    server: '',
    path: '',
    nfsvers: '4',
    o: 'rw,noatime,hard,nolock'
  },
  labels: []
});

const volumeRules = {
  name: [
    { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: 'Invalid volume name', trigger: 'blur' }
  ]
};

// Obliczone właściwości
const driverStats = computed(() => {
  const stats = {};
  volumes.value.forEach(volume => {
    stats[volume.Driver] = (stats[volume.Driver] || 0) + 1;
  });
  return stats;
});

const totalSize = computed(() => {
  return volumes.value.reduce((sum, volume) => {
    return sum + (parseInt(volume.UsageData?.Size) || 0);
  }, 0);
});

const filteredVolumes = computed(() => {
  let result = volumes.value;
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(volume => 
      volume.Name?.toLowerCase().includes(query) ||
      volume.Driver?.toLowerCase().includes(query) ||
      volume.Mountpoint?.toLowerCase().includes(query)
    );
  }
  
  if (filterDriver.value) {
    if (filterDriver.value === 'other') {
      result = result.filter(volume => 
        volume.Driver !== 'local' && volume.Driver !== 'nfs'
      );
    } else {
      result = result.filter(volume => 
        volume.Driver === filterDriver.value
      );
    }
  }
  
  return result;
});

const paginatedVolumes = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredVolumes.value.slice(start, end);
});

const filteredFiles = computed(() => {
  if (!fileSearch.value) return files.value;
  const query = fileSearch.value.toLowerCase();
  return files.value.filter(file => 
    file.name.toLowerCase().includes(query)
  );
});

// Metody
const fetchVolumes = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/volumes');
    
    if (response.data.success && Array.isArray(response.data.volumes)) {
      volumes.value = response.data.volumes;
      ElMessage.success(`Loaded ${volumes.value.length} volumes`);
    } else {
      volumes.value = [];
      ElMessage.warning('No volumes found or invalid response format');
    }
  } catch (error) {
    ElMessage.error('Failed to fetch volumes');
    console.error('Volume fetch error:', error);
    volumes.value = [];
  } finally {
    loading.value = false;
  }
};

const createVolume = async () => {
  try {
    creatingVolume.value = true;
    
    const volumeData = {
      name: volumeForm.value.name || undefined,
      driver: volumeForm.value.driver
    };
    
    // Add options based on driver
    if (volumeForm.value.driver === 'nfs') {
      volumeData.driver_opts = {
        type: 'nfs',
        device: `:${volumeForm.value.options.path}`,
        o: `addr=${volumeForm.value.options.server},nfsvers=${volumeForm.value.options.nfsvers}${volumeForm.value.options.o ? ',' + volumeForm.value.options.o : ''}`
      };
    } else if (volumeForm.value.driver === 'local') {
      const opts = {};
      if (volumeForm.value.options.type) opts.type = volumeForm.value.options.type;
      if (volumeForm.value.options.device) opts.device = volumeForm.value.options.device;
      if (volumeForm.value.options.size) opts.size = volumeForm.value.options.size;
      
      if (Object.keys(opts).length > 0) {
        volumeData.driver_opts = opts;
      }
    }
    
    // Add labels
    if (volumeForm.value.labels.length > 0) {
      volumeData.driver_opts = volumeData.driver_opts || {};
      volumeData.driver_opts.labels = volumeForm.value.labels.reduce((acc, label) => {
        acc[label.key] = label.value;
        return acc;
      }, {});
    }
    
    await axios.post('/services/docker/volumes', volumeData);
    
    ElNotification.success({
      title: 'Success',
      message: volumeForm.value.name 
        ? `Volume "${volumeForm.value.name}" created successfully`
        : 'Anonymous volume created successfully',
      duration: 3000
    });
    
    showCreateDialog.value = false;
    resetVolumeForm();
    await fetchVolumes();
  } catch (error) {
    ElMessage.error(`Failed to create volume: ${error.response?.data?.error || error.message}`);
    console.error('Volume creation error:', error);
  } finally {
    creatingVolume.value = false;
  }
};

const deleteVolume = async (name) => {
  try {
    await ElMessageBox.confirm(
      `<div>
        <p><strong>Are you sure you want to delete this volume?</strong></p>
        <p>Volume: <code>${name}</code></p>
        <p class="warning-text">⚠️ This will permanently delete all data in the volume!</p>
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
              await axios.delete(`/services/docker/volumes/${name}`);
              ElMessage.success('Volume deleted successfully');
              done();
              await fetchVolumes();
            } catch (err) {
              ElMessage.error('Failed to delete volume');
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

const inspectVolume = async (name) => {
  try {
    const response = await axios.get(`/services/docker/volumes/${name}/inspect`);
    
    if (response.data.success) {
      inspectData.value = response.data.data?.[0] || response.data.data;
      selectedVolumeName.value = inspectData.value?.Name || name;
      activeInspectTab.value = 'json';
      inspectDialogVisible.value = true;
    } else {
      ElMessage.error('Failed to inspect volume');
    }
  } catch (error) {
    ElMessage.error('Failed to inspect volume');
    console.error('Inspect error:', error);
  }
};

const showMountInfo = async (volume) => {
  try {
    selectedVolumeName.value = volume.Name;
    
    // Użyj nowego endpointu
    const response = await axios.get(`/services/docker/volumes/${volume.Name}/mounts`);
    if (response.data.success) {
      mountInfoData.value = response.data.mounts;
      mountInfoDialogVisible.value = true;
    } else {
      ElMessage.error('Failed to get mount information');
    }
  } catch (error) {
    ElMessage.error('Failed to get mount information');
    console.error(error);
  }
};

const browseVolume = async (volume) => {
  if (volume.Driver !== 'local') {
    ElMessage.warning('File browser only available for local volumes');
    return;
  }
  
  browsingVolumeName.value = volume.Name;
  browsingVolume.value = volume;
  currentPath.value = '/';
  files.value = [];
  browseDialogVisible.value = true;
  
  await loadFiles();
};

const loadFiles = async () => {
  if (!browsingVolume.value) return;
  
  try {
    filesLoading.value = true;
    const response = await axios.get(`/services/docker/volumes/${browsingVolumeName.value}/browse`, {
      params: { path: currentPath.value }
    });
    
    if (response.data.success) {
      files.value = response.data.files || [];
      // Możesz też zapisać mountpoint jeśli potrzebujesz
      // mountpoint.value = response.data.mountpoint;
    } else {
      ElMessage.error('Failed to load files');
    }
  } catch (error) {
    ElMessage.error('Failed to load files');
    console.error(error);
  } finally {
    filesLoading.value = false;
  }
};

const deleteFile = async (file) => {
  try {
    const filePath = currentPath.value + (currentPath.value.endsWith('/') ? '' : '/') + file.name;
    
    await ElMessageBox.confirm(
      `Delete ${file.isDirectory ? 'directory' : 'file'} "${file.name}"?`,
      'Confirm Delete',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    await axios.delete(`/services/docker/volumes/${browsingVolumeName.value}/delete`, {
      data: {
        path: filePath,
        recursive: file.isDirectory
      }
    });
    
    ElMessage.success(`${file.isDirectory ? 'Directory' : 'File'} deleted successfully`);
    await loadFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete');
      console.error(error);
    }
  }
};

const createFolder = async () => {
  ElMessageBox.prompt('Enter folder name', 'Create Folder', {
    confirmButtonText: 'Create',
    cancelButtonText: 'Cancel',
    inputPattern: /^[a-zA-Z0-9 _.-]+$/,
    inputErrorMessage: 'Invalid folder name'
  }).then(async ({ value }) => {
    if (value) {
      try {
        const folderPath = currentPath.value + (currentPath.value.endsWith('/') ? '' : '/') + value;
        await axios.post(`/services/docker/volumes/${browsingVolumeName.value}/mkdir`, {
          path: folderPath
        });
        
        ElMessage.success('Folder created successfully');
        await loadFiles();
      } catch (error) {
        ElMessage.error('Failed to create folder');
        console.error(error);
      }
    }
  });
};

const pruneUnusedVolumes = async () => {
  try {
    await ElMessageBox.confirm(
      'Remove all unused volumes? This will delete all data in unused volumes!',
      'Confirm Prune',
      {
        confirmButtonText: 'Prune',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    const response = await axios.post('/services/docker/volumes/prune');
    if (response.data.success) {
      ElMessage.success(`Unused volumes pruned. Reclaimed space: ${response.data.deletedSpace}`);
      await fetchVolumes();
    } else {
      ElMessage.error('Failed to prune volumes');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to prune volumes');
      console.error(error);
    }
  }
};

const exportVolumes = () => {
  const dataStr = JSON.stringify(volumes.value, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `docker-volumes-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  
  ElMessage.success('Volumes exported successfully');
};

const showAllVolumes = () => {
  filterDriver.value = '';
  searchQuery.value = '';
  currentPage.value = 1;
  ElMessage.info('Showing all volumes');
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

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      ElMessage.success('Path copied to clipboard');
    })
    .catch(err => {
      console.error('Clipboard error:', err);
    });
};

const addLabel = () => {
  if (labelKey.value && labelValue.value) {
    volumeForm.value.labels.push({
      key: labelKey.value,
      value: labelValue.value
    });
    labelKey.value = '';
    labelValue.value = '';
  }
};

const removeLabel = (index) => {
  volumeForm.value.labels.splice(index, 1);
};

const resetVolumeForm = () => {
  volumeForm.value = {
    name: '',
    driver: 'local',
    options: {
      type: '',
      device: '',
      size: '',
      server: '',
      path: '',
      nfsvers: '4',
      o: 'rw,noatime,hard,nolock'
    },
    labels: []
  };
  if (volumeFormRef.value) {
    volumeFormRef.value.clearValidate();
  }
};

const handleDriverChange = (driver) => {
  // Reset options when driver changes
  if (driver === 'local') {
    volumeForm.value.options = {
      type: '',
      device: '',
      size: '',
      server: '',
      path: '',
      nfsvers: '4',
      o: 'rw,noatime,hard,nolock'
    };
  } else if (driver === 'nfs') {
    volumeForm.value.options = {
      type: '',
      device: '',
      size: '',
      server: '',
      path: '',
      nfsvers: '4',
      o: 'rw,noatime,hard,nolock'
    };
  }
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

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatFileSize = (bytes) => {
  return formatSize(bytes);
};

const formatVolumeSize = (volume) => {
  if (volume.UsageData?.Size) {
    return formatSize(parseInt(volume.UsageData.Size));
  }
  return 'Unknown';
};

const formatJson = (data) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const getVolumeIcon = (driver) => {
  const icons = {
    local: 'mdi:harddisk',
    nfs: 'mdi:server-network',
    default: 'mdi:database'
  };
  return icons[driver] || icons.default;
};

const getDriverTagType = (driver) => {
  const types = {
    local: 'primary',
    nfs: 'success',
    default: 'info'
  };
  return types[driver] || types.default;
};

const getFileIcon = (file) => {
  if (file.isDirectory) return 'mdi:folder';
  if (file.name.match(/\.(jpg|jpeg|png|gif|svg)$/i)) return 'mdi:image';
  if (file.name.match(/\.(mp4|avi|mov|mkv)$/i)) return 'mdi:video';
  if (file.name.match(/\.(mp3|wav|flac)$/i)) return 'mdi:music';
  if (file.name.match(/\.(pdf)$/i)) return 'mdi:file-pdf';
  if (file.name.match(/\.(txt|md)$/i)) return 'mdi:file-document';
  if (file.name.match(/\.(zip|tar|gz|rar)$/i)) return 'mdi:zip-box';
  return 'mdi:file';
};

const tableRowClassName = ({ row }) => {
  if (isAnonymous(row)) return 'anonymous-row';
  return '';
};

const handleRowClick = (row) => {
  inspectVolume(row.Name);
};

const handleSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const handleCurrentChange = (page) => {
  currentPage.value = page;
};

const isAnonymous = (volume) => {
  return !volume.Name || volume.Name.startsWith('anonymous');
};

const getContainerCount = (volume) => {
  return volume.UsageData?.RefCount || 0;
};

const truncatePath = (path) => {
  if (!path) return '';
  if (path.length <= 50) return path;
  return '...' + path.substring(path.length - 47);
};

const refreshFileBrowser = () => {
  loadFiles();
};

const uploadFile = () => {
  // Implement file upload
  ElMessage.info('File upload functionality coming soon');
};

const navigateToPath = (part, index) => {
  const parts = currentPath.value.split('/').filter(Boolean);
  const newPath = '/' + parts.slice(0, index + 1).join('/');
  currentPath.value = newPath;
  loadFiles();
};

const handleFileDblClick = (file) => {
  if (file.isDirectory) {
    currentPath.value = currentPath.value + (currentPath.value.endsWith('/') ? '' : '/') + file.name;
    loadFiles();
  }
};

const showFileContextMenu = (event, file) => {
  // Implement context menu
  console.log('Context menu for:', file.name);
};

const inspectContainer = (containerId) => {
  // Implement container inspection navigation
  ElMessage.info(`Inspect container ${containerId}`);
};

// Watch i lifecycle hooks
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

.volume-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.local-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.nfs-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.size-icon {
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

.volume-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-type-icon {
  font-size: 1.2rem;
  color: #409eff;
}

.volume-type-icon.local { color: #f56c6c; }
.volume-type-icon.nfs { color: #67c23a; }

.name-text {
  font-weight: 500;
}

.tag {
  margin-left: 5px;
}

.mountpoint-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mountpoint-text {
  font-family: 'Courier New', monospace;
  color: #666;
  font-size: 0.9rem;
  flex: 1;
  word-break: break-all;
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
  min-width: 120px;
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

.container-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.container-icon {
  color: #409eff;
}

/* Browse dialog styles */
.browse-dialog {
  min-height: 70vh;
}

.browse-container {
  height: 60vh;
  display: flex;
  flex-direction: column;
}

.browser-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.path-bar {
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.file-browser {
  flex: 1;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 10px;
}

.loading-files, .empty-folder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.file-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: #f5f7fa;
  border-color: #409eff;
  transform: translateY(-2px);
}

.file-item.is-directory {
  border-color: #409eff;
  background: #f0f9ff;
}

.file-icon {
  text-align: center;
  margin-bottom: 8px;
}

.file-type-icon {
  font-size: 2rem;
  color: #409eff;
}

.file-item.is-directory .file-type-icon {
  color: #f56c6c;
}

.file-info {
  text-align: center;
}

.file-name {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
  word-break: break-all;
}

.file-size, .file-modified {
  font-size: 0.8rem;
  color: #666;
}

/* Custom row styles */
:deep(.anonymous-row) {
  background-color: #fff7e6 !important;
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
  
  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style>
