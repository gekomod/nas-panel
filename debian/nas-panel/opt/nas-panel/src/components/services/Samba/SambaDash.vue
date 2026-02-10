<template>
  <div class="samba-dashboard">
    <!-- Hero Header -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-icon">
          <Icon icon="mdi:server-network" width="48" />
        </div>
        <div class="hero-text">
          <h1>{{ $t('samba.title') }}</h1>
          <p class="hero-description">{{ $t('samba.description') }}</p>
        </div>
        <div class="hero-status">
          <div class="status-badge" :class="statusClass">
            <div class="status-indicator" :class="statusClass"></div>
            <span>{{ statusText }}</span>
          </div>
        </div>
      </div>
      
      <!-- Quick Actions -->
      <div class="quick-actions">
        <el-button 
          type="primary" 
          @click="toggleService('start')"
          :disabled="serviceStatus.running || !serviceStatus.installed"
          :loading="loading"
          class="action-btn"
        >
          <Icon icon="mdi:play" width="18" />
          <span>{{ $t('samba.actions.start') }}</span>
        </el-button>
        
        <el-button 
          type="danger" 
          @click="toggleService('stop')"
          :disabled="!serviceStatus.running"
          :loading="loading"
          class="action-btn"
        >
          <Icon icon="mdi:stop" width="18" />
          <span>{{ $t('samba.actions.stop') }}</span>
        </el-button>
        
        <el-button 
          @click="restartService"
          :disabled="!serviceStatus.running"
          :loading="restarting"
          class="action-btn"
        >
          <Icon icon="mdi:refresh" width="18" />
          <span>{{ $t('samba.actions.restart') }}</span>
        </el-button>
        
        <el-button 
          v-if="!serviceStatus.installed"
          type="success"
          @click="installSamba"
          :loading="installing"
          class="action-btn install-btn"
        >
          <Icon icon="mdi:download" width="18" />
          <span>{{ $t('samba.actions.install') }}</span>
        </el-button>
      </div>
    </div>

    <!-- Alert dla nie zainstalowanej usługi -->
    <div v-if="!serviceStatus.installed" class="install-banner">
      <div class="banner-content">
        <Icon icon="mdi:alert-circle" width="24" />
        <div class="banner-text">
          <h4>{{ $t('samba.alerts.notInstalled.title') }}</h4>
          <p>{{ $t('samba.alerts.notInstalled.message') }}</p>
        </div>
      </div>
    </div>

    <!-- Navigation Cards -->
    <div class="navigation-cards">
      <div 
        v-for="tab in tabs" 
        :key="tab.name"
        class="nav-card"
        :class="{ active: activeTab === tab.name }"
        @click="activeTab = tab.name"
      >
        <div class="nav-icon" :class="{ active: activeTab === tab.name }">
          <Icon :icon="tab.icon" width="24" />
        </div>
        <div class="nav-content">
          <h3>{{ tab.label }}</h3>
          <p>{{ tab.description }}</p>
        </div>
        <div class="nav-arrow">
          <Icon icon="mdi:chevron-right" width="20" />
        </div>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="tab-content-wrapper">
      <div v-if="activeTab === 'shares'" class="tab-content">
        <SambaShares 
          :service-status="serviceStatus" 
          @refresh-status="checkServiceStatus"
        />
      </div>
      
      <div v-if="activeTab === 'settings'" class="tab-content">
        <SambaSettings 
          :service-status="serviceStatus"
          @service-restarted="checkServiceStatus"
        />
      </div>
      
      <div v-if="activeTab === 'status'" class="tab-content">
        <SambaStatus 
          :status="serviceStatus" 
          @status-changed="checkServiceStatus"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
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

const tabs = [
  {
    name: 'shares',
    icon: 'mdi:folder-multiple',
    label: 'Udostępnienia',
    description: 'Zarządzaj udostępnieniami sieciowymi'
  },
  {
    name: 'settings',
    icon: 'mdi:cog',
    label: 'Ustawienia',
    description: 'Konfiguruj ustawienia serwera'
  },
  {
    name: 'status',
    icon: 'mdi:chart-line',
    label: 'Status',
    description: 'Monitoruj stan usługi'
  }
];

const statusClass = computed(() => {
  if (!serviceStatus.value.installed) return 'error';
  if (serviceStatus.value.running) return 'success';
  return 'warning';
});

const statusText = computed(() => {
  if (!serviceStatus.value.installed) return 'Nie zainstalowano';
  if (serviceStatus.value.running) return 'Działa';
  return 'Zatrzymana';
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
    ElMessage.success(action === 'start' ? 'Usługa uruchomiona' : 'Usługa zatrzymana');
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error(action === 'start' ? 'Błąd uruchamiania' : 'Błąd zatrzymywania');
  } finally {
    loading.value = false;
  }
}

