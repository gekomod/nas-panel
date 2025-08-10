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

          </el-form>
            <el-divider />

  <h3>{{ $t('settings.autoUpdatesTitle') }}</h3>
  <el-form :model="settings.updates" label-position="top">
    <el-form-item :label="$t('settings.enableAutoUpdates')">
      <el-switch v-model="settings.updates.autoUpdate" />
    </el-form-item>

    <el-form-item v-if="settings.updates.autoUpdate" :label="$t('settings.updateSchedule')">
      <el-select v-model="settings.updates.schedule">
        <el-option value="0 0 * * *" :label="$t('settings.dailyMidnight')" />
        <el-option value="0 0 * * 0" :label="$t('settings.weeklySunday')" />
        <el-option value="0 0 1 * *" :label="$t('settings.monthlyFirstDay')" />
      </el-select>
    </el-form-item>

    <el-form-item v-if="settings.updates.autoUpdate" :label="$t('settings.updateCommand')">
      <el-input v-model="settings.updates.updateCommand" />
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
                :value="service.value"
              >
                <div class="service-checkbox">
                  <Icon :icon="service.icon" width="18" />
                  <span>{{ service.label }}</span>
                </div>
              </el-checkbox>
            </el-checkbox-group>
          </el-form>
        </el-tab-pane>

                <!-- Nowa zakładka Serwer WWW -->
        <el-tab-pane label="Serwer WWW" name="webserver">
          <div v-if="loading" class="loading-spinner">
            <el-icon :size="32" class="is-loading">
              <Icon icon="mdi:loading" />
            </el-icon>
          </div>

          <el-form v-else ref="webserverForm" :model="settings.webserver" label-position="top">
            <h3>Podstawowe ustawienia</h3>
            <el-form-item label="Port serwera">
              <el-input-number v-model="settings.webserver.PORT" :min="1" :max="65535" />
            </el-form-item>

            <el-form-item label="Ścieżka do frontendu">
              <el-input 
                v-model="settings.webserver.FRONTEND_PATH" 
                :readonly="true"
                :disabled="true"
              >
                <template #append>
                  <el-tooltip content="Ta ścieżka jest ustalana podczas instalacji" placement="top">
                    <el-button :disabled="true">
                      <Icon icon="mdi:folder-search" />
                    </el-button>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="Prefiks API">
              <el-input 
                v-model="settings.webserver.API_PREFIX" 
                :readonly="true"
                :disabled="true"
                class="readonly-input"
              >
                <template #append>
                  <el-tooltip content="Wartość konfigurowana podczas wdrożenia" placement="top">
                    <el-button :disabled="true">
                      <Icon icon="mdi:api-off" />
                    </el-button>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>

            <el-divider />

            <h3>Performance Settings</h3>
            <el-form-item label="Max Worker Threads">
              <el-input-number 
                v-model="settings.webserver.MAX_THREADS" 
                :min="1" 
                :max="64"
                :step="1"
              />
              <span class="input-description">Number of worker threads for request processing</span>
            </el-form-item>

            <el-form-item label="Max Connections">
              <el-input-number 
                v-model="settings.webserver.MAX_CONNECTIONS" 
                :min="10" 
                :max="10000"
                :step="10"
              />
              <span class="input-description">Maximum simultaneous connections</span>
            </el-form-item>

            <el-form-item label="Connection Timeout (seconds)">
              <el-input-number 
                v-model="settings.webserver.CONNECTION_TIMEOUT" 
                :min="1" 
                :max="300"
              />
              <span class="input-description">Timeout for idle connections</span>
            </el-form-item>

            <el-divider />

            <h3>HTTPS</h3>
            <el-form-item label="Włącz HTTPS">
              <el-switch v-model="settings.webserver.ENABLE_HTTPS" />
            </el-form-item>

            <template v-if="settings.webserver.ENABLE_HTTPS">
              <el-form-item label="Ścieżka do certyfikatu SSL">
                <el-input v-model="settings.webserver.SSL_CERT_PATH">
                  <template #append>
                    <el-button @click="browseDirectory('webserver.SSL_CERT_PATH')">
                      <Icon icon="mdi:file-search" />
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="Ścieżka do klucza SSL">
                <el-input v-model="settings.webserver.SSL_KEY_PATH">
                  <template #append>
                    <el-button @click="browseDirectory('webserver.SSL_KEY_PATH')">
                      <Icon icon="mdi:file-search" />
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
            </template>

            <el-divider />
  
            <h3>HTTP/2 Configuration</h3>
            <el-form-item label="Enable HTTP/2">
              <el-switch 
                v-model="settings.webserver.HTTP2_ENABLED"
              />
            </el-form-item>

            <template v-if="settings.webserver.HTTP2_ENABLED">
              <el-form-item label="HTTP/2 Certificate Path">
                <el-input v-model="settings.webserver.HTTP2_CERT_PATH">
                  <template #append>
                    <el-button @click="browseDirectory('HTTP2_CERT_PATH')">
                      <Icon icon="mdi:file-certificate-outline" />
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="HTTP/2 Key Path">
                <el-input v-model="settings.webserver.HTTP2_KEY_PATH">
                  <template #append>
                    <el-button @click="browseDirectory('HTTP2_KEY_PATH')">
                      <Icon icon="mdi:key-outline" />
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="Max Concurrent Streams">
                <el-input-number 
                  v-model="settings.webserver.HTTP2_MAX_STREAMS" 
                  :min="1" 
                  :max="1000"
                />
              </el-form-item>

              <el-form-item label="Initial Window Size (bytes)">
                <el-input-number 
                  v-model="settings.webserver.HTTP2_WINDOW_SIZE" 
                  :min="65535" 
                  :max="2147483647"
                  :step="1024"
                />
              </el-form-item>
            </template>
            <template v-else>
              <el-alert type="info" :closable="false">
                HTTP/2 is currently disabled. Enable to configure advanced settings.
              </el-alert>
            </template>

            <el-divider />

            <h3>Cache</h3>
            <el-form-item label="Włącz cache">
              <el-switch v-model="settings.webserver.CACHE_ENABLED" />
            </el-form-item>

            <el-form-item label="Maksymalny rozmiar cache (MB)">
              <el-input-number 
                v-model="settings.webserver.CACHE_MAX_SIZE" 
                :min="1" 
                :max="1000"
                :controls-position="'right'"
              />
            </el-form-item>

            <el-form-item label="TTL cache (sekundy)">
              <el-input-number 
                v-model="settings.webserver.CACHE_TTL" 
                :min="60" 
                :max="86400"
                :controls-position="'right'"
              />
            </el-form-item>

            <el-divider />

            <h3>Bezpieczeństwo</h3>
            <el-form-item label="Włącz CORS">
              <el-switch v-model="settings.webserver.CORS_ENABLED" />
            </el-form-item>

            <el-form-item label="Włącz HSTS">
              <el-switch v-model="settings.webserver.HSTS_ENABLED" />
            </el-form-item>

            <el-form-item v-if="settings.webserver.HSTS_ENABLED" label="Maksymalny wiek HSTS (sekundy)">
              <el-input-number v-model="settings.webserver.HSTS_MAX_AGE" :min="0" :max="63072000" />
            </el-form-item>

            <el-divider />

            <h3>Logowanie</h3>
            <el-form-item label="Poziom logowania">
              <el-select v-model="settings.webserver.LOG_LEVEL">
                <el-option label="Debug" value="debug" />
                <el-option label="Info" value="info" />
                <el-option label="Warning" value="warning" />
                <el-option label="Error" value="error" />
              </el-select>
            </el-form-item>

            <el-form-item label="Plik logów">
              <el-input v-model="settings.webserver.LOG_FILE" 
                :readonly="true"
                :disabled="true"
                class="readonly-input">
                <template #append>
                  <el-tooltip content="Wartość konfigurowana automatycznie" placement="top">
                    <el-button :disabled="true">
                      <Icon icon="mdi:api-off" />
                    </el-button>
                  </el-tooltip>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="Maksymalny rozmiar logu (MB)">
              <el-input-number v-model="settings.webserver.LOG_MAX_SIZE" :min="1" :max="100" />
            </el-form-item>

            <el-form-item label="Liczba archiwalnych logów">
              <el-input-number v-model="settings.webserver.LOG_BACKUP_COUNT" :min="1" :max="20" />
            </el-form-item>

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
    language: 'pl'
  },
  ui: {
    theme: 'system',
    sidebarMode: 'vertical'
  },
  services: {
    monitoredServices: []
  },
  updates: {
    autoUpdate: false,
    schedule: '0 0 * * *',
    updateCommand: 'sudo apt-get update && sudo apt-get upgrade -y'
  },
  webserver: {
    PORT: 80,
    FRONTEND_PATH: '/opt/nas-panel/dist',
    API_PREFIX: '/api',
    ENABLE_HTTPS: false,
    SSL_CERT_PATH: '',
    SSL_KEY_PATH: '',
    CACHE_ENABLED: true,
    CACHE_MAX_SIZE: 100,
    CACHE_TTL: 3600,
    GZIP_ENABLED: true,
    GZIP_MIN_SIZE: 1024,
    CORS_ENABLED: true,
    HSTS_ENABLED: true,
    HSTS_MAX_AGE: 31536000,
    LOG_LEVEL: 'info',
    LOG_FILE: '/var/log/nas-web.log',
    LOG_MAX_SIZE: 10,
    LOG_BACKUP_COUNT: 5,
    MAX_THREADS: 10,
    MAX_CONNECTIONS: 100,
    CONNECTION_TIMEOUT: 30,
    HTTP2_ENABLED: false,
    HTTP2_CERT_PATH: '',
    HTTP2_KEY_PATH: '',
    HTTP2_MAX_STREAMS: 100,
    HTTP2_WINDOW_SIZE: 65536
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
    loading.value = true;
    
    // Pobierz standardowe ustawienia i konfigurację webservera równolegle
    const [mainSettingsResponse, webserverConfigResponse] = await Promise.all([
      axios.get('/system/settings'),
      axios.get('/system/webserver-config')
    ]);

    // Połącz ustawienia zachowując poprawną strukturę
    settings.value = {
      ...settings.value, // wartości domyślne
      ...mainSettingsResponse.data, // główne ustawienia z serwera
      webserver: {
        ...settings.value.webserver, // domyślne wartości webserver
        ...webserverConfigResponse.data // załadowana konfiguracja webservera
      }
    };

    // Upewnij się, że monitoredServices jest tablicą
    if (settings.value.services?.monitoredServices) {
      settings.value.services.monitoredServices = Array.isArray(settings.value.services.monitoredServices) 
        ? settings.value.services.monitoredServices 
        : [];
    } else {
      settings.value.services.monitoredServices = [];
    }

  } catch (error) {
    ElMessage.error('Failed to load settings');
    console.error(error);
    
    // W przypadku błędu przywróć domyślne wartości
    settings.value.services.monitoredServices = [];
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  try {
    saving.value = true
    await axios.post('/system/settings', {
      ...settings.value,
      webserver: undefined // Wyklucz webserver z głównego zapisu
    })

    await axios.post('/system/save-webserver-config', settings.value.webserver)
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

const checkSystemCronJob = async () => {
  try {
    const response = await axios.get('/system/cron-jobs');
    const systemJob = response.data.find(job => job.id === 'system-auto-updates');
    
    if (systemJob) {
      settings.value.updates = {
        autoUpdate: true,
        schedule: systemJob.schedule,
        updateCommand: systemJob.command
      };
    }
  } catch (error) {
    console.error('Error checking system cron jobs:', error);
  }
};

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
  fetchSettings();
  checkSystemCronJob();
});
</script>

<style scoped>
.readonly-input {
  :deep(.el-input__inner) {
    background-color: #f5f7fa;
    border-color: #e4e7ed;
    color: #909399;
    cursor: not-allowed;
  }
  
  :deep(.el-input-group__append) {
    background-color: #f5f7fa;
    border-color: #e4e7ed;
  }
}

.el-input-number {
  width: 200px;
}

.http2-settings {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8fafc;
  border-radius: 4px;
  border-left: 4px solid #409eff;
}

.input-description {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.performance-settings {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #67c23a;
}

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
