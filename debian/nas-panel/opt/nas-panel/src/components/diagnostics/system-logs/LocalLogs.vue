<template>
  <div class="logs-container">
    <div class="logs-header">
      <h2>
        <el-icon><Icon icon="mdi:file-document-multiple-outline" /></el-icon>
        {{ $t('systemLogs.localLogs') }}
      </h2>
      <div class="controls">
        <el-select
          v-model="selectedLog"
          :placeholder="$t('systemLogs.selectLogFile')"
          style="width: 200px"
          size="small"
          @change="loadLogs"
        >
          <el-option
            v-for="log in availableLogs"
            :key="log.key"
            :label="log.name"
            :value="log"
          />
        </el-select>

        <el-input
          v-model="filterText"
          :placeholder="$t('systemLogs.filterLogs')"
          clearable
          style="width: 200px"
          size="small"
        >
          <template #prefix>
            <el-icon><Icon icon="mdi:filter-outline" /></el-icon>
          </template>
        </el-input>

        <el-slider
          v-model="linesToShow"
          :label="$t('systemLogs.linesToShow')"
          :min="50"
          :max="1000"
          :step="50"
          style="width: 200px"
          show-input
          size="small"
          @change="loadLogs"
        />

        <el-button
          type="primary"
          size="small"
          @click="loadLogs"
          :loading="loading"
        >
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          {{ $t('systemLogs.refresh') }}
        </el-button>
      </div>
    </div>

    <el-card class="log-card">
      <div class="log-header">
        <span>
          <el-icon><Icon icon="mdi:information-outline" /></el-icon>
          {{ selectedLog.name }} ({{ $t('systemLogs.logSize') }}: {{ formatFileSize(selectedLog.size) }})
        </span>
        <el-tag size="small">{{ logLines.length }} {{ $t('systemLogs.logLines') }}</el-tag>
      </div>

      <div class="log-content-wrapper">
        <div class="log-content">
          <pre v-if="!loading">{{ filteredLogContent }}</pre>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const loading = ref(false)
const availableLogs = ref([])
const selectedLog = ref({})
const logContent = ref('')
const filterText = ref('')
const linesToShow = ref(200)

const logLines = computed(() => {
  return logContent.value.split('\n').filter(line => line.trim())
})

const filteredLogContent = computed(() => {
  if (!filterText.value) return logContent.value
  return logLines.value
    .filter(line => line.toLowerCase().includes(filterText.value.toLowerCase()))
    .join('\n')
})

const loadAvailableLogs = async () => {
  try {
    const response = await axios.get('/diagnostics/system-logs')
    availableLogs.value = Object.entries(response.data.availableLogs).map(([key, path]) => ({
      key,
      name: key.toUpperCase(),
      path,
      size: response.data.totalSize
    }))
    
    if (availableLogs.value.length > 0) {
      selectedLog.value = availableLogs.value[0]
      await loadLogs()
    }
  } catch (error) {
    console.error('Błąd ładowania dostępnych logów:', error)
  }
}

const loadLogs = async () => {
  if (!selectedLog.value?.key) return
  
  loading.value = true
  try {
    const response = await axios.get(
      `/diagnostics/system-logs/${selectedLog.value.key}?lines=${linesToShow.value}`
    )
    logContent.value = response.data.data
  } catch (error) {
    console.error('Błąd ładowania logów:', error)
    logContent.value = `Błąd: ${error.message}`
  } finally {
    loading.value = false
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(async () => {
  await loadAvailableLogs()
})
</script>

<style scoped>
.logs-container {
  padding: 20px;
  height: 600px;
  display: flex;
  flex-direction: column;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.log-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Kluczowe dla poprawnego działania scrollbara */
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.log-content-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-content {
  height: 600px;
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
  .logs-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .controls > * {
    width: 100%;
  }
}
</style>
