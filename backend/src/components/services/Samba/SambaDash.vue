<template>
  <div class="samba-dashboard">
    <!-- Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:server-network" />
          </div>
          <div class="header-text">
            <h2>{{ $t('samba.title') }}</h2>
            <p class="subtitle">{{ $t('samba.description') }}</p>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="header-stats">
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:server" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ serviceStatus.installed ? $t('common.installed') : $t('common.notInstalled') }}</div>
              <div class="stat-label">{{ $t('samba.status.installation') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon" :class="statusClass">
              <Icon :icon="statusIcon" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statusText }}</div>
              <div class="stat-label">{{ $t('samba.status.service') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:clock-outline" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-label">{{ $t('common.lastUpdate') }}</div>
              <div class="stat-value">{{ lastCheckedTime }}</div>
            </div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="header-actions compact">
          <el-button-group>
            <el-button 
              type="primary" 
              @click="toggleService('start')"
              :disabled="serviceStatus.running || !serviceStatus.installed"
              :loading="loading"
              size="small"
            >
              <Icon icon="mdi:play" width="14" />
              {{ $t('samba.actions.start') }}
            </el-button>
            
            <el-button 
              type="danger" 
              @click="toggleService('stop')"
              :disabled="!serviceStatus.running"
              :loading="loading"
              size="small"
            >
              <Icon icon="mdi:stop" width="14" />
              {{ $t('samba.actions.stop') }}
            </el-button>
            
            <el-button 
              v-if="!serviceStatus.installed"
              type="success"
              @click="installSamba"
              :loading="installing"
              size="small"
            >
              <Icon icon="mdi:download" width="14" />
              {{ $t('samba.actions.install') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Alert dla nie zainstalowanej usługi -->
    <el-alert
      v-if="!serviceStatus.installed"
      :title="$t('samba.alerts.notInstalled.title')"
      type="warning"
      :closable="false"
      show-icon
      class="service-alert"
    >
      <template #default>
        <p>{{ $t('samba.alerts.notInstalled.message') }}</p>
      </template>
    </el-alert>

    <!-- Alert dla wyłączonej usługi -->
    <el-alert
      v-if="serviceStatus.installed && !serviceStatus.running"
      :title="$t('samba.alerts.serviceStopped.title')"
      type="info"
      :closable="false"
      show-icon
      class="service-alert"
    >
      <template #default>
        <p>{{ $t('samba.alerts.serviceStopped.message') }}</p>
      </template>
    </el-alert>

    <!-- Navigation Cards -->
    <div class="navigation-cards">
      <el-card 
        v-for="tab in tabs" 
        :key="tab.name"
        class="nav-card"
        :class="{ active: activeTab === tab.name }"
        @click="activeTab = tab.name"
        shadow="hover"
      >
        <div class="nav-content">
          <div class="nav-icon" :class="{ active: activeTab === tab.name }">
            <Icon :icon="tab.icon" width="20" />
          </div>
          <div class="nav-text">
            <h3>{{ tab.label }}</h3>
            <p>{{ tab.description }}</p>
          </div>
          <div class="nav-arrow">
            <Icon icon="mdi:chevron-right" width="16" />
          </div>
        </div>
      </el-card>
    </div>

    <!-- Tab Content -->
    <el-card class="tab-content-wrapper" shadow="hover">
      <div class="tab-content">
        <SambaShares 
          v-if="activeTab === 'shares'"
          :service-status="serviceStatus" 
          @refresh-status="checkServiceStatus"
        />
        
        <SambaSettings 
          v-if="activeTab === 'settings'"
          :service-status="serviceStatus"
          @service-restarted="checkServiceStatus"
        />
        
        <SambaStatus 
          v-if="activeTab === 'status'"
          :status="serviceStatus" 
          @status-changed="checkServiceStatus"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import SambaShares from './SambaShares.vue';
import SambaSettings from './SambaSettings.vue';
import SambaStatus from './SambaStatus.vue';
import axios from 'axios';

const { t } = useI18n();
const activeTab = ref('shares');
const serviceStatus = ref({
  installed: false,
  running: false,
  error: null
});
const loading = ref(false);
const installing = ref(false);
const lastChecked = ref(null);

const tabs = [
  {
    name: 'shares',
    icon: 'mdi:folder-multiple',
    label: t('samba.tabs.shares'),
    description: t('samba.tabs.sharesDescription')
  },
  {
    name: 'settings',
    icon: 'mdi:cog',
    label: t('samba.tabs.settings'),
    description: t('samba.tabs.settingsDescription')
  },
  {
    name: 'status',
    icon: 'mdi:chart-line',
    label: t('samba.tabs.status'),
    description: t('samba.tabs.statusDescription')
  }
];

const statusClass = computed(() => {
  if (!serviceStatus.value.installed) return 'error';
  if (serviceStatus.value.running) return 'success';
  return 'warning';
});

const statusIcon = computed(() => {
  if (!serviceStatus.value.installed) return 'mdi:server-off';
  if (serviceStatus.value.running) return 'mdi:server-network';
  return 'mdi:server-network-off';
});

const statusText = computed(() => {
  if (!serviceStatus.value.installed) return t('samba.status.notInstalled');
  if (serviceStatus.value.running) return t('samba.status.running');
  return t('samba.status.stopped');
});

const lastCheckedTime = computed(() => {
  if (!lastChecked.value) return t('common.never');
  const date = new Date(lastChecked.value);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffInMinutes < 1) return t('common.justNow');
  if (diffInMinutes < 60) return t('common.minutesAgo', { minutes: diffInMinutes });
  if (diffInMinutes < 1440) return t('common.hoursAgo', { hours: Math.floor(diffInMinutes / 60) });
  
  return date.toLocaleDateString();
});

onMounted(() => {
  checkServiceStatus();
});

async function checkServiceStatus() {
  try {
    const response = await axios.get('/services/samba/status');
    serviceStatus.value = {
      ...response.data,
      error: null
    };
    lastChecked.value = new Date().toISOString();
  } catch (error) {
    serviceStatus.value = {
      installed: false,
      running: false,
      error: error.response?.data?.error || t('samba.errors.connection')
    };
    console.error('Status check error:', error);
  }
}

async function toggleService(action) {
  loading.value = true;
  try {
    await axios.post('/services/samba/toggle', { action });
    ElMessage.success(action === 'start' ? t('samba.messages.started') : t('samba.messages.stopped'));
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error(action === 'start' ? t('samba.errors.startFailed') : t('samba.errors.stopFailed'));
  } finally {
    loading.value = false;
  }
}

async function installSamba() {
  installing.value = true;
  try {
    await axios.post('/services/samba/install');
    ElMessage.success(t('samba.messages.installStarted'));
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error(t('samba.errors.installFailed'));
  } finally {
    installing.value = false;
  }
}
</script>

<style scoped lang="scss">
.samba-dashboard {
  --card-bg: var(--el-bg-color);
  --border-color: var(--el-border-color);
  --text-primary: var(--el-text-color-primary);
  --text-secondary: var(--el-text-color-secondary);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
}

/* Header */
.dashboard-header.compact {
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
}

.dashboard-header.compact .header-content {
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 200px;
}

.header-icon.small {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: var(--radius-md);
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
  min-width: 0;
  
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
  }
  
  .subtitle {
    margin: var(--spacing-xs) 0 0;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.3;
  }
}

.header-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  margin: 0 var(--spacing-lg);
  flex: 1;
  justify-content: center;
}

.stat-item.small {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 120px;
}

.stat-item.small .stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  
  &.success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  &.warning {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
  
  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
}

.stat-item.small .stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-item.small .stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.stat-item.small:last-child .stat-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.stat-item.small:last-child .stat-label {
  margin-bottom: 2px;
}

.header-actions.compact {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Service Alerts */
.service-alert {
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-md);
}

/* Navigation Cards */
.navigation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.nav-card {
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--el-color-primary);
    transform: translateY(-2px);
  }
  
  &.active {
    border-color: var(--el-color-primary);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(29, 78, 216, 0.05) 100%);
  }
  
  :deep(.el-card__body) {
    padding: var(--spacing-md);
  }
}

