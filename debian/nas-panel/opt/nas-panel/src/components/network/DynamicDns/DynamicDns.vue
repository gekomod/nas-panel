<template>
  <div class="dynamic-dns-dashboard" :class="themeClass">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:ip-network" />
          </div>
          <div class="header-text">
            <h1>{{ $t('dynamicDns.title') }}</h1>
            <p class="subtitle">{{ $t('dynamicDns.subtitle') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              type="primary" 
              @click="updateAll" 
              :disabled="updating || loading"
              :loading="updating"
            >
              <Icon icon="mdi:refresh" />
              {{ $t('dynamicDns.updateNow') }}
            </el-button>
            <el-button 
              v-if="!cronInstalled"
              type="warning" 
              @click="installCron"
              :disabled="installingCron || loading"
              :loading="installingCron"
            >
              <Icon :icon="installingCron ? 'mdi:loading' : 'mdi:calendar-clock'" />
              {{ installingCron ? $t('dynamicDns.installing') : $t('dynamicDns.installCron') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="dynamic-dns-content">
      <!-- Services Card -->
      <el-card class="services-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:web" />
              {{ $t('dynamicDns.configuredServices') }}
            </h2>
            <div class="card-header-actions">
              <el-button 
                type="primary" 
                @click="showAddDialog"
                :disabled="loading"
                :loading="loading"
              >
                <Icon :icon="loading ? 'mdi:loading' : 'mdi:plus'" />
                {{ $t('dynamicDns.addService') }}
              </el-button>
            </div>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>{{ $t('dynamicDns.loading') }}</p>
        </div>

        <el-empty 
          v-else-if="services.length === 0" 
          :description="$t('dynamicDns.noServices')" 
          class="empty-state"
        >
          <template #image>
            <Icon icon="mdi:web-off" width="120" height="120" />
          </template>
          <template #extra>
            <el-button type="primary" @click="showAddDialog">
              <Icon icon="mdi:plus" />
              {{ $t('dynamicDns.addFirstService') }}
            </el-button>
          </template>
        </el-empty>

        <div v-else class="services-table">
          <el-table 
            :data="services" 
            style="width: 100%"
            :empty-text="$t('dynamicDns.noServices')"
            stripe
            border
            v-loading="loading"
          >
            <el-table-column prop="provider" :label="$t('dynamicDns.service')" width="180" sortable>
              <template #default="{ row }">
                <div class="service-cell">
                  <el-icon :size="20" :color="getProviderColor(row.provider)">
                    <Icon :icon="getProviderIcon(row.provider)" />
                  </el-icon>
                  <span class="service-name">{{ getProviderName(row.provider) }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="hostname" :label="$t('dynamicDns.hostname')" sortable />
            
            <el-table-column prop="username" :label="$t('dynamicDns.username')" width="150" />
            
            <el-table-column prop="lastUpdate" :label="$t('dynamicDns.lastUpdate')" width="180" sortable>
              <template #default="{ row }">
                <div class="last-update-cell">
                  <el-tooltip :content="row.lastUpdate ? new Date(row.lastUpdate).toLocaleString() : $t('dynamicDns.never')">
                    <span :class="{'text-warning': !row.lastUpdate, 'text-success': isRecentUpdate(row.lastUpdate)}">
                      {{ row.lastUpdate ? formatRelativeTime(row.lastUpdate) : $t('dynamicDns.never') }}
                    </span>
                  </el-tooltip>
                  <el-button 
                    v-if="!row.lastUpdate"
                    size="small" 
                    circle 
                    @click.stop="testService(row)"
                    :title="$t('dynamicDns.updateNow')"
                  >
                    <Icon icon="mdi:refresh" />
                  </el-button>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="status" :label="$t('dynamicDns.status')" width="120" sortable>
              <template #default="{ row }">
                <el-tag 
                  :type="getStatusType(row.status)"
                  :effect="row.status === 'active' ? 'dark' : 'plain'"
                  size="small"
                  round
                  :class="`status-${row.status}`"
                >
                  <el-icon v-if="row.status === 'active'" class="mr-1">
                    <Icon icon="mdi:check-circle" />
                  </el-icon>
                  <el-icon v-else-if="row.status === 'error'" class="mr-1">
                    <Icon icon="mdi:alert-circle" />
                  </el-icon>
                  <el-icon v-else class="mr-1">
                    <Icon icon="mdi:information" />
                  </el-icon>
                  {{ $t(`dynamicDns.statuses.${row.status}`) }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column :label="$t('dynamicDns.actions')" width="200" align="center" fixed="right">
              <template #default="{ row }">
                <div class="service-actions">
                  <el-tooltip :content="$t('dynamicDns.edit')" placement="top">
                    <el-button 
                      size="small" 
                      circle 
                      @click.stop="editService(row)"
                    >
                      <el-icon><Icon icon="mdi:pencil" /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('dynamicDns.test')" placement="top">
                    <el-button 
                      size="small" 
                      type="primary" 
                      circle 
                      @click.stop="testService(row)"
                      :loading="testingServiceId === row.id"
                    >
                      <el-icon>
                        <Icon :icon="testingServiceId === row.id ? 'mdi:loading' : 'mdi:connection'" />
                      </el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('dynamicDns.enableDisable')" placement="top">
                    <el-button 
                      size="small" 
                      :type="row.enabled ? 'warning' : 'success'" 
                      circle 
                      @click.stop="toggleService(row.id, !row.enabled)"
                      :loading="togglingServiceId === row.id"
                    >
                      <el-icon>
                        <Icon :icon="row.enabled ? 'mdi:toggle-switch-off' : 'mdi:toggle-switch'" />
                      </el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('dynamicDns.delete')" placement="top">
                    <el-button 
                      size="small" 
                      type="danger" 
                      circle 
                      @click.stop="deleteService(row.id)"
                      :loading="deletingServiceId === row.id"
                    >
                      <el-icon><Icon icon="mdi:delete" /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>

      <!-- Settings Card -->
      <el-card class="settings-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:cog" />
              {{ $t('dynamicDns.settings') }}
            </h2>
            <div class="card-header-actions">
              <el-button 
                type="info" 
                @click="fetchData"
                :loading="loading"
                :disabled="loading"
              >
                <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" />
                {{ $t('dynamicDns.refresh') }}
              </el-button>
            </div>
          </div>
        </template>

        <div v-if="error" class="error-message">
          <el-alert 
            :title="$t('dynamicDns.error')" 
            :description="error" 
            type="error" 
            show-icon 
            closable
            @close="error = null"
          />
        </div>

        <el-form 
          :model="settings" 
          label-width="180px" 
          label-position="left"
          @submit.prevent="saveSettings"
          class="settings-form"
          :disabled="savingSettings"
        >
          <el-form-item :label="$t('dynamicDns.updateInterval')">
            <el-select 
              v-model="settings.updateInterval" 
              class="settings-select"
              :disabled="savingSettings"
            >
              <el-option 
                v-for="option in intervalOptions" 
                :key="option.value"
                :label="option.title"
                :value="option.value"
              />
            </el-select>
            <span class="settings-hint">
              {{ $t('dynamicDns.intervalHint') }}
            </span>
          </el-form-item>

          <el-form-item :label="$t('dynamicDns.ipSettings')">
            <div class="ip-settings">
              <el-checkbox 
                v-model="settings.forceIpv4" 
                :label="$t('dynamicDns.forceIpv4')"
                :disabled="savingSettings"
              >
                <template #default>
                  <span class="checkbox-label">
                    <Icon icon="mdi:ip-outline" class="mr-1" />
                    {{ $t('dynamicDns.forceIpv4') }}
                  </span>
                </template>
              </el-checkbox>
              <el-checkbox 
                v-model="settings.forceIpv6" 
                :label="$t('dynamicDns.forceIpv6')"
                :disabled="savingSettings"
                class="ml-4"
              >
                <template #default>
                  <span class="checkbox-label">
                    <Icon icon="mdi:ip-network-outline" class="mr-1" />
                    {{ $t('dynamicDns.forceIpv6') }}
                  </span>
                </template>
              </el-checkbox>
            </div>
            <span class="settings-hint">
              {{ $t('dynamicDns.ipSettingsHint') }}
            </span>
          </el-form-item>

          <el-form-item :label="$t('dynamicDns.notifications')">
            <div class="notification-settings">
              <el-checkbox 
                v-model="settings.notifyOnError" 
                :label="$t('dynamicDns.notifyOnError')"
                :disabled="savingSettings"
              >
                <template #default>
                  <span class="checkbox-label">
                    <Icon icon="mdi:alert-circle" class="mr-1" />
                    {{ $t('dynamicDns.notifyOnError') }}
                  </span>
                </template>
              </el-checkbox>
              <el-checkbox 
                v-model="settings.notifyOnSuccess" 
                :label="$t('dynamicDns.notifyOnSuccess')"
                :disabled="savingSettings"
                class="ml-4"
              >
                <template #default>
                  <span class="checkbox-label">
                    <Icon icon="mdi:check-circle" class="mr-1" />
                    {{ $t('dynamicDns.notifyOnSuccess') }}
                  </span>
                </template>
              </el-checkbox>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary" 
              native-type="submit"
              :loading="savingSettings"
              :disabled="savingSettings"
            >
              <Icon :icon="savingSettings ? 'mdi:loading' : 'mdi:content-save'" />
              {{ savingSettings ? $t('dynamicDns.saving') : $t('dynamicDns.saveSettings') }}
            </el-button>
            <el-button @click="resetSettings" :disabled="savingSettings">
              <Icon icon="mdi:restore" />
              {{ $t('dynamicDns.reset') }}
            </el-button>
          </el-form-item>
        </el-form>

        <el-divider>
          <el-icon><Icon icon="mdi:information" /></el-icon>
          {{ $t('dynamicDns.info') }}
        </el-divider>

        <div class="settings-info">
          <p>{{ $t('dynamicDns.cronDescription') }}</p>
          <div class="info-items">
            <div class="info-item" :class="{'success': cronInstalled, 'warning': !cronInstalled}">
              <el-icon>
                <Icon :icon="cronInstalled ? 'mdi:check-circle' : 'mdi:alert-circle'" />
              </el-icon>
              <span>
                {{ cronInstalled ? $t('dynamicDns.cronInstalledStatus') : $t('dynamicDns.cronNotInstalledStatus') }}
              </span>
            </div>
            <div class="info-item info">
              <el-icon><Icon icon="mdi:clock-check" /></el-icon>
              <span>
                {{ $t('dynamicDns.lastAutoUpdate') }}: 
                {{ lastAutoUpdate ? formatRelativeTime(lastAutoUpdate) : $t('dynamicDns.never') }}
              </span>
            </div>
            <div class="info-item info">
              <el-icon><Icon icon="mdi:counter" /></el-icon>
              <span>
                {{ $t('dynamicDns.totalServices') }}: {{ services.length }}
              </span>
            </div>
            <div class="info-item info">
              <el-icon><Icon icon="mdi:check-circle" /></el-icon>
              <span>
                {{ $t('dynamicDns.activeServices') }}: {{ activeServicesCount }}
              </span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <DnsServiceForm
      :show="showDialog"
      :service="editedService"
      :providers="providers"
      @update:show="showDialog = $event"
      @save="handleSaveService"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus'
import DnsServiceForm from './DnsServiceForm.vue'
import providers from './providers'
import { useTheme } from '@/composables/useTheme'
import axios from 'axios'

const { t, mergeLocaleMessage } = useI18n()
const { isDarkMode } = useTheme()

// Dodaj tłumaczenia do i18n
import enLocales from './locales/en'
import plLocales from './locales/pl'
mergeLocaleMessage('en', enLocales)
mergeLocaleMessage('pl', plLocales)

const services = ref([])
const settings = ref({
  updateInterval: '30m',
  forceIpv4: false,
  forceIpv6: false,
  notifyOnError: true,
  notifyOnSuccess: false
})
const showDialog = ref(false)
const editedService = ref(null)
const loading = ref(false)
const error = ref(null)
const savingSettings = ref(false)
const lastAutoUpdate = ref(null)
const updating = ref(false)
const cronInstalled = ref(false)
const installingCron = ref(false)
const testingServiceId = ref(null)
const deletingServiceId = ref(null)
const togglingServiceId = ref(null)

const intervalOptions = computed(() => [
  { value: '15m', title: t('dynamicDns.intervals.15m') },
  { value: '30m', title: t('dynamicDns.intervals.30m') },
  { value: '1h', title: t('dynamicDns.intervals.1h') },
  { value: '2h', title: t('dynamicDns.intervals.2h') },
  { value: '6h', title: t('dynamicDns.intervals.6h') },
  { value: '12h', title: t('dynamicDns.intervals.12h') },
  { value: '24h', title: t('dynamicDns.intervals.24h') }
])

const activeServicesCount = computed(() => {
  return services.value.filter(s => s.status === 'active' && s.enabled).length
})

async function fetchData() {
  try {
    loading.value = true
    error.value = null
    
    const [servicesRes, settingsRes] = await Promise.all([
      axios.get('/network/dynamic-dns'),
      axios.get('/network/dynamic-dns/settings')
    ])
    
    services.value = servicesRes.data.services || []
    settings.value = settingsRes.data.settings || {
      updateInterval: '30m',
      forceIpv4: false,
      forceIpv6: false,
      notifyOnError: true,
      notifyOnSuccess: false
    }
    lastAutoUpdate.value = settingsRes.data.lastAutoUpdate || null
  } catch (err) {
    console.error('Error fetching data:', err)
    error.value = t('dynamicDns.fetchError')
    ElMessage.error(t('dynamicDns.fetchError'))
  } finally {
    loading.value = false
  }
}

function getProviderName(providerId) {
  const provider = providers.find(p => p.id === providerId)
  return provider ? provider.name : providerId
}

function getProviderIcon(providerId) {
  const provider = providers.find(p => p.id === providerId)
  return provider ? provider.icon : 'mdi:help-circle'
}

function getProviderColor(providerId) {
  const colors = {
    'cloudflare': '#f38020',
    'godaddy': '#ff7900',
    'namecheap': '#ff7800',
    'duckdns': '#d75813',
    'noip': '#00aaff',
    'dyndns': '#0072ce'
  }
  return colors[providerId] || '#3b82f6'
}

function getStatusType(status) {
  const types = {
    'active': 'success',
    'error': 'danger',
    'disabled': 'warning',
    'pending': 'info'
  }
  return types[status] || 'info'
}

function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

function formatRelativeTime(dateString) {
  if (!dateString) return t('dynamicDns.never')
  
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now - date) / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)
  
  if (diffInMinutes < 1) return t('dynamicDns.justNow')
  if (diffInMinutes < 60) return t('dynamicDns.minutesAgo', { minutes: diffInMinutes })
  if (diffInHours < 24) return t('dynamicDns.hoursAgo', { hours: diffInHours })
  if (diffInDays < 7) return t('dynamicDns.daysAgo', { days: diffInDays })
  
  return formatDate(dateString)
}

function isRecentUpdate(dateString) {
  if (!dateString) return false
  const date = new Date(dateString)
  const now = new Date()
  return (now - date) < 30 * 60 * 1000 // 30 minutes
}

function showAddDialog() {
  editedService.value = null
  showDialog.value = true
}

function editService(service) {
  editedService.value = { ...service }
  showDialog.value = true
}

async function testService(service) {
  try {
    testingServiceId.value = service.id
    ElMessage.info(t('dynamicDns.testingService'))
    
    const response = await axios.post(`/network/dynamic-dns/${service.id}/update`)
    
    if (response.data.success) {
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.testSuccess'),
        type: 'success',
        duration: 5000
      })
      await fetchData()
    } else {
      ElNotification({
        title: t('dynamicDns.error'),
        message: t('dynamicDns.testFailed'),
        type: 'error',
        duration: 5000
      })
    }
  } catch (err) {
    console.error('Error testing service:', err)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.testError'),
      type: 'error',
      duration: 5000
    })
  } finally {
    testingServiceId.value = null
  }
}

