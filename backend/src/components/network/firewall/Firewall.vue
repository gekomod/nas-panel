<template>
  <el-card 
    class="firewall-widget modern-card" 
    shadow="hover"
    :class="{ 'dark-mode': isDarkMode }"
  >
    <template #header>
      <div class="widget-header">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:firewall" />
          </div>
          <div class="header-text">
            <h1>Zapora sieciowa</h1>
            <p class="subtitle">Zarządzaj regułami firewall UFW i iptables</p>
          </div>
        </div>
        <div class="header-right">
          <div class="firewall-status">
            <el-switch
              v-model="firewallEnabled"
              class="firewall-switch"
              active-text="Wł."
              inactive-text="Wył."
              @change="toggleFirewall"
              :loading="togglingFirewall"
            />
            <el-tag 
              :type="firewallEnabled ? 'success' : 'danger'" 
              class="status-tag"
              effect="dark"
            >
              <Icon 
                :icon="firewallEnabled ? 'mdi:shield-check' : 'mdi:shield-off'" 
                width="14"
                style="margin-right: 4px;"
              />
              {{ firewallEnabled ? 'Aktywna' : 'Nieaktywna' }}
            </el-tag>
          </div>
        </div>
      </div>
    </template>

    <div class="firewall-content">
      <el-tabs 
        v-model="activeTab" 
        type="card" 
        class="modern-tabs"
        :class="{ 'dark-mode': isDarkMode }"
      >
        <!-- Wszystkie reguły -->
        <el-tab-pane name="all">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:format-list-bulleted" />
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
                :class="{ 'dark-mode': isDarkMode }"
              >
                <template #prefix>
                  <Icon icon="mdi:magnify" />
                </template>
              </el-input>
              
              <div class="action-buttons">
                <el-button 
                  type="primary" 
                  size="large" 
                  @click="showAddRuleDialog('ufw')" 
                  class="add-button"
                >
                  <Icon icon="mdi:plus" />
                  Dodaj UFW
                </el-button>
                <el-button 
                  type="warning" 
                  size="large" 
                  @click="showAddRuleDialog('iptables')" 
                  class="add-button"
                >
                  <Icon icon="mdi:plus" />
                  Dodaj iptables
                </el-button>
                <el-button 
                  type="info" 
                  size="large" 
                  @click="fetchAllFirewallRules" 
                  :loading="loading"
                >
                  <Icon icon="mdi:refresh" />
                  Odśwież
                </el-button>
              </div>
            </div>

            <el-table 
              :data="filteredRules" 
              style="width: 100%" 
              v-loading="loading"
              :empty-text="searchQuery ? 'Brak wyników wyszukiwania' : 'Brak reguł zapory'"
              class="rules-table"
              :class="{ 'dark-mode': isDarkMode }"
              stripe
              height="400"
            >
              <el-table-column label="Typ" width="90" fixed="left">
                <template #default="{ row }">
                  <el-tag 
                    :type="row.source === 'ufw' ? 'primary' : 'warning'" 
                    class="source-tag"
                    size="small"
                    effect="dark"
                  >
                    <Icon 
                      :icon="row.source === 'ufw' ? 'mdi:shield-check' : 'mdi:network'" 
                      width="12"
                      style="margin-right: 4px;"
                    />
                    {{ row.source ? row.source.toUpperCase() : '?' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Protokół" width="100">
                <template #default="{ row }">
                  <el-tag class="protocol-tag" size="small">
                    <Icon 
                      v-if="row.protocol === 'tcp' || row.protocol === 'udp'"
                      :icon="row.protocol === 'tcp' ? 'mdi:lan' : 'mdi:cast'" 
                      width="12"
                      style="margin-right: 4px;"
                    />
                    {{ row.protocol || 'all' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Port" width="90">
                <template #default="{ row }">
                  <span class="port-value">
                    <Icon icon="mdi:ethernet-port" width="14" style="margin-right: 4px;" />
                    {{ row.port || 'any' }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column label="Źródło" min-width="120">
                <template #default="{ row }">
                  <span class="address-value">
                    <Icon icon="mdi:arrow-right-bold" width="12" style="margin-right: 4px;" />
                    {{ row.source_ip || row.source || 'any' }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column label="Cel" min-width="120">
                <template #default="{ row }">
                  <span class="address-value">
                    <Icon icon="mdi:target" width="12" style="margin-right: 4px;" />
                    {{ row.destination || row.target || 'any' }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column label="Akcja" width="100">
                <template #default="{ row }">
                  <el-tag 
                    :type="getActionType(row.target || row.action)"
                    class="action-tag"
                    size="small"
                    effect="dark"
                  >
                    <Icon 
                      :icon="getActionIcon(row.target || row.action)" 
                      width="12"
                      style="margin-right: 4px;"
                    />
                    {{ getActionText(row.target || row.action) }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column label="Komentarz" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="comment-text">
                    <Icon icon="mdi:message-text" width="12" style="margin-right: 4px; opacity: 0.7;" />
                    {{ row.comment || '—' }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column label="Operacje" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="deleteRule(row)"
                    :disabled="!row.source"
                    class="delete-button"
                    :loading="deletingRuleId === (row.id || row.num)"
                  >
                    <el-icon>
                      <Icon icon="mdi:delete" />
                    </el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <div class="table-footer" v-if="filteredRules.length > 0">
              <span class="result-count">
                <Icon icon="mdi:information" width="14" style="margin-right: 6px;" />
                Znaleziono {{ filteredRules.length }} reguł
              </span>
              <div class="filter-info" v-if="searchQuery">
                <el-tag size="small">
                  <Icon icon="mdi:filter" width="12" style="margin-right: 4px;" />
                  Filtrowanie: "{{ searchQuery }}"
                </el-tag>
                <el-button link @click="searchQuery = ''">
                  <Icon icon="mdi:close-circle" width="14" style="margin-right: 4px;" />
                  Wyczyść
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tylko UFW -->
        <el-tab-pane name="ufw">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:shield-check" />
              Tylko UFW
              <el-badge :value="stats.ufwRules" :max="99" class="tab-badge" />
            </span>
          </template>
          <div class="tab-content">
            <el-alert 
              v-if="ufwRules.length === 0" 
              type="info" 
              title="Brak reguł UFW" 
              show-icon
              :closable="false"
            >
              <template #icon>
                <Icon icon="mdi:information" />
              </template>
              <p>Nie znaleziono reguł zapory UFW. Dodaj pierwszą regułę korzystając z przycisku powyżej.</p>
            </el-alert>
            <el-table 
              v-else 
              :data="ufwRules" 
              style="width: 100%" 
              stripe 
              height="400"
              :class="{ 'dark-mode': isDarkMode }"
            >
              <el-table-column label="Typ" width="100">
                <template #default="{ row }">
                  <el-tag type="primary" effect="dark">
                    <Icon icon="mdi:shield-check" width="12" style="margin-right: 4px;" />
                    UFW
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column label="Protokół" width="120">
                <template #default="{ row }">
                  <el-tag>
                    {{ row.protocol || 'all' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="port" label="Port" width="120" />
              <el-table-column prop="target" label="Cel" />
              <el-table-column label="Akcja" width="120">
                <template #default="{ row }">
                  <el-tag :type="getActionType(row.action)" effect="dark">
                    {{ getActionText(row.action) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="comment" label="Komentarz" />
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Tylko iptables -->
        <el-tab-pane name="iptables">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:network" />
              Tylko iptables
              <el-badge :value="stats.iptablesRules" :max="99" class="tab-badge" />
            </span>
          </template>
          <div class="tab-content">
            <el-alert 
              v-if="iptablesRules.length === 0" 
              type="info" 
              title="Brak reguł iptables" 
              show-icon
              :closable="false"
            >
              <template #icon>
                <Icon icon="mdi:information" />
              </template>
              <p>Nie znaleziono reguł iptables. Dodaj pierwszą regułę korzystając z przycisku powyżej.</p>
            </el-alert>
            <el-table 
              v-else 
              :data="iptablesRules" 
              style="width: 100%" 
              stripe 
              height="400"
              :class="{ 'dark-mode': isDarkMode }"
            >
              <el-table-column label="Typ" width="100">
                <template #default="{ row }">
                  <el-tag type="warning" effect="dark">
                    <Icon icon="mdi:network" width="12" style="margin-right: 4px;" />
                    IPTABLES
                  </el-tag>
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
                  <el-tag :type="getActionType(row.target)" effect="dark">
                    {{ row.target }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="options" label="Opcje" show-overflow-tooltip />
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Statystyki -->
        <el-tab-pane name="stats">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:chart-box" />
              Statystyki
            </span>
          </template>
          <div class="tab-content">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-card shadow="never" class="stat-card" :class="{ 'dark-mode': isDarkMode }">
                  <template #header>
                    <div class="stat-card-header">
                      <Icon icon="mdi:chart-pie" />
                      <span>Podsumowanie reguł</span>
                    </div>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="Wszystkie reguły">
                      <el-tag type="info" effect="dark">
                        <Icon icon="mdi:format-list-bulleted" width="12" style="margin-right: 4px;" />
                        {{ stats.totalRules || 0 }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Reguły UFW">
                      <el-tag type="primary" effect="dark">
                        <Icon icon="mdi:shield-check" width="12" style="margin-right: 4px;" />
                        {{ stats.ufwRules || 0 }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Reguły iptables">
                      <el-tag type="warning" effect="dark">
                        <Icon icon="mdi:network" width="12" style="margin-right: 4px;" />
                        {{ stats.iptablesRules || 0 }}
                      </el-tag>
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card shadow="never" class="stat-card" :class="{ 'dark-mode': isDarkMode }">
                  <template #header>
                    <div class="stat-card-header">
                      <Icon icon="mdi:connection" />
                      <span>Statystyki połączeń</span>
                    </div>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="Zablokowane połączenia">
                      <el-tag type="danger" effect="dark">
                        <Icon icon="mdi:block-helper" width="12" style="margin-right: 4px;" />
                        {{ stats.blockedConnections || 0 }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Dozwolone połączenia">
                      <el-tag type="success" effect="dark">
                        <Icon icon="mdi:check-circle" width="12" style="margin-right: 4px;" />
                        {{ stats.allowedConnections || 0 }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="Ostatnia aktywność">
                      <Icon icon="mdi:clock-outline" width="14" style="margin-right: 6px; opacity: 0.7;" />
                      {{ stats.lastActivity || 'Brak danych' }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>
        
        <!-- Docker & UFW -->
        <el-tab-pane name="docker">
          <template #label>
            <span class="tab-label">
              <Icon icon="mdi:docker" />
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
      :class="{ 'dark-mode': isDarkMode }"
    >
      <template #header>
        <div class="dialog-header">
          <Icon icon="mdi:shield-plus" width="24" style="margin-right: 12px;" />
          <span>Dodaj nową regułę UFW</span>
        </div>
      </template>
      
      <el-form :model="newUfwRule" :rules="ufwRuleRules" ref="ufwRuleForm" label-width="140px">
        <el-form-item label="Nazwa reguły" prop="name">
          <el-input 
            v-model="newUfwRule.name" 
            placeholder="Nazwa identyfikująca regułę" 
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Protokół" prop="protocol">
          <el-select 
            v-model="newUfwRule.protocol" 
            placeholder="Wybierz protokół"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <el-option label="TCP" value="tcp">
              <Icon icon="mdi:lan" width="16" style="margin-right: 8px;" />
              TCP
            </el-option>
            <el-option label="UDP" value="udp">
              <Icon icon="mdi:cast" width="16" style="margin-right: 8px;" />
              UDP
            </el-option>
            <el-option label="ICMP" value="icmp">
              <Icon icon="mdi:satellite-uplink" width="16" style="margin-right: 8px;" />
              ICMP
            </el-option>
            <el-option label="Wszystkie" value="all">
              <Icon icon="mdi:all-inclusive" width="16" style="margin-right: 8px;" />
              Wszystkie
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Port" prop="port">
          <el-input-number
            v-model="newUfwRule.port"
            :min="1"
            :max="65535"
            controls-position="right"
            placeholder="Numer portu"
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Źródło (IP/CIDR)" prop="source">
          <el-input 
            v-model="newUfwRule.source" 
            placeholder="np. 192.168.1.0/24 lub any" 
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Akcja" prop="action">
          <el-radio-group v-model="newUfwRule.action">
            <el-radio-button value="allow">
              <Icon icon="mdi:check-circle" width="16" style="margin-right: 4px;" />
              Zezwól
            </el-radio-button>
            <el-radio-button value="deny">
              <Icon icon="mdi:block-helper" width="16" style="margin-right: 4px;" />
              Blokuj
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addUfwDialogVisible = false" :class="{ 'dark-mode': isDarkMode }">
            <Icon icon="mdi:close-circle" width="16" style="margin-right: 4px;" />
            Anuluj
          </el-button>
          <el-button 
            type="primary" 
            @click="addUfwRule" 
            :loading="addingRule"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <Icon icon="mdi:check" width="16" style="margin-right: 4px;" />
            Dodaj regułę
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Dialog dodawania reguły iptables -->
    <el-dialog
      v-model="addIptablesDialogVisible"
      title="Dodaj nową regułę iptables"
      width="600px"
      :close-on-click-modal="false"
      :class="{ 'dark-mode': isDarkMode }"
    >
      <template #header>
        <div class="dialog-header">
          <Icon icon="mdi:network-plus" width="24" style="margin-right: 12px;" />
          <span>Dodaj nową regułę iptables</span>
        </div>
      </template>
      
      <el-form :model="newIptablesRule" :rules="iptablesRuleRules" ref="iptablesRuleForm" label-width="140px">
        <el-form-item label="Łańcuch" prop="chain">
          <el-select 
            v-model="newIptablesRule.chain" 
            placeholder="Wybierz łańcuch"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <el-option label="INPUT" value="INPUT">
              <Icon icon="mdi:arrow-right-bold" width="16" style="margin-right: 8px;" />
              INPUT
            </el-option>
            <el-option label="OUTPUT" value="OUTPUT">
              <Icon icon="mdi:arrow-left-bold" width="16" style="margin-right: 8px;" />
              OUTPUT
            </el-option>
            <el-option label="FORWARD" value="FORWARD">
              <Icon icon="mdi:swap-horizontal" width="16" style="margin-right: 8px;" />
              FORWARD
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Protokół" prop="protocol">
          <el-select 
            v-model="newIptablesRule.protocol" 
            placeholder="Wybierz protokół"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <el-option label="TCP" value="tcp">
              <Icon icon="mdi:lan" width="16" style="margin-right: 8px;" />
              TCP
            </el-option>
            <el-option label="UDP" value="udp">
              <Icon icon="mdi:cast" width="16" style="margin-right: 8px;" />
              UDP
            </el-option>
            <el-option label="ICMP" value="icmp">
              <Icon icon="mdi:satellite-uplink" width="16" style="margin-right: 8px;" />
              ICMP
            </el-option>
            <el-option label="Wszystkie" value="all">
              <Icon icon="mdi:all-inclusive" width="16" style="margin-right: 8px;" />
              Wszystkie
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Port docelowy" prop="dport">
          <el-input-number
            v-model="newIptablesRule.dport"
            :min="1"
            :max="65535"
            controls-position="right"
            placeholder="Numer portu"
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Źródło (IP/CIDR)" prop="source">
          <el-input 
            v-model="newIptablesRule.source" 
            placeholder="np. 192.168.1.0/24" 
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Cel (IP/CIDR)" prop="destination">
          <el-input 
            v-model="newIptablesRule.destination" 
            placeholder="np. 192.168.1.10" 
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
        <el-form-item label="Akcja" prop="target">
          <el-select 
            v-model="newIptablesRule.target" 
            placeholder="Wybierz akcję"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <el-option label="ACCEPT" value="ACCEPT">
              <Icon icon="mdi:check-circle" width="16" style="margin-right: 8px;" />
              ACCEPT
            </el-option>
            <el-option label="DROP" value="DROP">
              <Icon icon="mdi:block-helper" width="16" style="margin-right: 8px;" />
              DROP
            </el-option>
            <el-option label="REJECT" value="REJECT">
              <Icon icon="mdi:cancel" width="16" style="margin-right: 8px;" />
              REJECT
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Komentarz" prop="comment">
          <el-input 
            v-model="newIptablesRule.comment" 
            placeholder="Opis reguły" 
            type="textarea"
            :rows="2"
            :class="{ 'dark-mode': isDarkMode }"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addIptablesDialogVisible = false" :class="{ 'dark-mode': isDarkMode }">
            <Icon icon="mdi:close-circle" width="16" style="margin-right: 4px;" />
            Anuluj
          </el-button>
          <el-button 
            type="primary" 
            @click="addIptablesRule" 
            :loading="addingRule"
            :class="{ 'dark-mode': isDarkMode }"
          >
            <Icon icon="mdi:check" width="16" style="margin-right: 4px;" />
            Dodaj regułę
          </el-button>
        </div>
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
import { useTheme } from '@/composables/useTheme'

const { isDarkMode } = useTheme()

// Stan komponentu
const firewallEnabled = ref(false)
const rules = ref([])
const loading = ref(false)
const togglingFirewall = ref(false)
const addingRule = ref(false)
const deletingRuleId = ref(null)
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

const getActionIcon = (action) => {
  if (['allow', 'ACCEPT'].includes(action)) return 'mdi:check-circle'
  if (['deny', 'DROP', 'REJECT'].includes(action)) return 'mdi:block-helper'
  return 'mdi:information'
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
    togglingFirewall.value = true
    const action = firewallEnabled.value ? 'enable' : 'disable'
    await axios.post(`/network/firewall/status/${action}`)
    ElMessage.success(`Zapora ${firewallEnabled.value ? 'włączona' : 'wyłączona'}`)
    fetchAllFirewallRules()
  } catch (error) {
    firewallEnabled.value = !firewallEnabled.value
    ElMessage.error(`Błąd podczas zmiany stanu zapory: ${error.message}`)
  } finally {
    togglingFirewall.value = false
  }
}

const showAddRuleDialog = (type) => {
  if (type === 'ufw') {
    resetUfwRuleForm()
    addUfwDialogVisible.value = true
  } else {
    resetIptablesRuleForm()
    addIptablesDialogVisible.value = true
  }
}

const addUfwRule = async () => {
  try {
    addingRule.value = true
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
  } finally {
    addingRule.value = false
  }
}

const addIptablesRule = async () => {
  try {
    addingRule.value = true
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
  } finally {
    addingRule.value = false
  }
}

const deleteRule = async (rule) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć tę regułę?',
      'Potwierdzenie usunięcia',
      { 
        type: 'warning',
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj'
      }
    )

    deletingRuleId.value = rule.id || rule.num

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
  } finally {
    deletingRuleId.value = null
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
  ufwRuleForm.value?.clearValidate()
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
  iptablesRuleForm.value?.clearValidate()
}
</script>

<style scoped>
.firewall-widget {
  border-radius: 16px;
  margin: 20px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.firewall-widget.dark-mode {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-color: #334155;
  color: #e2e8f0;
}

.firewall-widget:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.widget-header {
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

.header-text.dark-mode h1 {
  color: #f1f5f9;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.firewall-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-tag {
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 20px;
}

.modern-tabs {
  border-radius: 16px;
}

.modern-tabs.dark-mode :deep(.el-tabs__header) {
  background: #1e293b;
  border-color: #334155;
}

.modern-tabs.dark-mode :deep(.el-tabs__item) {
  color: #94a3b8;
}

.modern-tabs.dark-mode :deep(.el-tabs__item.is-active) {
  color: #3b82f6;
  background: #0f172a;
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

.rules-container {
  padding: 24px;
}

.rules-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 300px;
}

.search-input :deep(.el-input__inner) {
  border-radius: 12px;
  height: 48px;
  padding-left: 44px;
}

.search-input.dark-mode :deep(.el-input__inner) {
  background: #1e293b;
  border-color: #475569;
  color: #f1f5f9;
}

.action-buttons {
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

.rules-table {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.rules-table.dark-mode :deep(.el-table) {
  background: #1e293b;
  color: #f1f5f9;
}

.rules-table.dark-mode :deep(.el-table__header) th {
  background: #0f172a;
  color: #cbd5e1;
  border-color: #334155;
}

.rules-table.dark-mode :deep(.el-table__row) {
  background: #1e293b;
}

.rules-table.dark-mode :deep(.el-table__row:hover) {
  background: #334155;
}

.rules-table :deep(.el-table__header) th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
  border-color: #e2e8f0;
}

.source-tag, .action-tag {
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.protocol-tag {
  background: #e0e7ff;
  color: #3730a3;
  border: none;
  display: flex;
  align-items: center;
}

.rules-table.dark-mode :deep(.protocol-tag) {
  background: #3730a3;
  color: #e0e7ff;
}

.port-value, .address-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.port-value {
  color: #059669;
}

.address-value {
  color: #6366f1;
}

.comment-text {
  color: #6b7280;
  font-size: 0.9em;
  display: flex;
  align-items: center;
}

.rules-table.dark-mode :deep(.comment-text) {
  color: #94a3b8;
}

.delete-button {
  border-radius: 50%;
  width: 32px;
  height: 32px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding: 16px 0;
  border-top: 1px solid #e2e8f0;
}

.rules-container.dark-mode .table-footer {
  border-color: #334155;
}

.result-count {
  color: #64748b;
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.filter-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-content {
  padding: 24px;
}

.stat-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
}

.stat-card.dark-mode {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

.stat-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: #1e293b;
}

.stat-card.dark-mode .stat-card-header {
  color: #f1f5f9;
}

:deep(.el-tabs__header) {
  margin: 0;
  padding: 0 24px;
  background: transparent;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0;
}

:deep(.el-tabs__item) {
  padding: 0 24px;
  height: 48px;
  font-weight: 500;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s ease;
}

:deep(.el-tabs__content) {
  padding: 0;
}

.dialog-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  color: #1e293b;
}

.dark-mode .dialog-header {
  color: #f1f5f9;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
  .firewall-widget {
    margin: 10px;
  }
  
  .widget-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    text-align: center;
  }
  
  .header-left {
    flex-direction: column;
    text-align: center;
  }
  
  .header-right {
    justify-content: center;
  }
  
  .firewall-status {
    flex-direction: column;
    gap: 12px;
  }
  
  .rules-table {
    font-size: 0.8em;
  }
  
  .tab-content {
    padding: 16px;
  }
  
  :deep(.el-tabs__item) {
    padding: 0 16px;
    font-size: 0.9em;
  }
}

@media (max-width: 480px) {
  .header-text h1 {
    font-size: 24px;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .add-button, :deep(.el-button) {
    width: 100%;
    justify-content: center;
  }
}

/* Dark mode overrides */
:deep(.dark-mode .el-card) {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

:deep(.dark-mode .el-card__header) {
  border-color: #334155;
}

:deep(.dark-mode .el-input__inner),
:deep(.dark-mode .el-textarea__inner) {
  background: #1e293b;
  border-color: #475569;
  color: #f1f5f9;
}

:deep(.dark-mode .el-select .el-input__inner) {
  background: #1e293b;
  color: #f1f5f9;
}

:deep(.dark-mode .el-input-number__decrease),
:deep(.dark-mode .el-input-number__increase) {
  background: #334155;
  border-color: #475569;
  color: #cbd5e1;
}

:deep(.dark-mode .el-radio-button__inner) {
  background: #1e293b;
  border-color: #475569;
  color: #cbd5e1;
}

:deep(.dark-mode .el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.dark-mode .el-dialog) {
  background: #1e293b;
  border-color: #334155;
}

:deep(.dark-mode .el-dialog__header) {
  color: #f1f5f9;
  border-color: #334155;
}

:deep(.dark-mode .el-form-item__label) {
  color: #cbd5e1;
}

:deep(.dark-mode .el-alert) {
  background: #1e293b;
  border-color: #334155;
  color: #cbd5e1;
}

:deep(.dark-mode .el-alert__title) {
  color: #f1f5f9;
}

/* Animacje */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.rules-container, .tab-content {
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

:deep(.el-table__body-wrapper.dark-mode::-webkit-scrollbar-track) {
  background: #334155;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #cbd5e1;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper.dark-mode::-webkit-scrollbar-thumb) {
  background: #64748b;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #94a3b8;
}

/* Hover effects for interactive elements */
:deep(.el-table__row:hover) {
  background-color: #f8fafc;
}

:deep(.el-table.dark-mode .el-table__row:hover) {
  background-color: #334155;
}

.delete-button:hover {
  transform: scale(1.1);
  transition: transform 0.2s ease;
}
</style>
