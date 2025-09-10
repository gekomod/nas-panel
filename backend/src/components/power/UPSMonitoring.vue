<template>
  <div class="ups-monitoring">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:car-battery" width="24" />
              <h3>Status UPS</h3>
              <el-button 
                size="small" 
                @click="loadUPSStatus"
                :loading="statusLoading"
              >
                <icon icon="mdi:refresh" width="16" />
              </el-button>
            </div>
          </template>

          <div class="status-card" v-loading="statusLoading">
            <div class="status-indicator" :class="getStatusClass(upsStatus.status)">
              <icon :icon="getStatusIcon(upsStatus.status)" width="48" />
            </div>
            <div class="status-info">
              <h4>{{ getStatusLabel(upsStatus.status) }}</h4>
              <p>Bateria: {{ upsStatus.battery }}%</p>
              <p>Czas pracy: {{ upsStatus.runtime }} min</p>
              <p>Napięcie: {{ upsStatus.voltage }}V</p>
              <p>Obciążenie: {{ upsStatus.load }}%</p>
              <p>Temperatura: {{ upsStatus.temperature }}°C</p>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:chart-line" width="24" />
              <h3>Bateria</h3>
            </div>
          </template>

          <div class="battery-chart">
            <div class="battery-level">
              <div
                class="battery-fill"
                :style="{ width: upsStatus.battery + '%' }"
                :class="getBatteryLevelClass(upsStatus.battery)"
              ></div>
              <span class="battery-text">{{ upsStatus.battery }}%</span>
            </div>
            
            <div class="battery-stats">
              <div class="stat-item">
                <icon icon="mdi:clock-outline" width="16" />
                <span>Czas pracy: {{ upsStatus.runtime }} min</span>
              </div>
              <div class="stat-item">
                <icon icon="mdi:lightning-bolt" width="16" />
                <span>Napięcie: {{ upsStatus.voltage }}V</span>
              </div>
              <div class="stat-item">
                <icon icon="mdi:flash" width="16" />
                <span>Obciążenie: {{ upsStatus.load }}%</span>
              </div>
              <div class="stat-item">
                <icon icon="mdi:thermometer" width="16" />
                <span>Temperatura: {{ upsStatus.temperature }}°C</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:cog" width="24" />
              <h3>Konfiguracja UPS</h3>
              <el-button 
                size="small" 
                @click="loadUPSConfig"
                :loading="configLoading"
              >
                <icon icon="mdi:refresh" width="16" />
              </el-button>
            </div>
          </template>

          <el-form :model="config" label-width="160px" v-loading="configLoading">
            <el-form-item label="Nazwa UPS">
              <el-input v-model="config.upsName" />
            </el-form-item>
            
            <el-form-item label="Sterownik">
              <el-select v-model="config.driver">
                <el-option value="usbhid-ups">USB HID</el-option>
                <el-option value="blazer_usb">Blazer USB</el-option>
                <el-option value="nutdrv_qx">Nutdrv QX</el-option>
                <el-option value="snmp-ups">SNMP</el-option>
                <el-option value="blazer_ser">Blazer Serial</el-option>
                <el-option value="megatec">Megatec</el-option>
                <el-option value="apcsmart">APC Smart</el-option>
              </el-select>
            </el-form-item>
            
            <el-form-item label="Port">
              <el-input v-model="config.port" placeholder="auto, /dev/ttyUSB0, /dev/ttyS0" />
            </el-form-item>
            
            <el-form-item label="Auto wyłączanie">
              <el-switch v-model="config.autoShutdown" />
            </el-form-item>
            
            <el-form-item label="Próg baterii" v-if="config.autoShutdown">
              <el-slider v-model="config.shutdownLevel" :min="5" :max="50" :step="5" />
              <span>{{ config.shutdownLevel }}%</span>
            </el-form-item>
            
            <el-form-item label="Czas opóźnienia">
              <el-input-number v-model="config.delay" :min="0" :max="300" />
              <span>sekund</span>
            </el-form-item>
            
            <el-form-item label="Powiadomienia">
              <el-switch v-model="config.notifications" />
            </el-form-item>
            
            <el-form-item label="Monitorowanie">
              <el-switch v-model="config.monitoring" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="saveConfig" :loading="savingConfig">
                <icon icon="mdi:content-save" width="16" />
                Zapisz konfigurację
              </el-button>
              <el-button @click="restartNUTService" :loading="restartingService">
                <icon icon="mdi:restart" width="16" />
                Restartuj usługę
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:information" width="24" />
              <h3>Szczegóły UPS</h3>
            </div>
          </template>

          <el-descriptions :column="1" border v-loading="detailsLoading">
            <el-descriptions-item label="Model">{{ upsDetails.model || 'N/A' }}</el-descriptions-item>
            <el-descriptions-item label="Producent">{{ upsDetails.mfr || 'N/A' }}</el-descriptions-item>
            <el-descriptions-item label="Numer seryjny">{{ upsDetails.serial || 'N/A' }}</el-descriptions-item>
            <el-descriptions-item label="Wersja firmware">{{ upsDetails.firmware || 'N/A' }}</el-descriptions-item>
            <el-descriptions-item label="Data produkcji">{{ upsDetails.date || 'N/A' }}</el-descriptions-item>
            <el-descriptions-item label="Nominalne napięcie">{{ upsDetails.nominalVoltage || 'N/A' }}V</el-descriptions-item>
            <el-descriptions-item label="Nominalna moc">{{ upsDetails.nominalPower || 'N/A' }}VA</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:history" width="24" />
              <h3>Historia zdarzeń</h3>
              <el-button 
                size="small" 
                @click="loadUPSEvents"
                :loading="eventsLoading"
              >
                <icon icon="mdi:refresh" width="16" />
              </el-button>
            </div>
          </template>

          <el-table :data="events" style="width: 100%" height="300" v-loading="eventsLoading">
            <el-table-column prop="timestamp" label="Data" width="160" />
            <el-table-column prop="event" label="Zdarzenie" />
            <el-table-column prop="battery" label="Bateria" width="80">
              <template #default="{ row }">
                {{ row.battery }}%
              </template>
            </el-table-column>
            <el-table-column prop="runtime" label="Czas pracy" width="100">
              <template #default="{ row }">
                {{ row.runtime }} min
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="testDialogVisible" title="Test UPS" width="500px">
      <p>Testowanie działania UPS. Wybierz typ testu:</p>
      
      <el-radio-group v-model="testType" style="margin: 20px 0;">
        <el-radio label="quick">Szybki test baterii</el-radio>
        <el-radio label="deep">Głęboki test baterii</el-radio>
      </el-radio-group>
      
      <template #footer>
        <el-button @click="testDialogVisible = false">Anuluj</el-button>
        <el-button type="primary" @click="runUPSTest" :loading="testingUPS">
          Uruchom test
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const upsStatus = reactive({
  status: 'unknown',
  battery: 0,
  runtime: 0,
  voltage: 0,
  load: 0,
  temperature: 0,
  inputVoltage: 0,
  outputVoltage: 0
})

