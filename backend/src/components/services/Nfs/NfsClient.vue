<template>
  <div class="nfs-client-modern">
    <!-- Nagłówek -->
    <div class="nfs-header-panel">
      <el-card shadow="hover" class="role-card">
        <div class="role-header">
          <div class="role-icon-container">
            <el-icon size="42" class="role-icon">
              <Icon :icon="roleInfo.isServer ? 'mdi:server-network' : 'mdi:lan-connect'" />
            </el-icon>
          </div>
          
          <div class="role-info">
            <h2 class="role-title">{{ $t('nfsClient.title') }}</h2>
            <div class="role-meta">
              <el-tag :type="roleInfo.isServer ? 'warning' : 'success'" size="small" class="role-tag">
                <Icon :icon="roleInfo.isServer ? 'mdi:server' : 'mdi:desktop-tower'" width="12" />
                {{ roleInfo.isServer ? $t('nfsClient.server') : $t('nfsClient.client') }}
              </el-tag>
              <span class="hostname-info">
                <Icon icon="mdi:computer" width="12" />
                {{ roleInfo.hostname || 'unknown' }}
              </span>
            </div>
          </div>
          
          <div class="role-actions">
            <el-button-group>
              <el-button
                @click="refreshAll"
                :loading="refreshing"
                class="action-btn"
              >
                <Icon icon="mdi:refresh" width="14" />
              </el-button>
            </el-button-group>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Panel skanowania -->
    <el-card shadow="hover" class="scan-panel" v-if="activeTab === 'discover'">
      <div class="scan-header">
        <div class="scan-title">
          <Icon icon="mdi:radar" width="20" />
          <h3>{{ $t('nfsClient.networkScan') }}</h3>
        </div>
        
        <el-radio-group v-model="scanMode" size="small" class="scan-mode">
          <el-radio-button value="auto">
            <Icon icon="mdi:auto-fix" width="14" />
            {{ $t('nfsClient.autoScan') }}
          </el-radio-button>
          <el-radio-button value="manual">
            <Icon icon="mdi:ip" width="14" />
            {{ $t('nfsClient.manualScan') }}
          </el-radio-button>
          <el-radio-button value="network">
            <Icon icon="mdi:lan" width="14" />
            {{ $t('nfsClient.networkScan') }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="scan-body">
        <!-- Tryb ręczny - pojedyncze IP -->
        <div v-if="scanMode === 'manual'" class="manual-scan">
          <el-input
            v-model="scanIp"
            placeholder="192.168.1.35"
            class="scan-ip-input"
          >
            <template #prepend>
              <Icon icon="mdi:ip-network" width="16" />
            </template>
            <template #append>
              <el-button 
                @click="scanSingleIp" 
                type="primary"
                :loading="discovering && scanMode === 'manual'"
                :disabled="!scanIp"
              >
                <Icon icon="mdi:play" width="14" />
                {{ $t('nfsClient.scan') }}
              </el-button>
            </template>
          </el-input>
          <div class="scan-hint">
            <Icon icon="mdi:information-outline" width="12" />
            {{ $t('nfsClient.manualScanHint') }}
          </div>
        </div>

        <!-- Tryb sieciowy - wybór podsieci -->
        <div v-if="scanMode === 'network'" class="network-scan">
          <div class="network-selector">
            <el-select v-model="selectedNetwork" placeholder="Select network" class="network-select">
              <el-option
                v-for="net in localNetworks"
                :key="net.network"
                :label="`${net.network} (${net.interface})`"
                :value="net.base"
              >
                <div class="network-option">
                  <Icon :icon="getInterfaceIcon(net.interface)" width="14" />
                  <span>{{ net.network }}</span>
                  <el-tag size="small">{{ net.interface }}</el-tag>
                  <el-tag size="small" type="info">{{ net.ip }}</el-tag>
                </div>
              </el-option>
            </el-select>
            
            <el-button 
              @click="scanNetwork"
              type="primary"
              :loading="discovering && scanMode === 'network'"
              :disabled="!selectedNetwork"
              class="scan-network-btn"
            >
              <Icon icon="mdi:radar" width="14" />
              {{ $t('nfsClient.scanThisNetwork') }}
            </el-button>
          </div>
          
          <div class="network-info" v-if="selectedNetwork">
            <el-alert
              :title="`Scanning ${selectedNetwork}.0/24 (254 IP addresses)`"
              type="info"
              :closable="false"
              size="small"
            />
          </div>
        </div>

        <!-- Tryb automatyczny - wszystkie sieci -->
        <div v-if="scanMode === 'auto'" class="auto-scan">
          <div class="auto-scan-info">
            <div class="network-list">
              <div v-for="net in localNetworks" :key="net.interface" class="network-item">
                <Icon :icon="getInterfaceIcon(net.interface)" width="14" />
                <span>{{ net.interface }}:</span>
                <strong>{{ net.network }}</strong>
                <el-tag size="small">{{ net.ip }}</el-tag>
                <el-tag size="small" :type="net.isPhysical ? 'success' : 'warning'">
                  {{ net.isPhysical ? 'Physical' : 'Virtual' }}
                </el-tag>
              </div>
              <div v-if="localNetworks.length === 0" class="no-networks">
                <Icon icon="mdi:alert-circle" width="14" />
                {{ $t('nfsClient.noLocalNetworks') }}
              </div>
            </div>
            <div class="scan-info">
              <div class="scan-stats">
                <span>Found <strong>{{ localNetworks.length }}</strong> local network(s)</span>
                <span>Total IPs: <strong>{{ localNetworks.length * 254 }}</strong></span>
              </div>
              <el-button 
                @click="discoverServers" 
                type="primary"
                :loading="discovering"
                class="scan-auto-btn"
              >
                <Icon icon="mdi:radar" width="14" />
                {{ $t('nfsClient.scanAllNetworks') }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div v-if="discovering" class="scan-progress">
          <el-progress 
            :percentage="scanProgress" 
            :format="() => `${scanProgress}% (${scanScannedIps}/${scanTotalIps})`"
            :stroke-width="16"
            :color="progressColor"
            striped
            striped-flow
          />
          <div class="scan-status">
            <div class="scan-status-left">
              <Icon icon="mdi:crosshairs-gps" width="16" />
              <span>{{ $t('nfsClient.scanning') }}: <strong>{{ scanCurrentIp || 'Waiting...' }}</strong></span>
            </div>
            <div class="scan-status-right">
              <span class="scan-count">{{ scanScannedIps }}/{{ scanTotalIps }}</span>
              <span class="scan-percent">{{ scanProgress }}%</span>
              <el-button 
                v-if="discovering"
                @click="stopScan" 
                size="small" 
                type="danger" 
                plain
                class="stop-scan-btn"
              >
                <Icon icon="mdi:stop" width="12" />
                {{ $t('nfsClient.stop') }}
              </el-button>
            </div>
          </div>
          
          <!-- Aktualna sieć -->
          <div class="current-network" v-if="scanCurrentNetwork">
            <Icon icon="mdi:lan" width="12" />
            Scanning network: <strong>{{ scanCurrentNetwork }}</strong>
          </div>
          
          <!-- Znalezione serwery -->
          <div v-if="scanResults.length > 0" class="scan-results">
            <div class="scan-results-title">
              <Icon icon="mdi:server" width="14" />
              {{ $t('nfsClient.foundServers') }} ({{ scanResults.length }}):
            </div>
            <div class="scan-results-list">
              <el-tag 
                v-for="result in scanResults" 
                :key="result.ip"
                size="small"
                type="success"
                class="scan-result-tag"
                closable
                @close="removeScanResult(result.ip)"
              >
                <Icon icon="mdi:server" width="10" />
                {{ result.ip }}
                <span class="result-exports">{{ result.exports?.length || 0 }} exports</span>
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Główny panel -->
    <div class="nfs-content">
      <el-tabs v-model="activeTab" type="border-card" class="nfs-tabs">
        <!-- Wykryte serwery -->
        <el-tab-pane :label="$t('nfsClient.discoveredServers')" name="discover">
          <div class="tab-content">
            <!-- Lista serwerów -->
            <div v-if="servers?.length > 0" class="servers-grid">
              <el-card
                v-for="(server, index) in servers"
                :key="server?.ip || index"
                class="server-card"
                shadow="hover"
              >
                <div class="server-header">
                  <div class="server-icon">
                    <Icon icon="mdi:server" width="24" />
                  </div>
                  <div class="server-info">
                    <h4>{{ server?.hostname || server?.ip || 'Unknown' }}</h4>
                    <span class="server-ip">{{ server?.ip || '' }}</span>
                  </div>
                  <el-tag size="small" type="success" class="server-status">
                    <Icon icon="mdi:check-circle" width="10" />
                    {{ $t('nfsClient.online') }}
                  </el-tag>
                </div>

                <div class="server-exports">
                  <div class="exports-title">
                    <Icon icon="mdi:folder-share" width="14" />
                    {{ $t('nfsClient.availableExports') }} ({{ server?.exports?.length || 0 }})
                  </div>
                  
                  <div v-if="server?.exports?.length > 0" class="exports-list">
                    <div
                      v-for="(exp, expIndex) in server.exports"
                      :key="exp?.export || expIndex"
                      class="export-item"
                    >
                      <div class="export-path">{{ exp?.export || 'Unknown' }}</div>
                      <div class="export-permissions">{{ exp?.options || '*' }}</div>
                      <el-button
                        @click="openMountDialog(server, exp)"
                        size="small"
                        type="primary"
                        plain
                        class="mount-btn"
                        :disabled="!exp?.export"
                      >
                        <Icon icon="mdi:mount" width="12" />
                        {{ $t('nfsClient.mount') }}
                      </el-button>
                    </div>
                  </div>
                  
                  <div v-else class="no-exports">
                    {{ $t('nfsClient.noExports') }}
                  </div>
                </div>

                <div class="server-actions">
                  <el-button
                    @click="scanServer(server?.ip)"
                    size="small"
                    class="server-action-btn"
                    :loading="scanningServer === server?.ip"
                    :disabled="!server?.ip"
                  >
                    <Icon icon="mdi:refresh" width="12" />
                    {{ $t('nfsClient.rescan') }}
                  </el-button>
                  <el-button
                    @click="testServer(server?.ip)"
                    size="small"
                    class="server-action-btn"
                    :disabled="!server?.ip"
                  >
                    <Icon icon="mdi:test-tube" width="12" />
                    {{ $t('nfsClient.test') }}
                  </el-button>
                </div>
              </el-card>
            </div>

            <!-- Brak serwerów -->
            <div v-else class="empty-state">
              <Icon icon="mdi:server-off" size="48" />
              <h3>{{ $t('nfsClient.noServersFound') }}</h3>
              <p>{{ $t('nfsClient.clickDiscover') }}</p>
              <el-button @click="scanMode = 'auto'; discoverServers()" type="primary" class="discover-btn">
                <Icon icon="mdi:radar" width="16" />
                {{ $t('nfsClient.discoverNow') }}
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- Zamontowane udziały -->
        <el-tab-pane :label="$t('nfsClient.mountedShares')" name="mounts">
          <div class="tab-content">
            <div v-if="!mounts || mounts.length === 0" class="empty-state">
              <Icon icon="mdi:folder-off" size="48" />
              <h3>{{ $t('nfsClient.noMounts') }}</h3>
              <p>{{ $t('nfsClient.goToDiscover') }}</p>
              <el-button @click="activeTab = 'discover'" type="primary">
                <Icon icon="mdi:arrow-left" width="14" />
                {{ $t('nfsClient.goToDiscover') }}
              </el-button>
            </div>

            <div v-else class="mounts-grid">
              <el-card
                v-for="(mount, index) in mounts"
                :key="mount?.mountPoint || index"
                class="mount-card"
                shadow="hover"
              >
                <div class="mount-header">
                  <div class="mount-icon">
                    <Icon icon="mdi:folder-network" width="20" />
                  </div>
                  <div class="mount-info">
                    <div class="mount-source">{{ mount?.server || '' }}:{{ mount?.export || '' }}</div>
                    <div class="mount-point">{{ mount?.mountPoint || '' }}</div>
                  </div>
                </div>

                <div class="mount-details">
                  <div class="mount-options">
                    <template v-if="mount?.options?.length > 0">
                      <el-tag
                        v-for="(opt, optIndex) in mount.options.slice(0, 3)"
                        :key="optIndex"
                        size="small"
                        class="option-tag"
                      >
                        {{ opt }}
                      </el-tag>
                      <el-tag
                        v-if="mount.options.length > 3"
                        size="small"
                        class="option-tag more"
                      >
                        +{{ mount.options.length - 3 }}
                      </el-tag>
                    </template>
                    <span v-else class="no-options">No options</span>
                  </div>
                </div>

                <div class="mount-actions">
                  <el-tooltip :content="$t('nfsClient.benchmark')" placement="top">
                    <el-button
                      @click="benchmarkMount(mount?.mountPoint)"
                      size="small"
                      circle
                      plain
                      class="mount-action-btn"
                      :loading="benchmarking === mount?.mountPoint"
                      :disabled="!mount?.mountPoint"
                    >
                      <Icon icon="mdi:speedometer" width="14" />
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('nfsClient.unmount')" placement="top">
                    <el-button
                      @click="unmountShare(mount)"
                      size="small"
                      type="danger"
                      circle
                      plain
                      class="mount-action-btn"
                      :disabled="!mount?.mountPoint"
                    >
                      <Icon icon="mdi:eject" width="14" />
                    </el-button>
                  </el-tooltip>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <!-- Statystyki i wydajność -->
        <el-tab-pane :label="$t('nfsClient.performance')" name="performance">
          <div class="tab-content">
            <div v-if="!mounts || mounts.length === 0" class="empty-state">
              <Icon icon="mdi:chart-line" size="48" />
              <h3>{{ $t('nfsClient.noMounts') }}</h3>
              <p>{{ $t('nfsClient.mountFirst') }}</p>
            </div>

            <div v-else class="performance-grid">
              <el-card
                v-for="(mount, index) in mounts"
                :key="mount?.mountPoint || index"
                class="perf-card"
                shadow="hover"
              >
                <div class="perf-header">
                  <Icon icon="mdi:chart-line" width="20" />
                  <span>{{ mount?.mountPoint || '' }}</span>
                </div>
                
                <div class="perf-stats" v-if="mount?.mountPoint && performance[mount.mountPoint]">
                  <div class="perf-item">
                    <label>{{ $t('nfsClient.readSpeed') }}</label>
                    <span class="perf-value">{{ performance[mount.mountPoint]?.readSpeed || 'N/A' }}</span>
                  </div>
                  <div class="perf-item">
                    <label>{{ $t('nfsClient.writeSpeed') }}</label>
                    <span class="perf-value">{{ performance[mount.mountPoint]?.writeSpeed || 'N/A' }}</span>
                  </div>
                  <div class="perf-item">
                    <label>{{ $t('nfsClient.latency') }}</label>
                    <span class="perf-value">{{ performance[mount.mountPoint]?.latency || 'N/A' }}</span>
                  </div>
                </div>
                
                <div v-else class="no-perf">
                  <el-button
                    @click="benchmarkMount(mount?.mountPoint)"
                    size="small"
                    type="primary"
                    plain
                    :loading="benchmarking === mount?.mountPoint"
                    :disabled="!mount?.mountPoint"
                  >
                    <Icon icon="mdi:play" width="12" />
                    {{ $t('nfsClient.runBenchmark') }}
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Dialog montowania -->
    <el-dialog
      v-model="mountDialog.visible"
      :title="$t('nfsClient.mountShare')"
      width="550px"
      class="mount-dialog"
      destroy-on-close
    >
      <el-form
        ref="mountFormRef"
        :model="mountDialog"
        :rules="mountRules"
        label-position="top"
        class="mount-form"
      >
        <el-form-item :label="$t('nfsClient.server')">
          <el-input v-model="mountDialog.server" disabled />
        </el-form-item>
        
        <el-form-item :label="$t('nfsClient.exportPath')">
          <el-input v-model="mountDialog.export" disabled />
        </el-form-item>

        <!-- Wybór katalogu bazowego -->
        <el-form-item label="Base directory">
          <el-radio-group v-model="mountDialog.basePathType" class="base-path-radio">
            <el-radio value="srv">
              <Icon icon="mdi:folder" width="14" />
              /srv/
            </el-radio>
            <el-radio value="mnt">
              <Icon icon="mdi:folder" width="14" />
              /mnt/
            </el-radio>
            <el-radio value="custom">
              <Icon icon="mdi:folder-pencil" width="14" />
              Custom
            </el-radio>
          </el-radio-group>

          <!-- Custom path input -->
          <el-input
            v-if="mountDialog.basePathType === 'custom'"
            v-model="mountDialog.customBasePath"
            placeholder="/srv/nfs / media/nfs / etc"
            class="custom-path-input"
          >
            <template #prepend>
              <Icon icon="mdi:folder-outline" width="14" />
            </template>
          </el-input>

          <!-- Szybkie sugestie dla /srv/ -->
          <div v-if="mountDialog.basePathType === 'srv'" class="path-suggestions">
            <el-tag 
              v-for="suggestion in srvSuggestions" 
              :key="suggestion"
              size="small"
              @click="mountDialog.mountPoint = suggestion"
              class="suggestion-tag"
            >
              <Icon icon="mdi:plus" width="10" />
              {{ suggestion }}
            </el-tag>
          </div>

          <!-- Szybkie sugestie dla /mnt/ -->
          <div v-if="mountDialog.basePathType === 'mnt'" class="path-suggestions">
            <el-tag 
              v-for="suggestion in mntSuggestions" 
              :key="suggestion"
              size="small"
              @click="mountDialog.mountPoint = suggestion"
              class="suggestion-tag"
            >
              <Icon icon="mdi:plus" width="10" />
              {{ suggestion }}
            </el-tag>
          </div>
        </el-form-item>
        
        <el-form-item :label="$t('nfsClient.mountPoint')" prop="mountPoint">
          <el-input
            v-model="mountDialog.mountPoint"
            :placeholder="$t('nfsClient.mountPointPlaceholder')"
          >
            <template #prepend>
              <el-tooltip :content="getBasePathDisplay()" placement="top">
                <span class="path-prefix">
                  {{ getBasePathDisplay() }}
                </span>
              </el-tooltip>
            </template>
          </el-input>
          <div class="config-hint">
            <Icon icon="mdi:information-outline" width="12" />
            Final path: <strong>{{ getFullMountPath() }}</strong>
          </div>
        </el-form-item>

        <el-divider>{{ $t('nfsClient.advancedOptions') }}</el-divider>

        <div class="options-grid">
          <el-form-item :label="$t('nfsClient.nfsVersion')">
            <el-select v-model="mountDialog.options.vers" class="option-select">
              <el-option label="NFSv4.2" value="4.2" />
              <el-option label="NFSv4.1" value="4.1" />
              <el-option label="NFSv4" value="4" />
              <el-option label="NFSv3" value="3" />
            </el-select>
          </el-form-item>

          <el-form-item :label="$t('nfsClient.rsize')">
            <el-input-number
              v-model="mountDialog.options.rsize"
              :min="1024"
              :max="1048576"
              :step="1024"
              class="option-input"
            />
          </el-form-item>

          <el-form-item :label="$t('nfsClient.wsize')">
            <el-input-number
              v-model="mountDialog.options.wsize"
              :min="1024"
              :max="1048576"
              :step="1024"
              class="option-input"
            />
          </el-form-item>
        </div>

        <div class="options-checkboxes">
          <el-checkbox v-model="mountDialog.options.hard">
            {{ $t('nfsClient.hardMount') }}
          </el-checkbox>
          <el-checkbox v-model="mountDialog.options.intr">
            {{ $t('nfsClient.interruptible') }}
          </el-checkbox>
          <el-checkbox v-model="mountDialog.options.noatime">
            {{ $t('nfsClient.noatime') }}
          </el-checkbox>
          <el-checkbox v-model="mountDialog.options._netdev">
            {{ $t('nfsClient.netdev') }}
          </el-checkbox>
          <el-checkbox v-model="mountDialog.addToFstab">
            {{ $t('nfsClient.addToFstab') }}
          </el-checkbox>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="mountDialog.visible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          @click="mountShare"
          :loading="mounting"
        >
          <Icon icon="mdi:mount" width="14" />
          {{ $t('nfsClient.mount') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog benchmarku -->
    <el-dialog
      v-model="benchmarkDialog.visible"
      :title="$t('nfsClient.benchmarkResults')"
      width="400px"
    >
      <div v-if="benchmarkDialog.results" class="benchmark-results">
        <div class="result-item">
          <label>{{ $t('nfsClient.readSpeed') }}</label>
          <span class="result-value">{{ benchmarkDialog.results.readSpeed || 'N/A' }}</span>
        </div>
        <div class="result-item">
          <label>{{ $t('nfsClient.writeSpeed') }}</label>
          <span class="result-value">{{ benchmarkDialog.results.writeSpeed || 'N/A' }}</span>
        </div>
        <div class="result-item">
          <label>{{ $t('nfsClient.latency') }}</label>
          <span class="result-value">{{ benchmarkDialog.results.latency || 'N/A' }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useNotifications } from '@/services/NotificationService.js'

const { t } = useI18n()
const { addNotification } = useNotifications()

// ==================== STAN ====================
const activeTab = ref('discover')
const discovering = ref(false)
const mountsLoading = ref(false)
const mounting = ref(false)
const benchmarking = ref(null)
const refreshing = ref(false)
const scanningServer = ref(null)

// Skanowanie
const scanMode = ref('auto')
const scanIp = ref('')
const scanProgress = ref(0)
const scanCurrentIp = ref('')
const scanTotalIps = ref(254)
const scanScannedIps = ref(0)
const scanCurrentNetwork = ref('')
const scanResults = ref([])
const currentScanId = ref(null)
const pollInterval = ref(null)

// Dane
const roleInfo = ref({
  isServer: false,
  isClient: false,
  hostname: '',
  activeMounts: []
})

const localNetworks = ref([])
const selectedNetwork = ref('')
const servers = ref([])
const mounts = ref([])
const performance = ref({})

// Dialogi
const mountDialog = reactive({
  visible: false,
  server: '',
  export: '',
  mountPoint: '',
  basePathType: 'srv',
  customBasePath: '/srv/nfs',
  addToFstab: false,
  options: {
    vers: '4.2',
    rsize: 1048576,
    wsize: 1048576,
    hard: true,
    intr: true,
    noatime: true,
    _netdev: true
  }
})

const benchmarkDialog = reactive({
  visible: false,
  results: null
})

// Sugestie
const srvSuggestions = ref([
  'media', 'backup', 'data', 'public', 'private', 'archive', 'movies', 'music', 'photos'
])

const mntSuggestions = ref([
  'nas', 'storage', 'share', 'remote', 'backup', 'temp'
])

// ==================== WALIDACJA ====================
const mountRules = {
  mountPoint: [
    { required: true, message: t('nfsClient.mountPointRequired'), trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_\-/]+$/, message: t('nfsClient.mountPointInvalid'), trigger: 'blur' }
  ]
}

// ==================== COMPUTED ====================
const progressColor = computed(() => {
  const progress = scanProgress.value || 0
  if (progress < 30) return '#67C23A'
  if (progress < 70) return '#E6A23C'
  return '#F56C6C'
})

// ==================== FUNKCJE POMOCNICZE ====================
const getInterfaceIcon = (iface) => {
  if (iface.startsWith('eth') || iface.startsWith('en')) return 'mdi:ethernet'
  if (iface.startsWith('wlan') || iface.startsWith('wl')) return 'mdi:wifi'
  if (iface.startsWith('br')) return 'mdi:bridge'
  if (iface.startsWith('docker')) return 'mdi:docker'
  return 'mdi:lan'
}

const getBasePathDisplay = () => {
  switch (mountDialog.basePathType) {
    case 'srv':
      return '/srv/'
    case 'mnt':
      return '/mnt/'
    case 'custom':
      return mountDialog.customBasePath.endsWith('/') 
        ? mountDialog.customBasePath 
        : mountDialog.customBasePath + '/'
    default:
      return '/srv/'
  }
}

const getFullMountPath = () => {
  const base = getBasePathDisplay()
  const mount = mountDialog.mountPoint.replace(/^\//, '')
  return base + mount
}

// ==================== FUNKCJE API ====================
const loadRole = async () => {
  try {
    const response = await axios.get('/api/nfs/role')
    roleInfo.value = {
      isServer: response.data?.isServer || false,
      isClient: response.data?.isClient || false,
      hostname: response.data?.hostname || '',
      activeMounts: response.data?.activeMounts || []
    }
  } catch (error) {
    console.error('Load role error:', error)
    ElMessage.error(t('nfsClient.loadRoleError'))
    addNotification({
      type: 'error',
      title: 'NFS Client Error',
      message: 'Failed to load role information'
    })
  }
}

const loadLocalNetworks = async () => {
  try {
    const response = await axios.get('/api/nfs/networks')
    localNetworks.value = (response.data?.networks || [])
      .filter(net => net.network.startsWith('192.168.'))
      .map(net => ({
        ...net,
        base: net.network.replace('.0/24', ''),
        isPhysical: !net.interface.startsWith('docker') && 
                    !net.interface.startsWith('br-') && 
                    !net.interface.startsWith('veth') &&
                    !net.interface.startsWith('virbr')
      }))
    console.log('Local networks loaded:', localNetworks.value)
  } catch (error) {
    console.error('Load networks error:', error)
    addNotification({
      type: 'warning',
      title: 'Network Detection',
      message: 'Could not load local network interfaces'
    })
  }
}

const discoverServers = async () => {
  // Zatrzymaj poprzednie skanowanie jeśli istnieje
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  
  discovering.value = true
  scanMode.value = 'auto'
  scanProgress.value = 0
  scanScannedIps.value = 0
  scanCurrentIp.value = ''
  scanCurrentNetwork.value = ''
  scanResults.value = []
  
  addNotification({
    type: 'info',
    title: 'NFS Discovery Started',
    message: 'Scanning all local networks for NFS servers...'
  })
  
  try {
    await loadLocalNetworks()
    
    if (localNetworks.value.length === 0) {
      ElMessage.warning('No local networks found')
      addNotification({
        type: 'warning',
        title: 'No Networks Found',
        message: 'Could not detect any local networks to scan'
      })
      discovering.value = false
      return
    }
    
    console.log('Starting scan for networks:', localNetworks.value.map(n => n.base))
    
    // Rozpocznij skanowanie
    const startResponse = await axios.post('/api/nfs/discover-start', {
      networks: localNetworks.value.map(n => n.base)
    })
    
    currentScanId.value = startResponse.data.scanId
    scanTotalIps.value = startResponse.data.totalIps || 254
    console.log('Scan started with ID:', currentScanId.value)
    console.log('Total IPs to scan:', scanTotalIps.value)
    
    // Poll co 500ms dla płynniejszego feedbacku
    pollInterval.value = setInterval(async () => {
      try {
        const statusResponse = await axios.get('/api/nfs/discover-status', {
          params: { scanId: currentScanId.value }
        })
        
        const data = statusResponse.data
        
        // BEZPOŚREDNIA aktualizacja wartości
        scanProgress.value = data.progress || 0
        scanScannedIps.value = data.scanned || 0
        if (data.total) scanTotalIps.value = data.total
        scanCurrentIp.value = data.currentIp || ''
        scanCurrentNetwork.value = data.currentNetwork || ''
        
        // Dodaj serwery
        if (data.servers && data.servers.length > 0) {
          data.servers.forEach(server => {
            if (!servers.value.some(s => s.ip === server.ip)) {
              servers.value.push(server)
              scanResults.value.push(server)
              
              // Dodaj powiadomienie o znalezionym serwerze (tylko dla pierwszych 5, żeby nie spamować)
              if (scanResults.value.length <= 5) {
                addNotification({
                  type: 'success',
                  title: 'NFS Server Found',
                  message: `${server.ip} (${server.hostname || 'unknown'}) - ${server.exports?.length || 0} exports`
                })
              } else if (scanResults.value.length === 6) {
                addNotification({
                  type: 'info',
                  title: 'Multiple Servers Found',
                  message: `${scanResults.value.length} servers discovered so far...`
                })
              }
            }
          })
        }
        
        // Zakończ skanowanie
        if (data.complete) {
          console.log('Scan complete!')
          clearInterval(pollInterval.value)
          pollInterval.value = null
          discovering.value = false
          scanProgress.value = 100
          
          const message = t('nfsClient.discoveryComplete', { 
            count: servers.value.length 
          })
          ElMessage.success(message)
          
          if (servers.value.length > 0) {
            addNotification({
              type: 'success',
              title: 'NFS Discovery Complete',
              message: `Found ${servers.value.length} NFS server(s)`,
              details: servers.value.map(s => `${s.ip} (${s.exports?.length || 0} exports)`).join('\n')
            })
          } else {
            addNotification({
              type: 'info',
              title: 'NFS Discovery Complete',
              message: 'No NFS servers found on local networks'
            })
          }
        }
      } catch (error) {
        console.error('Poll error:', error)
      }
    }, 500) // Poll co 500ms
    
    // Timeout po 10 minutach
    setTimeout(() => {
      if (pollInterval.value) {
        clearInterval(pollInterval.value)
        pollInterval.value = null
        if (discovering.value) {
          discovering.value = false
          ElMessage.warning('Scan timed out after 10 minutes')
          addNotification({
            type: 'warning',
            title: 'Scan Timeout',
            message: 'Network scan timed out after 10 minutes'
          })
        }
      }
    }, 600000) // 10 minut
    
  } catch (error) {
    console.error('Discovery error:', error)
    ElMessage.error(t('nfsClient.discoveryError'))
    addNotification({
      type: 'error',
      title: 'Discovery Failed',
      message: error.response?.data?.error || 'Network scan failed'
    })
    discovering.value = false
    if (pollInterval.value) {
      clearInterval(pollInterval.value)
      pollInterval.value = null
    }
  }
}

const scanNetwork = async () => {
  if (!selectedNetwork.value) {
    ElMessage.warning(t('nfsClient.selectNetwork'))
    return
  }
  
  // Zatrzymaj poprzednie skanowanie
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  
  discovering.value = true
  scanMode.value = 'network'
  scanProgress.value = 0
  scanScannedIps.value = 0
  scanCurrentIp.value = ''
  scanCurrentNetwork.value = selectedNetwork.value
  scanResults.value = []
  scanTotalIps.value = 254
  
  addNotification({
    type: 'info',
    title: 'Network Scan Started',
    message: `Scanning ${selectedNetwork.value}.0/24 for NFS servers...`
  })
  
  try {
    const startResponse = await axios.post('/api/nfs/scan-network-start', {
      network: selectedNetwork.value
    })
    
    currentScanId.value = startResponse.data.scanId
    console.log('Network scan started:', currentScanId.value)
    
    pollInterval.value = setInterval(async () => {
      try {
        const statusResponse = await axios.get('/api/nfs/scan-network-status', {
          params: { scanId: currentScanId.value }
        })
        
        const data = statusResponse.data
        console.log('Network scan status:', data)
        
        scanProgress.value = data.progress || 0
        scanScannedIps.value = data.scanned || 0
        scanCurrentIp.value = data.currentIp || ''
        
        if (data.servers && data.servers.length > 0) {
          data.servers.forEach(server => {
            if (!servers.value.some(s => s.ip === server.ip)) {
              servers.value.push(server)
              scanResults.value.push(server)
              
              if (scanResults.value.length <= 3) {
                addNotification({
                  type: 'success',
                  title: 'NFS Server Found',
                  message: `${server.ip} - ${server.exports?.length || 0} exports`
                })
              }
            }
          })
        }
        
        if (data.complete) {
          clearInterval(pollInterval.value)
          pollInterval.value = null
          discovering.value = false
          scanProgress.value = 100
          
          const message = t('nfsClient.networkScanComplete', { 
            network: selectedNetwork.value,
            count: scanResults.value.length 
          })
          ElMessage.success(message)
          
          addNotification({
            type: 'success',
            title: 'Network Scan Complete',
            message: `Found ${scanResults.value.length} server(s) on ${selectedNetwork.value}.0/24`
          })
        }
      } catch (error) {
        console.error('Poll error:', error)
      }
    }, 500)
    
  } catch (error) {
    console.error('Network scan error:', error)
    ElMessage.error(t('nfsClient.scanError'))
    addNotification({
      type: 'error',
      title: 'Network Scan Failed',
      message: error.response?.data?.error || 'Could not scan network'
    })
    discovering.value = false
  }
}

const scanSingleIp = async () => {
  if (!scanIp.value) {
    ElMessage.warning(t('nfsClient.enterIp'))
    return
  }
  
  discovering.value = true
  scanMode.value = 'manual'
  scanProgress.value = 0
  scanCurrentIp.value = scanIp.value
  scanResults.value = []
  scanTotalIps.value = 1
  
  addNotification({
    type: 'info',
    title: 'IP Scan Started',
    message: `Checking ${scanIp.value} for NFS services...`
  })
  
  try {
    const response = await axios.get(`/api/nfs/scan-ip/${scanIp.value}`)
    
    if (response.data?.server) {
      scanResults.value = [response.data.server]
      const exists = servers.value.some(s => s.ip === response.data.server.ip)
      if (!exists) {
        servers.value.push(response.data.server)
      }
      ElMessage.success(t('nfsClient.serverFound', { ip: scanIp.value }))
      addNotification({
        type: 'success',
        title: 'NFS Server Found',
        message: `${scanIp.value} - ${response.data.server.hostname || 'unknown'}`,
        details: `Exports: ${response.data.server.exports?.length || 0}`
      })
    } else {
      ElMessage.info(t('nfsClient.noServerFound', { ip: scanIp.value }))
      addNotification({
        type: 'info',
        title: 'No NFS Server',
        message: `${scanIp.value} is not running NFS services`
      })
    }
    
    scanScannedIps.value = 1
    scanProgress.value = 100
  } catch (error) {
    console.error('Scan error:', error)
    ElMessage.error(t('nfsClient.scanError'))
    addNotification({
      type: 'error',
      title: 'Scan Failed',
      message: `Could not scan ${scanIp.value}: ${error.response?.data?.error || error.message}`
    })
  } finally {
    setTimeout(() => {
      discovering.value = false
      scanProgress.value = 0
    }, 1000)
  }
}

const stopScan = () => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  discovering.value = false
  scanProgress.value = 0
  ElMessage.info(t('nfsClient.scanStopped'))
  addNotification({
    type: 'warning',
    title: 'Scan Stopped',
    message: 'Network scan was interrupted by user'
  })
}

const removeScanResult = (ip) => {
  scanResults.value = scanResults.value.filter(r => r.ip !== ip)
}

const loadMounts = async () => {
  mountsLoading.value = true
  try {
    const response = await axios.get('/api/nfs/mounts')
    mounts.value = response.data?.mounts || []
  } catch (error) {
    console.error('Load mounts error:', error)
    mounts.value = []
    ElMessage.error(t('nfsClient.loadMountsError'))
    addNotification({
      type: 'error',
      title: 'Mount Error',
      message: 'Failed to load mounted shares'
    })
  } finally {
    mountsLoading.value = false
  }
}

const openMountDialog = (server, exp) => {
  if (!server || !exp) {
    ElMessage.warning('Invalid server or export')
    return
  }
  
  mountDialog.server = server.ip || ''
  mountDialog.export = exp.export || ''
  
  const exportName = (exp.export || '').split('/').pop() || 'share'
  mountDialog.mountPoint = exportName
  mountDialog.basePathType = 'srv'
  mountDialog.customBasePath = '/srv/nfs'
  
  mountDialog.visible = true
}

const mountShare = async () => {
  if (!mountDialog.mountPoint) {
    ElMessage.warning(t('nfsClient.mountPointRequired'))
    return
  }
  
  mounting.value = true
  try {
    const fullPath = getFullMountPath()
    
    const response = await axios.post('/api/nfs/mount', {
      server: mountDialog.server,
      export: mountDialog.export,
      mountPoint: fullPath,
      options: mountDialog.options,
      addToFstab: mountDialog.addToFstab
    })
    
    ElMessage.success(t('nfsClient.mountSuccess') + ` at ${fullPath}`)
    addNotification({
      type: 'success',
      title: 'Share Mounted',
      message: `${mountDialog.server}:${mountDialog.export} → ${fullPath}`,
      details: `Options: ${Object.entries(mountDialog.options).filter(([_, v]) => v).map(([k]) => k).join(', ')}`
    })
    mountDialog.visible = false
    await loadMounts()
  } catch (error) {
    console.error('Mount error:', error)
    ElMessage.error(error.response?.data?.error || t('nfsClient.mountError'))
    addNotification({
      type: 'error',
      title: 'Mount Failed',
      message: error.response?.data?.error || 'Could not mount share'
    })
  } finally {
    mounting.value = false
  }
}

const unmountShare = async (mount) => {
  if (!mount?.mountPoint) return
  
  try {
    await ElMessageBox.confirm(
      t('nfsClient.confirmUnmount', { mount: mount.mountPoint }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    const response = await axios.post('/api/nfs/umount', {
      mountPoint: mount.mountPoint,
      removeFromFstab: true
    })
    
    ElMessage.success(t('nfsClient.unmountSuccess'))
    addNotification({
      type: 'warning',
      title: 'Share Unmounted',
      message: `${mount.mountPoint} has been unmounted`
    })
    await loadMounts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Unmount error:', error)
      ElMessage.error(error.response?.data?.error || t('nfsClient.unmountError'))
      addNotification({
        type: 'error',
        title: 'Unmount Failed',
        message: error.response?.data?.error || 'Could not unmount share'
      })
    }
  }
}

const benchmarkMount = async (mountPoint) => {
  if (!mountPoint) return
  
  benchmarking.value = mountPoint
  addNotification({
    type: 'info',
    title: 'Benchmark Started',
    message: `Testing performance of ${mountPoint}...`
  })
  
  try {
    const response = await axios.post('/api/nfs/benchmark', { mountPoint })
    if (mountPoint) {
      if (!performance.value) performance.value = {}
      performance.value[mountPoint] = response.data || {}
    }
    benchmarkDialog.results = response.data || {}
    benchmarkDialog.visible = true
    
    addNotification({
      type: 'success',
      title: 'Benchmark Complete',
      message: `${mountPoint}: ${response.data?.readSpeed || 'N/A'} read, ${response.data?.writeSpeed || 'N/A'} write`
    })
  } catch (error) {
    console.error('Benchmark error:', error)
    ElMessage.error(t('nfsClient.benchmarkError'))
    addNotification({
      type: 'error',
      title: 'Benchmark Failed',
      message: error.response?.data?.error || 'Could not benchmark share'
    })
  } finally {
    benchmarking.value = null
  }
}

const scanServer = async (ip) => {
  if (!ip) return
  
  scanningServer.value = ip
  addNotification({
    type: 'info',
    title: 'Rescanning Server',
    message: `Checking ${ip} for updated exports...`
  })
  
  try {
    const response = await axios.get(`/api/nfs/exports/${ip}`)
    const server = servers.value.find(s => s?.ip === ip)
    if (server && response.data?.exports) {
      const oldCount = server.exports?.length || 0
      server.exports = response.data.exports
      
      addNotification({
        type: 'success',
        title: 'Server Rescanned',
        message: `${ip}: ${server.exports.length} exports found (was ${oldCount})`
      })
    }
    ElMessage.success(t('nfsClient.scanComplete'))
  } catch (error) {
    console.error('Scan error:', error)
    ElMessage.error(t('nfsClient.scanError'))
    addNotification({
      type: 'error',
      title: 'Rescan Failed',
      message: `Could not rescan ${ip}: ${error.response?.data?.error || error.message}`
    })
  } finally {
    scanningServer.value = null
  }
}

const testServer = async (ip) => {
  if (!ip) return
  ElMessage.info(t('nfsClient.testing', { ip }))
  addNotification({
    type: 'info',
    title: 'Testing Server',
    message: `Running connectivity test for ${ip}...`
  })
}

const refreshAll = async () => {
  refreshing.value = true
  try {
    await Promise.all([
      loadRole(),
      loadLocalNetworks(),
      loadMounts()
    ])
    ElMessage.success(t('common.refreshSuccess'))
    addNotification({
      type: 'success',
      title: 'Refresh Complete',
      message: 'NFS client data has been updated'
    })
  } catch (error) {
    console.error('Refresh error:', error)
    ElMessage.error(t('common.refreshError'))
    addNotification({
      type: 'error',
      title: 'Refresh Failed',
      message: 'Could not refresh NFS client data'
    })
  } finally {
    refreshing.value = false
  }
}

// ==================== LIFECYCLE ====================
onMounted(() => {
  refreshAll()
})
</script>

<style scoped lang="scss">
.nfs-client-modern {
  padding: 20px;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Nagłówek panelu */
.nfs-header-panel {
  margin-bottom: 24px;
}

.role-card {
  border-radius: 16px;
  background: linear-gradient(135deg, var(--el-bg-color) 0%, color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary-light-9)) 100%);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #1e293b);
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-dark);
  }

  &:deep(.el-card__body) {
    padding: 0;
  }
}

.role-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: transparent;
}

