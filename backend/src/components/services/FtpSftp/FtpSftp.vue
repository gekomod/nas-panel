<template>
  <div class="ftp-sftp-container">
    <!-- Service Status Cards -->
    <div class="service-cards">
      <!-- FTP Status Card -->
      <el-card shadow="hover" class="status-card">
        <template #header>
          <div class="card-header">
            <Icon icon="carbon:ftp" width="24" height="24" />
            <span>{{ $t('ftp_sftp.ftp_service') }}</span>
            <el-tag v-if="!ftpStatus.installed" size="small" type="warning" class="install-tag">
              <Icon icon="material-symbols:download" />
              {{ $t('ftp_sftp.not_installed') }}
            </el-tag>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="32" class="is-loading">
            <Icon icon="svg-spinners:180-ring" />
          </el-icon>
        </div>

        <div v-else>


          <div class="status-content">
            <el-descriptions :column="1" border>
              <el-descriptions-item :label="$t('ftp_sftp.status')">
                <el-tag :type="ftpStatus.running ? 'success' : 'danger'">
                  <Icon :icon="ftpStatus.running ? 'material-symbols:check-circle-outline' : 'material-symbols:error-outline'" />
                  {{ ftpStatus.running ? $t('ftp_sftp.running') : $t('ftp_sftp.stopped') }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="$t('ftp_sftp.port')">
                <el-tag>{{ ftpConfig.port || 21 }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="$t('ftp_sftp.anonymous_login')">
                <el-tag :type="ftpConfig.anonymousLogin ? 'warning' : 'success'">
                  <Icon :icon="ftpConfig.anonymousLogin ? 'mdi:account-eye' : 'mdi:account-lock'" />
                  {{ ftpConfig.anonymousLogin ? $t('ftp_sftp.enabled') : $t('ftp_sftp.disabled') }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <div class="action-buttons">
              <el-button 
                v-if="!ftpStatus.running"
                type="success"
                @click="toggleService('ftp', 'start')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:play-arrow" />
                </template>
                {{ $t('ftp_sftp.start_service') }}
              </el-button>
              <el-button 
                v-else
                type="danger"
                @click="toggleService('ftp', 'stop')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:stop" />
                </template>
                {{ $t('ftp_sftp.stop_service') }}
              </el-button>
              <el-button
                type="warning"
                @click="toggleService('ftp', 'restart')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:restart-alt" />
                </template>
                {{ $t('ftp_sftp.restart_service') }}
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- SFTP Status Card -->
      <el-card shadow="hover" class="status-card">
        <template #header>
          <div class="card-header">
            <Icon icon="material-symbols:lock" width="24" height="24" />
            <span>{{ $t('ftp_sftp.sftp_service') }}</span>
            <el-tag v-if="!sftpStatus.installed" size="small" type="warning" class="install-tag">
              <Icon icon="material-symbols:download" />
              {{ $t('ftp_sftp.not_installed') }}
            </el-tag>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="32" class="is-loading">
            <Icon icon="svg-spinners:180-ring" />
          </el-icon>
        </div>

        <div v-else>
          <div v-if="!sftpStatus.installed" class="install-mini-prompt">
            <p>{{ $t('ftp_sftp.sftp_install_prompt') }}</p>
            <el-button 
              type="success" 
              size="small" 
              @click="installService('sftp')" 
              :loading="installing"
              plain
            >
              <Icon icon="material-symbols:download" />
              {{ $t('ftp_sftp.install_sftp') }}
            </el-button>
          </div>

          <div v-else class="status-content">
            <el-descriptions :column="1" border>
              <el-descriptions-item :label="$t('ftp_sftp.status')">
                <el-tag :type="sftpStatus.running ? 'success' : 'danger'">
                  <Icon :icon="sftpStatus.running ? 'material-symbols:check-circle-outline' : 'material-symbols:error-outline'" />
                  {{ sftpStatus.running ? $t('ftp_sftp.running') : $t('ftp_sftp.stopped') }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="$t('ftp_sftp.port')">
                <el-tag>22 (SSH)</el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="$t('ftp_sftp.protocol')">
                <el-tag type="info">SFTP (SSH)</el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <div class="action-buttons">
              <el-button 
                v-if="!sftpStatus.running"
                type="success"
                @click="toggleService('sftp', 'start')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:play-arrow" />
                </template>
                {{ $t('ftp_sftp.start_service') }}
              </el-button>
              <el-button 
                v-else
                type="danger"
                @click="toggleService('sftp', 'stop')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:stop" />
                </template>
                {{ $t('ftp_sftp.stop_service') }}
              </el-button>
              <el-button
                type="warning"
                @click="toggleService('sftp', 'restart')"
                :loading="serviceLoading"
                plain
                round
              >
                <template #icon>
                  <Icon icon="material-symbols:restart-alt" />
                </template>
                {{ $t('ftp_sftp.restart_service') }}
              </el-button>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Configuration Tabs -->
    <el-tabs v-model="activeTab" class="config-tabs" v-if="ftpStatus.installed || sftpStatus.installed">
      <!-- FTP Configuration Tab -->
      <el-tab-pane :label="$t('ftp_sftp.ftp_config')" name="ftp" v-if="ftpStatus.installed">
        <el-card shadow="hover" class="config-card">
          <div class="config-section">
            <el-form label-position="top">
              <el-form-item :label="$t('ftp_sftp.enable_service')">
                <el-switch
                  v-model="ftpConfig.enabled"
                  :active-text="$t('ftp_sftp.enabled')"
                  :inactive-text="$t('ftp_sftp.disabled')"
                  inline-prompt
                  active-color="#13ce66"
                />
              </el-form-item>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item :label="$t('ftp_sftp.port')">
                    <el-input-number 
                      v-model="ftpConfig.port"
                      :min="1"
                      :max="65535"
                      controls-position="right"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item :label="$t('ftp_sftp.anonymous_login')">
                    <el-switch
                      v-model="ftpConfig.anonymousLogin"
                      :active-text="$t('ftp_sftp.yes')"
                      :inactive-text="$t('ftp_sftp.no')"
                      inline-prompt
                      active-color="#13ce66"
                    />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item :label="$t('ftp_sftp.passive_ports')">
                <div class="passive-ports">
                  <el-input-number 
                    v-model="ftpConfig.passivePorts.min"
                    :min="1024"
                    :max="65534"
                    controls-position="right"
                  />
                  <span class="port-separator">-</span>
                  <el-input-number 
                    v-model="ftpConfig.passivePorts.max"
                    :min="ftpConfig.passivePorts.min + 1"
                    :max="65535"
                    controls-position="right"
                  />
                </div>
              </el-form-item>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item :label="$t('ftp_sftp.max_connections')">
                    <el-input-number 
                      v-model="ftpConfig.maxClients"
                      :min="1"
                      :max="1000"
                      controls-position="right"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item :label="$t('ftp_sftp.timeout')">
                    <el-input-number 
                      v-model="ftpConfig.timeout"
                      :min="30"
                      :max="3600"
                      controls-position="right"
                    />
                    <span class="unit">{{ $t('ftp_sftp.seconds') }}</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item :label="$t('ftp_sftp.ssl_tls')">
                <el-switch
                  v-model="ftpConfig.sslEnabled"
                  :active-text="$t('ftp_sftp.enabled')"
                  :inactive-text="$t('ftp_sftp.disabled')"
                  inline-prompt
                  active-color="#13ce66"
                />
              </el-form-item>

              <el-form-item v-if="ftpConfig.sslEnabled" :label="$t('ftp_sftp.ssl_cert_path')">
                <el-input v-model="ftpConfig.sslCertPath" />
                <el-button type="primary" plain class="browse-btn">
                  <Icon icon="material-symbols:folder-open" />
                  {{ $t('ftp_sftp.browse') }}
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <!-- FTP Shares Management -->
        <el-card shadow="hover" class="shares-card">
          <template #header>
            <div class="card-header">
              <Icon icon="mdi:folder-shared" />
              <span>{{ $t('ftp_sftp.shared_folders') }}</span>
            </div>
          </template>

          <div class="shares-content">
            <el-table :data="ftpShares" style="width: 100%" empty-text="No shared folders">
              <el-table-column prop="path" :label="$t('ftp_sftp.path')" />
              <el-table-column :label="$t('ftp_sftp.options')" width="200">
                <template #default="scope">
                  <el-tag v-if="scope.row.options.allowOverwrite" size="small" type="info">
                    <Icon icon="material-symbols:edit" />
                    {{ $t('ftp_sftp.overwrite') }}
                  </el-tag>
                  <el-tag v-if="scope.row.options.allowResume" size="small" type="info">
                    <Icon icon="material-symbols:pause" />
                    {{ $t('ftp_sftp.resume') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('ftp_sftp.actions')" width="150" align="right">
                <template #default="scope">
                  <el-button-group>
                    <el-tooltip :content="$t('ftp_sftp.edit')" placement="top">
                      <el-button 
                        size="small" 
                        @click="editShare(scope.row)"
                        circle
                      >
                        <Icon icon="material-symbols:edit" />
                      </el-button>
                    </el-tooltip>
                    <el-tooltip :content="$t('ftp_sftp.remove')" placement="top">
                      <el-button 
                        size="small" 
                        type="danger"
                        @click="removeShare(scope.row)"
                        circle
                      >
                        <Icon icon="material-symbols:delete" />
                      </el-button>
                    </el-tooltip>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>

            <div class="add-share">
              <el-button 
                type="primary" 
                @click="showAddShareDialog"
                plain
              >
                <Icon icon="material-symbols:add" />
                {{ $t('ftp_sftp.add_share') }}
              </el-button>
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- SFTP Configuration Tab -->
      <el-tab-pane :label="$t('ftp_sftp.sftp_config')" name="sftp" v-if="sftpStatus.installed">
        <el-card shadow="hover" class="config-card">
          <div class="config-section">
            <el-alert 
              :title="$t('ftp_sftp.sftp_note')"
              type="info"
              :closable="false"
              show-icon
            />

            <el-form label-position="top" class="sftp-form">
              <el-form-item :label="$t('ftp_sftp.sftp_status')">
                <el-tag :type="sftpStatus.running ? 'success' : 'danger'">
                  <Icon :icon="sftpStatus.running ? 'material-symbols:check-circle-outline' : 'material-symbols:error-outline'" />
                  {{ sftpStatus.running ? $t('ftp_sftp.running') : $t('ftp_sftp.stopped') }}
                </el-tag>
              </el-form-item>

              <el-form-item :label="$t('ftp_sftp.sftp_port')">
                <el-tag type="info">
                  <Icon icon="mdi:network-port" />
                  22 ({{ $t('ftp_sftp.same_as_ssh') }})
                </el-tag>
              </el-form-item>

              <el-form-item :label="$t('ftp_sftp.sftp_users')">
                <el-alert 
                  :title="$t('ftp_sftp.sftp_users_note')"
                  type="info"
                  :closable="false"
                  show-icon
                />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" @click="openSshSettings">
                  <Icon icon="material-symbols:settings" />
                  {{ $t('ftp_sftp.configure_ssh') }}
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- Connections Tab -->
      <el-tab-pane :label="$t('ftp_sftp.connections')" name="connections">
        <el-card shadow="hover" class="connections-card">
          <template #header>
            <div class="card-header">
              <Icon icon="material-symbols:network-node" />
              <span>{{ $t('ftp_sftp.active_connections') }}</span>
            </div>
          </template>

          <div class="connections-content">
            <el-tabs v-model="connectionsTab">
              <!-- FTP Connections Tab -->
              <el-tab-pane 
                :label="$t('ftp_sftp.ftp_connections')" 
                name="ftp"
                v-if="ftpStatus.installed"
              >
                <el-table :data="ftpConnections" style="width: 100%" empty-text="No active FTP connections">
                  <el-table-column prop="user" :label="$t('ftp_sftp.user')">
                    <template #default="{row}">
                      <el-tag>
                        <Icon icon="mdi:account" />
                        {{ row.user }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" :label="$t('ftp_sftp.status')">
                    <template #default="{row}">
                      <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                        {{ row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="time" :label="$t('ftp_sftp.duration')" />
                  <el-table-column prop="command" :label="$t('ftp_sftp.command')" />
                  <el-table-column :label="$t('ftp_sftp.actions')" width="100" align="right">
                    <template #default="{row}">
                      <el-tooltip :content="$t('ftp_sftp.disconnect')" placement="top">
                        <el-button 
                          size="small" 
                          type="danger"
                          @click="killConnection(row.pid, 'ftp')"
                          circle
                        >
                          <Icon icon="material-symbols:close" />
                        </el-button>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <!-- SFTP Connections Tab -->
              <el-tab-pane 
                :label="$t('ftp_sftp.sftp_connections')" 
                name="sftp"
                v-if="sftpStatus.installed"
              >
                <el-table :data="sftpConnections" style="width: 100%" empty-text="No active SFTP connections">
                  <el-table-column prop="user" :label="$t('ftp_sftp.user')">
                    <template #default="{row}">
                      <el-tag>
                        <Icon icon="mdi:account" />
                        {{ row.user || 'unknown' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="remote" :label="$t('ftp_sftp.remote')" />
                  <el-table-column prop="state" :label="$t('ftp_sftp.state')">
                    <template #default="{row}">
                      <el-tag :type="getConnectionStateType(row.state)">
                        {{ row.state }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column :label="$t('ftp_sftp.actions')" width="100" align="right">
                    <template #default="{row}">
                      <el-tooltip :content="$t('ftp_sftp.disconnect')" placement="top">
                        <el-button 
                          size="small" 
                          type="danger"
                          @click="killConnection(row.pid, 'sftp')"
                          circle
                        >
                          <Icon icon="material-symbols:close" />
                        </el-button>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Configuration actions -->
    <div v-if="ftpStatus.installed && activeTab === 'ftp'" class="config-actions">
      <el-button 
        type="primary" 
        @click="saveConfig"
        :loading="saving"
        round
      >
        <Icon icon="material-symbols:save" />
        {{ $t('ftp_sftp.save_config') }}
      </el-button>

      <el-button 
        @click="resetConfig"
        :loading="resetting"
        round
      >
        <Icon icon="material-symbols:restart-alt" />
        {{ $t('ftp_sftp.reset') }}
      </el-button>
    </div>

    <!-- Full installation prompt when nothing installed -->
    <el-card v-if="!ftpStatus.installed && !sftpStatus.installed" shadow="hover" class="install-prompt">
      <div class="install-content">
        <Icon icon="material-symbols:warning" width="48" height="48" class="warning-icon" />
        <h3>{{ $t('ftp_sftp.no_services_installed') }}</h3>
        <p>{{ $t('ftp_sftp.install_prompt') }}</p>
        <div class="install-options">
          <el-button type="primary" @click="installService('ftp')" :loading="installing">
            <Icon icon="carbon:ftp" />
            {{ $t('ftp_sftp.install_ftp') }}
          </el-button>
          <el-button type="success" @click="installService('sftp')" :loading="installing">
            <Icon icon="material-symbols:lock" />
            {{ $t('ftp_sftp.install_sftp') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Add/Edit Share Dialog -->
    <el-dialog 
      v-model="shareDialogVisible" 
      :title="editShareMode ? $t('ftp_sftp.edit_share') : $t('ftp_sftp.add_share')"
      width="50%"
    >
      <el-form :model="currentShare" label-position="top">
        <el-form-item :label="$t('ftp_sftp.path')" required>
          <el-input v-model="currentShare.path">
            <template #append>
              <el-button @click="browseForPath">
  <template #icon>
    <Icon icon="material-symbols:folder-open" />
  </template>
</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('ftp_sftp.alias')">
          <el-input v-model="currentShare.alias" />
        </el-form-item>

        <el-form-item :label="$t('ftp_sftp.options')">
          <el-checkbox v-model="currentShare.options.allowOverwrite">
            <Icon icon="material-symbols:edit" />
            {{ $t('ftp_sftp.allow_overwrite') }}
          </el-checkbox>
          <el-checkbox v-model="currentShare.options.allowResume">
            <Icon icon="material-symbols:pause" />
            {{ $t('ftp_sftp.allow_resume') }}
          </el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="shareDialogVisible = false">
          <Icon icon="material-symbols:cancel" />
          {{ $t('ftp_sftp.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="confirmShare"
        >
          <Icon icon="material-symbols:check" />
          {{ $t('ftp_sftp.confirm') }}
        </el-button>
      </template>
    </el-dialog>
    
    <el-dialog 
  v-model="directoryDialogVisible" 
  :title="$t('ftp_sftp.select_directory')"
  width="60%"
>
  <el-tree
    :data="directoryTree"
    :props="treeProps"
    :load="loadDirectories"
    lazy
    node-key="path"
    @node-click="handleDirectorySelect"
    highlight-current
  >
    <template #default="{ node, data }">
      <span class="custom-tree-node">
        <Icon :icon="data.isLeaf ? 'mdi:folder-outline' : 'mdi:folder-open-outline'" />
        <span style="margin-left: 6px">{{ node.label }}</span>
      </span>
    </template>
  </el-tree>
  
  <template #footer>
    <el-button @click="directoryDialogVisible = false">
      {{ $t('ftp_sftp.cancel') }}
    </el-button>
    <el-button 
      type="primary" 
      @click="confirmDirectorySelection"
      :disabled="!selectedDirectory"
    >
      {{ $t('ftp_sftp.confirm') }}
    </el-button>
  </template>
</el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElNotification, ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const { t } = useI18n()
const router = useRouter()

// Service data
const loading = ref(true)
const serviceLoading = ref(false)
const saving = ref(false)
const resetting = ref(false)
const installing = ref(false)
const activeTab = ref('ftp')
const connectionsTab = ref('ftp')
const directoryDialogVisible = ref(false);
const directoryTree = ref([]);
const selectedDirectory = ref(null);
const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: 'isLeaf'
};

// Service status
const ftpStatus = ref({
  installed: false,
  running: false
})

const sftpStatus = ref({
  installed: false,
  running: false
})

// Configurations
const ftpConfig = ref({
  enabled: true,
  port: 21,
  anonymousLogin: false,
  passivePorts: {
    min: 49152,
    max: 65534
  },
  maxClients: 50,
  maxClientsPerIP: 5,  // This remains the same for the UI
  timeout: 300,
  sslEnabled: false,
  sslCertPath: '',
  additionalOptions: []
})

// Shares and connections
const ftpShares = ref([])
const ftpConnections = ref([])
const sftpConnections = ref([])

// Share dialog
const shareDialogVisible = ref(false)
const editShareMode = ref(false)
const currentShare = ref({
  path: '',
  alias: '',
  options: {
    allowOverwrite: false,
    allowResume: false
  }
})
 
// Connection refresh interval
let connInterval = null

// Helper functions
const getConnectionStateType = (state) => {
  if (state.includes('ESTAB')) return 'success'
  if (state.includes('TIME_WAIT')) return 'warning'
  return 'info'
}

const handleDirectorySelect = (data) => {
  selectedDirectory.value = data.path;
};

const openSshSettings = () => {
  router.push('/services/ssh')
}

const confirmDirectorySelection = () => {
  if (selectedDirectory.value) {
    currentShare.value.path = selectedDirectory.value;
    directoryDialogVisible.value = false;
    ElMessage.success(t('ftp_sftp.directory_selected'));
  } else {
    ElMessage.warning(t('ftp_sftp.no_directory_selected'));
  }
};

const browseForPath = async () => {
  try {
    const response = await axios.post('/api/filesystems/browse-directory', {
      path: currentShare.value.path || '/'
    });
    console.log(response.data.directories);
 
      directoryTree.value = response.data.directories;
      directoryDialogVisible.value = true;

  } catch (error) {
    ElMessage.error('Failed to browse directory');
    console.error('Browse error:', error);
  }
};

const loadDirectories = async (node, resolve) => {
  try {
    const response = await axios.post('/api/filesystems/browse-directory', {
      path: currentShare.value.path || '/'
    });
    
    const directories = response.data.directories.map(dir => ({
      ...dir,
      children: []
    }));
    
    resolve(directories);
  } catch (error) {
    console.error('Error loading directories:', error);
    resolve([]);
  }
};

// Service management
const toggleService = async (service, action) => {
  try {
    serviceLoading.value = true
    const response = await axios.post('/api/services/ftp-sftp/toggle', { action, service })
    
    if (response.data.success) {
      await fetchStatus()
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: response.data.message
      })
    }
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: error.response?.data?.error || t('ftp_sftp.service_toggle_error')
    })
  } finally {
    serviceLoading.value = false
  }
}

const installService = async (service) => {
  try {
    installing.value = true
    const response = await axios.post('/api/services/ftp-sftp/install', { service })
    
    if (response.data.success) {
      await fetchStatus()
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: response.data.message
      })
    }
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: error.response?.data?.error || t('ftp_sftp.install_error')
    })
  } finally {
    installing.value = false
  }
}

const saveConfig = async () => {
  try {
    saving.value = true;
    const response = await axios.post('/api/services/ftp-sftp/config', { config: ftpConfig.value });
    
    if (response.data.success) {
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: response.data.message
      });
    }
  } catch (error) {
    let errorMessage = error.response?.data?.error || t('ftp_sftp.config_save_error');
    
    if (error.response?.data?.details?.includes('FTP user does not exist')) {
      errorMessage = t('ftp_sftp.missing_user_error');
    }
    
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: errorMessage,
      duration: 5000
    });
  } finally {
    saving.value = false;
  }
};

const resetConfig = async () => {
  try {
    resetting.value = true
    await fetchConfig(true)
    ElNotification.success({
      title: t('ftp_sftp.success'),
      message: t('ftp_sftp.config_reset')
    })
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: t('ftp_sftp.config_reset_error')
    })
  } finally {
    resetting.value = false
  }
}

const fetchStatus = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/services/ftp-sftp/status')
    ftpStatus.value = response.data.ftp
    sftpStatus.value = response.data.sftp
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: t('ftp_sftp.status_fetch_error')
    })
  } finally {
    loading.value = false
  }
}

