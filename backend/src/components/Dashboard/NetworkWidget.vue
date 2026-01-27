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
            <Icon icon="mdi:network" width="16" />
          </div>
          <span class="header-title">{{ t('network.interfaces.title') }}</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Interfejsy sieciowe -->
    <div class="widget-content">
      <div 
        v-for="iface in interfaces" 
        :key="iface.device" 
        class="info-row interface-item"
      >
        <div class="interface-header">
          <div class="interface-name">
            <Icon 
              :icon="getInterfaceIcon(iface)" 
              width="14" 
              class="interface-icon"
            />
            <span class="interface-device">{{ iface.device }}</span>
            <el-tag 
              :type="iface.status === 'up' ? 'success' : 'danger'" 
              size="small"
              class="status-tag"
            >
              {{ iface.status === 'up' ? t('network.interfaces.up') : t('network.interfaces.down') }}
            </el-tag>
          </div>
        </div>
        
        <div class="interface-details">
          <div class="detail-row">
            <span class="detail-label">{{ t('network.interfaces.address') }}</span>
            <span class="detail-value">{{ iface.address || t('common.none') }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ t('network.interfaces.mac') }}</span>
            <span class="detail-value">{{ iface.mac || t('common.none') }}</span>
          </div>
        </div>
      </div>
      
      <div v-if="interfaces.length === 0" class="no-interfaces">
        <Icon icon="mdi:network-off" width="20" />
        <span>{{ t('network.interfaces.noInterfaces') }}</span>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'NetworkWidget',
  displayName: 'Interfejsy Sieciowe'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { ElNotification } from 'element-plus'

const { t } = useI18n()

const interfaces = ref([])
const loading = ref(false)
const lastUpdate = ref(t('common.loading'))
let intervalId = null

function getInterfaceIcon(iface) {
  if (!iface) return 'mdi:help-circle'
  
  const device = iface.device || ''
  if (device.includes('wlan') || device.includes('wlp') || device.includes('wifi')) {
    return 'mdi:wifi'
  }
  if (device.includes('eth') || device.includes('eno') || device.includes('enp')) {
    return 'mdi:ethernet'
  }
  if (device.includes('lo') || device.includes('loopback')) {
    return 'mdi:loop'
  }
  if (device.includes('tun') || device.includes('tap')) {
    return 'mdi:tunnel'
  }
  
  return 'mdi:network'
}

async function fetchInterfaces() {
  try {
    loading.value = true
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':' + (import.meta.env.VITE_API_PORT || '3000')
    const response = await fetch(baseUrl + '/network/interfaces')
    
    if (!response.ok) {
      throw new Error('Failed to fetch network interfaces')
    }
    
    const data = await response.json()
    // Filtrujemy tylko aktywne interfejsy
    interfaces.value = data.filter(function(i) {
      return i.status === 'up'
    })
    
    lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (error) {
    console.error('Error fetching network interfaces:', error)
    lastUpdate.value = t('common.error')
    ElNotification.error({
      title: t('common.error'),
      message: t('network.interfaces.fetchError'),
      duration: 3000
    })
  } finally {
    loading.value = false
  }
}

onMounted(function() {
  fetchInterfaces()
  intervalId = setInterval(fetchInterfaces, 30000)
})

onBeforeUnmount(function() {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped>
.widget-card {
  border-radius: 12px;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, var(--el-bg-color) 100%);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 280px;
  height: 100%;
}

.widget-card:global(.dark),
.widget-card:global(body.dark) {
  border-color: var(--el-border-color-dark);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.widget-card:deep(.el-card__header) {
  border-bottom: 1px solid var(--el-border-color);
  padding: 16px 20px;
  background: transparent;
}

.widget-card:deep(.el-card__header):global(.dark),
.widget-card:deep(.el-card__header):global(body.dark) {
  border-bottom-color: var(--el-border-color-dark);
}

.widget-card:deep(.el-card__body) {
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
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border-radius: 8px;
  color: white;
  box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.25);
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

.widget-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.interface-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: var(--el-fill-color-lighter);
}

.interface-item:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-dark);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.interface-item:hover:global(.dark),
.interface-item:hover:global(body.dark) {
  border-color: var(--el-border-color-dark);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.interface-header {
  margin-bottom: 8px;
}

.interface-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.interface-name .interface-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.interface-name .interface-device {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
}

.interface-name .status-tag {
  font-size: 10px;
  height: 20px;
  padding: 0 6px;
  flex-shrink: 0;
}

.interface-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 4px 0;
}

.detail-label {
  font-weight: 500;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.detail-value {
  font-weight: 400;
  color: var(--el-text-color-primary);
  text-align: right;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 11px;
  padding: 2px 6px;
  background: var(--el-fill-color);
  border-radius: 4px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-interfaces {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.no-interfaces .iconify {
  opacity: 0.5;
}

.no-interfaces span {
  font-size: 13px;
  text-align: center;
  line-height: 1.4;
}

/* Compact mode for very small screens */
@media (max-width: 480px) {
  .widget-card {
    border-radius: 10px;
  }
  
  .widget-card:deep(.el-card__header) {
    padding: 12px 16px;
  }
  
  .widget-card:deep(.el-card__body) {
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
  
  .interface-item {
    padding: 10px;
  }
  
  .interface-name .interface-device {
    font-size: 12px;
  }
  
  .interface-name .status-tag {
    font-size: 9px;
    height: 18px;
    padding: 0 5px;
  }
  
  .detail-row {
    font-size: 11px;
  }
  
  .detail-value {
    font-size: 10px;
    max-width: 100px;
  }
  
  .interface-details {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
