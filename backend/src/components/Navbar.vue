<template>
  <header class="navbar">
    <!-- Lewa część navbara -->
    <div class="navbar-left">
      <div class="logo-container">
        <img src="@/assets/logo.png" class="logo" alt="Logo">
      </div>

      <el-button circle plain @click="toggleSidebar" class="toggle-button">
        <el-icon :size="20">
          <Icon 
            :icon="isSidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" 
            class="icon" 
            :class="{ 'rotated': isSidebarCollapsed }" 
          />
        </el-icon>
      </el-button>
      
      <el-breadcrumb separator="/" class="breadcrumbs" v-if="!isMobile">
        <el-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
          {{ $t(item.meta?.title || item.name) }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <!-- Prawa część navbara -->
    <div class="navbar-right">
      <!-- Wersja aplikacji -->
      <el-tooltip placement="bottom" :content="versionTooltip">
        <el-tag 
          :type="updateAvailable ? 'warning' : 'success'" 
          size="small"
          class="version-tag"
          @click="openUpdateDialog"
        >
          v{{ currentVersion }}
          <el-icon v-if="updateAvailable" class="update-icon">
            <Icon icon="mdi:alert-circle-outline" />
          </el-icon>
        </el-tag>
      </el-tooltip>

      <!-- Powiadomienia -->
      <el-popover placement="bottom-end" trigger="click" :width="300" popper-class="notification-popover">
        <template #reference>
          <el-badge :value="unreadNotifications" :max="99" :hidden="unreadNotifications === 0" class="notification-badge">
            <el-button circle plain class="icon-button">
              <el-icon :size="20"><Icon icon="mdi:bell-outline" /></el-icon>
            </el-button>
          </el-badge>
        </template>
        
        <div class="notifications-container">
          <div class="notifications-header">
            <h3>{{ $t('notifications.title') }}</h3>
            <el-button text size="small" @click="markAllAsRead" v-if="unreadNotifications > 0">
              {{ $t('notifications.markAllAsRead') }}
            </el-button>
          </div>
          
          <el-scrollbar max-height="400px">
            <div v-if="notifications.length === 0" class="empty-notifications">
              <el-icon :size="40"><Icon icon="mdi:bell-off-outline" /></el-icon>
              <p>{{ $t('notifications.empty') }}</p>
            </div>
            
            <div 
              v-for="(notification, index) in notifications" 
              :key="index"
              class="notification-item"
              :class="{ 'unread': !notification.read, [notification.type]: !notification.read }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-icon">
                <el-icon :size="20"><Icon :icon="getNotificationIcon(notification.type)" /></el-icon>
              </div>
              <div class="notification-content">
                <p class="notification-title">{{ notification.title }}</p>
                <p class="notification-message">{{ notification.message }}</p>
                <span class="notification-time">{{ formatTime(notification.time) }}</span>
              </div>
            </div>
          </el-scrollbar>
          
          <div class="notifications-footer">
            <el-button text @click="viewAllNotifications">{{ $t('notifications.viewAll') }}</el-button>
          </div>
        </div>
      </el-popover>

      <!-- Wybór języka -->
      <el-select 
        v-model="$i18n.locale" 
        class="language-select"
        popper-class="language-select-dropdown"
        style="width: 110px; margin-left: 20px"
        v-if="!isMobile"
      >
        <el-option label="English" value="en" />
        <el-option label="Polski" value="pl" />
      </el-select>

      <!-- Przełącznik motywu -->
      <el-dropdown trigger="click" @command="handleThemeChange">
        <el-button circle plain class="icon-button">
          <el-icon :size="20"><Icon :icon="themeIcon" /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="light" :class="{ 'active': theme === 'light' }">
              <Icon icon="mdi:weather-sunny" /> {{ $t('theme.light') }}
            </el-dropdown-item>
            <el-dropdown-item command="dark" :class="{ 'active': theme === 'dark' }">
              <Icon icon="mdi:weather-night" /> {{ $t('theme.dark') }}
            </el-dropdown-item>
            <el-dropdown-item command="system" :class="{ 'active': theme === 'system' }">
              <Icon icon="mdi:monitor" /> {{ $t('theme.system') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- Menu użytkownika -->
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
              <el-icon><Icon icon="mdi:account" /></el-icon> {{ $t('userMenu.profile') }}
            </el-dropdown-item>
            <el-dropdown-item @click="navigateToSettings">
              <el-icon><Icon icon="mdi:cog" /></el-icon> {{ $t('userMenu.settings') }}
            </el-dropdown-item>
            <el-dropdown-item divided @click="confirmLogout">
              <el-icon><Icon icon="mdi:logout" /></el-icon> {{ $t('userMenu.logout') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      
        <div class="server-controls">
	    <el-button 
	      type="warning" 
	      @click="confirmRestart"
	    >
	    <Icon icon="mdi:restart" />
	      Restart Serwera
	    </el-button>
	    <el-button 
	      type="danger" 
	      @click="confirmShutdown"
	    >
	    <Icon icon="mdi:power" />
	      Wyłącz Serwer
	    </el-button>
	</div>
    </div>

    <!-- Dialog aktualizacji -->
    <el-dialog
      v-model="showUpdateDialog"
      :title="updateAvailable ? $t('update.availableTitle') : $t('update.currentTitle')"
      width="600px"
      :close-on-click-modal="false"
      custom-class="update-dialog"
      :class="theme"
    >
      <div class="update-content">
        <div class="update-header">
          <el-icon 
            :color="updateAvailable ? 'var(--el-color-warning)' : 'var(--el-color-success)'" 
            :size="40"
          >
            <Icon :icon="updateAvailable ? 'mdi:update' : 'mdi:check-circle'" />
          </el-icon>
          <h3>{{ updateAvailable ? $t('update.availableHeader') : $t('update.currentHeader') }}</h3>
        </div>

        <div class="version-comparison">
          <div class="version-box" :class="updateAvailable ? 'old-version' : 'current-version'">
            <span class="version-label">{{ $t('update.yourVersion') }}</span>
            <span class="version-number">{{ currentVersion }}</span>
          </div>
          
          <template v-if="updateAvailable">
            <el-icon :size="24"><Icon icon="mdi:arrow-right" /></el-icon>
            <div class="version-box new-version">
              <span class="version-label">{{ $t('update.newVersion') }}</span>
              <span class="version-number">{{ latestVersion }}</span>
            </div>
          </template>
        </div>

        <template v-if="updateAvailable">
          <el-divider />

          <div class="changelog" v-if="changelog">
            <h4>{{ $t('update.whatsNew') }}:</h4>
            <el-scrollbar max-height="200px">
              <div v-html="changelog" class="changelog-content"></div>
            </el-scrollbar>
          </div>

          <div class="update-options">
            <el-button 
              type="primary" 
              @click="performUpdate" 
              :loading="updating"
              class="update-button"
            >
              <template #icon><el-icon><Icon icon="mdi:download" /></el-icon></template>
              {{ $t('update.updateNow') }}
            </el-button>

            <el-popover placement="top" width="300" trigger="click">
              <template #reference>
                <el-button type="info" plain>
                  <template #icon><el-icon><Icon icon="mdi:clock-outline" /></el-icon></template>
                  {{ $t('update.schedule') }}
                </el-button>
              </template>
              <div class="schedule-popover">
                <h4>{{ $t('update.scheduleTitle') }}</h4>
                <el-time-picker
                  v-model="scheduledTime"
                  format="HH:mm"
                  :placeholder="$t('update.selectTime')"
                  :disabled-hours="disabledHours"
                  :disabled-minutes="disabledMinutes"
                />
                <el-button 
                  type="info" 
                  @click="scheduleUpdate"
                  :disabled="!scheduledTime"
                  class="confirm-schedule-button"
                >
                  {{ $t('update.confirm') }}
                </el-button>
              </div>
            </el-popover>

            <el-button @click="remindLater">
              <template #icon><el-icon><Icon icon="mdi:bell-sleep-outline" /></el-icon></template>
              {{ $t('update.remindLater') }}
            </el-button>
          </div>
        </template>

        <template v-else>
          <el-divider />
          <div class="up-to-date-message">
            <p>{{ $t('update.congratulations') }}</p>
            <el-button type="info" @click="checkForUpdates(true)" :loading="checkingForUpdates">
              <template #icon><el-icon><Icon icon="mdi:refresh" /></el-icon></template>
              {{ $t('update.checkAgain') }}
            </el-button>
          </div>
        </template>
      </div>
    </el-dialog>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/services/AuthService'
import serverService from '@/services/ServerService'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { markdownToHtml } from '@/utils/markdown'

const { t } = useI18n()
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

// Version control
const currentVersion = ref(import.meta.env.VITE_APP_VERSION || '1.0.0')
const latestVersion = ref('')
const updateAvailable = ref(false)
const checkingForUpdates = ref(false)
const showUpdateDialog = ref(false)
const changelog = ref('')
const updating = ref(false)
const scheduledTime = ref(null)

const versionTooltip = computed(() => {
  if (checkingForUpdates.value) return t('update.checkingTooltip')
  if (updateAvailable.value) return t('update.availableTooltip', { version: latestVersion.value })
  return t('update.currentTooltip', { version: currentVersion.value })
})

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
    to: '/' + paths.slice(0, index + 1).join('/'),
    meta: route.matched.find(r => r.path === '/' + paths.slice(0, index + 1).join('/'))?.meta
  }))
})

