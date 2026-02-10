<template>
  <div class="wake-on-lan">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:lan-connect" width="24" />
              <h3>Wake-on-LAN</h3>
            </div>
          </template>

          <el-form :model="form" label-width="140px" v-loading="configLoading">
            <el-form-item label="Włącz Wake-on-LAN">
              <el-switch v-model="form.enabled" />
            </el-form-item>
            
            <el-form-item label="Adres MAC">
              <el-input
                v-model="form.macAddress"
                placeholder="00:1A:2B:3C:4D:5E"
                :disabled="!form.enabled"
              />
            </el-form-item>
            
            <el-form-item label="Adres IP">
              <el-input
                v-model="form.ipAddress"
                placeholder="192.168.1.100"
                :disabled="!form.enabled"
              />
            </el-form-item>
            
            <el-form-item label="Port">
              <el-input-number
                v-model="form.port"
                :min="1"
                :max="65535"
                :disabled="!form.enabled"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                :disabled="!form.enabled"
                @click="saveSettings"
                :loading="savingConfig"
              >
                <icon icon="mdi:content-save" width="16" />
                Zapisz ustawienia
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <icon icon="mdi:devices" width="24" />
              <h3>Zapisane urządzenia</h3>
            </div>
          </template>

          <el-table :data="devices" style="width: 100%" v-loading="devicesLoading">
            <el-table-column prop="name" label="Nazwa" />
            <el-table-column prop="mac" label="MAC" width="140" />
            <el-table-column label="Operacje" width="120">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="success"
                  @click="wakeDevice(row)"
                >
                  <icon icon="mdi:power" width="14" />
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  @click="deleteDevice(row)"
                >
                  <icon icon="mdi:delete" width="14" />
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-button
            type="primary"
            class="add-button"
            @click="showAddDevice = true"
          >
            <icon icon="mdi:plus" width="16" />
            Dodaj urządzenie
          </el-button>
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialog dodawania urządzenia -->
    <el-dialog v-model="showAddDevice" title="Dodaj urządzenie" width="400px">
      <el-form :model="deviceForm" label-width="100px">
        <el-form-item label="Nazwa">
          <el-input v-model="deviceForm.name" />
        </el-form-item>
        <el-form-item label="MAC">
          <el-input v-model="deviceForm.mac" placeholder="00:1A:2B:3C:4D:5E" />
        </el-form-item>
        <el-form-item label="IP">
          <el-input v-model="deviceForm.ip" placeholder="192.168.1.100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDevice = false">Anuluj</el-button>
        <el-button type="primary" @click="addDevice">Dodaj</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const form = reactive({
  enabled: true,
  macAddress: '00:1A:2B:3C:4D:5E',
  ipAddress: '192.168.1.255',
  port: 9
})

const showAddDevice = ref(false)
const deviceForm = reactive({
  name: '',
  mac: '',
  ip: ''
})

const devices = ref([])
const configLoading = ref(false)
const devicesLoading = ref(false)
const savingConfig = ref(false)

const loadConfig = async () => {
  configLoading.value = true
  try {
    const response = await axios.get('/wakeonlan/config')
    Object.assign(form, response.data.config)
  } catch (error) {
    console.error('Błąd podczas ładowania konfiguracji Wake-on-LAN:', error)
    ElMessage.error('Nie udało się załadować konfiguracji Wake-on-LAN')
  } finally {
    configLoading.value = false
  }
}

const loadDevices = async () => {
  devicesLoading.value = true
  try {
    const response = await axios.get('/wakeonlan/devices')
    devices.value = response.data.devices
  } catch (error) {
    console.error('Błąd podczas ładowania urządzeń Wake-on-LAN:', error)
    ElMessage.error('Nie udało się załadować urządzeń Wake-on-LAN')
  } finally {
    devicesLoading.value = false
  }
}

const saveSettings = async () => {
  savingConfig.value = true
  try {
    await axios.post('/wakeonlan/config', { config: form })
    ElMessage.success('Ustawienia Wake-on-LAN zapisane')
  } catch (error) {
    console.error('Błąd podczas zapisywania konfiguracji Wake-on-LAN:', error)
    ElMessage.error('Nie udało się zapisać konfiguracji Wake-on-LAN')
  } finally {
    savingConfig.value = false
  }
}

const wakeDevice = async (device) => {
  try {
    await axios.post('/wakeonlan/wake', {
      mac: device.mac,
      ip: device.ip || form.ipAddress,
      port: form.port
    })
    ElMessage.success(`Wysyłanie pakietu Wake-on-LAN do ${device.name}`)
  } catch (error) {
    console.error('Błąd podczas wysyłania pakietu Wake-on-LAN:', error)
    ElMessage.error('Nie udało się wysłać pakietu Wake-on-LAN')
  }
}

const addDevice = async () => {
  if (deviceForm.name && deviceForm.mac) {
    try {
      const response = await axios.post('/wakeonlan/devices', { device: deviceForm })
      devices.value.push({
        id: response.data.id,
        ...deviceForm
      })
      ElMessage.success('Urządzenie dodane')
      showAddDevice.value = false
      Object.assign(deviceForm, { name: '', mac: '', ip: '' })
    } catch (error) {
      console.error('Błąd podczas dodawania urządzenia:', error)
      ElMessage.error('Nie udało się dodać urządzenia')
    }
  } else {
    ElMessage.warning('Wypełnij nazwę i adres MAC')
  }
}

const deleteDevice = async (device) => {
  try {
    await axios.delete(`/wakeonlan/devices/${device.id}`)
    devices.value = devices.value.filter(d => d.id !== device.id)
    ElMessage.success('Urządzenie usunięte')
  } catch (error) {
    console.error('Błąd podczas usuwania urządzenia:', error)
    ElMessage.error('Nie udało się usunąć urządzenia')
  }
}

onMounted(() => {
  loadConfig()
  loadDevices()
})
</script>

<style scoped>
.wake-on-lan {
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

.add-button {
  margin-top: 15px;
  width: 100%;
}
</style>