const upsDetails = reactive({
  model: '',
  mfr: '',
  serial: '',
  firmware: '',
  date: '',
  nominalVoltage: '',
  nominalPower: ''
})

const config = reactive({
  upsName: 'nas-ups',
  driver: 'usbhid-ups',
  port: 'auto',
  autoShutdown: true,
  shutdownLevel: 20,
  delay: 30,
  notifications: true,
  monitoring: true,
  pollInterval: 5,
  maxRetries: 3
})

const events = ref([])
const statusLoading = ref(false)
const configLoading = ref(false)
const detailsLoading = ref(false)
const eventsLoading = ref(false)
const savingConfig = ref(false)
const restartingService = ref(false)
const testingUPS = ref(false)
const testDialogVisible = ref(false)
const testType = ref('quick')

const statusMap = {
  'OL': 'online',
  'OB': 'battery',
  'LB': 'lowbattery',
  'HB': 'highbattery',
  'RB': 'battery-test',
  'CHRG': 'charging',
  'DISCHRG': 'discharging',
  'BYPASS': 'bypass',
  'CAL': 'calibration',
  'OFF': 'off',
  'OVER': 'overloaded',
  'TRIM': 'trim',
  'BOOST': 'boost',
  'FSD': 'forced-shutdown'
}

const getStatusClass = (status) => {
  const classes = {
    'online': 'online',
    'battery': 'battery',
    'lowbattery': 'lowbattery',
    'charging': 'charging',
    'discharging': 'discharging',
    'overloaded': 'danger',
    'forced-shutdown': 'danger'
  }
  return classes[status] || 'unknown'
}

