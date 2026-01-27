<template>
  <el-card 
    class="widget-card" 
    shadow="hover" 
    v-loading="loading"
  >
    <!-- Nagłówek -->
    <template #header>
      <div class="widget-header">
        <div class="header-main">
          <div class="header-icon">
            <Icon icon="mdi:docker" width="16" />
          </div>
          <span class="header-title">{{ t('widgets.Docker') }}</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <el-tag 
            :type="dockerStatusClass" 
            size="small" 
            class="status-tag"
          >
            <span class="status-dot"></span>
            {{ dockerStatusText }}
          </el-tag>
        </div>
      </div>
    </template>

    <!-- Treść widgetu -->
    <div class="widget-content">
      <!-- Stan Docker nie działa -->
      <div v-if="!dockerRunning" class="offline-state">
        <div class="offline-icon">
          <Icon icon="mdi:docker-off" width="36" />
        </div>
        <p class="offline-text">{{ t('docker.messages.dockerNotRunning') }}</p>
        <el-button 
          type="primary" 
          size="small" 
          @click="startDocker"
          :loading="startingDocker"
          class="start-btn"
          round
        >
          <Icon icon="mdi:play" width="14" />
          {{ t('docker.buttons.startDocker') }}
        </el-button>
      </div>

      <!-- Stan Docker działa -->
      <div v-else>
        <!-- Statystyki -->
        <div class="stats-row">
          <div class="stat-item" v-tooltip="t('docker.stats.running')">
            <Icon icon="mdi:play-circle-outline" class="stat-icon running" width="18" />
            <span class="stat-count">{{ runningContainersCount }}</span>
            <span class="stat-label">{{ t('common.running') }}</span>
          </div>
          <div class="stat-item" v-tooltip="t('docker.stats.stopped')">
            <Icon icon="mdi:stop-circle-outline" class="stat-icon stopped" width="18" />
            <span class="stat-count">{{ stoppedContainersCount }}</span>
            <span class="stat-label">{{ t('common.stopped') }}</span>
          </div>
          <div class="stat-item" v-tooltip="t('docker.stats.total')">
            <Icon icon="mdi:cube-outline" class="stat-icon total" width="18" />
            <span class="stat-count">{{ containers.length }}</span>
            <span class="stat-label">{{ t('common.total') }}</span>
          </div>
        </div>

        <!-- Lista kontenerów -->
        <div class="containers-list" v-if="containers.length > 0">
          <div 
            v-for="container in containers" 
            :key="container.id" 
            class="container-item"
          >
            <div class="container-left">
              <div class="container-icon" :class="getStatusClass(container)">
                <Icon :icon="getContainerIcon(container)" width="16" />
              </div>
              <div class="container-info">
                <div class="container-name">
                  {{ formatContainerName(container.names) }}
                </div>
                <div class="container-status">
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
                circle
              >
                <Icon :icon="isContainerRunning(container) ? 'mdi:stop' : 'mdi:play'" width="14" />
              </el-button>
            </div>
          </div>
        </div>

        <!-- Brak kontenerów -->
        <div v-else class="no-containers">
          <Icon icon="mdi:package-variant" width="24" />
          <span>{{ t('docker.messages.noContainers') }}</span>
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
import { useI18n } from 'vue-i18n'
import { ElNotification } from 'element-plus'

const { t } = useI18n()

// Refs
const containers = ref([])
const loading = ref(false)
const dockerStatus = ref('unknown')
const startingDocker = ref(false)
const lastUpdate = ref(t('common.loading'))
let intervalId = null

// Computed properties
const dockerRunning = computed(function() {
  return dockerStatus.value === 'active'
})

const dockerStatusClass = computed(function() {
  const map = {
    'active': 'success',
    'inactive': 'danger',
    'error': 'warning',
    'unknown': 'info'
  }
  return map[dockerStatus.value] || 'info'
})

