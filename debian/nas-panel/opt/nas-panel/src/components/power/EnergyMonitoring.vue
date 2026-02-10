<template>
  <div class="energy-monitoring">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon current">
              <icon icon="mdi:lightning-bolt" width="32" />
            </div>
            <div class="stat-info">
              <div class="stat-value" v-if="currentPower !== null">{{ currentPower }} W</div>
              <div class="stat-value" v-else>--</div>
              <div class="stat-label">Bieżące zużycie</div>
              <div class="stat-timestamp" v-if="lastUpdate">{{ lastUpdate }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon today">
              <icon icon="mdi:chart-bar" width="32" />
            </div>
            <div class="stat-info">
              <div class="stat-value" v-if="todayEnergy !== null">{{ todayEnergy }} kWh</div>
              <div class="stat-value" v-else>--</div>
              <div class="stat-label">Dzisiaj</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon month">
              <icon icon="mdi:calendar-month" width="32" />
            </div>
            <div class="stat-info">
              <div class="stat-value" v-if="monthEnergy !== null">{{ monthEnergy }} kWh</div>
              <div class="stat-value" v-else>--</div>
              <div class="stat-label">Ten miesiąc</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon cost">
              <icon icon="mdi:cash" width="32" />
            </div>
            <div class="stat-info">
              <div class="stat-value" v-if="monthlyCost !== null">{{ monthlyCost }} zł</div>
              <div class="stat-value" v-else>--</div>
              <div class="stat-label">Koszt miesięczny</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-alert
      v-if="dataUnavailable"
      title="Dane niedostępne"
      type="warning"
      description="System monitorowania energii nie jest dostępny. Sprawdź konfigurację lub zainstaluj odpowiednie narzędzia."
      show-icon
      style="margin-top: 20px;"
    />

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:chart-line" width="24" />
              <h3>Zużycie energii - 24h</h3>
              <el-button 
                size="small" 
                @click="loadEnergyHistory"
                :loading="historyLoading"
              >
                <icon icon="mdi:refresh" width="16" />
              </el-button>
            </div>
          </template>
          
          <div class="chart-container" v-if="energyHistory.length > 0">
            <div class="chart-placeholder">
              <icon icon="mdi:chart-areaspline" width="64" />
              <p>Wykres historycznego zużycia energii</p>
              <div class="history-stats">
                <div>Min: {{ Math.min(...energyHistory.map(h => h.power)) }}W</div>
                <div>Max: {{ Math.max(...energyHistory.map(h => h.power)) }}W</div>
                <div>Średnia: {{ Math.round(energyHistory.reduce((sum, h) => sum + h.power, 0) / energyHistory.length) }}W</div>
              </div>
            </div>
          </div>
          <div class="chart-container" v-else>
            <div class="chart-placeholder">
              <icon icon="mdi:chart-line" width="64" />
              <p>Brak danych historycznych</p>
              <el-button @click="loadEnergyHistory" :loading="historyLoading">
                Załaduj dane
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:progress-clock" width="24" />
              <h3>Prognoza kosztów</h3>
            </div>
          </template>
          
          <div class="forecast" v-if="!dataUnavailable">
            <div class="forecast-item">
              <span>Dzisiejszy koszt:</span>
              <span class="forecast-value">{{ todayCost }} zł</span>
            </div>
            <div class="forecast-item">
              <span>Miesięczny koszt:</span>
              <span class="forecast-value">{{ monthlyCost }} zł</span>
            </div>
            <div class="forecast-item">
              <span>Roczny koszt:</span>
              <span class="forecast-value">{{ yearlyCost }} zł</span>
            </div>
            
            <el-divider />
            
            <div class="energy-rate">
              <h4>Stawka energii</h4>
              <div class="rate-controls">
                <el-input-number
                  v-model="energyRate"
                  :min="0.1"
                  :max="2"
                  :step="0.01"
                  size="small"
                  :disabled="dataUnavailable"
                />
                <span>zł/kWh</span>
              </div>
              <el-button 
                size="small" 
                @click="saveEnergyRate"
                :disabled="dataUnavailable"
                style="margin-top: 10px;"
              >
                Zapisz stawkę
              </el-button>
            </div>
          </div>
          <div v-else class="forecast-unavailable">
            <icon icon="mdi:alert-circle" width="32" />
            <p>Prognoza niedostępna</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <icon icon="mdi:power-plug" width="24" />
          <h3>Zużycie per urządzenie</h3>
          <el-button 
            size="small" 
            @click="loadDeviceConsumption"
            :loading="devicesLoading"
          >
            <icon icon="mdi:refresh" width="16" />
          </el-button>
        </div>
      </template>

      <el-alert
        v-if="devicesUnavailable"
        title="Monitorowanie urządzeń niedostępne"
        type="info"
        description="Aby śledzić zużycie energii per urządzenie, zainstaluj narzędzia monitorujące takie jak powertop lub iotop."
        show-icon
        style="margin-bottom: 20px;"
      />

      <el-table :data="deviceConsumption" style="width: 100%" v-loading="devicesLoading" v-if="deviceConsumption.length > 0">
        <el-table-column prop="name" label="Urządzenie" />
        <el-table-column prop="power" label="Moc" width="100">
          <template #default="{ row }">
            {{ row.power }} W
          </template>
        </el-table-column>
        <el-table-column prop="daily" label="Dzienne" width="100">
          <template #default="{ row }">
            {{ row.daily }} kWh
          </template>
        </el-table-column>
        <el-table-column prop="monthly" label="Miesięczne" width="100">
          <template #default="{ row }">
            {{ row.monthly }} kWh
          </template>
        </el-table-column>
        <el-table-column label="Udział" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.percentage"
              :color="getPercentageColor(row.percentage)"
            />
          </template>
        </el-table-column>
      </el-table>
      
      <div v-else-if="!devicesLoading" class="no-devices">
        <icon icon="mdi:devices-off" width="48" />
        <p>Brak danych o zużyciu urządzeń</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const currentPower = ref(null)
const todayEnergy = ref(null)
const monthEnergy = ref(null)
const energyRate = ref(0.85)
const deviceConsumption = ref([])
const energyHistory = ref([])
const lastUpdate = ref(null)
const dataUnavailable = ref(false)
const devicesUnavailable = ref(false)

const devicesLoading = ref(false)
const historyLoading = ref(false)

const todayCost = computed(() => {
  if (todayEnergy.value === null) return '--'
  return (todayEnergy.value * energyRate.value).toFixed(2)
})

const monthlyCost = computed(() => {
  if (monthEnergy.value === null) return '--'
  return (monthEnergy.value * energyRate.value).toFixed(2)
})

const yearlyCost = computed(() => {
  if (monthEnergy.value === null) return '--'
  return (monthEnergy.value * 12 * energyRate.value).toFixed(2)
})

const getPercentageColor = (percentage) => {
  if (percentage > 40) return '#e6a23c'
  if (percentage > 20) return '#409eff'
  return '#67c23a'
}

const loadEnergyData = async () => {
  try {
    const response = await axios.get('/energy/status')
    const data = response.data.status
    
    if (data.available === false) {
      dataUnavailable.value = true
      return
    }
    
    currentPower.value = data.currentPower
    todayEnergy.value = parseFloat(data.todayEnergy)
    monthEnergy.value = parseFloat(data.monthEnergy)
    lastUpdate.value = new Date().toLocaleTimeString()
    dataUnavailable.value = false
    
  } catch (error) {
    console.error('Błąd podczas ładowania danych energii:', error)
    dataUnavailable.value = true
    ElMessage.warning('System monitorowania energii niedostępny')
  }
}

const loadEnergyHistory = async () => {
  historyLoading.value = true
  try {
    const response = await axios.get('/energy/history')
    energyHistory.value = response.data.history || []
  } catch (error) {
    console.error('Błąd podczas ładowania historii energii:', error)
    energyHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

const loadDeviceConsumption = async () => {
  devicesLoading.value = true
  try {
    const response = await axios.get('/energy/devices')
    
    if (response.data.available === false) {
      devicesUnavailable.value = true
      deviceConsumption.value = []
    } else {
      devicesUnavailable.value = false
      deviceConsumption.value = response.data.devices || []
    }
  } catch (error) {
    console.error('Błąd podczas ładowania zużycia urządzeń:', error)
    devicesUnavailable.value = true
    deviceConsumption.value = []
  } finally {
    devicesLoading.value = false
  }
}

const saveEnergyRate = async () => {
  try {
    await axios.post('/energy/rate', { rate: energyRate.value })
    ElMessage.success('Stawka energii zapisana')
  } catch (error) {
    console.error('Błąd podczas zapisywania stawki energii:', error)
    ElMessage.error('Nie udało się zapisać stawki energii')
  }
}

const loadStoredEnergyRate = () => {
  const storedRate = localStorage.getItem('energyRate')
  if (storedRate) {
    energyRate.value = parseFloat(storedRate)
  }
}

let updateInterval

onMounted(() => {
  loadStoredEnergyRate()
  loadEnergyData()
  loadDeviceConsumption()
  loadEnergyHistory()
  
  // Aktualizuj dane co 30 sekund
  updateInterval = setInterval(() => {
    loadEnergyData()
  }, 30000)
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
.energy-monitoring {
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

.stat-card {
  margin-bottom: 0;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  padding: 15px;
  border-radius: 10px;
}

.stat-icon.current { background: #f0f9ff; color: #409eff; }
.stat-icon.today { background: #f0f9eb; color: #67c23a; }
.stat-icon.month { background: #fdf6ec; color: #e6a23c; }
.stat-icon.cost { background: #f9f0ff; color: #9254de; }

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.stat-timestamp {
  font-size: 0.7rem;
  color: var(--el-text-color-secondary);
  margin-top: 5px;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-placeholder {
  text-align: center;
  color: var(--el-text-color-secondary);
}

.chart-placeholder p {
  margin-top: 10px;
}

.history-stats {
  margin-top: 15px;
  font-size: 0.9rem;
}

.history-stats div {
  margin: 5px 0;
}

.forecast {
  padding: 10px 0;
}

.forecast-item {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
  font-size: 0.95rem;
}

.forecast-value {
  font-weight: bold;
  color: var(--el-color-primary);
}

.energy-rate {
  margin-top: 15px;
}

.energy-rate h4 {
  margin: 0 0 10px 0;
  font-size: 1rem;
}

.rate-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.forecast-unavailable {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-secondary);
}

.forecast-unavailable p {
  margin-top: 10px;
}

.no-devices {
  text-align: center;
  padding: 40px 0;
  color: var(--el-text-color-secondary);
}

.no-devices p {
  margin-top: 10px;
}
</style>
