<template>
  <div class="modern-docker-settings" :class="{ 'dark': isDarkTheme }">
    <el-card class="settings-card" shadow="never">
      <div class="card-header">
        <div class="header-title">
          <el-icon class="header-icon"><Icon icon="mdi:docker" /></el-icon>
          <h2>{{ $t('docker.settings.title') }}</h2>
        </div>
        <div class="header-actions">
          <el-button type="primary" @click="saveSettings" :loading="saving" size="large" round>
            <template #icon>
              <el-icon><Icon icon="mdi:content-save" /></el-icon>
            </template>
            {{ $t('common.save') }}
          </el-button>
          <el-button @click="resetForm" size="large" round>
            <template #icon>
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
            </template>
            {{ $t('common.reset') }}
          </el-button>
          
          <!-- Przycisk do przełączania trybu ciemnego -->
          <el-button @click="toggleDarkMode" size="large" circle class="theme-toggle">
            <template #icon>
              <el-icon v-if="isDarkTheme"><Icon icon="mdi:weather-sunny" /></el-icon>
              <el-icon v-else><Icon icon="mdi:weather-night" /></el-icon>
            </template>
          </el-button>
        </div>
      </div>

      <div class="settings-grid">
        <!-- Column 1 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:connection" /></el-icon>
              <span>{{ $t('docker.settings.connection') }}</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.daemonPort')" label-position="top">
                <el-input-number 
                  v-model="form.daemonPort" 
                  :min="1" 
                  :max="65535" 
                  controls-position="right"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.hosts')" label-position="top">
                <el-select
                  v-model="form.hosts"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  :placeholder="$t('docker.settings.hostsPlaceholder')"
                  :class="{ 'dark-select': isDarkTheme }"
                >
                  <el-option
                    v-for="(host, index) in form.hosts"
                    :key="index"
                    :label="host"
                    :value="host"
                  />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:harddisk" /></el-icon>
              <span>{{ $t('docker.settings.storage') }}</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.dataRoot')" label-position="top">
                <el-input 
                  v-model="form.dataRoot" 
                  placeholder="/var/lib/docker"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>
              
              <el-form-item :label="$t('docker.settings.containerd')" label-position="top">
                <el-input 
                  v-model="form.containerd" 
                  placeholder="/run/containerd/containerd.sock"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>
            </div>
          </div>
        </div>

        <!-- Column 2 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:network" /></el-icon>
              <span>{{ $t('docker.settings.network') }}</span>
            </h3>
            <div class="switch-grid">
              <el-form-item :label="$t('docker.settings.ipv6Enabled')" label-position="top">
                <el-switch v-model="form.ipv6Enabled" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.ipTables')" label-position="top">
                <el-switch v-model="form.iptables" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.ip6Tables')" label-position="top">
                <el-switch v-model="form.ip6tables" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.ipForward')" label-position="top">
                <el-switch v-model="form.ipForward" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.ipMasq')" label-position="top">
                <el-switch v-model="form.ipMasq" />
              </el-form-item>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:download" /></el-icon>
              <span>{{ $t('docker.settings.transfer') }}</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.maxConcurrentDownloads')" label-position="top">
                <el-input-number 
                  v-model="form.maxConcurrentDownloads" 
                  :min="1" 
                  :max="10" 
                  controls-position="right"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.maxConcurrentUploads')" label-position="top">
                <el-input-number 
                  v-model="form.maxConcurrentUploads" 
                  :min="1" 
                  :max="10" 
                  controls-position="right"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>
              
              <el-form-item :label="$t('docker.settings.maxDownloadAttempts')" label-position="top">
                <el-input-number 
                  v-model="form.maxDownloadAttempts" 
                  :min="1" 
                  :max="10" 
                  controls-position="right"
                  :class="{ 'dark-input': isDarkTheme }"
                />
              </el-form-item>
            </div>
          </div>
        </div>

        <!-- Column 3 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:dns" /></el-icon>
              <span>{{ $t('docker.settings.dns') }}</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.dnsServers')" label-position="top">
                <el-select
                  v-model="form.dns"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  :placeholder="$t('docker.settings.dnsPlaceholder')"
                  :class="{ 'dark-select': isDarkTheme }"
                >
                  <el-option
                    v-for="(server, index) in form.dns"
                    :key="index"
                    :label="server"
                    :value="server"
                  />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('docker.settings.dnsSearch')" label-position="top">
                <el-select
                  v-model="form.dnsSearch"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  :placeholder="$t('docker.settings.dnsSearchPlaceholder')"
                  :class="{ 'dark-select': isDarkTheme }"
                >
                  <el-option
                    v-for="(domain, index) in form.dnsSearch"
                    :key="index"
                    :label="domain"
                    :value="domain"
                  />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:console-line" /></el-icon>
              <span>{{ $t('docker.settings.logging') }}</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.loggingDriver')" label-position="top">
                <el-select 
                  v-model="form.loggingDriver"
                  :class="{ 'dark-select': isDarkTheme }"
                >
                  <el-option label="json-file" value="json-file" />
                  <el-option label="syslog" value="syslog" />
                  <el-option label="journald" value="journald" />
                  <el-option label="gelf" value="gelf" />
                  <el-option label="fluentd" value="fluentd" />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('docker.settings.logLevel')" label-position="top">
                <el-select 
                  v-model="form.logLevel"
                  :class="{ 'dark-select': isDarkTheme }"
                >
                  <el-option label="debug" value="debug" />
                  <el-option label="info" value="info" />
                  <el-option label="warn" value="warn" />
                  <el-option label="error" value="error" />
                  <el-option label="fatal" value="fatal" />
                </el-select>
              </el-form-item>
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:tune" /></el-icon>
              <span>{{ $t('docker.settings.advanced') }}</span>
            </h3>
            <div class="switch-grid">
              <el-form-item :label="$t('docker.settings.experimental')" label-position="top">
                <el-switch v-model="form.experimental" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.debug')" label-position="top">
                <el-switch v-model="form.debug" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.liveRestore')" label-position="top">
                <el-switch v-model="form.liveRestore" />
              </el-form-item>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Proste zarządzanie trybem ciemnym
