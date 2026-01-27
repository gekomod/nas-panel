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
            <Icon icon="mdi:information-outline" width="16" />
          </div>
          <span class="header-title">Informacje o systemie</span>
          <div class="update-time">
            <Icon icon="mdi:update" width="12" />
            <span>{{ t('common.update') }}: {{ lastUpdate }}</span>
          </div>
        </div>
        <div class="header-sub">
          <span class="hostname">{{ data.system.hostname || t('common.loading') }}</span>
          <span class="system">{{ data.system.distro || t('common.loading') }}</span>
        </div>
      </div>
    </template>

    <!-- Informacje systemowe -->
    <div class="widget-content">
      <div class="info-row">
        <span class="label">{{ t('systemInfo.cpu') }}</span>
        <span class="value">{{ data.cpu.manufacturer+' '+data.cpu.brand || t('common.loading') }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ t('systemInfo.system') }}</span>
        <span class="value">{{ data.system.kernel || t('common.loading') }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ t('systemInfo.systemTime') }}</span>
        <span class="value">{{ data.system.time ? formatSystemTime(data.system.time) : t('common.loading') }}</span>
      </div>
      <div class="info-row">
        <span class="label">{{ t('systemInfo.uptime') }}</span>
        <span class="value">{{ data.system.uptime ? formatUptime(data.system.uptime) : t('common.loading') }}</span>
      </div>
      <div 
        class="info-row restart-row" 
        v-if="data.system.requiresRestart"
      >
        <span class="label">
          <Icon icon="mdi:alert-circle" width="12" />
          {{ t('systemInfo.status') }}:
        </span>
        <span class="value">{{ t('systemInfo.restartRequired') }}</span>
      </div>
      <div class="info-row" v-if="data.system.pendingUpdates > 0">
        <span class="label">
          <Icon :icon="data.system.pendingUpdates > 0 ? 'material-symbols-light:deployed-code-update-outline-sharp' : 'ic:round-update-disabled'" width="12" />
          {{ t('systemInfo.pendingUpdates') }}:
        </span>
        <span 
          class="value update-available"
          @click="data.system.pendingUpdates > 0 && navigateToUpdates()"
        >
          <template v-if="data.system.pendingUpdates > 0">
            <Icon icon="streamline-pixel:interface-essential-alert-circle-2" width="12" />
            {{ data.system.pendingUpdates }}
          </template>
          <template v-else>
            {{ t('common.none') }}
          </template>
        </span>
      </div>
    </div>

    <!-- Dialog restartu -->
    <div class="restart-dialog-overlay" v-if="showRestartDialog" @click.self="showRestartDialog = false">
      <div class="restart-dialog">
        <div class="dialog-header">
          <Icon icon="mdi:alert-circle" width="20" />
          <h3>{{ t('systemInfo.restartRequired') }}</h3>
        </div>
        <div class="dialog-body">
          <p>{{ t('systemInfo.restartDialogMessage') }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn later" @click="scheduleReminder">
            <Icon icon="mdi:clock-outline" width="14" />
            {{ t('systemInfo.restartLater') }}
          </button>
          <button class="btn now" @click="initiateRestart">
            <Icon icon="mdi:restart" width="14" />
            {{ t('systemInfo.restartNow') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Fullscreen restart message -->
    <div class="restart-overlay" v-if="isRestarting">
      <div class="restart-message">
        <div class="spinner">
          <Icon icon="mdi:restart" width="36" class="spinning" />
        </div>
        <h3>{{ t('systemInfo.restartInProgress') }}</h3>
        <p>{{ t('systemInfo.restartDescription') }}</p>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'SystemInfoWidget',
  displayName: 'Informacje o systemie'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'

const { t } = useI18n()
const router = useRouter()

const data = ref({
  system: {
    hostname: '',
    distro: '',
    kernel: '',
    time: '',
    uptime: 0,
    requiresRestart: false,
    pendingUpdates: 0
  },
  cpu: {
    manufacturer: '',
    brand: ''
  }
})

const lastUpdate = ref(t('common.loading'))
const showRestartDialog = ref(false)
const isRestarting = ref(false)
let intervalId = null
let restartTimeout = null
const loading = ref(true)

const navigateToUpdates = () => {
  if (data.value.system.pendingUpdates > 0) {
    router.push('/system/updates')
  }
}

const formatSystemTime = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return t('common.error')
  }
}

const formatUptime = (seconds) => {
  if (!seconds) return '00d 00h 00m'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}${t('common.daysShort')} ${hours}${t('common.hoursShort')} ${mins}${t('common.minutesShort')}`
}

const fetchData = async () => {
  try {
    loading.value = true
    const [systemResponse, updatesResponse] = await Promise.all([
      fetch(`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}/api/system-info`),
      fetch(`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}/system/updates/check`)
    ])
    
    if (!systemResponse.ok || !updatesResponse.ok) {
      throw new Error('Failed to fetch system data')
    }
    
    const [info, updates] = await Promise.all([
      systemResponse.json(),
      updatesResponse.json()
    ])
    
    if (info) {
      data.value = {
        ...info,
        system: {
          ...info.system,
          pendingUpdates: updates.updates?.length || 0
        }
      }
      lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  } catch (error) {
    lastUpdate.value = t('common.error')
    console.error('Error fetching system info:', error)
    data.value.system.pendingUpdates = 0
  } finally {
    loading.value = false
    if (data.value.system.requiresRestart && !localStorage.getItem('rebootReminder')) {
      setTimeout(() => { showRestartDialog.value = true }, 1000)
    }
  }
}

const initiateRestart = async () => {
  showRestartDialog.value = false
  isRestarting.value = true
  
  try {
    const response = await fetch(`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}/api/system-restart`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Restart failed')
    }
    
    restartTimeout = setTimeout(() => {
      window.location.reload()
    }, 100000)
    
    const checkServer = async () => {
      try {
        await fetch(`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}/api/system-health`)
        window.location.reload()
      } catch {
        setTimeout(checkServer, 1000)
      }
    }
    
    setTimeout(checkServer, 5000)
    
  } catch (error) {
    console.error('Restart error:', error)
    isRestarting.value = false
    ElNotification.error({
      title: t('common.error'),
      message: t('systemInfo.restartFailed'),
      duration: 5000
    })
  }
}

const scheduleReminder = () => {
  const reminderTime = new Date(Date.now() + 12 * 60 * 60 * 1000)
  localStorage.setItem('rebootReminder', reminderTime)
  showRestartDialog.value = false
}

const checkReminder = () => {
  const reminder = localStorage.getItem('rebootReminder')
  if (reminder) {
    const reminderDate = new Date(reminder)
    if (new Date() > reminderDate) {
      localStorage.removeItem('rebootReminder')
    }
  }
}

onMounted(() => {
  checkReminder()
  fetchData()
  intervalId = setInterval(fetchData, 30000)
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
  if (restartTimeout) clearTimeout(restartTimeout)
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
    gap: 6px;
    flex-shrink: 0;
  }

  .value {
    font-weight: 400;
    color: var(--el-text-color-primary);
    text-align: right;
    flex: 1;
    margin-left: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.restart-row {
  background: linear-gradient(135deg, rgba(var(--el-color-danger-rgb), 0.1) 0%, rgba(var(--el-color-danger-dark-2-rgb), 0.1) 100%);
  border-color: rgba(var(--el-color-danger-rgb), 0.2) !important;
  color: var(--el-color-danger);
  padding: 6px 10px;
  margin-top: 4px;

  .label, .value {
    color: inherit !important;
    font-weight: 600;
  }
}

.update-available {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--el-color-warning);
  font-weight: 600;
  cursor: pointer;
  padding: 3px 8px;
  background: rgba(var(--el-color-warning-rgb), 0.1);
  border-radius: 6px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: rgba(var(--el-color-warning-rgb), 0.2);
    transform: translateY(-1px);
  }
}

.restart-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.restart-dialog {
  background: var(--el-bg-color);
  border-radius: 16px;
  width: 90%;
  max-width: 360px;
  overflow: hidden;
  box-shadow: var(--el-box-shadow-dark);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.dialog-header {
  background: linear-gradient(135deg, var(--el-color-danger) 0%, var(--el-color-danger-dark-2) 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
}

.dialog-body {
  padding: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.dialog-footer {
  display: flex;
  padding: 16px 20px;
  gap: 10px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.btn {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 38px;

  &.later {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);
    border: 1px solid var(--el-border-color);

    &:hover {
      background: var(--el-fill-color);
      transform: translateY(-2px);
      box-shadow: var(--el-box-shadow-light);
    }
  }

  &.now {
    background: linear-gradient(135deg, var(--el-color-danger) 0%, var(--el-color-danger-dark-2) 100%);
    color: white;
    border: 1px solid transparent;

    &:hover {
      background: linear-gradient(135deg, var(--el-color-danger-dark-2) 0%, var(--el-color-danger-dark-1) 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(var(--el-color-danger-rgb), 0.3);
    }
  }

  &:active {
    transform: translateY(0);
  }
}

.restart-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--el-mask-color);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  flex-direction: column;
}

.restart-message {
  text-align: center;
  max-width: 350px;
  padding: 30px;
  background: var(--el-bg-color);
  border-radius: 16px;
  box-shadow: var(--el-box-shadow-dark);
  animation: fadeInUp 0.5s ease;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
  }

  p {
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }
}

.spinner {
  margin-bottom: 16px;
}

.spinning {
  animation: spin 1.5s linear infinite;
  color: var(--el-color-danger);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(8px);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Focus styles for accessibility */
.btn:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.update-available:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
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
}
</style>