const username = computed(() => currentUser.value?.username || t('userMenu.guest'))
const userAvatar = computed(() => currentUser.value?.avatar || '')

// Methods
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) isSidebarCollapsed.value = true
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
  const icons = {
    error: 'mdi:alert-circle-outline',
    success: 'mdi:check-circle-outline',
    warning: 'mdi:alert-outline',
    info: 'mdi:information-outline',
    message: 'mdi:email-outline',
    system: 'mdi:alert-circle-outline',
    task: 'mdi:checkbox-marked-circle-outline'
  }
  return icons[type] || 'mdi:bell-outline'
}

const formatTime = (time) => {
  const date = time instanceof Date ? time : new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 1000 * 60) return t('time.justNow')
  if (diff < 1000 * 60 * 60) return t('time.minutesAgo', { minutes: Math.floor(diff / (1000 * 60)) })
  if (diff < 1000 * 60 * 60 * 24) return t('time.hoursAgo', { hours: Math.floor(diff / (1000 * 60 * 60)) })
  
  return date.toLocaleDateString($i18n.locale.value, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

const handleNotificationClick = (notification) => {
  if (!notification.read) markAsRead(notification.id)
  if (notification.link) router.push(notification.link)
}

const viewAllNotifications = () => router.push('/notifications')

const confirmLogout = async () => {
  try {
    await ElMessageBox.confirm(
      t('logout.confirmMessage'),
      t('logout.confirmTitle'),
      {
        confirmButtonText: t('logout.confirmButton'),
        cancelButtonText: t('logout.cancelButton'),
        type: 'warning'
      }
    )
    await logout()
    router.push('/login')
    ElMessage.success(t('logout.successMessage'))
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('logout.errorMessage'))
    }
  }
}

