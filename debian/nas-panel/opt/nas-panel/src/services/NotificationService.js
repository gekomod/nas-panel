import { ref, computed, watch } from 'vue'

// Klucz do localStorage
const STORAGE_KEY = 'app_notifications'

// Ładowanie powiadomień z localStorage
const loadNotifications = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved ? JSON.parse(saved) : []
}

// Stan powiadomień - inicjalizacja z localStorage
const notifications = ref(loadNotifications())

// Funkcja do zapisywania powiadomień w localStorage
const saveNotifications = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.value))
}

// Automatyczne zapisywanie przy każdej zmianie
watch(notifications, saveNotifications, { deep: true })

// Funkcje do zarządzania powiadomieniami
const addNotification = (notification) => {
  const newNotification = {
    id: Date.now(),
    read: false,
    time: new Date().toISOString(), // Zapisujemy jako string
    type: notification.type || 'info',
    ...notification
  }
  notifications.value.unshift(newNotification)
  return newNotification
}

const markAsRead = (id) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification && !notification.read) {
    notification.read = true
  }
}

const markAllAsRead = () => {
  notifications.value.forEach(n => {
    if (!n.read) {
      n.read = true
    }
  })
}

const clearAll = () => {
  notifications.value = []
}

// Dodaj computed dla nieprzeczytanych powiadomień
const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

// Tworzymy globalną wtyczkę
export const NotificationPlugin = {
  install(app) {
    const service = {
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll
    }
    
    // Dodajemy globalną metodę $notify
    app.config.globalProperties.$notify = addNotification
    
    // Udostępniamy serwis w provide/inject
    app.provide('notifications', service)
  }
}

// Eksport dla Composition API
export const useNotifications = () => {
  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll
  }
}