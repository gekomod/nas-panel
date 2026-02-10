<template>
  <div class="vpn-container" :class="{ 'dark-mode': isDarkMode }">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:vpn" />
          </div>
          <div class="header-text">
            <h1>VPN Configuration</h1>
            <p class="subtitle">Manage VPN connections and secure your network traffic</p>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat-item">
            <div class="stat-icon active">
              <Icon icon="mdi:connection" />
            </div>
            <div class="stat-info">
              <h3>{{ overview?.statistics?.activeConnections || 0 }}</h3>
              <p>Active Connections</p>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon total">
              <Icon icon="mdi:server-network" />
            </div>
            <div class="stat-info">
              <h3>{{ totalConfigs }}</h3>
              <p>Total Configs</p>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <div class="vpn-content">
      <!-- VPN Tabs -->
      <el-card class="vpn-card" shadow="hover">
        <el-tabs v-model="activeTab" type="card" class="vpn-tabs" @tab-click="handleTabChange">
          <!-- OpenVPN Tab -->
          <el-tab-pane name="openvpn">
            <template #label>
              <span class="tab-label">
                <Icon icon="mdi:lock-outline" />
                OpenVPN
                <el-badge :value="openVpnConfigs.length" :max="99" class="tab-badge" />
              </span>
            </template>

            <div class="tab-content">
              <div class="vpn-actions">
                <el-button 
                  type="primary" 
                  @click="showOpenVpnDialog = true"
                  class="add-button"
                >
                  <Icon icon="mdi:plus" />
                  Add OpenVPN Config
                </el-button>
                <el-button 
                  type="info" 
                  @click="fetchOpenVPNConfigs"
                  :loading="loading.openvpn"
                >
                  <Icon icon="mdi:refresh" />
                  Refresh Status
                </el-button>
              </div>

              <el-alert 
                v-if="openVpnConfigs.length === 0 && !loading.openvpn" 
                type="info" 
                title="No OpenVPN Configurations"
                :closable="false"
                class="empty-alert"
              >
                <template #icon>
                  <Icon icon="mdi:information" />
                </template>
                <p>No OpenVPN configurations found. Add your first configuration to get started.</p>
              </el-alert>

              <div v-else class="configs-grid">
                <el-card 
                  v-for="config in openVpnConfigs" 
                  :key="config.id"
                  class="config-card"
                  :class="{ 'active': config.active }"
                  shadow="hover"
                >
                  <template #header>
                    <div class="config-card-header">
                      <div class="config-title">
                        <Icon icon="mdi:lock" />
                        <h4>{{ config.name }}</h4>
                        <el-tag 
                          :type="config.active ? 'success' : 'info'" 
                          size="small"
                          effect="dark"
                        >
                          {{ config.active ? 'Active' : 'Inactive' }}
                        </el-tag>
                      </div>
                      <div class="config-actions">
                        <el-button 
                          v-if="!config.active"
                          type="success" 
                          size="small" 
                          circle
                          @click="startOpenVPN(config.id)"
                          :loading="config.loading"
                        >
                          <el-icon><Icon icon="mdi:play" /></el-icon>
                        </el-button>
                        <el-button 
                          v-else
                          type="danger" 
                          size="small" 
                          circle
                          @click="stopOpenVPN(config.id)"
                          :loading="config.loading"
                        >
                          <el-icon><Icon icon="mdi:stop" /></el-icon>
                        </el-button>
                        <el-button 
                          type="warning" 
                          size="small" 
                          circle
                          @click="editOpenVpnConfig(config)"
                        >
                          <el-icon><Icon icon="mdi:pencil" /></el-icon>
                        </el-button>
                        <el-button 
                          type="danger" 
                          size="small" 
                          circle
                          @click="deleteOpenVpnConfig(config)"
                        >
                          <el-icon><Icon icon="mdi:delete" /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </template>

                  <div class="config-info">
                    <div class="info-row">
                      <Icon icon="mdi:server" />
                      <span class="label">Server:</span>
                      <span class="value">{{ config.server }}</span>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:account" />
                      <span class="label">Username:</span>
                      <span class="value">{{ config.username }}</span>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:port" />
                      <span class="label">Port:</span>
                      <span class="value">{{ config.port }}</span>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:protocol" />
                      <span class="label">Protocol:</span>
                      <span class="value">{{ config.protocol }}</span>
                    </div>
                    <div v-if="config.uptime" class="info-row">
                      <Icon icon="mdi:timer" />
                      <span class="label">Uptime:</span>
                      <span class="value">{{ config.uptime }}</span>
                    </div>
                  </div>
                </el-card>
              </div>
            </div>
          </el-tab-pane>

          <!-- WireGuard Tab -->
          <el-tab-pane name="wireguard">
            <template #label>
              <span class="tab-label">
                <Icon icon="mdi:tunnel" />
                WireGuard
                <el-badge :value="wireGuardConfigs.length" :max="99" class="tab-badge" />
              </span>
            </template>

            <div class="tab-content">
              <div class="vpn-actions">
                <div class="action-group">
                  <el-button 
                    type="primary" 
                    @click="showWireGuardDialog = true"
                    class="add-button"
                  >
                    <Icon icon="mdi:plus" />
                    Add WireGuard Config
                  </el-button>
                  <el-button 
                    type="success" 
                    @click="generateWireGuardKeys"
                    :loading="generatingKeys"
                  >
                    <Icon icon="mdi:key-variant" />
                    Generate Keys
                  </el-button>
                </div>
                <el-button 
                  type="info" 
                  @click="fetchWireGuardConfigs"
                  :loading="loading.wireguard"
                >
                  <Icon icon="mdi:refresh" />
                  Refresh Status
                </el-button>
              </div>

              <el-alert 
                v-if="wireGuardConfigs.length === 0 && !loading.wireguard" 
                type="info" 
                title="No WireGuard Configurations"
                :closable="false"
                class="empty-alert"
              >
                <template #icon>
                  <Icon icon="mdi:information" />
                </template>
                <p>No WireGuard configurations found. Add your first configuration to get started.</p>
              </el-alert>

              <div v-else class="configs-grid">
                <el-card 
                  v-for="config in wireGuardConfigs" 
                  :key="config.interface"
                  class="config-card"
                  :class="{ 'active': config.peers && config.peers.length > 0 }"
                  shadow="hover"
                >
                  <template #header>
                    <div class="config-card-header">
                      <div class="config-title">
                        <Icon icon="mdi:tunnel" />
                        <h4>{{ config.interface }}</h4>
                        <el-tag 
                          :type="config.peers?.length > 0 ? 'success' : 'info'" 
                          size="small"
                          effect="dark"
                        >
                          {{ config.peers?.length > 0 ? 'Active' : 'Inactive' }}
                        </el-tag>
                      </div>
                      <div class="config-actions">
                        <el-button 
                          v-if="!config.active"
                          type="success" 
                          size="small" 
                          circle
                          @click="startWireGuard(config.interface)"
                          :loading="config.loading"
                        >
                          <el-icon><Icon icon="mdi:play" /></el-icon>
                        </el-button>
                        <el-button 
                          v-else
                          type="danger" 
                          size="small" 
                          circle
                          @click="stopWireGuard(config.interface)"
                          :loading="config.loading"
                        >
                          <el-icon><Icon icon="mdi:stop" /></el-icon>
                        </el-button>
                        <el-button 
                          type="warning" 
                          size="small" 
                          circle
                          @click="editWireGuardConfig(config)"
                        >
                          <el-icon><Icon icon="mdi:pencil" /></el-icon>
                        </el-button>
                        <el-button 
                          type="danger" 
                          size="small" 
                          circle
                          @click="deleteWireGuardConfig(config)"
                        >
                          <el-icon><Icon icon="mdi:delete" /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </template>

                  <div class="config-info">
                    <div class="info-row">
                      <Icon icon="mdi:server" />
                      <span class="label">Interface:</span>
                      <span class="value">{{ config.interface }}</span>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:ip" />
                      <span class="label">Address:</span>
                      <span class="value">{{ config.address || 'Not configured' }}</span>
                    </div>
                    <div class="info-row" v-if="config.publicKey">
                      <Icon icon="mdi:key" />
                      <span class="label">Public Key:</span>
                      <el-tooltip :content="config.publicKey">
                        <span class="value truncated">{{ config.publicKey.substring(0, 20) }}...</span>
                      </el-tooltip>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:account-group" />
                      <span class="label">Peers:</span>
                      <span class="value">{{ config.peers?.length || 0 }}</span>
                    </div>
                    <div class="info-row">
                      <Icon icon="mdi:port" />
                      <span class="label">Port:</span>
                      <span class="value">{{ config.listenPort || '51820' }}</span>
                    </div>
                  </div>
                </el-card>
              </div>
            </div>
          </el-tab-pane>

          <!-- IPSec/L2TP Tab -->
          <el-tab-pane name="ipsec">
            <template #label>
              <span class="tab-label">
                <Icon icon="mdi:shield-lock-outline" />
                IPSec/L2TP
              </span>
            </template>

            <div class="tab-content">
              <el-form :model="ipsecConfig" label-position="top">
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="IPSec Status">
                      <el-tag :type="ipsecStatus?.running ? 'success' : 'danger'" size="large" effect="dark">
                        {{ ipsecStatus?.running ? 'Running' : 'Stopped' }}
                      </el-tag>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="Active Connections">
                      <span class="connection-count">{{ ipsecStatus?.connections || 0 }}</span>
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-form-item label="Pre-shared Key (PSK)" prop="psk">
                  <el-input 
                    v-model="ipsecConfig.psk" 
                    type="password"
                    show-password
                    placeholder="Enter pre-shared key"
                  />
                </el-form-item>

                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="Username" prop="username">
                      <el-input v-model="ipsecConfig.username" placeholder="VPN username" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="Password" prop="password">
                      <el-input 
                        v-model="ipsecConfig.password" 
                        type="password"
                        show-password
                        placeholder="VPN password"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-form-item>
                  <el-button 
                    type="primary" 
                    @click="saveIpsecConfig"
                    :loading="loading.ipsec"
                  >
                    <Icon icon="mdi:content-save" />
                    Save Configuration
                  </el-button>
                  <el-button 
                    type="success" 
                    @click="startIpsec"
                    :disabled="!ipsecConfig.enabled"
                    :loading="startingIpsec"
                  >
                    <Icon icon="mdi:play" />
                    Start IPSec
                  </el-button>
                  <el-button 
                    type="danger" 
                    @click="stopIpsec"
                    :disabled="!ipsecStatus?.running"
                    :loading="stoppingIpsec"
                  >
                    <Icon icon="mdi:stop" />
                    Stop IPSec
                  </el-button>
                  <el-button 
                    type="info" 
                    @click="fetchIPSecStatus"
                    :loading="loading.ipsec"
                  >
                    <Icon icon="mdi:refresh" />
                    Refresh
                  </el-button>
                </el-form-item>
              </el-form>

              <el-alert 
                v-if="!ipsecStatus?.enabled" 
                type="warning" 
                title="IPSec/L2TP is not configured"
                :closable="false"
                class="info-alert"
              >
                <template #icon>
                  <Icon icon="mdi:alert" />
                </template>
                <p>Configure IPSec/L2TP settings and save to enable the VPN server.</p>
              </el-alert>
            </div>
          </el-tab-pane>

          <!-- Statistics Tab -->
          <el-tab-pane name="stats">
            <template #label>
              <span class="tab-label">
                <Icon icon="mdi:chart-box" />
                Statistics
              </span>
            </template>

            <div class="tab-content">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-card shadow="never" class="stat-card">
                    <template #header>
                      <div class="stat-card-header">
                        <Icon icon="mdi:chart-pie" />
                        <span>Connection Overview</span>
                      </div>
                    </template>
                    <el-descriptions :column="1" border>
                      <el-descriptions-item label="Total Configurations">
                        <el-tag type="info">{{ totalConfigs }}</el-tag>
                      </el-descriptions-item>
                      <el-descriptions-item label="Active Connections">
                        <el-tag type="success">{{ overview?.statistics?.activeConnections || 0 }}</el-tag>
                      </el-descriptions-item>
                      <el-descriptions-item label="Data Transferred">
                        <span class="data-value">{{ formatBytes(overview?.statistics?.totalBytes || 0) }}</span>
                      </el-descriptions-item>
                      <el-descriptions-item label="Last Connection">
                        {{ formatDate(overview?.statistics?.lastConnection) || 'Never' }}
                      </el-descriptions-item>
                    </el-descriptions>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card shadow="never" class="stat-card">
                    <template #header>
                      <div class="stat-card-header">
                        <Icon icon="mdi:connection" />
                        <span>Protocol Distribution</span>
                      </div>
                    </template>
                    <div class="protocol-stats">
                      <div class="protocol-item">
                        <Icon icon="mdi:lock" class="protocol-icon openvpn" />
                        <div class="protocol-info">
                          <span class="protocol-name">OpenVPN</span>
                          <span class="protocol-count">{{ overview?.openvpn?.configs || 0 }} configs</span>
                        </div>
                        <span class="protocol-active">{{ overview?.openvpn?.active ? 'Active' : 'Inactive' }}</span>
                      </div>
                      <div class="protocol-item">
                        <Icon icon="mdi:tunnel" class="protocol-icon wireguard" />
                        <div class="protocol-info">
                          <span class="protocol-name">WireGuard</span>
                          <span class="protocol-count">{{ overview?.wireguard?.configs || 0 }} configs</span>
                        </div>
                        <span class="protocol-active">{{ overview?.wireguard?.active ? 'Active' : 'Inactive' }}</span>
                      </div>
                      <div class="protocol-item">
                        <Icon icon="mdi:shield-lock" class="protocol-icon ipsec" />
                        <div class="protocol-info">
                          <span class="protocol-name">IPSec</span>
                          <span class="protocol-count">{{ ipsecStatus?.enabled ? '1 config' : 'Not configured' }}</span>
                        </div>
                        <span class="protocol-active">{{ ipsecStatus?.running ? 'Active' : 'Inactive' }}</span>
                      </div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- Status Panel -->
      <el-card class="status-card" shadow="hover">
        <template #header>
          <div class="status-header">
            <h3>
              <Icon icon="mdi:connection" />
              Connection Status
            </h3>
            <el-button 
              size="small" 
              @click="fetchConnections"
              :loading="loading.connections"
            >
              <Icon icon="mdi:refresh" />
              Refresh All
            </el-button>
          </div>
        </template>

        <el-table 
          :data="connections" 
          style="width: 100%"
          v-loading="loading.connections"
          empty-text="No active VPN connections"
        >
          <el-table-column label="VPN Type" width="120">
            <template #default="{ row }">
              <div class="vpn-type">
                <Icon :icon="getVpnIcon(row.type)" />
                {{ row.type }}
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="Configuration" />
          <el-table-column label="Status" width="120">
            <template #default="{ row }">
              <el-tag 
                :type="row.status === 'Connected' ? 'success' : 'danger'" 
                effect="dark"
                class="status-tag"
              >
                <Icon :icon="row.status === 'Connected' ? 'mdi:check-circle' : 'mdi:close-circle'" />
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP Address" width="140" />
          <el-table-column prop="uptime" label="Uptime" width="100" />
          <el-table-column label="Data Transferred" width="140">
            <template #default="{ row }">
              {{ formatBytes(row.bytes) }}
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="120">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'Connected'"
                type="danger" 
                size="small"
                @click="stopConnection(row)"
                :loading="row.loading"
              >
                <Icon icon="mdi:stop" />
                Stop
              </el-button>
              <el-button 
                v-else
                type="success" 
                size="small"
                @click="startConnection(row)"
                :loading="row.loading"
              >
                <Icon icon="mdi:play" />
                Start
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- OpenVPN Dialog -->
    <el-dialog
      v-model="showOpenVpnDialog"
      :title="editingOpenVpn ? 'Edit OpenVPN Config' : 'Add OpenVPN Config'"
      width="600px"
      @closed="resetOpenVpnForm"
    >
      <el-form :model="newOpenVpnConfig" :rules="openVpnRules" ref="openVpnForm" label-width="120px">
        <el-form-item label="Config Name" prop="name">
          <el-input v-model="newOpenVpnConfig.name" placeholder="My VPN Connection" />
        </el-form-item>
        <el-form-item label="Server Address" prop="server">
          <el-input v-model="newOpenVpnConfig.server" placeholder="vpn.example.com" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Port" prop="port">
              <el-input-number v-model="newOpenVpnConfig.port" :min="1" :max="65535" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Protocol" prop="protocol">
              <el-select v-model="newOpenVpnConfig.protocol">
                <el-option label="UDP" value="udp" />
                <el-option label="TCP" value="tcp" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Username" prop="username">
          <el-input v-model="newOpenVpnConfig.username" placeholder="vpnuser" />
        </el-form-item>
        <el-form-item label="Password" prop="password">
          <el-input v-model="newOpenVpnConfig.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="Config File (Optional)">
          <el-input 
            v-model="newOpenVpnConfig.config" 
            type="textarea" 
            :rows="6"
            placeholder="Paste OpenVPN configuration here, or fill fields above"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOpenVpnDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveOpenVpnConfig" :loading="saving.openvpn">
          {{ editingOpenVpn ? 'Update' : 'Save' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- WireGuard Dialog -->
    <el-dialog
      v-model="showWireGuardDialog"
      :title="editingWireGuard ? 'Edit WireGuard Config' : 'Add WireGuard Config'"
      width="700px"
      @closed="resetWireGuardForm"
    >
      <el-form :model="newWireGuardConfig" :rules="wireGuardRules" ref="wireGuardForm" label-width="140px">
        <el-form-item label="Interface Name" prop="interface">
          <el-input v-model="newWireGuardConfig.interface" placeholder="wg0" />
        </el-form-item>
        <el-form-item label="IP Address" prop="address">
          <el-input v-model="newWireGuardConfig.address" placeholder="10.0.0.1/24" />
        </el-form-item>
        <el-form-item label="Listen Port" prop="listenPort">
          <el-input-number v-model="newWireGuardConfig.listenPort" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="Private Key" prop="privateKey">
          <el-input 
            v-model="newWireGuardConfig.privateKey" 
            type="textarea" 
            :rows="3"
            placeholder="Base64 encoded private key"
          />
          <div class="key-actions">
            <el-button size="small" @click="generateKeyPair" :loading="generatingKeys">
              <Icon icon="mdi:key-variant" />
              Generate New Keys
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="Peers">
          <div v-for="(peer, index) in newWireGuardConfig.peers" :key="index" class="peer-item">
            <el-input v-model="peer.publicKey" placeholder="Peer Public Key" style="margin-bottom: 8px;" />
            <el-input v-model="peer.allowedIPs" placeholder="Allowed IPs (e.g., 0.0.0.0/0)" />
            <el-button 
              type="danger" 
              size="small" 
              circle
              @click="removePeer(index)"
              style="margin-left: 8px;"
            >
              <Icon icon="mdi:delete" />
            </el-button>
          </div>
          <el-button @click="addPeer">
            <Icon icon="mdi:plus" />
            Add Peer
          </el-button>
        </el-form-item>
        <el-form-item label="Config File (Optional)">
          <el-input 
            v-model="newWireGuardConfig.config" 
            type="textarea" 
            :rows="8"
            placeholder="Paste full WireGuard configuration here, or fill fields above"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showWireGuardDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveWireGuardConfig" :loading="saving.wireguard">
          {{ editingWireGuard ? 'Update' : 'Save' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import axios from 'axios'

const { isDarkMode } = useTheme()

// State
const activeTab = ref('openvpn')
const loading = reactive({
  overview: false,
  openvpn: false,
  wireguard: false,
  ipsec: false,
  connections: false
})
const saving = reactive({
  openvpn: false,
  wireguard: false,
  ipsec: false
})
const generatingKeys = ref(false)
const startingIpsec = ref(false)
const stoppingIpsec = ref(false)
const showOpenVpnDialog = ref(false)
const showWireGuardDialog = ref(false)
const editingOpenVpn = ref(false)
const editingWireGuard = ref(false)

// Data
const overview = ref(null)
const openVpnConfigs = ref([])
const wireGuardConfigs = ref([])
const ipsecStatus = ref(null)
const ipsecConfig = reactive({
  psk: '',
  username: '',
  password: ''
})
const connections = ref([])

// Forms
const newOpenVpnConfig = reactive({
  id: '',
  name: '',
  server: '',
  port: 1194,
  protocol: 'udp',
  username: '',
  password: '',
  config: ''
})

const newWireGuardConfig = reactive({
  interface: 'wg0',
  address: '',
  listenPort: 51820,
  privateKey: '',
  publicKey: '',
  peers: [],
  config: ''
})

// Validation rules
const openVpnRules = {
  name: [{ required: true, message: 'Config name is required', trigger: 'blur' }],
  server: [{ required: true, message: 'Server address is required', trigger: 'blur' }]
}

const wireGuardRules = {
  interface: [{ required: true, message: 'Interface name is required', trigger: 'blur' }],
  address: [{ required: true, message: 'IP address is required', trigger: 'blur' }]
}

// Computed
const totalConfigs = computed(() => {
  return (overview.value?.openvpn?.configs || 0) + 
         (overview.value?.wireguard?.configs || 0) + 
         (ipsecStatus.value?.enabled ? 1 : 0)
})

// Methods
const fetchOverview = async () => {
  try {
    loading.overview = true
    const response = await axios.get('/api/vpn/overview')
    overview.value = response.data
  } catch (error) {
    ElMessage.error('Failed to fetch VPN overview')
  } finally {
    loading.overview = false
  }
}

const fetchOpenVPNConfigs = async () => {
  try {
    loading.openvpn = true
    const response = await axios.get('/api/vpn/openvpn')
    openVpnConfigs.value = response.data.map(config => ({
      ...config,
      loading: false
    }))
  } catch (error) {
    ElMessage.error('Failed to fetch OpenVPN configurations')
  } finally {
    loading.openvpn = false
  }
}

const fetchWireGuardConfigs = async () => {
  try {
    loading.wireguard = true
    const response = await axios.get('/api/vpn/wireguard')
    wireGuardConfigs.value = response.data.map(config => ({
      ...config,
      loading: false
    }))
  } catch (error) {
    ElMessage.error('Failed to fetch WireGuard configurations')
  } finally {
    loading.wireguard = false
  }
}

const fetchIPSecStatus = async () => {
  try {
    loading.ipsec = true
    const response = await axios.get('/api/vpn/ipsec')
    ipsecStatus.value = response.data.status
    // Try to parse PSK from config if available
    if (response.data.config?.secrets) {
      const pskMatch = response.data.config.secrets.match(/PSK\s+"([^"]+)"/)
      if (pskMatch) {
        ipsecConfig.psk = pskMatch[1]
      }
    }
  } catch (error) {
    ElMessage.error('Failed to fetch IPSec status')
  } finally {
    loading.ipsec = false
  }
}

const fetchConnections = async () => {
  try {
    loading.connections = true
    const response = await axios.get('/api/vpn/connections')
    connections.value = response.data.map(conn => ({
      ...conn,
      loading: false
    }))
  } catch (error) {
    ElMessage.error('Failed to fetch connections')
  } finally {
    loading.connections = false
  }
}

const startOpenVPN = async (id) => {
  try {
    const config = openVpnConfigs.value.find(c => c.id === id)
    if (config) config.loading = true
    
    await axios.post(`/api/vpn/openvpn/${id}/start`)
    ElMessage.success(`OpenVPN connection ${id} started`)
    
    // Refresh status
    await fetchOpenVPNConfigs()
  } catch (error) {
    ElMessage.error(`Failed to start OpenVPN: ${error.response?.data?.error || error.message}`)
  }
}

const stopOpenVPN = async (id) => {
  try {
    const config = openVpnConfigs.value.find(c => c.id === id)
    if (config) config.loading = true
    
    await axios.post(`/api/vpn/openvpn/${id}/stop`)
    ElMessage.success(`OpenVPN connection ${id} stopped`)
    
    await fetchOpenVPNConfigs()
  } catch (error) {
    ElMessage.error(`Failed to stop OpenVPN: ${error.response?.data?.error || error.message}`)
  }
}

const editOpenVpnConfig = async (config) => {
  try {
    const response = await axios.get(`/api/vpn/openvpn/${config.id}`)
    Object.assign(newOpenVpnConfig, response.data)
    editingOpenVpn.value = true
    showOpenVpnDialog.value = true
  } catch (error) {
    ElMessage.error('Failed to load OpenVPN configuration')
  }
}

const saveOpenVpnConfig = async () => {
  try {
    saving.openvpn = true
    
    const payload = {
      name: newOpenVpnConfig.name,
      server: newOpenVpnConfig.server,
      port: newOpenVpnConfig.port,
      protocol: newOpenVpnConfig.protocol,
      username: newOpenVpnConfig.username,
      password: newOpenVpnConfig.password
    }
    
    if (newOpenVpnConfig.config) {
      payload.config = newOpenVpnConfig.config
    }
    
    if (editingOpenVpn.value) {
      await axios.post(`/api/vpn/openvpn/${newOpenVpnConfig.id}`, payload)
      ElMessage.success('OpenVPN configuration updated')
    } else {
      const id = newOpenVpnConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      await axios.post(`/api/vpn/openvpn/${id}`, payload)
      ElMessage.success('OpenVPN configuration created')
    }
    
    showOpenVpnDialog.value = false
    await fetchOpenVPNConfigs()
    await fetchOverview()
  } catch (error) {
    ElMessage.error(`Failed to save OpenVPN config: ${error.response?.data?.error || error.message}`)
  } finally {
    saving.openvpn = false
  }
}

const deleteOpenVpnConfig = async (config) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete "${config.name}"?`,
      'Confirm Delete',
      { type: 'warning' }
    )
    
    await axios.delete(`/api/vpn/openvpn/${config.id}`)
    ElMessage.success('OpenVPN configuration deleted')
    
    await fetchOpenVPNConfigs()
    await fetchOverview()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`Failed to delete config: ${error.response?.data?.error || error.message}`)
    }
  }
}

const startWireGuard = async (interfaceName) => {
  try {
    const config = wireGuardConfigs.value.find(c => c.interface === interfaceName)
    if (config) config.loading = true
    
    await axios.post(`/api/vpn/wireguard/${interfaceName}/up`)
    ElMessage.success(`WireGuard interface ${interfaceName} started`)
    
    await fetchWireGuardConfigs()
  } catch (error) {
    ElMessage.error(`Failed to start WireGuard: ${error.response?.data?.error || error.message}`)
  }
}

const stopWireGuard = async (interfaceName) => {
  try {
    const config = wireGuardConfigs.value.find(c => c.interface === interfaceName)
    if (config) config.loading = true
    
    await axios.post(`/api/vpn/wireguard/${interfaceName}/down`)
    ElMessage.success(`WireGuard interface ${interfaceName} stopped`)
    
    await fetchWireGuardConfigs()
  } catch (error) {
    ElMessage.error(`Failed to stop WireGuard: ${error.response?.data?.error || error.message}`)
  }
}

const generateWireGuardKeys = async () => {
  try {
    generatingKeys.value = true
    const response = await axios.get('/api/vpn/wireguard-keys/generate')
    
    // Update form if dialog is open
    if (showWireGuardDialog.value) {
      newWireGuardConfig.privateKey = response.data.privateKey
      newWireGuardConfig.publicKey = response.data.publicKey
    }
    
    ElMessage.success('WireGuard keys generated')
  } catch (error) {
    ElMessage.error('Failed to generate WireGuard keys')
  } finally {
    generatingKeys.value = false
  }
}

const generateKeyPair = () => {
  // Simple key generation for demo (in real app, use backend)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let privateKey = ''
  for (let i = 0; i < 44; i++) {
    privateKey += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  newWireGuardConfig.privateKey = privateKey
  newWireGuardConfig.publicKey = privateKey.split('').reverse().join('') // Mock public key
}

const editWireGuardConfig = async (config) => {
  try {
    const response = await axios.get(`/api/vpn/wireguard/${config.interface}`)
    Object.assign(newWireGuardConfig, response.data)
    editingWireGuard.value = true
    showWireGuardDialog.value = true
  } catch (error) {
    ElMessage.error('Failed to load WireGuard configuration')
  }
}

const saveWireGuardConfig = async () => {
  try {
    saving.wireguard = true
    
    const payload = {
      name: newWireGuardConfig.interface,
      address: newWireGuardConfig.address,
      listenPort: newWireGuardConfig.listenPort,
      privateKey: newWireGuardConfig.privateKey,
      peers: newWireGuardConfig.peers
    }
    
    if (newWireGuardConfig.config) {
      payload.config = newWireGuardConfig.config
    }
    
    if (editingWireGuard.value) {
      await axios.post(`/api/vpn/wireguard/${newWireGuardConfig.interface}`, payload)
      ElMessage.success('WireGuard configuration updated')
    } else {
      await axios.post(`/api/vpn/wireguard/${newWireGuardConfig.interface}`, payload)
      ElMessage.success('WireGuard configuration created')
    }
    
    showWireGuardDialog.value = false
    await fetchWireGuardConfigs()
    await fetchOverview()
  } catch (error) {
    ElMessage.error(`Failed to save WireGuard config: ${error.response?.data?.error || error.message}`)
  } finally {
    saving.wireguard = false
  }
}

const deleteWireGuardConfig = async (config) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete "${config.interface}"?`,
      'Confirm Delete',
      { type: 'warning' }
    )
    
    await axios.delete(`/api/vpn/wireguard/${config.interface}`)
    ElMessage.success('WireGuard configuration deleted')
    
    await fetchWireGuardConfigs()
    await fetchOverview()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`Failed to delete config: ${error.response?.data?.error || error.message}`)
    }
  }
}