.role-icon-container {
  position: relative;
  flex-shrink: 0;
}

.role-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-dark-2) 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.3);
}

.role-info {
  flex: 1;
  min-width: 0;
}

.role-title {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.role-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
}

.role-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.hostname-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.05);
  }
}

.role-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 180px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

/* Panel skanowania */
.scan-panel {
  margin-bottom: 24px;
  border-radius: 12px;
  
  &:deep(.el-card__body) {
    padding: 20px;
  }
}

.scan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  .scan-title {
    display: flex;
    align-items: center;
    gap: 8px;
    
    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}

.scan-mode {
  :deep(.el-radio-button__inner) {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.scan-body {
  .manual-scan {
    .scan-ip-input {
      max-width: 400px;
    }
    
    .scan-hint {
      margin-top: 8px;
      font-size: 0.75rem;
      color: var(--el-text-color-secondary);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
  
  .network-scan {
    .network-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      
      .network-select {
        flex: 1;
        min-width: 300px;
      }
      
      .scan-network-btn {
        min-width: 120px;
      }
    }
  }
  
  .auto-scan {
    .auto-scan-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .network-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      .network-item {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: var(--el-fill-color-light);
        border-radius: 4px;
        font-size: 0.75rem;
        
        :global(.dark) & {
          background: rgba(255, 255, 255, 0.05);
        }
      }
    }
    
    .scan-info {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .scan-stats {
        display: flex;
        gap: 16px;
        color: var(--el-text-color-secondary);
        font-size: 0.9rem;
        
        strong {
          color: var(--el-color-primary);
          font-size: 1.1rem;
        }
      }
    }
  }
}

.scan-progress {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  
  .el-progress {
    margin-bottom: 8px;
  }
  
  .scan-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    font-size: 0.9rem;
    
    .scan-status-left {
      display: flex;
      align-items: center;
      gap: 8px;
      
      strong {
        color: var(--el-color-primary);
        font-family: monospace;
      }
    }
    
    .scan-status-right {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .scan-count {
        font-weight: 600;
        color: var(--el-color-primary);
      }
      
      .scan-percent {
        background: var(--el-fill-color-darker);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 500;
      }
    }
  }
  
  .current-network {
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--el-text-color-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
    
    strong {
      color: var(--el-color-primary);
    }
  }
  
  .scan-results {
    margin-top: 16px;
    
    .scan-results-title {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .scan-results-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      
      .scan-result-tag {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
}

.result-exports {
  font-size: 0.7rem;
  opacity: 0.8;
  margin-left: 4px;
}

.network-option {
  display: flex;
  align-items: center;
  gap: 8px;
  
  span {
    font-weight: 500;
  }
}

.no-networks {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 0.875rem;
}

.scan-auto-btn {
  min-width: 160px;
}

/* Tabs */
.nfs-tabs {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-bg-color);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.nfs-tabs .el-tabs__header) {
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  margin-bottom: 0;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

:deep(.nfs-tabs .el-tabs__item) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 0 24px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s ease;
  
  &:hover {
    color: var(--el-color-primary);
  }
}

:deep(.nfs-tabs .el-tabs__item.is-active) {
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border-radius: 12px 12px 0 0;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
    border-radius: 2px;
  }
}

.tab-content {
  padding: 24px;
  min-height: 500px;
}

/* Serwery */
.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
}

.server-card {
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-bg-color);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.server-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-bottom-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.server-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  color: var(--el-color-primary);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.1);
  }
}

