<template>
  <div class="docker-dashboard" v-if="!cssLoading">
    <!-- Główna karta statusu Docker -->
    <el-card shadow="never" class="main-status-card">
      <div class="status-header">
        <div class="status-badge" :class="statusClass">
          <el-icon size="28" class="docker-icon">
            <Icon icon="mdi:docker" />
          </el-icon>
        </div>
        
        <div class="status-info">
          <div class="status-title">
            <h3>Docker Engine</h3>
            <el-tag :type="statusClass" size="small" effect="dark" round>
              <el-icon :size="14">
                <Icon :icon="statusIcon" />
              </el-icon>
              {{ statusText }}
            </el-tag>
          </div>
          
          <div class="status-meta">
            <span v-if="status.version" class="version">
              <el-icon><Icon icon="mdi:tag" /></el-icon>
              v{{ status.version }}
            </span>
            <span class="updated">
              <el-icon><Icon icon="mdi:clock-outline" /></el-icon>
              {{ formatTime(lastUpdate) }}
            </span>
          </div>
        </div>
        
        <div class="action-buttons">
          <el-button-group>
            <el-button 
              v-if="!status.installed"
              type="primary"
              @click="showInstallDialog = true"
              plain
              size="small"
            >
              <template #icon>
                <el-icon>
                  <Icon icon="mdi:download" />
                </el-icon>
              </template>
              Install
            </el-button>
            
            <template v-else>
              <el-button 
                v-if="status.status !== 'active'"
                type="success"
                @click="manageDocker('start')"
                :loading="serviceLoading"
                size="small"
              >
                <el-icon>
                  <Icon icon="mdi:play" />
                </el-icon>
                Start
              </el-button>
              
              <el-button 
                type="warning"
                @click="manageDocker('restart')"
                :loading="serviceLoading"
                size="small"
              >
                <el-icon>
                  <Icon icon="mdi:restart" />
                </el-icon>
                Restart
              </el-button>
              
              <el-button 
                type="danger"
                @click="manageDocker('stop')"
                :loading="serviceLoading"
                size="small"
              >
                <el-icon>
                  <Icon icon="mdi:stop" />
                </el-icon>
                Stop
              </el-button>
            </template>
          </el-button-group>
        </div>
      </div>
      
      <!-- Health Status w tym samym kontenerze -->
      <div class="health-section" v-if="status.installed && status.status === 'active'">
        <div class="health-header">
          <h4>
            <el-icon><Icon icon="mdi:heart-pulse" /></el-icon>
            Health Status
          </h4>
          <el-button 
            @click="checkHealth" 
            :loading="healthLoading"
            size="small"
            text
            circle
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
          </el-button>
        </div>
        
        <div v-if="healthLoading" class="health-loading">
          <el-icon class="is-loading"><Icon icon="mdi:loading" /></el-icon>
          <span>Checking health...</span>
        </div>
        
        <div v-else class="health-content">
          <div class="health-status" :class="health.healthy ? 'healthy' : 'unhealthy'">
            <el-icon :size="24" class="health-icon">
              <Icon :icon="health.healthy ? 'mdi:check-circle' : 'mdi:alert-circle'" />
            </el-icon>
            <div class="health-info">
              <div class="health-title">
                {{ health.healthy ? 'All systems operational' : 'Issues detected' }}
              </div>
              <div class="health-subtitle" v-if="!health.healthy && health.error">
                {{ health.error }}
              </div>
            </div>
            <el-tag :type="health.healthy ? 'success' : 'danger'" size="small">
              {{ health.healthy ? 'HEALTHY' : 'UNHEALTHY' }}
            </el-tag>
          </div>
          
          <el-divider />
          
          <div class="health-stats">
            <div class="stat-item">
              <div class="stat-label">Containers</div>
              <div class="stat-value">{{ health.containersCount || 0 }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Last Check</div>
              <div class="stat-value">{{ formatTime(health.timestamp) }}</div>
            </div>
            <div class="stat-item" v-if="health.recovered">
              <div class="stat-label">Recovered</div>
              <div class="stat-value">
                <el-tag type="success" size="small">Yes</el-tag>
              </div>
            </div>
          </div>
          
          <div class="health-actions" v-if="!health.healthy">
            <el-button 
              @click="restartDocker"
              type="warning"
              size="small"
            >
              <el-icon><Icon icon="mdi:restart" /></el-icon>
              Restart Docker Service
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Zakładki - tylko jeśli Docker jest zainstalowany -->
    <div v-if="status.installed" class="tabs-container">
      <el-tabs v-model="activeTab" type="border-card" class="docker-tabs">
        <el-tab-pane label="Containers" name="containers">
          <DockerContainers 
            @restart-container="handleRestartContainer"
            @show-stats="showContainerStats"
          />
        </el-tab-pane>
        <el-tab-pane label="Images" name="images">
          <DockerImages />
        </el-tab-pane>
        <el-tab-pane label="Networks" name="networks">
          <DockerNetworks />
        </el-tab-pane>
        <el-tab-pane label="Volumes" name="volumes">
          <DockerVolumes />
        </el-tab-pane>
        <el-tab-pane label="Compose" name="compose">
          <DockerCompose />
        </el-tab-pane>
        <el-tab-pane label="Builder" name="builder">
          <DockerBuilder />
        </el-tab-pane>
        <el-tab-pane label="Backup" name="backup">
          <DockerBackup />
        </el-tab-pane>
        <el-tab-pane label="Settings" name="settings">
          <DockerSettings 
            v-if="dockerConfig && activeTab === 'settings'"
            :key="settingsKey"
            :config="dockerConfig"
            @save="handleSaveSettings"
          />
          <div v-else-if="activeTab === 'settings'" class="settings-loading">
            <el-icon class="is-loading"><Icon icon="mdi:loading" /></el-icon>
            Loading Docker settings...
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Modal instalacji Docker -->
    <el-dialog 
      v-model="showInstallDialog" 
      title="Install Docker"
      width="500px"
      :close-on-click-modal="false"
    >
      <DockerInstall 
        @installed="onDockerInstalled"
        @close="showInstallDialog = false"
      />
    </el-dialog>

    <!-- Stats Dialog -->
    <el-dialog 
      v-model="statsDialogVisible" 
      title="Container Stats" 
      width="95%"
      top="2vh"
      height="90vh"
      destroy-on-close
    >
      <ContainerStats 
        v-if="statsDialogVisible"
        :container-id="selectedContainerId"
      />
    </el-dialog>
  </div>
  
  <!-- Loading fallback -->
  <div v-else class="loading-fallback">
    <el-icon class="loading-icon"><Icon icon="mdi:loading" /></el-icon>
    <span>Loading Docker Dashboard...</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide, watch, onBeforeMount, defineAsyncComponent } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';

