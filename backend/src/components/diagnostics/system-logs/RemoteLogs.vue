<template>
  <div class="remote-logs-container">
    <div class="logs-header">
      <h2>
        <el-icon><Icon icon="mdi:server-network" /></el-icon>
        {{ $t('systemLogs.remoteLogs') }}
      </h2>
    </div>

    <el-card class="config-card">
      <div class="config-form">
        <el-form :model="syslogConfig" label-position="top">
          <el-form-item :label="$t('systemLogs.enableRemote')">
            <el-switch 
              v-model="syslogConfig.enabled" 
              :active-text="$t('systemLogs.enableRemote')"
            />
          </el-form-item>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item :label="$t('systemLogs.host')">
                <el-input 
                  v-model="syslogConfig.host" 
                  :placeholder="$t('systemLogs.host')"
                  :disabled="!syslogConfig.enabled"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item :label="$t('systemLogs.port')">
                <el-input-number
                  v-model="syslogConfig.port"
                  :min="1"
                  :max="65535"
                  :disabled="!syslogConfig.enabled"
                />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item :label="$t('systemLogs.protocol')">
                <el-select
                  v-model="syslogConfig.protocol"
                  :disabled="!syslogConfig.enabled"
                >
                  <el-option label="UDP" value="udp" />
                  <el-option label="TCP" value="tcp" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item>
            <el-button 
              type="primary" 
              @click="saveConfig"
            >
             {{ $t('systemLogs.saveConfig') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <el-divider />

    <el-card class="log-viewer-card">
      <div class="log-viewer-header">
        <h3>
          <el-icon><Icon icon="mdi:file-document-multiple-outline" /></el-icon>
          {{ $t('systemLogs.receivedLogs') }}
        </h3>
        <el-button 
          type="primary" 
          size="small"
          @click="fetchRemoteLogs"
          :loading="loading"
        >
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          {{ $t('systemLogs.refresh') }}
        </el-button>
      </div>

      <div class="log-content-wrapper">
        <div class="log-content">
          <pre v-if="!loading">{{ remoteLogs }}</pre>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const remoteLogs = ref('')
const syslogConfig = ref({
  enabled: false,
  host: '',
  port: 514,
  protocol: 'udp'
})

const fetchRemoteLogs = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/diagnostics/remote-logs')
    remoteLogs.value = response.data.logs
  } catch (error) {
    console.error('Błąd pobierania zdalnych logów:', error)
    remoteLogs.value = 'Błąd podczas ładowania zdalnych logów'
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  try {
    await axios.post('/api/diagnostics/remote-logs/config', syslogConfig.value)
    ElMessage.success(`$t{'systemLogs.configSaved}`);
  } catch (error) {
    ElMessage.error(`$t{'systemLogs.configError}`)
  }
}

const loadConfig = async () => {
  try {
    const response = await axios.get('/api/diagnostics/remote-logs/config')
    syslogConfig.value = response.data.config
  } catch (error) {
    // ERROR WHEN LOAD CONFIG
  }
}

onMounted(async () => {
  await loadConfig()
  if (syslogConfig.value.enabled) {
    await fetchRemoteLogs()
  }
})
</script>

<style scoped>
.remote-logs-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logs-header {
  margin-bottom: 20px;
}

.config-card {
  margin-bottom: 20px;
}

.config-form {
  max-width: 800px;
}

.log-viewer-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.log-content-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--el-fill-color-light);
  padding: 10px;
  border-radius: 4px;
}

.log-content pre {
  margin: 0;
  font-family: monospace;
  white-space: pre-wrap;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

/* Custom scrollbar */
.log-content::-webkit-scrollbar {
  width: 8px;
}

.log-content::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.log-content::-webkit-scrollbar-thumb {
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-color-primary);
}

@media (max-width: 768px) {
  .config-form {
    max-width: 100%;
  }
}
</style>