const addPeer = () => {
  newWireGuardConfig.peers.push({
    publicKey: '',
    allowedIPs: '0.0.0.0/0'
  })
}

const removePeer = (index) => {
  newWireGuardConfig.peers.splice(index, 1)
}

const saveIpsecConfig = async () => {
  try {
    saving.ipsec = true
    
    const payload = {
      psk: ipsecConfig.psk,
      username: ipsecConfig.username,
      password: ipsecConfig.password
    }
    
    await axios.post('/api/vpn/ipsec', payload)
    ElMessage.success('IPSec configuration saved')
    
    await fetchIPSecStatus()
    await fetchOverview()
  } catch (error) {
    ElMessage.error(`Failed to save IPSec config: ${error.response?.data?.error || error.message}`)
  } finally {
    saving.ipsec = false
  }
}

const startIpsec = async () => {
  try {
    startingIpsec.value = true
    await axios.post('/api/vpn/ipsec/start')
    ElMessage.success('IPSec service started')
    
    await fetchIPSecStatus()
    await fetchOverview()
    await fetchConnections()
  } catch (error) {
    ElMessage.error(`Failed to start IPSec: ${error.response?.data?.error || error.message}`)
  } finally {
    startingIpsec.value = false
  }
}

const stopIpsec = async () => {
  try {
    stoppingIpsec.value = true
    await axios.post('/api/vpn/ipsec/stop')
    ElMessage.success('IPSec service stopped')
    
    await fetchIPSecStatus()
    await fetchOverview()
    await fetchConnections()
  } catch (error) {
    ElMessage.error(`Failed to stop IPSec: ${error.response?.data?.error || error.message}`)
  } finally {
    stoppingIpsec.value = false
  }
}