// Import komponentów z opóźnieniem
const DockerContainers = defineAsyncComponent(() => 
  import('./DockerContainers.vue').catch(err => {
    console.error('Failed to load DockerContainers:', err);
    return { template: '<div>Error loading Containers component</div>' };
  })
);

const DockerImages = defineAsyncComponent(() => 
  import('./DockerImages.vue').catch(err => {
    console.error('Failed to load DockerImages:', err);
    return { template: '<div>Error loading Images component</div>' };
  })
);

const DockerNetworks = defineAsyncComponent(() => 
  import('./DockerNetworks.vue').catch(err => {
    console.error('Failed to load DockerNetworks:', err);
    return { template: '<div>Error loading Networks component</div>' };
  })
);

const DockerVolumes = defineAsyncComponent(() => 
  import('./DockerVolumes.vue').catch(err => {
    console.error('Failed to load DockerVolumes:', err);
    return { template: '<div>Error loading Volumes component</div>' };
  })
);

const DockerCompose = defineAsyncComponent(() => 
  import('./DockerCompose.vue').catch(err => {
    console.error('Failed to load DockerCompose:', err);
    return { template: '<div>Error loading Compose component</div>' };
  })
);

const DockerInstall = defineAsyncComponent(() => 
  import('./DockerInstall.vue').catch(err => {
    console.error('Failed to load DockerInstall:', err);
    return { template: '<div>Error loading Install component</div>' };
  })
);

const ContainerStats = defineAsyncComponent(() => 
  import('./ContainerStats.vue').catch(err => {
    console.error('Failed to load ContainerStats:', err);
    return { template: '<div>Error loading Stats component</div>' };
  })
);

const DockerSettings = defineAsyncComponent(() => 
  import('./DockerSettings.vue').catch(err => {
    console.error('Failed to load DockerSettings:', err);
    return { template: '<div>Error loading Settings component</div>' };
  })
);

const DockerBackup = defineAsyncComponent(() => 
  import('./DockerBackup.vue').catch(err => {
    console.error('Failed to load DockerBackup:', err);
    return { template: '<div>Error loading Backup component</div>' };
  })
);

const DockerBuilder = defineAsyncComponent(() => 
  import('./DockerBuilder.vue').catch(err => {
    console.error('Failed to load DockerBuilder:', err);
    return { template: '<div>Error loading Builder component</div>' };
  })
);