const getStatusIcon = (status) => {
  const icons = {
    'online': 'mdi:power-plug',
    'battery': 'mdi:battery-70',
    'lowbattery': 'mdi:battery-alert',
    'charging': 'mdi:battery-charging-70',
    'discharging': 'mdi:battery-arrow-down',
    'overloaded': 'mdi:alert-octagon',
    'forced-shutdown': 'mdi:power-off',
    'unknown': 'mdi:alert-circle'
  }
  return icons[status] || 'mdi:alert-circle'
}

const getStatusLabel = (status) => {
  const labels = {
    'online': 'Podłączony do sieci',
    'battery': 'Praca na baterii',
    'lowbattery': 'Niski poziom baterii',
    'charging': 'Ładowanie',
    'discharging': 'Rozładowywanie',
    'overloaded': 'Przeciążenie',
    'forced-shutdown': 'Wymuszone wyłączenie',
    'unknown': 'Status nieznany'
  }
  return labels[status] || status
}

const getBatteryLevelClass = (level) => {
  if (level > 70) return 'high'
  if (level > 30) return 'medium'
  return 'low'
}

const loadUPSStatus = async () => {
  statusLoading.value = true
  try {
    const response = await axios.get('/ups/status')
    const data = response.data.status
    
    // Mapowanie statusu z NUT
    upsStatus.status = statusMap[data.status] || 'unknown'
    upsStatus.battery = parseInt(data.batteryCharge) || 0
    upsStatus.runtime = parseInt(data.batteryRuntime) / 60 || 0 // Konwersja na minuty
    upsStatus.voltage = parseFloat(data.inputVoltage) || 0
    upsStatus.load = parseInt(data.upsLoad) || 0
    upsStatus.temperature = parseFloat(data.batteryTemperature) || 0
    upsStatus.inputVoltage = parseFloat(data.inputVoltage) || 0
    upsStatus.outputVoltage = parseFloat(data.outputVoltage) || 0
    
  } catch (error) {
    console.error('Błąd podczas ładowania statusu UPS:', error)
    ElMessage.error('Nie udało się załadować statusu UPS')
  } finally {
    statusLoading.value = false
  }
}

const loadUPSDetails = async () => {
  detailsLoading.value = true
  try {
    const response = await axios.get('/ups/details')
    Object.assign(upsDetails, response.data.details)
  } catch (error) {
    console.error('Błąd podczas ładowania szczegółów UPS:', error)
    // Nie pokazuj błędu, po prostu zostaw puste wartości
  } finally {
    detailsLoading.value = false
  }
}

const loadUPSConfig = async () => {
  configLoading.value = true
  try {
    const response = await axios.get('/ups/config/nut')
    const configData = response.data.config
    
    // Aktualizuj konfigurację
    if (configData.upsName) config.upsName = configData.upsName
    if (configData.driver) config.driver = configData.driver
    if (configData.port) config.port = configData.port
    if (configData.shutdownLevel) config.shutdownLevel = parseInt(configData.shutdownLevel)
    if (configData.delay) config.delay = parseInt(configData.delay)
    if (configData.pollInterval) config.pollInterval = parseInt(configData.pollInterval)
    if (configData.maxRetries) config.maxRetries = parseInt(configData.maxRetries)
    
    config.autoShutdown = configData.autoShutdown !== false
    config.notifications = configData.notifications !== false
    config.monitoring = configData.monitoring !== false
    
  } catch (error) {
    console.error('Błąd podczas ładowania konfiguracji UPS:', error)
    ElMessage.warning('Konfiguracja NUT niedostępna, używam domyślnej')
  } finally {
    configLoading.value = false
  }
}