const fetchConfig = async (forceDefault = false) => {
  try {
    loading.value = true
    const response = await axios.get('/api/services/ftp-sftp/config')
    
    if (response.success) {
      ftpConfig.value = response.config
    }
    
    await fetchFtpShares()
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: t('ftp_sftp.config_fetch_error')
    })
  } finally {
    loading.value = false
  }
}

const fetchFtpShares = async () => {
  try {
    const response = await axios.get('/api/services/ftp-sftp/shares')
    if (response.data.success) {
      ftpShares.value = response.data.shares
    }
  } catch (error) {
    console.error('Error fetching FTP shares:', error)
  }
}

const fetchConnections = async () => {
  try {
    // Clear existing connections
    ftpConnections.value = []
    sftpConnections.value = []
    
    // Fetch FTP connections only if FTP is installed and running
    if (ftpStatus.value.installed && ftpStatus.value.running) {
      const response = await axios.get('/api/services/ftp-sftp/connections')
      if (response.data.success) {
        ftpConnections.value = response.data.connections
      }
    }
    
    // Fetch SFTP connections only if SFTP is installed and running
    if (sftpStatus.value.installed && sftpStatus.value.running) {
      const sftpResponse = await axios.get('/services/ssh/connections')
      if (sftpResponse.data.success) {
        sftpConnections.value = sftpResponse.data.connections
      }
    }
  } catch (error) {
    console.error('Error fetching connections:', error)
  }
}

