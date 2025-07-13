<template>
  <div class="vpn-container">
    <el-card class="vpn-card">
      <template #header>
        <div class="card-header">
          <h3>VPN Configuration</h3>
        </div>
      </template>

      <el-tabs type="border-card">
        <el-tab-pane label="OpenVPN">
          <el-form label-position="top">
            <el-form-item label="Enable OpenVPN">
              <el-switch v-model="openVpnEnabled" />
            </el-form-item>

            <el-form-item label="Configuration File">
              <el-upload
                action=""
                :auto-upload="false"
                :on-change="handleConfigUpload"
                :show-file-list="false"
              >
                <el-button type="primary">Upload Config</el-button>
              </el-upload>
              <div v-if="openVpnConfig" class="config-info">
                <p>Loaded config: {{ openVpnConfig.name }}</p>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                :disabled="!openVpnConfig"
                @click="startOpenVpn"
              >
                Start OpenVPN
              </el-button>
              <el-button 
                type="danger" 
                :disabled="!openVpnRunning"
                @click="stopOpenVpn"
              >
                Stop OpenVPN
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="WireGuard">
          <el-form label-position="top">
            <el-form-item label="Enable WireGuard">
              <el-switch v-model="wireGuardEnabled" />
            </el-form-item>

            <el-form-item label="Interface Configuration">
              <el-input
                v-model="wireGuardConfig"
                type="textarea"
                :rows="6"
                placeholder="Enter WireGuard configuration..."
              />
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                :disabled="!wireGuardConfig"
                @click="applyWireGuardConfig"
              >
                Apply Configuration
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="status-section" v-if="vpnStatus">
        <h4>Connection Status</h4>
        <el-table :data="vpnStatus" style="width: 100%">
          <el-table-column prop="name" label="VPN Type" />
          <el-table-column prop="status" label="Status">
            <template #default="{ row }">
              <el-tag :type="row.status === 'Connected' ? 'success' : 'danger'">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="address" label="IP Address" />
          <el-table-column prop="uptime" label="Uptime" />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const openVpnEnabled = ref(false)
const wireGuardEnabled = ref(false)
const openVpnConfig = ref(null)
const wireGuardConfig = ref('')
const openVpnRunning = ref(false)
const vpnStatus = ref([
  { name: 'OpenVPN', status: 'Disconnected', address: '-', uptime: '-' },
  { name: 'WireGuard', status: 'Disconnected', address: '-', uptime: '-' }
])

const handleConfigUpload = (file) => {
  openVpnConfig.value = file
}

const startOpenVpn = () => {
  openVpnRunning.value = true
  vpnStatus.value[0].status = 'Connected'
  vpnStatus.value[0].address = '10.8.0.1'
  vpnStatus.value[0].uptime = '00:05:23'
}

const stopOpenVpn = () => {
  openVpnRunning.value = false
  vpnStatus.value[0].status = 'Disconnected'
  vpnStatus.value[0].address = '-'
  vpnStatus.value[0].uptime = '-'
}

const applyWireGuardConfig = () => {
  if (wireGuardConfig.value) {
    vpnStatus.value[1].status = 'Connected'
    vpnStatus.value[1].address = '10.0.0.1'
    vpnStatus.value[1].uptime = '01:15:42'
  }
}
</script>

<style scoped>
.vpn-container {
  padding: 20px;
}

.vpn-card {
  height: 100%;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-section {
  margin-top: 30px;
}

.config-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