async function toggleService(id, enabled) {
  try {
    togglingServiceId.value = id
    const response = await axios.patch(`/network/dynamic-dns/${id}`, { enabled })
    
    if (response.data.success) {
      ElMessage.success(
        enabled ? t('dynamicDns.serviceEnabled') : t('dynamicDns.serviceDisabled')
      )
      await fetchData()
    }
  } catch (err) {
    console.error('Error toggling service:', err)
    ElMessage.error(t('dynamicDns.toggleError'))
  } finally {
    togglingServiceId.value = null
  }
}

async function deleteService(id) {
  try {
    await ElMessageBox.confirm(
      t('dynamicDns.deleteConfirm'),
      t('dynamicDns.confirmation'),
      {
        type: 'warning',
        confirmButtonText: t('dynamicDns.delete'),
        cancelButtonText: t('dynamicDns.cancel'),
        confirmButtonClass: 'el-button--danger',
        customClass: 'dynamic-dns-confirm-dialog'
      }
    )
    
    deletingServiceId.value = id
    await axios.delete(`/network/dynamic-dns/${id}`)
    
    ElNotification({
      title: t('dynamicDns.success'),
      message: t('dynamicDns.serviceDeleted'),
      type: 'success',
      duration: 3000
    })
    await fetchData()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('Error deleting service:', err)
      ElNotification({
        title: t('dynamicDns.error'),
        message: t('dynamicDns.deleteError'),
        type: 'error',
        duration: 5000
      })
    }
  } finally {
    deletingServiceId.value = null
  }
}