const showAddShareDialog = () => {
  currentShare.value = {
    path: '',
    alias: '',
    options: {
      allowOverwrite: false,
      allowResume: false
    }
  }
  editShareMode.value = false
  shareDialogVisible.value = true
}

const editShare = (share) => {
  currentShare.value = JSON.parse(JSON.stringify(share))
  editShareMode.value = true
  shareDialogVisible.value = true
}

const removeShare = async (share) => {
  try {
    await ElMessageBox.confirm(
      t('ftp_sftp.confirm_delete_share', { path: share.path }),
      t('ftp_sftp.warning'),
      {
        confirmButtonText: t('ftp_sftp.confirm'),
        cancelButtonText: t('ftp_sftp.cancel'),
        type: 'warning'
      }
    )
    
    const response = await axios.post('/api/services/ftp-sftp/shares', {
      action: 'remove',
      share
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: response.data.message
      })
      await fetchFtpShares()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification.error({
        title: t('ftp_sftp.error'),
        message: error.response?.data?.error || t('ftp_sftp.share_delete_error')
      })
    }
  }
}

const confirmShare = async () => {
  try {
    const action = editShareMode.value ? 'update' : 'add'
    const response = await axios.post('/api/services/ftp-sftp/shares', {
      action,
      share: currentShare.value
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: response.data.message
      })
      shareDialogVisible.value = false
      await fetchFtpShares()
    }
  } catch (error) {
    ElNotification.error({
      title: t('ftp_sftp.error'),
      message: error.response?.data?.error || t('ftp_sftp.share_save_error')
    })
  }
}

