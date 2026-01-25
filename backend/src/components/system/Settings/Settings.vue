<template>
  <div class="settings-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:cog" />
          </div>
          <div class="header-text">
            <h1>{{ $t('settings.systemSettings') }}</h1>
            <p class="subtitle">{{ $t('settings.systemSettingsDesc') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="activeTab === 'docker' ? 'primary' : 'default'"
              @click="activeTab = 'docker'"
            >
              <Icon icon="mdi:docker" />
              {{ $t('tabs.docker') }}
            </el-button>
            <el-button 
              :type="activeTab === 'system' ? 'primary' : 'default'"
              @click="activeTab = 'system'"
            >
              <Icon icon="mdi:server" />
              {{ $t('tabs.system') }}
            </el-button>
            <el-button 
              :type="activeTab === 'ui' ? 'primary' : 'default'"
              @click="activeTab = 'ui'"
            >
              <Icon icon="mdi:palette" />
              {{ $t('tabs.ui') }}
            </el-button>
            <el-button 
              :type="activeTab === 'services' ? 'primary' : 'default'"
              @click="activeTab = 'services'"
            >
              <Icon icon="mdi:application-cog" />
              {{ $t('tabs.services') }}
            </el-button>
            <el-button 
              :type="activeTab === 'webserver' ? 'primary' : 'default'"
              @click="activeTab = 'webserver'"
            >
              <Icon icon="mdi:web" />
              {{ $t('tabs.webserver') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="settings-content">
      <!-- Docker Tab -->
      <el-card v-if="activeTab === 'docker'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:docker" />
              {{ $t('settings.dockerSettings') }}
            </h2>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
        </div>

        <el-form v-else ref="dockerForm" :model="settings.docker" label-position="top" class="settings-form">
          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.directoryConfiguration') }}</h3>
            <el-form-item :label="$t('settings.dockerComposeDir')">
              <el-input v-model="settings.docker.composeDir" 
                       :placeholder="$t('settings.dockerComposeDirPlaceholder')"
                       class="input-with-button">
                <template #append>
                  <el-button @click="browseDirectory('docker.composeDir')" :disabled="loading">
                    <Icon icon="mdi:folder-search" />
                    {{ $t('common.browse') }}
                  </el-button>
                </template>
              </el-input>
              <span class="input-description">{{ $t('settings.dockerComposeDirDesc') }}</span>
            </el-form-item>

            <el-form-item :label="$t('settings.dockerDataRoot')">
              <el-input v-model="settings.docker.dataRoot" 
                       :placeholder="$t('settings.dockerDataRootPlaceholder')"
                       class="input-with-button">
                <template #append>
                  <el-button @click="browseDirectory('docker.dataRoot')" :disabled="loading">
                    <Icon icon="mdi:folder-search" />
                    {{ $t('common.browse') }}
                  </el-button>
                </template>
              </el-input>
              <span class="input-description">{{ $t('settings.dockerDataRootDesc') }}</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.behavior') }}</h3>
            <el-form-item :label="$t('settings.dockerAutoStart')">
              <div class="switch-container">
                <el-switch 
                  v-model="settings.docker.autoStart" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
              </div>
              <span class="input-description">{{ $t('settings.dockerAutoStartDesc') }}</span>
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <!-- System Tab -->
      <el-card v-if="activeTab === 'system'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:server" />
              {{ $t('settings.systemSettingsTab') }}
            </h2>
          </div>
        </template>

        <el-form ref="systemForm" :model="settings.system" label-position="top" class="settings-form">
          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.basicConfiguration') }}</h3>
            <el-form-item :label="$t('settings.hostname')">
              <el-input v-model="settings.system.hostname" 
                       :placeholder="$t('settings.hostname')" />
              <span class="input-description">{{ $t('settings.hostnameDesc') }}</span>
            </el-form-item>

            <el-form-item :label="$t('settings.timezone')">
              <el-select v-model="settings.system.timezone" filterable :placeholder="$t('settings.timezone')">
                <el-option 
                  v-for="tz in timezones" 
                  :key="tz" 
                  :label="tz" 
                  :value="tz" 
                />
              </el-select>
              <span class="input-description">{{ $t('settings.timezoneDesc') }}</span>
            </el-form-item>

            <el-form-item :label="$t('settings.language')">
              <el-select v-model="settings.system.language" @change="changeLanguage">
                <el-option :label="$t('language.polish')" value="pl" />
                <el-option :label="$t('language.english')" value="en" />
              </el-select>
              <span class="input-description">{{ $t('settings.languageDesc') }}</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.autoUpdatesTitle') }}</h3>
            <el-form-item :label="$t('settings.enableAutoUpdates')">
              <div class="switch-container">
                <el-switch 
                  v-model="settings.updates.autoUpdate" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
              </div>
              <span class="input-description">{{ $t('settings.enableAutoUpdatesDesc') }}</span>
            </el-form-item>

            <div v-if="settings.updates.autoUpdate" class="update-settings">
              <el-form-item :label="$t('settings.updateSchedule')">
                <el-select v-model="settings.updates.schedule">
                  <el-option value="0 0 * * *" :label="$t('settings.dailyMidnight')" />
                  <el-option value="0 0 * * 0" :label="$t('settings.weeklySunday')" />
                  <el-option value="0 0 1 * *" :label="$t('settings.monthlyFirstDay')" />
                  <el-option value="custom" :label="$t('settings.customSchedule')" />
                </el-select>
                <span class="input-description">{{ $t('settings.updateScheduleDesc') }}</span>
              </el-form-item>

              <el-form-item v-if="settings.updates.schedule === 'custom'" :label="$t('settings.customCron')">
                <el-input v-model="settings.updates.customSchedule" placeholder="* * * * *" />
                <span class="input-description">{{ $t('settings.customCronDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.updateCommand')">
                <el-input v-model="settings.updates.updateCommand" 
                         type="textarea" 
                         :rows="3"
                         :placeholder="$t('settings.updateCommand')" />
                <span class="input-description">{{ $t('settings.updateCommandDesc') }}</span>
              </el-form-item>
            </div>
          </div>
        </el-form>
      </el-card>

      <!-- UI Tab -->
      <el-card v-if="activeTab === 'ui'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:palette" />
              {{ $t('settings.interfaceSettings') }}
            </h2>
          </div>
        </template>

        <el-form ref="uiForm" :model="settings.ui" label-position="top" class="settings-form">
          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.appearance') }}</h3>
            <el-form-item :label="$t('settings.theme')">
              <div class="theme-options">
                <el-card 
                  v-for="theme in themes" 
                  :key="theme.value"
                  :class="['theme-card', { 'selected': settings.ui.theme === theme.value }]"
                  @click="settings.ui.theme = theme.value"
                  shadow="hover"
                >
                  <div class="theme-content">
                    <div class="theme-icon" :style="{ color: theme.color }">
                      <Icon :icon="theme.icon" />
                    </div>
                    <h4>{{ theme.label }}</h4>
                  </div>
                </el-card>
              </div>
              <span class="input-description">{{ $t('settings.themeDesc') }}</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.layout') }}</h3>
            <el-form-item :label="$t('settings.sidebarMode')">
              <div class="layout-options">
                <el-card 
                  v-for="layout in layouts" 
                  :key="layout.value"
                  :class="['layout-card', { 'selected': settings.ui.sidebarMode === layout.value }]"
                  @click="settings.ui.sidebarMode = layout.value"
                  shadow="hover"
                >
                  <div class="layout-content">
                    <div class="layout-icon">
                      <Icon :icon="layout.icon" />
                    </div>
                    <h4>{{ layout.label }}</h4>
                  </div>
                </el-card>
              </div>
              <span class="input-description">{{ $t('settings.sidebarModeDesc') }}</span>
            </el-form-item>
          </div>
        </el-form>
      </el-card>

      <!-- Services Tab -->
      <el-card v-if="activeTab === 'services'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:application-cog" />
              {{ $t('settings.monitoredServices') }}
            </h2>
          </div>
        </template>

        <el-form ref="servicesForm" :model="settings.services" label-position="top" class="settings-form">
          <div class="form-section">
            <h3 class="section-title">{{ $t('settings.serviceMonitoring') }}</h3>
            <p class="section-description">{{ $t('settings.serviceMonitoringDesc') }}</p>
            
            <div class="services-grid">
              <el-card 
                v-for="service in availableServices" 
                :key="service.value"
                :class="['service-card', { 'selected': settings.services.monitoredServices.includes(service.value) }]"
                @click="toggleService(service.value)"
                shadow="hover"
              >
                <div class="service-content">
                  <div class="service-icon" :style="{ backgroundColor: service.color }">
                    <Icon :icon="service.icon" />
                  </div>
                  <div class="service-info">
                    <h4>{{ service.label }}</h4>
                    <p class="service-desc">{{ service.description }}</p>
                  </div>
                  <div class="service-checkbox">
                    <el-checkbox 
                      :model-value="settings.services.monitoredServices.includes(service.value)" 
                      @click.stop="toggleService(service.value)"
                    />
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-form>
      </el-card>

      <!-- Web Server Tab -->
      <el-card v-if="activeTab === 'webserver'" class="tab-card webserver-tab" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:web" />
              {{ $t('settings.webServerConfig') }}
            </h2>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
        </div>

        <div v-else class="webserver-content">
          <el-form ref="webserverForm" :model="settings.webserver" label-position="top" class="settings-form">
            <!-- Basic Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:cog-outline" />
                {{ $t('settings.basicSettings') }}
              </h3>
              <el-form-item :label="$t('settings.serverPort')">
                <el-input-number v-model="settings.webserver.PORT" :min="1" :max="65535" />
                <span class="input-description">{{ $t('settings.serverPortDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.frontendPath')">
                <el-input 
                  v-model="settings.webserver.FRONTEND_PATH" 
                  readonly
                  disabled
                  class="readonly-input"
                >
                  <template #append>
                    <el-tooltip :content="$t('settings.pathLockedTooltip')" placement="top">
                      <el-button disabled>
                        <Icon icon="mdi:folder-lock" />
                      </el-button>
                    </el-tooltip>
                  </template>
                </el-input>
                <span class="input-description">{{ $t('settings.frontendPathDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.apiPrefix')">
                <el-input 
                  v-model="settings.webserver.API_PREFIX" 
                  readonly
                  disabled
                  class="readonly-input"
                >
                  <template #append>
                    <el-tooltip :content="$t('settings.apiLockedTooltip')" placement="top">
                      <el-button disabled>
                        <Icon icon="mdi:api-lock" />
                      </el-button>
                    </el-tooltip>
                  </template>
                </el-input>
                <span class="input-description">{{ $t('settings.apiPrefixDesc') }}</span>
              </el-form-item>
            </div>

            <!-- Performance Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:speedometer" />
                {{ $t('settings.performanceSettings') }}
              </h3>
              <el-form-item :label="$t('settings.enableThreadpool')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.THREADPOOL_ENABLED" 
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.threadpoolDesc') }}</span>
              </el-form-item>
              
              <div v-if="settings.webserver.THREADPOOL_ENABLED" class="nested-settings">
                <el-form-item :label="$t('settings.maxWorkerThreads')">
                  <el-input-number 
                    v-model="settings.webserver.MAX_THREADS" 
                    :min="1" 
                    :max="64"
                    :step="1"
                  />
                  <span class="input-description">{{ $t('settings.workerThreadsDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.maxConnections')">
                  <el-input-number 
                    v-model="settings.webserver.MAX_CONNECTIONS" 
                    :min="10" 
                    :max="10000"
                    :step="10"
                  />
                  <span class="input-description">{{ $t('settings.maxConnectionsDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.connectionTimeout')">
                  <el-input-number 
                    v-model="settings.webserver.CONNECTION_TIMEOUT" 
                    :min="1" 
                    :max="300"
                  />
                  <span class="input-description">{{ $t('settings.connectionTimeoutDesc') }} ({{ $t('common.seconds') }})</span>
                </el-form-item>
              </div>
            </div>

            <!-- HTTPS Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:lock" />
                {{ $t('settings.httpsConfig') }}
              </h3>
              <el-form-item :label="$t('settings.enableHttps')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.ENABLE_HTTPS" 
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.httpsDesc') }}</span>
              </el-form-item>

              <div v-if="settings.webserver.ENABLE_HTTPS" class="nested-settings">
                <el-form-item :label="$t('settings.sslCertPath')">
                  <el-input v-model="settings.webserver.SSL_CERT_PATH" class="input-with-button">
                    <template #append>
                      <el-button @click="browseDirectory('webserver.SSL_CERT_PATH')">
                        <Icon icon="mdi:file-search" />
                        {{ $t('common.browse') }}
                      </el-button>
                    </template>
                  </el-input>
                  <span class="input-description">{{ $t('settings.sslCertPathDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.sslKeyPath')">
                  <el-input v-model="settings.webserver.SSL_KEY_PATH" class="input-with-button">
                    <template #append>
                      <el-button @click="browseDirectory('webserver.SSL_KEY_PATH')">
                        <Icon icon="mdi:key-search" />
                        {{ $t('common.browse') }}
                      </el-button>
                    </template>
                  </el-input>
                  <span class="input-description">{{ $t('settings.sslKeyPathDesc') }}</span>
                </el-form-item>
              </div>
            </div>

            <!-- HTTP/2 Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:web-box" />
                {{ $t('settings.http2Config') }}
              </h3>
              <el-form-item :label="$t('settings.enableHttp2')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.HTTP2_ENABLED"
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.http2Desc') }}</span>
              </el-form-item>

              <div v-if="settings.webserver.HTTP2_ENABLED" class="nested-settings">
                <el-form-item :label="$t('settings.http2CertPath')">
                  <el-input v-model="settings.webserver.HTTP2_CERT_PATH" class="input-with-button">
                    <template #append>
                      <el-button @click="browseDirectory('webserver.HTTP2_CERT_PATH')">
                        <Icon icon="mdi:file-certificate-outline" />
                        {{ $t('common.browse') }}
                      </el-button>
                    </template>
                  </el-input>
                  <span class="input-description">{{ $t('settings.http2CertPathDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.http2KeyPath')">
                  <el-input v-model="settings.webserver.HTTP2_KEY_PATH" class="input-with-button">
                    <template #append>
                      <el-button @click="browseDirectory('webserver.HTTP2_KEY_PATH')">
                        <Icon icon="mdi:key-outline" />
                        {{ $t('common.browse') }}
                      </el-button>
                    </template>
                  </el-input>
                  <span class="input-description">{{ $t('settings.http2KeyPathDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.http2MaxStreams')">
                  <el-input-number 
                    v-model="settings.webserver.HTTP2_MAX_STREAMS" 
                    :min="1" 
                    :max="1000"
                  />
                  <span class="input-description">{{ $t('settings.http2MaxStreamsDesc') }}</span>
                </el-form-item>

                <el-form-item :label="$t('settings.http2WindowSize')">
                  <el-input-number 
                    v-model="settings.webserver.HTTP2_WINDOW_SIZE" 
                    :min="65535" 
                    :max="2147483647"
                    :step="1024"
                  />
                  <span class="input-description">{{ $t('settings.http2WindowSizeDesc') }} ({{ $t('common.bytes') }})</span>
                </el-form-item>
              </div>
            </div>

            <!-- Cache Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:database" />
                {{ $t('settings.cacheConfig') }}
              </h3>
              <el-form-item :label="$t('settings.enableCache')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.CACHE_ENABLED" 
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.cacheDesc') }}</span>
              </el-form-item>

              <div v-if="settings.webserver.CACHE_ENABLED" class="nested-settings">
                <el-form-item :label="$t('settings.cacheMaxSize')">
                  <el-input-number 
                    v-model="settings.webserver.CACHE_MAX_SIZE" 
                    :min="1" 
                    :max="1000"
                    :controls-position="'right'"
                  />
                  <span class="input-description">{{ $t('settings.cacheMaxSizeDesc') }} ({{ $t('common.megabytes') }})</span>
                </el-form-item>

                <el-form-item :label="$t('settings.cacheTtl')">
                  <el-input-number 
                    v-model="settings.webserver.CACHE_TTL" 
                    :min="60" 
                    :max="86400"
                    :controls-position="'right'"
                  />
                  <span class="input-description">{{ $t('settings.cacheTtlDesc') }} ({{ $t('common.seconds') }})</span>
                </el-form-item>
              </div>
            </div>

            <!-- Security Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:shield-check" />
                {{ $t('settings.securitySettings') }}
              </h3>
              <el-form-item :label="$t('settings.enableCors')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.CORS_ENABLED" 
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.corsDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.enableHsts')">
                <div class="switch-container">
                  <el-switch 
                    v-model="settings.webserver.HSTS_ENABLED" 
                    inline-prompt
                    :active-text="$t('common.enabled')"
                    :inactive-text="$t('common.disabled')"
                    class="custom-switch"
                  />
                </div>
                <span class="input-description">{{ $t('settings.hstsDesc') }}</span>
              </el-form-item>

              <div v-if="settings.webserver.HSTS_ENABLED" class="nested-settings">
                <el-form-item :label="$t('settings.hstsMaxAge')">
                  <el-input-number v-model="settings.webserver.HSTS_MAX_AGE" 
                                  :min="0" 
                                  :max="63072000" />
                  <span class="input-description">{{ $t('settings.hstsMaxAgeDesc') }} ({{ $t('common.seconds') }})</span>
                </el-form-item>
              </div>
            </div>

            <!-- Logging Settings -->
            <div class="form-section">
              <h3 class="section-title">
                <Icon icon="mdi:file-document-outline" />
                {{ $t('settings.loggingSettings') }}
              </h3>
              <el-form-item :label="$t('settings.logLevel')">
                <el-select v-model="settings.webserver.LOG_LEVEL">
                  <el-option label="Debug" value="debug" />
                  <el-option label="Info" value="info" />
                  <el-option label="Warning" value="warning" />
                  <el-option label="Error" value="error" />
                </el-select>
                <span class="input-description">{{ $t('settings.logLevelDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.logFile')">
                <el-input v-model="settings.webserver.LOG_FILE" 
                          readonly
                          disabled
                          class="readonly-input">
                  <template #append>
                    <el-tooltip :content="$t('settings.autoConfiguredTooltip')" placement="top">
                      <el-button disabled>
                        <Icon icon="mdi:lock" />
                      </el-button>
                    </el-tooltip>
                  </template>
                </el-input>
                <span class="input-description">{{ $t('settings.logFileDesc') }}</span>
              </el-form-item>

              <el-form-item :label="$t('settings.logMaxSize')">
                <el-input-number v-model="settings.webserver.LOG_MAX_SIZE" 
                                :min="1" 
                                :max="100" />
                <span class="input-description">{{ $t('settings.logMaxSizeDesc') }} ({{ $t('common.megabytes') }})</span>
              </el-form-item>

              <el-form-item :label="$t('settings.logBackupCount')">
                <el-input-number v-model="settings.webserver.LOG_BACKUP_COUNT" 
                                :min="1" 
                                :max="20" />
                <span class="input-description">{{ $t('settings.logBackupCountDesc') }}</span>
              </el-form-item>
            </div>
          </el-form>
        </div>
      </el-card>
    </div>

    <!-- Action Buttons -->
    <el-card class="action-card" shadow="hover">
      <div class="action-content">
        <div class="action-info">
          <h3>{{ $t('settings.applyChanges') }}</h3>
          <p>{{ $t('settings.applyChangesDesc') }}</p>
        </div>
        <div class="action-buttons">
          <el-button @click="resetSettings" :disabled="saving">
            <Icon icon="mdi:restore" />
            {{ $t('settings.reset') }}
          </el-button>
          <el-button type="primary" @click="saveSettings" :loading="saving" class="save-button">
            <Icon icon="mdi:content-save" />
            {{ $t('settings.save') }}
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { i18n } from '@/locales'

const activeTab = ref('docker')
const loading = ref(false)
const saving = ref(false)

const settings = reactive({
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
    customSchedule: '',
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
    CORS_ENABLED: true,
    HSTS_ENABLED: true,
    HSTS_MAX_AGE: 31536000,
    LOG_LEVEL: 'info',
    LOG_FILE: '/var/log/nas-web.log',
    LOG_MAX_SIZE: 10,
    LOG_BACKUP_COUNT: 5,
    THREADPOOL_ENABLED: true,
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

const themes = [
  { label: 'Light', value: 'light', icon: 'mdi:weather-sunny', color: '#F6B352' },
  { label: 'Dark', value: 'dark', icon: 'mdi:weather-night', color: '#5D5C61' },
  { label: 'System', value: 'system', icon: 'mdi:theme-light-dark', color: '#7395AE' }
]

const layouts = [
  { label: 'Vertical', value: 'vertical', icon: 'mdi:menu' },
  { label: 'Horizontal', value: 'horizontal', icon: 'mdi:menu-open' }
]

const availableServices = ref([
  { 
    value: 'nas-web', 
    label: 'Web Server', 
    icon: 'mdi:server', 
    description: 'Main web interface server',
    color: '#4A90E2'
  },
  { 
    value: 'nas-webdav', 
    label: 'Dav Server', 
    icon: 'mdi:folder-network', 
    description: 'WebDAV file sharing service',
    color: '#50E3C2'
  },
  { 
    value: 'docker', 
    label: 'Docker', 
    icon: 'mdi:docker', 
    description: 'Docker container service',
    color: '#2496ED'
  },
  { 
    value: 'ssh', 
    label: 'SSH', 
    icon: 'mdi:lock', 
    description: 'Secure Shell access',
    color: '#F5A623'
  },
  { 
    value: 'cron', 
    label: 'Cron', 
    icon: 'mdi:clock', 
    description: 'Scheduled task manager',
    color: '#9013FE'
  },
  { 
    value: 'smbd', 
    label: 'Samba', 
    icon: 'mdi:folder-network', 
    description: 'Windows file sharing service',
    color: '#7ED321'
  },
  { 
    value: 'nginx', 
    label: 'NGINX', 
    icon: 'mdi:nginx', 
    description: 'Web server and reverse proxy',
    color: '#26963C'
  },
  { 
    value: 'mysql', 
    label: 'MySQL', 
    icon: 'mdi:database', 
    description: 'MySQL database server',
    color: '#00758F'
  },
  { 
    value: 'postgresql', 
    label: 'PostgreSQL', 
    icon: 'mdi:database', 
    description: 'PostgreSQL database server',
    color: '#336791'
  }
])

const timezones = ref([
  'Europe/Warsaw',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Honolulu'
])

const fetchSettings = async () => {
  try {
    loading.value = true;
    
    const [mainSettingsResponse, webserverConfigResponse] = await Promise.all([
      axios.get('/system/settings'),
      axios.get('/system/webserver-config')
    ]);

    Object.assign(settings, mainSettingsResponse.data);
    
    if (webserverConfigResponse.data) {
      Object.assign(settings.webserver, webserverConfigResponse.data);
    }

    if (settings.services?.monitoredServices) {
      settings.services.monitoredServices = Array.isArray(settings.services.monitoredServices) 
        ? settings.services.monitoredServices 
        : [];
    } else {
      settings.services.monitoredServices = [];
    }

  } catch (error) {
    ElMessage.error('Failed to load settings');
    console.error('Error fetching settings:', error);
  } finally {
    loading.value = false;
  }
}

const saveSettings = async () => {
  try {
    saving.value = true;
    
    await axios.post('/system/settings', {
      ...settings,
      webserver: undefined
    })

    await axios.post('/system/save-webserver-config', settings.webserver);
    
    ElMessage.success({
      message: 'Settings saved successfully',
      type: 'success',
      showClose: true
    });
    
    if (i18n.global.locale.value !== settings.system.language) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  } catch (error) {
    ElMessage.error({
      message: 'Error saving settings',
      type: 'error',
      showClose: true
    });
    console.error('Save error:', error);
  } finally {
    saving.value = false;
  }
}

const resetSettings = () => {
  ElMessageBox.confirm(
    'This will reset all settings to their default values. Continue?',
    'Reset Settings',
    {
      confirmButtonText: 'Reset',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  ).then(() => {
    fetchSettings();
    ElMessage.success('Settings reset to defaults');
  }).catch(() => {
    // User cancelled
  });
}

const changeLanguage = (lang) => {
  i18n.global.locale.value = lang;
}

const browseDirectory = (field) => {
  console.log('Browsing directory for field:', field);
  // TODO: Implement actual directory browsing
  ElMessage.info('Directory browser not implemented in this demo');
}

const toggleService = (serviceId) => {
  const index = settings.services.monitoredServices.indexOf(serviceId);
  if (index === -1) {
    settings.services.monitoredServices.push(serviceId);
  } else {
    settings.services.monitoredServices.splice(index, 1);
  }
}

onMounted(() => {
  fetchSettings();
});
</script>

<style scoped>
.settings-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.header-actions .el-button-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.header-actions .el-button {
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 500;
}

.settings-content {
  margin-bottom: 24px;
}

.tab-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.tab-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
}

.webserver-tab {
  min-height: 500px;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
  min-height: 300px;
}

.settings-form {
  padding: 24px;
}

.form-section {
  margin-bottom: 32px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.section-description {
  margin: 0 0 20px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.el-form-item {
  margin-bottom: 24px;
}

.input-description {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.readonly-input {
  :deep(.el-input__inner) {
    background-color: #f1f5f9;
    border-color: #e2e8f0;
    color: #64748b;
    cursor: not-allowed;
  }
  
  :deep(.el-input-group__append) {
    background-color: #f1f5f9;
    border-color: #e2e8f0;
  }
}

.input-with-button {
  :deep(.el-input-group__append) {
    padding: 0;
    border: none;
  }
  
  :deep(.el-button) {
    height: 100%;
    border-radius: 0 8px 8px 0;
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }
  
  :deep(.el-button:hover) {
    background: #2563eb;
    border-color: #2563eb;
  }
}

.nested-settings {
  margin-left: 20px;
  padding-left: 24px;
  border-left: 2px solid #cbd5e1;
  margin-top: 16px;
}

.switch-container {
  margin-top: 4px;
}

.custom-switch {
  :deep(.el-switch__core) {
    background-color: #cbd5e1 !important;
    border-color: #cbd5e1 !important;
  }
  
  :deep(.el-switch.is-checked .el-switch__core) {
    background-color: #3b82f6 !important;
    border-color: #3b82f6 !important;
  }
}

.theme-options,
.layout-options {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.theme-card,
.layout-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
  flex: 1;
  min-width: 150px;
}

.theme-card:hover,
.layout-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.theme-card.selected,
.layout-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.theme-content,
.layout-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
}

.theme-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  font-size: 30px;
  background: #f8fafc;
}

.layout-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  font-size: 30px;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.service-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
}

.service-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.service-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.service-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.service-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: white;
  font-size: 22px;
  flex-shrink: 0;
}

.service-info {
  flex: 1;
}

.service-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.service-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.service-checkbox {
  flex-shrink: 0;
}

.webserver-content {
  /* Usunięto scrollbar */
  overflow: visible;
}

.webserver-content .settings-form {
  padding: 24px;
}

.action-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 20px;
}

.action-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  flex-wrap: wrap;
  gap: 20px;
}

.action-info h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.action-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  max-width: 600px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.save-button {
  padding: 12px 32px;
  border-radius: 10px;
  font-weight: 500;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  transition: all 0.3s ease;
}

.save-button:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.update-settings {
  margin-top: 20px;
  padding: 20px;
  background: #f1f5f9;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  
  .header-actions .el-button-group {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;
    -webkit-overflow-scrolling: touch;
  }
  
  .services-grid {
    grid-template-columns: 1fr;
  }
  
  .theme-options,
  .layout-options {
    flex-direction: column;
  }
  
  .theme-card,
  .layout-card {
    width: 100%;
  }
  
  .action-content {
    flex-direction: column;
    text-align: center;
  }
  
  .action-buttons {
    width: 100%;
    flex-direction: column;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
}

@media (max-width: 1200px) {
  .theme-options,
  .layout-options {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Form item label styling */
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #475569;
  padding-bottom: 8px;
  font-size: 14px;
}

/* Input styling */
:deep(.el-input__inner) {
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  transition: all 0.3s ease;
}

:deep(.el-input__inner:hover),
:deep(.el-input__inner:focus) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Select styling */
:deep(.el-select .el-input__inner) {
  height: 40px;
}

/* Input number styling */
:deep(.el-input-number) {
  width: 200px;
}

:deep(.el-input-number .el-input__inner) {
  text-align: left;
}

/* Card header improvements */
:deep(.el-card__header) {
  border-bottom: 1px solid #f1f5f9;
  padding: 20px 24px;
}

/* Button styling for better visibility */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

/* Improve spacing for better readability */
.form-section:last-child {
  margin-bottom: 0;
}

/* Better focus states for accessibility */
:deep(.el-switch__core:focus),
:deep(.el-checkbox__input:focus),
:deep(.el-radio__input:focus) {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
}

/* Theme and layout cards grid fix */
@media (min-width: 768px) {
  .theme-options,
  .layout-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 767px) {
  .theme-options,
  .layout-options {
    display: flex;
    flex-direction: column;
  }
  
  .theme-card,
  .layout-card {
    width: 100%;
  }
}
</style>
