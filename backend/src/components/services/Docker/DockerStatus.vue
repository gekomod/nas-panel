<template>
  <div class="docker-dashboard">
    <!-- Status Card - nowa minimalistyczna wersja -->
    <el-card shadow="hover" class="status-card">
      <template #header>
        <div class="card-header">
          <el-icon size="24" class="docker-icon">
            <Icon icon="mdi:docker" />
          </el-icon>
          <span>Docker Engine</span>
        </div>
      </template>

      <div v-if="loading" class="loading-spinner">
        <el-icon :size="32" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
      </div>

      <div v-else class="status-content">
        <div class="status-info">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Status">
              <el-tag :type="statusClass">
                <el-icon :size="16">
                  <Icon :icon="statusIcon" />
                </el-icon>
                {{ statusText }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Version">
              {{ status.version || 'unknown' }}
            </el-descriptions-item>
            <el-descriptions-item label="Info">
              {{ status.info }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="action-buttons">
          <el-button 
            v-if="status.status !== 'active'"
            type="success"
            @click="manageDocker('start')"
            :loading="serviceLoading"
            plain
            round
          >
            <template #icon>
              <el-icon>
                <Icon icon="mdi:play" />
              </el-icon>
            </template>
            Start
          </el-button>
          <el-button 
            v-else
            type="danger"
            @click="manageDocker('stop')"
            :loading="serviceLoading"
            plain
            round
          >
            <template #icon>
              <el-icon>
                <Icon icon="mdi:stop" />
              </el-icon>
            </template>
            Stop
          </el-button>
          <el-button
            type="warning"
            @click="manageDocker('restart')"
            :loading="serviceLoading"
            plain
            round
          >
            <template #icon>
              <el-icon>
                <Icon icon="mdi:restart" />
              </el-icon>
            </template>
            Restart
          </el-button>

          <el-button 
            v-if="!status.installed"
            type="primary"
            @click="showInstallDialog = true"
            plain
            round
          >
            <template #icon>
              <el-icon>
                <Icon icon="mdi:download" />
              </el-icon>
            </template>
            Install
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Zachowane el-tabs -->
    <el-tabs v-if="status.installed" v-model="activeTab" class="docker-tabs">
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
      <el-tab-pane label="Backup" name="backup">
        <DockerBackup />
      </el-tab-pane>
      <el-tab-pane label="Settings" name="settings">
        <DockerSettings 
          v-if="dockerConfig"
          :config="dockerConfig"
          @save="handleSaveSettings"
        />
        <div v-else>Loading settings...</div>
      </el-tab-pane>
    </el-tabs>

    <DockerInstall 
      v-model:visible="showInstallDialog" 
      @installed="onDockerInstalled"
    />

    <!-- Stats Dialog -->
    <el-dialog v-model="statsDialogVisible" title="Container Stats" width="70%">
      <ContainerStats 
        v-if="statsDialogVisible"
        :container-id="selectedContainerId"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import DockerContainers from './DockerContainers.vue';
import DockerImages from './DockerImages.vue';
import DockerNetworks from './DockerNetworks.vue';
import DockerVolumes from './DockerVolumes.vue';
import DockerCompose from './DockerCompose.vue';
import DockerInstall from './DockerInstall.vue';
import ContainerStats from './ContainerStats.vue';
import DockerSettings from './DockerSettings.vue';
import DockerBackup from './DockerBackup.vue';

const status = ref({
  installed: false,
  version: null,
  status: 'unknown',
  info: ''
});
const dockerConfig = ref(null);
const loading = ref(true);
const serviceLoading = ref(false);
const activeTab = ref('containers');
const showInstallDialog = ref(false);
const statsDialogVisible = ref(false);
const selectedContainerId = ref('');

const reloadKey = ref(0);
provide('reloadKey', reloadKey);

const statusClass = computed(() => {
  if (!status.value.installed) return 'danger';
  return status.value.status === 'active' ? 'success' : 'danger';
});

const statusIcon = computed(() => {
  if (!status.value.installed) return 'mdi:docker-off';
  return status.value.status === 'active' ? 'mdi:check-circle' : 'mdi:alert-circle';
});

const statusText = computed(() => {
  if (!status.value.installed) return 'Not Installed';
  return status.value.status === 'active' ? 'Running' : 'Stopped';
});

const fetchStatus = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/status');
    status.value = response.data;
  } catch (error) {
    ElMessage.error('Failed to fetch Docker status');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const manageDocker = async (action) => {
  try {
    serviceLoading.value = true;
    await axios.post(`/services/docker/${action}`);
    ElMessage.success(`Docker service ${action}ed successfully`);
    
    // Odśwież status i wymuś przeładowanie zakładek
    await fetchStatus();
    reloadKey.value++; // Inkrementacja wymusza przeładowanie
    
    // Dodatkowe opóźnienie dla pewności
    setTimeout(() => {
      if (status.value.installed) {
        fetchDockerConfig();
      }
    }, 1000);
  } catch (error) {
    ElMessage.error(`Failed to ${action} Docker service`);
    console.error(error);
  } finally {
    serviceLoading.value = false;
  }
};

const handleRestartContainer = async (containerId) => {
  try {
    await axios.post(`/services/docker/container/${containerId}/restart`);
    ElMessage.success('Container restarted successfully');
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
  } catch (error) {
    ElMessage.error('Failed to fetch Docker configuration');
    console.error(error);
    // Ustaw domyślne wartości w przypadku błędu
    dockerConfig.value = {
      daemonPort: 2375,
      ipv6Enabled: false,
      loggingDriver: 'json-file',
      maxConcurrentDownloads: 3,
      dataRoot: '/var/lib/docker'
    };
  }
};

const handleSaveSettings = async (newConfig) => {
  try {
    await axios.post('/services/docker/config', newConfig);
    await fetchDockerConfig(); // Ponownie pobierz konfigurację po zapisie
    ElMessage.success('Docker settings saved successfully');
  } catch (error) {
    ElMessage.error('Failed to save Docker settings');
    console.error(error);
    throw error; // Rzuć błąd, aby komponent mógł go obsłużyć
  }
};

const onDockerInstalled = () => {
  fetchStatus();
};

onMounted(async () => {
  await fetchStatus();
  if (status.value.installed) {
    fetchDockerConfig();
  }
});
</script>

<style scoped>
.docker-dashboard {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.docker-icon {
  color: #2496ed; /* Docker blue */
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-info {
  margin-bottom: 10px;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.docker-tabs {
  margin-top: 20px;
}

/* Responsywność */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons > * {
    width: 100%;
  }
}
</style>
