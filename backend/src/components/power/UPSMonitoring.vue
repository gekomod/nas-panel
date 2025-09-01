<template>
  <div class="ups-monitoring">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:car-battery" width="24" />
              <h3>Status UPS</h3>
            </div>
          </template>

          <div class="status-card">
            <div class="status-indicator" :class="upsStatus.status">
              <icon :icon="getStatusIcon(upsStatus.status)" width="48" />
            </div>
            <div class="status-info">
              <h4>{{ getStatusLabel(upsStatus.status) }}</h4>
              <p>Bateria: {{ upsStatus.battery }}%</p>
              <p>Czas pracy: {{ upsStatus.runtime }} min</p>
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
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:cog" width="24" />
              <h3>Konfiguracja</h3>
            </div>
          </template>

          <el-form :model="config" label-width="120px">
            <el-form-item label="Typ UPS">
              <el-select v-model="config.type">
                <el-option value="usb">USB</el-option>
                <el-option value="network">Sieciowy</el-option>
                <el-option value="serial">Szeregowy</el-option>
              </el-select>
            </el-form-item>
            
            <el-form-item label="Auto wyłączanie">
              <el-switch v-model="config.autoShutdown" />
            </el-form-item>
            
            <el-form-item label="Próg baterii" v-if="config.autoShutdown">
              <el-slider v-model="config.shutdownLevel" :min="5" :max="50" />
              <span>{{ config.shutdownLevel }}%</span>
            </el-form-item>
            
            <el-form-item label="Powiadomienia">
              <el-switch v-model="config.notifications" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="saveConfig">
                <icon icon="mdi:content-save" width="16" />
                Zapisz konfigurację
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <icon icon="mdi:history" width="24" />
          <h3>Historia zdarzeń</h3>
        </div>
      </template>

      <el-table :data="events" style="width: 100%">
        <el-table-column prop="timestamp" label="Data" width="160" />
        <el-table-column prop="event" label="Zdarzenie" />
        <el-table-column prop="battery" label="Bateria" width="80" />
        <el-table-column prop="runtime" label="Czas pracy" width="100" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'

const upsStatus = reactive({
  status: 'online', // online, battery, lowbattery, charging
  battery: 85,
  runtime: 45,
  voltage: 230,
  load: 30
})

const config = reactive({
  type: 'usb',
  autoShutdown: true,
  shutdownLevel: 20,
  notifications: true
})

const events = ref([
  { timestamp: '2024-01-31 14:30', event: 'Zasilanie sieciowe przywrócone', battery: 85, runtime: 45 },
  { timestamp: '2024-01-31 14:25', event: 'Przejście na baterię', battery: 90, runtime: 60 },
  { timestamp: '2024-01-31 13:45', event: 'Test baterii zakończony', battery: 100, runtime: 0 }
])

const getStatusIcon = (status) => {
  const icons = {
    online: 'mdi:power-plug',
    battery: 'mdi:battery-70',
    lowbattery: 'mdi:battery-alert',
    charging: 'mdi:battery-charging-70'
  }
  return icons[status] || 'mdi:alert-circle'
}

const getStatusLabel = (status) => {
  const labels = {
    online: 'Podłączony do sieci',
    battery: 'Praca na baterii',
    lowbattery: 'Niski poziom baterii',
    charging: 'Ładowanie'
  }
  return labels[status] || status
}

const getBatteryLevelClass = (level) => {
  if (level > 70) return 'high'
  if (level > 30) return 'medium'
  return 'low'
}

const saveConfig = () => {
  ElMessage.success('Konfiguracja UPS zapisana')
}

// Symulacja aktualizacji statusu
onMounted(() => {
  setInterval(() => {
    if (upsStatus.status === 'online' && Math.random() > 0.8) {
      upsStatus.status = 'battery'
      events.value.unshift({
        timestamp: new Date().toLocaleString(),
        event: 'Przejście na baterię',
        battery: upsStatus.battery,
        runtime: upsStatus.runtime
      })
    } else if (upsStatus.status === 'battery' && Math.random() > 0.7) {
      upsStatus.status = 'online'
      events.value.unshift({
        timestamp: new Date().toLocaleString(),
        event: 'Zasilanie sieciowe przywrócone',
        battery: upsStatus.battery,
        runtime: upsStatus.runtime
      })
    }
    
    if (upsStatus.status === 'battery') {
      upsStatus.battery = Math.max(5, upsStatus.battery - 1)
      upsStatus.runtime = Math.max(0, upsStatus.runtime - 1)
      
      if (upsStatus.battery <= 20 && upsStatus.status !== 'lowbattery') {
        upsStatus.status = 'lowbattery'
        events.value.unshift({
          timestamp: new Date().toLocaleString(),
          event: 'Niski poziom baterii',
          battery: upsStatus.battery,
          runtime: upsStatus.runtime
        })
      }
    }
  }, 5000)
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
</style>
