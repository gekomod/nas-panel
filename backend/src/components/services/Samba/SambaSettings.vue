<template>
  <div class="samba-settings">
    <!-- Alert o wyłączonej usłudze -->
    <el-alert
      v-if="!serviceStatus.running"
      :title="$t('samba.alerts.serviceStopped.title')"
      type="warning"
      :closable="false"
      show-icon
      class="service-alert"
    />

    <div class="settings-header">
      <h3>
        <Icon icon="mdi:cog" width="20" />
        <span>{{ $t('samba.settings.title') }}</span>
      </h3>
    </div>

    <!-- Karty ustawień -->
    <div class="settings-tabs">
      <el-tabs v-model="activeTab" class="compact-tabs">
        <!-- Zakładka główna -->
        <el-tab-pane :label="$t('samba.settings.tabs.general')" name="general">
          <div class="settings-card">
            <h4 class="card-title">{{ $t('samba.settings.general.title') }}</h4>
            <el-form :model="settings" label-width="200px" size="small">
              <el-form-item :label="$t('samba.settings.general.workgroup')">
                <el-input v-model="settings.workgroup" />
                <div class="form-hint">{{ $t('samba.settings.general.workgroupHint') }}</div>
              </el-form-item>
              
              <el-form-item :label="$t('samba.settings.general.security')">
                <el-select v-model="settings.security">
                  <el-option label="User" value="user" />
                  <el-option label="Share" value="share" />
                  <el-option label="Domain" value="domain" />
                </el-select>
                <div class="form-hint">{{ $t('samba.settings.general.securityHint') }}</div>
              </el-form-item>
              
              <el-form-item :label="$t('samba.settings.general.interfaces')">
                <el-input v-model="settings.interfaces" placeholder="eth0, wlan0" />
                <div class="form-hint">{{ $t('samba.settings.general.interfacesHint') }}</div>
              </el-form-item>
              
              <el-form-item :label="$t('samba.settings.general.bindInterfacesOnly')">
                <el-switch v-model="settings.bindInterfacesOnly" />
                <div class="form-hint">{{ $t('samba.settings.general.bindInterfacesOnlyHint') }}</div>
              </el-form-item>
              
              <el-form-item :label="$t('samba.settings.general.logLevel')">
                <el-input-number 
                  v-model="settings.logLevel" 
                  :min="0" 
                  :max="10" 
                  size="small"
                />
                <div class="form-hint">{{ $t('samba.settings.general.logLevelHint') }}</div>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- Zakładka katalogi domowe -->
        <el-tab-pane :label="$t('samba.settings.tabs.homeDirs')" name="home">
          <div class="settings-card">
            <h4 class="card-title">{{ $t('samba.settings.homeDirs.title') }}</h4>
            <el-form :model="homeSettings" label-width="250px" size="small">
              <el-form-item :label="$t('samba.settings.homeDirs.enabled')">
                <el-switch v-model="homeSettings.enabled" />
                <div class="form-hint">{{ $t('samba.settings.homeDirs.enabledHint') }}</div>
              </el-form-item>

              <template v-if="homeSettings.enabled">
                <el-form-item :label="$t('samba.settings.homeDirs.enableUserHomes')">
                  <el-switch v-model="homeSettings.enableUserHomes" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.enableUserHomesHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('samba.settings.homeDirs.browsable')">
                  <el-switch v-model="homeSettings.browsable" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.browsableHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('samba.settings.homeDirs.inheritAcls')">
                  <el-switch v-model="homeSettings.inheritAcls" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.inheritAclsHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('samba.settings.homeDirs.inheritPermissions')">
                  <el-switch v-model="homeSettings.inheritPermissions" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.inheritPermissionsHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('samba.settings.homeDirs.enableRecycleBin')">
                  <el-switch v-model="homeSettings.enableRecycleBin" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.enableRecycleBinHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('samba.settings.homeDirs.followSymlinks')">
                  <el-switch v-model="homeSettings.followSymlinks" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.followSymlinksHint') }}</div>
                </el-form-item>

                <el-form-item 
                  v-if="homeSettings.followSymlinks" 
                  :label="$t('samba.settings.homeDirs.wideLinks')"
                >
                  <el-switch v-model="homeSettings.wideLinks" />
                  <div class="form-hint">{{ $t('samba.settings.homeDirs.wideLinksHint') }}</div>
                </el-form-item>
              </template>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Przyciski akcji -->
      <div class="action-buttons">
        <el-button 
          type="primary" 
          @click="saveSettings" 
          :loading="saving"
          size="small"
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
          {{ $t('samba.actions.restart') }}
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
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps({
  serviceStatus: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['service-restarted']);

const activeTab = ref('general');
const settings = ref({
  workgroup: 'WORKGROUP',
  security: 'user',
  interfaces: 'eth0',
  bindInterfacesOnly: false,
  logLevel: 1
});

const homeSettings = ref({
  enabled: false,
  enableUserHomes: false,
  browsable: true,
  inheritAcls: true,
  inheritPermissions: false,
  enableRecycleBin: true,
  followSymlinks: false,
  wideLinks: false
});

const saving = ref(false);
const restarting = ref(false);
const originalSettings = ref(null);
const originalHomeSettings = ref(null);

onMounted(() => {
  loadSettings();
});

async function loadSettings() {
  try {
    const [mainResponse, homeResponse] = await Promise.all([
      axios.get('/services/samba/settings'),
      axios.get('/services/samba/settings/home')
    ]);
    
    settings.value = {
      workgroup: 'WORKGROUP',
      security: 'user',
      interfaces: 'eth0',
      bindInterfacesOnly: false,
      logLevel: 1,
      ...mainResponse.data
    };
    
    homeSettings.value = {
      enabled: false,
      enableUserHomes: false,
      browsable: true,
      inheritAcls: true,
      inheritPermissions: false,
      enableRecycleBin: true,
      followSymlinks: false,
      wideLinks: false,
      ...homeResponse.data
    };
    
    // Zapisz oryginalne ustawienia do resetu
    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    originalHomeSettings.value = JSON.parse(JSON.stringify(homeSettings.value));
  } catch (error) {
    console.error('Błąd ładowania ustawień:', error);
    ElMessage.error('Błąd ładowania ustawień');
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await Promise.all([
      axios.put('/services/samba/settings', settings.value),
      axios.put('/services/samba/settings/home', homeSettings.value)
    ]);
    
    ElMessage.success('Ustawienia zapisane');
    // Zaktualizuj oryginalne ustawienia
    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    originalHomeSettings.value = JSON.parse(JSON.stringify(homeSettings.value));
  } catch (error) {
    console.error('Błąd zapisywania ustawień:', error);
    ElMessage.error(error.response?.data?.error || 'Błąd zapisywania ustawień');
  } finally {
    saving.value = false;
  }
}

function resetSettings() {
  if (originalSettings.value) {
    settings.value = JSON.parse(JSON.stringify(originalSettings.value));
  }
  if (originalHomeSettings.value) {
    homeSettings.value = JSON.parse(JSON.stringify(originalHomeSettings.value));
  }
  ElMessage.info('Ustawienia zresetowane do ostatnio zapisanych');
}

async function restartService() {
  restarting.value = true;
  try {
    await axios.post('/services/samba/restart');
    ElMessage.success('Usługa zrestartowana');
    emit('service-restarted');
  } catch (error) {
    ElMessage.error('Błąd restartowania usługi');
  } finally {
    restarting.value = false;
  }
}
</script>

<style scoped lang="scss">
.samba-settings {
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --radius: 6px;
}

.service-alert {
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius);
}

.settings-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.settings-header h3 {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-header .iconify {
  color: #6366f1;
}

.settings-tabs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.compact-tabs {
  :deep(.el-tabs__header) {
    margin: 0;
  }
  
  :deep(.el-tabs__nav-wrap) {
    &::after {
      display: none;
    }
  }
  
  :deep(.el-tabs__item) {
    padding: 0 var(--spacing-md);
    height: 40px;
    font-size: 0.875rem;
    
    &.is-active {
      font-weight: 600;
    }
  }
  
  :deep(.el-tabs__active-bar) {
    height: 2px;
  }
}

.settings-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: var(--spacing-md);
}

.card-title {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-form) {
  .el-form-item {
    margin-bottom: var(--spacing-md);
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .el-form-item__label {
      font-weight: 500;
      color: var(--text-primary);
      padding-right: var(--spacing-md);
    }
  }
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  
  .el-button {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }
}
</style>