const startConnection = async (connection) => {
  try {
    connection.loading = true
    
    if (connection.type === 'openvpn') {
      await axios.post(`/api/vpn/openvpn/${connection.id}/start`)
    } else if (connection.type === 'wireguard') {
      await axios.post(`/api/vpn/wireguard/${connection.name}/up`)
    } else if (connection.type === 'ipsec') {
      await axios.post('/api/vpn/ipsec/start')
    }
    
    ElMessage.success(`${connection.type} connection started`)
    
    await fetchConnections()
    if (connection.type === 'openvpn') await fetchOpenVPNConfigs()
    if (connection.type === 'wireguard') await fetchWireGuardConfigs()
    if (connection.type === 'ipsec') await fetchIPSecStatus()
    
    await fetchOverview()
  } catch (error) {
    ElMessage.error(`Failed to start connection: ${error.response?.data?.error || error.message}`)
  }
}

const stopConnection = async (connection) => {
  try {
    connection.loading = true
    
    if (connection.type === 'openvpn') {
      await axios.post(`/api/vpn/openvpn/${connection.id}/stop`)
    } else if (connection.type === 'wireguard') {
      await axios.post(`/api/vpn/wireguard/${connection.name}/down`)
    } else if (connection.type === 'ipsec') {
      await axios.post('/api/vpn/ipsec/stop')
    }
    
    ElMessage.success(`${connection.type} connection stopped`)
    
    await fetchConnections()
    if (connection.type === 'openvpn') await fetchOpenVPNConfigs()
    if (connection.type === 'wireguard') await fetchWireGuardConfigs()
    if (connection.type === 'ipsec') await fetchIPSecStatus()
    
    await fetchOverview()
  } catch (error) {
    ElMessage.error(`Failed to stop connection: ${error.response?.data?.error || error.message}`)
  }
}

