<template>
  <div class="dynamic-dns">
    <div class="header">
      <h2>
        <Icon icon="mdi:ip-network" width="24" height="24" />
        {{ $t('dynamicDns.title') }}
      </h2>
    </div>

  <div class="card">
    <div class="card-header">
      <h3>
        <Icon icon="mdi:clock-outline" width="20" height="20" />
        {{ $t('dynamicDns.automaticUpdates') }}
      </h3>
      <button 
        v-if="!cronInstalled"
        class="btn btn-secondary btn-sm"
        @click="installCron"
        :disabled="installingCron"
      >
        <Icon icon="mdi:calendar-clock" width="16" height="16" class="mr-2" />
        {{ installingCron ? $t('dynamicDns.installing') : $t('dynamicDns.installCron') }}
      </button>
      <button class="btn btn-secondary btn-sm" @click="updateAll" :disabled="updating">
        <Icon icon="mdi:refresh" width="16" height="16" class="mr-2" />
        {{ $t('dynamicDns.updateNow') }}
      </button>
    </div>
    <div class="card-body">
      <p>{{ $t('dynamicDns.cronDescription') }}</p>
      <p v-if="lastAutoUpdate">
        {{ $t('dynamicDns.lastAutoUpdate') }}: {{ formatDate(lastAutoUpdate) }}
      </p>
    </div>
  </div>
  
    <div class="card">
      <div class="card-header">
        <h3>{{ $t('dynamicDns.configuredServices') }}</h3>
        <button class="btn btn-primary" @click="showAddDialog">
          <Icon icon="mdi:plus" width="16" height="16" class="mr-2" />
          {{ $t('dynamicDns.addService') }}
        </button>
      </div>

      <div class="card-body">
        <div v-if="loading" class="loading">{{ $t('dynamicDns.saving') }}</div>
        <div v-else-if="error" class="error">{{ $t('dynamicDns.fetchError') }}</div>
        <div v-else-if="services.length === 0" class="no-services">
          {{ $t('dynamicDns.noServices') }}
        </div>
        <table v-else class="service-table">
          <thead>
            <tr>
              <th>{{ $t('dynamicDns.service') }}</th>
              <th>{{ $t('dynamicDns.hostname') }}</th>
              <th>{{ $t('dynamicDns.username') }}</th>
              <th>{{ $t('dynamicDns.lastUpdate') }}</th>
              <th>{{ $t('dynamicDns.status') }}</th>
              <th>{{ $t('dynamicDns.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="service in services" :key="service.id">
              <td>
                <Icon :icon="getProviderIcon(service.provider)" width="20" height="20" />
                {{ getProviderName(service.provider) }}
              </td>
              <td>{{ service.hostname }}</td>
              <td>{{ service.username }}</td>
              <td>{{ service.lastUpdate ? formatDate(service.lastUpdate) : $t('dynamicDns.lastUpdateNever') }}</td>
              <td>
                <span class="status-badge" :class="'status-' + service.status">
                  {{ $t(`dynamicDns.statuses.${service.status}`) }}
                </span>
              </td>
              <td class="actions">
                <button class="btn-icon" @click="editService(service)" :title="$t('dynamicDns.edit')">
                  <Icon icon="mdi:pencil" width="18" height="18" />
                </button>
                <button class="btn-icon" @click="testService(service)" :title="$t('dynamicDns.test')">
                  <Icon icon="mdi:connection" width="18" height="18" />
                </button>
                <button class="btn-icon btn-danger" @click="deleteService(service.id)" :title="$t('dynamicDns.delete')">
                  <Icon icon="mdi:delete" width="18" height="18" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>
          <Icon icon="mdi:cog" width="20" height="20" />
          {{ $t('dynamicDns.settings') }}
        </h3>
      </div>
      <div class="card-body">
        <form @submit.prevent="saveSettings" class="settings-form">
          <div class="form-group">
            <label>{{ $t('dynamicDns.updateInterval') }}</label>
            <select v-model="settings.updateInterval" class="form-control">
              <option v-for="option in intervalOptions" :value="option.value" :key="option.value">
                {{ option.title }}
              </option>
            </select>
          </div>

          <div class="form-check">
            <input
              type="checkbox"
              v-model="settings.forceIpv4"
              id="forceIpv4"
              class="form-check-input"
            >
            <label for="forceIpv4" class="form-check-label">
              {{ $t('dynamicDns.forceIpv4') }}
            </label>
          </div>

          <div class="form-check">
            <input
              type="checkbox"
              v-model="settings.forceIpv6"
              id="forceIpv6"
              class="form-check-input"
            >
            <label for="forceIpv6" class="form-check-label">
              {{ $t('dynamicDns.forceIpv6') }}
            </label>
          </div>

          <button type="submit" class="btn btn-primary" :disabled="savingSettings">
            {{ savingSettings ? $t('dynamicDns.saving') : $t('dynamicDns.saveSettings') }}
          </button>
        </form>
      </div>
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
import { ElNotification } from 'element-plus'
import DnsServiceForm from './DnsServiceForm.vue'
import providers from './providers'
import axios from 'axios'

// Import tłumaczeń
import enLocales from './locales/en'
import plLocales from './locales/pl'

const { t, mergeLocaleMessage } = useI18n()

// Dodaj tłumaczenia do i18n
mergeLocaleMessage('en', enLocales)
mergeLocaleMessage('pl', plLocales)

const services = ref([])
const settings = ref({
  updateInterval: '30m',
  forceIpv4: false,
  forceIpv6: false
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

const intervalOptions = computed(() => [
  { value: '15m', title: t('dynamicDns.intervals.15m') },
  { value: '30m', title: t('dynamicDns.intervals.30m') },
  { value: '1h', title: t('dynamicDns.intervals.1h') },
  { value: '2h', title: t('dynamicDns.intervals.2h') },
  { value: '6h', title: t('dynamicDns.intervals.6h') },
  { value: '12h', title: t('dynamicDns.intervals.12h') },
  { value: '24h', title: t('dynamicDns.intervals.24h') }
])

async function fetchData() {
  try {
    loading.value = true
    error.value = null
    
    const [servicesRes, settingsRes] = await Promise.all([
      axios.get('/network/dynamic-dns'),
      axios.get('/network/dynamic-dns/settings')
    ])
    
    services.value = servicesRes.data.services
    settings.value = settingsRes.data.settings
  } catch (err) {
    console.error('Error fetching data:', err)
    error.value = t('dynamicDns.fetchError')
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

function formatDate(dateString) {
  return new Date(dateString).toLocaleString()
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
    const response = await axios.post(`/network/dynamic-dns/${service.id}/update`)
    if (response.data.success) {
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.testSuccess'),
        type: 'success',
      })
      await fetchData()
    } else {
      ElNotification({
        title: t('dynamicDns.error'),
        message: t('dynamicDns.testFailed'),
        type: 'error',
      })
    }
  } catch (error) {
    console.error('Error testing service:', error)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.testError'),
      type: 'error',
    })
  }
}

async function deleteService(id) {
  try {
    await axios.delete(`/network/dynamic-dns/${id}`)
    ElNotification({
      title: t('dynamicDns.success'),
      message: t('dynamicDns.serviceDeleted'),
      type: 'success',
    })
    await fetchData()
  } catch (error) {
    console.error('Error deleting service:', error)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.deleteError'),
      type: 'error',
    })
  }
}