async function restartService() {
  restarting.value = true;
  try {
    await axios.post('/services/samba/restart');
    ElMessage.success('Usługa zrestartowana');
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd restartowania');
  } finally {
    restarting.value = false;
  }
}

async function installSamba() {
  installing.value = true;
  try {
    await axios.post('/services/samba/install');
    ElMessage.success('Instalacja rozpoczęta');
    await checkServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd instalacji');
  } finally {
    installing.value = false;
  }
}
</script>

<style scoped lang="scss">
.samba-dashboard {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --success-gradient: linear-gradient(135deg, #38b2ac 0%, #319795 100%);
  --warning-gradient: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
  --error-gradient: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
  --card-bg: #ffffff;
  --text-primary: #2d3748;
  --text-secondary: #718096;
  --border-color: #e2e8f0;
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .samba-dashboard {
  --card-bg: #1a202c;
  --text-primary: #e2e8f0;
  --text-secondary: #a0aec0;
  --border-color: #2d3748;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
}

.samba-dashboard {
  margin: 0 auto;
  padding: 24px;
}

/* Hero Section */
.hero-section {
  background: var(--primary-gradient);
  border-radius: var(--radius-lg);
  padding: 32px;
  margin-bottom: 24px;
  color: white;
  box-shadow: var(--shadow-lg);
}

.hero-content {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
}

.hero-icon {
  background: rgba(255, 255, 255, 0.2);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.hero-text {
  flex: 1;
  
  h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
    font-weight: 700;
  }
}

.hero-description {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.hero-status {
  .status-badge {
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    padding: 12px 20px;
    border-radius: 50px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    
    &.success {
      background: linear-gradient(135deg, rgba(56, 178, 172, 0.3) 0%, rgba(49, 151, 149, 0.3) 100%);
    }
    
    &.warning {
      background: linear-gradient(135deg, rgba(237, 137, 54, 0.3) 0%, rgba(221, 107, 32, 0.3) 100%);
    }
    
    &.error {
      background: linear-gradient(135deg, rgba(245, 101, 101, 0.3) 0%, rgba(229, 62, 62, 0.3) 100%);
    }
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    
    &.success {
      background: #38b2ac;
    }
    
    &.warning {
      background: #ed8936;
    }
    
    &.error {
      background: #f56565;
    }
  }
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  
  .action-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 10px 20px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    &.install-btn {
      background: rgba(72, 187, 120, 0.3);
      border-color: rgba(72, 187, 120, 0.5);
    }
  }
}

/* Install Banner */
.install-banner {
  background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
  border-left: 4px solid #e53e3e;
  
  .dark & {
    background: linear-gradient(135deg, #742a2a 0%, #9b2c2c 100%);
  }
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  
  .iconify {
    color: #e53e3e;
    margin-top: 2px;
  }
}

.banner-text {
  flex: 1;
  
  h4 {
    margin: 0 0 4px 0;
    color: #742a2a;
    
    .dark & {
      color: #fed7d7;
    }
  }
  
  p {
    margin: 0;
    color: #9b2c2c;
    
    .dark & {
      color: #feb2b2;
    }
  }
}

/* Navigation Cards */
.navigation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.nav-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    border-color: #667eea;
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
  }
  
  &.active {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  }
}

.nav-icon {
  background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%);
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  
  .dark & {
    background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  }
  
  &.active, .nav-card:hover & {
    background: var(--primary-gradient);
    
    .iconify {
      color: white;
    }
  }
  
  .iconify {
    color: #718096;
    transition: var(--transition);
    
    .dark & {
      color: #a0aec0;
    }
  }
}

.nav-content {
  flex: 1;
  
  h3 {
    margin: 0 0 4px 0;
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
}

.nav-arrow {
  opacity: 0;
  transition: var(--transition);
  
  .iconify {
    color: var(--text-secondary);
  }
  
  .nav-card:hover & {
    opacity: 1;
  }
}

/* Tab Content */
.tab-content-wrapper {
  background: var(--card-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.tab-content {
  padding: 32px;
}

/* Responsive */
@media (max-width: 768px) {
  .samba-dashboard {
    padding: 16px;
  }
  
  .hero-section {
    padding: 24px 16px;
  }
  
  .hero-content {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
  
  .quick-actions {
    justify-content: center;
  }
  
  .navigation-cards {
    grid-template-columns: 1fr;
  }
  
  .tab-content {
    padding: 24px 16px;
  }
}
</style>
