<template>
  <div class="notifications-view">
    <el-card class="notifications-card">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:bell-outline" />
          </el-icon>
          <span>Wszystkie powiadomienia</span>
        </div>
      </template>

      <div class="notifications-actions">
        <el-button 
          type="primary" 
          plain 
          @click="markAllAsRead"
          :disabled="unreadCount === 0"
        >
          Oznacz wszystkie jako przeczytane
        </el-button>
        <el-button 
          type="danger" 
          plain 
          @click="clearAllNotifications"
          :disabled="notifications.length === 0"
        >
          Wyczyść wszystkie
        </el-button>
      </div>

      <el-divider />

      <el-table 
        :data="filteredNotifications" 
        v-loading="loading"
        empty-text="Brak powiadomień"
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column width="50">
          <template #default="{row}">
            <el-icon 
              :size="20"
              :color="getNotificationColor(row.type)"
            >
              <Icon :icon="getNotificationIcon(row.type)" />
            </el-icon>
          </template>
        </el-table-column>

        <el-table-column prop="title" label="Tytuł" width="200">
          <template #default="{row}">
            <span :class="{'unread-notification': !row.read}">{{ row.title }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="message" label="Wiadomość" />

        <el-table-column prop="time" label="Data" width="180">
          <template #default="{row}">
            {{ formatDateTime(row.time) }}
          </template>
        </el-table-column>

        <el-table-column prop="read" label="Status" width="120">
          <template #default="{row}">
            <el-tag :type="row.read ? 'info' : 'warning'" effect="plain">
              {{ row.read ? 'Przeczytane' : 'Nowe' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Akcje" width="120">
          <template #default="{row}">
            <el-button 
              size="small" 
              circle 
              @click.stop="markAsRead(row.id)"
              v-if="!row.read"
            >
              <el-icon><Icon icon="mdi:email-open" /></el-icon>
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              circle 
              @click.stop="deleteNotification(row.id)"
            >
              <el-icon><Icon icon="mdi:delete" /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalNotifications"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="fetchNotifications"
          @size-change="handleSizeChange"
        />
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
  markAsRead,
  markAllAsRead,
  clearAll,
} = useNotifications()

// Stan komponentu
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const filter = ref('all') // 'all', 'read', 'unread'

// Pobieranie powiadomień (w tym przypadku używamy lokalnej listy)
const fetchNotifications = () => {
  loading.value = true
  // Symulacja ładowania
  setTimeout(() => {
    loading.value = false
  }, 300)
}

const filteredNotifications = computed(() => {
  let result = [...notifications.value]
  
  if (filter.value === 'read') {
    result = result.filter(n => n.read)
  } else if (filter.value === 'unread') {
    result = result.filter(n => !n.read)
  }
  
  // Sortowanie od najnowszych
  result.sort((a, b) => new Date(b.time) - new Date(a.time))
  
  return result
})

const totalNotifications = computed(() => filteredNotifications.value.length)

const handleSizeChange = (size) => {
  pageSize.value = size
  fetchNotifications()
}

const formatDateTime = (date) => {
  return new Date(date).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getNotificationIcon = (type) => {
  switch (type) {
    case 'error': return 'mdi:alert-circle-outline'
    case 'success': return 'mdi:check-circle-outline'
    case 'warning': return 'mdi:alert-outline'
    case 'info': return 'mdi:information-outline'
    case 'message': return 'mdi:email-outline'
    case 'system': return 'mdi:alert-circle-outline'
    case 'task': return 'mdi:checkbox-marked-circle-outline'
    default: return 'mdi:bell-outline'
  }
}

const getNotificationColor = (type) => {
  switch (type) {
    case 'error': return 'var(--el-color-error)'
    case 'success': return 'var(--el-color-success)'
    case 'warning': return 'var(--el-color-warning)'
    case 'info': return 'var(--el-color-info)'
    default: return 'var(--el-color-primary)'
  }
}

const handleRowClick = (row) => {
  if (row.link) {
    router.push(row.link)
  }
  if (!row.read) {
    markAsRead(row.id)
  }
}

const deleteNotification = async (id) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć to powiadomienie?',
      'Potwierdzenie usunięcia',
      { type: 'warning' }
    )
    
    // W rzeczywistej aplikacji tutaj byłoby wywołanie API
    notifications.value = notifications.value.filter(n => n.id !== id)
    
    ElMessage.success('Powiadomienie zostało usunięte')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania powiadomienia')
    }
  }
}

const clearAllNotifications = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć wszystkie powiadomienia?',
      'Potwierdzenie usunięcia',
      { type: 'warning' }
    )
    
    clearAll()
    ElMessage.success('Wszystkie powiadomienia zostały usunięte')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania powiadomień')
    }
  }
}

onMounted(() => {
  fetchNotifications()
})
</script>

<style scoped>
.notifications-view {
  padding: 20px;
}

.notifications-card {
  min-height: calc(100vh - 120px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  font-size: 18px;
}

.notifications-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.unread-notification {
  font-weight: 600;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: var(--el-fill-color-light);
}
</style>