const handleTabChange = (tab) => {
  if (tab.paneName === 'openvpn') {
    fetchOpenVPNConfigs()
  } else if (tab.paneName === 'wireguard') {
    fetchWireGuardConfigs()
  } else if (tab.paneName === 'ipsec') {
    fetchIPSecStatus()
  } else if (tab.paneName === 'stats') {
    fetchOverview()
  }
}

const resetOpenVpnForm = () => {
  Object.assign(newOpenVpnConfig, {
    id: '',
    name: '',
    server: '',
    port: 1194,
    protocol: 'udp',
    username: '',
    password: '',
    config: ''
  })
  editingOpenVpn.value = false
}

const resetWireGuardForm = () => {
  Object.assign(newWireGuardConfig, {
    interface: 'wg0',
    address: '',
    listenPort: 51820,
    privateKey: '',
    publicKey: '',
    peers: [],
    config: ''
  })
  editingWireGuard.value = false
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch (error) {
    return dateString
  }
}

const getVpnIcon = (type) => {
  const icons = {
    'openvpn': 'mdi:lock',
    'wireguard': 'mdi:tunnel',
    'ipsec': 'mdi:shield-lock'
  }
  return icons[type] || 'mdi:connection'
}

// Lifecycle
onMounted(() => {
  fetchOverview()
  fetchOpenVPNConfigs()
  fetchConnections()
})
</script>

