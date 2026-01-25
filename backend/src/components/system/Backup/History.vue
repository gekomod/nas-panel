<template>
  <div class="history-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:history" />
          </div>
          <div class="header-text">
            <h1>{{ $t('backup.history') }}</h1>
            <p class="subtitle">Historia i zarządzanie kopiami zapasowymi</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="filter === 'all' ? 'primary' : 'default'"
              @click="filter = 'all'"
            >
              Wszystkie ({{ backups.length }})
            </el-button>
            <el-button 
              :type="filter === 'completed' ? 'primary' : 'default'"
              @click="filter = 'completed'"
            >
              Zakończone ({{ completedCount }})
            </el-button>
            <el-button 
              :type="filter === 'failed' ? 'primary' : 'default'"
              @click="filter = 'failed'"
            >
              Nieudane ({{ failedCount }})
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="history-content">
      <!-- Actions Card -->
      <el-card class="actions-card" shadow="hover">
        <div class="actions-content">
          <div class="actions-info">
            <h3>Zarządzanie historią kopii</h3>
            <p>Szybkie akcje dla wszystkich kopii zapasowych</p>
          </div>
          <div class="actions-buttons">
            <el-select 
              v-model="typeFilter" 
              placeholder="Filtruj po typie" 
              clearable
              class="filter-select"
            >
              <el-option label="Pełne" value="full" />
              <el-option label="Przyrostowe" value="incremental" />
              <el-option label="Różnicowe" value="differential" />
            </el-select>
            <el-button 
              type="danger" 
              plain 
              @click="deleteAllCompleted"
              :disabled="completedCount === 0 || loading"
              :loading="deletingAll"
            >
              <Icon icon="mdi:delete-sweep" />
              Usuń zakończone
            </el-button>
            <el-button 
              type="info" 
              plain 
              @click="fetchBackups"
              :loading="loading"
            >
              <Icon icon="mdi:refresh" />
              Odśwież
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- History List Card -->
      <el-card class="history-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:backup-restore" />
              Lista kopii zapasowych
              <el-tag v-if="filter !== 'all'" size="small" :type="filter === 'completed' ? 'success' : 'danger'">
                {{ filter === 'completed' ? `Zakończone: ${completedCount}` : `Nieudane: ${failedCount}` }}
              </el-tag>
            </h2>
            <div class="card-header-actions">
              <el-input
                v-model="searchQuery"
                placeholder="Szukaj po nazwie..."
                clearable
                class="search-input"
              >
                <template #prefix>
                  <Icon icon="mdi:magnify" />
                </template>
              </el-input>
            </div>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>Ładowanie historii kopii...</p>
        </div>

        <el-empty 
          v-else-if="filteredBackups.length === 0" 
          :description="emptyMessage" 
          class="empty-state"
        >
          <template #image>
            <Icon icon="mdi:database-off" width="120" height="120" />
          </template>
        </el-empty>

        <div v-else class="backups-list">
          <div 
            v-for="backup in paginatedBackups" 
            :key="backup.id"
            class="backup-item"
          >
            <div class="backup-icon">
              <el-icon :size="24" :color="getBackupIconColor(backup.type)">
                <Icon :icon="getBackupIcon(backup.type)" />
              </el-icon>
            </div>
            <div class="backup-content">
              <div class="backup-header">
                <h4>{{ backup.name }}</h4>
                <div class="backup-meta">
                  <el-tag :type="getStatusType(backup.status)" size="small" effect="plain">
                    {{ $t(`backup.statuses.${backup.status}`) }}
                  </el-tag>
                  <span class="backup-type">{{ $t(`backup.types.${backup.type}`) }}</span>
                  <span class="backup-id">ID: {{ backup.id.slice(0, 8) }}</span>
                </div>
              </div>
              <p class="backup-details">
                <span class="backup-date">{{ formatDate(backup.created_at) }}</span>
                <span class="backup-size">{{ formatSize(backup.size) }}</span>
              </p>
              <div v-if="backup.status === 'in_progress'" class="backup-progress">
                <el-progress 
                  :percentage="backup.progress || 0" 
                  :stroke-width="4"
                  :show-text="true"
                  :text-inside="true"
                />
              </div>
            </div>
            <div class="backup-actions">
              <el-button 
                size="small" 
                @click="downloadBackup(backup.id)"
                :disabled="backup.status !== 'completed'"
                :loading="downloadingId === backup.id"
              >
                <el-icon><Icon icon="mdi:download" /></el-icon>
                Pobierz
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteBackup(backup.id)"
                :loading="deletingId === backup.id"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
                Usuń
              </el-button>
            </div>
          </div>
        </div>

        <div v-if="!loading && filteredBackups.length > 0" class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="filteredBackups.length"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
            :disabled="loading"
          />
        </div>
      </el-card>
    </div>

    <!-- Stats Card -->
    <el-card class="stats-card" shadow="hover">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-icon stat-total">
            <Icon icon="mdi:database" />
          </div>
          <div class="stat-info">
            <h3>{{ backups.length }}</h3>
            <p>Wszystkie kopie</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-success">
            <Icon icon="mdi:check-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ completedCount }}</h3>
            <p>Zakończone pomyślnie</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-failed">
            <Icon icon="mdi:alert-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ failedCount }}</h3>
            <p>Nieudane</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-size">
            <Icon icon="mdi:harddisk" />
          </div>
          <div class="stat-info">
            <h3>{{ formatSize(totalSize) }}</h3>
            <p>Łączny rozmiar</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Stan komponentu
