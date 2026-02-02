<template>
  <div class="local-logs-container" :class="{ 'dark': isDark }">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>
          <el-icon><Icon icon="mdi:ethernet-cable" /></el-icon>
          Interfejsy sieciowe
        </h1>
        <p class="subtitle">Zarządzanie konfiguracją sieci</p>
      </div>
      <div class="header-right">
        <el-button-group>
          <el-button 
            @click="showAddDialog"
            type="primary"
            size="large"
          >
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            Dodaj interfejs
          </el-button>
          <el-button 
            type="primary"
            @click="loadInterfaces"
            :loading="loading"
            size="large"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            Odśwież
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- Filters Bar -->
    <el-card class="filters-bar" shadow="never">
      <div class="filters-content">
        <!-- Search -->
        <div class="filter-group">
          <el-input
            v-model="searchQuery"
            placeholder="Szukaj interfejsu..."
            clearable
            class="search-input"
            size="large"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
        </div>
        
        <!-- Status Filter -->
        <div class="filter-group">
          <el-select
            v-model="statusFilter"
            placeholder="Status"
            clearable
            class="filter-select"
            size="large"
          >
            <el-option label="Wszystkie" value="all" />
            <el-option value="up">
              <span class="status-option up">
                <el-icon><Icon icon="mdi:check-circle" /></el-icon>
                Aktywne
              </span>
            </el-option>
            <el-option value="down">
              <span class="status-option down">
                <el-icon><Icon icon="mdi:close-circle" /></el-icon>
                Nieaktywne
              </span>
            </el-option>
          </el-select>
        </div>
        
        <!-- Type Filter -->
        <div class="filter-group">
          <el-select
            v-model="typeFilter"
            placeholder="Typ"
            clearable
            class="filter-select"
            size="large"
          >
            <el-option label="Wszystkie" value="all" />
            <el-option value="ethernet">
              <span class="type-option">
                <el-icon><Icon icon="mdi:ethernet-cable" /></el-icon>
                Ethernet
              </span>
            </el-option>
            <el-option value="wireless">
              <span class="type-option">
                <el-icon><Icon icon="mdi:wifi" /></el-icon>
                Wireless
              </span>
            </el-option>
          </el-select>
        </div>
        
        <!-- Quick Stats -->
        <div class="stats-group">
          <el-tag size="large" type="info">
            <el-icon><Icon icon="mdi:server-network" /></el-icon>
            {{ interfaces.length }} interfejsów
          </el-tag>
          <el-tag size="large" type="success">
            <el-icon><Icon icon="mdi:check-circle" /></el-icon>
            {{ activeCount }} aktywnych
          </el-tag>
        </div>
        
        <!-- Quick Actions -->
        <div class="actions-group">
          <el-button 
            @click="clearFilters" 
            size="large"
            :disabled="!hasFilters"
          >
            <el-icon><Icon icon="mdi:filter-remove" /></el-icon>
            Wyczyść
          </el-button>
          <el-button 
            @click="exportToCSV" 
            size="large"
            :disabled="!interfaces.length"
          >
            <el-icon><Icon icon="mdi:export" /></el-icon>
            CSV
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Main Content - FULL WIDTH TABLE -->
    <div class="main-content">
      <el-card class="interfaces-card" shadow="never">
        <!-- Table Content -->
        <div class="table-content">
          <div v-if="loading" class="loading-state">
            <el-icon class="loading-icon" :size="48">
              <Icon icon="mdi:loading" />
            </el-icon>
            <p>Ładowanie interfejsów...</p>
          </div>
          
          <div v-else-if="!interfaces.length" class="empty-state">
            <el-icon :size="64">
              <Icon icon="mdi:network-off" />
            </el-icon>
            <h3>Brak interfejsów</h3>
            <p>Nie znaleziono interfejsów sieciowych</p>
            <el-button @click="loadInterfaces" type="primary">
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
              Spróbuj ponownie
            </el-button>
          </div>
          
          <div v-else-if="!filteredInterfaces.length" class="empty-state">
            <el-icon :size="64">
              <Icon icon="mdi:filter-off" />
            </el-icon>
            <h3>Brak wyników</h3>
            <p>Spróbuj zmienić filtry lub wyszukiwanie</p>
            <el-button @click="clearFilters" type="primary">
              <el-icon><Icon icon="mdi:filter-remove" /></el-icon>
              Wyczyść filtry
            </el-button>
          </div>
          
          <!-- TABLE - FULL WIDTH -->
          <div v-else class="table-wrapper">
            <el-table 
              :data="filteredInterfaces" 
              stripe 
              highlight-current-row
              @row-click="selectInterface"
              class="interfaces-table"
              :row-class-name="getRowClassName"
            >
              <!-- Device Column -->
              <el-table-column prop="device" label="Urządzenie" width="120">
                <template #default="{ row }">
                  <div class="device-cell">
                    <el-icon class="device-icon">
                      <Icon :icon="getInterfaceIcon(row.type)" />
                    </el-icon>
                    <span class="device-name">{{ row.device }}</span>
                  </div>
                </template>
              </el-table-column>
              
              <!-- Status Column -->
              <el-table-column prop="status" label="Status" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'up' ? 'success' : 'danger'" size="large">
                    <el-icon v-if="row.status === 'up'"><Icon icon="mdi:check-circle" /></el-icon>
                    <el-icon v-else><Icon icon="mdi:close-circle" /></el-icon>
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <!-- IP Address Column -->
              <el-table-column label="Adres IP" width="160">
                <template #default="{ row }">
                  <div v-if="row.address" class="ip-cell">
                    <div class="ip-address">{{ row.address }}</div>
                    <div v-if="row.netmask" class="netmask">/{{ row.netmask }}</div>
                  </div>
                  <span v-else class="no-data">N/A</span>
                </template>
              </el-table-column>
              
              <!-- MAC Address Column -->
              <el-table-column prop="mac" label="MAC" width="160">
                <template #default="{ row }">
                  <span v-if="row.mac" class="mac-address">{{ formatMAC(row.mac) }}</span>
                  <span v-else class="no-data">N/A</span>
                </template>
              </el-table-column>
              
              <!-- Method Column -->
              <el-table-column prop="method" label="Metoda" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.method === 'dhcp' ? 'primary' : 'warning'" size="large">
                    {{ row.method || 'unknown' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <!-- Speed Column -->
              <el-table-column label="Prędkość" width="140">
                <template #default="{ row }">
                  <div class="speed-cell">
                    <div class="speed-value" :class="getSpeedClass(row.speed)">
                      {{ formatSpeed(row.speed) }}
                    </div>
                    <div v-if="row.duplex && row.duplex !== 'unknown'" class="duplex-tag">
                      <el-tag 
                        :type="row.duplex === 'full' ? 'success' : 'warning'" 
                        size="small"
                      >
                        {{ row.duplex }}
                      </el-tag>
                    </div>
                  </div>
                </template>
              </el-table-column>
              
              <!-- Type Column -->
              <el-table-column prop="type" label="Typ" width="120">
                <template #default="{ row }">
                  <el-tag :type="getTypeTagType(row.type)" size="large">
                    <el-icon>
                      <Icon :icon="getInterfaceIcon(row.type)" />
                    </el-icon>
                    {{ formatType(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <!-- MTU Column -->
              <el-table-column prop="mtu" label="MTU" width="100">
                <template #default="{ row }">
                  <span class="mtu-value">{{ row.mtu || 1500 }}</span>
                </template>
              </el-table-column>
              
              <!-- Actions Column -->
              <el-table-column label="Akcje" width="160" fixed="right">
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-tooltip content="Szczegóły" placement="top">
                      <el-button 
                        size="small" 
                        @click="goToDetails(row.device)"
                        class="action-button"
                      >
                        <el-icon><Icon icon="mdi:eye" /></el-icon>
                        Szczegóły
                      </el-button>
                    </el-tooltip>
                    
                    <el-tooltip 
                      content="Usuń" 
                      placement="top"
                      :disabled="isProtectedInterface(row.device)"
                    >
                      <el-button
                        size="small"
                        type="danger"
                        @click="confirmDelete(row.device)"
                        :disabled="isProtectedInterface(row.device)"
                        class="action-button"
                      >
                        <el-icon><Icon icon="mdi:delete" /></el-icon>
                        Usuń
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- Table Footer -->
        <div class="table-footer">
          <div class="footer-info">
            <span>Wyświetlono {{ filteredInterfaces.length }} z {{ interfaces.length }} interfejsów</span>
            <span v-if="selectedInterface"> | Wybrano: {{ selectedInterface.device }}</span>
          </div>
          
          <div class="footer-pagination" v-if="filteredInterfaces.length > pageSize">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="filteredInterfaces.length"
              :page-sizes="[10, 25, 50, 100]"
              layout="total, sizes, prev, pager, next"
              small
              background
            />
          </div>
        </div>
      </el-card>
    </div>

    <!-- Dialogs... (pozostały kod bez zmian) -->
    <el-dialog v-model="addDialogVisible" title="Dodaj nowy interfejs" width="500px">
      <el-form :model="newInterfaceForm" :rules="interfaceRules" ref="addInterfaceForm">
        <el-form-item label="Nazwa interfejsu" prop="name">
          <el-input v-model="newInterfaceForm.name" placeholder="np. eth1, br0, bond0" />
        </el-form-item>
        
        <el-form-item label="Typ interfejsu" prop="type">
          <el-select v-model="newInterfaceForm.type" class="type-select">
            <el-option value="ethernet" label="Ethernet" />
            <el-option value="bridge" label="Most (Bridge)" />
            <el-option value="vlan" label="VLAN" />
            <el-option value="bond" label="Bonding" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="addDialogVisible = false">
          Anuluj
        </el-button>
        <el-button type="primary" @click="addInterface" :loading="addingInterface">
          Dodaj
        </el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="deleteDialogVisible" title="Potwierdzenie usunięcia" width="400px">
      <p>Czy na pewno chcesz usunąć interfejs <strong>{{ interfaceToDelete }}</strong>?</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">
          Anuluj
        </el-button>
        <el-button type="danger" @click="deleteInterface" :loading="deletingInterface">
          Usuń
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const router = useRouter()

// Theme
const isDark = ref(false)
const themeIcon = computed(() => 
  isDark.value ? 'mdi:weather-sunny' : 'mdi:weather-night'
)

// State
const loading = ref(false)
const interfaces = ref([])
const selectedInterface = ref(null)

// Filters
const searchQuery = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const displayOptions = ref(['ip', 'mac', 'speed', 'method'])
const currentPage = ref(1)
const pageSize = ref(25)

// Dialogs
const addDialogVisible = ref(false)
const addingInterface = ref(false)
const deleteDialogVisible = ref(false)
const interfaceToDelete = ref('')
const deletingInterface = ref(false)

// Forms
const newInterfaceForm = reactive({
  name: '',
  type: 'ethernet'
})

const interfaceRules = {
  name: [
    { required: true, message: 'Nazwa interfejsu jest wymagana', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9]+$/, message: 'Nieprawidłowa nazwa interfejsu', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Typ interfejsu jest wymagany', trigger: 'change' }
  ]
}

const lastUpdateTime = ref('')

// Computed properties
const filteredInterfaces = computed(() => {
  let filtered = [...interfaces.value]
  
  // Filter by status
  if (statusFilter.value && statusFilter.value !== 'all') {
    filtered = filtered.filter(iface => iface.status === statusFilter.value)
  }
  
  // Filter by type
  if (typeFilter.value && typeFilter.value !== 'all') {
    filtered = filtered.filter(iface => iface.type === typeFilter.value)
  }
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(iface => 
      iface.device.toLowerCase().includes(query) ||
      (iface.address && iface.address.toLowerCase().includes(query)) ||
      (iface.mac && iface.mac.toLowerCase().includes(query)) ||
      (iface.method && iface.method.toLowerCase().includes(query))
    )
  }
  
  return filtered
})

const activeCount = computed(() => {
  return interfaces.value.filter(iface => iface.status === 'up').length
})

const hasFilters = computed(() => {
  return statusFilter.value !== '' || typeFilter.value !== '' || searchQuery.value !== ''
})

// Helper functions
const getInterfaceIcon = (type) => {
  switch (type) {
    case 'ethernet': return 'mdi:ethernet-cable'
    case 'wireless': return 'mdi:wifi'
    default: return 'mdi:network'
  }
}

const formatType = (type) => {
  switch (type) {
    case 'ethernet': return 'Ethernet'
    case 'wireless': return 'Wireless'
    default: return type
  }
}

const getTypeTagType = (type) => {
  switch (type) {
    case 'ethernet': return 'primary'
    case 'wireless': return 'warning'
    default: return 'info'
  }
}

const formatSpeed = (speed) => {
  if (!speed || speed === 'unknown') return 'N/A'
  return speed
}

const getSpeedClass = (speed) => {
  if (!speed || speed === 'unknown') return 'unknown'
  const match = speed.match(/(\d+)/)
  if (match) {
    const value = parseInt(match[1])
    if (value >= 1000) return 'gigabit'
    if (value >= 100) return 'fast'
  }
  return 'normal'
}

const formatMAC = (mac) => {
  if (!mac) return 'N/A'
  // Format MAC address with colons
  return mac.toUpperCase()
}

const isProtectedInterface = (device) => {
  return ['lo', 'eth0'].includes(device)
}

const getRowClassName = ({ row }) => {
  if (selectedInterface.value && selectedInterface.value.device === row.device) {
    return 'selected-row'
  }
  return ''
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.body.classList.add('dark-theme')
    document.documentElement.classList.add('dark')
  } else {
    document.body.classList.remove('dark-theme')
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// API functions
const loadInterfaces = async () => {
  try {
    loading.value = true
    const response = await axios.get('/network/interfaces')
    interfaces.value = response.data
    lastUpdateTime.value = new Date().toLocaleTimeString('pl-PL')
    
    // Auto-select first interface if none selected
    if (interfaces.value.length > 0 && !selectedInterface.value) {
      selectedInterface.value = interfaces.value[0]
    }
  } catch (error) {
    console.error('Failed to load interfaces:', error)
    ElNotification({
      title: 'Błąd',
      message: 'Nie udało się załadować interfejsów',
      type: 'error'
    })
  } finally {
    loading.value = false
  }
}

const selectInterface = (row) => {
  selectedInterface.value = row
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
  typeFilter.value = ''
  currentPage.value = 1
}

const goToDetails = (device) => {
  router.push(`/network/interfaces/details/${device}`)
}

const testSpeed = async (device) => {
  ElNotification({
    title: 'Info',
    message: `Test prędkości dla ${device} - funkcja w budowie`,
    type: 'info'
  })
}

const showAddDialog = () => {
  addDialogVisible.value = true
}

const confirmDelete = (device) => {
  if (isProtectedInterface(device)) {
    ElMessage.warning(`Nie można usunąć chronionego interfejsu ${device}`)
    return
  }
  interfaceToDelete.value = device
  deleteDialogVisible.value = true
}

const addInterface = async () => {
  try {
    addingInterface.value = true
    const response = await axios.post('/network/interfaces/add', newInterfaceForm)
    
    ElNotification({
      title: 'Sukces',
      message: `Interfejs ${newInterfaceForm.name} został dodany`,
      type: 'success'
    })
    
    addDialogVisible.value = false
    newInterfaceForm.name = ''
    newInterfaceForm.type = 'ethernet'
    
    await loadInterfaces()
  } catch (error) {
    console.error('Error adding interface:', error)
    ElMessage.error(error.response?.data?.message || 'Błąd dodawania interfejsu')
  } finally {
    addingInterface.value = false
  }
}

const deleteInterface = async () => {
  try {
    deletingInterface.value = true
    const response = await axios.delete(`/network/interfaces/remove/${interfaceToDelete.value}`)
    
    ElNotification({
      title: 'Sukces',
      message: `Interfejs ${interfaceToDelete.value} został usunięty`,
      type: 'success'
    })
    
    deleteDialogVisible.value = false
    interfaceToDelete.value = ''
    
    await loadInterfaces()
  } catch (error) {
    console.error('Error deleting interface:', error)
    ElMessage.error(error.response?.data?.message || 'Błąd usuwania interfejsu')
  } finally {
    deletingInterface.value = false
  }
}

const exportToCSV = () => {
  try {
    const headers = ['Device', 'Status', 'IP', 'Netmask', 'MAC', 'Method', 'Speed', 'Duplex', 'Type', 'MTU']
    const csvContent = [
      headers.join(','),
      ...interfaces.value.map(iface => [
        iface.device,
        iface.status,
        iface.address || '',
        iface.netmask || '',
        iface.mac || '',
        iface.method || '',
        iface.speed || '',
        iface.duplex || '',
        iface.type || '',
        iface.mtu || ''
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `interfaces_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('Dane wyeksportowane do pliku CSV')
  } catch (error) {
    ElMessage.error('Błąd eksportowania danych')
  }
}

// Initialize
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.body.classList.add('dark-theme')
    document.documentElement.classList.add('dark')
  }
  
  loadInterfaces()
})
</script>

<style scoped>
/* IDENTYCZNE STYLE HEADER JAK LOCALLOGS.VUE */
.local-logs-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

.local-logs-container.dark {
  background: #1a1a1a;
  color: #e0e0e0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.dark .subtitle {
  color: #a0a0a0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  margin-right: 8px;
}

/* Filters Bar - COMPACT */
.filters-bar {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.dark .filters-bar {
  background: #2d2d2d;
  border-color: #404040;
}

.filters-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
}

.filter-select {
  width: 100%;
}

.stats-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-group .el-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.actions-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.status-option,
.type-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-option.up {
  color: var(--el-color-success);
}

.status-option.down {
  color: var(--el-color-danger);
}

/* Main Content - FULL WIDTH */
.main-content {
  min-height: calc(100vh - 200px);
  width: 100%;
}

.interfaces-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.dark .interfaces-card {
  background: #2d2d2d;
  border-color: #404040;
}

/* Table Content - FIXED 100% WIDTH */
.table-content {
  padding: 0;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  flex: 1;
}

/* CRITICAL FIX: Force table to be 100% width */
.interfaces-table {
  width: 100% !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

/* Override Element Plus default table styles */
.interfaces-table :deep(.el-table) {
  width: 100% !important;
  min-width: 100% !important;
}

.interfaces-table :deep(.el-table__header) {
  width: 100% !important;
}

.interfaces-table :deep(.el-table__body) {
  width: 100% !important;
}

.interfaces-table :deep(.el-table__empty-block) {
  width: 100% !important;
}

/* Ensure cells expand properly */
.interfaces-table :deep(.el-table__body-wrapper),
.interfaces-table :deep(.el-table__header-wrapper) {
  width: 100% !important;
}

.interfaces-table :deep(.el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.interfaces-table :deep(.el-table__row) {
  width: 100% !important;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
  width: 100%;
}

.loading-icon {
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: var(--el-text-color-primary);
}

.empty-state p {
  color: var(--el-text-color-secondary);
  margin: 0 0 16px 0;
}

.dark .empty-state p {
  color: #a0a0a0;
}

/* Table Cell Styles */
.device-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-icon {
  color: var(--el-color-primary);
}

.device-name {
  font-weight: 600;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.ip-cell {
  display: flex;
  flex-direction: column;
}

.ip-address {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 500;
  color: var(--el-color-primary);
}

.netmask {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mac-address {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--el-color-info);
}

.no-data {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.speed-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speed-value {
  font-weight: 600;
  font-size: 14px;
}

.speed-value.gigabit {
  color: var(--el-color-success);
}

.speed-value.fast {
  color: var(--el-color-warning);
}

.speed-value.normal {
  color: var(--el-color-info);
}

.speed-value.unknown {
  color: var(--el-text-color-placeholder);
}

.mtu-value {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-button {
  min-width: 80px;
}

/* Table Footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-light);
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.dark .table-footer {
  border-top-color: #404040;
}

.footer-info {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  flex: 1;
  min-width: 200px;
}

.footer-pagination {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Custom Scrollbar */
.table-wrapper::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.dark .table-wrapper::-webkit-scrollbar-track {
  background: #3d3d3d;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.dark .table-wrapper::-webkit-scrollbar-thumb {
  background: #555;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

.dark .table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Responsive */
@media (max-width: 1200px) {
  .filters-content {
    gap: 12px;
  }
  
  .filter-group {
    min-width: 180px;
  }
}

@media (max-width: 768px) {
  .local-logs-container {
    padding: 16px;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: flex-start;
  }
  
  .filters-content {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    min-width: 100%;
  }
  
  .stats-group {
    width: 100%;
    justify-content: center;
  }
  
  .actions-group {
    width: 100%;
    justify-content: center;
  }
  
  .table-footer {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    gap: 12px;
  }
  
  .footer-info {
    text-align: center;
  }
  
  /* Hide some columns on tablet */
  .interfaces-table :deep(.el-table th:nth-child(5)), /* Speed */
  .interfaces-table :deep(.el-table td:nth-child(5)) {
    display: none;
  }
}

@media (max-width: 576px) {
  /* Hide more columns on mobile */
  .interfaces-table :deep(.el-table th:nth-child(4)), /* MAC */
  .interfaces-table :deep(.el-table td:nth-child(4)),
  .interfaces-table :deep(.el-table th:nth-child(6)), /* MTU */
  .interfaces-table :deep(.el-table td:nth-child(6)) {
    display: none;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  /* Hide even more columns on small mobile */
  .interfaces-table :deep(.el-table th:nth-child(3)), /* Method */
  .interfaces-table :deep(.el-table td:nth-child(3)) {
    display: none;
  }
  
  .header-left h1 {
    font-size: 24px;
  }
  
  .header-right .el-button {
    padding: 8px 12px;
  }
}

/* Ensure the table takes full width even when scrolling */
.interfaces-table :deep(.el-table__body),
.interfaces-table :deep(.el-table__header) {
  min-width: 100% !important;
}

/* Fix for fixed column */
.interfaces-table :deep(.el-table__fixed),
.interfaces-table :deep(.el-table__fixed-right) {
  height: 100% !important;
}
</style>