const killConnection = async (pid, service) => {
  try {
    await ElMessageBox.confirm(
      t('ftp_sftp.confirm_kill_connection', { pid }),
      t('ftp_sftp.warning'),
      {
        confirmButtonText: t('ftp_sftp.confirm'),
        cancelButtonText: t('ftp_sftp.cancel'),
        type: 'warning'
      }
    )
    
    const response = await axios.post('/api/services/ftp-sftp/kill-connection', { 
      pid,
      service 
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: t('ftp_sftp.success'),
        message: t('ftp_sftp.connection_killed')
      })
      await fetchConnections()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification.error({
        title: t('ftp_sftp.error'),
        message: error.response?.data?.error || t('ftp_sftp.connection_kill_error')
      })
    }
  }
}

// Watch for installation status changes
watch([ftpStatus, sftpStatus], ([newFtp, newSftp]) => {
  // Set active tab to first available service
  if (newFtp.installed) activeTab.value = 'ftp'
  else if (newSftp.installed) activeTab.value = 'sftp'
  
  // Setup or clear connection refresh interval
  if (newFtp.installed || newSftp.installed) {
    if (!connInterval) {
      fetchConnections()
      connInterval = setInterval(fetchConnections, 10000)
    }
  } else {
    if (connInterval) {
      clearInterval(connInterval)
      connInterval = null
    }
  }
}, { deep: true })