const dockerStatusText = computed(function() {
  const map = {
    'active': t('docker.status.running'),
    'inactive': t('docker.status.stopped'),
    'error': t('docker.status.error'),
    'unknown': t('docker.status.unknown')
  }
  return map[dockerStatus.value] || t('docker.status.unknown')
})

const runningContainersCount = computed(function() {
  return containers.value.filter(function(container) {
    return isContainerRunning(container)
  }).length
})

const stoppedContainersCount = computed(function() {
  return containers.value.filter(function(container) {
    return !isContainerRunning(container)
  }).length
})

// Funkcje pomocnicze
function isContainerRunning(container) {
  if (!container) return false
  
  const status = String(container.Status || container.status || '').toLowerCase().trim()
  const state = String(container.state || '').toLowerCase().trim()
  
  return status.startsWith('up') || 
         state === 'running' ||
         status.includes('running')
}

function getContainerIcon(container) {
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

function getStatusClass(container) {
  return isContainerRunning(container) ? 'running' : 'stopped'
}

function getStatusText(container) {
  const status = container.Status || container.status || ''
  const statusStr = String(status).toLowerCase()
  
  if (statusStr.startsWith('up')) {
    return t('docker.status.running')
  } else if (statusStr.includes('exited') || statusStr.includes('stopped')) {
    return t('docker.status.stopped')
  }
  
  return status || t('docker.status.unknown')
}

function formatContainerName(names) {
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
async function fetchData() {
  try {
    loading.value = true
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + (import.meta.env.VITE_API_PORT || '3000')
    
    // Pobieramy status i kontenery RÓWNOLEGLE - tak jak w SystemInfoWidget
    const [statusResponse, containersResponse] = await Promise.allSettled([
      fetch(baseUrl + '/services/docker/status'),
      fetch(baseUrl + '/services/docker/containers?all=false')
    ])
    
    // Obsługa odpowiedzi statusu
    if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
      const statusData = await statusResponse.value.json()
      dockerStatus.value = statusData.status || 'unknown'
    } else {
      dockerStatus.value = 'inactive'
    }
    
    // Obsługa odpowiedzi kontenerów - próbujemy pobrać nawet jeśli Docker nie działa
    let rawContainers = []
    
    if (containersResponse.status === 'fulfilled' && containersResponse.value.ok) {
      try {
        const containersData = await containersResponse.value.json()
        
        if (Array.isArray(containersData)) {
          rawContainers = containersData
        } else if (containersData.containers && Array.isArray(containersData.containers)) {
          rawContainers = containersData.containers
        } else if (containersData.data && Array.isArray(containersData.data)) {
          rawContainers = containersData.data
        }
      } catch (parseError) {
        console.warn('Error parsing containers response:', parseError)
      }
    }
    
    // Mapowanie kontenerów
    containers.value = rawContainers.map(function(container) {
      return {
        id: container.ID || container.Id || container.ContainerID || container.containerID,
        names: container.Names || container.Name || container.names,
        Status: container.Status,
        status: container.status,
        state: container.State || container.state,
        Image: container.Image || container.image,
        loading: false
      }
    })
    
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (error) {
    console.error('Error fetching Docker data:', error)
    lastUpdate.value = t('common.error')
    dockerStatus.value = 'inactive'
    containers.value = []
    
    ElNotification.error({
      title: t('common.error'),
      message: t('docker.messages.fetchContainersError'),
      duration: 3000
    })
  } finally {
    loading.value = false
  }
}

async function startDocker() {
  try {
    startingDocker.value = true
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + (import.meta.env.VITE_API_PORT || '3000')
    
    const response = await fetch(baseUrl + '/services/docker/start', {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Failed to start Docker')
    }
    
    ElNotification.success({
      title: t('common.success'),
      message: t('docker.messages.dockerStarted'),
      duration: 3000
    })
    
    await fetchData()
  } catch (error) {
    console.error('Error starting Docker:', error)
    ElNotification.error({
      title: t('common.error'),
      message: t('docker.messages.dockerStartError'),
      duration: 3000
    })
  } finally {
    startingDocker.value = false
  }
}

async function toggleContainer(container) {
  try {
    container.loading = true
    const isRunning = isContainerRunning(container)
    const action = isRunning ? 'stop' : 'start'
    
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + (import.meta.env.VITE_API_PORT || '3000')
    
    const response = await fetch(baseUrl + '/services/docker/container/' + container.id + '/' + action, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Failed to ' + action + ' container')
    }
    
    // Aktualizuj status
    if (isRunning) {
      container.Status = 'Exited'
    } else {
      container.Status = 'Up 0 seconds'
    }
    
    ElNotification.success({
      title: t('common.success'),
      message: isRunning 
        ? t('docker.messages.containerStopped', { name: formatContainerName(container.names) })
        : t('docker.messages.containerStarted', { name: formatContainerName(container.names) }),
      duration: 3000
    })
    
  } catch (error) {
    console.error('Error toggling container:', error)
    ElNotification.error({
      title: t('common.error'),
      message: t('docker.messages.containerToggleError'),
      duration: 3000
    })
  } finally {
    container.loading = false
  }
}

// Lifecycle
onMounted(function() {
  fetchData()
  intervalId = setInterval(fetchData, 30000)
})

onBeforeUnmount(function() {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.widget-card {
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 280px;
  height: 100%;
}

/* Dodajemy przezroczystość do bordera - identyczną jak w SystemInfoWidget */
.widget-card {
  border: 1px solid rgba(var(--el-border-color-rgb, 220, 223, 230), 0.3);
}

/* Ciemniejszy border w trybie dark */
body.dark .widget-card,
.dark .widget-card {
  border-color: rgba(var(--el-border-color-dark-rgb, 55, 65, 81), 0.5);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

/* Nagłówek karty */
.widget-card :deep(.el-card__header) {
  border-bottom: 1px solid rgba(var(--el-border-color-rgb, 220, 223, 230), 0.3);
  padding: 16px 20px;
  background: transparent;
}

body.dark .widget-card :deep(.el-card__header),
.dark .widget-card :deep(.el-card__header) {
  border-bottom-color: rgba(var(--el-border-color-dark-rgb, 55, 65, 81), 0.5);
}

.widget-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.widget-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.header-main .header-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2496ed 0%, #1a7bc9 100%);
  border-radius: 8px;
  color: white;
  box-shadow: 0 2px 6px rgba(36, 150, 237, 0.25);
  flex-shrink: 0;
}

.header-main .header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-main .update-time {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.header-sub {
  display: flex;
  justify-content: flex-start;
  font-size: 12px;
  gap: 8px;
}

.header-sub .status-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px solid transparent;
  flex-shrink: 0;
}

.header-sub .status-tag :deep(.el-tag__content) {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-sub .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.header-sub .el-tag--success {
  background: rgba(var(--el-color-success-rgb), 0.1);
  border-color: rgba(var(--el-color-success-rgb), 0.2);
  color: var(--el-color-success);
}

.header-sub .el-tag--success .status-dot {
  background-color: var(--el-color-success);
}

.header-sub .el-tag--danger {
  background: rgba(var(--el-color-danger-rgb), 0.1);
  border-color: rgba(var(--el-color-danger-rgb), 0.2);
  color: var(--el-color-danger);
}

.header-sub .el-tag--danger .status-dot {
  background-color: var(--el-color-danger);
}

.header-sub .el-tag--warning {
  background: rgba(var(--el-color-warning-rgb), 0.1);
  border-color: rgba(var(--el-color-warning-rgb), 0.2);
  color: var(--el-color-warning);
}

.header-sub .el-tag--warning .status-dot {
  background-color: var(--el-color-warning);
}

.header-sub .el-tag--info {
  background: rgba(var(--el-color-info-rgb), 0.1);
  border-color: rgba(var(--el-color-info-rgb), 0.2);
  color: var(--el-color-info);
}

.header-sub .el-tag--info .status-dot {
  background-color: var(--el-color-info);
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Offline state */
.offline-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  gap: 12px;
  text-align: center;
  flex: 1;
  min-height: 180px;
}

.offline-state .offline-icon {
  color: var(--el-text-color-secondary);
  opacity: 0.6;
}

.offline-state .offline-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
  max-width: 200px;
  line-height: 1.4;
}

.offline-state .start-btn {
  margin-top: 4px;
  padding: 8px 16px;
  font-weight: 500;
}

.offline-state .start-btn :deep(.el-icon) {
  margin-right: 6px;
}

/* Statystyki */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--el-border-color-rgb, 220, 223, 230), 0.3);
}

body.dark .stats-row,
.dark .stats-row {
  border-bottom-color: rgba(var(--el-border-color-dark-rgb, 55, 65, 81), 0.5);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.stat-item:hover {
  background: var(--el-fill-color-lighter);
}

.stat-icon.running {
  color: var(--el-color-success);
}

.stat-icon.stopped {
  color: var(--el-color-danger);
}

.stat-icon.total {
  color: var(--el-color-primary);
}

.stat-count {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Lista kontenerów */
.containers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}

.containers-list::-webkit-scrollbar {
  width: 4px;
}

.containers-list::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 2px;
}

.containers-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 2px;
}

.containers-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

body.dark .containers-list::-webkit-scrollbar-track,
.dark .containers-list::-webkit-scrollbar-track {
  background: var(--el-fill-color-dark);
}

body.dark .containers-list::-webkit-scrollbar-thumb,
.dark .containers-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color-dark);
}

