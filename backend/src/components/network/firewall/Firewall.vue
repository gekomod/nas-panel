<template>
  <el-card class="firewall-widget modern-card" shadow="hover">
    <template #header>
      <div class="widget-header">
        <div class="header-left">
          <Icon icon="mdi:firewall" width="24" class="header-icon" />
          <span class="header-title">Zapora sieciowa</span>
        </div>
        <div class="header-right">
          <el-switch
            v-model="firewallEnabled"
            class="firewall-switch"
            active-text="Wł."
            inactive-text="Wył."
            @change="toggleFirewall"
          />
          <el-tag :type="firewallEnabled ? 'success' : 'danger'" class="status-tag">
            {{ firewallEnabled ? 'Aktywna' : 'Nieaktywna' }}
          </el-tag>
        </div>
      </div>
    </template>

    <div class="firewall-content">
      <el-tabs type="card" class="modern-tabs" v-model="activeTab">
        <el-tab-pane name="all">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:format-list-bulleted" width="16" />
              Wszystkie reguły
              <el-badge :value="stats.totalRules" :max="99" class="tab-badge" />
            </span>
          </template>
          
          <div class="rules-container">
            <div class="rules-toolbar">
              <el-input
                v-model="searchQuery"
                placeholder="Szukaj reguł..."
                clearable
                size="large"
                class="search-input"
              >
                <template #prefix>
                  <Icon icon="mdi:magnify" width="18" />
                </template>
              </el-input>
              
              <el-button-group class="action-buttons">
                <el-button type="primary" size="large" @click="showAddRuleDialog('ufw')" class="add-button">
                  <Icon icon="mdi:plus" width="18" />
                  Dodaj UFW
                </el-button>
                <el-button type="primary" size="large" @click="showAddRuleDialog('iptables')" class="add-button">
                  <Icon icon="mdi:plus" width="18" />
                  Dodaj iptables
                </el-button>
                <el-button type="info" size="large" @click="fetchAllFirewallRules" :loading="loading">
                  <Icon icon="mdi:refresh" width="18" />
                  Odśwież
                </el-button>
              </el-button-group>
            </div>

            <el-table 
              :data="filteredRules" 
              style="width: 100%" 
              v-loading="loading"
              :empty-text="searchQuery ? 'Brak wyników wyszukiwania' : 'Brak reguł zapory'"
              class="rules-table"
              stripe
              height="400"
            >
              <el-table-column label="Typ" width="90" fixed="left">
                <template #default="{ row }">
                  <el-tag 
                    :type="row.source === 'ufw' ? 'primary' : 'warning'" 
                    class="source-tag"
                    size="small"
                  >
                    {{ row.source ? row.source.toUpperCase() : '?' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Protokół" width="100">
                <template #default="{ row }">
                  <el-tag class="protocol-tag" size="small">
                    {{ row.protocol || 'all' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Port" width="90">
                <template #default="{ row }">
                  <span class="port-value">{{ row.port || 'any' }}</span>
                </template>
              </el-table-column>
              
              <el-table-column label="Źródło" min-width="120">
                <template #default="{ row }">
                  <span class="address-value">{{ row.source_ip || row.source || 'any' }}</span>
                </template>
              </el-table-column>
              
              <el-table-column label="Cel" min-width="120">
                <template #default="{ row }">
                  <span class="address-value">{{ row.destination || row.target || 'any' }}</span>
                </template>
              </el-table-column>
              
              <el-table-column label="Akcja" width="100">
                <template #default="{ row }">
                  <el-tag 
                    :type="getActionType(row.target || row.action)"
                    class="action-tag"
                    size="small"
                  >
                    {{ getActionText(row.target || row.action) }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Komentarz" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="comment-text">{{ row.comment || '—' }}</span>
                </template>
              </el-table-column>
              
              <el-table-column label="Operacje" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="danger"
                    size="small"
                    @click="deleteRule(row)"
                    :disabled="!row.source"
                    class="delete-button"
                    icon="Delete"
                  />
                </template>
              </el-table-column>
            </el-table>

            <div class="table-footer" v-if="filteredRules.length > 0">
              <span class="result-count">Znaleziono {{ filteredRules.length }} reguł</span>
              <div class="filter-info" v-if="searchQuery">
                <el-tag size="small">Filtrowanie: "{{ searchQuery }}"</el-tag>
                <el-button link @click="searchQuery = ''">Wyczyść</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="ufw">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:shield-check" width="16" />
              Tylko UFW
              <el-badge :value="stats.ufwRules" :max="99" class="tab-badge" />
            </span>
          </template>
          <div class="tab-content">
            <el-alert v-if="ufwRules.length === 0" type="info" title="Brak reguł UFW" show-icon>
              <p>Nie znaleziono reguł zapory UFW. Dodaj pierwszą regułę korzystając z przycisku powyżej.</p>
            </el-alert>
            <el-table v-else :data="ufwRules" style="width: 100%" stripe height="400">
              <el-table-column label="Typ" width="100">
                <template #default="{ row }">
                  <el-tag type="primary">UFW</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column label="Protokół" width="120">
                <template #default="{ row }">
                  <el-tag>{{ row.protocol || 'all' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="port" label="Port" width="120" />
              <el-table-column prop="target" label="Cel" />
              <el-table-column label="Akcja" width="120">
                <template #default="{ row }">
                  <el-tag :type="getActionType(row.action)">
                    {{ getActionText(row.action) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="comment" label="Komentarz" />
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane name="iptables">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:network" width="16" />
              Tylko iptables
              <el-badge :value="stats.iptablesRules" :max="99" class="tab-badge" />
            </span>
          </template>
          <div class="tab-content">
            <el-alert v-if="iptablesRules.length === 0" type="info" title="Brak reguł iptables" show-icon>
              <p>Nie znaleziono reguł iptables. Dodaj pierwszą regułę korzystając z przycisku powyżej.</p>
            </el-alert>
            <el-table v-else :data="iptablesRules" style="width: 100%" stripe height="400">
              <el-table-column label="Typ" width="100">
                <template #default="{ row }">
                  <el-tag type="warning">IPTABLES</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="chain" label="Łańcuch" width="100" />
              <el-table-column prop="num" label="Nr" width="60" />
              <el-table-column label="Protokół" width="100">
                <template #default="{ row }">
                  {{ row.protocol || 'all' }}
                </template>
              </el-table-column>
              <el-table-column label="Źródło">
                <template #default="{ row }">
                  {{ row.source || 'any' }}
                </template>
              </el-table-column>
              <el-table-column label="Cel">
                <template #default="{ row }">
                  {{ row.destination || 'any' }}
                </template>
              </el-table-column>
              <el-table-column label="Akcja" width="100">
                <template #default="{ row }">
                  <el-tag :type="getActionType(row.target)">
                    {{ row.target }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="options" label="Opcje" show-overflow-tooltip />
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane name="stats">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:chart-box" width="16" />
              Statystyki
            </span>
          </template>
          <div class="tab-content">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-card shadow="never" class="stat-card">
                  <template #header>
                    <div class="stat-card-header">
                      <Icon icon="mdi:chart-pie" width="20" />
                      <span>Podsumowanie reguł</span>
                    </div>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="Wszystkie reguły">
                      <el-tag type="info">{{ stats.totalRules || 0 }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Reguły UFW">
                      <el-tag type="primary">{{ stats.ufwRules || 0 }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Reguły iptables">
                      <el-tag type="warning">{{ stats.iptablesRules || 0 }}</el-tag>
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card shadow="never" class="stat-card">
                  <template #header>
                    <div class="stat-card-header">
                      <Icon icon="mdi:connection" width="20" />
                      <span>Statystyki połączeń</span>
                    </div>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="Zablokowane połączenia">
                      <el-tag type="danger">{{ stats.blockedConnections || 0 }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Dozwolone połączenia">
                      <el-tag type="success">{{ stats.allowedConnections || 0 }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Ostatnia aktywność">
                      {{ stats.lastActivity || 'Brak danych' }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>
        
        <el-tab-pane name="docker">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:docker" width="16" />
              Docker & UFW
            </span>
          </template>
          <div class="tab-content">
            <DockerUfwIntegration />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Dialog dodawania reguły UFW -->
    <el-dialog
      v-model="addUfwDialogVisible"
      title="Dodaj nową regułę UFW"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="newUfwRule" :rules="ufwRuleRules" ref="ufwRuleForm" label-width="140px">
        <el-form-item label="Nazwa reguły" prop="name">
          <el-input v-model="newUfwRule.name" placeholder="Nazwa identyfikująca regułę" />
        </el-form-item>
        <el-form-item label="Protokół" prop="protocol">
          <el-select v-model="newUfwRule.protocol" placeholder="Wybierz protokół">
            <el-option label="TCP" value="tcp" />
            <el-option label="UDP" value="udp" />
            <el-option label="ICMP" value="icmp" />
            <el-option label="Wszystkie" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="Port" prop="port">
          <el-input-number
            v-model="newUfwRule.port"
            :min="1"
            :max="65535"
            controls-position="right"
            placeholder="Numer portu"
          />
        </el-form-item>
        <el-form-item label="Źródło (IP/CIDR)" prop="source">
          <el-input v-model="newUfwRule.source" placeholder="np. 192.168.1.0/24 lub any" />
        </el-form-item>
        <el-form-item label="Akcja" prop="action">
          <el-radio-group v-model="newUfwRule.action">
            <el-radio-button value="allow">Zezwól</el-radio-button>
            <el-radio-button value="deny">Blokuj</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addUfwDialogVisible = false">Anuluj</el-button>
        <el-button type="primary" @click="addUfwRule">Dodaj regułę</el-button>
      </template>
    </el-dialog>

    <!-- Dialog dodawania reguły iptables -->
    <el-dialog
      v-model="addIptablesDialogVisible"
      title="Dodaj nową regułę iptables"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="newIptablesRule" :rules="iptablesRuleRules" ref="iptablesRuleForm" label-width="140px">
        <el-form-item label="Łańcuch" prop="chain">
          <el-select v-model="newIptablesRule.chain" placeholder="Wybierz łańcuch">
            <el-option label="INPUT" value="INPUT" />
            <el-option label="OUTPUT" value="OUTPUT" />
            <el-option label="FORWARD" value="FORWARD" />
          </el-select>
        </el-form-item>
        <el-form-item label="Protokół" prop="protocol">
          <el-select v-model="newIptablesRule.protocol" placeholder="Wybierz protokół">
            <el-option label="TCP" value="tcp" />
            <el-option label="UDP" value="udp" />
            <el-option label="ICMP" value="icmp" />
            <el-option label="Wszystkie" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="Port docelowy" prop="dport">
          <el-input-number
            v-model="newIptablesRule.dport"
            :min="1"
            :max="65535"
            controls-position="right"
            placeholder="Numer portu"
          />
        </el-form-item>
        <el-form-item label="Źródło (IP/CIDR)" prop="source">
          <el-input v-model="newIptablesRule.source" placeholder="np. 192.168.1.0/24" />
        </el-form-item>
        <el-form-item label="Cel (IP/CIDR)" prop="destination">
          <el-input v-model="newIptablesRule.destination" placeholder="np. 192.168.1.10" />
        </el-form-item>
        <el-form-item label="Akcja" prop="target">
          <el-select v-model="newIptablesRule.target" placeholder="Wybierz akcję">
            <el-option label="ACCEPT" value="ACCEPT" />
            <el-option label="DROP" value="DROP" />
            <el-option label="REJECT" value="REJECT" />
          </el-select>
        </el-form-item>
        <el-form-item label="Komentarz" prop="comment">
          <el-input 
            v-model="newIptablesRule.comment" 
            placeholder="Opis reguły" 
            type="textarea"
            :rows="2"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addIptablesDialogVisible = false">Anuluj</el-button>
        <el-button type="primary" @click="addIptablesRule">Dodaj regułę</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import DockerUfwIntegration from './DockerUfwIntegration.vue'

const firewallEnabled = ref(false)
const rules = ref([])
const loading = ref(false)
const activeTab = ref('all')
const searchQuery = ref('')
const addUfwDialogVisible = ref(false)
const addIptablesDialogVisible = ref(false)
const ufwRuleForm = ref(null)
const iptablesRuleForm = ref(null)

const newUfwRule = reactive({
  name: '',
  protocol: 'tcp',
  port: 80,
  source: 'any',
  action: 'allow'
})

const newIptablesRule = reactive({
  chain: 'INPUT',
  protocol: 'tcp',
  dport: 80,
  source: '',
  destination: '',
  target: 'ACCEPT',
  comment: ''
})

const stats = reactive({
  totalRules: 0,
  ufwRules: 0,
  iptablesRules: 0,
  blockedConnections: 0,
  allowedConnections: 0,
  lastActivity: ''
})

const ufwRuleRules = {
  name: [{ required: true, message: 'Nazwa reguły jest wymagana', trigger: 'blur' }],
  protocol: [{ required: true, message: 'Wybierz protokół', trigger: 'change' }]
}

const iptablesRuleRules = {
  chain: [{ required: true, message: 'Wybierz łańcuch', trigger: 'change' }],
  target: [{ required: true, message: 'Wybierz akcję', trigger: 'change' }]
}

const filteredRules = computed(() => {
  if (!searchQuery.value) return rules.value
  const query = searchQuery.value.toLowerCase()
  return rules.value.filter(rule =>
    (rule.protocol || '').toLowerCase().includes(query) ||
    (rule.port || '').toString().includes(query) ||
    (rule.source || '').toLowerCase().includes(query) ||
    (rule.target || '').toLowerCase().includes(query) ||
    (rule.comment || '').toLowerCase().includes(query)
  )
})

const ufwRules = computed(() => rules.value.filter(rule => rule.source === 'ufw'))
const iptablesRules = computed(() => rules.value.filter(rule => rule.source === 'iptables'))

const getActionType = (action) => {
  if (['allow', 'ACCEPT'].includes(action)) return 'success'
  if (['deny', 'DROP', 'REJECT'].includes(action)) return 'danger'
  return 'info'
}

const getActionText = (action) => {
  const actions = {
    'allow': 'Zezwól',
    'ACCEPT': 'Zezwól',
    'deny': 'Blokuj',
    'DROP': 'Odrzuć',
    'REJECT': 'Odrzuć'
  }
  return actions[action] || action
}

onMounted(() => {
  fetchFirewallStatus()
  fetchAllFirewallRules()
  fetchFirewallStats()
})

const fetchFirewallStatus = async () => {
  try {
    const response = await axios.get('/network/firewall/status')
    firewallEnabled.value = response.data.enabled
  } catch (error) {
    ElMessage.error('Błąd pobierania statusu zapory: ' + error.message)
  }
}

const fetchAllFirewallRules = async () => {
  try {
    loading.value = true
    const response = await axios.get('/network/firewall/rules')
    
    let ufwRulesData = []
    let iptablesRulesData = []
    let counts = { total: 0, ufw: 0, iptables: 0 }

    if (response.data.success) {
      if (response.data.data && response.data.data.ufw) {
        ufwRulesData = Array.isArray(response.data.data.ufw) ? 
          response.data.data.ufw.map(rule => ({ ...rule, source: 'ufw' })) : []
      } else if (Array.isArray(response.data.data)) {
        ufwRulesData = response.data.data.map(rule => ({ ...rule, source: 'ufw' }))
      }

      if (response.data.data && response.data.data.iptables) {
        iptablesRulesData = Array.isArray(response.data.data.iptables) ? 
          response.data.data.iptables.map(rule => ({ ...rule, source: 'iptables' })) : []
      }

      if (response.data.counts) {
        counts = response.data.counts
      } else {
        counts = {
          total: ufwRulesData.length + iptablesRulesData.length,
          ufw: ufwRulesData.length,
          iptables: iptablesRulesData.length
        }
      }
    } else if (Array.isArray(response.data)) {
      ufwRulesData = response.data.map(rule => ({ ...rule, source: 'ufw' }))
      counts = {
        total: ufwRulesData.length,
        ufw: ufwRulesData.length,
        iptables: 0
      }
    }

    rules.value = [...ufwRulesData, ...iptablesRulesData]
    stats.totalRules = counts.total
    stats.ufwRules = counts.ufw
    stats.iptablesRules = counts.iptables

  } catch (error) {
    console.error('Błąd pobierania reguł:', error)
    ElMessage.error('Błąd pobierania reguł zapory: ' + error.message)
    rules.value = []
    stats.totalRules = 0
    stats.ufwRules = 0
    stats.iptablesRules = 0
  } finally {
    loading.value = false
  }
}

const fetchFirewallStats = async () => {
  try {
    const response = await axios.get('/network/firewall/stats')
    Object.assign(stats, response.data)
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error)
  }
}

const toggleFirewall = async () => {
  try {
    const action = firewallEnabled.value ? 'enable' : 'disable'
    await axios.post(`/network/firewall/status/${action}`)
    ElMessage.success(`Zapora ${firewallEnabled.value ? 'włączona' : 'wyłączona'}`)
    fetchAllFirewallRules()
  } catch (error) {
    firewallEnabled.value = !firewallEnabled.value
    ElMessage.error(`Błąd podczas zmiany stanu zapory: ${error.message}`)
  }
}

const showAddRuleDialog = (type) => {
  if (type === 'ufw') {
    addUfwDialogVisible.value = true
  } else {
    addIptablesDialogVisible.value = true
  }
}

const addUfwRule = async () => {
  try {
    await ufwRuleForm.value?.validate()
    const response = await axios.post('/network/firewall/rules', newUfwRule)
    ElMessage.success('Reguła UFW dodana pomyślnie')
    addUfwDialogVisible.value = false
    resetUfwRuleForm()
    fetchAllFirewallRules()
  } catch (error) {
    if (error.response?.data?.error) {
      ElMessage.error('Błąd: ' + error.response.data.error)
    } else if (error !== 'cancel') {
      ElMessage.error('Błąd dodawania reguły UFW: ' + error.message)
    }
  }
}

const addIptablesRule = async () => {
  try {
    await iptablesRuleForm.value?.validate()
    const response = await axios.post('/network/iptables/rules', newIptablesRule)
    ElMessage.success('Reguła iptables dodana pomyślnie')
    addIptablesDialogVisible.value = false
    resetIptablesRuleForm()
    fetchAllFirewallRules()
  } catch (error) {
    if (error.response?.data?.error) {
      ElMessage.error('Błąd: ' + error.response.data.error)
    } else if (error !== 'cancel') {
      ElMessage.error('Błąd dodawania reguły iptables: ' + error.message)
    }
  }
}

const deleteRule = async (rule) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć tę regułę?',
      'Potwierdzenie usunięcia',
      { type: 'warning' }
    )

    if (rule.source === 'ufw') {
      await axios.delete(`/network/firewall/rules/${rule.id}`)
    } else {
      await axios.delete(`/network/iptables/rules/${rule.chain}/${rule.num}`)
    }

    ElMessage.success('Reguła usunięta pomyślnie')
    fetchAllFirewallRules()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd usuwania reguły: ' + error.message)
    }
  }
}

const resetUfwRuleForm = () => {
  Object.assign(newUfwRule, {
    name: '',
    protocol: 'tcp',
    port: 80,
    source: 'any',
    action: 'allow'
  })
}

const resetIptablesRuleForm = () => {
  Object.assign(newIptablesRule, {
    chain: 'INPUT',
    protocol: 'tcp',
    dport: 80,
    source: '',
    destination: '',
    target: 'ACCEPT',
    comment: ''
  })
}
</script>

<style scoped>
.modern-card {
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: #3b82f6;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-tag {
  font-weight: 500;
  padding: 6px 12px;
}

.modern-tabs {
  border-radius: 8px;
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

.rules-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 300px;
}

.search-input :deep(.el-input__inner) {
  border-radius: 8px;
  height: 40px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.add-button {
  border-radius: 8px;
  font-weight: 500;
}

.rules-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.rules-table :deep(.el-table__header) th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

.source-tag {
  font-weight: 600;
  min-width: 50px;
  justify-content: center;
}

.protocol-tag {
  background: #e0e7ff;
  color: #3730a3;
  border: none;
}

.action-tag {
  font-weight: 600;
}

.port-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  color: #059669;
  font-weight: 500;
}

.address-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  color: #6366f1;
}

.comment-text {
  color: #6b7280;
  font-size: 0.9em;
}

.delete-button {
  border-radius: 6px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
}

.result-count {
  color: #6b7280;
  font-size: 0.9em;
}

.filter-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-content {
  padding: 16px 0;
}

.stat-card {
  border-radius: 8px;
}

.stat-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

:deep(.el-tabs__header) {
  margin: 0;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 16px;
}

:deep(.el-tabs__item) {
  padding: 0 20px;
  height: 44px;
  font-weight: 500;
}

:deep(.el-tabs__content) {
  padding: 20px;
}

/* Responsywność */
@media (max-width: 1024px) {
  .rules-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    min-width: auto;
  }
  
  .action-buttons {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .widget-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: center;
  }
  
  .rules-table {
    font-size: 0.8em;
  }
  
  .tab-content {
    padding: 8px 0;
  }
}
</style>