const navigateToProfile = () => router.push('/profile')
const navigateToSettings = () => router.push('/settings')

// Version update functions
const compareVersions = (a, b) => {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0
    const partB = partsB[i] || 0
    if (partA > partB) return 1
    if (partA < partB) return -1
  }
  return 0
}

const checkForUpdates = async (force = false) => {
  try {
    checkingForUpdates.value = true
    const response = await axios.get('https://api.github.com/repos/gekomod/nas-panel/releases/latest')
    latestVersion.value = response.data.tag_name.replace(/^v/, '')
    
    if (compareVersions(latestVersion.value, currentVersion.value) > 0) {
      updateAvailable.value = true
      const nextCheck = localStorage.getItem('nextUpdateCheck')
      if (force || !nextCheck || Date.now() > parseInt(nextCheck)) {
        await openUpdateDialog()
      }
    } else if (force) {
      updateAvailable.value = false
      await openUpdateDialog()
    }
  } catch (error) {
    console.error('Update check error:', error)
    if (force) ElMessage.error(t('update.checkError'))
  } finally {
    checkingForUpdates.value = false
  }
}

const openUpdateDialog = async () => {
  try {
    if (updateAvailable.value) {
      const response = await axios.get('https://api.github.com/repos/gekomod/nas-panel/releases/latest')
      changelog.value = markdownToHtml(response.data.body || t('update.noChangelog'))
    }
    showUpdateDialog.value = true
  } catch (error) {
    console.error('Changelog error:', error)
    changelog.value = t('update.changelogError')
    showUpdateDialog.value = true
  }
}