// Initialize component
onMounted(() => {
  fetchStatus().then(() => {
    fetchConfig()
  })
})

// Cleanup on unmount
onUnmounted(() => {
  if (connInterval) {
    clearInterval(connInterval)
  }
})
</script>

<style scoped>
.ftp-sftp-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.service-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.status-card,
.config-card,
.shares-card,
.connections-card,
.install-prompt {
  border-radius: 12px;
  border: none;
  box-shadow: 0 1px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.status-card:hover,
.config-card:hover,
.shares-card:hover,
.connections-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 25px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--el-text-color-primary);
}

.install-tag {
  margin-left: auto;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-spinner {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.config-tabs {
  margin-top: 10px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.passive-ports {
  display: flex;
  align-items: center;
  gap: 10px;
}

.port-separator {
  padding: 0 10px;
  color: var(--el-text-color-secondary);
}

.unit {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.install-prompt {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.install-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 15px;
}

.warning-icon {
  color: var(--el-color-warning);
}

.install-options {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.install-mini-prompt {
  padding: 15px;
  text-align: center;
  background-color: var(--el-color-info-light-9);
  border-radius: 8px;
  margin: 10px 0;
}

.install-mini-prompt p {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.shares-content {
  padding: 10px;
}

.add-share {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.connections-content {
  padding: 10px;
}

.sftp-form {
  padding: 10px;
}

.browse-btn {
  margin-left: 10px;
}

/* Custom icon styles */
.iconify {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
}

/* Responsiveness */
@media (max-width: 768px) {
  .service-cards {
    grid-template-columns: 1fr;
  }
  
  .action-buttons,
  .config-actions,
  .install-options {
    flex-direction: column;
  }
  
  .action-buttons > *,
  .config-actions > *,
  .install-options > * {
    width: 100%;
  }
  
  .passive-ports {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .port-separator {
    padding: 5px 0;
  }
}
</style>
