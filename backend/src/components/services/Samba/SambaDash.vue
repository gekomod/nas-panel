<template>
  <div class="samba-dashboard">
    <el-page-header @back="goBack" class="dashboard-header">
      <template #content>
        <div class="header-content">
          <h1>
            <Icon icon="mdi:server-network" width="28" height="28" />
            <span>{{ $t('samba.title') }}</span>
            <el-tag :type="serviceStatus.running ? 'success' : 'danger'" effect="dark" class="status-tag">
              {{ serviceStatus.running ? $t('samba.status.running') : $t('samba.status.stopped') }}
            </el-tag>
          </h1>
          <p class="header-description">{{ $t('samba.description') }}</p>
        </div>
      </template>
      <template #extra>
        <el-button-group>
          <el-button 
            type="primary" 
            @click="toggleService('start')"
            :disabled="serviceStatus.running || !serviceStatus.installed"
            :loading="loading"
          >
            <el-icon><icon icon="mdi:play" /></el-icon>
            {{ $t('samba.actions.start') }}
          </el-button>
          <el-button 
            type="danger" 
            @click="toggleService('stop')"
            :disabled="!serviceStatus.running"
            :loading="loading"
          >
            <el-icon><icon icon="mdi:stop" /></el-icon>
            {{ $t('samba.actions.stop') }}
          </el-button>
          <el-button 
            @click="restartService"
            :disabled="!serviceStatus.running"
            :loading="restarting"
          >
            <el-icon><icon icon="mdi:refresh" /></el-icon>
            {{ $t('samba.actions.restart') }}
          </el-button>
        </el-button-group>
      </template>
    </el-page-header>

    <el-alert 
      v-if="!serviceStatus.installed"
      :title="$t('samba.alerts.notInstalled.title')"
      type="error"
      :closable="false"
      show-icon
      class="install-alert"
    >
      <p>{{ $t('samba.alerts.notInstalled.message') }}</p>
      <el-button type="primary" @click="installSamba" :loading="installing">
        {{ $t('samba.actions.install') }}
      </el-button>
    </el-alert>

    <el-tabs v-model="activeTab" class="clean-tabs">
      <el-tab-pane :label="$t('samba.tabs.shares')" name="shares">
        <SambaShares 
          :service-status="serviceStatus" 
          @refresh-status="checkServiceStatus"
          class="tab-content"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('samba.tabs.settings')" name="settings">
        <SambaSettings 
          :service-status="serviceStatus"
          @service-restarted="checkServiceStatus"
          class="tab-content"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('samba.tabs.status')" name="status">
        <SambaStatus 
          :status="serviceStatus" 
          @status-changed="checkServiceStatus"
          class="tab-content"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import SambaShares from './SambaShares.vue';
import SambaSettings from './SambaSettings.vue';
import SambaStatus from './SambaStatus.vue';
import axios from 'axios';

const router = useRouter();
const activeTab = ref('shares');
const serviceStatus = ref({
  installed: false,
  running: false,
  error: null
});
const loading = ref(false);
const restarting = ref(false);
const installing = ref(false);

onMounted(() => {
  checkServiceStatus();
});

function goBack() {
  router.push('/services/samba');
}

async function checkServiceStatus() {
  try {
    const response = await axios.get('/services/samba/status');
    serviceStatus.value = {
      ...response.data,
      error: null
    };
  } catch (error) {
    serviceStatus.value = {
      installed: false,
      running: false,
      error: error.response?.data?.error || 'Błąd połączenia'
    };
    console.error('Status check error:', error);
  }
}

async function toggleService(action) {
  loading.value = true;
  try {
    await axios.post('/services/samba/toggle', { action });
    ElMessage.success(t(`samba.messages.${action}Success`));
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error(t(`samba.errors.${action}Failed`));
  } finally {
    loading.value = false;
  }
}

async function restartService() {
  restarting.value = true;
  try {
    await axios.post('/services/samba/restart');
    ElMessage.success('Usługa Samba zrestartowana');
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd podczas restartowania usługi');
  } finally {
    restarting.value = false;
  }
}

async function installSamba() {
  installing.value = true;
  try {
    await axios.post('/services/samba/install');
    ElMessage.success('Instalacja Samby rozpoczęta');
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd podczas instalacji Samby');
  } finally {
    installing.value = false;
  }
}
</script>

<style scoped>

.status-tag {
  margin-left: 10px;
  font-weight: bold;
}

.clean-tabs {

}

.clean-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.clean-tabs :deep(.el-tabs__item) {
  height: 50px;
  padding: 0 20px;
}

.samba-dashboard {
  --bg-color: #f5f7fa;
  --header-bg: #ffffff;
  --text-color: #303133;
  --text-secondary: #606266;
  --border-color: #ebeef5;
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.dark .samba-dashboard {
  --bg-color: #121212;
  --header-bg: #1e1e1e;
  --text-color: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #424242;
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.samba-dashboard {
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.dashboard-header {
  background-color: var(--header-bg);
  color: var(--text-color);
  box-shadow: var(--shadow);
    margin-bottom: 20px;
  padding: 16px 20px;
  border-radius: 4px;
}

.header-content h1 {
  color: var(--text-color);
    display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
}

.header-description {
  color: var(--text-secondary);
   font-size: 0.9rem;
}

.clean-tabs :deep(.el-tabs__header) {
  background: var(--header-bg);
  color: var(--text-color);
    margin: 0 0 20px 0;
  padding: 0 20px;
  border-radius: 4px;
}

.tab-content {
  background: var(--header-bg);
  color: var(--text-color);
  box-shadow: var(--shadow);
}

.install-alert {
  background-color: var(--header-bg);
  margin-bottom: 20px;
}

.tab-content {
  background:  var(--header-bg);
  border-radius: 4px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>