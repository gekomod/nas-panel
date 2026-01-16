<template>
  <el-card class="docker-widget" shadow="hover">
    <!-- Nagłówek -->
    <template #header>
      <div class="widget-header">
        <div class="header-left">
          <Icon icon="mdi:docker" class="docker-icon" />
          <span class="widget-title">{{ t('widgets.Docker') }}</span>
        </div>
        <div class="header-right">
          <el-tag 
            :type="dockerStatusClass" 
            size="small" 
            class="status-tag"
          >
            <span class="status-dot"></span>
            {{ dockerStatusText }}
          </el-tag>
          <el-button 
            size="small" 
            text 
            @click="fetchData"
            :loading="loading"
            class="refresh-btn"
          >
            <Icon icon="mdi:refresh" />
          </el-button>
        </div>
      </div>
    </template>

    <!-- Treść -->
    <div class="widget-content">
      <!-- Stan Docker nie działa -->
      <div v-if="!dockerRunning" class="offline-state">
        <div class="offline-icon">
          <Icon icon="mdi:docker-off" />
        </div>
        <p class="offline-text">{{ t('docker.messages.dockerNotRunning') }}</p>
        <el-button 
          type="primary" 
          size="small" 
          @click="startDocker"
          :loading="startingDocker"
          class="start-btn"
        >
          {{ t('docker.buttons.startDocker') }}
        </el-button>
      </div>

      <!-- Stan Docker działa -->
      <div v-else>
        <!-- Statystyki -->
        <div class="stats-row">
          <div class="stat-item" v-tooltip="t('docker.stats.running')">
            <Icon icon="mdi:play-circle-outline" class="stat-icon running" />
            <span class="stat-count">{{ runningContainersCount }}</span>
          </div>
          <div class="stat-item" v-tooltip="t('docker.stats.stopped')">
            <Icon icon="mdi:stop-circle-outline" class="stat-icon stopped" />
            <span class="stat-count">{{ stoppedContainersCount }}</span>
          </div>
          <div class="stat-item" v-tooltip="t('docker.stats.total')">
            <Icon icon="mdi:cube-outline" class="stat-icon total" />
            <span class="stat-count">{{ containers.length }}</span>
          </div>
        </div>

        <!-- Lista kontenerów -->
        <div class="containers-list">
          <div v-if="containers.length === 0" class="empty-state">
            <Icon icon="mdi:package-variant" class="empty-icon" />
            <p>{{ t('docker.messages.noContainers') }}</p>
          </div>

          <div 
            v-else 
            v-for="container in containers" 
            :key="container.id" 
            class="container-item"
          >
            <div class="container-left">
              <div class="container-icon">
                <Icon :icon="getContainerIcon(container)" />
              </div>
              <div class="container-info">
                <div class="container-name">
                  {{ formatContainerName(container.names) }}
                </div>
                <div class="container-status" :class="getStatusClass(container)">
                  {{ getStatusText(container) }}
                </div>
              </div>
            </div>

            <div class="container-right">
              <el-button
                size="small"
                :type="isContainerRunning(container) ? 'danger' : 'success'"
                :loading="container.loading"
                @click="toggleContainer(container)"
                class="action-btn"
              >
                <Icon :icon="isContainerRunning(container) ? 'mdi:stop' : 'mdi:play'" />
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'DockerWidget',
  displayName: 'Kontenery Docker'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Refs
const containers = ref([])
const loading = ref(false)
const dockerStatus = ref('unknown')
const startingDocker = ref(false)
let intervalId = null

// Computed properties
const dockerRunning = computed(() => dockerStatus.value === 'active')

const dockerStatusClass = computed(() => {
  const map = {
    'active': 'success',
    'inactive': 'danger',
    'error': 'warning',
    'unknown': 'info'
  }
  return map[dockerStatus.value] || 'info'
})