async function saveSettings() {
  try {
    savingSettings.value = true
    const response = await axios.post('/network/dynamic-dns/settings', { 
      settings: settings.value 
    })
    
    ElNotification({
      title: t('dynamicDns.success'),
      message: t('dynamicDns.settingsSaved'),
      type: 'success',
      duration: 5000
    })
  } catch (err) {
    console.error('Error saving settings:', err)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.saveSettingsError'),
      type: 'error',
      duration: 5000
    })
  } finally {
    savingSettings.value = false
  }
}

function resetSettings() {
  settings.value = {
    updateInterval: '30m',
    forceIpv4: false,
    forceIpv6: false,
    notifyOnError: true,
    notifyOnSuccess: false
  }
}

async function handleSaveService(serviceData) {
  try {
    if (serviceData.id) {
      await axios.put(`/network/dynamic-dns/${serviceData.id}`, serviceData)
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.serviceUpdated'),
        type: 'success',
        duration: 3000
      })
    } else {
      await axios.post('/network/dynamic-dns', serviceData)
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.serviceAdded'),
        type: 'success',
        duration: 3000
      })
    }
    await fetchData()
  } catch (err) {
    console.error('Error saving service:', err)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.saveServiceError'),
      type: 'error',
      duration: 5000
    })
  }
}

