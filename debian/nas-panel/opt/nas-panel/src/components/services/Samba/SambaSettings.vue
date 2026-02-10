<template>
  <div class="samba-settings">
    <el-alert
      v-if="!serviceStatus.running"
      title="Usługa Samba jest wyłączona"
      type="warning"
      :closable="false"
      show-icon
      class="service-alert"
    />

    <div class="section-header">
      <h2>
        <Icon icon="mdi:cog" width="24" height="24" class="header-icon" />
        <span>Ustawienia Samba</span>
      </h2>
    </div>

    <el-tabs type="border-card" class="clean-settings-tabs">
      <el-tab-pane label="Główne">
        <div class="tab-content">
          <el-form :model="settings" label-width="250px" label-position="left" class="settings-form">
            <el-form-item label="Workgroup">
              <el-input v-model="settings.workgroup" placeholder="np. WORKGROUP" />
            </el-form-item>
            <el-form-item label="Tryb bezpieczeństwa">
              <el-select v-model="settings.security" placeholder="Wybierz tryb bezpieczeństwa">
                <el-option label="User" value="user" />
                <el-option label="Share" value="share" />
                <el-option label="Domain" value="domain" />
              </el-select>
            </el-form-item>
            <el-form-item label="Interfejsy">
              <el-input v-model="settings.interfaces" placeholder="np. eth0, wlan0" />
              <div class="form-hint">Lista interfejsów oddzielonych przecinkami</div>
            </el-form-item>
            <el-form-item label="Bind tylko do interfejsów">
              <div class="switch-wrapper">
                <el-switch v-model="settings.bindInterfacesOnly" />
                <span class="switch-description">Ogranicza nasłuchiwanie tylko do podanych interfejsów</span>
              </div>
            </el-form-item>
            <el-form-item label="Poziom logowania">
              <div class="log-level-wrapper">
                <el-input-number 
                  v-model="settings.logLevel" 
                  :min="0" 
                  :max="10" 
                  :step="1"
                  controls-position="right"
                />
                <div class="form-hint">0 - brak logów, 10 - pełne logowanie</div>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="Katalogi domowe">
        <div class="tab-content">
          <el-form :model="homeSettings" label-width="300px" label-position="left" class="settings-form">
            <el-form-item label="Włączone">
              <div class="switch-wrapper">
                <el-switch v-model="homeSettings.enabled" />
                <div class="form-hint">Aktywuje obsługę katalogów domowych</div>
              </div>
            </el-form-item>

            <template v-if="homeSettings.enabled">
              <el-form-item label="Włącz katalogi domowe użytkowników">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.enableUserHomes" />
                  <div class="form-hint">Udostępnia automatycznie katalogi domowe użytkowników</div>
                </div>
              </el-form-item>

              <el-form-item label="Do przeglądania">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.browsable" />
                  <div class="form-hint">Kontroluje widoczność udziału na liście dostępnych udziałów</div>
                </div>
              </el-form-item>

              <el-form-item label="Dziedzicz ACL-y">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.inheritAcls" />
                  <div class="form-hint">Zapewnia honorowanie ACL-ów z katalogów nadrzędnych</div>
                </div>
              </el-form-item>

              <el-form-item label="Dziedzicz uprawnienia">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.inheritPermissions" />
                  <div class="form-hint">Nadpisuje domyślne maski uprawnień</div>
                </div>
              </el-form-item>

              <el-form-item label="Włącz kosz">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.enableRecycleBin" />
                  <div class="form-hint">Tworzy kosz dla każdego użytkownika</div>
                </div>
              </el-form-item>

              <el-form-item label="Podążaj za dowiązaniami symbolicznymi">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.followSymlinks" />
                  <div class="form-hint">Zezwala na obsługę dowiązań symbolicznych</div>
                </div>
              </el-form-item>

              <el-form-item label="Szerokie linki" v-if="homeSettings.followSymlinks">
                <div class="switch-wrapper">
                  <el-switch v-model="homeSettings.wideLinks" />
                  <div class="form-hint">Zezwala na dowiązania poza katalogiem domowym</div>
                </div>
              </el-form-item>
            </template>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <div class="action-buttons">
      <el-button type="primary" @click="saveSettings" :loading="saving" class="save-btn">
        <Icon icon="mdi:content-save" width="16" />
        Zapisz ustawienia
      </el-button>
      <el-button @click="restartService" :loading="restarting" :disabled="!serviceStatus.running" class="restart-btn">
        <Icon icon="mdi:restart" width="16" />
        Restartuj usługę
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import SambaService from './api.js';

