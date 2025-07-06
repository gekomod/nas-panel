<template>
  <el-card class="firewall-widget" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:firewall" width="20" />
        <span>Zapora sieciowa</span>
          <el-switch
            v-model="firewallEnabled"
            class="firewall-switch"
            @change="toggleFirewall"
          />
          
          <div class="status-message">
            <el-tag :type="firewallEnabled ? 'success' : 'danger'">
              {{ currentStatusText }}
            </el-tag>
          </div>
      </div>
    </template>

    <div class="firewall-content">
      <el-tabs type="border-card" class="firewall-tabs">
        <el-tab-pane label="Reguły">
          <div class="rules-container">
            <div class="rules-header">
              <el-input
                v-model="searchQuery"
                placeholder="Filtruj reguły..."
                clearable
                size="small"
                class="search-input"
              >
                <template #prefix>
                  <Icon icon="mdi:magnify" width="16" />
                </template>
              </el-input>
              <el-button type="primary" size="small" @click="showAddRuleDialog">
                <Icon icon="mdi:plus" width="16" />
                Dodaj regułę
              </el-button>
            </div>

             <el-table :data="rules" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="Protokół" width="120">
        <template #default="{ row }">
          <el-tag>{{ row.protocol }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="port" label="Port" width="120" />
      <el-table-column label="Akcja" width="120">
        <template #default="{ row }">
          <el-tag :type="row.action === 'allow' ? 'success' : 'danger'">
            {{ row.action === 'allow' ? 'Zezwól' : 'Blokuj' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="Cel" />
      <el-table-column prop="comment" label="Komentarz" />
      <el-table-column label="Operacje" width="120">
        <template #default="{ row }">
          <el-button
            type="danger"
            size="small"
            @click="deleteRule(row.id)"
          >
          <Icon icon="mdi:delete" width="16" />
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    
          </div>
        </el-tab-pane>

        <el-tab-pane label="Statystyki">
          <div class="stats-container">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="Zablokowane połączenia">
                {{ stats.blockedConnections || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="Dozwolone połączenia">
                {{ stats.allowedConnections || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="Ostatnia aktywność">
                {{ stats.lastActivity || 'Brak danych' }}
              </el-descriptions-item>
              <el-descriptions-item label="Wersja">
                {{ stats.version || 'n/a' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Dialog dodawania reguły -->
    <el-dialog
      v-model="addRuleDialogVisible"
      title="Dodaj nową regułę"
      width="500px"
    >
      <el-form :model="newRule" :rules="ruleRules" ref="ruleForm">
        <el-form-item label="Nazwa reguły" prop="name">
          <el-input v-model="newRule.name" />
        </el-form-item>
        <el-form-item label="Protokół" prop="protocol">
          <el-select v-model="newRule.protocol" placeholder="Wybierz protokół">
            <el-option label="TCP" value="tcp" />
            <el-option label="UDP" value="udp" />
            <el-option label="ICMP" value="icmp" />
            <el-option label="Wszystkie" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="Port" prop="port">
          <el-input-number
            v-model="newRule.port"
            :min="1"
            :max="65535"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="Źródło (IP/CIDR)" prop="source">
          <el-input v-model="newRule.source" placeholder="np. 192.168.1.0/24" />
        </el-form-item>
        <el-form-item :label="$t('network.firewall.rule_action')" prop="action">
	  <el-radio-group v-model="newRule.action">
	    <el-radio-button :value="'allow'">
	      {{ $t('network.firewall.actions.allow') }}
	    </el-radio-button>
	    <el-radio-button :value="'deny'">
	      {{ $t('network.firewall.actions.deny') }}
	    </el-radio-button>
	  </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addRuleDialogVisible = false">Anuluj</el-button>
        <el-button type="primary" @click="addNewRule">Dodaj regułę</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const firewallEnabled = ref(false)
const rules = ref([])
const ruleForm = ref([])
const stats = ref({})
const loading = ref(false)
const addRuleDialogVisible = ref(false)
const searchQuery = ref('')

const newRule = reactive({
  name: '',
  protocol: 'tcp',
  port: 80,
  source: 'any',
  action: 'allow'
})

const currentStatusText = computed(() => {
  return firewallEnabled.value 
    ? t('network.firewall.status.active') 
    : t('network.firewall.status.inactive')
})

const ruleRules = {
  name: [{ required: true, message: 'Nazwa reguły jest wymagana', trigger: 'blur' }],
  protocol: [{ required: true, message: 'Wybierz protokół', trigger: 'change' }],
  port: [{ required: true, message: 'Podaj port', trigger: 'blur' }],
  source: [{ required: true, message: 'Podaj źródło', trigger: 'blur' }]
}

const filteredRules = computed(() => {
  if (!searchQuery.value) return rules.value
  return rules.value.filter(rule =>
    rule.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    rule.protocol.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    rule.port.toString().includes(searchQuery.value) ||
    rule.source.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const parseProtocol = (portString) => {
  const match = portString.match(/(\d+)\/(tcp|udp)/)
  return match ? match[2] : 'tcp'
}

const parsePort = (portString) => {
  const match = portString.match(/(\d+)\/(tcp|udp)/)
  return match ? match[1] : portString
}

onMounted(() => {
  fetchFirewallStatus()
  fetchFirewallRules()
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

const fetchFirewallRules = async () => {
  try {
    loading.value = true
    const response = await axios.get('/network/firewall/rules')
    
    // Przetwarzanie danych z API
    rules.value = response.data.data.map(rule => ({
      ...rule,
      protocol: parseProtocol(rule.port),
      port: parsePort(rule.port),
      isIpv6: rule.target.includes('(v6)')
    }))
    
  } catch (error) {
    ElMessage.error('Błąd pobierania reguł zapory: ' + error.message)
  } finally {
    loading.value = false
  }
}

const fetchFirewallStats = async () => {
  try {
    const response = await axios.get('/network/firewall/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error)
  }
}

const toggleFirewall = async () => {
  try {
    const action = firewallEnabled.value ? 'enable' : 'disable'
    await axios.post(`/network/firewall/status/${action}`)
    ElMessage.success(`Zapora ${firewallEnabled.value ? 'włączona' : 'wyłączona'}`)
  } catch (error) {
    firewallEnabled.value = !firewallEnabled.value
    ElMessage.error(`Błąd podczas ${firewallEnabled.value ? 'włączania' : 'wyłączania'} zapory: ${error.message}`)
  }
}

const showAddRuleDialog = () => {
  addRuleDialogVisible.value = true
}

const addNewRule = async () => {
  try {
    await ruleForm.value.validate()
    const response = await axios.post('/network/firewall/rules', {
      name: newRule.name,
      protocol: newRule.protocol,
      port: newRule.port,
      source: newRule.source,
      action: newRule.action
    })
    
    rules.value.push(response.data)
    addRuleDialogVisible.value = false
    ElMessage.success('Reguła dodana pomyślnie')
    resetNewRuleForm()
    fetchFirewallRules()
  } catch (error) {
    ElMessage.error('Błąd dodawania reguły: ' + (error.response?.data?.message || error.message))
    console.error('Error details:', error.response?.data)
  }
}

const deleteRule = async (ruleId) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć tę regułę?',
      'Potwierdzenie usunięcia',
      { type: 'warning' }
    )
    await axios.delete(`/network/firewall/rules/${ruleId}`)
    rules.value = rules.value.filter(rule => rule.id !== ruleId)
    ElMessage.success('Reguła usunięta pomyślnie')
    await fetchFirewallRules();
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification({
        title: 'Błąd',
        message: error.response?.data?.error || 'Nie udało się usunąć reguły',
        type: 'error'
      });
    }
  }
}

const resetNewRuleForm = () => {
  Object.assign(newRule, {
    name: '',
    protocol: 'tcp',
    port: 80,
    source: 'any',
    action: 'allow'
  })
}
</script>

<style scoped>
.firewall-widget {
  border-radius: 8px;
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.firewall-switch {
  margin-left: auto;
}

.firewall-content {
  padding-top: 12px;
}

.firewall-tabs {
  border-radius: 6px;
}

.rules-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rules-header {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
}

.stats-container {
  padding: 12px;
}
</style>