const dockerStatusText = computed(() => {
  const map = {
    'active': t('docker.status.running'),
    'inactive': t('docker.status.stopped'),
    'error': t('docker.status.error'),
    'unknown': t('docker.status.unknown')
  }
  return map[dockerStatus.value] || t('docker.status.unknown')
})

const runningContainersCount = computed(() => {
  return containers.value.filter(container => isContainerRunning(container)).length
})

const stoppedContainersCount = computed(() => {
  return containers.value.filter(container => !isContainerRunning(container)).length
})

// Funkcje pomocnicze
const isContainerRunning = (container) => {
  if (!container) return false
  
  const status = String(container.Status || container.status || '').toLowerCase().trim()
  const state = String(container.state || '').toLowerCase().trim()
  
  // Kontener jest uruchomiony jeśli Status zaczyna się od "Up"
  return status.startsWith('up') || 
         state === 'running' ||
         status.includes('running')
}

const getContainerIcon = (container) => {
  const image = container.Image || ''
  
  if (image.includes('nginx')) return 'mdi:nginx'
  if (image.includes('mysql') || image.includes('mariadb')) return 'mdi:database'
  if (image.includes('redis')) return 'mdi:redis'
  if (image.includes('postgres')) return 'mdi:postgresql'
  if (image.includes('mongo')) return 'mdi:mongodb'
  if (image.includes('node')) return 'mdi:nodejs'
  if (image.includes('wordpress')) return 'mdi:wordpress'
  
  return isContainerRunning(container) ? 'mdi:cube-outline' : 'mdi:cube-off-outline'
}

const getStatusClass = (container) => {
  return isContainerRunning(container) ? 'status-running' : 'status-stopped'
}

const getStatusText = (container) => {
  const status = container.Status || container.status || ''
  const statusStr = String(status).toLowerCase()
  
  if (statusStr.startsWith('up')) {
    return t('docker.status.running')
  } else if (statusStr.includes('exited') || statusStr.includes('stopped')) {
    return t('docker.status.stopped')
  }
  
  return status || t('docker.status.unknown')
}