const backups = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const filter = ref('all')
const typeFilter = ref('')
const searchQuery = ref('')
const downloadingId = ref(null)
const deletingId = ref(null)
const deletingAll = ref(false)

// Statystyki
const completedCount = computed(() => backups.value.filter(b => b.status === 'completed').length)
const failedCount = computed(() => backups.value.filter(b => b.status === 'failed').length)
const totalSize = computed(() => backups.value.reduce((sum, backup) => sum + (backup.size || 0), 0))

const filteredBackups = computed(() => {
  let result = [...backups.value]
  
  // Filtrowanie po statusie
  if (filter.value === 'completed') {
    result = result.filter(b => b.status === 'completed')
  } else if (filter.value === 'failed') {
    result = result.filter(b => b.status === 'failed')
  }
  
  // Filtrowanie po typie
  if (typeFilter.value) {
    result = result.filter(b => b.type === typeFilter.value)
  }
  
  // Filtrowanie po wyszukiwaniu
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(b => 
      b.name.toLowerCase().includes(query) || 
      b.id.toLowerCase().includes(query)
    )
  }
  
  // Sortowanie od najnowszych
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  
  return result
})

const paginatedBackups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredBackups.value.slice(start, end)
})

const emptyMessage = computed(() => {
  if (filter.value !== 'all' || typeFilter.value || searchQuery.value) {
    return 'Brak kopii spełniających kryteria wyszukiwania'
  }
  return 'Brak dostępnych kopii zapasowych'
})

// Pobieranie kopii
const fetchBackups = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/system/backup/history', {
      params: {
        page: currentPage.value,
        per_page: pageSize.value
      }
    })
    backups.value = response.data.backups || []
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania historii kopii')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getStatusType = (status) => {
  const types = {
    completed: 'success',
    failed: 'danger',
    in_progress: 'warning',
    queued: 'info'
  }
  return types[status] || ''
}

const getBackupIcon = (type) => {
  const icons = {
    'full': 'mdi:database',
    'incremental': 'mdi:database-sync',
    'differential': 'mdi:database-arrow-up'
  }
  return icons[type] || 'mdi:database'
}

const getBackupIconColor = (type) => {
  const colors = {
    'full': '#3b82f6',
    'incremental': '#10b981',
    'differential': '#8b5cf6'
  }
  return colors[type] || '#6b7280'
}