.server-info {
  flex: 1;
  
  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .server-ip {
    font-size: 0.75rem;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }
}

.server-status {
  font-weight: 500;
}

.server-exports {
  margin-bottom: 16px;
}

.exports-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.exports-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.export-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
  
  &:hover {
    background: var(--el-fill-color);
    transform: translateX(2px);
  }
}

.export-path {
  flex: 1;
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--el-color-primary);
  font-weight: 500;
}

.export-permissions {
  font-size: 0.7rem;
  color: var(--el-text-color-secondary);
  margin: 0 8px;
  padding: 2px 6px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.mount-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  font-size: 0.75rem;
}

.no-exports {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 0.875rem;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.server-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    border-top-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.server-action-btn {
  flex: 1;
  height: 32px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Zamontowane udziały */
.mounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.mount-card {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: var(--el-bg-color);
  position: relative;
  transition: all 0.3s ease;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--el-box-shadow-light);
    
    .mount-actions {
      opacity: 1;
    }
  }
}

.mount-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mount-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-success-light-9);
  border-radius: 8px;
  color: var(--el-color-success);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(103, 194, 58, 0.1);
  }
}

.mount-info {
  flex: 1;
  
  .mount-source {
    font-weight: 600;
    color: var(--el-text-color-primary);
    font-size: 0.875rem;
    margin-bottom: 4px;
  }
  
  .mount-point {
    font-size: 0.75rem;
    color: var(--el-text-color-secondary);
    font-family: monospace;
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
  }
}