const performUpdate = async () => {
  updating.value = true
  try {
    await axios.post('/api/system/update')
    ElNotification.success({
      title: t('update.updateStartedTitle'),
      message: t('update.updateStartedMessage'),
      duration: 0
    })
    showUpdateDialog.value = false
  } catch (error) {
    ElNotification.error({
      title: t('update.updateErrorTitle'),
      message: error.response?.data?.message || t('update.updateErrorMessage'),
    })
  } finally {
    updating.value = false
  }
}

const disabledHours = () => Array.from({ length: 24 }, (_, i) => i).filter(h => h < 0 || h > 6)

const disabledMinutes = (selectedHour) => {
  if (selectedHour === 0) {
    return Array.from({ length: 60 }, (_, i) => i).filter(m => m !== 0)
  }
  return []
}

const scheduleUpdate = () => {
  if (!scheduledTime.value) return
  
  const hours = scheduledTime.value.getHours()
  const minutes = scheduledTime.value.getMinutes()
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  
  axios.post('/api/system/schedule-update', { time: timeString })
    .then(() => {
      ElNotification.success({
        title: t('update.scheduledTitle'),
        message: t('update.scheduledMessage', { time: timeString }),
      })
      showUpdateDialog.value = false
    })
    .catch(error => {
      ElNotification.error({
        title: t('update.scheduleErrorTitle'),
        message: error.response?.data?.message || t('update.scheduleErrorMessage'),
      })
    })
}

const remindLater = () => {
  localStorage.setItem('nextUpdateCheck', Date.now() + 24 * 60 * 60 * 1000)
  showUpdateDialog.value = false
  ElMessage.info(t('update.remindLaterMessage'))
}

const confirmRestart = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz zrestartować serwer? Spowoduje to chwilową niedostępność usług.',
      'Potwierdzenie restartu',
      {
        confirmButtonText: 'Tak, restartuj',
        cancelButtonText: 'Anuluj',
        type: 'warning',
      }
    )

    // Najpierw przekieruj na stronę statusu
    router.push('/server/restart')
    
    // Poczekaj chwilę aż strona się załaduje, potem wykonaj restart
    setTimeout(async () => {
      try {
        await serverService.restart()
      } catch (error) {
        console.log('Restart command sent, server is restarting...')
      }
    }, 1000) // 1 sekunda opóźnienia
    
  } catch (error) {
    // Anulowano
    console.log('Restart cancelled')
  }
}

const confirmShutdown = () => {
  ElMessageBox.confirm(
    'Czy na pewno chcesz wyłączyć serwer? Spowoduje to całkowite zatrzymanie usług.',
    'Potwierdzenie wyłączenia',
    {
      confirmButtonText: 'Tak, wyłącz',
      cancelButtonText: 'Anuluj',
      type: 'error',
    }
  ).then(() => {
    serverService.shutdown().then(() => {
      router.push('/server/shutdown')
    })
  })
}

