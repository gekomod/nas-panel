<template>
  <div class="notifications-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:bell-outline" />
          </div>
          <div class="header-text">
            <h1>Wszystkie powiadomienia</h1>
            <p class="subtitle">Zarządzaj swoimi powiadomieniami i alertami systemowymi</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="filter === 'all' ? 'primary' : 'default'"
              @click="filter = 'all'"
            >
              Wszystkie ({{ notifications.length }})
            </el-button>
            <el-button 
              :type="filter === 'unread' ? 'primary' : 'default'"
              @click="filter = 'unread'"
            >
              Nowe ({{ unreadCount }})
            </el-button>
            <el-button 
              :type="filter === 'read' ? 'primary' : 'default'"
              @click="filter = 'read'"
            >
              Przeczytane ({{ readCount }})
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="notifications-content">
      <!-- Notifications Actions Card -->
      <el-card class="actions-card" shadow="hover">
        <div class="actions-content">
          <div class="actions-info">
            <h3>Zarządzanie powiadomieniami</h3>
            <p>Szybkie akcje dla wszystkich powiadomień</p>
          </div>
          <div class="actions-buttons">
            <el-button 
              type="primary" 
              plain 
              @click="markAllAsRead"
              :disabled="unreadCount === 0 || loading"
              :loading="markingAllAsRead"
            >
              <Icon icon="mdi:email-open" />
              Oznacz wszystkie jako przeczytane
            </el-button>
            <el-button 
              type="danger" 
              plain 
              @click="clearAllNotifications"
              :disabled="notifications.length === 0 || loading"
              :loading="clearingAll"
            >
              <Icon icon="mdi:delete" />
              Wyczyść wszystkie
            </el-button>
            <el-button 
              type="info" 
              plain 
              @click="fetchNotifications"
              :loading="loading"
            >
              <Icon icon="mdi:refresh" />
              Odśwież
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- Notifications List Card -->
      <el-card class="notifications-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:bell-ring-outline" />
              Lista powiadomień
              <el-tag v-if="filter !== 'all'" size="small" :type="filter === 'unread' ? 'warning' : 'info'">
                {{ filter === 'unread' ? `Nowe: ${unreadCount}` : `Przeczytane: ${readCount}` }}
              </el-tag>
            </h2>
            <div class="card-header-actions">
              <el-select v-model="typeFilter" placeholder="Filtruj po typie" clearable>
                <el-option label="Błędy" value="error" />
                <el-option label="Sukcesy" value="success" />
                <el-option label="Ostrzeżenia" value="warning" />
                <el-option label="Informacje" value="info" />
                <el-option label="Wiadomości" value="message" />
                <el-option label="System" value="system" />
                <el-option label="Zadania" value="task" />
              </el-select>
            </div>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>Ładowanie powiadomień...</p>
        </div>

        <el-empty 
          v-else-if="filteredNotifications.length === 0" 
          :description="emptyMessage" 
          class="empty-state"
        >
          <template #image>
            <Icon icon="mdi:bell-off-outline" width="120" height="120" />
          </template>
        </el-empty>

        <div v-else class="notifications-list">
          <div 
            v-for="notification in paginatedNotifications" 
            :key="notification.id"
            :class="['notification-item', { 'unread': !notification.read, 'clickable': notification.link }]"
            @click="handleNotificationClick(notification)"
          >
            <div class="notification-icon">
              <el-icon 
                :size="24"
                :color="getNotificationColor(notification.type)"
              >
                <Icon :icon="getNotificationIcon(notification.type)" />
              </el-icon>
            </div>
            <div class="notification-content">
              <div class="notification-header">
                <h4 :class="{ 'unread-title': !notification.read }">
                  {{ notification.title }}
                  <el-tag 
                    v-if="!notification.read" 
                    size="mini" 
                    type="warning" 
                    effect="plain"
                  >
                    Nowe
                  </el-tag>
                </h4>
                <span class="notification-time">{{ formatDateTime(notification.time) }}</span>
              </div>
              <p class="notification-message">{{ notification.message }}</p>
              <div v-if="notification.link" class="notification-link">
                <el-link :underline="false" type="primary" @click.stop="goToLink(notification.link)">
                  <Icon icon="mdi:arrow-right" />
                  Przejdź do szczegółów
                </el-link>
              </div>
            </div>
            <div class="notification-actions">
              <el-button 
                v-if="!notification.read"
                size="small" 
                circle 
                @click.stop="markAsRead(notification.id)"
                :loading="markingReadId === notification.id"
              >
                <el-icon><Icon icon="mdi:email-open" /></el-icon>
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                circle 
                @click.stop="deleteNotification(notification.id)"
                :loading="deletingId === notification.id"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <div v-if="!loading && filteredNotifications.length > 0" class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="filteredNotifications.length"
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
            <Icon icon="mdi:bell" />
          </div>
          <div class="stat-info">
            <h3>{{ notifications.length }}</h3>
            <p>Wszystkie powiadomienia</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-unread">
            <Icon icon="mdi:email-alert" />
          </div>
          <div class="stat-info">
            <h3>{{ unreadCount }}</h3>
            <p>Nowe powiadomienia</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-error">
            <Icon icon="mdi:alert-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ errorCount }}</h3>
            <p>Powiadomienia o błędach</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-success">
            <Icon icon="mdi:check-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ successCount }}</h3>
            <p>Powiadomienia sukcesu</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useNotifications } from '@/services/NotificationService'