.mount-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.option-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  height: auto;
  
  &.more {
    background: transparent;
    border: 1px dashed var(--el-border-color);
  }
}

.no-options {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.mount-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  gap: 4px;
}

.mount-action-btn {
  width: 28px;
  height: 28px;
  
  &:hover {
    transform: scale(1.1);
  }
}

/* Performance */
.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.perf-card {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
}

.perf-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.perf-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perf-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
  
  label {
    font-size: 0.875rem;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }
  
  .perf-value {
    font-weight: 600;
    color: var(--el-color-primary);
    font-family: monospace;
    font-size: 1rem;
  }
}

.no-perf {
  text-align: center;
  padding: 20px;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 80px 24px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 12px;
  border: 2px dashed color-mix(in srgb, var(--el-border-color) 50%, transparent);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.02);
    border-color: color-mix(in srgb, var(--el-border-color) 50%, #334155);
  }
  
  h3 {
    margin: 16px 0 8px;
    color: var(--el-text-color-primary);
  }
  
  p {
    margin-bottom: 24px;
  }
}

.discover-btn {
  margin-top: 16px;
  padding: 12px 24px;
  font-size: 1rem;
}

/* Dialog montowania */
.mount-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  background: var(--el-bg-color);
  
  :global(.dark) &,
  :global(body.dark) & {
    background: #1e293b;
  }
}

