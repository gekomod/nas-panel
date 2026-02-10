import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/services/AuthService'
import logger from '@/utils/logger'
import serverService from '@/services/ServerService'

export interface SessionDetectionOptions {
  checkInterval?: number
  showFullScreenWarning?: boolean
  autoRedirectToLogin?: boolean
  redirectDelay?: number
}

export function useSessionDetection(options: SessionDetectionOptions = {}) {
  const {
    checkInterval = 30000, // 30 sekund
    showFullScreenWarning = true,
    autoRedirectToLogin = true,
    redirectDelay = 5000
  } = options

  const router = useRouter()
  const { isAuthenticated, checkAuth, logout } = useAuth()
  
  const sessionExpired = ref(false)
  const serverRestarted = ref(false)
  const connectionLost = ref(false)
  const checkingConnection = ref(false)
  const showFullScreenMessage = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 3

  let checkIntervalId: number | null = null
  let heartbeatIntervalId: number | null = null

  // Funkcja sprawdzająca stan sesji
  const checkSession = async (): Promise<boolean> => {
    try {
      checkingConnection.value = true
      
      // Sprawdź autentykację
      const authValid = await checkAuth()
      
      // Sprawdź połączenie z serwerem
      const serverAlive = await serverService.checkServerStatus()
      
      if (!authValid) {
        sessionExpired.value = true
        showFullScreenMessage.value = showFullScreenWarning
        logger.warn('Session expired or invalid authentication')
        return false
      }
      
      if (!serverAlive) {
        connectionLost.value = true
        serverRestarted.value = true
        showFullScreenMessage.value = showFullScreenWarning
        
        // Próba ponownego połączenia
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          logger.info(`Reconnection attempt ${reconnectAttempts.value}/${maxReconnectAttempts}`)
          
          // Poczekaj przed kolejną próbą
          await new Promise(resolve => setTimeout(resolve, 2000))
          return await checkSession()
        }
        
        logger.error('Server connection lost after maximum reconnection attempts')
        return false
      }
      
      // Resetuj stany jeśli wszystko OK
      if (sessionExpired.value || connectionLost.value || serverRestarted.value) {
        resetStates()
        logger.info('Session restored successfully')
      }
      
      return true
    } catch (error) {
      logger.error('Session check failed', { error })
      connectionLost.value = true
      showFullScreenMessage.value = showFullScreenWarning
      return false
    } finally {
      checkingConnection.value = false
    }
  }

  // Wysyłanie heartbeat do serwera
  const sendHeartbeat = async (): Promise<void> => {
    try {
      await serverService.sendHeartbeat()
      logger.debug('Heartbeat sent successfully')
    } catch (error) {
      logger.warn('Heartbeat failed, triggering session check')
      await checkSession()
    }
  }

  // Resetowanie stanów
  const resetStates = (): void => {
    sessionExpired.value = false
    serverRestarted.value = false
    connectionLost.value = false
    reconnectAttempts.value = 0
    showFullScreenMessage.value = false
  }

  // Przekierowanie do logowania
  const redirectToLogin = (): void => {
    if (autoRedirectToLogin && router.currentRoute.value.path !== '/login') {
      setTimeout(() => {
        router.push({
          path: '/login',
          query: {
            reason: sessionExpired.value ? 'session_expired' : 
                   serverRestarted.value ? 'server_restarted' : 
                   'connection_lost',
            redirect: router.currentRoute.value.fullPath
          }
        })
      }, redirectDelay)
    }
  }

  // Ręczna próba ponownego połączenia
  const reconnect = async (): Promise<boolean> => {
    checkingConnection.value = true
    try {
      const success = await checkSession()
      if (success) {
        logger.info('Manual reconnection successful')
        return true
      }
      return false
    } finally {
      checkingConnection.value = false
    }
  }

  // Wymuszenie wylogowania
  const forceLogout = async (): Promise<void> => {
    await logout()
    resetStates()
    router.push('/login')
  }

  // Inicjalizacja
  const initialize = (): void => {
    // Uruchom regularne sprawdzanie sesji
    checkIntervalId = window.setInterval(checkSession, checkInterval)
    
    // Uruchom heartbeat (co 60 sekund)
    heartbeatIntervalId = window.setInterval(sendHeartbeat, 60000)
    
    // Nasłuchuj na zdarzenia online/offline przeglądarki
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Nasłuchuj na zdarzenia widoczności strony
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    logger.info('Session detection initialized')
  }

  // Obsługa zdarzeń
  const handleOnline = async (): Promise<void> => {
    logger.info('Browser back online, checking session...')
    connectionLost.value = false
    await checkSession()
  }

  const handleOffline = (): void => {
    logger.warn('Browser offline')
    connectionLost.value = true
    showFullScreenMessage.value = showFullScreenWarning
  }

  const handleVisibilityChange = async (): Promise<void> => {
    if (!document.hidden) {
      // Strona znów jest widoczna - sprawdź sesję
      logger.info('Page became visible, checking session...')
      await checkSession()
    }
  }

  // Sprzątanie
  const cleanup = (): void => {
    if (checkIntervalId) {
      clearInterval(checkIntervalId)
      checkIntervalId = null
    }
    
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId)
      heartbeatIntervalId = null
    }
    
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    
    logger.info('Session detection cleaned up')
  }

  // Automatyczne wywołanie po montowaniu
  onMounted(() => {
    initialize()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    // Stany
    sessionExpired,
    serverRestarted,
    connectionLost,
    checkingConnection,
    showFullScreenMessage,
    reconnectAttempts,
    
    // Akcje
    checkSession,
    reconnect,
    forceLogout,
    resetStates,
    
    // Zarządzanie
    initialize,
    cleanup
  }
}