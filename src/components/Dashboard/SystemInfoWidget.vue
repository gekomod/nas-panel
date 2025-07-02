<template>
  <el-card class="system-info-widget">
    <div class="info-grid">
      <div class="info-section">
        <h3><el-icon><Monitor /></el-icon> {{ t('systemInfo.system') }}</h3>
        <InfoRow :label="t('systemInfo.hostname')" :value="data.system.hostname" type="info" />
        <InfoRow :label="t('systemInfo.system')" :value="`${data.system.distro} (${data.system.kernel})`" />
        <InfoRow :label="t('systemInfo.architecture')" :value="data.system.arch" />
        <InfoRow :label="t('systemInfo.systemTime')" :value="formatTime(data.system.time)" />
        <InfoRow :label="t('systemInfo.uptime')" :value="formatUptime(data.system.uptime)" />
        <InfoRow :label="t('systemInfo.restartRequired')" :value="data.system.requiresRestart ? t('common.yes') : t('common.no')" 
                :type="data.system.requiresRestart ? 'warning' : 'success'" />
      </div>

      <div class="info-section">
        <h3><el-icon><Cpu /></el-icon> {{ t('systemInfo.cpu') }}</h3>
        <InfoRow :label="t('systemInfo.manufacturer')" :value="data.cpu.manufacturer" />
        <InfoRow :label="t('systemInfo.model')" :value="data.cpu.brand" />
        <InfoRow :label="t('systemInfo.cores')" :value="data.cpu.cores" />
        <InfoRow :label="t('systemInfo.speed')" :value="`${data.cpu.speed} GHz`" />
      </div>

      <div class="info-section">
        <h3><el-icon><Document /></el-icon> {{ t('systemInfo.versions') }}</h3>
        <InfoRow :label="t('systemInfo.app')" :value="data.versions.app" />
        <InfoRow :label="t('systemInfo.node')" :value="data.versions.node" />
        <InfoRow :label="t('systemInfo.npm')" :value="data.versions.npm" />
      </div>
    </div>

    <div class="last-update">
      <el-icon><Clock /></el-icon>
      {{ t('systemInfo.lastUpdate') }}: {{ lastUpdate }}
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'SystemInfoWidget',
  displayName: 'Informacje systemowe'
}
</script>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Monitor, Cpu, Document, Clock } from '@element-plus/icons-vue'
import InfoRow from '@/components/ui/InfoRow.vue'

const data = ref({
  system: {
    hostname: t('common.loading'),
    kernel: t('common.loading'),
    distro: t('common.loading'),
    arch: t('common.loading'),
    uptime: 0,
    time: new Date().toISOString(),
    requiresRestart: false
  },
  cpu: {
    manufacturer: t('common.loading'),
    brand: t('common.loading'),
    cores: 0,
    speed: 0
  },
  versions: {
    app: t('common.loading'),
    node: t('common.loading'),
    npm: t('common.loading')
  }
})

const lastUpdate = ref(t('common.loading'))
let intervalId = null

const formatTime = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return 'Nieznany czas'
  }
}

const formatUptime = (seconds) => {
  if (!seconds) return '00d 00h 00m'
  const days = Math.floor(seconds / (3600 * 24))
  const hours = Math.floor((seconds % (3600 * 24)) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${mins}m`
}

const fetchData = async () => {
  try {
    const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/system-info`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const info = await response.json()
    
    if (info) {
      data.value = info
      lastUpdate.value = new Date().toLocaleTimeString()
    }
  } catch (error) {
    lastUpdate.value = `Błąd: ${error.message}`
  }
}

onMounted(() => {
  fetchData()
  intervalId = setInterval(fetchData, 60000)
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
})
</script>

<style scoped>
.system-info-widget {
  font-size: 0.9em;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.info-section {
  border-left: 3px solid #409EFF;
  padding-left: 10px;
}

.info-section h3 {
  margin: 0 0 10px 0;
  color: #409EFF;
  display: flex;
  align-items: center;
  gap: 8px;
}

.last-update {
  margin-top: 15px;
  font-size: 0.8em;
  color: #888;
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