<style scoped>
/* Same styles as before, ensure they're included */
.vpn-container {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.vpn-container.dark-mode {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.dashboard-header.dark-mode {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  flex-wrap: wrap;
  gap: 20px;
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
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.dark-mode .header-text h1 {
  color: #f1f5f9;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.header-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.dark-mode .stat-item {
  background: #334155;
  border-color: #475569;
}

.stat-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 20px;
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-icon.total {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-info h3 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.dark-mode .stat-info h3 {
  color: #f1f5f9;
}

.stat-info p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.vpn-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.vpn-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.dark-mode .vpn-card {
  background: #1e293b;
  border-color: #334155;
}

.vpn-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 24px;
  background: transparent;
  border-bottom: 1px solid #e2e8f0;
}

.dark-mode .vpn-tabs :deep(.el-tabs__header) {
  border-color: #334155;
}

.vpn-tabs :deep(.el-tabs__item) {
  padding: 0 24px;
  height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.tab-badge {
  margin-left: 4px;
}

.tab-content {
  padding: 24px;
}

.vpn-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.action-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.add-button {
  border-radius: 12px;
  font-weight: 600;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-alert {
  margin: 20px 0;
  border-radius: 12px;
}

.configs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.config-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.config-card.active {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.dark-mode .config-card.active {
  background: rgba(16, 185, 129, 0.1);
}

.config-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.config-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.config-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.config-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.dark-mode .config-title h4 {
  color: #f1f5f9;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.config-info {
  padding: 0 16px 16px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-row .label {
  color: #64748b;
  font-weight: 500;
  min-width: 80px;
}

.info-row .value {
  color: #1e293b;
  font-weight: 600;
}

.dark-mode .info-row .value {
  color: #f1f5f9;
}

.truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.status-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.dark-mode .status-card {
  background: #1e293b;
  border-color: #334155;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
}

.status-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.dark-mode .status-header h3 {
  color: #f1f5f9;
}

.vpn-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.stat-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
}

.dark-mode .stat-card {
  background: #1e293b;
  border-color: #334155;
}

.stat-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: #1e293b;
}

.dark-mode .stat-card-header {
  color: #f1f5f9;
}

.data-value {
  font-weight: 600;
  color: #3b82f6;
}

.protocol-stats {
  padding: 8px 0;
}

.protocol-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}

.dark-mode .protocol-item {
  border-color: #334155;
}

.protocol-item:last-child {
  border-bottom: none;
}

.protocol-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.protocol-icon.openvpn {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.protocol-icon.wireguard {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.protocol-icon.ipsec {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.protocol-info {
  flex: 1;
}

.protocol-name {
  display: block;
  font-weight: 600;
  color: #1e293b;
}

.dark-mode .protocol-name {
  color: #f1f5f9;
}

.protocol-count {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.protocol-active {
  font-weight: 600;
  color: #10b981;
}

.key-actions {
  margin-top: 8px;
}

.peer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.upload-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #10b981;
  font-size: 14px;
}

.info-alert {
  margin-top: 20px;
  border-radius: 12px;
}

.connection-count {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
}

@media (max-width: 1024px) {
  .configs-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-stats {
    width: 100%;
    justify-content: space-between;
  }
  
  .configs-grid {
    grid-template-columns: 1fr;
  }
  
  .vpn-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-group {
    flex-direction: column;
  }
  
  .add-button, .el-button {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .vpn-container {
    padding: 10px;
  }
  
  .header-text h1 {
    font-size: 24px;
  }
  
  .stat-item {
    flex-direction: column;
    text-align: center;
    padding: 16px;
  }
  
  .config-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .config-actions {
    justify-content: center;
  }
}

/* Dark mode overrides */
:deep(.dark-mode .el-tabs__item) {
  color: #94a3b8;
}

:deep(.dark-mode .el-tabs__item.is-active) {
  color: #3b82f6;
}

:deep(.dark-mode .el-table) {
  background: #1e293b;
  color: #f1f5f9;
}

:deep(.dark-mode .el-table__header th) {
  background: #0f172a;
  color: #cbd5e1;
  border-color: #334155;
}

:deep(.dark-mode .el-table__row) {
  background: #1e293b;
  border-color: #334155;
}

:deep(.dark-mode .el-table__row:hover) {
  background: #334155;
}

:deep(.dark-mode .el-form-item__label) {
  color: #cbd5e1;
}

:deep(.dark-mode .el-input__inner),
:deep(.dark-mode .el-textarea__inner) {
  background: #1e293b;
  border-color: #475569;
  color: #f1f5f9;
}

:deep(.dark-mode .el-input-number__decrease),
:deep(.dark-mode .el-input-number__increase) {
  background: #334155;
  border-color: #475569;
  color: #cbd5e1;
}

:deep(.dark-mode .el-select .el-input__inner) {
  background: #1e293b;
  color: #f1f5f9;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.tab-content, .config-card, .status-card {
  animation: fadeIn 0.3s ease;
}

/* Loading states */
:deep(.el-table__body-wrapper.is-loading) {
  opacity: 0.7;
}

/* Custom scrollbar */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 8px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f1f5f9;
  border-radius: 4px;
}

:deep(.dark-mode .el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #334155;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #cbd5e1;
  border-radius: 4px;
}

:deep(.dark-mode .el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #64748b;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #94a3b8;
}
</style>
