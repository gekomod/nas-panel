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

      <el-tabs v-model="activeTab" type="card">
        <!-- Zakładka Docker -->
        <el-tab-pane label="Docker" name="docker">
          <div v-if="loading" class="loading-spinner">
            <el-icon :size="32" class="is-loading">
              <Icon icon="mdi:loading" />
            </el-icon>
          </div>

          <el-form v-else ref="dockerForm" :model="settings.docker" label-position="top">
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
          </el-form>
        </el-tab-pane>

        <!-- Zakładka System -->
        <el-tab-pane label="System" name="system">
          <el-form ref="systemForm" :model="settings.system" label-position="top">
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
          </el-form>
        </el-tab-pane>

        <!-- Zakładka UI -->
        <el-tab-pane label="Interfejs" name="ui">
          <el-form ref="uiForm" :model="settings.ui" label-position="top">
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
          </el-form>
        </el-tab-pane>

        <!-- Nowa zakładka Usługi -->
        <el-tab-pane label="Usługi" name="services">
          <el-form ref="servicesForm" :model="settings.services" label-position="top">
            <el-checkbox-group v-model="settings.services.monitoredServices">
              <el-checkbox 
                v-for="service in availableServices" 
                :key="service.value" 
                :label="service.value"
              >
                <div class="service-checkbox">
                  <Icon :icon="service.icon" width="18" />
                  <span>{{ service.label }}</span>
                </div>
              </el-checkbox>
            </el-checkbox-group>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <!-- Przyciski akcji -->
      <div class="action-buttons">
        <el-button type="primary" @click="saveSettings" :loading="saving">
          {{ $t('settings.save') }}
        </el-button>
        <el-button @click="resetSettings">
          {{ $t('settings.reset') }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'

const activeTab = ref('docker')

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
  },
  services: {
    monitoredServices: []
  }
})

const availableServices = ref([
  { value: 'nas-web', label: 'Web Server', icon: 'mdi:server' },
  { value: 'nas-webdav', label: 'Dav Server', icon: 'mdi:folder-network' },
  { value: 'docker', label: 'Docker', icon: 'mdi:docker' },
  { value: 'ssh', label: 'SSH', icon: 'mdi:lock' },
  { value: 'cron', label: 'Cron', icon: 'mdi:clock' },
  { value: 'smbd', label: 'Samba', icon: 'mdi:folder-network' },
  { value: 'nginx', label: 'NGINX', icon: 'mdi:nginx' },
  { value: 'mysql', label: 'MySQL', icon: 'mdi:database' },
  { value: 'postgresql', label: 'PostgreSQL', icon: 'mdi:database' }
])

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
    // Upewnij się, że monitoredServices jest tablicą
    if (response.data.services?.monitoredServices) {
      response.data.services.monitoredServices = Array.isArray(response.data.services.monitoredServices) 
        ? response.data.services.monitoredServices 
        : []
    }
    settings.value = response.data
  } catch (error) {
    ElMessage.error('Failed to load settings')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  try {
    saving.value = true
    await axios.post('/system/settings', settings.value)
    ElMessage.success('Ustawienia zapisane')
    
    if (i18n.global.locale.value !== settings.value.system.language) {
      window.location.reload()
    }
  } catch (error) {
    ElMessage.error('Błąd zapisywania ustawień')
    console.error(error)
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

.service-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.el-checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}
</style>