const loadUPSEvents = async () => {
  eventsLoading.value = true
  try {
    const response = await axios.get('/ups/events')
    events.value = response.data.events
  } catch (error) {
    console.error('Błąd podczas ładowania zdarzeń UPS:', error)
    ElMessage.error('Nie udało się załadować zdarzeń UPS')
  } finally {
    eventsLoading.value = false
  }
}

const saveConfig = async () => {
  savingConfig.value = true
  try {
    // Najpierw zapisz podstawową konfigurację
    await axios.post('/ups/config', { config })
    
    // Następnie zapisz konfigurację NUT
    const response = await axios.post('/ups/config/nut', { config })
    
    ElMessage.success('Konfiguracja UPS zapisana')
    
    // Odśwież konfigurację
    await loadUPSConfig()
    
  } catch (error) {
    console.error('Błąd podczas zapisywania konfiguracji UPS:', error)
    ElMessage.error('Nie udało się zapisać konfiguracji UPS')
  } finally {
    savingConfig.value = false
  }
}

const restartNUTService = async () => {
  restartingService.value = true
  try {
    await axios.post('/ups/service/restart')
    ElMessage.success('Usługa NUT zrestartowana')
  } catch (error) {
    console.error('Błąd podczas restartowania usługi NUT:', error)
    ElMessage.error('Nie udało się zrestartować usługi NUT')
  } finally {
    restartingService.value = false
  }
}

const runUPSTest = async () => {
  testingUPS.value = true
  try {
    await axios.post('/ups/test', { type: testType.value })
    ElMessage.success('Test UPS rozpoczęty')
    testDialogVisible.value = false
  } catch (error) {
    console.error('Błąd podczas uruchamiania testu UPS:', error)
    ElMessage.error('Nie udało się uruchomić testu UPS')
  } finally {
    testingUPS.value = false
  }
}

const showTestDialog = () => {
  testType.value = 'quick'
  testDialogVisible.value = true
}

let statusInterval

onMounted(() => {
  loadUPSStatus()
  loadUPSDetails()
  loadUPSConfig()
  loadUPSEvents()
  
  // Aktualizuj status co 5 sekund
  statusInterval = setInterval(() => {
    loadUPSStatus()
  }, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>

<style scoped>
.ups-monitoring {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
  flex: 1;
}

.status-card {
  text-align: center;
  padding: 20px 0;
}

.status-indicator {
  margin-bottom: 15px;
}

.status-indicator.online { color: var(--el-color-success); }
.status-indicator.battery { color: var(--el-color-warning); }
.status-indicator.lowbattery { color: var(--el-color-danger); }
.status-indicator.charging { color: var(--el-color-primary); }
.status-indicator.danger { color: var(--el-color-danger); }
.status-indicator.unknown { color: var(--el-color-info); }

.status-info h4 {
  margin: 0 0 10px 0;
  font-size: 1.2rem;
}

.status-info p {
  margin: 5px 0;
  color: var(--el-text-color-secondary);
}

.battery-chart {
  text-align: center;
}

.battery-level {
  position: relative;
  height: 30px;
  background: var(--el-border-color-light);
  border-radius: 15px;
  margin: 20px 0;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  border-radius: 15px;
  transition: width 0.5s ease;
}

.battery-fill.high { background: var(--el-color-success); }
.battery-fill.medium { background: var(--el-color-warning); }
.battery-fill.low { background: var(--el-color-danger); }

.battery-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.battery-stats {
  margin-top: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
}

:deep(.el-descriptions__body) {
  background: transparent;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
}
</style>
