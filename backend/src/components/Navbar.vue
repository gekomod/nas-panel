<template>
  <header class="navbar">
    <div class="navbar-left">
      <!-- Logo -->
      <div class="logo-container">
        <img src="@/assets/logo.png" class="logo" alt="Logo">
      </div>

      <el-button
        circle
        plain
        @click="toggleSidebar"
        class="toggle-button"
      >
        <el-icon :size="20">
          <Icon 
            :icon="isSidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" 
            class="icon" 
            :class="{ 'rotated': isSidebarCollapsed }" 
          />
        </el-icon>
      </el-button>
      
      <!-- Breadcrumbs - ukrywane na mobile -->
      <el-breadcrumb separator="/" class="breadcrumbs" v-if="!isMobile">
        <el-breadcrumb-item 
          v-for="(item, index) in breadcrumbs" 
          :key="index"
        >
          {{ item.meta?.title || item.name }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <div class="navbar-right">
      <!-- Notification Bell with Badge -->
      <el-popover
        placement="bottom-end"
        trigger="click"
        :width="300"
        popper-class="notification-popover"
      >
        <template #reference>
          <el-badge 
            :value="unreadNotifications" 
            :max="99" 
            :hidden="unreadNotifications === 0"
            class="notification-badge"
          >
            <el-button circle plain class="icon-button">
              <el-icon :size="20">
                <Icon icon="mdi:bell-outline" />
              </el-icon>
            </el-button>
          </el-badge>
        </template>
        
        <div class="notifications-container">
          <div class="notifications-header">
            <h3>Powiadomienia</h3>
            <el-button 
              text 
              size="small" 
              @click="markAllAsRead"
              v-if="unreadNotifications > 0"
            >
              Oznacz wszystkie jako przeczytane
            </el-button>
          </div>
          
          <el-scrollbar max-height="400px">
            <div 
              v-for="(notification, index) in notifications" 
              :key="index"
              class="notification-item"
              :class="{
                'unread': !notification.read,
                [notification.type]: !notification.read
              }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-icon">
                <el-icon :size="20">
                  <Icon :icon="getNotificationIcon(notification.type)" />
                </el-icon>
              </div>
              <div class="notification-content">
                <p class="notification-title">{{ notification.title }}</p>
                <p class="notification-message">{{ notification.message }}</p>
                <span class="notification-time">{{ formatTime(notification.time) }}</span>
              </div>
            </div>
            
            <div v-if="notifications.length === 0" class="empty-notifications">
              <el-icon :size="40"><Icon icon="mdi:bell-off-outline" /></el-icon>
              <p>Brak nowych powiadomień</p>
            </div>
          </el-scrollbar>
          
          <div class="notifications-footer">
            <el-button text @click="viewAllNotifications">Zobacz wszystkie</el-button>
          </div>
        </div>
      </el-popover>

      <!-- Language Selector - ukrywane na mobile -->
      <el-select 
        v-model="$i18n.locale" 
        class="language-select"
        popper-class="language-select-dropdown"
        style="width: 100px; margin-left: 20px"
        v-if="!isMobile"
      >
        <el-option label="Polski" value="pl" />
        <el-option label="English" value="en" />
      </el-select>

      <!-- Theme Toggle -->
      <el-dropdown trigger="click" @command="handleThemeChange">
        <el-button circle plain class="icon-button">
          <el-icon :size="20">
            <Icon :icon="themeIcon" />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="light" :class="{ 'active': theme === 'light' }">
              <Icon icon="mdi:weather-sunny" /> Dzień
            </el-dropdown-item>
            <el-dropdown-item command="dark" :class="{ 'active': theme === 'dark' }">
              <Icon icon="mdi:weather-night" /> Noc
            </el-dropdown-item>
            <el-dropdown-item command="system" :class="{ 'active': theme === 'system' }">
              <Icon icon="mdi:monitor" /> System
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- User Menu -->
      <el-dropdown>
        <div class="user-panel">
          <el-avatar :size="30" :src="userAvatar" class="user-avatar">
            {{ username.charAt(0).toUpperCase() }}
          </el-avatar>
          <span class="username" v-if="!isMobile">{{ username }}</span>
          <el-icon class="user-arrow"><Icon icon="mdi:chevron-down" /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="navigateToProfile">
              <el-icon><Icon icon="mdi:account" /></el-icon> Profil
            </el-dropdown-item>
            <el-dropdown-item @click="navigateToSettings">
              <el-icon><Icon icon="mdi:cog" /></el-icon> Ustawienia
            </el-dropdown-item>
            <el-dropdown-item divided @click="confirmLogout">
              <el-icon><Icon icon="mdi:logout" /></el-icon> Wyloguj
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/services/AuthService'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { defineEmits, defineProps } from 'vue'

const notificationService = inject('notifications')
const notifications = computed(() => notificationService.notifications.value)
const unreadNotifications = computed(() => notificationService.unreadCount.value)
const { markAsRead, markAllAsRead } = notificationService

const props = defineProps({
  theme: {
    type: String,
    default: 'system'
  }
})

const emit = defineEmits(['toggle-sidebar', 'theme-changed'])
const router = useRouter()
const route = useRoute()
const { logout, currentUser } = useAuth()
const isSidebarCollapsed = ref(false)
const isMobile = ref(false)

