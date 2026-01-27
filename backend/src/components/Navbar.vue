<template>
  <header class="navbar">
    <!-- Lewa część navbara -->
    <div class="navbar-left">
      <div class="logo-container" @click="goToDashboard">
        <div class="logo-icon">
          <Icon icon="mdi:chart-box" width="28" height="28" />
        </div>
        <div class="logo-text" v-if="!isMobile">
          <span class="logo-main">Dashboard</span>
          <span class="logo-sub">NAS Panel</span>
        </div>
      </div>

      <div class="sidebar-toggle" @click="toggleSidebar">
        <div class="toggle-icon" :class="{ 'collapsed': isSidebarCollapsed }">
          <Icon :icon="isSidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'" width="20" height="20" />
        </div>
      </div>
      
      <el-breadcrumb separator="/" class="breadcrumbs" v-if="!isMobile">
        <el-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
          {{ $t(item.meta?.title || item.name) }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <!-- Prawa część navbara -->
    <div class="navbar-right">
      <!-- Wersja aplikacji -->
      <div class="version-container" @click="openUpdateDialog">
        <div class="version-icon" :class="{ 'update-available': updateAvailable }">
          <Icon :icon="updateAvailable ? 'mdi:update' : 'mdi:check-circle'" width="16" height="16" />
        </div>
        <span class="version-text" v-if="!isMobile">v{{ currentVersion }}</span>
        <div class="update-badge" v-if="updateAvailable"></div>
        <el-tooltip placement="bottom" :content="versionTooltip">
          <div class="tooltip-area"></div>
        </el-tooltip>
      </div>

      <!-- Powiadomienia -->
      <div class="notifications-wrapper">
        <div class="notification-icon-container" @click="toggleNotifications">
          <div class="notification-badge" v-if="unreadNotifications > 0">
            {{ unreadNotifications > 99 ? '99+' : unreadNotifications }}
          </div>
          <Icon icon="mdi:bell-outline" width="20" height="20" class="notification-icon" />
        </div>

        <div class="notifications-dropdown" v-if="showNotificationsDropdown">
          <div class="notifications-header">
            <h3>Powiadomienia</h3>
            <div class="notifications-actions">
              <el-button text size="small" @click="markAllAsRead" v-if="unreadNotifications > 0">
                Oznacz wszystkie
              </el-button>
              <div class="close-button" @click="closeNotifications">
                <Icon icon="mdi:close" width="16" height="16" />
              </div>
            </div>
          </div>
          
          <div class="notifications-list">
            <div v-if="notifications.length === 0" class="empty-notifications">
              <Icon icon="mdi:bell-off-outline" width="48" height="48" />
              <p>Brak powiadomień</p>
            </div>
            
            <div 
              v-for="(notification, index) in notifications.slice(0, 5)" 
              :key="index"
              class="notification-item"
              :class="{ 'unread': !notification.read, [notification.type]: !notification.read }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-item-icon" :class="notification.type">
                <Icon :icon="getNotificationIcon(notification.type)" width="18" height="18" />
              </div>
              <div class="notification-item-content">
                <p class="notification-item-title">{{ notification.title }}</p>
                <p class="notification-item-message">{{ notification.message }}</p>
                <span class="notification-item-time">{{ formatTime(notification.time) }}</span>
              </div>
              <div class="notification-item-actions">
                <el-button 
                  v-if="!notification.read"
                  size="mini" 
                  circle 
                  @click.stop="markAsRead(notification.id)"
                >
                  <Icon icon="mdi:email-open" width="14" height="14" />
                </el-button>
              </div>
            </div>
          </div>
          
          <div class="notifications-footer">
            <el-button type="primary" text @click="viewAllNotifications">
              Zobacz wszystkie
            </el-button>
          </div>
        </div>
      </div>

      <!-- Wybór języka -->
      <div class="language-selector" v-if="!isMobile">
        <div class="language-current" @click="toggleLanguageDropdown">
          <Icon :icon="getLanguageIcon(currentLocale)" width="18" height="18" />
          <span class="language-text">{{ getLanguageName(currentLocale) }}</span>
          <Icon icon="mdi:chevron-down" width="16" height="16" class="language-arrow" />
        </div>
        
        <div class="language-dropdown" v-if="showLanguageDropdown">
          <div 
            v-for="lang in availableLanguages" 
            :key="lang.value"
            class="language-option"
            :class="{ 'selected': lang.value === currentLocale }"
            @click="changeLanguage(lang.value)"
          >
            <Icon :icon="lang.icon" width="18" height="18" />
            <span>{{ lang.name }}</span>
            <Icon v-if="lang.value === currentLocale" icon="mdi:check" width="16" height="16" class="language-check" />
          </div>
        </div>
      </div>

      <!-- Przełącznik motywu -->
      <div class="theme-toggle" @click="toggleTheme">
        <div class="theme-icon" :class="theme">
          <Icon :icon="themeIcon" width="20" height="20" />
        </div>
      </div>

      <!-- Menu użytkownika -->
      <div class="user-menu-wrapper">
        <div class="user-profile" @click="toggleUserMenu">
          <div class="user-avatar">
            <img :src="userAvatar" :alt="username" v-if="userAvatar">
            <span v-else>{{ username.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="user-info" v-if="!isMobile">
            <span class="user-name">{{ username }}</span>
            <span class="user-role">Administrator</span>
          </div>
          <Icon icon="mdi:chevron-down" width="16" height="16" class="user-arrow" />
        </div>

        <div class="user-dropdown" v-if="showUserMenu">
          <div class="dropdown-section">
            <div class="dropdown-header">
              <div class="dropdown-avatar">
                <img :src="userAvatar" :alt="username" v-if="userAvatar">
                <span v-else>{{ username.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="dropdown-user-info">
                <span class="dropdown-username">{{ username }}</span>
                <span class="dropdown-email">{{ currentUser?.email || 'user@example.com' }}</span>
              </div>
            </div>
          </div>

          <div class="dropdown-section">
            <div class="dropdown-item" @click="navigateToProfile">
              <Icon icon="mdi:account-outline" width="18" height="18" />
              <span>Profil</span>
            </div>
            <div class="dropdown-item" @click="navigateToSettings">
              <Icon icon="mdi:cog-outline" width="18" height="18" />
              <span>Ustawienia</span>
            </div>
          </div>

          <div class="dropdown-section">
            <div class="server-controls">
              <div class="server-button" @click="confirmRestart">
                <div class="server-button-icon restart">
                  <Icon icon="mdi:restart" width="18" height="18" />
                </div>
                <span>Restart Serwera</span>
              </div>
              <div class="server-button" @click="confirmShutdown">
                <div class="server-button-icon shutdown">
                  <Icon icon="mdi:power" width="18" height="18" />
                </div>
                <span>Wyłącz Serwer</span>
              </div>
            </div>
          </div>

          <div class="dropdown-section">
            <div class="dropdown-item logout" @click="confirmLogout">
              <Icon icon="mdi:logout" width="18" height="18" />
              <span>Wyloguj się</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog aktualizacji -->
    <el-dialog
      v-model="showUpdateDialog"
      :title="updateAvailable ? 'Dostępna aktualizacja' : 'System aktualny'"
      width="500"
      :close-on-click-modal="false"
      class="update-dialog"
    >
      <div class="update-content">
        <div class="update-header">
          <div class="update-icon" :class="{ 'available': updateAvailable }">
            <Icon :icon="updateAvailable ? 'mdi:cloud-download' : 'mdi:check-circle'" width="32" height="32" />
          </div>
          <div class="update-header-text">
            <h3>{{ updateAvailable ? 'Dostępna nowa wersja!' : 'System jest aktualny' }}</h3>
            <p v-if="updateAvailable">Zainstaluj najnowszą wersję, aby korzystać z nowych funkcji</p>
            <p v-else>Gratulacje! Używasz najnowszej wersji systemu.</p>
          </div>
        </div>

        <div class="version-display" :class="{ 'update-available': updateAvailable }">
          <div class="version-current">
            <div class="version-card">
              <span class="version-label">Twoja wersja</span>
              <span class="version-value">{{ currentVersion }}</span>
              <div class="version-status">
                <Icon :icon="updateAvailable ? 'mdi:alert-circle' : 'mdi:check-circle'" width="16" height="16" />
                <span>{{ updateAvailable ? 'Wymaga aktualizacji' : 'Najnowsza' }}</span>
              </div>
            </div>
          </div>
          
          <div class="version-latest" v-if="updateAvailable">
            <div class="version-arrow">
              <Icon icon="mdi:arrow-right-bold" width="24" height="24" />
            </div>
            <div class="version-card latest">
              <span class="version-label">Nowa wersja</span>
              <span class="version-value">{{ latestVersion }}</span>
              <div class="version-status latest">
                <Icon icon="mdi:star-circle" width="16" height="16" />
                <span>Dostępna</span>
              </div>
            </div>
          </div>
        </div>

        <div class="update-changelog" v-if="updateAvailable && changelog">
          <h4>Co nowego w wersji {{ latestVersion }}?</h4>
          <div class="changelog-content" v-html="changelog"></div>
        </div>

        <div class="update-actions" v-if="updateAvailable">
          <el-button 
            type="primary" 
            @click="performUpdate" 
            :loading="updating"
            class="update-button"
          >
            <Icon icon="mdi:download" width="18" height="18" />
            Zaktualizuj teraz
          </el-button>
          <el-button type="info" plain @click="scheduleUpdateDialog">
            <Icon icon="mdi:clock-outline" width="18" height="18" />
            Zaplanuj aktualizację
          </el-button>
          <el-button type="default" @click="remindLater">
            <Icon icon="mdi:bell-sleep-outline" width="18" height="18" />
            Przypomnij później
          </el-button>
        </div>

        <div class="update-actions" v-else>
          <el-button type="info" @click="checkForUpdates(true)" :loading="checkingForUpdates">
            <Icon icon="mdi:refresh" width="18" height="18" />
            Sprawdź ponownie
          </el-button>
          <el-button type="default" @click="showUpdateDialog = false">
            <Icon icon="mdi:close" width="18" height="18" />
            Zamknij
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- Dialog planowania aktualizacji -->
    <el-dialog
      v-model="showScheduleDialog"
      title="Zaplanuj aktualizację"
      width="400"
      class="schedule-dialog"
    >
      <div class="schedule-content">
        <p>Wybierz godzinę automatycznej aktualizacji:</p>
        <div class="time-selector">
          <el-time-picker
            v-model="scheduledTime"
            format="HH:mm"
            placeholder="Wybierz godzinę"
            :clearable="false"
          />
        </div>
        <div class="schedule-actions">
          <el-button type="primary" @click="scheduleUpdate" :disabled="!scheduledTime">
            Zaplanuj
          </el-button>
          <el-button @click="showScheduleDialog = false">Anuluj</el-button>
        </div>
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

const { t, locale } = useI18n()
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

// State
const isSidebarCollapsed = ref(false)
const isMobile = ref(false)
const showNotificationsDropdown = ref(false)
const showUserMenu = ref(false)
const showLanguageDropdown = ref(false)
const showUpdateDialog = ref(false)
const showScheduleDialog = ref(false)

// Version control
const currentVersion = ref(import.meta.env.VITE_APP_VERSION || '1.0.0')
const latestVersion = ref('')
const updateAvailable = ref(false)
const checkingForUpdates = ref(false)
const changelog = ref('')
const updating = ref(false)
const scheduledTime = ref(null)

// Computed
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

// Languages
const availableLanguages = [
  { value: 'en', name: 'English', icon: 'twemoji:flag-united-states' },
  { value: 'pl', name: 'Polski', icon: 'twemoji:flag-poland' }
]

const getLanguageIcon = (lang) => {
  const langObj = availableLanguages.find(l => l.value === lang)
  return langObj?.icon || 'twemoji:flag-united-states'
}

const getLanguageName = (lang) => {
  const langObj = availableLanguages.find(l => l.value === lang)
  return langObj?.name || 'English'
}

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

const goToDashboard = () => {
  router.push('/')
}

const toggleTheme = () => {
  const themes = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(props.theme)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  emit('theme-changed', nextTheme)
}

const toggleNotifications = () => {
  showNotificationsDropdown.value = !showNotificationsDropdown.value
  if (showNotificationsDropdown.value) {
    showUserMenu.value = false
    showLanguageDropdown.value = false
  }
}

const closeNotifications = () => {
  showNotificationsDropdown.value = false
}

const toggleLanguageDropdown = () => {
  showLanguageDropdown.value = !showLanguageDropdown.value
  if (showLanguageDropdown.value) {
    showUserMenu.value = false
    showNotificationsDropdown.value = false
  }
}

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
  if (showUserMenu.value) {
    showNotificationsDropdown.value = false
    showLanguageDropdown.value = false
  }
}

const changeLanguage = (lang) => {
  locale.value = lang
  showLanguageDropdown.value = false
  localStorage.setItem('preferredLanguage', lang)
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
  
  return date.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

const handleNotificationClick = (notification) => {
  if (!notification.read) markAsRead(notification.id)
  if (notification.link) router.push(notification.link)
  showNotificationsDropdown.value = false
}

const viewAllNotifications = () => {
  router.push('/notifications')
  showNotificationsDropdown.value = false
}

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

const navigateToProfile = () => {
  router.push('/profile')
  showUserMenu.value = false
}

const navigateToSettings = () => {
  router.push('/settings')
  showUserMenu.value = false
}

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

const scheduleUpdateDialog = () => {
  showUpdateDialog.value = false
  showScheduleDialog.value = true
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
      showScheduleDialog.value = false
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

    router.push('/server/restart')
    
    setTimeout(async () => {
      try {
        await serverService.restart()
      } catch (error) {
        console.log('Restart command sent, server is restarting...')
      }
    }, 1000)
    
  } catch (error) {
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

// Close dropdowns on outside click
const handleClickOutside = (event) => {
  if (!event.target.closest('.notifications-wrapper')) {
    showNotificationsDropdown.value = false
  }
  if (!event.target.closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
  if (!event.target.closest('.language-selector')) {
    showLanguageDropdown.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
  
  // Set initial language
  const savedLang = localStorage.getItem('preferredLanguage')
  if (savedLang) {
    locale.value = savedLang
  }
  
  checkForUpdates()
  const updateInterval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000)
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', checkMobile)
    document.removeEventListener('click', handleClickOutside)
    clearInterval(updateInterval)
  })
})
</script>

<style scoped>
.navbar {
  height: 64px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 2000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid #334155;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .logo-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: 10px;
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
    
    .logo-main {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    
    .logo-sub {
      font-size: 12px;
      font-weight: 500;
      color: #94a3b8;
      margin-top: 2px;
    }
  }
}

.sidebar-toggle {
  margin-left: 8px;
  
  .toggle-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      border-color: #475569;
      transform: translateX(-2px);
    }
    
    &.collapsed {
      transform: rotate(180deg);
      
      &:hover {
        transform: rotate(180deg) translateX(-2px);
      }
    }
  }
}

.breadcrumbs {
  margin-left: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  :deep(.el-breadcrumb__item) {
    .el-breadcrumb__inner {
      color: #94a3b8;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    
    &:last-child .el-breadcrumb__inner {
      color: #f8fafc;
      font-weight: 600;
    }
    
    &:hover .el-breadcrumb__inner {
      color: #cbd5e1;
    }
  }
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}

.version-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  position: relative;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: #475569;
    
    .version-icon {
      transform: scale(1.1);
    }
  }
  
  .version-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    color: #3b82f6;
    transition: all 0.3s ease;
    
    &.update-available {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
      animation: pulse 2s infinite;
    }
  }
  
  .version-text {
    font-size: 14px;
    font-weight: 500;
    color: #cbd5e1;
  }
  
  .update-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.9);
  }
  
  .tooltip-area {
    position: absolute;
    inset: 0;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.notifications-wrapper {
  position: relative;
  
  .notification-icon-container {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #475569;
      
      .notification-icon {
        color: #f8fafc;
      }
    }
    
    .notification-icon {
      color: #94a3b8;
      transition: color 0.3s ease;
    }
    
    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      font-size: 10px;
      font-weight: 700;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      border: 2px solid rgba(15, 23, 42, 0.9);
    }
  }
  
  .notifications-dropdown {
    position: absolute;
    top: 48px;
    right: 0;
    width: 320px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid #334155;
    z-index: 1000;
    animation: slideDown 0.3s ease;
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .notifications-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #334155;
      
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #f8fafc;
      }
      
      .notifications-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .close-button {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #94a3b8;
          
          &:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #f8fafc;
          }
        }
      }
    }
    
    .notifications-list {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px 0;
      
      &::-webkit-scrollbar {
        width: 4px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      
      &::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 2px;
      }
      
      .empty-notifications {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #94a3b8;
        text-align: center;
        
        svg {
          opacity: 0.6;
          margin-bottom: 12px;
        }
        
        p {
          margin: 0;
          font-size: 14px;
        }
      }
      
      .notification-item {
        display: flex;
        align-items: flex-start;
        padding: 12px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        border-bottom: 1px solid #334155;
        
        &:last-child {
          border-bottom: none;
        }
        
        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        &.unread {
          background: rgba(59, 130, 246, 0.05);
          
          &:hover {
            background: rgba(59, 130, 246, 0.1);
          }
        }
        
        .notification-item-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          margin-right: 12px;
          flex-shrink: 0;
          transition: all 0.3s ease;
          
          &.error {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
          }
          
          &.success {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
          }
          
          &.warning {
            background: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
          }
          
          &.info {
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
          }
        }
        
        .notification-item-content {
          flex: 1;
          min-width: 0;
          
          .notification-item-title {
            margin: 0 0 4px;
            font-size: 14px;
            font-weight: 600;
            color: #f8fafc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .notification-item-message {
            margin: 0 0 4px;
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          .notification-item-time {
            font-size: 12px;
            color: #64748b;
          }
        }
        
        .notification-item-actions {
          flex-shrink: 0;
          margin-left: 8px;
          
          :deep(.el-button) {
            background: rgba(255, 255, 255, 0.05);
            border-color: transparent;
            color: #94a3b8;
            
            &:hover {
              background: rgba(255, 255, 255, 0.1);
              color: #f8fafc;
            }
          }
        }
      }
    }
    
    .notifications-footer {
      padding: 12px 20px;
      border-top: 1px solid #334155;
      text-align: center;
      
      :deep(.el-button) {
        width: 100%;
        background: rgba(59, 130, 246, 0.1);
        border-color: transparent;
        color: #3b82f6;
        
        &:hover {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
      }
    }
  }
}