async function updateAll() {
  try {
    updating.value = true
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.inProgress'),
      type: 'info',
      duration: 3000
    })
    
    const response = await axios.post('/network/dynamic-dns/update-all')
    lastAutoUpdate.value = new Date().toISOString()
    
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.success'),
      type: 'success',
      duration: 5000
    })
    await fetchData()
  } catch (err) {
    console.error('Error updating all services:', err)
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.failed'),
      type: 'error',
      duration: 5000
    })
  } finally {
    updating.value = false
  }
}

async function checkCronStatus() {
  try {
    const response = await axios.get('/network/dynamic-dns/cron-status')
    cronInstalled.value = response.data.installed || false
  } catch (err) {
    console.error('Error checking cron status:', err)
    cronInstalled.value = false
  }
}

async function installCron() {
  try {
    installingCron.value = true
    const response = await axios.post('/network/dynamic-dns/install-cron')
    
    if (response.data.success) {
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.cronInstalled'),
        type: 'success',
        duration: 5000
      })
      cronInstalled.value = true
    } else {
      throw new Error('Installation failed')
    }
  } catch (err) {
    console.error('Error installing cron:', err)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.cronInstallError'),
      type: 'error',
      duration: 5000
    })
  } finally {
    installingCron.value = false
  }
}

onMounted(() => {
  fetchData()
  checkCronStatus()
})
</script>

