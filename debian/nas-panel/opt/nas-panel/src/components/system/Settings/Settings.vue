<template>
  <div class="system-settings">
    <el-card shadow="hover" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:cog" />
          </el-icon>
          <span>{{ $t('settings.systemSettings') }}</span>
        </div>
      </template>

      <div v-if="loading" class="loading-spinner">
        <el-icon :size="32" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
      </div>

      <el-form v-else ref="settingsForm" :model="settings" label-position="top">
        <!-- Sekcja Dockera -->
        <el-divider content-position="left">
          <el-icon><Icon icon="mdi:docker" /></el-icon>
          {{ $t('settings.dockerSettings') }}
        </el-divider>

        <el-form-item :label="$t('settings.dockerComposeDir')">
          <el-input v-model="settings.docker.composeDir" :placeholder="$t('settings.dockerComposeDirPlaceholder')">
            <template #append>
              <el-button @click="browseDirectory('docker.composeDir')">
               <Icon icon="mdi:folder-search" />
              </el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('settings.dockerDataRoot')">
          <el-input v-model="settings.docker.dataRoot" :placeholder="$t('settings.dockerDataRootPlaceholder')">
            <template #append>
              <el-button @click="browseDirectory('docker.dataRoot')">
               <Icon icon="mdi:folder-search" />
              </el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('settings.dockerAutoStart')">
          <el-switch v-model="settings.docker.autoStart" />
        </el-form-item>

        <!-- Sekcja ogólnych ustawień systemu -->
        <el-divider content-position="left">
          <el-icon><Icon icon="mdi:server" /></el-icon>
          {{ $t('settings.generalSettings') }}
        </el-divider>

        <el-form-item :label="$t('settings.hostname')">
          <el-input v-model="settings.system.hostname" />
        </el-form-item>

        <el-form-item :label="$t('settings.timezone')">
          <el-select v-model="settings.system.timezone" filterable>
            <el-option 
              v-for="tz in timezones" 
              :key="tz" 
              :label="tz" 
              :value="tz" 
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('settings.language')">
          <el-select v-model="settings.system.language" @change="changeLanguage">
            <el-option label="Polski" value="pl" />
            <el-option label="English" value="en" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('settings.autoUpdates')">
          <el-switch v-model="settings.system.autoUpdates" />
        </el-form-item>

        <!-- Sekcja ustawień interfejsu -->
        <el-divider content-position="left">
          <el-icon><Icon icon="mdi:monitor-dashboard" /></el-icon>
          {{ $t('settings.uiSettings') }}
        </el-divider>

        <el-form-item :label="$t('settings.theme')">
          <el-select v-model="settings.ui.theme">
            <el-option label="Light" value="light" />
            <el-option label="Dark" value="dark" />
            <el-option label="System" value="system" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('settings.sidebarMode')">
          <el-select v-model="settings.ui.sidebarMode">
            <el-option :label="$t('settings.sidebarVertical')" value="vertical" />
            <el-option :label="$t('settings.sidebarHorizontal')" value="horizontal" />
          </el-select>
        </el-form-item>

        <!-- Przyciski akcji -->
        <div class="action-buttons">
          <el-button type="primary" @click="saveSettings" :loading="saving">
            {{ $t('settings.save') }}
          </el-button>
          <el-button @click="resetSettings">
            {{ $t('settings.reset') }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'

const settings = ref({
  docker: {
    composeDir: '/opt/docker/compose',
    dataRoot: '/var/lib/docker',
    autoStart: true
  },
  system: {
    hostname: '',
    timezone: 'Europe/Warsaw',
    language: 'pl',
    autoUpdates: false
  },
  ui: {
    theme: 'system',
    sidebarMode: 'vertical'
  }
})

const loading = ref(true)
const saving = ref(false)
const timezones = ref([
  'Europe/Warsaw',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo'
])

const fetchSettings = async () => {
  try {
    loading.value = true
    const response = await axios.get('/system/settings')
    settings.value = response.data
  } catch (error) {
    ElMessage.error('Failed to load settings')
    console.error(error)
    // W przypadku błędu użyj domyślnych ustawień
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  try {
    saving.value = true
    await axios.post('/system/settings', settings.value)
    ElMessage.success('Settings saved successfully')
    
    if (i18n.global.locale.value !== settings.value.system.language) {
      window.location.reload()
    }
  } catch (error) {
    ElMessage.error('Failed to save settings')
    console.error(error)
    throw error // Pozwól wyłapać błąd w komponencie nadrzędnym
  } finally {
    saving.value = false
  }
}
const resetSettings = () => {
  fetchSettings()
}

const changeLanguage = (lang) => {
  i18n.global.locale.value = lang
}

const browseDirectory = (field) => {
  // Tutaj można dodać logikę otwierania dialogu wyboru folderu
  console.log('Browsing directory for field:', field)
}

onMounted(() => {
  fetchSettings()
})
</script>

<style scoped>
.system-settings {
  padding: 20px;
}

.settings-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.el-divider {
  margin: 30px 0;
}

.el-divider__text {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