const isDarkTheme = ref(false);

const props = defineProps({
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark', 'system'].includes(value)
  }
})

// Sprawdź zapisany tryb lub preferencje systemowe
const checkDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (saved !== null) {
    isDarkTheme.value = saved === 'true';
  } else {
    isDarkTheme.value = systemPrefersDark;
  }
  
  // Zastosuj klasę do body dla lepszego stylowania
  if (isDarkTheme.value) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
};

const toggleDarkMode = () => {
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('darkMode', isDarkTheme.value.toString());
  
  if (isDarkTheme.value) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
};

const emit = defineEmits(['save']);

const form = ref({
  daemonPort: 2375,
  hosts: ['tcp://0.0.0.0:2375', 'unix:///var/run/docker.sock'],
  ipv6Enabled: false,
  loggingDriver: 'json-file',
  logLevel: 'debug',
  maxConcurrentDownloads: 3,
  maxConcurrentUploads: 5,
  maxDownloadAttempts: 5,
  dataRoot: '/var/lib/docker',
  containerd: '/run/containerd/containerd.sock',
  experimental: false,
  debug: true,
  liveRestore: true,
  iptables: true,
  ip6tables: false,
  ipForward: true,
  ipMasq: true,
  dns: ["8.8.8.8", "8.8.4.4"],
  dnsSearch: ["localdomain"],
  tls: false,
  defaultAddressPools: [
    {
      base: '172.30.0.0/16',
      size: 24
    },
    {
      base: '172.31.0.0/16',
      size: 24
    }
  ],
  logOpts: {
    'cache-disabled': 'false',
    'cache-max-file': '5',
    'cache-max-size': '20m',
    'cache-compress': 'true',
    'env': 'os,customer',
    'labels': 'somelabel',
    'max-file': '5',
    'max-size': '10m'
  }
});

const loading = ref(true);
const saving = ref(false);

// Pobierz konfigurację Dockera
const fetchDockerConfig = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/config');
    updateFormWithConfig(response.data);
  } catch (error) {
    ElMessage.error(t('docker.messages.loadError'));
    console.error('Error loading Docker config:', error);
  } finally {
    loading.value = false;
  }
};

// Aktualizuj formularz danymi z konfiguracji
const updateFormWithConfig = (config) => {
  form.value = {
    daemonPort: config.daemonPort || 2375,
    hosts: config.hosts || ['tcp://0.0.0.0:2375', 'unix:///var/run/docker.sock'],
    ipv6Enabled: config.ipv6Enabled || false,
    loggingDriver: config.loggingDriver || 'json-file',
    logLevel: config.logLevel || 'debug',
    maxConcurrentDownloads: config.maxConcurrentDownloads || 3,
    maxConcurrentUploads: config.maxConcurrentUploads || 5,
    maxDownloadAttempts: config.maxDownloadAttempts || 5,
    dataRoot: config.dataRoot || '/var/lib/docker',
    containerd: config.containerd || '/run/containerd/containerd.sock',
    experimental: config.experimental || false,
    debug: config.debug !== undefined ? config.debug : true,
    liveRestore: config.liveRestore !== undefined ? config.liveRestore : true,
    iptables: config.iptables !== undefined ? config.iptables : true,
    ip6tables: config.ip6tables || false,
    ipForward: config.ipForward !== undefined ? config.ipForward : true,
    ipMasq: config.ipMasq !== undefined ? config.ipMasq : true,
    dns: config.dns || ["8.8.8.8", "8.8.4.4"],
    dnsSearch: config.dnsSearch || ["localdomain"],
    tls: config.tls || false,
    defaultAddressPools: config.defaultAddressPools || [
      {
        base: '172.30.0.0/16',
        size: 24
      },
      {
        base: '172.31.0.0/16',
        size: 24
      }
    ],
    logOpts: config.logOpts || {
      'cache-disabled': 'false',
      'cache-max-file': '5',
      'cache-max-size': '20m',
      'cache-compress': 'true',
      'env': 'os,customer',
      'labels': 'somelabel',
      'max-file': '5',
      'max-size': '10m'
    }
  };
};

