<template>
  <div class="ssh-settings">
    <!-- Nagłówek -->
    <div class="dashboard-header">
      <div class="header-main">
        <div class="header-left">
          <el-button 
            text 
            class="back-btn"
            @click="goBack"
          >
            <Icon icon="mdi:arrow-left" width="20" />
          </el-button>
          <div class="header-title">
            <Icon icon="mdi:console-network" width="24" class="header-icon" />
            <h1>{{ $t('ssh.title') }}</h1>
            <el-tag 
              :type="serviceStatus.active ? 'success' : 'danger'" 
              size="small"
              class="status-tag"
            >
              {{ serviceStatus.active ? $t('ssh.status.running') : $t('ssh.status.stopped') }}
            </el-tag>
          </div>
          <div class="header-subtitle">
            <div class="subtitle-items">
              <span v-if="serviceStatus.version" class="version-info">
                <Icon icon="mdi:tag" width="14" />
                v{{ serviceStatus.version }}
              </span>
              <span class="port-info">
                <Icon icon="mdi:network-port" width="14" />
                Port: {{ settings.port || 22 }}
              </span>
              <span v-if="serviceStatus.configPath" class="config-info">
                <Icon icon="mdi:file-cog" width="14" />
                {{ serviceStatus.configPath }}
              </span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group size="small">
            <el-button 
              type="success" 
              @click="toggleService('start')"
              :disabled="serviceStatus.active || !serviceStatus.installed"
              :loading="loading"
              plain
            >
              <Icon icon="mdi:play" width="16" />
              {{ $t('ssh.actions.start') }}
            </el-button>
            <el-button 
              type="danger" 
              @click="toggleService('stop')"
              :disabled="!serviceStatus.active"
              :loading="loading"
              plain
            >
              <Icon icon="mdi:stop" width="16" />
              {{ $t('ssh.actions.stop') }}
            </el-button>
            <el-button 
              @click="restartService"
              :disabled="!serviceStatus.active"
              :loading="restarting"
              plain
            >
              <Icon icon="mdi:refresh" width="16" />
              {{ $t('ssh.actions.restart') }}
            </el-button>
          </el-button-group>
          
          <el-switch
            v-model="serviceStatus.active"
            @change="toggleService"
            :loading="loading"
            class="service-switch"
            inline-prompt
            :active-text="$t('ssh.status.running')"
            :inactive-text="$t('ssh.status.stopped')"
          />
        </div>
      </div>
    </div>

    <!-- Alert o braku instalacji -->
    <el-alert 
      v-if="!serviceStatus.installed"
      :title="$t('ssh.alerts.notInstalled.title')"
      type="error"
      :closable="false"
      show-icon
      class="install-alert"
    >
      <template #default>
        <div class="alert-content">
          <p>{{ $t('ssh.alerts.notInstalled.message') }}</p>
          <el-button 
            type="primary" 
            size="small" 
            @click="installSsh" 
            :loading="installing"
          >
            {{ $t('ssh.actions.install') }}
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- Karty -->
    <div class="dashboard-tabs">
      <el-tabs v-model="activeTab" class="modern-tabs">
        <!-- Ustawienia podstawowe -->
        <el-tab-pane :label="$t('ssh.tabs.settings')" name="settings">
          <div class="settings-panel">
            <div class="settings-grid">
              <!-- Lewa kolumna - Ustawienia połączeń -->
              <el-card class="settings-card" shadow="never">
                <template #header>
                  <div class="card-header">
                    <Icon icon="mdi:connection" width="18" />
                    <span>{{ $t('ssh.settings.connection') }}</span>
                  </div>
                </template>
                
                <el-form :model="settings" label-position="top" size="small">
                  <el-form-item :label="$t('ssh.settings.port')">
                    <el-input-number
                      v-model="settings.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="form-hint">{{ $t('ssh.settings.portHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item :label="$t('ssh.settings.maxSessions')">
                    <el-input-number
                      v-model="settings.maxSessions"
                      :min="1"
                      :max="100"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="form-hint">{{ $t('ssh.settings.maxSessionsHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item :label="$t('ssh.settings.timeout')">
                    <el-input-number
                      v-model="settings.clientAliveInterval"
                      :min="0"
                      :step="60"
                      controls-position="right"
                      class="compact-input"
                    >
                      <template #append>sek.</template>
                    </el-input-number>
                    <div class="form-hint">{{ $t('ssh.settings.timeoutHint') }}</div>
                  </el-form-item>
                </el-form>
              </el-card>

              <!-- Środkowa kolumna - Uwierzytelnianie -->
              <el-card class="settings-card" shadow="never">
                <template #header>
                  <div class="card-header">
                    <Icon icon="mdi:lock" width="18" />
                    <span>{{ $t('ssh.settings.authentication') }}</span>
                  </div>
                </template>
                
                <el-form :model="settings" label-position="top" size="small">
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.passwordAuth') }}</span>
                      <el-switch
                        v-model="settings.passwordAuthentication"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.passwordAuthHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.publicKeyAuth') }}</span>
                      <el-switch
                        v-model="settings.publicKeyAuthentication"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.publicKeyAuthHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.rootLogin') }}</span>
                      <el-switch
                        v-model="settings.allowRootLogin"
                        inline-prompt
                        active-color="#ef4444"
                        inactive-color="#10b981"
                      />
                    </div>
                    <div class="form-hint warning-hint">
                      <Icon icon="mdi:alert" width="14" />
                      {{ $t('ssh.settings.rootLoginHint') }}
                    </div>
                  </el-form-item>
                </el-form>
              </el-card>

              <!-- Prawa kolumna - Zaawansowane -->
              <el-card class="settings-card" shadow="never">
                <template #header>
                  <div class="card-header">
                    <Icon icon="mdi:tune" width="18" />
                    <span>{{ $t('ssh.settings.advanced') }}</span>
                  </div>
                </template>
                
                <el-form :model="settings" label-position="top" size="small">
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.tcpForwarding') }}</span>
                      <el-switch
                        v-model="settings.tcpForwarding"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.tcpForwardingHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.compression') }}</span>
                      <el-switch
                        v-model="settings.compression"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.compressionHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.x11Forwarding') }}</span>
                      <el-switch
                        v-model="settings.x11Forwarding"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.x11ForwardingHint') }}</div>
                  </el-form-item>
                  
                  <el-form-item>
                    <div class="form-item-inline">
                      <span class="form-label">{{ $t('ssh.settings.gssapiAuth') }}</span>
                      <el-switch
                        v-model="settings.gssapiAuthentication"
                        inline-prompt
                        active-color="#10b981"
                      />
                    </div>
                    <div class="form-hint">{{ $t('ssh.settings.gssapiAuthHint') }}</div>
                  </el-form-item>
                </el-form>
              </el-card>
            </div>

            <!-- Dodatkowe opcje -->
            <el-card class="advanced-card" shadow="never">
              <template #header>
                <div class="card-header">
                  <Icon icon="mdi:code-braces" width="18" />
                  <span>{{ $t('ssh.settings.additionalOptions') }}</span>
                </div>
              </template>
              
              <el-input
                v-model="settings.additionalOptions"
                type="textarea"
                :rows="4"
                :placeholder="$t('ssh.settings.additionalOptionsPlaceholder')"
                class="advanced-textarea"
                resize="none"
              />
              <div class="form-hint">{{ $t('ssh.settings.additionalOptionsHint') }}</div>
            </el-card>

            <!-- Przyciski akcji -->
            <div class="action-buttons">
              <el-button 
                type="primary" 
                @click="saveSettings" 
                :loading="saving"
                size="small"
                class="save-btn"
              >
                <Icon icon="mdi:content-save" width="16" />
                {{ $t('common.save') }}
              </el-button>
              <el-button 
                @click="restartService"
                :loading="restarting"
                size="small"
              >
                <Icon icon="mdi:restart" width="16" />
                {{ $t('ssh.actions.restart') }}
              </el-button>
              <el-button 
                @click="resetSettings"
                size="small"
              >
                <Icon icon="mdi:restore" width="16" />
                {{ $t('common.reset') }}
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- Status usługi -->
        <el-tab-pane :label="$t('ssh.tabs.status')" name="status">
          <div class="status-panel">
            <div class="status-cards">
              <el-card class="status-card" shadow="never">
                <template #header>
                  <div class="card-header">
                    <Icon icon="mdi:information" width="18" />
                    <span>{{ $t('ssh.status.serviceInfo') }}</span>
                  </div>
                </template>
                
                <div class="status-grid">
                  <div class="status-item">
                    <span class="status-label">{{ $t('ssh.status.installed') }}</span>
                    <el-tag :type="serviceStatus.installed ? 'success' : 'danger'" size="small">
                      {{ serviceStatus.installed ? $t('common.yes') : $t('common.no') }}
                    </el-tag>
                  </div>
                  
                  <div class="status-item">
                    <span class="status-label">{{ $t('ssh.status.version') }}</span>
                    <span class="status-value">{{ serviceStatus.version || 'N/A' }}</span>
                  </div>
                  
                  <div class="status-item">
                    <span class="status-label">{{ $t('ssh.status.configPath') }}</span>
                    <span class="status-value">{{ serviceStatus.configPath || '/etc/ssh/sshd_config' }}</span>
                  </div>
                  
                  <div class="status-item">
                    <span class="status-label">{{ $t('ssh.status.servicePath') }}</span>
                    <span class="status-value">{{ serviceStatus.servicePath || '/usr/sbin/sshd' }}</span>
                  </div>
                  
                  <div class="status-item">
                    <span class="status-label">{{ $t('ssh.status.lastCheck') }}</span>
                    <span class="status-value">{{ formatDate(serviceStatus.lastCheck) }}</span>
                  </div>
                </div>
              </el-card>

              <el-card class="status-card logs-card" shadow="never">
                <template #header>
                  <div class="card-header">
                    <Icon icon="mdi:clipboard-text" width="18" />
                    <span>{{ $t('ssh.status.output') }}</span>
                    <div class="header-actions">
                      <el-button 
                        @click="copyStatusOutput"
                        size="small"
                        circle
                        class="action-btn"
                      >
                        <Icon icon="mdi:content-copy" width="14" />
                      </el-button>
                      <el-button 
                        @click="loadServiceStatus"
                        :loading="statusLoading"
                        size="small"
                        circle
                        class="action-btn"
                      >
                        <Icon icon="mdi:refresh" width="14" />
                      </el-button>
                    </div>
                  </div>
                </template>
                
                <div class="logs-container">
                  <pre class="status-output">{{ serviceStatus.details || $t('ssh.status.noData') }}</pre>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Aktywne połączenia -->
        <el-tab-pane :label="$t('ssh.tabs.connections')" name="connections">
          <div class="connections-panel">
            <el-card shadow="never" class="connections-card">
              <template #header>
                <div class="card-header">
                  <div class="header-content">
                    <Icon icon="mdi:account-network" width="18" />
                    <span>{{ $t('ssh.connections.title') }}</span>
                    <el-tag v-if="connections.length > 0" type="info" size="small">
                      {{ connections.length }} {{ $t('ssh.connections.connections') }}
                    </el-tag>
                  </div>
                  <div class="header-actions">
                    <el-button 
                      @click="loadConnections"
                      :loading="connectionsLoading"
                      size="small"
                    >
                      <Icon icon="mdi:refresh" width="14" />
                      {{ $t('common.refresh') }}
                    </el-button>
                    <el-button 
                      @click="exportConnections"
                      size="small"
                      plain
                    >
                      <Icon icon="mdi:download" width="14" />
                      {{ $t('ssh.connections.export') }}
                    </el-button>
                  </div>
                </div>
              </template>
              
              <div v-if="connections.length === 0" class="empty-state">
                <Icon icon="mdi:connection-off" width="48" class="empty-icon" />
                <p>{{ $t('ssh.connections.noConnections') }}</p>
              </div>
              
              <div v-else class="connections-grid">
                <div v-for="conn in connections" :key="conn.pid" class="connection-item">
                  <div class="connection-header">
                    <Icon icon="mdi:account" width="16" class="conn-icon" />
                    <div class="conn-user">
                      <span class="conn-username">{{ conn.user || 'unknown' }}</span>
                      <el-tag :type="getConnectionStateType(conn.state)" size="small">
                        {{ conn.state || 'ESTABLISHED' }}
                      </el-tag>
                    </div>
                    <div class="conn-pid">PID: {{ conn.pid }}</div>
                  </div>
                  
                  <div class="connection-details">
                    <div class="address-row">
                      <div class="address-item">
                        <Icon icon="mdi:arrow-down" width="14" class="address-icon local" />
                        <div class="address-content">
                          <div class="address-label">{{ $t('ssh.connections.local') }}</div>
                          <div class="address-value">{{ conn.local || 'N/A' }}</div>
                        </div>
                      </div>
                      <div class="address-item">
                        <Icon icon="mdi:arrow-up" width="14" class="address-icon remote" />
                        <div class="address-content">
                          <div class="address-label">{{ $t('ssh.connections.remote') }}</div>
                          <div class="address-value">{{ conn.remote || 'N/A' }}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div class="conn-meta">
                      <div class="meta-item">
                        <Icon icon="mdi:clock-outline" width="14" />
                        <span>{{ conn.duration || 'N/A' }}</span>
                      </div>
                      <div class="meta-item">
                        <Icon icon="mdi:memory" width="14" />
                        <span>{{ conn.memory || 'N/A' }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="connection-actions">
                    <el-tooltip :content="$t('ssh.connections.kill')">
                      <el-button
                        @click="killConnection(conn.pid)"
                        size="small"
                        type="danger"
                        circle
                        plain
                      >
                        <Icon icon="mdi:close" width="14" />
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Modal szybkiej konfiguracji -->
    <el-dialog
      v-model="quickConfigVisible"
      :title="$t('ssh.quickConfig.title')"
      width="400px"
      class="quick-config-modal"
    >
      <el-form label-position="top">
        <el-form-item :label="$t('ssh.quickConfig.changePort')">
          <el-input-number
            v-model="quickPort"
            :min="1"
            :max="65535"
            controls-position="right"
            class="compact-input"
          />
        </el-form-item>
        
        <el-form-item :label="$t('ssh.quickConfig.enableRoot')">
          <el-switch
            v-model="quickRootAccess"
            inline-prompt
            active-color="#ef4444"
            inactive-color="#10b981"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="quickConfigVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="applyQuickConfig"
        >
          {{ $t('common.apply') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import axios from 'axios';

const router = useRouter();
const activeTab = ref('settings');

// Status usługi
const serviceStatus = ref({
  installed: false,
  active: false,
  version: '',
  details: '',
  configPath: '',
  servicePath: '',
  lastCheck: null
});

// Ustawienia domyślne
const defaultSettings = {
  port: 22,
  allowRootLogin: false,
  passwordAuthentication: true,
  publicKeyAuthentication: true,
  tcpForwarding: false,
  compression: false,
  x11Forwarding: false,
  gssapiAuthentication: false,
  maxSessions: 10,
  clientAliveInterval: 300,
  additionalOptions: ''
};

const settings = ref({ ...defaultSettings });
const connections = ref([]);

// Stany ładowania
const loading = ref(false);
const restarting = ref(false);
const saving = ref(false);
const installing = ref(false);
const statusLoading = ref(false);
const connectionsLoading = ref(false);

// Szybka konfiguracja
const quickConfigVisible = ref(false);
const quickPort = ref(22);
const quickRootAccess = ref(false);

// Funkcje pomocnicze
const getConnectionStateType = (state) => {
  if (!state) return 'info';
  if (state.includes('ESTAB')) return 'success';
  if (state.includes('TIME_WAIT')) return 'warning';
  return 'info';
};

const copyStatusOutput = () => {
  navigator.clipboard.writeText(serviceStatus.value.details)
    .then(() => ElMessage.success('Skopiowano do schowka'))
    .catch(() => ElMessage.error('Błąd kopiowania'));
};

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
};

const openQuickConfig = () => {
  quickPort.value = settings.value.port;
  quickRootAccess.value = settings.value.allowRootLogin;
  quickConfigVisible.value = true;
};

const applyQuickConfig = async () => {
  try {
    settings.value.port = quickPort.value;
    settings.value.allowRootLogin = quickRootAccess.value;
    await saveSettings();
    quickConfigVisible.value = false;
    ElMessage.success('Szybka konfiguracja zastosowana');
  } catch (error) {
    ElMessage.error('Błąd aplikowania konfiguracji');
  }
};

const exportConnections = () => {
  const data = JSON.stringify(connections.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ssh-connections-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  ElMessage.success('Połączenia wyeksportowane');
};

const killConnection = async (pid) => {
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz zakończyć połączenie PID ${pid}?`,
      'Potwierdzenie',
      {
        confirmButtonText: 'Zakończ',
        cancelButtonText: 'Anuluj',
        type: 'warning'
      }
    );
    
    await axios.post('/services/ssh/kill-connection', { pid });
    ElMessage.success('Połączenie zakończone');
    await loadConnections();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd kończenia połączenia');
    }
  }
};

// Funkcje API
const loadServiceStatus = async () => {
  try {
    statusLoading.value = true;
    const response = await axios.get('/services/ssh/status');
    serviceStatus.value = {
      ...response.data,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    ElMessage.error('Błąd ładowania statusu');
  } finally {
    statusLoading.value = false;
  }
};

const loadSettings = async () => {
  try {
    const response = await axios.get('/services/ssh/config');
    if (response.data.config) {
      settings.value = { ...defaultSettings, ...response.data.config };
    }
  } catch (error) {
    ElMessage.error('Błąd ładowania ustawień');
  }
};

const loadConnections = async () => {
  try {
    connectionsLoading.value = true;
    const response = await axios.get('/services/ssh/connections');
    connections.value = response.data.connections || [];
  } catch (error) {
    ElMessage.error('Błąd ładowania połączeń');
  } finally {
    connectionsLoading.value = false;
  }
};

const toggleService = async (action) => {
  loading.value = true;
  try {
    await axios.post('/services/ssh/toggle', { action });
    ElMessage.success(`Usługa ${action === 'start' ? 'uruchomiona' : 'zatrzymana'}`);
    await loadServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd zmiany stanu usługi');
  } finally {
    loading.value = false;
  }
};

const restartService = async () => {
  restarting.value = true;
  try {
    await axios.post('/services/ssh/restart');
    ElMessage.success('Usługa zrestartowana');
    await loadServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd restartowania usługi');
  } finally {
    restarting.value = false;
  }
};

const saveSettings = async () => {
  saving.value = true;
  try {
    await axios.post('/services/ssh/config', {
      config: settings.value
    });
    ElMessage.success('Ustawienia zapisane');
    await loadServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd zapisywania ustawień');
  } finally {
    saving.value = false;
  }
};

const resetSettings = () => {
  settings.value = { ...defaultSettings };
  ElMessage.info('Ustawienia zresetowane');
};

const installSsh = async () => {
  installing.value = true;
  try {
    await axios.post('/services/ssh/install');
    ElMessage.success('Instalacja SSH rozpoczęta');
    await loadServiceStatus();
  } catch (error) {
    ElMessage.error('Błąd instalacji SSH');
  } finally {
    installing.value = false;
  }
};

const goBack = () => {
  router.push('/services');
};

// Interval dla automatycznego odświeżania
let connectionsInterval = null;

onMounted(() => {
  loadServiceStatus();
  loadSettings();
  loadConnections();
  
  connectionsInterval = setInterval(() => {
    if (activeTab.value === 'connections' && serviceStatus.value.active) {
      loadConnections();
    }
  }, 30000);
});

onUnmounted(() => {
  if (connectionsInterval) {
    clearInterval(connectionsInterval);
  }
});
</script>

<style scoped lang="scss">
.ssh-settings {
  --bg-color: #f8fafc;
  --card-bg: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --radius: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

.dark .ssh-settings {
  --bg-color: #0f172a;
  --card-bg: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: #334155;
}

.ssh-settings {
  padding: var(--spacing-md);
  background: var(--bg-color);
  min-height: 100vh;
}

/* Nagłówek */
.dashboard-header {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.header-left {
  flex: 1;
}

.back-btn {
  margin-bottom: var(--spacing-sm);
  padding: 4px;
  color: var(--text-secondary);
  
  &:hover {
    color: var(--text-primary);
    background: var(--border-color);
  }
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: 8px;
}

.header-icon {
  color: #6366f1;
}

.header-title h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.status-tag {
  font-weight: 500;
  letter-spacing: 0.5px;
}

.header-subtitle {
  margin-top: 4px;
}

.subtitle-items {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.version-info,
.port-info,
.config-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  
  .iconify {
    opacity: 0.7;
  }
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-sm);
  min-width: 180px;
}

.service-switch {
  .el-switch__label {
    font-size: 0.75rem;
  }
}

/* Alert */
.install-alert {
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  
  .alert-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    
    p {
      margin: 0;
      flex: 1;
    }
  }
}

/* Karty */
.dashboard-tabs {
  background: var(--card-bg);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.modern-tabs {
  :deep(.el-tabs__header) {
    margin: 0;
    background: var(--card-bg);
    padding: 0 var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  :deep(.el-tabs__nav-wrap)::after {
    display: none;
  }
  
  :deep(.el-tabs__item) {
    padding: 0 var(--spacing-md);
    height: 48px;
    font-weight: 500;
    color: var(--text-secondary);
    
    &:hover {
      color: var(--text-primary);
    }
    
    &.is-active {
      color: #6366f1;
      font-weight: 600;
    }
  }
  
  :deep(.el-tabs__active-bar) {
    background-color: #6366f1;
    height: 2px;
  }
}

/* Ustawienia */
.settings-panel {
  padding: var(--spacing-lg);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.settings-card {
  border: 1px solid var(--border-color);
  
  :deep(.el-card__header) {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  :deep(.el-card__body) {
    padding: var(--spacing-md);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary);
  
  .iconify {
    color: #6366f1;
  }
}

.form-item-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.form-label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.compact-input {
  width: 100%;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.warning-hint {
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.advanced-card {
  margin-top: var(--spacing-md);
  border: 1px solid var(--border-color);
  
  :deep(.el-card__header) {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  :deep(.el-card__body) {
    padding: var(--spacing-md);
  }
}

.advanced-textarea {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  
  .el-button {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }
}

.save-btn {
  min-width: 120px;
}

/* Status */
.status-panel {
  padding: var(--spacing-lg);
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.status-card {
  border: 1px solid var(--border-color);
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  :deep(.el-card__header) {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  :deep(.el-card__body) {
    padding: var(--spacing-md);
  }
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 6px;
  
  &:hover {
    transform: translateY(-1px);
  }
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.status-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.logs-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logs-container {
  flex: 1;
  overflow: hidden;
}

.status-output {
  margin: 0;
  padding: var(--spacing-sm);
  background: var(--bg-color);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  max-height: 300px;
  color: var(--text-primary);
}

/* Połączenia */
.connections-panel {
  padding: var(--spacing-lg);
}

.connections-card {
  border: 1px solid var(--border-color);
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  :deep(.el-card__header) {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  :deep(.el-card__body) {
    padding: var(--spacing-md);
  }
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 600;
  color: var(--text-primary);
  
  .iconify {
    color: #6366f1;
  }
}

.empty-state {
  text-align: center;
  padding: 48px var(--spacing-md);
  color: var(--text-secondary);
}

.empty-icon {
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-sm);
}

.connection-item {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: var(--spacing-md);
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #6366f1;
    box-shadow: var(--shadow-sm);
  }
}

.connection-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.conn-icon {
  color: #6366f1;
}

.conn-user {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conn-username {
  font-weight: 500;
  font-size: 0.875rem;
}

.conn-pid {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.connection-details {
  margin-bottom: var(--spacing-sm);
}

.address-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.address-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.dark .address-item {
  background: rgba(255, 255, 255, 0.05);
}

.address-icon {
  &.local {
    color: #10b981;
  }
  
  &.remote {
    color: #6366f1;
  }
}

.address-content {
  flex: 1;
}

.address-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.address-value {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-primary);
  word-break: break-all;
}

.conn-meta {
  display: flex;
  gap: var(--spacing-md);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.connection-actions {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
}

/* Modal */
.quick-config-modal {
  :deep(.el-dialog) {
    border-radius: var(--radius);
    overflow: hidden;
  }
  
  :deep(.el-dialog__body) {
    padding: var(--spacing-md);
  }
}

/* Responsywność */
@media (max-width: 768px) {
  .ssh-settings {
    padding: var(--spacing-sm);
  }
  
  .header-main {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .header-actions {
    align-items: stretch;
    min-width: auto;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .status-cards {
    grid-template-columns: 1fr;
  }
  
  .connections-grid {
    grid-template-columns: 1fr;
  }
  
  .address-row {
    grid-template-columns: 1fr;
  }
}
</style>