const themeIcon = computed(() => {
  switch (props.theme) {
    case 'light': return 'mdi:weather-sunny'
    case 'dark': return 'mdi:weather-night'
    default: return 'mdi:monitor'
  }
})

const breadcrumbs = computed(() => {
  const paths = route.path.split('/').filter(Boolean)
  return paths.map((path, index) => ({
    name: path,
    to: '/' + paths.slice(0, index + 1).join('/')
  }))
})

const username = computed(() => {
  return currentUser.value?.username || 'Gość'
})

const userAvatar = computed(() => {
  return currentUser.value?.avatar || ''
})

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isSidebarCollapsed.value = true
  }
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.value)
  emit('toggle-sidebar')
}

const handleThemeChange = (theme) => {
  emit('theme-changed', theme)
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

const formatTime = (time) => {
  // Upewnij się, że time jest obiektem Date
  const date = time instanceof Date ? time : new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 1000 * 60) return 'Przed chwilą'
  if (diff < 1000 * 60 * 60) return `${Math.floor(diff / (1000 * 60))} min temu`
  if (diff < 1000 * 60 * 60 * 24) return `${Math.floor(diff / (1000 * 60 * 60))} godz. temu`
  
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

const handleNotificationClick = (notification) => {
  // Mark as read
  if (!notification.read) {
    notification.read = true
  }
  
  // Navigate if link exists
  if (notification.link) {
    router.push(notification.link)
  }
}

const viewAllNotifications = () => {
  router.push('/notifications')
}

const confirmLogout = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz się wylogować?',
      'Potwierdzenie wylogowania',
      {
        confirmButtonText: 'Wyloguj',
        cancelButtonText: 'Anuluj',
        type: 'warning'
      }
    )
    
    await logout()
    router.push('/login')
    
    ElMessage({
      type: 'success',
      message: 'Wylogowano pomyślnie'
    })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage({
        type: 'error',
        message: 'Błąd podczas wylogowywania'
      })
    }
  }
}

const navigateToProfile = () => {
  router.push('/profile')
}

const navigateToSettings = () => {
  router.push('/settings')
}

// Responsive handling
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.navbar {
  height: 64px;
  background: var(--el-bg-color);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.3s ease;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.logo-container {
  height: 100%;
  display: flex;
  align-items: center;
}

.icon {
  transition: transform 0.3s ease;
}

.icon.rotated {
  transform: rotate(0deg);
}

.logo {
  height: 32px;
  transition: all 0.3s ease;
}

.toggle-button {
  border: none;
  padding: 8px;
  margin-right: 8px;
}

.breadcrumbs {
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  transition: all 0.3s ease;
  margin-left: 8px;
}

.user-panel:hover {
  background: var(--el-fill-color-light);
}

.user-avatar {
  background-color: var(--el-color-primary);
  color: white;
  font-weight: bold;
}

.username {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.user-arrow {
  margin-left: 4px;
  transition: transform 0.3s ease;
}

.active {
  color: var(--el-color-primary);
}

.notification-badge {
  margin-right: 8px;
}

.icon-button {
  border: none;
  background: transparent;
}

.language-select {
  margin-left: 8px;
}

/* Notification styles */
.notification-item.unread {
  background: var(--el-fill-color-light);
}

.notification-item.unread .notification-icon {
  color: var(--el-color-primary);
}

.notification-item.unread.error .notification-icon {
  color: var(--el-color-error);
}

.notification-item.unread.success .notification-icon {
  color: var(--el-color-success);
}

.notification-item.unread.warning .notification-icon {
  color: var(--el-color-warning);
}

.notification-item.unread.info .notification-icon {
  color: var(--el-color-info);
}


.notifications-container {
  padding: 12px 0;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px 8px;
  border-bottom: 1px solid var(--el-border-color);
  margin-bottom: 8px;
}

.notifications-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.notification-item {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--el-border-color-light);
}

.notification-item:hover {
  background: var(--el-fill-color-light);
}

.notification-item.unread {
  background: var(--el-color-primary-light-9);
}

.notification-icon {
  margin-right: 12px;
  color: var(--el-color-primary);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 500;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-message {
  color: var(--el-text-color-secondary);
  margin: 0 0 4px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.empty-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.empty-notifications p {
  margin-top: 8px;
}

.notifications-footer {
  display: flex;
  justify-content: center;
  padding: 8px;
  border-top: 1px solid var(--el-border-color);
}

/* Responsive styles */
@media (max-width: 992px) {
  .navbar {
    padding: 0 16px;
  }
  
  .username {
    display: none;
  }
  
  .user-panel {
    padding: 6px;
  }
}

@media (max-width: 768px) {
  .breadcrumbs {
    display: none;
  }
  
  .language-select {
    display: none;
  }
  
  .navbar-left {
    gap: 8px;
  }
}

@media (max-width: 576px) {
  .logo {
    height: 24px;
  }
  
  .toggle-button {
    margin-right: 0;
  }
}
</style>

<style>
/* Global styles for popovers */
.notification-popover {
  padding: 0 !important;
}

.language-select-dropdown .el-select-dropdown__item {
  display: flex;
  align-items: center;
}

.flag-icon {
  margin-right: 8px;
  font-size: 16px;
}
</style>