body.dark .containers-list::-webkit-scrollbar-thumb:hover,
.dark .containers-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}

.container-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid rgba(var(--el-border-color-rgb, 220, 223, 230), 0.3);
  transition: all 0.2s ease;
}

.container-item:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-dark);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

body.dark .container-item:hover,
.dark .container-item:hover {
  border-color: var(--el-border-color-dark);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.container-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.container-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.container-icon.running {
  background: rgba(var(--el-color-success-rgb), 0.1);
  border: 1px solid rgba(var(--el-color-success-rgb), 0.2);
  color: var(--el-color-success);
}

.container-icon.stopped {
  background: rgba(var(--el-color-danger-rgb), 0.1);
  border: 1px solid rgba(var(--el-color-danger-rgb), 0.2);
  color: var(--el-color-danger);
}

.container-info {
  flex: 1;
  min-width: 0;
}

.container-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.container-status {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  padding: 2px 6px;
  background: var(--el-fill-color);
  border-radius: 4px;
  display: inline-block;
}

.container-right {
  flex-shrink: 0;
}

.action-btn {
  min-width: 32px;
  min-height: 32px;
  padding: 8px;
}

.action-btn :deep(.el-icon) {
  margin: 0;
}

/* Brak kontenerów */
.no-containers {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  gap: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
  min-height: 150px;
}

.no-containers .iconify {
  opacity: 0.5;
}

.no-containers span {
  font-size: 13px;
  text-align: center;
  line-height: 1.4;
}

/* Compact mode for very small screens */
@media (max-width: 480px) {
  .widget-card {
    border-radius: 10px;
  }
  
  .widget-card :deep(.el-card__header) {
    padding: 12px 16px;
  }
  
  .widget-card :deep(.el-card__body) {
    padding: 12px 16px;
  }

  .header-main .header-icon {
    width: 28px;
    height: 28px;
  }
  
  .header-main .header-title {
    font-size: 13px;
  }
  
  .header-main .update-time {
    font-size: 10px;
    padding: 3px 6px;
  }
  
  .stats-row {
    gap: 8px;
    padding: 6px 0;
  }
  
  .stat-item {
    padding: 6px;
  }
  
  .stat-count {
    font-size: 16px;
  }
  
  .stat-label {
    font-size: 10px;
  }
  
  .container-item {
    padding: 8px 10px;
  }
  
  .container-icon {
    width: 28px;
    height: 28px;
  }
  
  .container-name {
    font-size: 12px;
  }
  
  .action-btn {
    min-width: 28px;
    min-height: 28px;
    padding: 6px;
  }
}
</style>
