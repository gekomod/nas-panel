<template>
  <div class="samba-settings">
    <!-- Alert dla nie zainstalowanej usługi -->
    <el-alert
      v-if="!serviceStatus.installed"
      :title="$t('samba.status.notInstalled')"
      type="warning"
      :closable="false"
      show-icon
      class="service-alert"
    />
    
    <!-- Alert dla wyłączonej usługi -->
    <el-alert
      v-if="serviceStatus.installed && !serviceStatus.running"
      :title="$t('samba.status.serviceStopped')"
      type="info"
      :closable="false"
      show-icon
      class="service-alert"
    />

    <!-- Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:cog" />
          </div>
          <div class="header-text">
            <h2>{{ $t('samba.settings.title') }}</h2>
            <p class="subtitle">{{ $t('samba.settings.subtitle') }}</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Settings Tabs -->
    <el-tabs type="border-card" class="clean-settings-tabs">
      <el-tab-pane :label="$t('samba.settings.general')">
        <div class="tab-content">
          <el-form :model="settings" label-width="200px" label-position="left" class="settings-form">
            <el-form-item :label="$t('samba.settings.workgroup')">
              <el-input 
                v-model="settings.workgroup" 
                :placeholder="$t('samba.settings.workgroupPlaceholder')"
                size="small"
              />
            </el-form-item>
            
            <el-form-item :label="$t('samba.settings.serverString')">
              <el-input 
                v-model="settings.serverString" 
                :placeholder="$t('samba.settings.serverStringPlaceholder')"
                size="small"
              />
            </el-form-item>
            
            <el-form-item :label="$t('samba.settings.securityMode')">
              <el-select 
                v-model="settings.security" 
                :placeholder="$t('samba.settings.selectSecurityMode')"
                size="small"
                style="width: 100%"
              >
                <el-option 
                  :label="$t('samba.settings.securityUser')" 
                  value="user" 
                />
                <el-option 
                  :label="$t('samba.settings.securityShare')" 
                  value="share" 
                />
                <el-option 
                  :label="$t('samba.settings.securityDomain')" 
                  value="domain" 
                />
                <el-option 
                  :label="$t('samba.settings.securityADS')" 
                  value="ads" 
                />
              </el-select>
            </el-form-item>
            
            <el-form-item :label="$t('samba.settings.interfaces')">
              <el-input 
                v-model="settings.interfaces" 
                :placeholder="$t('samba.settings.interfacesPlaceholder')"
                size="small"
              />
              <div class="form-hint">{{ $t('samba.settings.interfacesHint') }}</div>
            </el-form-item>
            
            <el-form-item :label="$t('samba.settings.bindInterfacesOnly')">
              <div class="switch-wrapper">
                <el-switch v-model="settings.bindInterfacesOnly" size="small" />
                <span class="switch-description">{{ $t('samba.settings.bindInterfacesOnlyHint') }}</span>
              </div>
            </el-form-item>
            
            <el-form-item :label="$t('samba.settings.logLevel')">
              <div class="log-level-wrapper">
                <el-input-number 
                  v-model="settings.logLevel" 
                  :min="0" 
                  :max="10" 
                  :step="1"
                  controls-position="right"
                  size="small"
                />
                <div class="form-hint">{{ $t('samba.settings.logLevelHint') }}</div>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="$t('samba.settings.homeDirectories')">
        <div class="tab-content">
          <el-form :model="homeSettings" label-width="250px" label-position="left" class="settings-form">
            <el-form-item :label="$t('samba.settings.enableHomeDirs')">
              <div class="switch-wrapper">
                <el-switch v-model="homeSettings.enabled" size="small" />
                <div class="form-hint">{{ $t('samba.settings.enableHomeDirsHint') }}</div>
              </div>
            </el-form-item>

            <template v-if="homeSettings.enabled">
              <el-form-item :label="$t('samba.settings.browsable')">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.browsable" size="small" />
                  <div class="form-hint">{{ $t('samba.settings.browsableHint') }}</div>
                </div>
              </el-form-item>

              <el-form-item :label="$t('samba.settings.inheritAcls')">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.inheritAcls" size="small" />
                  <div class="form-hint">{{ $t('samba.settings.inheritAclsHint') }}</div>
                </div>
              </el-form-item>
            </template>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <el-button 
        type="primary" 
        @click="saveSettings" 
        :loading="saving" 
        size="small"
        class="save-btn"
        :disabled="!serviceStatus.installed"
      >
        <Icon icon="mdi:content-save" width="14" />
        {{ $t('common.save') }}
      </el-button>
      
      <el-button 
        @click="restartService" 
        :loading="restarting" 
        :disabled="!serviceStatus.running"
        size="small"
        class="restart-btn"
      >
        <Icon icon="mdi:restart" width="14" />
        {{ $t('samba.settings.restartService') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const { t } = useI18n();
const props = defineProps({
  serviceStatus: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['service-restarted']);

const settings = ref({
  workgroup: 'WORKGROUP',
  serverString: '%h server (Samba)',
  security: 'user',
  interfaces: '',
  bindInterfacesOnly: false,
  logLevel: 1
});

const homeSettings = ref({
  enabled: false,
  browsable: true,
  inheritAcls: true
});

const saving = ref(false);
const restarting = ref(false);

onMounted(() => {
  loadSettings();
});

async function loadSettings() {
  try {
    const [mainSettings, homeSettingsRes] = await Promise.all([
      axios.get('/services/samba/settings'),
      axios.get('/services/samba/settings/homedirs')
    ]);
    
    if (mainSettings.data.success) {
      settings.value = {
        workgroup: 'WORKGROUP',
        serverString: '%h server (Samba)',
        security: 'user',
        interfaces: '',
        bindInterfacesOnly: false,
        logLevel: 1,
        ...mainSettings.data.data
      };
    }
    
    if (homeSettingsRes.data.success) {
      homeSettings.value = {
        enabled: false,
        browsable: true,
        inheritAcls: true,
        ...homeSettingsRes.data.data
      };
    }
  } catch (error) {
    ElMessage.error(t('samba.settings.errors.loadFailed'));
  }
}

async function saveSettings() {
  try {
    saving.value = true;
    
    const settingsToSend = {
      settings: {
        workgroup: settings.value.workgroup || 'WORKGROUP',
        serverString: settings.value.serverString || '%h server (Samba)',
        security: settings.value.security || 'user',
        interfaces: settings.value.interfaces || '',
        bindInterfacesOnly: settings.value.bindInterfacesOnly !== false,
        logLevel: settings.value.logLevel || 1,
        homes: homeSettings.value.enabled ? homeSettings.value : null
      }
    };

    await axios.put('/services/samba/settings', settingsToSend);
    
    // Also save home directory settings separately
    if (homeSettings.value.enabled) {
      await axios.post('/services/samba/settings/homedirs', homeSettings.value);
    }
    
    ElMessage.success(t('samba.settings.messages.saved'));
  } catch (error) {
    console.error('Save settings error:', error);
    ElMessage.error(t('samba.settings.errors.saveFailed'));
  } finally {
    saving.value = false;
  }
}

async function restartService() {
  try {
    restarting.value = true;
    await axios.post('/services/samba/restart');
    ElMessage.success(t('samba.settings.messages.restarted'));
    emit('service-restarted');
  } catch (error) {
    ElMessage.error(t('samba.settings.errors.restartFailed'));
  } finally {
    restarting.value = false;
  }
}
</script>

<style scoped lang="scss">
.samba-settings {
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
}

.service-alert {
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-md);
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
  gap: var(--spacing-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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
  
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: var(--spacing-xs) 0 0;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

/* Tabs */
.clean-settings-tabs {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  overflow: hidden;
  margin-bottom: var(--spacing-lg);
  
  :deep(.el-tabs__header) {
    margin: 0;
    background: var(--el-fill-color-light);
  }
  
  :deep(.el-tabs__nav-wrap) {
    &::after {
      background-color: var(--border-color);
    }
  }
  
  :deep(.el-tabs__item) {
    height: 40px;
    padding: 0 16px;
    font-weight: 500;
    color: var(--text-secondary);
    
    &.is-active {
      color: var(--el-color-primary);
      background: var(--card-bg);
      border-bottom-color: var(--card-bg);
    }
    
    &:hover {
      color: var(--el-color-primary);
    }
  }
  
  :deep(.el-tabs__content) {
    padding: 0;
  }
}

.tab-content {
  padding: var(--spacing-lg);
}

/* Settings Form */
.settings-form {
  :deep(.el-form-item) {
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    
    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
  }
  
  :deep(.el-form-item__label) {
    color: var(--text-primary);
    font-weight: 500;
    padding-bottom: var(--spacing-sm);
    font-size: 13px;
  }
}

.switch-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.switch-description {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
}

.log-level-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-hint {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
  line-height: 1.4;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

.save-btn,
.restart-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .settings-form {
    :deep(.el-form-item__label) {
      width: 100% !important;
      margin-bottom: var(--spacing-sm);
    }
    
    :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
  }
  
  .action-buttons {
    flex-direction: column;
  }
}
</style>
