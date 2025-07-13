<template>
  <div class="modern-docker-settings">
    <el-card class="settings-card" shadow="never">
      <div class="card-header">
        <div class="header-title">
          <el-icon class="header-icon"><Icon icon="mdi:docker" /></el-icon>
          <h2>{{ $t('docker.settings.title') }}</h2>
        </div>
        <div class="header-actions">
          <el-button type="primary" @click="saveSettings" :loading="saving" size="large" round>
            {{ $t('common.save') }}
          </el-button>
          <el-button @click="resetForm" size="large" round>
            {{ $t('common.reset') }}
          </el-button>
        </div>
      </div>

      <div class="settings-grid">
        <!-- Column 1 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:connection" /></el-icon>
              <span>Connection</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.daemonPort')" label-position="top">
                <el-input-number v-model="form.daemonPort" :min="1" :max="65535" controls-position="right" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.hosts')" label-position="top">
                <el-select
                  v-model="form.hosts"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  :placeholder="$t('docker.settings.hostsPlaceholder')"
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
              <span>Storage</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.dataRoot')" label-position="top">
                <el-input v-model="form.dataRoot" placeholder="/var/lib/docker" />
              </el-form-item>
              
              <el-form-item :label="$t('docker.settings.containerd')" label-position="top">
                <el-input v-model="form.containerd" placeholder="/run/containerd/containerd.sock" />
              </el-form-item>
            </div>
          </div>
        </div>

        <!-- Column 2 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:network" /></el-icon>
              <span>Network</span>
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
            </div>
          </div>

          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:download" /></el-icon>
              <span>Transfer</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.maxConcurrentDownloads')" label-position="top">
                <el-input-number v-model="form.maxConcurrentDownloads" :min="1" :max="10" controls-position="right" />
              </el-form-item>

              <el-form-item :label="$t('docker.settings.maxConcurrentUploads')" label-position="top">
                <el-input-number v-model="form.maxConcurrentUploads" :min="1" :max="10" controls-position="right" />
              </el-form-item>
              
              <el-form-item :label="$t('docker.settings.maxDownloadAttempts')" label-position="top">
                <el-input-number v-model="form.maxDownloadAttempts" :min="1" :max="10" controls-position="right" />
              </el-form-item>
            </div>
          </div>
        </div>

        <!-- Column 3 -->
        <div class="settings-column">
          <div class="settings-group">
            <h3 class="group-title">
              <el-icon><Icon icon="mdi:console-line" /></el-icon>
              <span>Logging</span>
            </h3>
            <div class="form-items">
              <el-form-item :label="$t('docker.settings.loggingDriver')" label-position="top">
                <el-select v-model="form.loggingDriver">
                  <el-option label="json-file" value="json-file" />
                  <el-option label="syslog" value="syslog" />
                  <el-option label="journald" value="journald" />
                  <el-option label="gelf" value="gelf" />
                  <el-option label="fluentd" value="fluentd" />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('docker.settings.logLevel')" label-position="top">
                <el-select v-model="form.logLevel">
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
              <span>Advanced</span>
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
import { ref, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save']);

const form = ref({
  daemonPort: 2375,
  hosts: ['tcp://0.0.0.0:2375', 'unix:///var/run/docker.sock'],
  ipv6Enabled: false,
  loggingDriver: 'json-file',
  logLevel: 'debug',
  maxConcurrentDownloads: 3,
  maxConcurrentUploads: 5,
  maxDownloadAttempts: 10,
  dataRoot: '/var/lib/docker',
  containerd: '/run/containerd/containerd.sock',
  experimental: false,
  debug: true,
  liveRestore: true,
  iptables: false,
  ip6tables: false
});

const loading = ref(true);
const saving = ref(false);
const settingsForm = ref(null);

// Initialize form with props
const initializeForm = () => {
  if (props.config) {
    form.value = {
      daemonPort: props.config.daemonPort || 2375,
      hosts: props.config.hosts || ['tcp://0.0.0.0:2375', 'unix:///var/run/docker.sock'],
      ipv6Enabled: props.config.ipv6Enabled || false,
      loggingDriver: props.config.loggingDriver || 'json-file',
      logLevel: props.config.logLevel || 'debug',
      maxConcurrentDownloads: props.config.maxConcurrentDownloads || 3,
      maxConcurrentUploads: props.config.maxConcurrentUploads || 5,
      maxDownloadAttempts: props.config.maxDownloadAttempts || 10,
      dataRoot: props.config.dataRoot || '/var/lib/docker',
      containerd: props.config.containerd || '/run/containerd/containerd.sock',
      experimental: props.config.experimental || false,
      debug: props.config.debug !== undefined ? props.config.debug : true,
      liveRestore: props.config.liveRestore !== undefined ? props.config.liveRestore : true,
      iptables: props.config.iptables || false,
      ip6tables: props.config.ip6tables || false
    };
  }
  loading.value = false;
};

watch(() => props.config, (newConfig) => {
  if (newConfig) {
    form.value = { ...newConfig };
  }
}, { immediate: true });

const saveSettings = async () => {
  try {
    saving.value = true;
    await emit('save', form.value);
    ElMessage.success(t('docker.messages.saveSuccess'));
  } catch (error) {
    ElMessage.error(t('docker.messages.saveError'));
  } finally {
    saving.value = false;
  }
};

const resetForm = () => {
  initializeForm();
};

onMounted(() => {
  initializeForm();
});
</script>

<style scoped>
.modern-docker-settings {
  padding: 24px;
}

.settings-card {
  border: none;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.header-icon {
  font-size: 24px;
  color: #2496ed; /* Docker blue */
}

.header-actions {
  display: flex;
  gap: 12px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  padding: 24px;
}

.settings-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-group {
  background-color: #fafafa;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
}

.settings-group:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.group-title .el-icon {
  font-size: 18px;
  color: #666;
}

.form-items {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  color: #666;
  padding-bottom: 6px;
  line-height: 1.4;
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-select) {
  width: 100%;
}

@media (max-width: 1200px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