.language-selector {
  position: relative;
  
  .language-current {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    min-width: 110px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #475569;
    }
    
    svg:first-child {
      color: #3b82f6;
    }
    
    .language-text {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #cbd5e1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .language-arrow {
      color: #94a3b8;
      transition: transform 0.3s ease;
    }
  }
  
  .language-dropdown {
    position: absolute;
    top: 48px;
    right: 0;
    width: 180px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid #334155;
    z-index: 1000;
    animation: slideDown 0.3s ease;
    padding: 8px;
    
    .language-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      color: #cbd5e1;
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }
      
      &.selected {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
        font-weight: 500;
      }
      
      svg:first-child {
        flex-shrink: 0;
      }
      
      span {
        flex: 1;
        font-size: 14px;
      }
      
      .language-check {
        color: #3b82f6;
      }
    }
  }
}

.theme-toggle {
  .theme-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    color: #94a3b8;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #475569;
      color: #f8fafc;
      transform: rotate(15deg);
    }
    
    &.dark {
      color: #f59e0b;
    }
    
    &.light {
      color: #f59e0b;
    }
    
    &.system {
      color: #3b82f6;
    }
  }
}

.user-menu-wrapper {
  position: relative;
  
  .user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    min-width: fit-content;
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #475569;
      
      .user-avatar {
        border-color: #3b82f6;
      }
    }
    
    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      overflow: hidden;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border: 2px solid transparent;
      transition: all 0.3s ease;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      span {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: white;
        font-weight: 600;
        font-size: 16px;
      }
    }
    
    .user-info {
      display: flex;
      flex-direction: column;
      
      .user-name {
        font-size: 14px;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }
      
      .user-role {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 2px;
      }
    }
    
    .user-arrow {
      color: #94a3b8;
      transition: transform 0.3s ease;
      margin-left: 4px;
    }
  }
  
  .user-dropdown {
    position: absolute;
    top: 52px;
    right: 0;
    width: 280px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid #334155;
    z-index: 1000;
    animation: slideDown 0.3s ease;
    
    .dropdown-section {
      padding: 16px;
      
      &:not(:last-child) {
        border-bottom: 1px solid #334155;
      }
      
      .dropdown-header {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .dropdown-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border: 2px solid rgba(59, 130, 246, 0.3);
          
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          span {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            color: white;
            font-weight: 700;
            font-size: 20px;
          }
        }
        
        .dropdown-user-info {
          flex: 1;
          min-width: 0;
          
          .dropdown-username {
            display: block;
            font-size: 16px;
            font-weight: 600;
            color: #f8fafc;
            margin-bottom: 4px;
          }
          
          .dropdown-email {
            display: block;
            font-size: 13px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
      
      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        color: #cbd5e1;
        
        &:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f8fafc;
          transform: translateX(4px);
        }
        
        svg {
          color: #94a3b8;
          transition: color 0.3s ease;
        }
        
        &:hover svg {
          color: #3b82f6;
        }
        
        &.logout {
          color: #ef4444;
          
          &:hover {
            background: rgba(239, 68, 68, 0.1);
            color: #fca5a5;
          }
          
          svg {
            color: #ef4444;
          }
          
          &:hover svg {
            color: #fca5a5;
          }
        }
      }
      
      .server-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
        
        .server-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid transparent;
          
          &:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: #475569;
            transform: translateX(4px);
            
            .server-button-icon.restart {
              background: rgba(245, 158, 11, 0.2);
              color: #f59e0b;
            }
            
            .server-button-icon.shutdown {
              background: rgba(239, 68, 68, 0.2);
              color: #ef4444;
            }
          }
          
          .server-button-icon {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.3s ease;
            
            &.restart {
              background: rgba(245, 158, 11, 0.1);
              color: #f59e0b;
            }
            
            &.shutdown {
              background: rgba(239, 68, 68, 0.1);
              color: #ef4444;
            }
          }
          
          span {
            font-size: 14px;
            font-weight: 500;
            color: #cbd5e1;
            flex: 1;
          }
        }
      }
    }
  }
}