const router = useRouter()
const {
  notifications,
  unreadCount,
  addNotification,
  markAsRead: markAsReadService,
  markAllAsRead: markAllAsReadService,
  clearAll: clearAllService,
} = useNotifications()

// Stan komponentu
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const filter = ref('all') // 'all', 'read', 'unread'
const typeFilter = ref('')
const markingAllAsRead = ref(false)
const clearingAll = ref(false)
const markingReadId = ref(null)
const deletingId = ref(null)

// Statystyki
const readCount = computed(() => notifications.value.filter(n => n.read).length)
const errorCount = computed(() => notifications.value.filter(n => n.type === 'error').length)
const successCount = computed(() => notifications.value.filter(n => n.type === 'success').length)

const filteredNotifications = computed(() => {
  let result = [...notifications.value]
  
  // Filtrowanie po statusie
  if (filter.value === 'read') {
    result = result.filter(n => n.read)
  } else if (filter.value === 'unread') {
    result = result.filter(n => !n.read)
  }
  
  // Filtrowanie po typie
  if (typeFilter.value) {
    result = result.filter(n => n.type === typeFilter.value)
  }
  
  // Sortowanie od najnowszych
  result.sort((a, b) => new Date(b.time) - new Date(a.time))
  
  return result
})

const paginatedNotifications = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredNotifications.value.slice(start, end)
})

const emptyMessage = computed(() => {
  if (filter.value !== 'all' || typeFilter.value) {
    return `Brak powiadomień dla wybranego filtru (${filter.value === 'unread' ? 'nowe' : filter.value === 'read' ? 'przeczytane' : ''}${typeFilter.value ? `, typ: ${typeFilter.value}` : ''})`
  }
  return 'Brak powiadomień'
})