<style scoped>
.dynamic-dns-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  transition: all 0.3s ease;
}

.dynamic-dns-dashboard.dark {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #e2e8f0;
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.dark .dashboard-header {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  transition: color 0.3s ease;
}

.dark .header-text h1 {
  color: #f8fafc;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
  transition: color 0.3s ease;
}

.dark .subtitle {
  color: #94a3b8;
}

.header-actions .el-button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dynamic-dns-content {
  display: grid;
  gap: 24px;
}

.services-card,
.settings-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.dark .services-card,
.dark .settings-card {
  background: #334155;
  border-color: #475569;
  color: #e2e8f0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
  transition: border-color 0.3s ease;
}

.dark .card-header {
  border-bottom-color: #475569;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
  transition: color 0.3s ease;
}

.dark .card-header h2 {
  color: #f8fafc;
}

.card-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 0;
  min-height: 300px;
}

.loading-spinner p {
  margin-top: 16px;
  color: #64748b;
  transition: color 0.3s ease;
}

.dark .loading-spinner p {
  color: #94a3b8;
}

.empty-state {
  padding: 80px 0;
  min-height: 300px;
}

.service-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.service-name {
  font-weight: 500;
}

.last-update-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-warning {
  color: #d97706;
}

.dark .text-warning {
  color: #fbbf24;
}

.text-success {
  color: #059669;
}

.dark .text-success {
  color: #34d399;
}

