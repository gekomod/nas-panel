<template>

  <el-card class="widget-card" shadow="hover" v-loading="loading">
    <!-- Nagłówek -->
    <template #header>
    <div class="widget-header">
      <div class="header-main">
        <Icon icon="mdi:information-outline" width="18" />
        <span class="header-title">Informacje o systemie</span>
        <div class="update-time">
          <Icon icon="mdi:update" width="14" />
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
          <Icon icon="mdi:alert-circle" width="14" />
          {{ t('systemInfo.status') }}:
        </span>
        <span class="value">{{ t('systemInfo.restartRequired') }}</span>
      </div>
    </div>

    <!-- Dialog restartu -->
    <div class="restart-dialog-overlay" v-if="showRestartDialog" @click.self="showRestartDialog = false">
      <div class="restart-dialog">
        <div class="dialog-header">
          <Icon icon="mdi:alert-circle" width="24" />
          <h3>{{ t('systemInfo.restartRequired') }}</h3>
        </div>
        <div class="dialog-body">
          <p>{{ t('systemInfo.restartDialogMessage') }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn later" @click="scheduleReminder">
            <Icon icon="mdi:clock-outline" width="16" />
            {{ t('systemInfo.restartLater') }}
          </button>
          <button class="btn now" @click="initiateRestart">
            <Icon icon="mdi:restart" width="16" />
            {{ t('systemInfo.restartNow') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Fullscreen restart message -->
    <div class="restart-overlay" v-if="isRestarting">
      <div class="restart-message">
        <div class="spinner">
          <Icon icon="mdi:restart" width="48" class="spinning" />
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage, ElNotification } from 'element-plus'

const data = ref({
  system: {
    hostname: '',
    distro: '',
    kernel: '',
    time: '',
    uptime: 0,
    requiresRestart: false
  },
  cpu: {
    model: ''
  }
})

const lastUpdate = ref(t('common.loading'))
const showRestartDialog = ref(false)
const isRestarting = ref(false)
let intervalId = null
let restartTimeout = null
const loading = ref(true)

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
    const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/system-info`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const info = await response.json()
    
    if (info) {
      data.value = info
      lastUpdate.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  } catch (error) {
    lastUpdate.value = t('common.error')
    console.error('Error fetching system info:', error)
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
    const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/system-restart`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Restart failed')
    }
    
    // Ustawiamy timeout na odświeżenie strony
    restartTimeout = setTimeout(() => {
      window.location.reload()
    }, 100000) // 100 sekund na restart
    
    // Sprawdzamy co sekundę czy serwer już odpowiada
    const checkServer = async () => {
      try {
        await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/system-health`)
        window.location.reload()
      } catch {
        setTimeout(checkServer, 1000)
      }
    }
    
    setTimeout(checkServer, 5000) // Zacznij sprawdzać po 5 sekundach
    
  } catch (error) {
    console.error('Restart error:', error)
    isRestarting.value = false
    // Można dodać powiadomienie o błędzie
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
  intervalId = setInterval(fetchData, 30000) // Odśwież co minutę
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
  if (restartTimeout) clearTimeout(restartTimeout)
})
</script>

<style scoped>

.widget-card {
  border-radius: 8px;
  font-family: 'Inter', -apple-system, sans-serif;
}

.header {
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 12px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.header-title {
  font-size: 15px;
  font-weight: 500;
}

.header-sub {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.hostname, .system {

  font-weight: 400;
}

.update-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;

}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  line-height: 1.5;
}

.label {

  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 6px;
}

.value {

  font-weight: 400;
}

.restart-row {
  color: #d32f2f;
  background: rgba(211, 47, 47, 0.08);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 6px;
}

.restart-row .label,
.restart-row .value {
  color: inherit;
  font-weight: 500;
}

.restart-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.restart-dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: fadeIn 0.3s ease;
}

.restart-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  flex-direction: column;
  font-size: 1.2em;
}

.restart-message {
  text-align: center;
  max-width: 400px;
  padding: 2em;
  background: white;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
}

.spinning {
  animation: spin 1.5s linear infinite;
  color: #d32f2f;
  font-size: 3em;
  margin-bottom: 0.5em;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.dialog-header {
  background: #d32f2f;
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.dialog-body {
  padding: 20px;
  color: #555;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  padding: 12px 16px;
  gap: 10px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.later {
  background: #f5f5f5;
  color: #333;
}

.btn.later:hover {
  background: #e0e0e0;
}

.btn.now {
  background: #d32f2f;
  color: white;
}

.btn.now:hover {
  background: #b71c1c;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
