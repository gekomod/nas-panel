<template>
  <div class="samba-settings">
    <el-card>
      <template #header>
        <h2>
          <Icon icon="mdi:cog" width="24" height="24" />
          <span style="margin-left: 10px;">Ustawienia Samba</span>
        </h2>
      </template>

      <el-tabs type="border-card">
        <el-tab-pane label="Główne">
          <el-form :model="settings" label-width="250px" label-position="left">
            <el-form-item label="Workgroup">
              <el-input v-model="settings.workgroup" />
            </el-form-item>
            <el-form-item label="Tryb bezpieczeństwa">
              <el-select v-model="settings.security">
                <el-option label="User" value="user" />
                <el-option label="Share" value="share" />
                <el-option label="Domain" value="domain" />
              </el-select>
            </el-form-item>
            <el-form-item label="Interfejsy">
              <el-input v-model="settings.interfaces" />
            </el-form-item>
            <el-form-item label="Bind tylko do interfejsów">
              <el-switch v-model="settings.bindInterfacesOnly" />
            </el-form-item>
            <el-form-item label="Poziom logowania">
              <el-input-number v-model="settings.logLevel" :min="0" :max="10" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="Katalogi domowe">
          <el-form :model="homeSettings" label-width="300px" label-position="left">
            <el-form-item label="Włączone">
              <el-switch v-model="homeSettings.enabled" />
              <div class="form-hint">Aktywuje obsługę katalogów domowych</div>
            </el-form-item>

            <template v-if="homeSettings.enabled">
              <el-form-item label="Włącz katalogi domowe użytkowników">
                <el-switch v-model="homeSettings.enableUserHomes" />
                <div class="form-hint">Udostępnia automatycznie katalogi domowe użytkowników</div>
              </el-form-item>

              <el-form-item label="Do przeglądania">
                <el-switch v-model="homeSettings.browsable" />
                <div class="form-hint">Kontroluje widoczność udziału na liście dostępnych udziałów</div>
              </el-form-item>

              <el-form-item label="Dziedzicz ACL-y">
                <el-switch v-model="homeSettings.inheritAcls" />
                <div class="form-hint">Zapewnia honorowanie ACL-ów z katalogów nadrzędnych</div>
              </el-form-item>

              <el-form-item label="Dziedzicz uprawnienia">
                <el-switch v-model="homeSettings.inheritPermissions" />
                <div class="form-hint">Nadpisuje domyślne maski uprawnień</div>
              </el-form-item>

              <el-form-item label="Włącz kosz">
                <el-switch v-model="homeSettings.enableRecycleBin" />
                <div class="form-hint">Tworzy kosz dla każdego użytkownika</div>
              </el-form-item>

              <el-form-item label="Podążaj za dowiązaniami symbolicznymi">
                <el-switch v-model="homeSettings.followSymlinks" />
                <div class="form-hint">Zezwala na obsługę dowiązań symbolicznych</div>
              </el-form-item>

              <el-form-item label="Szerokie linki" v-if="homeSettings.followSymlinks">
                <el-switch v-model="homeSettings.wideLinks" />
                <div class="form-hint">Zezwala na dowiązania poza katalogiem domowym</div>
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="action-buttons">
        <el-button type="primary" @click="saveSettings" :loading="saving">
          Zapisz ustawienia
        </el-button>
        <el-button @click="restartService" :loading="restarting">
          Restartuj usługę
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import SambaService from './api.js';

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
      settings: {  // <-- Note the nested settings object
        workgroup: settings.value.workgroup || 'WORKGROUP',
        security: settings.value.security || 'user',
        interfaces: settings.value.interfaces || 'eth0',
        bindInterfacesOnly: settings.value.bindInterfacesOnly !== false,
        logLevel: settings.value.logLevel || 1
      }
    };
    
    // Ensure homeSettings has all required fields
    const homeSettingsToSend = {
      enabled: homeSettings.value.enabled || false,
      enableUserHomes: homeSettings.value.enableUserHomes || false,
      browsable: homeSettings.value.browsable !== false, // default true
      inheritAcls: homeSettings.value.inheritAcls !== false, // default true
      inheritPermissions: homeSettings.value.inheritPermissions || false,
      enableRecycleBin: homeSettings.value.enableRecycleBin !== false, // default true
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
  } catch (error) {
    ElMessage.error('Błąd restartowania usługi: ' + error.message);
  } finally {
    restarting.value = false;
  }
}
</script>

<style scoped>
.samba-settings {
  padding: 20px;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  margin-left: 10px;
  line-height: 1.4;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.el-tabs {
  margin-top: 20px;
}
</style>