.mount-form {
  padding: 0 24px;
}

.base-path-radio {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  
  .el-radio {
    display: flex;
    align-items: center;
    margin-right: 0;
  }
}

.custom-path-input {
  margin-top: 8px;
}

.path-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  
  .suggestion-tag {
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--el-color-primary);
      color: white;
      border-color: var(--el-color-primary);
    }
  }
}

.path-prefix {
  color: var(--el-color-primary);
  font-weight: 500;
  font-size: 0.85rem;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.options-checkboxes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
}

.config-hint {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  strong {
    color: var(--el-color-primary);
    font-family: monospace;
  }
}

/* Benchmark */
.benchmark-results {
  padding: 20px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
  
  :global(.dark) &,
  :global(body.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
  
  label {
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }
  
  .result-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--el-color-primary);
    font-family: monospace;
  }
}

/* Responsywność */
@media (max-width: 768px) {
  .nfs-client-modern {
    padding: 16px;
  }
  
  .role-header {
    flex-direction: column;
    text-align: center;
  }
  
  .role-meta {
    justify-content: center;
  }
  
  .role-actions {
    align-items: center;
    min-width: auto;
  }
  
  .scan-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .network-selector {
    flex-direction: column;
  }
  
  .auto-scan-info {
    flex-direction: column;
    align-items: flex-start !important;
  }
  
  .scan-info {
    flex-direction: column;
    align-items: flex-start !important;
    width: 100%;
  }
  
  .scan-stats {
    width: 100%;
    justify-content: space-between;
  }
  
  .scan-auto-btn {
    width: 100%;
  }
  
  .servers-grid,
  .mounts-grid,
  .performance-grid {
    grid-template-columns: 1fr;
  }
  
  .options-grid {
    grid-template-columns: 1fr;
  }
  
  .options-checkboxes {
    grid-template-columns: 1fr;
  }
  
  .base-path-radio {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .export-item {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .export-path {
    width: 100%;
  }
  
  .mount-actions {
    opacity: 1;
    position: static;
    justify-content: flex-end;
    margin-top: 12px;
  }
  
  .scan-status {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px;
  }
  
  .scan-status-right {
    width: 100%;
    justify-content: space-between;
  }
  
  .stop-scan-btn {
    margin-left: 0 !important;
  }
}

/* Animacje */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.server-card,
.mount-card,
.perf-card {
  animation: fadeInUp 0.3s ease;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
  
  &:hover {
    background: var(--el-color-primary);
  }
}

:global(.dark) ::-webkit-scrollbar-track,
:global(body.dark) ::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

:global(.dark) ::-webkit-scrollbar-thumb,
:global(body.dark) ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>
