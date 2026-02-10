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
            <Icon icon="mdi:server" width="16" />
          </div>
          <span class="header-title">Status usług</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <span class="hostname" :class="overallStatus">{{ overallStatusText }}</span>
          <span class="system">{{ services.length }} usług</span>
        </div>
      </div>
    </template>

    <!-- Lista usług -->
    <div v-if="services.length > 0" class="widget-content">
      <div 
        v-for="service in services" 
        :key="service.name" 
        class="info-row service-item"
        :class="{ 'warning-row': !service.active }"
      >
        <div class="label">
          <Icon :icon="getServiceIcon(service.name)" width="14" />
          <span>{{ formatServiceName(service.name) }}</span>
          <el-tooltip v-if="service.error" :content="service.error" placement="top">
            <Icon icon="mdi:alert-circle" width="12" class="error-icon" />
          </el-tooltip>
        </div>
        <div class="value">
          <div class="service-status">
            <div class="status-badge" :class="service.active ? 'active' : 'inactive'">
              {{ service.active ? t('services.status.active') : t('services.status.inactive') }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <Icon icon="mdi:information-outline" width="16" />
      <span>{{ t('services.noData') }}</span>
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const services = ref([])
const loading = ref(true)
const lastUpdate = ref(t('common.loading'))
let intervalId = null
const activeControllers = ref(new Set())

const overallStatus = computed(() => {
  if (services.value.length === 0) return 'info'
  const hasInactive = services.value.some(s => !s.active)
  return hasInactive ? 'warning' : 'success'
})

const overallStatusText = computed(() => {
  if (services.value.length === 0) return t('services.noData')
  const inactiveCount = services.value.filter(s => !s.active).length
  return inactiveCount ? `${inactiveCount} NIEAKTYWNYCH` : 'WSZYSTKIE AKTYWNE'
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
    zfs: 'mdi:harddisk',
    apache: 'mdi:web',
    redis: 'mdi:database',
    mongodb: 'mdi:database',
    postfix: 'mdi:email'
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
    smbd: 'Samba',
    nmbd: 'Samba NetBIOS',
    zfs: 'ZFS',
    apache: 'Apache',
    redis: 'Redis',
    mongodb: 'MongoDB',
    postfix: 'Postfix'
  }
  return names[name] || name.charAt(0).toUpperCase() + name.slice(1)
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
    return response.data.services?.monitoredServices || []
  } catch (err) {
    if (!axios.isCancel(err)) {
      console.error('Error fetching monitored services:', err)
    }
    return []
  } finally {
    activeControllers.value.delete(controller)
  }
}

const checkServiceStatus = async (serviceName) => {
  const controller = new AbortController()
  activeControllers.value.add(controller)

  try {
    const response = await axios.get(`/services/status/${serviceName}`, {
      signal: controller.signal,
      timeout: 2500
    })
    return {
      name: serviceName,
      active: response.data.active,
      error: null
    }
  } catch (err) {
    if (axios.isCancel(err)) {
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
    activeControllers.value.delete(controller)
  }
}

const fetchServices = async () => {
  try {
    loading.value = true
    
    const monitoredServices = await fetchMonitoredServices()
    
    if (monitoredServices.length === 0) {
      services.value = []
      // Fallback dla trybu developerskiego
      if (process.env.NODE_ENV === 'development') {
        services.value = [
          { name: 'nginx', active: true, error: null },
          { name: 'docker', active: true, error: null },
          { name: 'ssh', active: true, error: null },
          { name: 'cron', active: false, error: 'Service not running' }
        ]
      }
      lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return
    }

    // Sprawdzaj status usług w batchach po 2
    const results = []
    for (let i = 0; i < monitoredServices.length; i += 2) {
      const batch = monitoredServices.slice(i, i + 2)
      const batchResults = await Promise.all(
        batch.map(serviceName => checkServiceStatus(serviceName))
      )
      results.push(...batchResults)
    }
    
    services.value = results
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
  } catch (err) {
    console.error('Error fetching services:', err)
    lastUpdate.value = t('common.error')
    services.value = []
  } finally {
    loading.value = false
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
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 280px;
  height: 100%;
  
  /* Ciemniejszy border w trybie dark */
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:deep(.el-card__header) {
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
    padding: 16px 20px;
    background: transparent;
    
    :global(.dark) &,
    :global(body.dark) & {
      border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    }
  }

  &:deep(.el-card__body) {
    padding: 16px 20px;
  }
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

  .header-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.25);
    flex-shrink: 0;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .update-time {
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
}

.header-sub {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 8px;

  .hostname, .system {
    font-weight: 500;
    color: var(--el-text-color-regular);
    padding: 4px 8px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-align: center;
    
    &.success {
      color: var(--el-color-success);
    }
    
    &.warning {
      color: var(--el-color-warning);
      background: rgba(var(--el-color-warning-rgb), 0.1);
    }
    
    &.info {
      color: var(--el-color-info);
      background: rgba(var(--el-color-info-rgb), 0.1);
    }
  }

  .system {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: 36px;

  &:hover {
    background: var(--el-fill-color-lighter);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, transparent);
    
    :global(.dark) &,
    :global(body.dark) & {
      border-color: color-mix(in srgb, var(--el-border-color) 30%, #334155);
    }
  }

  .label {
    font-weight: 500;
    color: var(--el-text-color-regular);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex: 1;
    
    .error-icon {
      color: var(--el-color-danger);
    }
  }

  .value {
    font-weight: 400;
    color: var(--el-text-color-primary);
    text-align: right;
    margin-left: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.warning-row {
  background: linear-gradient(135deg, rgba(var(--el-color-warning-rgb), 0.1) 0%, rgba(var(--el-color-warning-dark-2-rgb), 0.1) 100%);
  border-color: rgba(var(--el-color-warning-rgb), 0.2) !important;
  color: var(--el-color-warning);

  .label, .value {
    color: inherit !important;
  }
}

.service-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  min-width: 60px;
  text-align: center;
  
  &.active {
    color: var(--el-color-success);
    background: rgba(var(--el-color-success-rgb), 0.1);
  }
  
  &.inactive {
    color: var(--el-color-danger);
    background: rgba(var(--el-color-danger-rgb), 0.1);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  height: 120px;
  
  svg {
    opacity: 0.6;
  }
}

/* Compact mode for very small screens */
@media (max-width: 480px) {
  .widget-card {
    border-radius: 10px;
    
    &:deep(.el-card__header) {
      padding: 12px 16px;
    }
    
    &:deep(.el-card__body) {
      padding: 12px 16px;
    }
  }

  .header-main {
    .header-icon {
      width: 28px;
      height: 28px;
    }
    
    .header-title {
      font-size: 13px;
    }
    
    .update-time {
      font-size: 10px;
      padding: 3px 6px;
    }
  }
  
  .header-sub {
    font-size: 11px;
    
    .hostname, .system {
      padding: 3px 6px;
    }
  }
  
  .info-row {
    font-size: 12px;
    padding: 6px 8px;
    min-height: 32px;
  }
  
  .status-badge {
    font-size: 10px;
    padding: 2px 6px;
    min-width: 50px;
  }
}

@media (max-width: 360px) {
  .header-sub {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