.update-dialog {
  :deep(.el-dialog) {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 16px;
    border: 1px solid #334155;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    
    .el-dialog__header {
      border-bottom: 1px solid #334155;
      padding: 20px 24px;
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
      
      .el-dialog__title {
        color: #f8fafc;
        font-weight: 600;
        font-size: 18px;
      }
      
      .el-dialog__headerbtn {
        .el-dialog__close {
          color: #94a3b8;
          
          &:hover {
            color: #f8fafc;
          }
        }
      }
    }
    
    .el-dialog__body {
      padding: 0;
    }
  }
}

.update-content {
  padding: 24px;
  
  .update-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    
    .update-icon {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(34, 197, 94, 0.1);
      border-radius: 16px;
      color: #22c55e;
      
      &.available {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        animation: pulse 2s infinite;
      }
    }
    
    .update-header-text {
      flex: 1;
      
      h3 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #f8fafc;
      }
      
      p {
        margin: 0;
        color: #94a3b8;
        font-size: 14px;
        line-height: 1.5;
      }
    }
  }
  
  .version-display {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid #334155;
    padding: 20px;
    margin-bottom: 24px;
    
    &.update-available {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    
    .version-current {
      flex: 1;
    }
    
    .version-latest {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 20px;
      
      .version-arrow {
        color: #94a3b8;
      }
    }
    
    .version-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
      transition: all 0.3s ease;
      
      &.latest {
        background: rgba(34, 197, 94, 0.05);
        border-color: rgba(34, 197, 94, 0.2);
        animation: glow 2s infinite;
      }
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
      }
      
      .version-label {
        display: block;
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }
      
      .version-value {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #f8fafc;
        margin-bottom: 12px;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      }
      
      .version-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #94a3b8;
        
        &.latest {
          color: #22c55e;
        }
        
        svg {
          flex-shrink: 0;
        }
      }
    }
  }
  
  @keyframes glow {
    0%, 100% {
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
    }
  }
  
  .update-changelog {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid #334155;
    padding: 20px;
    margin-bottom: 24px;
    
    h4 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
    }
    
    .changelog-content {
      max-height: 200px;
      overflow-y: auto;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.5;
      
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 3px;
        
        &:hover {
          background: #64748b;
        }
      }
      
      :deep(*) {
        margin-top: 0;
        margin-bottom: 12px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
      
      :deep(ul) {
        padding-left: 20px;
        margin: 8px 0;
        
        li {
          margin-bottom: 6px;
        }
      }
      
      :deep(strong) {
        color: #f8fafc;
        font-weight: 600;
      }
      
      :deep(code) {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', monospace;
        font-size: 12px;
        color: #f59e0b;
      }
    }
  }
  
  .update-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    
    .update-button {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border: none;
      color: white;
      font-weight: 600;
      transition: all 0.3s ease;
      
      &:hover {
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(34, 197, 94, 0.3);
      }
      
      &:active {
        transform: translateY(0);
      }
    }
    
    :deep(.el-button) {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 500;
      transition: all 0.3s ease;
      
      &:not(.update-button):hover {
        transform: translateY(-2px);
      }
    }
  }
}