// Zmienna ładowania CSS
const cssLoading = ref(true);

// Pozostałe reactive state
const status = ref({
  installed: false,
  version: null,
  status: 'unknown',
  info: ''
});

const health = ref({
  healthy: false,
  containersCount: 0,
  timestamp: null,
  error: null,
  recovered: false
});

const dockerConfig = ref(null);
const loading = ref(true);
const healthLoading = ref(false);
const serviceLoading = ref(false);
const activeTab = ref('containers');
const showInstallDialog = ref(false);
const statsDialogVisible = ref(false);
const selectedContainerId = ref('');
const lastUpdate = ref(Date.now());
const settingsKey = ref(0); // Klucz do wymuszenia re-renderu Settings

const reloadKey = ref(0);
provide('reloadKey', reloadKey);

// Computed properties
const statusClass = computed(() => {
  if (!status.value.installed) return 'danger';
  return status.value.status === 'active' ? 'success' : 'warning';
});

const statusIcon = computed(() => {
  if (!status.value.installed) return 'mdi:docker-off';
  return status.value.status === 'active' ? 'mdi:check-circle' : 'mdi:alert-circle';
});

const statusText = computed(() => {
  if (!status.value.installed) return 'Not Installed';
  return status.value.status === 'active' ? 'Running' : 'Stopped';
});

// Methods
const fetchStatus = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/status', {
      timeout: 5000
    });
    status.value = response.data;
    lastUpdate.value = Date.now();
    
    // Automatycznie sprawdź zdrowie, jeśli Docker jest aktywny
    if (status.value.installed && status.value.status === 'active') {
      await checkHealth();
    }
  } catch (error) {
    console.error('Failed to fetch Docker status:', error);
    status.value = {
      installed: false,
      status: 'unknown',
      version: null,
      info: 'Unable to connect to Docker service'
    };
  } finally {
    loading.value = false;
  }
};

const checkHealth = async () => {
  if (!status.value.installed || status.value.status !== 'active') return;
  
  try {
    healthLoading.value = true;
    const response = await axios.get('/services/docker/health', {
      timeout: 8000
    });
    health.value = response.data;
  } catch (error) {
    health.value = {
      healthy: false,
      error: error.message || 'Health check failed',
      timestamp: Date.now()
    };
  } finally {
    healthLoading.value = false;
  }
};

const manageDocker = async (action) => {
  try {
    serviceLoading.value = true;
    await axios.post(`/services/docker/${action}`);
    ElMessage.success(`Docker service ${action}ed successfully`);
    
    // Odśwież status
    await fetchStatus();
    reloadKey.value++;
    
    if (status.value.installed && action !== 'stop') {
      setTimeout(() => {
        fetchDockerConfig();
      }, 1500);
    }
  } catch (error) {
    ElMessage.error(`Failed to ${action} Docker service`);
    console.error(error);
  } finally {
    serviceLoading.value = false;
  }
};

const restartDocker = async () => {
  try {
    healthLoading.value = true;
    await axios.post('/services/docker/restart');
    ElMessage.success('Docker restart initiated');
    
    setTimeout(async () => {
      await fetchStatus();
      await checkHealth();
    }, 3000);
  } catch (error) {
    ElMessage.error('Failed to restart Docker');
    console.error(error);
  } finally {
    healthLoading.value = false;
  }
};

const handleRestartContainer = async (containerId) => {
  try {
    await axios.post(`/services/docker/container/${containerId}/restart`);
    ElMessage.success('Container restarted successfully');
    
    // Odśwież zakładkę kontenerów
    reloadKey.value++;
  } catch (error) {
    ElMessage.error('Failed to restart container');
    console.error(error);
  }
};

const showContainerStats = (containerId) => {
  selectedContainerId.value = containerId;
  statsDialogVisible.value = true;
};

const fetchDockerConfig = async () => {
  try {
    const response = await axios.get('/services/docker/config');
    dockerConfig.value = response.data;
    settingsKey.value++; // Zwiększ klucz, aby wymusić re-render
  } catch (error) {
    console.error('Failed to fetch Docker configuration:', error);
    dockerConfig.value = {
      daemonPort: 2375,
      ipv6Enabled: false,
      loggingDriver: 'json-file',
      maxConcurrentDownloads: 3,
      dataRoot: '/var/lib/docker'
    };
    settingsKey.value++; // Zwiększ klucz nawet w przypadku błędu
  }
};

