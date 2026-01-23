<template>
  <div class="docker-images">
    <!-- Enhanced Header -->
    <div class="clean-header">
      <div class="header-left">
        <h2>
          <el-icon><Icon icon="mdi:image-multiple" /></el-icon>
          Docker Images
          <el-tag v-if="filteredImages.length > 0" type="info" size="small" class="ml-2">
            {{ filteredImages.length }} images
          </el-tag>
          <el-tag v-if="stats.totalSize" type="warning" size="small" class="ml-2">
            {{ formatFileSize(stats.totalSize) }}
          </el-tag>
        </h2>
      </div>
      
      <div class="header-right">
        <el-input
          v-model="searchQuery"
          placeholder="Search images..."
          clearable
          size="small"
          style="width: 300px"
          @clear="fetchImages"
        >
          <template #prefix>
            <el-icon><Icon icon="mdi:magnify" /></el-icon>
          </template>
        </el-input>

        <div class="header-actions">
          <el-tooltip content="Refresh" placement="top">
            <el-button 
              type="info" 
              @click="fetchImages" 
              size="small"
              :loading="loading"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Pull Image" placement="top">
            <el-button 
              type="primary" 
              @click="showPullDialog = true" 
              size="small"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:download" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Registry Login" placement="top">
            <el-button 
              type="success" 
              @click="showRegistryDialog = true" 
              size="small"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:login" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Clean Up" placement="top">
            <el-button 
              type="warning" 
              @click="showCleanupDialog = true" 
              size="small"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:broom" /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-cards" v-if="stats.totalImages > 0">
      <el-card shadow="never" class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon"><Icon icon="mdi:image-multiple" /></el-icon>
          <div class="stat-details">
            <div class="stat-value">{{ stats.totalImages }}</div>
            <div class="stat-label">Total Images</div>
          </div>
        </div>
      </el-card>
      
      <el-card shadow="never" class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon"><Icon icon="mdi:harddisk" /></el-icon>
          <div class="stat-details">
            <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
            <div class="stat-label">Total Size</div>
          </div>
        </div>
      </el-card>
      
      <el-card shadow="never" class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon"><Icon icon="mdi:tag-multiple" /></el-icon>
          <div class="stat-details">
            <div class="stat-value">{{ stats.totalTags }}</div>
            <div class="stat-label">Tags</div>
          </div>
        </div>
      </el-card>
      
      <el-card shadow="never" class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon"><Icon icon="mdi:update" /></el-icon>
          <div class="stat-details">
            <div class="stat-value">{{ stats.autoUpdateCount }}</div>
            <div class="stat-label">Auto-update</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Main Table -->
    <div class="table-wrapper">
      <el-card shadow="never" class="clean-table-card" :class="{ 'empty': filteredImages.length === 0 }">
        <div v-if="filteredImages.length === 0 && !loading" class="empty-state">
          <el-icon size="64" class="empty-icon"><Icon icon="mdi:image-off" /></el-icon>
          <h3>No Docker images found</h3>
          <p>Pull your first Docker image to get started</p>
          <el-button type="primary" @click="showPullDialog = true" size="small" class="create-btn">
            <el-icon><Icon icon="mdi:download" /></el-icon>
            Pull your first image
          </el-button>
        </div>
        
        <div v-else class="table-container">
          <el-table
            v-loading="loading"
            :data="filteredImages"
            class="clean-table"
            stripe
            @row-click="handleRowClick"
            :row-class-name="tableRowClassName"
          >
            <el-table-column prop="Repository" label="Repository" min-width="200">
              <template #default="{row}">
                <div class="image-cell">
                  <el-icon class="image-icon"><Icon icon="mdi:image" /></el-icon>
                  <span class="image-name">{{ row.Repository || '&lt;none&gt;' }}</span>
                  <el-tag 
                    v-if="row.Repository.includes('/')" 
                    size="mini" 
                    effect="plain"
                    class="registry-tag"
                  >
                    {{ getRegistryName(row.Repository) }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="Tag" label="Tag" width="120">
              <template #default="{row}">
                <el-tag 
                  :type="row.Tag === 'latest' ? 'primary' : 'info'" 
                  size="small"
                  class="tag-badge"
                >
                  {{ row.Tag || '&lt;none&gt;' }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column prop="ImageID" label="Image ID" width="200">
              <template #default="{row}">
                <el-tooltip :content="row.ImageID" placement="top">
                  <code class="image-id">{{ row.ImageID.substring(0, 12) }}</code>
                </el-tooltip>
              </template>
            </el-table-column>
            
            <el-table-column prop="CreatedSince" label="Created" width="150">
              <template #default="{row}">
                <div class="created-cell">
                  <el-icon size="12" class="created-icon"><Icon icon="mdi:clock-outline" /></el-icon>
                  <span class="created-text">{{ formatCreatedTime(row.CreatedSince) }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="Size" label="Size" width="120">
              <template #default="{row}">
                <div class="size-cell">
                  <el-icon size="12" class="size-icon"><Icon icon="mdi:harddisk" /></el-icon>
                  <span class="size-text">{{ formatImageSize(row.Size) }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column label="Status" width="150">
              <template #default="{row}">
                <el-tag 
                  :type="getUpdateStatus(row).type" 
                  size="small"
                  :class="getUpdateStatus(row).class"
                  class="status-tag"
                >
                  <el-icon :size="10" class="status-icon">
                    <Icon :icon="getUpdateStatus(row).icon" />
                  </el-icon>
                  {{ getUpdateStatus(row).text }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="Actions" width="320" fixed="right" class-name="actions-column">
              <template #default="{ row }">
                <div class="actions-container">
                  <div class="action-buttons-group">
                    <!-- Grupa podstawowych akcji -->
                    <el-button-group class="primary-actions">
                      <el-tooltip content="Pull Latest" placement="top">
                        <el-button
                          type="primary"
                          size="small"
                          circle
                          @click.stop="updateImage(row)"
                          :loading="updatingImage === row.ImageID"
                          :disabled="!row.Repository || row.Repository === '<none>'"
                        >
                          <el-icon><Icon icon="mdi:download" /></el-icon>
                        </el-button>
                      </el-tooltip>
                      
                      <el-tooltip content="Run Container" placement="top">
                        <el-button
                          type="success"
                          size="small"
                          circle
                          @click.stop="runImage(row)"
                          :disabled="!row.Repository || row.Repository === '<none>'"
                        >
                          <el-icon><Icon icon="mdi:play" /></el-icon>
                        </el-button>
                      </el-tooltip>
                      
                      <el-tooltip content="Inspect" placement="top">
                        <el-button
                          type="info"
                          size="small"
                          circle
                          @click.stop="inspectImage(row.ImageID)"
                        >
                          <el-icon><Icon icon="mdi:information" /></el-icon>
                        </el-button>
                      </el-tooltip>
                    </el-button-group>

                    <!-- Grupa zarządzania -->
                    <el-button-group class="secondary-actions">
                      <el-tooltip content="Add to Auto Update" placement="top">
                        <el-button
                          type="warning"
                          size="small"
                          circle
                          @click.stop="toggleAutoUpdate(row)"
                          :disabled="!row.Repository || row.Repository === '<none>'"
                        >
                          <el-icon>
                            <Icon :icon="isAutoUpdated(row) ? 'mdi:update' : 'mdi:update-off'" />
                          </el-icon>
                        </el-button>
                      </el-tooltip>
                      
                      <el-tooltip content="Force Remove" placement="top">
                        <el-button
                          type="danger"
                          size="small"
                          circle
                          @click.stop="forceDeleteImage(row)"
                          :loading="deletingImage === row.ImageID"
                        >
                          <el-icon><Icon icon="mdi:delete-forever" /></el-icon>
                        </el-button>
                      </el-tooltip>
                      
                      <el-tooltip content="Remove" placement="top">
                        <el-button
                          type="danger"
                          size="small"
                          circle
                          @click.stop="deleteImage(row)"
                          :loading="deletingImage === row.ImageID"
                        >
                          <el-icon><Icon icon="mdi:delete" /></el-icon>
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
        <div class="table-footer" v-if="filteredImages.length > 0">
          <div class="footer-info">
            <span class="footer-text">
              Showing {{ filteredImages.length }} of {{ images.length }} images
            </span>
          </div>
          <div class="footer-actions">
            <el-button size="small" @click="cleanUnusedImages" :loading="cleaning" class="footer-btn">
              <el-icon><Icon icon="mdi:broom" /></el-icon>
              Clean Unused
            </el-button>
            <el-button size="small" @click="showAutoUpdateDialog = true" class="footer-btn">
              <el-icon><Icon icon="mdi:robot" /></el-icon>
              Auto Update Settings
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Pull Image Dialog -->
    <el-dialog 
      v-model="showPullDialog" 
      title="Pull Docker Image" 
      width="500px"
      class="clean-dialog"
    >
      <el-form :model="pullForm" label-width="120px" label-position="top">
        <el-form-item label="Image Name" required>
          <el-input 
            v-model="pullForm.image" 
            placeholder="e.g. nginx:latest, ubuntu:22.04"
            @keyup.enter="pullImage"
          />
        </el-form-item>
        
        <el-form-item label="Registry" v-if="loggedInRegistries.length > 0">
          <el-select v-model="pullForm.registry" placeholder="Select registry" style="width: 100%">
            <el-option label="Docker Hub" value="" />
            <el-option
              v-for="registry in loggedInRegistries"
              :key="registry.server"
              :label="registry.server"
              :value="registry.server"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Platform" v-if="pullForm.image">
          <el-radio-group v-model="pullForm.platform">
            <el-radio label="linux/amd64">AMD64</el-radio>
            <el-radio label="linux/arm64">ARM64</el-radio>
            <el-radio label="">Any</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showPullDialog = false" size="small">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="pullImage" 
            :disabled="!pullForm.image"
            :loading="pulling"
            size="small"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            Pull Image
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Registry Login Dialog -->
    <el-dialog v-model="showRegistryDialog" title="Docker Registry Login" width="500px" class="clean-dialog">
      <el-form :model="registryForm" label-width="120px" label-position="top">
        <el-form-item label="Registry" required>
          <el-select v-model="registryForm.registry" @change="handleRegistryChange" style="width: 100%">
            <el-option label="Docker Hub" value="https://index.docker.io/v2/" />
            <el-option label="GitHub Container Registry" value="ghcr.io" />
            <el-option label="Google Container Registry" value="gcr.io" />
            <el-option label="Custom Registry" value="custom" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="registryForm.registry === 'custom'" label="Custom Registry URL" required>
          <el-input v-model="registryForm.customUrl" placeholder="https://registry.example.com" />
        </el-form-item>
        
        <el-form-item label="Username" required>
          <el-input v-model="registryForm.username" />
        </el-form-item>
        
        <el-form-item label="Password" required>
          <el-input v-model="registryForm.password" type="password" />
        </el-form-item>
        
        <el-form-item label="Remember Me">
          <el-switch v-model="registryForm.remember" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRegistryDialog = false">Cancel</el-button>
        <el-button type="primary" @click="loginToRegistry" :loading="loggingIn">
          Login
        </el-button>
      </template>
    </el-dialog>

    <!-- Auto Update Dialog -->
    <el-dialog v-model="showAutoUpdateDialog" title="Auto Update Settings" width="600px" class="clean-dialog">
      <div class="auto-update-content">
        <el-alert
          title="Auto Update Information"
          type="info"
          :closable="false"
          class="mb-4"
        >
          <p>Automatically update selected Docker images on a schedule</p>
        </el-alert>
        
        <el-form :model="autoUpdateConfig" label-width="200px">
          <el-form-item label="Enable Auto Update">
            <el-switch v-model="autoUpdateConfig.enabled" />
          </el-form-item>
          
          <el-form-item label="Update Schedule" v-if="autoUpdateConfig.enabled">
            <el-select v-model="autoUpdateConfig.schedule" style="width: 100%">
              <el-option label="Daily at 2:00 AM" value="0 2 * * *" />
              <el-option label="Weekly (Sunday at 2:00 AM)" value="0 2 * * 0" />
              <el-option label="Monthly (1st at 2:00 AM)" value="0 2 1 * *" />
              <el-option label="Custom Cron Expression" value="custom" />
            </el-select>
          </el-form-item>
          
          <el-form-item v-if="autoUpdateConfig.schedule === 'custom' && autoUpdateConfig.enabled" label="Custom Cron">
            <el-input v-model="autoUpdateConfig.customCron" placeholder="0 2 * * *" />
          </el-form-item>
          
          <el-form-item label="Auto Restart Containers" v-if="autoUpdateConfig.enabled">
            <el-switch v-model="autoUpdateConfig.restartContainers" />
            <span class="text-muted ml-2">Restart containers after update</span>
          </el-form-item>
          
          <el-divider />
          
          <el-form-item label="Images to Update" v-if="autoUpdateConfig.enabled">
            <el-transfer
              v-model="autoUpdateConfig.selectedImages"
              :data="transferImages"
              :titles="['Available', 'Selected']"
              filterable
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <el-button @click="showAutoUpdateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveAutoUpdateSettings" :loading="savingAutoUpdate">
          Save Settings
        </el-button>
      </template>
    </el-dialog>

    <!-- Cleanup Dialog -->
    <el-dialog v-model="showCleanupDialog" title="Docker Cleanup" width="500px" class="clean-dialog">
      <div class="cleanup-content">
        <el-alert
          title="Warning"
          type="warning"
          :closable="false"
          class="mb-4"
        >
          <p>These actions will remove unused Docker resources. Make sure you know what you're doing.</p>
        </el-alert>
        
        <div class="cleanup-options">
          <el-checkbox-group v-model="cleanupOptions">
            <el-checkbox label="dangling">Remove dangling images (&lt;none&gt;:&lt;none&gt;)</el-checkbox>
            <el-checkbox label="unused">Remove unused images (not used by containers)</el-checkbox>
            <el-checkbox label="buildCache">Remove build cache</el-checkbox>
            <el-checkbox label="volumes">Remove unused volumes (careful!)</el-checkbox>
          </el-checkbox-group>
        </div>
        
        <div class="cleanup-preview mt-4" v-if="cleanupPreview">
          <h4>Preview:</h4>
          <pre class="preview-output">{{ cleanupPreview }}</pre>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showCleanupDialog = false">Cancel</el-button>
        <el-button @click="previewCleanup" :loading="previewing">Preview</el-button>
        <el-button type="danger" @click="executeCleanup" :loading="cleaning" :disabled="!cleanupOptions.length">
          Execute Cleanup
        </el-button>
      </template>
    </el-dialog>

    <!-- Inspect Dialog -->
    <el-dialog 
      v-model="inspectDialogVisible" 
      :title="`Image Details: ${inspectImageName}`" 
      width="70%"
      top="5vh"
      class="inspect-dialog"
    >
      <div class="inspect-container">
        <el-tabs v-model="inspectActiveTab" class="inspect-tabs">
          <el-tab-pane label="Inspect Data" name="inspect">
            <pre class="inspect-data">{{ inspectData }}</pre>
          </el-tab-pane>
          <el-tab-pane label="History" name="history" v-if="imageHistory.length > 0">
            <div class="history-list">
              <div v-for="(item, index) in imageHistory" :key="index" class="history-item">
                <div class="history-header">
                  <span class="history-cmd">{{ item.CreatedBy }}</span>
                  <span class="history-size">{{ formatFileSize(item.Size) }}</span>
                </div>
                <div class="history-date">{{ new Date(item.Created * 1000).toLocaleString() }}</div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Layers" name="layers" v-if="imageLayers.length > 0">
            <div class="layers-list">
              <div v-for="(layer, index) in imageLayers" :key="index" class="layer-item">
                <div class="layer-header">
                  <span class="layer-id">{{ layer.slice(0, 12) }}</span>
                  <span class="layer-size">{{ formatFileSize(layerSizeMap[layer] || 0) }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      
      <template #footer>
        <el-button @click="inspectDialogVisible = false">Close</el-button>
        <el-button @click="copyInspectData" type="primary">
          Copy JSON
        </el-button>
      </template>
    </el-dialog>

    <!-- Run Image Dialog -->
    <el-dialog 
      v-model="showRunDialog" 
      :title="`Run Container: ${selectedImage}`" 
      width="600px"
      class="clean-dialog"
    >
      <el-form :model="runForm" label-width="120px" label-position="top">
        <el-form-item label="Container Name" required>
          <el-input v-model="runForm.name" :placeholder="`${selectedImage?.replace(/[:/]/g, '-')}-container`" />
        </el-form-item>
        
        <el-form-item label="Port Mapping">
          <div class="tags-container">
            <el-tag
              v-for="(port, index) in runForm.ports"
              :key="index"
              closable
              @close="removeRunPort(index)"
              size="small"
            >
              {{ port }}
            </el-tag>
          </div>
          <el-input
            v-model="newRunPort"
            placeholder="8080:80"
            @keyup.enter="addRunPort"
          >
            <template #append>
              <el-button @click="addRunPort"><Icon icon="mdi:plus" /></el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="Environment Variables">
          <div class="tags-container">
            <el-tag
              v-for="(env, index) in runForm.environment"
              :key="index"
              closable
              @close="removeRunEnv(index)"
              size="small"
            >
              {{ env }}
            </el-tag>
          </div>
          <el-input
            v-model="newRunEnv"
            placeholder="KEY=value"
            @keyup.enter="addRunEnv"
          >
            <template #append>
              <el-button @click="addRunEnv"><Icon icon="mdi:plus" /></el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="Auto Restart">
          <el-radio-group v-model="runForm.restart">
            <el-radio label="no">No</el-radio>
            <el-radio label="always">Always</el-radio>
            <el-radio label="unless-stopped">Unless Stopped</el-radio>
            <el-radio label="on-failure">On Failure</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRunDialog = false">Cancel</el-button>
        <el-button type="primary" @click="executeRunImage" :loading="runningContainer">
          Run Container
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// Reactive state
const images = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showPullDialog = ref(false);
const showRegistryDialog = ref(false);
const showAutoUpdateDialog = ref(false);
const showCleanupDialog = ref(false);
const showRunDialog = ref(false);
const inspectDialogVisible = ref(false);
const inspectData = ref('');
const inspectImageName = ref('');
const inspectActiveTab = ref('inspect');
const imageHistory = ref([]);
const imageLayers = ref([]);
const layerSizeMap = ref({});
const reloadKey = inject('reloadKey');
const pulling = ref(false);
const deletingImage = ref(null);
const updatingImage = ref(null);
const loggingIn = ref(false);
const cleaning = ref(false);
const previewing = ref(false);
const savingAutoUpdate = ref(false);
const runningContainer = ref(false);
const selectedImage = ref('');

// Forms
const pullForm = ref({
  image: '',
  registry: '',
  platform: ''
});

const registryForm = ref({
  registry: 'https://index.docker.io/v2/',
  customUrl: '',
  username: '',
  password: '',
  remember: true
});

const autoUpdateConfig = ref({
  enabled: false,
  schedule: '0 2 * * *',
  customCron: '',
  restartContainers: true,
  selectedImages: []
});

const runForm = ref({
  name: '',
  ports: [],
  environment: [],
  restart: 'unless-stopped'
});

const newRunPort = ref('');
const newRunEnv = ref('');

// Stats
const stats = ref({
  totalImages: 0,
  totalSize: 0,
  totalTags: 0,
  autoUpdateCount: 0
});

// Cleanup
const cleanupOptions = ref([]);
const cleanupPreview = ref('');

// Registries
const loggedInRegistries = ref([]);

// Computed
const filteredImages = computed(() => {
  if (!searchQuery.value) return images.value;
  const query = searchQuery.value.toLowerCase();
  return images.value.filter(image => 
    (image.Repository?.toLowerCase().includes(query)) ||
    (image.Tag?.toLowerCase().includes(query)) ||
    (image.ImageID?.toLowerCase().includes(query))
  );
});

const transferImages = computed(() => {
  return images.value
    .filter(img => img.Repository && img.Repository !== '<none>')
    .map(img => ({
      key: `${img.Repository}:${img.Tag}`,
      label: `${img.Repository}:${img.Tag} (${formatImageSize(img.Size)})`
    }));
});

const isAutoUpdated = (image) => {
  const fullName = `${image.Repository}:${image.Tag}`;
  return autoUpdateConfig.value.selectedImages.includes(fullName);
};

const getUpdateStatus = (image) => {
  const fullName = `${image.Repository}:${image.Tag}`;
  const autoUpdated = isAutoUpdated(image);
  
  return {
    type: autoUpdated ? 'success' : 'info',
    class: autoUpdated ? 'status-auto-update' : 'status-manual',
    icon: autoUpdated ? 'mdi:update' : 'mdi:update-off',
    text: autoUpdated ? 'Auto-update' : 'Manual'
  };
};

// Helper functions
const formatImageSize = (size) => {
  if (!size) return '0B';
  
  // If size is already formatted (e.g., "1.2GB")
  if (typeof size === 'string' && size.match(/[a-zA-Z]/)) {
    return size;
  }
  
  // If size is in bytes
  const bytes = parseInt(size);
  if (isNaN(bytes)) return size;
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const formatCreatedTime = (createdSince) => {
  if (!createdSince) return '-';
  
  // Convert Docker's "X weeks/days/hours ago" to more readable format
  const match = createdSince.match(/(\d+)\s+(\w+)\s+ago/);
  if (match) {
    const [, amount, unit] = match;
    return `${amount} ${unit} ago`;
  }
  
  return createdSince;
};

const getRegistryName = (repository) => {
  if (!repository || repository === '<none>') return 'local';
  if (repository.includes('docker.io')) return 'docker.io';
  if (repository.includes('ghcr.io')) return 'ghcr.io';
  if (repository.includes('gcr.io')) return 'gcr.io';
  if (repository.includes('/')) {
    return repository.split('/')[0];
  }
  return 'docker.io';
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};

const tableRowClassName = ({ row }) => {
  return row.Repository === '<none>' ? 'dangling-row' : '';
};

// API functions
const fetchImages = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/images');
    
    if (response.data.success && Array.isArray(response.data.images)) {
      images.value = response.data.images.map(img => ({
        Repository: img.Repository || img.REPOSITORY || '<none>',
        Tag: img.Tag || img.TAG || '<none>',
        ImageID: img.ImageID || img.ID || img.IMAGEID,
        CreatedSince: img.CreatedSince || img.CREATEDSINCE,
        Size: img.Size || img.SIZE,
        VirtualSize: img.VirtualSize,
        Containers: img.Containers
      }));
      
      // Calculate stats
      calculateStats();
      await fetchAutoUpdateSettings();
      await fetchLoggedInRegistries();
    }
  } catch (error) {
    ElMessage.error('Failed to fetch Docker images');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const calculateStats = () => {
  let totalSize = 0;
  let totalTags = 0;
  const uniqueRepos = new Set();
  
  images.value.forEach(img => {
    if (img.Size) {
      const sizeStr = img.Size.toString();
      const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(\w+)?/);
      if (match) {
        const [, amount, unit] = match;
        let bytes = parseFloat(amount);
        
        if (unit) {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          const unitIndex = units.indexOf(unit.toUpperCase());
          if (unitIndex > 0) {
            bytes *= Math.pow(1024, unitIndex);
          }
        }
        
        totalSize += bytes;
      }
    }
    
    if (img.Repository && img.Repository !== '<none>') {
      uniqueRepos.add(img.Repository);
      totalTags++;
    }
  });
  
  stats.value = {
    totalImages: images.value.length,
    totalSize,
    totalTags,
    autoUpdateCount: autoUpdateConfig.value.selectedImages.length
  };
};

const pullImage = async () => {
  try {
    if (!pullForm.value.image) {
      ElMessage.warning('Please enter an image name');
      return;
    }

    pulling.value = true;
    showPullDialog.value = false;

    let imageToPull = pullForm.value.image;
    if (pullForm.value.registry) {
      imageToPull = `${pullForm.value.registry}/${imageToPull}`;
    }

    // Add platform if specified
    const params = {};
    if (pullForm.value.platform) {
      params.platform = pullForm.value.platform;
    }

    const response = await axios.post('/services/docker/images/pull', {
      image: imageToPull,
      ...params
    });
    
    ElMessage.success(response.data.message || 'Image pulled successfully');
    await fetchImages();
    
  } catch (error) {
    ElMessage.error(`Failed to pull image: ${error.response?.data?.error || error.message}`);
  } finally {
    pulling.value = false;
    pullForm.value = {
      image: '',
      registry: '',
      platform: ''
    };
  }
};

const deleteImage = async (image) => {
  try {
    await ElMessageBox.confirm(
      `Delete image ${image.Repository}:${image.Tag}?`,
      'Confirm Delete',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    );

    deletingImage.value = image.ImageID;
    
    const response = await axios.delete('/services/docker/images/remove', {
      params: {
        image: `${image.Repository}:${image.Tag}`,
        force: false
      }
    });
    
    ElMessage.success(response.data.message || 'Image deleted successfully');
    await fetchImages();
    
  } catch (error) {
    if (error !== 'cancel') {
      if (error.response?.data?.suggestion) {
        ElMessage.error(`${error.response.data.error} ${error.response.data.suggestion}`);
      } else {
        ElMessage.error('Failed to delete image');
      }
    }
  } finally {
    deletingImage.value = null;
  }
};

const forceDeleteImage = async (image) => {
  try {
    await ElMessageBox.confirm(
      `<strong>Force Delete Image</strong><br><br>
      This will forcefully remove image ${image.Repository}:${image.Tag}<br>
      <span style="color: #f56c6c">Warning: This may break running containers!</span>`,
      'Confirm Force Delete',
      {
        confirmButtonText: 'Force Delete',
        cancelButtonText: 'Cancel',
        type: 'error',
        dangerouslyUseHTMLString: true
      }
    );

    deletingImage.value = image.ImageID;
    
    const response = await axios.delete('/services/docker/images/remove', {
      params: {
        image: `${image.Repository}:${image.Tag}`,
        force: true
      }
    });
    
    ElMessage.success(response.data.message || 'Image force deleted successfully');
    await fetchImages();
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to force delete image');
    }
  } finally {
    deletingImage.value = null;
  }
};

const updateImage = async (image) => {
  try {
    updatingImage.value = image.ImageID;
    
    const response = await axios.post('/services/docker/images/pull', {
      image: `${image.Repository}:${image.Tag}`
    });
    
    ElMessage.success(response.data.message || 'Image updated successfully');
    await fetchImages();
    
  } catch (error) {
    ElMessage.error('Failed to update image');
    console.error(error);
  } finally {
    updatingImage.value = null;
  }
};

const runImage = (image) => {
  selectedImage.value = `${image.Repository}:${image.Tag}`;
  runForm.value.name = `${image.Repository.replace(/[:/]/g, '-')}-${Date.now()}`;
  showRunDialog.value = true;
};

const addRunPort = () => {
  if (newRunPort.value) {
    runForm.value.ports.push(newRunPort.value);
    newRunPort.value = '';
  }
};

const removeRunPort = (index) => {
  runForm.value.ports.splice(index, 1);
};

const addRunEnv = () => {
  if (newRunEnv.value) {
    runForm.value.environment.push(newRunEnv.value);
    newRunEnv.value = '';
  }
};

const removeRunEnv = (index) => {
  runForm.value.environment.splice(index, 1);
};

const executeRunImage = async () => {
  try {
    runningContainer.value = true;
    
    const response = await axios.post('/services/docker/container/create', {
      name: runForm.value.name,
      image: selectedImage.value,
      ports: runForm.value.ports,
      env: runForm.value.environment.reduce((acc, env) => {
        const [key, ...value] = env.split('=');
        acc[key] = value.join('=');
        return acc;
      }, {})
    });
    
    ElMessage.success(response.data.message || 'Container created successfully');
    showRunDialog.value = false;
    
    // Reset form
    runForm.value = {
      name: '',
      ports: [],
      environment: [],
      restart: 'unless-stopped'
    };
    selectedImage.value = '';
    
  } catch (error) {
    ElMessage.error('Failed to create container');
    console.error(error);
  } finally {
    runningContainer.value = false;
  }
};

const inspectImage = async (imageId) => {
  try {
    const response = await axios.get(`/services/docker/images/inspect/${imageId}`);
    inspectData.value = JSON.stringify(response.data.data || response.data, null, 2);
    
    // Try to get image history
    try {
      const historyResponse = await axios.get(`/services/docker/images/history/${imageId}`);
      imageHistory.value = Array.isArray(historyResponse.data) ? historyResponse.data : [];
    } catch {
      imageHistory.value = [];
    }
    
    // Extract image name from inspect data
    const data = response.data.data || response.data;
    if (Array.isArray(data)) {
      const first = data[0];
      inspectImageName.value = first.RepoTags?.[0] || first.Id?.substring(0, 12);
    } else {
      inspectImageName.value = data.RepoTags?.[0] || imageId.substring(0, 12);
    }
    
    inspectDialogVisible.value = true;
    inspectActiveTab.value = 'inspect';
    
  } catch (error) {
    ElMessage.error('Failed to inspect image');
    console.error(error);
  }
};

const copyInspectData = () => {
  navigator.clipboard.writeText(inspectData.value)
    .then(() => ElMessage.success('Copied to clipboard'))
    .catch(() => ElMessage.error('Failed to copy'));
};

const loginToRegistry = async () => {
  try {
    if (!registryForm.value.username || !registryForm.value.password) {
      ElMessage.warning('Username and password are required');
      return;
    }
    
    loggingIn.value = true;
    
    let server = registryForm.value.registry;
    if (server === 'custom' && registryForm.value.customUrl) {
      server = registryForm.value.customUrl;
    }
    
    await axios.post('/services/docker/registry/login', {
      server,
      username: registryForm.value.username,
      password: registryForm.value.password
    });
    
    ElMessage.success('Logged in successfully');
    showRegistryDialog.value = false;
    
    // Reset form
    registryForm.value = {
      registry: 'https://index.docker.io/v2/',
      customUrl: '',
      username: '',
      password: '',
      remember: true
    };
    
    await fetchLoggedInRegistries();
    
  } catch (error) {
    ElMessage.error('Login failed: ' + error.message);
    console.error(error);
  } finally {
    loggingIn.value = false;
  }
};

const handleRegistryChange = (value) => {
  if (value === 'ghcr.io') {
    registryForm.value.username = '';
    registryForm.value.password = '';
  }
};

const fetchLoggedInRegistries = async () => {
  try {
    const response = await axios.get('/services/docker/registry/list');
    loggedInRegistries.value = response.data.registries || [];
  } catch (error) {
    console.error('Failed to fetch registry info:', error);
  }
};

const fetchAutoUpdateSettings = async () => {
  try {
    const response = await axios.get('/services/docker/auto-update');
    
    if (response.data) {
      autoUpdateConfig.value = {
        enabled: response.data.enabled || false,
        schedule: response.data.schedule || '0 2 * * *',
        customCron: response.data.customCron || '',
        restartContainers: response.data.restartContainers !== false,
        selectedImages: response.data.images || []
      };
    }
    
    // Update stats
    stats.value.autoUpdateCount = autoUpdateConfig.value.selectedImages.length;
    
  } catch (error) {
    console.error('Failed to fetch auto-update settings:', error);
  }
};

const toggleAutoUpdate = (image) => {
  const fullName = `${image.Repository}:${image.Tag}`;
  const index = autoUpdateConfig.value.selectedImages.indexOf(fullName);
  
  if (index > -1) {
    autoUpdateConfig.value.selectedImages.splice(index, 1);
    ElMessage.info(`Removed ${fullName} from auto-update`);
  } else {
    autoUpdateConfig.value.selectedImages.push(fullName);
    ElMessage.success(`Added ${fullName} to auto-update`);
  }
  
  // Update stats
  stats.value.autoUpdateCount = autoUpdateConfig.value.selectedImages.length;
};

const saveAutoUpdateSettings = async () => {
  try {
    savingAutoUpdate.value = true;
    
    // Use custom cron if selected
    const schedule = autoUpdateConfig.value.schedule === 'custom' 
      ? autoUpdateConfig.value.customCron
      : autoUpdateConfig.value.schedule;
    
    await axios.post('/services/docker/auto-update', {
      enabled: autoUpdateConfig.value.enabled,
      schedule,
      images: autoUpdateConfig.value.selectedImages,
      restartContainers: autoUpdateConfig.value.restartContainers
    });
    
    ElMessage.success('Auto update settings saved');
    showAutoUpdateDialog.value = false;
    
  } catch (error) {
    ElMessage.error('Failed to save settings: ' + error.message);
    console.error(error);
  } finally {
    savingAutoUpdate.value = false;
  }
};

const previewCleanup = async () => {
  try {
    previewing.value = true;
    cleanupPreview.value = '';
    
    const commands = [];
    
    if (cleanupOptions.value.includes('dangling')) {
      commands.push('docker images --filter "dangling=true" -q');
    }
    
    if (cleanupOptions.value.includes('unused')) {
      commands.push('docker images --filter "dangling=false" --format "{{.Repository}}:{{.Tag}}"');
    }
    
    // Execute preview commands
    let output = 'Preview of images to be removed:\n\n';
    
    for (const cmd of commands) {
      try {
        const { stdout } = await execAsync(cmd);
        if (stdout.trim()) {
          output += `Command: ${cmd}\n${stdout}\n\n`;
        }
      } catch (error) {
        output += `Command: ${cmd}\nError: ${error.message}\n\n`;
      }
    }
    
    cleanupPreview.value = output;
    
  } catch (error) {
    ElMessage.error('Failed to preview cleanup');
    console.error(error);
  } finally {
    previewing.value = false;
  }
};

const cleanUnusedImages = async () => {
  try {
    cleaning.value = true;
    
    await ElMessageBox.confirm(
      'This will remove all unused Docker images. Continue?',
      'Confirm Cleanup',
      {
        confirmButtonText: 'Clean',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );
    
    await axios.post('/services/docker/images/cleanup');
    ElMessage.success('Cleanup completed successfully');
    await fetchImages();
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Cleanup failed: ' + error.message);
    }
  } finally {
    cleaning.value = false;
  }
};

const executeCleanup = async () => {
  try {
    cleaning.value = true;
    
    await ElMessageBox.confirm(
      'This will execute the selected cleanup operations. This action cannot be undone. Continue?',
      'Execute Cleanup',
      {
        confirmButtonText: 'Execute',
        cancelButtonText: 'Cancel',
        type: 'error'
      }
    );
    
    const response = await axios.post('/services/docker/cleanup', {
      options: cleanupOptions.value
    });
    
    ElMessage.success(response.data.message || 'Cleanup executed successfully');
    showCleanupDialog.value = false;
    cleanupOptions.value = [];
    cleanupPreview.value = '';
    
    await fetchImages();
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Cleanup failed: ' + error.message);
    }
  } finally {
    cleaning.value = false;
  }
};

const handleRowClick = (row) => {
  // You can add additional row click behavior here
  console.log('Row clicked:', row);
};

watch(reloadKey, () => {
  fetchImages();
});

onMounted(() => {
  fetchImages();
  
  // Check for updates periodically (every hour)
  setInterval(async () => {
    if (autoUpdateConfig.value.enabled) {
      try {
        const response = await axios.get('/services/docker/auto-update/check');
        if (response.data.updates?.length > 0) {
          console.log(`${response.data.updates.length} images have updates available`);
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }, 3600000);
});
</script>

<style scoped>
.docker-images {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  overflow: hidden;
}

/* Header styles */
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
  color: #3b82f6;
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

/* Stats Cards */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px;
  padding-bottom: 0;
}

.stat-card {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.stat-icon {
  font-size: 28px;
  color: #3b82f6;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  padding: 12px;
  border-radius: 8px;
}

.stat-details {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Table styles */
.table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 20px;
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
}

/* Table styling */
.clean-table {
  flex: 1;
  border: none;
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  width: 100% !important;
}

:deep(.clean-table .el-table__header-wrapper) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
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

/* Row styles */
:deep(.dangling-row) {
  background-color: #fef3f2 !important;
}

:deep(.dangling-row:hover > td) {
  background-color: #fee2e2 !important;
}

/* Cell styles */
.image-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}

.image-icon {
  color: #64748b;
  font-size: 16px;
  flex-shrink: 0;
}

.image-name {
  font-weight: 500;
  color: #1e293b;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.registry-tag {
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

.tag-badge {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
}

.image-id {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  color: #475569;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-block;
  border: 1px solid #e2e8f0;
  font-weight: 500;
}

.created-cell, .size-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.created-icon, .size-icon {
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}

.created-text, .size-text {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
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
}

.status-icon {
  font-size: 12px !important;
}

.status-auto-update {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.status-manual {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #475569;
  border: 1px solid #e2e8f0;
}

/* Actions */
.actions-container {
  width: 100%;
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
  border: 1px solid #fde2e2;
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
}

.footer-info {
  color: #64748b;
  font-size: 12px;
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

/* Dialog styles */
.clean-dialog :deep(.el-dialog) {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.clean-dialog :deep(.el-dialog__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.clean-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.clean-dialog :deep(.el-dialog__footer) {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

/* Inspect dialog */
.inspect-dialog :deep(.el-dialog__body) {
  padding: 0;
  height: 70vh;
}

.inspect-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.inspect-tabs {
  flex: 1;
}

.inspect-tabs :deep(.el-tabs__content) {
  height: calc(100% - 45px);
  overflow: auto;
}

.inspect-data {
  margin: 0;
  padding: 20px;
  background: #1e1e1e;
  color: #f0f0f0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  height: 100%;
  overflow: auto;
}

.history-list, .layers-list {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.history-item, .layer-item {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.history-header, .layer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.history-cmd {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  color: #475569;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-size, .layer-size {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.history-date {
  font-size: 11px;
  color: #94a3b8;
}

.layer-id {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  color: #475569;
  font-weight: 600;
}

/* Auto update content */
.auto-update-content {
  max-height: 60vh;
  overflow-y: auto;
}

.text-muted {
  color: #94a3b8;
  font-size: 12px;
}

.mb-4 {
  margin-bottom: 16px;
}

.ml-2 {
  margin-left: 8px;
}

.mt-4 {
  margin-top: 16px;
}

/* Cleanup content */
.cleanup-content {
  max-height: 60vh;
  overflow-y: auto;
}

.cleanup-options {
  padding: 12px 0;
}

.preview-output {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 11px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
}

/* Utility classes */
.text-warning {
  color: #f59e0b;
}

.text-danger {
  color: #ef4444;
}

/* Responsive adjustments */
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
  
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .action-buttons-group {
    flex-wrap: wrap;
    gap: 4px;
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }
  
  .clean-header {
    padding: 12px;
  }
  
  .header-left h2 {
    font-size: 18px;
  }
  
  .table-wrapper {
    padding: 12px;
  }
  
  .clean-dialog {
    width: 95% !important;
  }
  
  .inspect-dialog {
    width: 95% !important;
  }
}

@media (max-width: 576px) {
  .table-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .footer-actions {
    justify-content: center;
  }
  
  .create-btn {
    padding: 6px 16px;
    font-size: 12px;
  }
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
</style>