const saveSettings = async () => {
  try {
    saving.value = true;
    await axios.post('/services/docker/config', form.value);
    ElMessage.success(t('docker.messages.saveSuccess'));
    await fetchDockerConfig();
  } catch (error) {
    ElMessage.error(t('docker.messages.saveError'));
    console.error('Error saving Docker config:', error);
  } finally {
    saving.value = false;
  }
};

const resetForm = async () => {
  await fetchDockerConfig();
};

onMounted(() => {
  checkDarkModePreference();
  fetchDockerConfig();
});
</script>

<style scoped>
.modern-docker-settings {
  padding: 24px;
  min-height: 100vh;
  transition: all 0.3s ease;
}

.modern-docker-settings.dark {

}

.settings-card {
  border: none;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.dark .settings-card {
color: #f3f3f3;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.dark .card-header {
  border-bottom-color: #4a5568;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  transition: all 0.3s ease;
}

.dark .header-title h2 {
  color: #e2e8f0;
}

.header-icon {
  font-size: 32px;
  color: #2496ed;
  transition: all 0.3s ease;
}

.dark .header-icon {
  color: #63b3ed;
}

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.theme-toggle {
  margin-left: 8px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  padding: 32px;
}

@media (max-width: 1400px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 24px;
  }
}

.settings-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-group {
  background-color: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
}

.dark .settings-group {
  background-color: #4a5568;
  border-color: #718096;
}

.settings-group:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.dark .settings-group:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  transition: all 0.3s ease;
}

.dark .group-title {
  color: #e2e8f0;
}

.group-title .el-icon {
  font-size: 20px;
  color: #2496ed;
  transition: all 0.3s ease;
}

.dark .group-title .el-icon {
  color: #63b3ed;
}

.form-items {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
  padding-bottom: 8px;
  line-height: 1.4;
  transition: all 0.3s ease;
}

.dark :deep(.el-form-item__label) {
  color: #cbd5e0;
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-input__inner) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.el-switch__core) {
  border-radius: 12px;
}

:deep(.el-button) {
  font-weight: 500;
  transition: all 0.3s ease;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #2496ed 0%, #1e88e5 100%);
  border: none;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #1e88e5 0%, #1976d2 100%);
  transform: translateY(-1px);
}

:deep(.el-button--default) {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #4a5568;
}

.dark :deep(.el-button--default) {
  border-color: #718096;
  color: #cbd5e0;
}

:deep(.el-button--default:hover) {
  background-color: #f7fafc;
  border-color: #cbd5e0;
}

.dark :deep(.el-button--default:hover) {
  background-color: #4a5568;
  border-color: #a0aec0;
}

/* Responsive design */
@media (max-width: 768px) {
  .modern-docker-settings {
    padding: 16px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    padding: 20px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: stretch;
    flex-wrap: wrap;
  }
  
  .header-actions .el-button {
    flex: 1;
    min-width: 120px;
  }
  
  .theme-toggle {
    margin-left: 0;
    margin-top: 8px;
  }
  
  .settings-grid {
    padding: 20px;
    gap: 20px;
  }
  
  .settings-group {
    padding: 20px;
  }
  
  .switch-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .header-title h2 {
    font-size: 20px;
  }
  
  .group-title {
    font-size: 16px;
  }
  
  .settings-grid {
    padding: 16px;
  }
  
  .settings-group {
    padding: 16px;
  }
  
  .header-actions .el-button {
    min-width: 100px;
  }
}

/* Animation for loading state */
.settings-group {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom scrollbar for selects */
:deep(.el-select-dropdown__list) {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.dark :deep(.el-select-dropdown__list) {
  scrollbar-color: #4a5568 #2d3748;
}

:deep(.el-select-dropdown__list::-webkit-scrollbar) {
  width: 6px;
}

:deep(.el-select-dropdown__list::-webkit-scrollbar-track) {
  background: #f7fafc;
}

.dark :deep(.el-select-dropdown__list::-webkit-scrollbar-track) {
  background: #2d3748;
}

:deep(.el-select-dropdown__list::-webkit-scrollbar-thumb) {
  background: #cbd5e0;
  border-radius: 3px;
}

.dark :deep(.el-select-dropdown__list::-webkit-scrollbar-thumb) {
  background: #4a5568;
}
</style>