const handleSaveSettings = async (newConfig) => {
  try {
    await axios.post('/services/docker/config', newConfig);
    await fetchDockerConfig();
    ElMessage.success('Docker settings saved successfully');
    reloadKey.value++; // Odśwież inne komponenty
  } catch (error) {
    ElMessage.error('Failed to save Docker settings');
    console.error(error);
    throw error;
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
};

const onDockerInstalled = () => {
  showInstallDialog.value = false;
  fetchStatus();
};

// Watch dla aktywnej zakładki - ładuj config tylko gdy settings jest aktywny
watch(activeTab, (newTab) => {
  if (newTab === 'settings' && status.value.installed && !dockerConfig.value) {
    fetchDockerConfig();
  }
});

// Lifecycle hooks
onBeforeMount(() => {
  // Upewnij się, że CSS jest załadowany
  setTimeout(() => {
    cssLoading.value = false;
  }, 100);
});

onMounted(async () => {
  await fetchStatus();
  
  // Automatyczne odświeżanie stanu co 30 sekund
  setInterval(fetchStatus, 30000);
  
  // Automatyczne sprawdzanie zdrowia co 60 sekund, jeśli Docker jest aktywny
  setInterval(() => {
    if (status.value.installed && status.value.status === 'active') {
      checkHealth();
    }
  }, 60000);
});
</script>

<style>
/* Global styles for this component to avoid CSS preload issues */
.docker-dashboard {
  padding: 20px;
  width: 100%;
  max-width: 100%;
  margin: 0;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.loading-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  color: #64748b;
}

.loading-icon {
  font-size: 48px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.main-status-card {
  border-radius: 16px;
  border: 1px solid #e4e7ed;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  margin-bottom: 24px;
  overflow: hidden;
  width: 100%;
}

.status-header {
  display: flex;
  align-items: center;
  padding: 24px;
  gap: 20px;
  background: white;
}

.status-badge {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-badge.success {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
}

.status-badge.warning {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
}

.status-badge.danger {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
  color: white;
}

.docker-icon {
  color: currentColor;
}

.status-info {
  flex: 1;
  min-width: 0;
}

.status-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.status-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.status-meta {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 14px;
  color: #64748b;
}

.status-meta .version,
.status-meta .updated {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-buttons {
  flex-shrink: 0;
}

.health-section {
  border-top: 1px solid #e2e8f0;
  background: white;
  padding: 24px;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.health-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: #64748b;
}

.health-content {
  animation: fadeIn 0.3s ease;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
}

.health-status.healthy {
  border-left: 4px solid #10b981;
}

.health-status.unhealthy {
  border-left: 4px solid #ef4444;
}

.health-icon {
  flex-shrink: 0;
}

.health-info {
  flex: 1;
  min-width: 0;
}

.health-title {
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.health-subtitle {
  font-size: 14px;
  color: #64748b;
}

.health-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.stat-item {
  background: white;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.health-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.tabs-container {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 100%;
}

.docker-tabs {
  border: none;
  width: 100%;
}

.docker-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: #f8fafc;
  padding: 0 24px;
}

.docker-tabs :deep(.el-tabs__nav-wrap) {
  border-bottom: 1px solid #e2e8f0;
}

.docker-tabs :deep(.el-tabs__item) {
  padding: 0 24px;
  height: 48px;
  font-weight: 500;
}

.settings-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #64748b;
  min-height: 300px;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive design */
@media (max-width: 1024px) {
  .docker-dashboard {
    padding: 12px;
  }
  
  .status-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    gap: 16px;
  }
  
  .status-badge {
    align-self: center;
  }
  
  .status-meta {
    justify-content: center;
  }
  
  .action-buttons {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .docker-dashboard {
    padding: 12px;
  }
  
  .status-header,
  .health-section {
    padding: 16px;
  }
  
  .health-stats {
    grid-template-columns: 1fr;
  }
  
  .docker-tabs :deep(.el-tabs__item) {
    padding: 0 12px;
    font-size: 14px;
  }
  
  .docker-tabs :deep(.el-tabs__header) {
    padding: 0 12px;
  }
}

@media (max-width: 640px) {
  .docker-tabs :deep(.el-tabs__nav) {
    flex-wrap: wrap;
  }
  
  .docker-tabs :deep(.el-tabs__item) {
    flex: 1;
    min-width: 120px;
    text-align: center;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
  
  .action-buttons .el-button-group {
    width: 100%;
  }
  
  .action-buttons .el-button-group .el-button {
    flex: 1;
  }
}

/* Full width dialog */
:deep(.el-dialog) {
  max-width: 95%;
  margin-top: 2vh !important;
}

:deep(.el-dialog__body) {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}
</style>