// Pobieranie powiadomień
const fetchNotifications = async () => {
  try {
    loading.value = true
    // W rzeczywistej aplikacji tutaj byłoby wywołanie API
    await new Promise(resolve => setTimeout(resolve, 500))
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania powiadomień')
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

const formatDateTime = (date) => {
  const now = new Date()
  const notificationDate = new Date(date)
  const diffInHours = (now - notificationDate) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return notificationDate.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (diffInHours < 48) {
    return 'Wczoraj, ' + notificationDate.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else {
    return notificationDate.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

const getNotificationIcon = (type) => {
  const icons = {
    'error': 'mdi:alert-circle-outline',
    'success': 'mdi:check-circle-outline',
    'warning': 'mdi:alert-outline',
    'info': 'mdi:information-outline',
    'message': 'mdi:email-outline',
    'system': 'mdi:server',
    'task': 'mdi:checkbox-marked-circle-outline'
  }
  return icons[type] || 'mdi:bell-outline'
}

const getNotificationColor = (type) => {
  const colors = {
    'error': 'var(--el-color-error)',
    'success': 'var(--el-color-success)',
    'warning': 'var(--el-color-warning)',
    'info': 'var(--el-color-info)',
    'message': '#9C27B0',
    'system': '#673AB7',
    'task': '#009688'
  }
  return colors[type] || 'var(--el-color-primary)'
}

const handleNotificationClick = (notification) => {
  if (notification.link) {
    goToLink(notification.link)
  }
  if (!notification.read) {
    markAsRead(notification.id)
  }
}

const goToLink = (link) => {
  router.push(link)
}

const markAsRead = async (id) => {
  try {
    markingReadId.value = id
    await markAsReadService(id)
    ElMessage.success('Powiadomienie oznaczone jako przeczytane')
  } catch (error) {
    ElMessage.error('Błąd podczas oznaczania powiadomienia')
  } finally {
    markingReadId.value = null
  }
}

const markAllAsRead = async () => {
  try {
    markingAllAsRead.value = true
    await markAllAsReadService()
    ElMessage.success('Wszystkie powiadomienia oznaczone jako przeczytane')
  } catch (error) {
    ElMessage.error('Błąd podczas oznaczania powiadomień')
  } finally {
    markingAllAsRead.value = false
  }
}

const deleteNotification = async (id) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć to powiadomienie?',
      'Potwierdzenie usunięcia',
      { 
        type: 'warning',
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj'
      }
    )
    
    deletingId.value = id
    // W rzeczywistej aplikacji tutaj byłoby wywołanie API
    await new Promise(resolve => setTimeout(resolve, 300))
    notifications.value = notifications.value.filter(n => n.id !== id)
    
    // Reset paginacji jeśli usunięto ostatni element na stronie
    if (paginatedNotifications.value.length === 0 && currentPage.value > 1) {
      currentPage.value = currentPage.value - 1
    }
    
    ElMessage.success('Powiadomienie zostało usunięte')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania powiadomienia')
    }
  } finally {
    deletingId.value = null
  }
}

const clearAllNotifications = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć WSZYSTKIE powiadomienia? Tej akcji nie można cofnąć.',
      'Potwierdzenie usunięcia',
      { 
        type: 'error',
        confirmButtonText: 'Usuń wszystko',
        cancelButtonText: 'Anuluj',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    clearingAll.value = true
    await clearAllService()
    currentPage.value = 1
    ElMessage.success('Wszystkie powiadomienia zostały usunięte')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania powiadomień')
    }
  } finally {
    clearingAll.value = false
  }
}

onMounted(() => {
  fetchNotifications()
})
</script>

<style scoped>
.notifications-dashboard {
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
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
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

.notifications-content {
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

.notifications-card {
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

.notifications-list {
  padding: 8px 0;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
  cursor: default;
}

.notification-item.clickable:hover {
  background-color: #f8fafc;
  cursor: pointer;
}

.notification-item.unread {
  background-color: rgba(245, 158, 11, 0.05);
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-icon {
  flex-shrink: 0;
  margin-top: 4px;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.notification-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.notification-header .unread-title {
  font-weight: 600;
}

.notification-time {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}

.notification-message {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.notification-link {
  margin-top: 12px;
}

.notification-actions {
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

.stat-unread {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.stat-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    -webkit-overflow-scrolling: touch;
  }
  
  .actions-content {
    flex-direction: column;
    text-align: center;
  }
  
  .actions-buttons {
    width: 100%;
    flex-direction: column;
  }
  
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
  
  .card-header-actions .el-select {
    width: 100%;
  }
  
  .notification-item {
    flex-direction: column;
    gap: 12px;
  }
  
  .notification-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .notification-actions {
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
  
  .notification-item {
    padding: 16px;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

:deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}

/* Tag styling */
:deep(.el-tag) {
  font-weight: 500;
}

/* Select styling */
:deep(.el-select) {
  width: 200px;
}

@media (max-width: 768px) {
  :deep(.el-select) {
    width: 100%;
  }
}

/* Pagination styling */
:deep(.el-pagination) {
  justify-content: center;
}

/* Animation for new notifications */
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

.notification-item.unread {
  animation: pulse 2s infinite;
}

/* Card hover effects */
.actions-card:hover,
.notifications-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

/* Improve empty state */
.empty-state :deep(.el-empty__image) {
  opacity: 0.8;
}

.empty-state :deep(.el-empty__description) {
  color: #64748b;
  font-size: 15px;
}

/* Better focus states for accessibility */
.notification-item:focus-within {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: -2px;
}

/* Loading states */
.notification-item:has(:deep(.el-button.is-loading)) {
  opacity: 0.7;
}
</style>