async function saveSettings() {
  try {
    savingSettings.value = true;
    const response = await axios.post('/network/dynamic-dns/settings', { 
      settings: settings.value 
    });
    
    ElNotification({
      title: t('dynamicDns.success'),
      message: t('dynamicDns.settingsSaved') + '. ' + 
               t('dynamicDns.cronUpdated', { interval: settings.value.updateInterval }),
      type: 'success',
      duration: 5000
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.saveSettingsError'),
      type: 'error'
    });
  } finally {
    savingSettings.value = false;
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
      })
    } else {
      await axios.post('/network/dynamic-dns', serviceData)
      ElNotification({
        title: t('dynamicDns.success'),
        message: t('dynamicDns.serviceAdded'),
        type: 'success',
      })
    }
    await fetchData()
  } catch (error) {
    console.error('Error saving service:', error)
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.saveServiceError'),
      type: 'error',
    })
  }
}

async function updateAll() {
  try {
    updating.value = true
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.inProgress'),
      type: 'info'
    })
    
    const response = await axios.get('/network/dynamic-dns/update-all')
    lastAutoUpdate.value = new Date().toISOString()
    
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.success'),
      type: 'success'
    })
    await fetchData()
  } catch (error) {
    ElNotification({
      title: t('dynamicDns.automaticUpdates'),
      message: t('dynamicDns.updateStatus.failed'),
      type: 'error'
    })
  } finally {
    updating.value = false
  }
}

async function checkCronStatus() {
  try {
    const response = await axios.get('/network/dynamic-dns/cron-status')
    cronInstalled.value = response.data.installed
  } catch (error) {
    console.error('Error checking cron status:', error)
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
        type: 'success'
      })
      cronInstalled.value = true
    }
  } catch (error) {
    ElNotification({
      title: t('dynamicDns.error'),
      message: t('dynamicDns.cronInstallError'),
      type: 'error'
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
.dynamic-dns {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
}

.header {
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.card-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.2rem;
}

.card-body {
  padding: 20px;
}

.service-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.service-table th,
.service-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.service-table th {
  font-weight: 600;
  background-color: #f8f9fa;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-active {
  background-color: #e6f7e6;
  color: #2e7d32;
}

.status-error {
  background-color: #ffebee;
  color: #c62828;
}

.status-disabled {
  background-color: #fff8e1;
  color: #f9a825;
}

.status-pending {
  background-color: #e3f2fd;
  color: #1565c0;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #1976d2;
  color: white;
}

.btn-primary:hover {
  background-color: #1565c0;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #555;
}

.btn-icon:hover {
  background-color: #f5f5f5;
}

.btn-danger {
  color: #c62828;
}

.btn-danger:hover {
  background-color: #ffebee;
}

.form-group {
  margin-bottom: 15px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-check {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.form-check-input {
  margin-right: 8px;
}

.settings-form {
  max-width: 500px;
}

.loading, .no-services {
  padding: 20px;
  text-align: center;
  color: #666;
}

.error {
  padding: 20px;
  text-align: center;
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
  margin: 10px 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}
</style>