.schedule-dialog {
  :deep(.el-dialog) {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 16px;
    border: 1px solid #334155;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    
    .el-dialog__header {
      border-bottom: 1px solid #334155;
      padding: 20px 24px;
      
      .el-dialog__title {
        color: #f8fafc;
        font-weight: 600;
      }
    }
    
    .el-dialog__body {
      padding: 24px;
    }
  }
}

.schedule-content {
  p {
    color: #cbd5e1;
    margin-bottom: 20px;
  }
  
  .time-selector {
    margin-bottom: 24px;
    
    :deep(.el-date-editor) {
      width: 100%;
      
      .el-input__wrapper {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #334155;
        border-radius: 10px;
        box-shadow: none;
        
        &:hover {
          border-color: #475569;
        }
        
        .el-input__inner {
          color: #cbd5e1;
        }
      }
    }
  }
  
  .schedule-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 16px;
  }
  
  .logo-text,
  .breadcrumbs,
  .version-text,
  .language-selector,
  .user-info {
    display: none !important;
  }
  
  .navbar-left,
  .navbar-right {
    gap: 8px;
  }
  
  .logo-container {
    padding: 8px;
  }
  
  .sidebar-toggle .toggle-icon {
    width: 32px;
    height: 32px;
  }
  
  .notifications-dropdown,
  .user-dropdown,
  .language-dropdown {
    position: fixed !important;
    top: 64px !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    border-radius: 0 0 16px 16px !important;
    max-height: calc(100vh - 64px);
    overflow-y: auto;
  }
  
  .version-display.update-available {
    flex-direction: column;
    gap: 20px;
    
    .version-latest {
      flex-direction: column;
      gap: 12px;
      
      .version-arrow {
        transform: rotate(90deg);
      }
    }
  }
}

@media (max-width: 480px) {
  .navbar {
    height: 56px;
  }
  
  .logo-icon {
    width: 32px !important;
    height: 32px !important;
  }
  
  .version-container {
    padding: 6px;
  }
  
  .theme-toggle .theme-icon,
  .notification-icon-container,
  .user-profile,
  .language-current {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    padding: 6px !important;
    
    span, .language-arrow {
      display: none !important;
    }
  }
  
  .update-dialog {
    :deep(.el-dialog) {
      width: 90% !important;
      max-width: 100% !important;
      margin: 20px auto !important;
    }
  }
  
  .update-actions {
    flex-direction: column;
    
    :deep(.el-button) {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>