.nav-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.nav-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &.active, .nav-card:hover & {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    
    .iconify {
      color: white;
    }
  }
  
  .iconify {
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }
}

.nav-text {
  flex: 1;
  
  h3 {
    margin: 0 0 var(--spacing-xs);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  p {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.nav-arrow {
  opacity: 0;
  transition: opacity 0.2s ease;
  
  .iconify {
    color: var(--text-secondary);
  }
  
  .nav-card:hover & {
    opacity: 1;
  }
}

/* Tab Content */
.tab-content-wrapper {
  border-radius: var(--radius-lg);
  min-height: 400px;
  
  :deep(.el-card__body) {
    padding: 0;
  }
}

.tab-content {
  padding: var(--spacing-lg);
}

/* Responsive */
@media (max-width: 1024px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-lg);
  }
  
  .header-left {
    min-width: auto;
  }
  
  .header-stats {
    order: 2;
    justify-content: space-around;
    gap: var(--spacing-md);
  }
  
  .stat-item.small {
    flex-direction: column;
    text-align: center;
    gap: 4px;
  }
  
  .header-actions.compact {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  
  .navigation-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .samba-dashboard {
    padding: var(--spacing-md);
  }
  
  .header-stats {
    display: none;
  }
  
  .tab-content {
    padding: var(--spacing-md);
  }
}
</style>
