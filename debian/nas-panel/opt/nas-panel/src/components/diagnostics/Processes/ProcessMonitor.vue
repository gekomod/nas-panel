<template>
  <div class="process-monitor">
    <div class="monitor-header">
      <h2>
        <el-icon><Icon icon="mdi:chart-box" /></el-icon>
        Monitor procesów systemowych
      </h2>
      <div class="controls">
        <el-button size="small" @click="refreshProcesses" :loading="loading">
          <el-icon><Icon icon="mdi:refresh" /></el-icon>
          Odśwież
        </el-button>
        <el-input
          v-model="searchQuery"
          placeholder="Wyszukaj proces..."
          clearable
          style="width: 200px"
          size="small"
        >
          <template #prefix>
            <el-icon><Icon icon="mdi:magnify" /></el-icon>
          </template>
        </el-input>
      </div>
    </div>

    <el-table
      :data="filteredProcesses"
      style="width: 100%"
      v-loading="loading"
      stripe
      border
      height="calc(100vh - 220px)"
    >
      <el-table-column prop="pid" label="PID" width="80" sortable />
      <el-table-column prop="name" label="Nazwa" width="180" sortable />
      <el-table-column prop="user" label="Użytkownik" width="120" sortable />
      <el-table-column prop="cpu" label="CPU %" width="100" sortable>
        <template #default="{ row }">
          <el-progress 
            :percentage="row.cpu" 
            :color="getCpuColor(row.cpu)"
            :show-text="false"
            :stroke-width="16"
          />
          <span class="percentage">{{ row.cpu.toFixed(1) }}%</span>
        </template>
      </el-table-column>
      <el-table-column prop="memory" label="Pamięć %" width="120" sortable>
        <template #default="{ row }">
          <el-progress 
            :percentage="row.memory" 
            :color="getMemoryColor(row.memory)"
            :show-text="false"
            :stroke-width="16"
          />
          <span class="percentage">{{ row.memory.toFixed(1) }}%</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="Status" width="100" sortable>
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="command" label="Polecenie" show-overflow-tooltip />
      <el-table-column label="Akcje" width="120">
        <template #default="{ row }">
          <el-button-group>
            <el-tooltip content="Zakończ proces" placement="top">
              <el-button
                size="small"
                type="danger"
                @click="killProcess(row.pid)"
                :disabled="row.protected"
              >
                <el-icon><Icon icon="mdi:skull" /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="Szczegóły" placement="top">
              <el-button
                size="small"
                type="info"
                @click="showDetails(row)"
              >
                <el-icon><Icon icon="mdi:information" /></el-icon>
              </el-button>
            </el-tooltip>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailsDialogVisible" title="Szczegóły procesu" width="60%">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="PID">{{ currentProcess.pid }}</el-descriptions-item>
        <el-descriptions-item label="Nazwa">{{ currentProcess.name }}</el-descriptions-item>
        <el-descriptions-item label="Użytkownik">{{ currentProcess.user }}</el-descriptions-item>
        <el-descriptions-item label="Status">
          <el-tag :type="getStatusType(currentProcess.status)" size="small">
            {{ currentProcess.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="CPU %">{{ currentProcess.cpu }}%</el-descriptions-item>
        <el-descriptions-item label="Pamięć %">{{ currentProcess.memory }}%</el-descriptions-item>
        <el-descriptions-item label="Polecenie" :span="2">
          <pre class="command">{{ currentProcess.command }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="Ścieżka" :span="2">{{ currentProcess.path || 'N/A' }}</el-descriptions-item>
        <el-descriptions-item label="Uruchomiono" :span="2">{{ currentProcess.started || 'N/A' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailsDialogVisible = false">Zamknij</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'

const loading = ref(false)
const processes = ref([])
const searchQuery = ref('')
const detailsDialogVisible = ref(false)
const currentProcess = ref({})

const filteredProcesses = computed(() => {
  if (!searchQuery.value) return processes.value
  const query = searchQuery.value.toLowerCase()
  return processes.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.pid.toString().includes(query) ||
    p.user.toLowerCase().includes(query) ||
    p.command.toLowerCase().includes(query))
})

const getCpuColor = (percentage) => {
  if (percentage > 70) return '#f56c6c'
  if (percentage > 30) return '#e6a23c'
  return '#67c23a'
}

const getMemoryColor = (percentage) => {
  if (percentage > 80) return '#f56c6c'
  if (percentage > 50) return '#e6a23c'
  return '#67c23a'
}

const getStatusType = (status) => {
  switch(status.toLowerCase()) {
    case 'running': return 'success'
    case 'sleeping': return 'primary'
    case 'stopped': return 'warning'
    case 'zombie': return 'danger'
    default: return 'info'
  }
}

const fetchProcesses = async () => {
  try {
    loading.value = true
    const response = await axios.get('/diagnostics/processes')
    processes.value = response.data.processes.map(p => ({
      ...p,
      cpu: parseFloat(p.cpu),
      memory: parseFloat(p.memory),
      protected: p.user === 'root' || p.pid < 100
    }))
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania procesów')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const refreshProcesses = () => {
  fetchProcesses()
}

const killProcess = (pid) => {
  ElMessageBox.confirm(
    `Czy na pewno chcesz zakończyć proces ${pid}?`,
    'Potwierdzenie',
    {
      confirmButtonText: 'Zakończ',
      cancelButtonText: 'Anuluj',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await axios.post('/diagnostics/processes/kill', { pid })
      ElMessage.success(`Proces ${pid} został zakończony`)
      fetchProcesses()
    } catch (error) {
      ElMessage.error(`Błąd podczas kończenia procesu: ${error.response?.data?.message || error.message}`)
    }
  }).catch(() => {})
}

const showDetails = (process) => {
  currentProcess.value = process
  detailsDialogVisible.value = true
}

onMounted(() => {
  fetchProcesses()
})
</script>

<style scoped>
.process-monitor {
  padding: 20px;
  height: 100%;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.percentage {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.command {
  margin: 0;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.el-progress {
  display: inline-flex;
  width: 80%;
  vertical-align: middle;
}
</style>
