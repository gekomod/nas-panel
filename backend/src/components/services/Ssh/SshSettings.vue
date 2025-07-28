<template>
  <div class="ssh-container">
    <div class="ssh-header">
      <h2>
        <el-icon><Icon icon="mdi:console-network" /></el-icon>
        {{ $t('sshSettings.title') }}
      </h2>
      <div class="service-controls">
        <el-switch
          v-model="serviceStatus.active"
          :active-text="$t('sshSettings.enabled')"
          :inactive-text="$t('sshSettings.disabled')"
          @change="toggleService"
          :loading="statusLoading"
        />
        <el-tag :type="serviceStatus.active ? 'success' : 'danger'">
          {{ serviceStatus.active ? $t('sshSettings.running') : $t('sshSettings.stopped') }}
        </el-tag>
        <el-button
          size="small"
          @click="loadServiceStatus"
          :loading="statusLoading"
        >
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          {{ $t('sshSettings.refresh') }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane :label="$t('sshSettings.basicSettings')" name="basic">
        <el-card class="settings-card">
          <el-form label-position="top" :model="settings" ref="settingsForm">
            <el-row :gutter="20">
              <el-col :md="12" :sm="24">
                <el-form-item :label="$t('sshSettings.port')" prop="port">
                  <el-input-number
                    v-model="settings.port"
                    :min="1"
                    :max="65535"
                    controls-position="right"
                  />
                </el-form-item>

                <el-form-item :label="$t('sshSettings.rootLogin')">
                  <el-switch
                    v-model="settings.allowRootLogin"
                    :active-text="$t('sshSettings.enabled')"
                    :inactive-text="$t('sshSettings.disabled')"
                  />
                  <div class="form-hint">{{ $t('sshSettings.rootLoginHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('sshSettings.passwordAuth')">
                  <el-switch
                    v-model="settings.passwordAuthentication"
                    :active-text="$t('sshSettings.enabled')"
                    :inactive-text="$t('sshSettings.disabled')"
                  />
                </el-form-item>
              </el-col>

              <el-col :md="12" :sm="24">
                <el-form-item :label="$t('sshSettings.publicKeyAuth')">
                  <el-switch
                    v-model="settings.publicKeyAuthentication"
                    :active-text="$t('sshSettings.enabled')"
                    :inactive-text="$t('sshSettings.disabled')"
                  />
                </el-form-item>

                <el-form-item :label="$t('sshSettings.tcpForwarding')">
                  <el-switch
                    v-model="settings.tcpForwarding"
                    :active-text="$t('sshSettings.enabled')"
                    :inactive-text="$t('sshSettings.disabled')"
                  />
                  <div class="form-hint">{{ $t('sshSettings.tcpForwardingHint') }}</div>
                </el-form-item>

                <el-form-item :label="$t('sshSettings.compression')">
                  <el-switch
                    v-model="settings.compression"
                    :active-text="$t('sshSettings.enabled')"
                    :inactive-text="$t('sshSettings.disabled')"
                  />
                  <div class="form-hint">{{ $t('sshSettings.compressionHint') }}</div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item :label="$t('sshSettings.additionalOptions')">
              <el-input
                v-model="settings.additionalOptions"
                type="textarea"
                :rows="3"
                :placeholder="$t('sshSettings.additionalOptionsPlaceholder')"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                @click="saveSettings"
                :loading="saveLoading"
              >
                {{ $t('sshSettings.saveSettings') }}
              </el-button>
              <el-button @click="resetSettings">
                {{ $t('sshSettings.reset') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="$t('sshSettings.serviceStatus')" name="status">
        <el-card>
          <div class="status-info">
            <h3>{{ $t('sshSettings.serviceDetails') }}</h3>
            <el-descriptions :column="1" border>
              <el-descriptions-item :label="$t('sshSettings.version')">
                {{ serviceStatus.version || 'N/A' }}
              </el-descriptions-item>
              <el-descriptions-item :label="$t('sshSettings.installed')">
                <el-tag :type="serviceStatus.installed ? 'success' : 'warning'">
                  {{ serviceStatus.installed ? $t('sshSettings.yes') : $t('sshSettings.no') }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="$t('sshSettings.configPath')">
                /etc/ssh/sshd_config
              </el-descriptions-item>
            </el-descriptions>

            <h3 style="margin-top: 20px;">{{ $t('sshSettings.statusOutput') }}</h3>
            <pre class="status-output">{{ serviceStatus.details }}</pre>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="$t('sshSettings.activeConnections')" name="connections">
        <el-card>
          <div class="connections-header">
            <h3>{{ $t('sshSettings.currentConnections') }}</h3>
            <el-button
              size="small"
              @click="loadConnections"
              :loading="connectionsLoading"
            >
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
              {{ $t('sshSettings.refresh') }}
            </el-button>
          </div>

          <el-table
            :data="connections"
            style="width: 100%"
            v-loading="connectionsLoading"
            empty-text="No active connections"
          >
            <el-table-column
              prop="local"
              :label="$t('sshSettings.localAddress')"
            />
            <el-table-column
              prop="remote"
              :label="$t('sshSettings.remoteAddress')"
            />
            <el-table-column
              prop="state"
              :label="$t('sshSettings.state')"
            />
            <el-table-column
              prop="pid"
              :label="$t('sshSettings.pid')"
            />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('basic')
const statusLoading = ref(false)
const saveLoading = ref(false)
const connectionsLoading = ref(false)

const serviceStatus = ref({
  installed: false,
  active: false,
  version: '',
  details: ''
})

const connections = ref([])

const defaultSettings = {
  port: 22,
  allowRootLogin: false,
  passwordAuthentication: true,
  publicKeyAuthentication: true,
  tcpForwarding: false,
  compression: false,
  additionalOptions: ''
}

const settings = ref({ ...defaultSettings })

const loadServiceStatus = async () => {
  try {
    statusLoading.value = true
    const response = await axios.get('/services/ssh/status')
    serviceStatus.value = response.data
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    statusLoading.value = false
  }
}

const loadSettings = async () => {
  try {
    const response = await axios.get('/services/ssh/config')
    settings.value = response.data.config
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  }
}

const loadConnections = async () => {
  try {
    connectionsLoading.value = true
    const response = await axios.get('/services/ssh/connections')
    connections.value = response.data.connections
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    connectionsLoading.value = false
  }
}

const toggleService = async () => {
  try {
    statusLoading.value = true
    const action = serviceStatus.value.active ? 'start' : 'stop'
    await axios.post('/services/ssh/toggle', { action })
    ElMessage.success(`SSH service ${action}ed successfully`)
    await loadServiceStatus()
  } catch (error) {
    serviceStatus.value.active = !serviceStatus.value.active // Revert switch on error
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    statusLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    saveLoading.value = true
    await axios.post('/services/ssh/config', {
      config: settings.value
    })
    ElMessage.success('Settings saved successfully')
    await loadServiceStatus()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message)
  } finally {
    saveLoading.value = false
  }
}

const resetSettings = () => {
  settings.value = { ...defaultSettings }
}

onMounted(() => {
  loadServiceStatus()
  loadSettings()
  loadConnections()
})
</script>

<style scoped>
.ssh-container {
  padding: 20px;
}

.ssh-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.service-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-card {
  margin-top: 20px;
}

.status-info {
  padding: 10px;
}

.status-output {
  background-color: var(--el-fill-color-light);
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}

.connections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.form-hint {
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
  margin-top: 5px;
}

@media (max-width: 768px) {
  .ssh-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .service-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