const formatContainerName = (names) => {
  if (!names) return 'Unknown'
  
  if (typeof names === 'string') {
    return names.replace(/^\//, '')
  }
  
  if (Array.isArray(names)) {
    const name = names[0] || ''
    return name.replace(/^\//, '')
  }
  
  return String(names)
}

// Główne funkcje
const fetchData = async () => {
  await fetchDockerStatus()
}

const fetchDockerStatus = async () => {
  try {
    const response = await axios.get('/services/docker/status')
    dockerStatus.value = response.data.status || 'unknown'
    
    if (dockerRunning.value) {
      await fetchContainers()
    } else {
      containers.value = []
    }
  } catch (error) {
    console.error('Błąd pobierania statusu Dockera:', error)
    dockerStatus.value = 'inactive'
    containers.value = []
  }
}

const fetchContainers = async () => {
  if (!dockerRunning.value) return
  
  try {
    loading.value = true
    const response = await axios.get('/services/docker/containers', {
      params: { all: false }
    })
    
    let rawContainers = []
    
    if (Array.isArray(response.data)) {
      rawContainers = response.data
    } else if (response.data.containers && Array.isArray(response.data.containers)) {
      rawContainers = response.data.containers
    } else if (response.data.data && Array.isArray(response.data.data)) {
      rawContainers = response.data.data
    } else {
      rawContainers = []
    }
    
    containers.value = rawContainers.map(container => ({
      id: container.ID || container.Id || container.ContainerID || container.containerID,
      names: container.Names || container.Name || container.names,
      Status: container.Status,
      status: container.status,
      state: container.State || container.state,
      Image: container.Image || container.image,
      loading: false
    }))
    
  } catch (error) {
    console.error('Błąd pobierania kontenerów:', error)
    ElMessage.error(t('docker.messages.fetchContainersError'))
    containers.value = []
  } finally {
    loading.value = false
  }
}

const startDocker = async () => {
  try {
    startingDocker.value = true
    await axios.post('/services/docker/start')
    ElMessage.success(t('docker.messages.dockerStarted'))
    await fetchDockerStatus()
  } catch (error) {
    console.error('Błąd uruchamiania Dockera:', error)
    ElMessage.error(t('docker.messages.dockerStartError'))
  } finally {
    startingDocker.value = false
  }
}

const toggleContainer = async (container) => {
  try {
    container.loading = true
    const isRunning = isContainerRunning(container)
    const action = isRunning ? 'stop' : 'start'
    
    await axios.post(`/services/docker/container/${container.id}/${action}`)
    
    // Aktualizuj status
    if (isRunning) {
      container.Status = 'Exited'
    } else {
      container.Status = 'Up 0 seconds'
    }
    
    ElMessage.success(
      isRunning 
        ? t('docker.messages.containerStopped', { name: formatContainerName(container.names) })
        : t('docker.messages.containerStarted', { name: formatContainerName(container.names) })
    )
    
  } catch (error) {
    console.error('Błąd zmiany stanu kontenera:', error)
    ElMessage.error(t('docker.messages.containerToggleError'))
  } finally {
    container.loading = false
  }
}

// Lifecycle
onMounted(() => {
  fetchDockerStatus()
  intervalId = setInterval(fetchDockerStatus, 10000)
})

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.docker-widget {
  height: 100%;
  border-radius: 12px;
}

/* Nagłówek */
.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.docker-icon {
  font-size: 20px;
  color: #2496ed;
}

.widget-title {
  font-weight: 600;
  font-size: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-tag.el-tag--success .status-dot {
  background-color: #67c23a;
}

.status-tag.el-tag--danger .status-dot {
  background-color: #f56c6c;
}

.status-tag.el-tag--warning .status-dot {
  background-color: #e6a23c;
}

.status-tag.el-tag--info .status-dot {
  background-color: #909399;
}

.refresh-btn {
  padding: 4px;
}

/* Treść */
.widget-content {
  padding: 8px 0;
}

/* Offline state */
.offline-state {
  text-align: center;
  padding: 20px 0;
}

.offline-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 12px;
}

.offline-text {
  color: #606266;
  margin-bottom: 16px;
  font-size: 14px;
}

.start-btn {
  width: 100%;
}

/* Statystyki */
.stats-row {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 20px;
}

.stat-icon.running {
  color: #67c23a;
}

.stat-icon.stopped {
  color: #f56c6c;
}

.stat-icon.total {
  color: #909399;
}

.stat-count {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* Lista kontenerów */
.containers-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.containers-list::-webkit-scrollbar {
  width: 4px;
}

.containers-list::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 2px;
}

.containers-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

.containers-list::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

.empty-state {
  text-align: center;
  padding: 20px 0;
  color: #909399;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
  opacity: 0.6;
}

.container-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  transition: all 0.2s;
}

.container-item:hover {
  background: #f5f7fa;
  border-color: #dcdfe6;
  transform: translateY(-1px);
}

.container-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.container-icon {
  font-size: 20px;
  color: #2496ed;
  flex-shrink: 0;
}

.container-info {
  flex: 1;
  min-width: 0;
}

.container-name {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.container-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
}

.status-running {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.status-stopped {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.container-right {
  flex-shrink: 0;
}

.action-btn {
  min-width: 32px;
  padding: 6px 8px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .docker-widget {
    background: #1a1a1a;
    border-color: #333;
  }
  
  .container-item {
    background: #2a2a2a;
    border-color: #333;
  }
  
  .container-item:hover {
    background: #2f2f2f;
    border-color: #444;
  }
  
  .container-name {
    color: #e0e0e0;
  }
  
  .stat-count {
    color: #e0e0e0;
  }
  
  .containers-list::-webkit-scrollbar-track {
    background: #2a2a2a;
  }
  
  .containers-list::-webkit-scrollbar-thumb {
    background: #444;
  }
  
  .containers-list::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  .stats-row {
    border-bottom-color: #333;
  }
}
</style>
