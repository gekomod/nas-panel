<template>
  <div class="media-service-manager">
    <!-- Nagłówek panelu -->
    <div class="media-header-panel">
      <el-card shadow="hover" class="service-card">
        <div class="service-header">
          <div class="service-icon-container">
            <el-icon size="42" class="service-icon">
              <Icon :icon="currentService.icon" />
            </el-icon>
            <div class="service-status-badge">
              <el-tag 
                :type="serviceStatus.running ? 'success' : 'danger'" 
                size="small"
                class="status-tag"
              >
                <Icon :icon="serviceStatus.running ? 'mdi:play-circle' : 'mdi:stop-circle'" width="12" />
                {{ serviceStatus.running ? $t('media.running') : $t('media.stopped') }}
              </el-tag>
            </div>
          </div>
          
          <div class="service-info">
            <h2 class="service-title">{{ currentService.name }}</h2>
            <div class="service-meta">
              <span v-if="serviceStatus.version" class="version-info">
                <Icon icon="mdi:tag" width="12" />
                v{{ serviceStatus.version }}
              </span>
              <span class="type-info">
                <Icon icon="mdi:cube-outline" width="12" />
                {{ serviceStatus.installationType || 'Not installed' }}
              </span>
              <span class="port-info">
                <Icon icon="mdi:network-port" width="12" />
                Port: {{ serviceStatus.port || currentService.defaultPort }}
              </span>
              <span class="update-time">
                <Icon icon="mdi:update" width="12" />
                {{ $t('common.update') }}: {{ lastUpdate }}
              </span>
            </div>
            
            <div class="service-url" v-if="serviceStatus.running && serviceStatus.url">
              <a :href="serviceStatus.url || `http://localhost:${serviceStatus.port || currentService.defaultPort}`" 
                 target="_blank" 
                 class="web-link">
                <Icon icon="mdi:open-in-new" width="14" />
                {{ $t('media.openWebInterface') }}
              </a>
            </div>
          </div>
          
          <div class="service-actions">
            <div class="service-toggle">
              <label class="toggle-label">{{ $t('media.serviceState') }}</label>
              <el-switch
                v-model="serviceStatus.running"
                @change="toggleService"
                :loading="statusLoading"
                :active-text="$t('media.enabled')"
                :inactive-text="$t('media.disabled')"
                :disabled="!serviceStatus.installed"
                inline-prompt
                active-color="var(--el-color-success)"
                inactive-color="var(--el-color-danger)"
              />
            </div>
            
            <el-button-group class="service-buttons">
              <el-button
                @click="refreshAllData"
                :loading="statusLoading"
                circle
                class="action-btn"
              >
                <Icon icon="mdi:refresh" width="14" />
              </el-button>
              <el-button
                v-if="serviceStatus.installed"
                @click="openQuickConfig"
                circle
                type="primary"
                class="action-btn"
              >
                <Icon icon="mdi:cog" width="14" />
              </el-button>
              <el-button
                v-if="!serviceStatus.installed"
                @click="installService"
                type="primary"
                circle
                class="action-btn"
              >
                <Icon icon="mdi:download" width="14" />
              </el-button>
            </el-button-group>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Wybór serwera -->
    <el-card shadow="hover" class="server-selector-card">
      <div class="server-selector">
        <div class="server-options">
          <div
            v-for="server in mediaServers"
            :key="server.id"
            class="server-option"
            :class="{ active: currentService.id === server.id }"
            @click="selectServer(server)"
          >
            <div class="server-icon">
              <Icon :icon="server.icon" width="24" />
            </div>
            <div class="server-info">
              <span class="server-name">{{ server.name }}</span>
              <span class="server-status" :class="getServerStatusClass(server.id)">
                {{ getServerStatusText(server.id) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Karty konfiguracyjne -->
    <div v-if="serviceStatus.installed" class="config-section">
      <el-tabs v-model="activeTab" type="border-card" class="compact-tabs">
        <!-- Podstawowe ustawienia -->
        <el-tab-pane :label="$t('media.basicSettings')" name="basic">
          <div class="tab-content">
            <el-card shadow="hover" class="compact-card">
              <div class="config-grid">
                <!-- Ustawienia sieciowe -->
                <div class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:network" width="16" />
                    <h4>{{ $t('media.networkSettings') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.port') }}</label>
                    <el-input-number
                      v-model="serviceConfig.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="config-hint">{{ $t('media.portHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.bindAddress') }}</label>
                    <el-select
                      v-model="serviceConfig.bindAddress"
                      placeholder="Select bind address"
                      class="compact-input"
                    >
                      <el-option label="All interfaces (0.0.0.0)" value="0.0.0.0" />
                      <el-option label="Localhost only (127.0.0.1)" value="127.0.0.1" />
                    </el-select>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.sslEnabled') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="serviceConfig.sslEnabled"
                        inline-prompt
                        :active-text="$t('media.enabled')"
                        :inactive-text="$t('media.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('media.sslHint') }}</div>
                  </div>
                </div>

                <!-- Ustawienia mediów -->
                <div class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:movie-play" width="16" />
                    <h4>{{ $t('media.mediaSettings') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.libraryScanInterval') }}</label>
                    <el-select
                      v-model="serviceConfig.libraryScanInterval"
                      class="compact-input"
                    >
                      <el-option :label="$t('media.disabled')" value="0" />
                      <el-option :label="$t('media.everyHour')" value="3600" />
                      <el-option :label="$t('media.every6Hours')" value="21600" />
                      <el-option :label="$t('media.every12Hours')" value="43200" />
                      <el-option :label="$t('media.daily')" value="86400" />
                    </el-select>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.transcodingEnabled') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="serviceConfig.transcodingEnabled"
                        inline-prompt
                        :active-text="$t('media.enabled')"
                        :inactive-text="$t('media.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('media.transcodingHint') }}</div>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.maxStreams') }}</label>
                    <el-input-number
                      v-model="serviceConfig.maxStreams"
                      :min="1"
                      :max="20"
                      controls-position="right"
                      class="compact-input"
                    />
                    <div class="config-hint">{{ $t('media.maxStreamsHint') }}</div>
                  </div>
                </div>

                <!-- Ustawienia Docker (jeśli dotyczy) -->
                <div v-if="serviceStatus.installationType === 'docker'" class="config-group">
                  <div class="config-group-header">
                    <Icon icon="mdi:docker" width="16" />
                    <h4>{{ $t('media.dockerSettings') }}</h4>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.restartPolicy') }}</label>
                    <el-select
                      v-model="dockerConfig.restartPolicy"
                      class="compact-input"
                    >
                      <el-option label="no" value="no" />
                      <el-option label="always" value="always" />
                      <el-option label="on-failure" value="on-failure" />
                      <el-option label="unless-stopped" value="unless-stopped" />
                    </el-select>
                  </div>
                  
                  <div class="config-item">
                    <label class="config-label">{{ $t('media.autoUpdate') }}</label>
                    <div class="config-switch-wrapper">
                      <el-switch
                        v-model="dockerConfig.autoUpdate"
                        inline-prompt
                        :active-text="$t('media.enabled')"
                        :inactive-text="$t('media.disabled')"
                        active-color="var(--el-color-success)"
                      />
                    </div>
                    <div class="config-hint">{{ $t('media.autoUpdateHint') }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Biblioteki mediów -->
              <div class="libraries-section">
                <div class="section-header">
                  <Icon icon="mdi:folder-multiple" width="16" />
                  <h4>{{ $t('media.mediaLibraries') }}</h4>
                  <div class="library-actions-header">
                    <el-button
                      @click="refreshLibraries"
                      :loading="librariesLoading"
                      size="small"
                      class="refresh-btn"
                    >
                      <Icon icon="mdi:refresh" width="12" />
                      {{ $t('media.refresh') }}
                    </el-button>
                    <el-button
                      @click="addLibrary"
                      type="primary"
                      size="small"
                      class="add-library-btn"
                      :disabled="!serviceStatus.running"
                    >
                      <Icon icon="mdi:plus" width="12" />
                      {{ $t('media.addLibrary') }}
                    </el-button>
                  </div>
                </div>
                
                <div v-if="librariesLoading" class="loading-libraries">
                  <el-skeleton :rows="3" animated />
                </div>
                
                <div v-else-if="libraries.length === 0" class="empty-libraries">
                  <Icon icon="mdi:folder-off" width="48" />
                  <p>{{ $t('media.noLibraries') }}</p>
                  <p class="empty-hint" v-if="!serviceStatus.running">
                    {{ $t('media.startServiceToManageLibraries') }}
                  </p>
                </div>
                
                <div v-else class="libraries-grid">
                  <div
                    v-for="library in libraries"
                    :key="library.id"
                    class="library-card"
                  >
                    <div class="library-header">
                      <Icon :icon="getLibraryIcon(library.type)" width="20" />
                      <span class="library-name">{{ library.name }}</span>
                      <el-tag size="small" class="library-type">
                        {{ formatLibraryType(library.type) }}
                      </el-tag>
                    </div>
                    <div class="library-path">
                      <Icon icon="mdi:folder" width="14" />
                      {{ library.path }}
                    </div>
                    <div class="library-stats">
                      <div class="stat-item" v-if="library.movies > 0">
                        <Icon icon="mdi:movie" width="12" />
                        <span>{{ library.movies }} {{ $t('media.movies') }}</span>
                      </div>
                      <div class="stat-item" v-if="library.shows > 0">
                        <Icon icon="mdi:television" width="12" />
                        <span>{{ library.shows }} {{ $t('media.shows') }}</span>
                      </div>
                      <div class="stat-item" v-if="library.lastScanned">
                        <Icon icon="mdi:calendar-clock" width="12" />
                        <span>{{ formatDate(library.lastScanned) }}</span>
                      </div>
                    </div>
                    <div class="library-actions">
                      <el-button
                        @click="scanLibrary(library.id)"
                        :loading="libraryScanning === library.id"
                        size="small"
                        class="scan-btn"
                        :disabled="!serviceStatus.running"
                      >
                        <Icon icon="mdi:refresh" width="12" />
                        {{ $t('media.scan') }}
                      </el-button>
                      <el-button
                        @click="removeLibrary(library.id)"
                        size="small"
                        type="danger"
                        plain
                        :disabled="!serviceStatus.running"
                      >
                        <Icon icon="mdi:delete" width="12" />
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="config-actions">
                <el-button
                  type="primary"
                  @click="saveSettings"
                  :loading="saveLoading"
                  size="large"
                  class="save-btn"
                >
                  <Icon icon="mdi:content-save" width="16" />
                  {{ $t('media.saveSettings') }}
                </el-button>
                <el-button
                  @click="resetSettings"
                  size="large"
                  class="reset-btn"
                >
                  <Icon icon="mdi:restore" width="16" />
                  {{ $t('media.reset') }}
                </el-button>
                <el-button
                  v-if="serviceStatus.installationType === 'docker' && serviceStatus.running"
                  @click="restartContainer"
                  :loading="actionLoading"
                  size="large"
                  type="warning"
                  class="restart-btn"
                >
                  <Icon icon="mdi:restart" width="16" />
                  {{ $t('media.restartContainer') }}
                </el-button>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- Status i logi -->
        <el-tab-pane :label="$t('media.serviceStatus')" name="status">
          <div class="tab-content">
            <div class="status-grid">
              <el-card shadow="hover" class="compact-card status-card">
                <div class="status-header">
                  <Icon icon="mdi:information-outline" width="20" class="status-icon" />
                  <h4>{{ $t('media.serviceDetails') }}</h4>
                  <el-button
                    @click="refreshServiceStatus"
                    :loading="statusLoading"
                    size="small"
                    class="refresh-btn"
                  >
                    <Icon icon="mdi:refresh" width="12" />
                  </el-button>
                </div>
                
                <div class="status-details">
                  <div class="status-item">
                    <label>{{ $t('media.status') }}</label>
                    <el-tag :type="serviceStatus.running ? 'success' : 'danger'" class="status-value-tag">
                      <Icon :icon="serviceStatus.running ? 'mdi:check-circle' : 'mdi:close-circle'" width="12" />
                      {{ serviceStatus.running ? $t('media.running') : $t('media.stopped') }}
                    </el-tag>
                  </div>
                  
                  <div class="status-item">
                    <label>{{ $t('media.version') }}</label>
                    <span class="status-value">{{ serviceStatus.version || 'N/A' }}</span>
                  </div>
                  
                  <div class="status-item">
                    <label>{{ $t('media.installationType') }}</label>
                    <el-tag class="status-value-tag">
                      {{ serviceStatus.installationType || 'N/A' }}
                    </el-tag>
                  </div>
                  
                  <div class="status-item">
                    <label>{{ $t('media.containerId') }}</label>
                    <span v-if="serviceStatus.containerId" class="status-value copyable" @click="copyToClipboard(serviceStatus.containerId)">
                      {{ serviceStatus.containerId.substring(0, 12) }}
                      <Icon icon="mdi:content-copy" width="12" class="copy-icon" />
                    </span>
                    <span v-else class="status-value">N/A</span>
                  </div>
                  
                  <div class="status-item">
                    <label>{{ $t('media.upTime') }}</label>
                    <span class="status-value">{{ serviceStatus.uptime || 'N/A' }}</span>
                  </div>
                  
                  <div class="status-item">
                    <label>{{ $t('media.url') }}</label>
                    <span class="status-value">
                      <a :href="serviceStatus.url" target="_blank" class="service-link">
                        {{ serviceStatus.url || 'N/A' }}
                      </a>
                    </span>
                  </div>
                </div>
              </el-card>
              
              <el-card shadow="hover" class="compact-card logs-card">
                <div class="logs-header">
                  <Icon icon="mdi:clipboard-text-outline" width="20" class="status-icon" />
                  <h4>{{ $t('media.serviceLogs') }}</h4>
                  <div class="log-controls">
                    <el-select
                      v-model="logLines"
                      size="small"
                      style="width: 120px"
                      @change="loadLogs"
                    >
                      <el-option label="100 lines" :value="100" />
                      <el-option label="500 lines" :value="500" />
                      <el-option label="1000 lines" :value="1000" />
                    </el-select>
                  </div>
                </div>
                
                <div class="logs-container">
                  <pre v-if="logsLoading" class="log-loading">
                    <el-skeleton :rows="5" animated />
                  </pre>
                  <pre v-else class="log-output">{{ serviceLogs }}</pre>
                </div>
                
                <div class="logs-actions">
                  <el-button
                    @click="loadLogs"
                    :loading="logsLoading"
                    size="small"
                    class="log-action-btn"
                  >
                    <Icon icon="mdi:refresh" width="12" />
                    {{ $t('media.refreshLogs') }}
                  </el-button>
                  <el-button
                    @click="downloadLogs"
                    size="small"
                    class="log-action-btn"
                    :disabled="!serviceLogs"
                  >
                    <Icon icon="mdi:download" width="12" />
                    {{ $t('media.downloadLogs') }}
                  </el-button>
                  <el-button
                    @click="clearLogs"
                    size="small"
                    type="danger"
                    plain
                    class="log-action-btn"
                    :disabled="!serviceLogs || !serviceStatus.installed"
                  >
                    <Icon icon="mdi:delete" width="12" />
                    {{ $t('media.clearLogs') }}
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Statystyki -->
        <el-tab-pane :label="$t('media.statistics')" name="stats" :disabled="!serviceStatus.running">
          <div class="tab-content">
            <el-card shadow="hover" class="compact-card">
              <div class="stats-header">
                <Icon icon="mdi:chart-line" width="20" />
                <h4>{{ $t('media.realTimeStats') }}</h4>
                <el-button
                  @click="refreshStats"
                  :loading="statsLoading"
                  size="small"
                  class="refresh-btn"
                >
                  <Icon icon="mdi:refresh" width="12" />
                  {{ $t('media.refresh') }}
                </el-button>
              </div>
              
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-header">
                    <Icon icon="mdi:cpu-64-bit" width="20" />
                    <h4>{{ $t('media.systemResources') }}</h4>
                  </div>
                  <div class="stat-content">
                    <div class="resource-item">
                      <label>CPU</label>
                      <el-progress
                        :percentage="stats.cpuPercent || 0"
                        :stroke-width="8"
                        :color="getProgressColor(stats.cpuPercent)"
                        :format="(percent) => `${percent}%`"
                      />
                      <span class="resource-value">{{ stats.cpuPercent || 0 }}%</span>
                    </div>
                    <div class="resource-item">
                      <label>{{ $t('media.memory') }}</label>
                      <el-progress
                        :percentage="stats.memoryPercent || 0"
                        :stroke-width="8"
                        :color="getProgressColor(stats.memoryPercent)"
                        :format="(percent) => `${percent}%`"
                      />
                      <span class="resource-value">{{ formatBytes(stats.memoryUsed) }} / {{ formatBytes(stats.memoryTotal) }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-header">
                    <Icon icon="mdi:account-multiple" width="20" />
                    <h4>{{ $t('media.activeUsers') }}</h4>
                    <span class="stat-badge">{{ activeUsers.length }}</span>
                  </div>
                  <div class="stat-content">
                    <div v-if="activeUsers.length === 0" class="empty-users">
                      <Icon icon="mdi:account-off" width="32" />
                      <p>{{ $t('media.noActiveUsers') }}</p>
                    </div>
                    <div v-else class="users-list">
                      <div
                        v-for="user in activeUsers"
                        :key="user.id"
                        class="user-item"
                      >
                        <div class="user-avatar">
                          {{ getUserInitials(user.name) }}
                        </div>
                        <div class="user-info">
                          <span class="user-name">{{ user.name }}</span>
                          <span class="user-activity">{{ user.activity }}</span>
                        </div>
                        <div class="user-session">
                          <span class="session-duration">{{ user.duration }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-header">
                    <Icon icon="mdi:play-circle" width="20" />
                    <h4>{{ $t('media.activeStreams') }}</h4>
                    <span class="stat-badge">{{ activeStreams.length }}</span>
                  </div>
                  <div class="stat-content">
                    <div v-if="activeStreams.length === 0" class="empty-streams">
                      <Icon icon="mdi:play-circle-outline" width="32" />
                      <p>{{ $t('media.noActiveStreams') }}</p>
                    </div>
                    <div v-else class="streams-info">
                      <div class="streams-list">
                        <div
                          v-for="stream in activeStreams"
                          :key="stream.id"
                          class="stream-item"
                        >
                          <div class="stream-user">
                            <Icon icon="mdi:account" width="14" />
                            {{ stream.user }}
                          </div>
                          <div class="stream-quality">
                            <el-tag size="small" :type="stream.transcoding ? 'warning' : 'success'">
                              {{ stream.transcoding ? $t('media.transcoding') : $t('media.directPlay') }}
                            </el-tag>
                            <span class="quality-label">{{ stream.quality }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="streams-summary">
                        <div class="summary-item">
                          <span class="summary-label">{{ $t('media.directPlay') }}:</span>
                          <span class="summary-value">{{ streamsStats.directPlay || 0 }}</span>
                        </div>
                        <div class="summary-item">
                          <span class="summary-label">{{ $t('media.transcoding') }}:</span>
                          <span class="summary-value">{{ streamsStats.transcoding || 0 }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Instalacja -->
    <div v-else class="install-section">
      <el-card shadow="hover" class="install-card">
        <div class="install-content">
          <div class="install-icon">
            <Icon :icon="currentService.icon" width="64" />
          </div>
          <div class="install-info">
            <h3>{{ $t('media.installTitle', { name: currentService.name }) }}</h3>
            <p>{{ currentService.description }}</p>
            
            <div class="install-options">
              <div class="install-option" @click="selectInstallType('docker')">
                <div class="option-icon">
                  <Icon icon="mdi:docker" width="32" />
                </div>
                <div class="option-content">
                  <h4>Docker</h4>
                  <p>{{ $t('media.dockerInstallDesc') }}</p>
                  <el-tag type="success" size="small">Recommended</el-tag>
                </div>
              </div>
              
              <div class="install-option" @click="selectInstallType('native')">
                <div class="option-icon">
                  <Icon icon="mdi:server" width="32" />
                </div>
                <div class="option-content">
                  <h4>Native</h4>
                  <p>{{ $t('media.nativeInstallDesc') }}</p>
                </div>
              </div>
            </div>
            
            <div v-if="selectedInstallType" class="install-config">
              <h4>{{ $t('media.installationConfiguration') }}</h4>
              
              <div class="install-form">
                <el-form label-position="top">
                  <el-form-item :label="$t('media.installPath')" required>
                    <el-input
                      v-model="installConfig.path"
                      :placeholder="currentService.defaultPath"
                    />
                  </el-form-item>
                  
                  <el-form-item :label="$t('media.port')" required>
                    <el-input-number
                      v-model="installConfig.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                      style="width: 100%"
                    />
                  </el-form-item>
                  
                  <el-form-item :label="$t('media.mediaPath')" required>
                    <el-input
                      v-model="installConfig.mediaPath"
                      placeholder="/media"
                    />
                  </el-form-item>
                  
                  <div v-if="selectedInstallType === 'docker'" class="docker-options">
                    <el-form-item :label="$t('media.containerName')">
                      <el-input
                        v-model="installConfig.containerName"
                        :placeholder="currentService.id"
                      />
                    </el-form-item>
                    
                    <el-form-item :label="$t('media.restartPolicy')">
                      <el-select v-model="installConfig.restartPolicy" style="width: 100%">
                        <el-option label="always" value="always" />
                        <el-option label="unless-stopped" value="unless-stopped" />
                        <el-option label="on-failure" value="on-failure" />
                        <el-option label="no" value="no" />
                      </el-select>
                    </el-form-item>
                  </div>
                </el-form>
              </div>
              
              <div class="install-actions">
                <el-button @click="cancelInstall" class="cancel-btn">
                  {{ $t('media.cancel') }}
                </el-button>
                <el-button
                  type="primary"
                  @click="confirmInstall"
                  :loading="installLoading"
                  class="install-btn"
                >
                  <Icon icon="mdi:download" width="16" />
                  {{ $t('media.install') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()

// State
const activeTab = ref('basic')
const statusLoading = ref(false)
const saveLoading = ref(false)
const actionLoading = ref(false)
const logsLoading = ref(false)
const installLoading = ref(false)
const librariesLoading = ref(false)
const statsLoading = ref(false)
const libraryScanning = ref(null)
const lastUpdate = ref('')
const quickConfigDialogVisible = ref(false)
const quickConfigLoading = ref(false)

const mediaServers = ref([
  {
    id: 'emby',
    name: 'Emby',
    icon: 'mdi:emby',
    description: 'Media server for organizing, playing, and streaming audio and video',
    defaultPort: 8096,
    defaultPath: '/opt/emby'
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    icon: 'mdi:jellyfin',
    description: 'Free software media system that puts you in control of managing and streaming your media',
    defaultPort: 8096,
    defaultPath: '/opt/jellyfin'
  },
  {
    id: 'plex',
    name: 'Plex',
    icon: 'mdi:plex',
    description: 'Media server and streaming platform',
    defaultPort: 32400,
    defaultPath: '/opt/plex'
  }
])

const currentService = ref(mediaServers.value[0])
const serviceStatus = ref({
  installed: false,
  running: false,
  installationType: null,
  version: '',
  port: null,
  containerId: null,
  url: null,
  uptime: null
})

// Store dla danych każdego serwera
const serverData = ref({
  emby: {
    status: { installed: false, running: false, installationType: null, version: '', port: null, containerId: null, url: null, uptime: null },
    config: { port: 8096, bindAddress: '0.0.0.0', sslEnabled: false, libraryScanInterval: 86400, transcodingEnabled: true, maxStreams: 5 },
    dockerConfig: { restartPolicy: 'unless-stopped', autoUpdate: true },
    libraries: [],
    logs: '',
    stats: {},
    activeUsers: [],
    activeStreams: [],
    streamsStats: {}
  },
  jellyfin: {
    status: { installed: false, running: false, installationType: null, version: '', port: null, containerId: null, url: null, uptime: null },
    config: { port: 8096, bindAddress: '0.0.0.0', sslEnabled: false, libraryScanInterval: 86400, transcodingEnabled: true, maxStreams: 5 },
    dockerConfig: { restartPolicy: 'unless-stopped', autoUpdate: true },
    libraries: [],
    logs: '',
    stats: {},
    activeUsers: [],
    activeStreams: [],
    streamsStats: {}
  },
  plex: {
    status: { installed: false, running: false, installationType: null, version: '', port: null, containerId: null, url: null, uptime: null },
    config: { port: 32400, bindAddress: '0.0.0.0', sslEnabled: false, libraryScanInterval: 86400, transcodingEnabled: true, maxStreams: 5 },
    dockerConfig: { restartPolicy: 'unless-stopped', autoUpdate: true },
    libraries: [],
    logs: '',
    stats: {},
    activeUsers: [],
    activeStreams: [],
    streamsStats: {}
  }
})

const serviceConfig = ref({ ...serverData.value.emby.config })
const dockerConfig = ref({ ...serverData.value.emby.dockerConfig })
const libraries = ref([])
const serviceLogs = ref('')
const logLines = ref(100)
const stats = ref({})
const activeUsers = ref([])
const activeStreams = ref([])
const streamsStats = ref({})

// Installation
const selectedInstallType = ref(null)
const installConfig = ref({
  type: null,
  path: '',
  port: 8096,
  mediaPath: '/media',
  containerName: '',
  restartPolicy: 'unless-stopped'
})

// Quick config
const quickConfig = ref({
  port: 8096,
  sslEnabled: false,
  bindAddress: '0.0.0.0',
  bindAddressEnabled: true,
  autoStart: true,
  libraryScan: true,
  containerName: '',
  restartPolicy: 'unless-stopped'
})

// Helper functions
const updateLastUpdateTime = () => {
  lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatLibraryType = (type) => {
  const types = {
    movies: 'Movies',
    tvshows: 'TV Shows',
    tvshow: 'TV Shows',
    series: 'TV Shows',
    music: 'Music',
    photos: 'Photos',
    homevideos: 'Home Videos',
    mixed: 'Mixed'
  }
  return types[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

// Server status functions
const getServerStatus = (serverId) => {
  return serverData.value[serverId]?.status || {
    installed: false,
    running: false,
    installationType: null,
    version: '',
    port: null,
    containerId: null,
    url: null,
    uptime: null
  }
}

const getServerStatusClass = (serverId) => {
  const status = getServerStatus(serverId)
  if (status.running) return 'status-running'
  if (status.installed && !status.running) return 'status-stopped'
  return 'status-unknown'
}

const getServerStatusText = (serverId) => {
  const status = getServerStatus(serverId)
  if (status.running) return t('media.running')
  if (status.installed && !status.running) return t('media.stopped')
  return t('media.notInstalled')
}

// Server selection
const selectServer = async (server) => {
  currentService.value = server
  await loadServiceData()
}

// Main data loading
const loadServiceData = async () => {
  const serverId = currentService.value.id
  
  // Przywróć zapisane dane dla tego serwera
  if (serverData.value[serverId]) {
    serviceStatus.value = { ...serverData.value[serverId].status }
    serviceConfig.value = { ...serverData.value[serverId].config }
    dockerConfig.value = { ...serverData.value[serverId].dockerConfig }
    libraries.value = [...serverData.value[serverId].libraries]
    serviceLogs.value = serverData.value[serverId].logs
    stats.value = { ...serverData.value[serverId].stats }
    activeUsers.value = [...serverData.value[serverId].activeUsers]
    activeStreams.value = [...serverData.value[serverId].activeStreams]
    streamsStats.value = { ...serverData.value[serverId].streamsStats }
  }
  
  // Załaduj świeże dane z API
  await Promise.all([
    loadServiceStatus(),
    loadConfig()
  ])
  
  if (serviceStatus.value.running) {
    await loadStats()
    await loadLibraries()
  } else {
    libraries.value = []
    stats.value = {}
    activeUsers.value = []
    activeStreams.value = []
    streamsStats.value = {}
  }
  
  if (activeTab.value === 'status') {
    await loadLogs()
  }
  
  updateLastUpdateTime()
}

// Library functions
const getLibraryIcon = (type) => {
  const icons = {
    movies: 'mdi:movie',
    tvshows: 'mdi:television',
    tvshow: 'mdi:television',
    series: 'mdi:television',
    music: 'mdi:music',
    photos: 'mdi:image',
    homevideos: 'mdi:video',
    mixed: 'mdi:folder-multiple'
  }
  return icons[type] || 'mdi:folder'
}

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getProgressColor = (percentage) => {
  if (!percentage) return '#909399'
  if (percentage < 50) return '#67C23A'
  if (percentage < 80) return '#E6A23C'
  return '#F56C6C'
}

const getUserInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
}

const copyToClipboard = (text) => {
  if (!text) return
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success(t('common.copied')))
    .catch(() => ElMessage.error(t('common.copyError')))
}

// Quick config
const openQuickConfig = () => {
  quickConfig.value = {
    port: serviceConfig.value.port || currentService.value.defaultPort,
    sslEnabled: serviceConfig.value.sslEnabled || false,
    bindAddress: serviceConfig.value.bindAddress || '0.0.0.0',
    bindAddressEnabled: true,
    autoStart: serviceStatus.value.running || false,
    libraryScan: serviceConfig.value.libraryScanInterval > 0 || false,
    containerName: serviceStatus.value.installationType === 'docker' ? 
                  `${currentService.value.id}-container` : '',
    restartPolicy: dockerConfig.value.restartPolicy || 'unless-stopped'
  }
  
  quickConfigDialogVisible.value = true
}

const applyQuickConfig = async () => {
  try {
    quickConfigLoading.value = true
    
    // Update main configuration
    serviceConfig.value.port = quickConfig.value.port
    serviceConfig.value.sslEnabled = quickConfig.value.sslEnabled
    serviceConfig.value.bindAddress = quickConfig.value.bindAddress
    serviceConfig.value.libraryScanInterval = quickConfig.value.libraryScan ? 86400 : 0
    
    // Update Docker config if applicable
    if (serviceStatus.value.installationType === 'docker') {
      dockerConfig.value.restartPolicy = quickConfig.value.restartPolicy
    }
    
    // Save changes
    await saveSettings()
    
    quickConfigDialogVisible.value = false
    ElMessage.success(t('media.quickConfigApplied'))
    
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    quickConfigLoading.value = false
  }
}

const saveAndRestart = async () => {
  try {
    quickConfigLoading.value = true
    
    // First save configuration
    await applyQuickConfig()
    
    // Then restart container
    await restartContainer()
    
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    quickConfigLoading.value = false
  }
}

// API Methods
const loadServiceStatus = async () => {
  try {
    statusLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.get(`/api/media/${serverId}/status`)
    const newStatus = response.data
    
    // Update local state
    serviceStatus.value = newStatus
    
    // Save to serverData
    if (!serverData.value[serverId]) {
      serverData.value[serverId] = {
        status: {},
        config: {},
        dockerConfig: {},
        libraries: [],
        logs: '',
        stats: {},
        activeUsers: [],
        activeStreams: [],
        streamsStats: {}
      }
    }
    serverData.value[serverId].status = { ...newStatus }
    
    updateLastUpdateTime()
    return newStatus
    
  } catch (error) {
    console.error('Failed to load service status:', error)
    ElMessage.error(t('media.failedToLoadStatus'))
    throw error
  } finally {
    statusLoading.value = false
  }
}

const loadConfig = async () => {
  if (!serviceStatus.value.installed) return
  
  try {
    const serverId = currentService.value.id
    const response = await axios.get(`/api/media/${serverId}/config`)
    const newConfig = response.data
    
    serviceConfig.value = newConfig
    
    // Save to serverData
    if (serverData.value[serverId]) {
      serverData.value[serverId].config = { ...newConfig }
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    ElMessage.error(t('media.failedToLoadConfig'))
  }
}

const loadLibraries = async () => {
  if (!serviceStatus.value.installed) return
  
  try {
    librariesLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.get(`/api/media/${serverId}/libraries`)
    const newLibraries = response.data
    
    libraries.value = newLibraries
    
    // Save to serverData
    if (serverData.value[serverId]) {
      serverData.value[serverId].libraries = [...newLibraries]
    }
  } catch (error) {
    console.error('Failed to load libraries:', error)
    ElMessage.error(t('media.failedToLoadLibraries'))
    libraries.value = []
  } finally {
    librariesLoading.value = false
  }
}

const refreshLibraries = async () => {
  try {
    const serverId = currentService.value.id
    const response = await axios.post(`/api/media/${serverId}/libraries/refresh`)
    
    if (response.data.success) {
      libraries.value = response.data.libraries
      ElMessage.success(t('media.librariesRefreshed'))
      
      // Save to serverData
      if (serverData.value[serverId]) {
        serverData.value[serverId].libraries = [...response.data.libraries]
      }
    }
  } catch (error) {
    console.error('Failed to refresh libraries:', error)
    ElMessage.error(error.response?.data?.error || error.message)
  }
}

const loadLogs = async () => {
  if (!serviceStatus.value.installed) return
  
  try {
    logsLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.get(`/api/media/${serverId}/logs`, {
      params: { lines: logLines.value }
    })
    const newLogs = response.data.logs
    
    serviceLogs.value = newLogs
    
    // Save to serverData
    if (serverData.value[serverId]) {
      serverData.value[serverId].logs = newLogs
    }
  } catch (error) {
    console.error('Failed to load logs:', error)
    serviceLogs.value = t('media.failedToLoadLogs')
    ElMessage.error(t('media.failedToLoadLogs'))
  } finally {
    logsLoading.value = false
  }
}

const loadStats = async () => {
  if (!serviceStatus.value.running) return
  
  try {
    statsLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.get(`/api/media/${serverId}/stats`)
    const newStats = response.data
    
    stats.value = newStats
    activeUsers.value = newStats.activeUsers || []
    activeStreams.value = newStats.activeStreams || []
    streamsStats.value = newStats.streamsStats || {}
    
    // Save to serverData
    if (serverData.value[serverId]) {
      serverData.value[serverId].stats = { ...newStats }
      serverData.value[serverId].activeUsers = [...(newStats.activeUsers || [])]
      serverData.value[serverId].activeStreams = [...(newStats.activeStreams || [])]
      serverData.value[serverId].streamsStats = { ...(newStats.streamsStats || {}) }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
    stats.value = {}
    activeUsers.value = []
    activeStreams.value = []
    streamsStats.value = {}
    ElMessage.error(t('media.failedToLoadStats'))
  } finally {
    statsLoading.value = false
  }
}

// Service actions
const toggleService = async () => {
  try {
    statusLoading.value = true
    const serverId = currentService.value.id
    const action = serviceStatus.value.running ? 'stop' : 'start'
    
    const response = await axios.post(`/api/media/${serverId}/${action}`)
    
    if (response.data.success) {
      ElMessage.success(t('media.serviceToggleSuccess', { action }))
      await loadServiceStatus()
    }
  } catch (error) {
    // Revert switch state
    serviceStatus.value.running = !serviceStatus.value.running
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    statusLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    saveLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.post(`/api/media/${serverId}/config`, {
      ...serviceConfig.value,
      docker: serviceStatus.value.installationType === 'docker' ? dockerConfig.value : undefined,
      restartRequired: true
    })
    
    if (response.data.success) {
      ElMessage.success(t('media.settingsSaved'))
      
      // Save updated configuration
      if (serverData.value[serverId]) {
        serverData.value[serverId].config = { ...serviceConfig.value }
        if (serviceStatus.value.installationType === 'docker') {
          serverData.value[serverId].dockerConfig = { ...dockerConfig.value }
        }
      }
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    saveLoading.value = false
  }
}

const resetSettings = async () => {
  try {
    await ElMessageBox.confirm(
      t('media.confirmResetSettings'),
      t('media.warning'),
      {
        confirmButtonText: t('media.confirm'),
        cancelButtonText: t('media.cancel'),
        type: 'warning'
      }
    )
    
    const serverId = currentService.value.id
    const defaultConfig = {
      port: currentService.value.defaultPort,
      bindAddress: '0.0.0.0',
      sslEnabled: false,
      libraryScanInterval: 86400,
      transcodingEnabled: true,
      maxStreams: 5
    }
    
    serviceConfig.value = defaultConfig
    
    if (serviceStatus.value.installationType === 'docker') {
      dockerConfig.value = {
        restartPolicy: 'unless-stopped',
        autoUpdate: true
      }
    }
    
    ElMessage.success(t('media.settingsReset'))
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message)
    }
  }
}

const restartContainer = async () => {
  try {
    actionLoading.value = true
    const serverId = currentService.value.id
    
    const response = await axios.post(`/api/media/${serverId}/restart`)
    
    if (response.data.success) {
      ElMessage.success(t('media.containerRestarted'))
      await loadServiceStatus()
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    actionLoading.value = false
  }
}

// Library actions
const addLibrary = async () => {
  try {
    if (!serviceStatus.value.running) {
      ElMessage.warning(t('media.startServiceFirst'))
      return
    }
    
    const { value: name } = await ElMessageBox.prompt(
      t('media.enterLibraryName'),
      t('media.addLibrary'),
      {
        confirmButtonText: t('media.add'),
        cancelButtonText: t('media.cancel'),
        inputPlaceholder: t('media.libraryNamePlaceholder'),
        inputValidator: (value) => {
          if (!value) return t('media.libraryNameRequired')
          return true
        }
      }
    )
    
    const { value: path } = await ElMessageBox.prompt(
      t('media.enterLibraryPath'),
      t('media.libraryPath'),
      {
        confirmButtonText: t('media.add'),
        cancelButtonText: t('media.cancel'),
        inputPlaceholder: '/path/to/media',
        inputValue: '/media/' + name.toLowerCase().replace(/\s+/g, '-'),
        inputValidator: (value) => {
          if (!value) return t('media.libraryPathRequired')
          if (!value.startsWith('/')) return t('media.pathMustBeAbsolute')
          return true
        }
      }
    )
    
    const { value: type } = await ElMessageBox.prompt(
      t('media.selectLibraryType'),
      t('media.libraryType'),
      {
        confirmButtonText: t('media.add'),
        cancelButtonText: t('media.cancel'),
        inputType: 'select',
        inputValue: 'movies',
        inputOptions: [
          { value: 'movies', label: t('media.movies') },
          { value: 'tvshows', label: t('media.tvshows') },
          { value: 'music', label: t('media.music') },
          { value: 'photos', label: t('media.photos') },
          { value: 'homevideos', label: t('media.homevideos') }
        ]
      }
    )
    
    const newLibrary = {
      name,
      path,
      type
    }
    
    const serverId = currentService.value.id
    const response = await axios.post(`/api/media/${serverId}/libraries`, newLibrary)
    
    if (response.data.success) {
      ElMessage.success(t('media.libraryAdded'))
      await loadLibraries()
    }
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to add library:', error)
      ElMessage.error(error.response?.data?.error || error.message)
    }
  }
}

const scanLibrary = async (libraryId) => {
  try {
    libraryScanning.value = libraryId
    const serverId = currentService.value.id
    
    const response = await axios.post(`/api/media/${serverId}/libraries/${libraryId}/scan`)
    
    if (response.data.success) {
      ElMessage.success(t('media.libraryScanStarted'))
      
      // Wait a moment then refresh library data
      setTimeout(async () => {
        await loadLibraries()
      }, 2000)
    }
  } catch (error) {
    console.error('Failed to scan library:', error)
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    libraryScanning.value = null
  }
}

const removeLibrary = async (libraryId) => {
  try {
    await ElMessageBox.confirm(
      t('media.confirmRemoveLibrary'),
      t('media.warning'),
      {
        confirmButtonText: t('media.confirm'),
        cancelButtonText: t('media.cancel'),
        type: 'warning'
      }
    )
    
    const serverId = currentService.value.id
    const response = await axios.delete(`/api/media/${serverId}/libraries/${libraryId}`)
    
    if (response.data.success) {
      ElMessage.success(t('media.libraryRemoved'))
      await loadLibraries()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to remove library:', error)
      ElMessage.error(error.response?.data?.error || error.message)
    }
  }
}

const downloadLogs = () => {
  if (!serviceLogs.value) return
  
  const data = serviceLogs.value
  const blob = new Blob([data], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${currentService.value.id}-logs-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ElMessage.success(t('media.logsDownloaded'))
}

const clearLogs = async () => {
  try {
    await ElMessageBox.confirm(
      t('media.confirmClearLogs'),
      t('media.warning'),
      {
        confirmButtonText: t('media.confirm'),
        cancelButtonText: t('media.cancel'),
        type: 'warning'
      }
    )
    
    const serverId = currentService.value.id
    const response = await axios.delete(`/api/media/${serverId}/logs`)
    
    if (response.data.success) {
      ElMessage.success(t('media.logsCleared'))
      serviceLogs.value = ''
      
      // Save cleared logs
      if (serverData.value[serverId]) {
        serverData.value[serverId].logs = ''
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message)
    }
  }
}

// Installation
const installService = () => {
  selectedInstallType.value = null
  installConfig.value = {
    type: null,
    path: currentService.value.defaultPath,
    port: currentService.value.defaultPort,
    mediaPath: '/media',
    containerName: currentService.value.id,
    restartPolicy: 'unless-stopped'
  }
}

const selectInstallType = (type) => {
  selectedInstallType.value = type
  installConfig.value.type = type
  installConfig.value.containerName = `${currentService.value.id}-${type}`
}

const cancelInstall = () => {
  selectedInstallType.value = null
  installConfig.value = {
    type: null,
    path: currentService.value.defaultPath,
    port: currentService.value.defaultPort,
    mediaPath: '/media',
    containerName: currentService.value.id,
    restartPolicy: 'unless-stopped'
  }
}

const confirmInstall = async () => {
  try {
    installLoading.value = true
    const serverId = currentService.value.id
    
    // Validate input
    if (!installConfig.value.path) {
      ElMessage.error(t('media.installPathRequired'))
      return
    }
    
    if (!installConfig.value.port) {
      ElMessage.error(t('media.portRequired'))
      return
    }
    
    if (!installConfig.value.mediaPath) {
      ElMessage.error(t('media.mediaPathRequired'))
      return
    }
    
    const response = await axios.post(`/api/media/${serverId}/install`, installConfig.value)
    
    if (response.data.success) {
      ElMessage.success(t('media.installSuccess'))
      selectedInstallType.value = null
      await loadServiceData()
    }
  } catch (error) {
    console.error('Installation failed:', error)
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    installLoading.value = false
  }
}

// Refresh functions
const refreshAllData = async () => {
  await loadServiceData()
}

const refreshServiceStatus = async () => {
  await loadServiceStatus()
}

const refreshStats = async () => {
  await loadStats()
}

// Watchers
watch(currentService, async (newService) => {
  await loadServiceData()
})

watch(activeTab, async (newTab) => {
  if (newTab === 'status' && serviceStatus.value.installed) {
    await loadLogs()
  }
  if (newTab === 'stats' && serviceStatus.value.running) {
    await loadStats()
  }
})

watch(logLines, () => {
  if (activeTab.value === 'status' && serviceStatus.value.installed) {
    loadLogs()
  }
})

// Load all servers status on mount
const loadAllServersStatus = async () => {
  try {
    const response = await axios.get('/api/media/status/all')
    const allStatus = response.data
    
    // Update serverData with fresh status
    for (const serverId in allStatus) {
      if (serverData.value[serverId]) {
        serverData.value[serverId].status = allStatus[serverId]
      }
    }
    
    // Load data for current server
    await loadServiceData()
  } catch (error) {
    console.error('Failed to load all servers status:', error)
  }
}

// Lifecycle
onMounted(async () => {
  // Załaduj status wszystkich serwerów
  await loadAllServersStatus()
})

// Interval dla automatycznego odświeżania
let statusInterval = null

onMounted(() => {
  statusInterval = setInterval(async () => {
    if (serviceStatus.value.installed) {
      await loadServiceStatus()
      if (activeTab.value === 'stats' && serviceStatus.value.running) {
        await loadStats()
      }
    }
  }, 30000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>

<style scoped lang="scss">
.media-service-manager {
  padding: 20px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Styl dla dialogu szybkiej konfiguracji */
.quick-config-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
  }
}

.quick-config-content {
  max-height: 60vh;
  overflow-y: auto;
}

.docker-quick-options {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

.quick-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

/* Nagłówek panelu */
.media-header-panel {
  margin-bottom: 24px;
}

.service-card {
  border-radius: 16px;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-dark);
  }

  &:deep(.el-card__body) {
    padding: 0;
  }
}

.service-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: transparent;
}

.service-icon-container {
  position: relative;
  flex-shrink: 0;
}

.service-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.3);
}

.service-status-badge {
  position: absolute;
  top: -6px;
  right: -6px;
}

.status-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.service-info {
  flex: 1;
  min-width: 0;
}

.service-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.service-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  margin-bottom: 8px;
}

.version-info,
.type-info,
.port-info,
.update-time {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.service-url {
  margin-top: 8px;
}

.web-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.3);
  }
}

.service-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 180px;
}

.service-toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.toggle-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.service-buttons {
  display: flex;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

/* Server selector */
.server-selector-card {
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.server-selector {
  padding: 16px;
}

.server-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.server-option {
  flex: 1;
  min-width: 200px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 12px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
  
  &.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    
    :global(.dark) &,
    :global(body.dark) & {
      background: rgba(var(--el-color-primary-rgb), 0.1);
    }
  }
}

.server-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  border-radius: 10px;
  color: white;
  flex-shrink: 0;
}

.server-info {
  flex: 1;
  min-width: 0;
}

.server-name {
  display: block;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.server-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
  
  &.status-running {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }
  
  &.status-stopped {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
  
  &.status-unknown {
    color: var(--el-color-info);
    background: var(--el-color-info-light-9);
  }
}

/* Konfiguracja */
.config-section {
  margin-bottom: 24px;
}

.compact-tabs {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-bg-color);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.compact-tabs .el-tabs__header) {
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  margin-bottom: 0;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.compact-tabs .el-tabs__item) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 0 24px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s ease;
  
  &:hover {
    color: var(--el-color-primary);
  }
}

:deep(.compact-tabs .el-tabs__item.is-active) {
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border-radius: 12px 12px 0 0;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
    border-radius: 2px;
  }
}

.tab-content {
  padding: 24px;
}

.compact-card {
  border: none;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    box-shadow: var(--el-box-shadow-light);
  }
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.config-group {
  padding: 20px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.config-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
}

.config-switch-wrapper {
  margin: 4px 0;
}

.compact-input {
  width: 100%;
}

.config-hint {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

/* Libraries */
.libraries-section {
  margin-top: 24px;
  padding: 20px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
  }
}

.add-library-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.empty-libraries {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
  
  p {
    margin-top: 12px;
    font-size: 0.875rem;
  }
}

.libraries-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.library-card {
  background: var(--el-fill-color-lighter);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: 10px;
  padding: 16px;
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.library-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.library-name {
  flex: 1;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.library-type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.library-path {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  font-family: 'SF Mono', monospace;
  padding: 6px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
}

.library-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.library-actions {
  display: flex;
  gap: 8px;
}

.scan-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.save-btn {
  min-width: 140px;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border: none;
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(var(--el-color-primary-rgb), 0.3);
  }
}

.reset-btn,
.restart-btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

/* Status and logs */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.status-card,
.logs-card {
  background: var(--el-fill-color-light);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.status-header,
.logs-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
  }
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  color: var(--el-color-primary);
}

.status-details {
  padding: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }
}

.status-item:last-child {
  margin-bottom: 0;
  border-bottom: none;
}

.status-item label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.status-value-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-value {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.875rem;
  color: var(--el-text-color-primary);
  font-weight: 500;
  
  &.copyable {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s ease;
    
    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.copy-icon {
  opacity: 0.6;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
}

.logs-container {
  padding: 20px;
  overflow: hidden;
}

.log-output {
  margin: 0;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  max-height: 300px;
  color: var(--el-text-color-primary);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(0, 0, 0, 0.2);
  }
}

.logs-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-fill-color-lighter);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.log-action-btn {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Statistics */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--el-fill-color-light);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.stat-content {
  padding: 8px 0;
}

.resource-item {
  margin-bottom: 16px;
}

.resource-item:last-child {
  margin-bottom: 0;
}

.resource-item label {
  display: block;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  font-weight: 600;
}

.resource-value {
  display: block;
  text-align: right;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.user-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  display: block;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
  margin-bottom: 2px;
}

.user-activity {
  display: block;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.user-session {
  flex-shrink: 0;
}

.session-duration {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', monospace;
}

.streams-info {
  padding: 10px 0;
}

.stream-count {
  text-align: center;
  margin-bottom: 20px;
}

.count-number {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: var(--el-color-primary);
  line-height: 1;
}

.count-label {
  display: block;
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 4px;
}

.stream-quality {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quality-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.quality-label {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.quality-value {
  font-family: 'SF Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* Installation */
.install-section {
  margin-top: 24px;
}

.install-card {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.install-content {
  display: flex;
  gap: 40px;
  padding: 40px;
}

.install-icon {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border-radius: 20px;
  color: white;
  box-shadow: 0 8px 32px rgba(var(--el-color-primary-rgb), 0.3);
}

.install-info {
  flex: 1;
}

.install-info h3 {
  margin: 0 0 12px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.install-info p {
  margin: 0 0 32px 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.install-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.install-option {
  padding: 20px;
  background: var(--el-fill-color-light);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  gap: 16px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-4px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.option-icon {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  border-radius: 12px;
  color: white;
}

.option-content {
  flex: 1;
}

.option-content h4 {
  margin: 0 0 8px 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.option-content p {
  margin: 0 0 8px 0;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.install-config {
  background: var(--el-fill-color-light);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.install-config h4 {
  margin: 0 0 20px 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.install-form {
  margin-bottom: 24px;
}

.docker-options {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.install-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
}

.install-btn {
  min-width: 140px;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border: none;
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(var(--el-color-primary-rgb), 0.3);
  }
}

/* Responsywność */
@media (max-width: 1200px) {
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .media-service-manager {
    padding: 16px;
  }
  
  .service-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    gap: 16px;
  }
  
  .service-actions {
    align-items: center;
    min-width: auto;
  }
  
  .service-toggle {
    align-items: center;
  }
  
  .install-content {
    flex-direction: column;
    padding: 24px;
  }
  
  .install-icon {
    width: 80px;
    height: 80px;
    align-self: center;
  }
  
  .server-options {
    flex-direction: column;
  }
  
  .server-option {
    min-width: 100%;
  }
  
  .config-actions {
    flex-direction: column;
  }
  
  .config-actions .el-button {
    width: 100%;
  }
  
  .quick-config-dialog {
    width: 90% !important;
    max-width: 500px;
  }
}

@media (max-width: 480px) {
  .service-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .install-options {
    grid-template-columns: 1fr;
  }
  
  .libraries-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-actions {
    flex-direction: column;
  }
  
  .quick-actions .el-button {
    width: 100%;
  }
}

/* Animacje */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.connection-card,
.library-card,
.stat-card {
  animation: fadeInUp 0.3s ease;
}

/* Focus styles for accessibility */
.action-btn:focus-visible,
.save-btn:focus-visible,
.reset-btn:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
  
  &:hover {
    background: var(--el-color-primary);
  }
}

:global(.dark) ::-webkit-scrollbar-track,
:global(body.dark) ::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

:global(.dark) ::-webkit-scrollbar-thumb,
:global(body.dark) ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>