.service-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.error-message {
  margin-bottom: 20px;
}

.settings-form {
  padding: 0 24px;
}

.settings-select {
  width: 200px;
}

.settings-hint {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
  transition: color 0.3s ease;
}

.dark .settings-hint {
  color: #94a3b8;
}

.ip-settings,
.notification-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
}

.mr-1 {
  margin-right: 4px;
}

.ml-4 {
  margin-left: 16px;
}

.settings-info {
  padding: 0 24px;
  color: #64748b;
  line-height: 1.6;
  transition: color 0.3s ease;
}

.dark .settings-info {
  color: #94a3b8;
}

.settings-info p {
  margin: 10px 0;
}

.info-items {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.info-item.success {
  background-color: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.dark .info-item.success {
  background-color: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.info-item.warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.dark .info-item.warning {
  background-color: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.info-item.info {
  background-color: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
}

.dark .info-item.info {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    overflow-x: auto;
  }
  
  .header-actions .el-button-group {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;
    -webkit-overflow-scrolling: touch;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header-actions {
    width: 100%;
  }
  
  .settings-form {
    padding: 0 16px;
  }
  
  .settings-select {
    width: 100%;
  }
  
  .ip-settings,
  .notification-settings {
    flex-direction: column;
    gap: 12px;
  }
  
  .ml-4 {
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .service-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.el-button--warning) {
  background: #f59e0b;
  border-color: #f59e0b;
}

:deep(.el-button--warning:hover) {
  background: #d97706;
  border-color: #d97706;
}

:deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

:deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}

:deep(.el-button--info) {
  background: #64748b;
  border-color: #64748b;
}

:deep(.el-button--info:hover) {
  background: #475569;
  border-color: #475569;
}

:deep(.el-button--success) {
  background: #10b981;
  border-color: #10b981;
}

:deep(.el-button--success:hover) {
  background: #059669;
  border-color: #059669;
}

/* Table styling */
:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  --el-table-text-color: #1e293b;
  --el-table-row-hover-bg-color: #f8fafc;
}

.dark :deep(.el-table) {
  --el-table-border-color: #475569;
  --el-table-header-bg-color: #334155;
  --el-table-text-color: #e2e8f0;
  --el-table-row-hover-bg-color: #475569;
}

:deep(.el-table th) {
  font-weight: 600;
  background-color: var(--el-table-header-bg-color) !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background-color: rgba(241, 245, 249, 0.5);
}

.dark :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background-color: rgba(51, 65, 85, 0.5);
}

/* Tag styling */
:deep(.el-tag.status-active) {
  border-color: rgba(16, 185, 129, 0.2);
}

.dark :deep(.el-tag.status-active) {
  background-color: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
}

:deep(.el-tag.status-error) {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.dark :deep(.el-tag.status-error) {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
}

:deep(.el-tag.status-disabled) {
  background-color: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
}

.dark :deep(.el-tag.status-disabled) {
  background-color: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.3);
}

/* Card hover effects */
.services-card:hover,
.settings-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

.dark .services-card:hover,
.dark .settings-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.empty-state :deep(.el-empty__image) {
  opacity: 0.8;
}

.empty-state :deep(.el-empty__description) {
  color: #64748b;
  font-size: 15px;
  transition: color 0.3s ease;
}

.dark .empty-state :deep(.el-empty__description) {
  color: #94a3b8;
}

.empty-state :deep(.el-empty__extra) {
  margin-top: 20px;
}

.el-divider {
  margin: 24px;
  transition: border-color 0.3s ease;
}

.dark .el-divider {
  --el-border-color: #475569;
}

/* Loading animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.el-icon.is-loading) {
  animation: spin 1s linear infinite;
}

/* Form styling */
:deep(.el-form-item__label) {
  color: #1e293b;
  font-weight: 500;
  transition: color 0.3s ease;
}

.dark :deep(.el-form-item__label) {
  color: #e2e8f0;
}

/* Checkbox styling */
:deep(.el-checkbox__label) {
  color: #1e293b;
  transition: color 0.3s ease;
}

.dark :deep(.el-checkbox__label) {
  color: #e2e8f0;
}

/* Tooltip styling */
:deep(.el-tooltip__popper) {
  max-width: 300px;
  word-break: break-word;
}

/* Focus states for accessibility */
:deep(.el-button:focus),
:deep(.el-select:focus),
:deep(.el-checkbox:focus) {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
}
</style>
