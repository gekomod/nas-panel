<template>
  <el-card class="widget-card" shadow="hover" :body-style="{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column' }">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:server" width="18" />
        <span class="widget-title">Status usług</span>
        <el-tag :type="overallStatus" size="small" :effect="overallStatus === 'danger' ? 'dark' : 'plain'" round>
          {{ overallStatusText }}
        </el-tag>
      </div>
    </template>

    <div v-if="services.length > 0" class="services-list">
      <div 
        v-for="(service, index) in services" 
        :key="service.name" 
        class="service-item"
      >
        <div class="service-content">
          <div class="service-info">
            <Icon :icon="getServiceIcon(service.name)" width="16" class="service-icon" />
            <span class="service-name">{{ formatServiceName(service.name) }}</span>
          </div>
          
          <div class="service-status">
            <el-tag :type="service.active ? 'success' : 'danger'" size="small" effect="plain">
              {{ service.active ? 'AKTYWNA' : 'WYŁĄCZONA' }}
            </el-tag>
            <el-tooltip v-if="service.error" :content="service.error" placement="top">
              <Icon icon="mdi:alert-circle" width="16" class="error-icon" />
            </el-tooltip>
          </div>
        </div>
        <el-divider v-if="index < services.length - 1" class="service-divider" />
      </div>
    </div>
    
    <div v-else class="empty-state">
      <Icon icon="mdi:information-outline" width="16" />
      <span>Brak danych o usługach</span>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'ServicesWidget',
  displayName: 'Status usług'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import PromisePool from 'es6-promise-pool';

const services = ref([])
const loading = ref(false)
const error = ref(null)
const monitoredServices = ref([])
const activeControllers = ref(new Set())
let intervalId = null

const overallStatus = computed(() => {
  if (services.value.length === 0) return 'info'
  const hasInactive = services.value.some(s => !s.active)
  return hasInactive ? 'warning' : 'success'
})

const overallStatusText = computed(() => {
  if (services.value.length === 0) return 'BRAK DANYCH'
  const inactiveCount = services.value.filter(s => !s.active).length
  return inactiveCount ? `${inactiveCount} NIEAKTYWNE` : 'WSZYSTKO OK'
})

const getServiceIcon = (serviceName) => {
  const icons = {
    nginx: 'mdi:nginx',
    mysql: 'mdi:database',
    postgresql: 'mdi:database',
    docker: 'mdi:docker',
    ssh: 'mdi:lock',
    cron: 'mdi:clock',
    smbd: 'mdi:folder-network',
    nmbd: 'mdi:folder-network',
    zfs: 'mdi:harddisk'
  }
  return icons[serviceName] || 'mdi:cog'
}

const formatServiceName = (name) => {
  const names = {
    nginx: 'NGINX',
    mysql: 'MySQL',
    postgresql: 'PostgreSQL',
    docker: 'Docker',
    ssh: 'SSH',
    cron: 'Cron',
    smbd: 'Samba (smbd)',
    nmbd: 'Samba (nmbd)',
    zfs: 'ZFS'
  }
  return names[name] || name.toUpperCase()
}

const abortAllRequests = () => {
  activeControllers.value.forEach(controller => {
    controller.abort()
  })
  activeControllers.value.clear()
}

const fetchMonitoredServices = async () => {
  const controller = new AbortController()
  activeControllers.value.add(controller)

  try {
    const response = await axios.get('/system/settings', {
      signal: controller.signal,
      timeout: 3000
    })
    monitoredServices.value = response.data.services?.monitoredServices || []
  } catch (err) {
    if (!axios.isCancel(err)) {
      console.error('Error fetching monitored services:', err)
      monitoredServices.value = []
    }
  } finally {
    activeControllers.value.delete(controller)
  }
}

const fetchServices = async () => {
  try {
    loading.value = true
    error.value = null
    
    await fetchMonitoredServices()
    
    if (monitoredServices.value.length === 0) {
      services.value = []
      return
    }

    // Użyj PromisePool do kontroli równoczesnych żądań
    const concurrency = 2 // Maksymalna liczba równoczesnych żądań
    let index = 0
    
    const promiseProducer = () => {
      if (index >= monitoredServices.value.length) {
        return null
      }
      const serviceName = monitoredServices.value[index++]
      return checkServiceStatus(serviceName)
    }

    const pool = new PromisePool(promiseProducer, concurrency)
    const results = []
    
    pool.addEventListener('fulfilled', (event) => {
      if (event.data.result) {
        results.push(event.data.result)
      }
    })

    pool.addEventListener('rejected', (event) => {
      console.error('Błąd sprawdzania usługi:', event.data.error)
    })

    await pool.start()
    services.value = results
  } catch (err) {
    error.value = 'Błąd podczas pobierania statusu usług'
    console.error('Error fetching services:', err)
  } finally {
    loading.value = false
  }
}

const checkServiceStatus = async (serviceName) => {
  const source = axios.CancelToken.source()
  const timeout = setTimeout(() => {
    source.cancel(`Timeout sprawdzania usługi ${serviceName}`)
  }, 3000)

  try {
    const response = await axios.get(`/services/status/${serviceName}`, {
      cancelToken: source.token,
      timeout: 2500
    })
    return {
      name: serviceName,
      active: response.data.active,
      error: null
    }
  } catch (err) {
    if (axios.isCancel(err)) {
      console.log(`Anulowano sprawdzanie usługi ${serviceName}:`, err.message)
      return {
        name: serviceName,
        active: false,
        error: 'Przekroczono czas oczekiwania'
      }
    }
    return {
      name: serviceName,
      active: false,
      error: err.response?.data?.error || 'Błąd podczas sprawdzania statusu'
    }
  } finally {
    clearTimeout(timeout)
  }
}

onMounted(() => {
  fetchServices()
  intervalId = setInterval(fetchServices, 30000)
})

onBeforeUnmount(() => {
  abortAllRequests()
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped lang="scss">
.widget-card {
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .widget-title {
    font-size: 14px;
    font-weight: 500;
    flex-grow: 1;
  }
  
  .el-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 0 8px;
    height: 20px;
  }
}

.services-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 8px 0;
}

.service-item {
  padding: 12px 16px;
  flex-shrink: 0;
}

.service-divider {
  margin: 0 16px;
}

.service-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.service-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  
  .service-icon {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }
  
  .service-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.service-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 10px;
  
  .error-icon {
    color: var(--el-color-danger);
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  
  svg {
    opacity: 0.6;
  }
}
</style>
