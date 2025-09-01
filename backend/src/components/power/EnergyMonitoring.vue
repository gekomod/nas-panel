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
              <div class="stat-value">{{ currentPower }} W</div>
              <div class="stat-label">Bieżące zużycie</div>
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
              <div class="stat-value">{{ todayEnergy }} kWh</div>
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
              <div class="stat-value">{{ monthEnergy }} kWh</div>
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
              <div class="stat-value">{{ monthlyCost }} zł</div>
              <div class="stat-label">Koszt miesięczny</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:chart-line" width="24" />
              <h3>Zużycie energii - 24h</h3>
            </div>
          </template>
          <div class="chart-container">
            <div class="chart-placeholder">
              <icon icon="mdi:chart-areaspline" width="64" />
              <p>Wykres zużycia energii</p>
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
          
          <div class="forecast">
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
              <el-input-number
                v-model="energyRate"
                :min="0.1"
                :max="2"
                :step="0.01"
                size="small"
              />
              <span>zł/kWh</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <icon icon="mdi:power-plug" width="24" />
          <h3>Zużycie per urządzenie</h3>
        </div>
      </template>

      <el-table :data="deviceConsumption" style="width: 100%">
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
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const currentPower = ref(125)
const todayEnergy = ref(2.8)
const monthEnergy = ref(42.5)
const energyRate = ref(0.85)

const deviceConsumption = ref([
  { name: 'Serwer główny', power: 85, daily: 1.2, monthly: 18.5, percentage: 43 },
  { name: 'Dyskowa macierz', power: 25, daily: 0.6, monthly: 9.2, percentage: 22 },
  { name: 'Switch sieciowy', power: 8, daily: 0.2, monthly: 3.1, percentage: 7 },
  { name: 'Router', power: 5, daily: 0.1, monthly: 1.5, percentage: 4 },
  { name: 'Inne urządzenia', power: 12, daily: 0.3, monthly: 4.8, percentage: 11 }
])

const todayCost = computed(() => (todayEnergy.value * energyRate.value).toFixed(2))
const monthlyCost = computed(() => (monthEnergy.value * energyRate.value).toFixed(2))
const yearlyCost = computed(() => (monthEnergy.value * 12 * energyRate.value).toFixed(2))

const getPercentageColor = (percentage) => {
  if (percentage > 40) return '#e6a23c'
  if (percentage > 20) return '#409eff'
  return '#67c23a'
}

// Symulacja zmieniającego się zużycia energii
onMounted(() => {
  setInterval(() => {
    // Losowe wahania zużycia energii ±10W
    const fluctuation = (Math.random() - 0.5) * 20
    currentPower.value = Math.max(50, Math.min(200, currentPower.value + fluctuation))
    
    // Aktualizacja dziennego zużycia co godzinę
    if (new Date().getMinutes() === 0) {
      todayEnergy.value = (currentPower.value * 24 / 1000).toFixed(1)
    }
  }, 5000)
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

.energy-rate :deep(.el-input-number) {
  margin-right: 10px;
}
</style>
