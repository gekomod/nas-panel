<template>
  <div class="remote-log-viewer">
    <el-alert
      v-if="!server.connected"
      :title="$t('systemLogs.serverDisconnected')"
      type="warning"
      :closable="false"
      class="mb-4"
    />

    <template v-else>
      <div class="controls">
        <el-select
          v-model="selectedLogType"
          :placeholder="$t('systemLogs.logType')"
          size="small"
          style="width: 200px"
        >
          <el-option
            v-for="type in availableLogTypes"
            :key="type"
            :label="type"
            :value="type"
          />
        </el-select>

        <el-input
          v-model="logFilter"
          :placeholder="$t('systemLogs.filterLogs')"
          clearable
          size="small"
          style="width: 300px"
        >
          <template #prefix>
            <el-icon><Icon icon="mdi:filter-outline" /></el-icon>
          </template>
        </el-input>

        <el-button
          type="primary"
          size="small"
          @click="fetchLogs"
          :loading="loading"
        >
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          Odśwież
        </el-button>
      </div>

      <el-card class="log-card">
        <div class="log-header">
          <span>
            <el-icon><Icon icon="mdi:information-outline" /></el-icon>
            {{ server.name }} - {{ selectedLogType }}
          </span>
          <el-tag size="small">{{ displayedLines }} / {{ totalLines }} linii</el-tag>
        </div>

        <div class="log-content">
          <pre v-if="!loading">{{ filteredLogContent }}</pre>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  server: {
    type: Object,
    required: true
  }
})

const availableLogTypes = ref(['syslog', 'auth.log', 'kern.log', 'messages', 'daemon.log'])
const selectedLogType = ref('syslog')
const logContent = ref('')
const loading = ref(false)
const logFilter = ref('')
const totalLines = ref(0)

const logLines = computed(() => {
  return logContent.value.split('\n').filter(line => line.trim())
})

const displayedLines = computed(() => {
  return filteredLogContent.value.split('\n').filter(line => line.trim()).length
})

const filteredLogContent = computed(() => {
  if (!logFilter.value) return logContent.value
  return logLines.value
    .filter(line => line.toLowerCase().includes(logFilter.value.toLowerCase()))
    .join('\n')
})

const fetchLogs = async () => {
  if (!props.server.connected) return

  loading.value = true
  try {
    // Symulacja pobierania logów - zastąp rzeczywistą implementacją
    await new Promise(resolve => setTimeout(resolve, 800))
    logContent.value = generateMockLogs()
    totalLines.value = logLines.value.length
  } catch (error) {
    console.error('Błąd pobierania logów:', error)
    logContent.value = `Błąd: ${error.message}`
  } finally {
    loading.value = false
  }
}

const generateMockLogs = () => {
  const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG']
  const messages = [
    'User login from 192.168.1.1',
    'Disk space running low on /var',
    'Network interface eth0 up',
    'Cron job completed',
    'Authentication failed for user admin',
    'System reboot requested'
  ]

  const logs = []
  for (let i = 0; i < 150; i++) {
    const date = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    const level = levels[Math.floor(Math.random() * levels.length)]
    const msg = messages[Math.floor(Math.random() * messages.length)]
    logs.push(`${date.toISOString()} [${level}] ${msg}`)
  }

  return logs.join('\n')
}

watch(selectedLogType, fetchLogs)

fetchLogs()
</script>

<style scoped>
.remote-log-viewer {
  padding: 10px;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.log-card {
  margin-top: 10px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color);
}

.log-content {
  height: 400px;
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

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
  }
  
  .controls > * {
    width: 100%;
  }
}
</style>