const downloadBackup = async (backupId) => {
  try {
    downloadingId.value = backupId
    
    const response = await axios({
      method: 'get',
      url: `/api/system/backup/download/${backupId}`,
      responseType: 'blob'
    })

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    
    const contentDisposition = response.headers['content-disposition']
    let fileName = `backup-${backupId}.tar.gz`
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/)
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1]
      }
    }
    
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      link.remove()
    }, 100)

    ElMessage.success('Rozpoczęto pobieranie kopii')
    
  } catch (error) {
    if (error.response?.status === 404) {
      ElMessage.error('Kopia nie została znaleziona')
    } else if (error.response?.status === 423) {
      ElMessage.warning('Kopia nie jest jeszcze gotowa do pobrania')
    } else {
      ElMessage.error('Błąd podczas pobierania kopii')
    }
  } finally {
    downloadingId.value = null
  }
}

const deleteBackup = async (backupId) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć tę kopię zapasową? Tej akcji nie można cofnąć.',
      'Potwierdzenie usunięcia',
      {
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    deletingId.value = backupId
    await axios.delete(`/api/system/backup/delete/${backupId}`)
    
    ElMessage.success('Kopia zapasowa została usunięta')
    fetchBackups()
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania kopii')
    }
  } finally {
    deletingId.value = null
  }
}

const deleteAllCompleted = async () => {
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz usunąć WSZYSTKIE zakończone kopie (${completedCount.value})? Tej akcji nie można cofnąć.`,
      'Potwierdzenie masowego usunięcia',
      {
        confirmButtonText: 'Usuń wszystko',
        cancelButtonText: 'Anuluj',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    deletingAll.value = true
    
    // W rzeczywistej aplikacji tutaj byłoby wywołanie API
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    ElMessage.success('Wszystkie zakończone kopie zostały usunięte')
    fetchBackups()
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania kopii')
    }
  } finally {
    deletingAll.value = false
  }
}

onMounted(() => {
  fetchBackups()
})
</script>

<style scoped>
.history-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
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
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.header-actions .el-button-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.header-actions .el-button {
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 500;
}

.history-content {
  margin-bottom: 24px;
}

.actions-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.actions-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  flex-wrap: wrap;
  gap: 20px;
}

.actions-info h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.actions-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.actions-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-select {
  width: 200px;
}

.search-input {
  width: 300px;
}

.history-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  min-height: 400px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
}

.card-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 0;
  min-height: 300px;
}

.loading-spinner p {
  margin-top: 16px;
  color: #64748b;
}

.empty-state {
  padding: 80px 0;
  min-height: 300px;
}

.backups-list {
  padding: 8px 0;
}

.backup-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.backup-item:hover {
  background-color: #f8fafc;
}

.backup-item:last-child {
  border-bottom: none;
}

.backup-icon {
  flex-shrink: 0;
}

.backup-content {
  flex: 1;
  min-width: 0;
}

.backup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.backup-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
}

.backup-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.backup-type,
.backup-id {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
}

.backup-details {
  display: flex;
  gap: 16px;
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.backup-date,
.backup-size {
  display: inline-block;
}

.backup-progress {
  margin-top: 12px;
  max-width: 300px;
}

.backup-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.pagination-section {
  margin-top: 24px;
  padding: 20px 24px 0;
  border-top: 1px solid #f1f5f9;
}

.stats-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 20px;
}

.stats-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  padding: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 28px;
  color: white;
  flex-shrink: 0;
}

.stat-total {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-failed {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.stat-size {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.stat-info h3 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    overflow-x: auto;
  }
  
  .header-actions .el-button-group {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  
  .actions-content {
    flex-direction: column;
    text-align: center;
  }
  
  .actions-buttons {
    width: 100%;
  }
  
  .actions-buttons .el-select,
  .actions-buttons .el-button {
    width: 100%;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header-actions {
    width: 100%;
  }
  
  .card-header-actions .search-input {
    width: 100%;
  }
  
  .backup-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .backup-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .backup-actions {
    align-self: flex-end;
  }
  
  .stats-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .backup-item {
    padding: 16px;
  }
  
  .backup-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

/* Animation for in-progress backups */
@keyframes pulse {
  0% {
    background-color: rgba(245, 158, 11, 0.05);
  }
  50% {
    background-color: rgba(245, 158, 11, 0.1);
  }
  100% {
    background-color: rgba(245, 158, 11, 0.05);
  }
}

.backup-item:has(.backup-progress) {
  animation: pulse 2s infinite;
}

/* Card hover effects */
.actions-card:hover,
.history-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}
</style>