const props = defineProps({
  serviceStatus: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['service-restarted']);

const settings = ref({
  workgroup: 'WORKGROUP',
  security: 'user',
  interfaces: '',
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

onMounted(() => {
  loadSettings();
});

async function loadSettings() {
  try {
    const [mainSettings, homeSettingsRes] = await Promise.all([
      SambaService.getSettings(),
      SambaService.getHomeDirSettings()
    ]);
    
    settings.value = {
      workgroup: 'WORKGROUP',
      security: 'user',
      interfaces: '',
      bindInterfacesOnly: false,
      logLevel: 1,
      ...mainSettings.data
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
      ...homeSettingsRes.data
    };
  } catch (error) {
    ElMessage.error('Błąd ładowania ustawień: ' + error.message);
  }
}

async function saveSettings() {
  try {
    saving.value = true;
    
    const settingsToSend = {
      settings: {
        workgroup: settings.value.workgroup || 'WORKGROUP',
        security: settings.value.security || 'user',
        interfaces: settings.value.interfaces || 'eth0',
        bindInterfacesOnly: settings.value.bindInterfacesOnly !== false,
        logLevel: settings.value.logLevel || 1
      }
    };
    
    const homeSettingsToSend = {
      enabled: homeSettings.value.enabled || false,
      enableUserHomes: homeSettings.value.enableUserHomes || false,
      browsable: homeSettings.value.browsable !== false,
      inheritAcls: homeSettings.value.inheritAcls !== false,
      inheritPermissions: homeSettings.value.inheritPermissions || false,
      enableRecycleBin: homeSettings.value.enableRecycleBin !== false,
      followSymlinks: homeSettings.value.followSymlinks || false,
      wideLinks: homeSettings.value.wideLinks || false
    };

    await Promise.all([
      SambaService.updateSettings(settingsToSend),
      SambaService.updateHomeDirSettings(homeSettingsToSend)
    ]);
    ElMessage.success('Ustawienia zapisane pomyślnie');
  } catch (error) {
    console.error('Save settings error:', error);
    ElMessage.error('Błąd zapisywania ustawień: ' + (error.response?.data?.error || error.message));
  } finally {
    saving.value = false;
  }
}

async function restartService() {
  try {
    restarting.value = true;
    await SambaService.restartService();
    ElMessage.success('Usługa zrestartowana pomyślnie');
    emit('service-restarted');
  } catch (error) {
    ElMessage.error('Błąd restartowania usługi: ' + error.message);
  } finally {
    restarting.value = false;
  }
}
</script>

<style scoped lang="scss">
.samba-settings {
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --radius: 8px;
  --card-bg: var(--el-bg-color);
  --border-color: var(--el-border-color);
  --text-primary: var(--el-text-color-primary);
  --text-secondary: var(--el-text-color-secondary);
}

.service-alert {
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius);
}

.section-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  
  h2 {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.header-icon {
  color: var(--el-color-primary);
}

.clean-settings-tabs {
  background: var(--card-bg);
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  overflow: hidden;
  
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
    height: 44px;
    padding: 0 20px;
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
  padding: var(--spacing-md);
}

.settings-form {
  :deep(.el-form-item) {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
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
  }
}

.switch-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.switch-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  flex: 1;
}

.log-level-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.save-btn,
.restart-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
</style>