// Lifecycle hooks
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  checkForUpdates()
  const updateInterval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000)
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', checkMobile)
    clearInterval(updateInterval)
  })
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

.version-tag {
  cursor: pointer;
  margin-right: 10px;
  transition: all 0.3s ease;
  background-color: var(--el-color-info-light-9);
  border-color: var(--el-color-info-light-8);
}

.version-tag:hover {
  opacity: 0.8;
}

.update-icon {
  margin-left: 4px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

/* Update dialog styles */
.update-content {
  padding: 0 15px;
}

.update-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.update-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.version-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 25px 0;
}

.version-box {
  padding: 15px 25px;
  border-radius: 8px;
  text-align: center;
  min-width: 120px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-primary);
}

.version-box.old-version {
  background: var(--el-color-info-light-9);
  border-color: var(--el-color-info-light-7);
}

.version-box.new-version {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.version-box.current-version {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
  margin: 0 auto;
}

.version-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 5px;
}

.version-number {
  display: block;
  font-size: 18px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.changelog {
  margin: 20px 0;
}

.changelog h4 {
  margin-bottom: 10px;
}

.changelog-content {
  color: var(--el-text-color-regular);
  padding-right: 10px;
}

.changelog-content ul {
  margin: 5px 0;
  padding-left: 20px;
}

.changelog-content li {
  margin-bottom: 8px;
}

.update-options {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
  padding-bottom: 10px;
}

.update-button {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
  border: none;
  color: white;
}

.schedule-popover {
  padding: 10px;
}

.schedule-popover h4 {
  margin-top: 0;
  margin-bottom: 15px;
}

.confirm-schedule-button {
  margin-top: 15px;
  width: 100%;
}

.up-to-date-message {
  text-align: center;
  padding: 20px 0;
}

.up-to-date-message p {
  margin-bottom: 20px;
  font-size: 16px;
  color: var(--el-text-color-regular);
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
  
  .version-tag {
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
  background: var(--el-bg-color-overlay);
}

.language-select-dropdown .el-select-dropdown__item {
  display: flex;
  align-items: center;
}

.update-dialog .el-dialog {
  border-radius: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.update-dialog .el-dialog__header {
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 15px;
  background: var(--el-bg-color);
}

.update-dialog .el-dialog__title {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.update-dialog .el-dialog__body {
  padding-top: 10px;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-regular);
}

.update-dialog .el-divider {
  border-color: var(--el-border-color);
}

.update-dialog .el-scrollbar__view {
  padding-right: 10px;
}

/* Dark mode specific styles */
.dark .update-dialog .el-dialog {
  background: var(--el-bg-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dark .update-dialog .el-dialog__header {
  border-bottom-color: var(--el-border-color-dark);
}

.dark .version-box {
  background: var(--el-fill-color-dark);
  border-color: var(--el-border-color-dark);
}

.dark .version-box.old-version {
  background: var(--el-color-info-dark);
  border-color: var(--el-color-info-light-3);
}

.dark .version-box.new-version {
  background: var(--el-color-success-dark);
  border-color: var(--el-color-success-light-3);
}

.dark .version-box.current-version {
  background: var(--el-color-success-dark);
  border-color: var(--el-color-success-light-3);
}

.dark .version-number {
  color: var(--el-text-color-primary);
}

.dark .update-dialog .el-dialog {
  --el-dialog-bg-color: var(--el-bg-color);
  --el-text-color-primary: #e5e5e5;
}

.dark .update-dialog .el-dialog__header {
  border-bottom-color: var(--el-border-color-dark);
}

.dark .update-dialog .el-dialog__body {
  background: var(--el-bg-color-page);
}
</style>
