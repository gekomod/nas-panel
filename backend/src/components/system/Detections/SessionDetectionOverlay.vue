<template>
  <div v-if="showOverlay" class="session-detection-overlay">
    <div class="overlay-content">
      <!-- Logo/ikonka -->
      <div class="status-icon">
        <i 
          :class="statusIcon" 
          class="icon-large"
          :style="{ color: statusColor }"
        ></i>
      </div>
      
      <!-- Tytuł -->
      <h1 class="status-title">
        {{ statusTitle }}
      </h1>
      
      <!-- Opis -->
      <p class="status-description">
        {{ statusDescription }}
      </p>
      
      <!-- Postęp (dla ponownego łączenia) -->
      <div v-if="checkingConnection" class="reconnect-progress">
        <el-progress 
          :percentage="reconnectPercentage" 
          :status="reconnectStatus"
          :stroke-width="6"
          :show-text="false"
        />
        <p class="reconnect-text">
          {{ reconnectText }}
        </p>
      </div>
      
      <!-- Licznik do przekierowania -->
      <div v-if="showCountdown && autoRedirect" class="countdown">
        <p>
          Przekierowanie do logowania za 
          <span class="countdown-number">{{ countdown }}</span>
          sekund
        </p>
      </div>
      
      <!-- Przyciski akcji -->
      <div class="action-buttons">
        <!-- Przycisk ponów połączenie -->
        <el-button 
          v-if="!checkingConnection && (connectionLost || serverRestarted)"
          type="primary" 
          size="large"
          :loading="reconnecting"
          @click="handleReconnect"
          class="reconnect-button"
        >
          <template #loading>
            <span class="loading-text">Ponawianie połączenia...</span>
          </template>
          <span v-if="!reconnecting">
            <i class="mdi:refresh"></i>
            Spróbuj ponownie
          </span>
        </el-button>
        
        <!-- Przycisk odśwież stronę -->
        <el-button 
          type="default" 
          size="large"
          @click="handleRefresh"
          class="refresh-button"
        >
          <i class="mdi:reload"></i>
          Odśwież stronę
        </el-button>
        
        <!-- Przycisk przejdź do logowania -->
        <el-button 
          v-if="!autoRedirect"
          type="warning" 
          size="large"
          @click="handleGoToLogin"
          class="login-button"
        >
          <i class="mdi:login"></i>
          Przejdź do logowania
        </el-button>
        
        <!-- Przycisk anuluj (tylko dla ostrzeżeń) -->
        <el-button 
          v-if="!sessionExpired && !serverRestarted"
          type="text" 
          size="large"
          @click="handleDismiss"
          class="dismiss-button"
        >
          Kontynuuj bez połączenia
        </el-button>
      </div>
      
      <!-- Informacje techniczne (tylko w trybie development) -->
      <div v-if="isDevelopment" class="technical-info">
        <details>
          <summary>Informacje techniczne</summary>
          <div class="info-content">
            <p><strong>Status:</strong> 
              <span :class="`status-indicator ${connectionLost ? 'error' : 'success'}`">
                {{ connectionLost ? 'Brak połączenia' : 'Połączony' }}
              </span>
            </p>
            <p><strong>Próby ponownego połączenia:</strong> {{ reconnectAttempts }}/{{ maxReconnectAttempts }}</p>
            <p><strong>Ostatnie sprawdzenie:</strong> {{ lastCheckTime }}</p>
            <p><strong>Typ błędu:</strong> 
              <span class="error-type">
                {{ errorType }}
              </span>
            </p>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElProgress } from 'element-plus'
import { useSessionDetection } from '@/composables/useSessionDetection'
import logger from '@/utils/logger'

const router = useRouter()

// Props
const props = withDefaults(defineProps<{
  autoRedirect?: boolean
  redirectDelay?: number
  maxReconnectAttempts?: number
}>(), {
  autoRedirect: true,
  redirectDelay: 5000,
  maxReconnectAttempts: 3
})

// Composables
const {
  sessionExpired,
  serverRestarted,
  connectionLost,
  checkingConnection,
  showFullScreenMessage,
  reconnectAttempts,
  reconnect,
  forceLogout
} = useSessionDetection({
  autoRedirectToLogin: props.autoRedirect,
  redirectDelay: props.redirectDelay
})

// Stan lokalny
const reconnecting = ref(false)
const countdown = ref(props.redirectDelay / 1000)
const lastCheckTime = ref(new Date().toLocaleTimeString())
let countdownInterval: number | null = null

// Obliczenia
const showOverlay = computed(() => {
  return showFullScreenMessage.value && 
         (sessionExpired.value || serverRestarted.value || connectionLost.value)
})

const statusIcon = computed(() => {
  if (sessionExpired.value) return 'mdi:logout-variant'
  if (serverRestarted.value) return 'mdi:server-off'
  if (connectionLost.value) return 'mdi:wifi-off'
  return 'mdi:check-circle'
})

const statusColor = computed(() => {
  if (sessionExpired.value) return '#f56c6c'
  if (serverRestarted.value) return '#e6a23c'
  if (connectionLost.value) return '#909399'
  return '#67c23a'
})

const statusTitle = computed(() => {
  if (sessionExpired.value) return 'Sesja wygasła'
  if (serverRestarted.value) return 'Serwer został zrestartowany'
  if (connectionLost.value) return 'Utracono połączenie z serwerem'
  return 'Połączono'
})

const statusDescription = computed(() => {
  if (sessionExpired.value) {
    return 'Twoja sesja wygasła z powodu bezczynności. Zaloguj się ponownie, aby kontynuować.'
  }
  if (serverRestarted.value) {
    return 'Serwer został zrestartowany. Po ponownym połączeniu możesz kontynuować pracę.'
  }
  if (connectionLost.value) {
    return 'Nie można połączyć się z serwerem. Sprawdź swoje połączenie internetowe.'
  }
  return 'Połączenie z serwerem aktywne.'
})

const reconnectPercentage = computed(() => {
  return Math.min((reconnectAttempts.value / props.maxReconnectAttempts) * 100, 100)
})

const reconnectStatus = computed(() => {
  return reconnectAttempts.value >= props.maxReconnectAttempts ? 'exception' : 'success'
})

const reconnectText = computed(() => {
  if (checkingConnection.value) {
    return `Próba ponownego połączenia (${reconnectAttempts.value}/${props.maxReconnectAttempts})...`
  }
  return ''
})

const showCountdown = computed(() => {
  return sessionExpired.value && props.autoRedirect && !reconnecting.value
})

const isDevelopment = computed(() => {
  return import.meta.env.MODE === 'development'
})

const errorType = computed(() => {
  if (sessionExpired.value) return 'SESSION_EXPIRED'
  if (serverRestarted.value) return 'SERVER_RESTARTED'
  if (connectionLost.value) return 'CONNECTION_LOST'
  return 'NONE'
})

// Metody
const handleReconnect = async () => {
  reconnecting.value = true
  try {
    const success = await reconnect()
    if (success) {
      logger.info('Manual reconnection successful')
    } else {
      logger.warn('Manual reconnection failed')
    }
  } finally {
    reconnecting.value = false
    lastCheckTime.value = new Date().toLocaleTimeString()
  }
}

const handleRefresh = () => {
  window.location.reload()
}

const handleGoToLogin = () => {
  forceLogout()
}

const handleDismiss = () => {
  showFullScreenMessage.value = false
  logger.info('User dismissed connection warning')
}

const startCountdown = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
  
  countdown.value = props.redirectDelay / 1000
  countdownInterval = window.setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
      handleGoToLogin()
    }
  }, 1000)
}

// Cykl życia
onMounted(() => {
  logger.info('SessionDetectionOverlay mounted')
  
  // Uruchom odliczanie jeśli potrzebne
  if (sessionExpired.value && props.autoRedirect) {
    startCountdown()
  }
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  logger.info('SessionDetectionOverlay unmounted')
})

// Obserwuj zmiany stanu sesji
watch(sessionExpired, (newValue) => {
  if (newValue && props.autoRedirect) {
    startCountdown()
  } else {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  }
})
</script>

<style scoped lang="scss">
.session-detection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.3s ease-out;
  
  .overlay-content {
    max-width: 600px;
    width: 100%;
    text-align: center;
    padding: 40px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    
    .status-icon {
      margin-bottom: 30px;
      
      .icon-large {
        font-size: 80px;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
      }
    }
    
    .status-title {
      color: #fff;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    .status-description {
      color: rgba(255, 255, 255, 0.8);
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 30px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .reconnect-progress {
      margin: 30px 0;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
      
      .reconnect-text {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin-top: 8px;
      }
    }
    
    .countdown {
      margin: 25px 0;
      padding: 15px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      
      p {
        color: rgba(255, 255, 255, 0.9);
        font-size: 16px;
        margin: 0;
      }
      
      .countdown-number {
        display: inline-block;
        min-width: 30px;
        text-align: center;
        font-weight: bold;
        color: #ff6b6b;
        font-size: 20px;
        animation: pulse 1s infinite;
      }
    }
    
    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 30px;
      
      @media (min-width: 480px) {
        flex-direction: row;
        justify-content: center;
      }
      
      .el-button {
        min-width: 200px;
        height: 50px;
        font-size: 16px;
        font-weight: 500;
        border-radius: 10px;
        transition: all 0.3s ease;
        
        i {
          margin-right: 8px;
          font-size: 18px;
        }
        
        &.reconnect-button {
          background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
          border: none;
          
          &:hover:not(.is-loading) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(64, 158, 255, 0.3);
          }
          
          .loading-text {
            color: rgba(255, 255, 255, 0.9);
          }
        }
        
        &.refresh-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          
          &:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
          }
        }
        
        &.login-button {
          background: linear-gradient(135deg, #e6a23c 0%, #b88222 100%);
          border: none;
          color: #fff;
          
          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(230, 162, 60, 0.3);
          }
        }
        
        &.dismiss-button {
          color: rgba(255, 255, 255, 0.6);
          
          &:hover {
            color: rgba(255, 255, 255, 0.9);
            background: rgba(255, 255, 255, 0.05);
          }
        }
      }
    }
    
    .technical-info {
      margin-top: 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 20px;
      
      summary {
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        font-size: 14px;
        user-select: none;
        transition: color 0.2s ease;
        
        &:hover {
          color: rgba(255, 255, 255, 0.9);
        }
      }
      
      .info-content {
        text-align: left;
        margin-top: 15px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        font-size: 13px;
        
        p {
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.8);
          
          strong {
            color: rgba(255, 255, 255, 0.9);
            display: inline-block;
            min-width: 200px;
          }
        }
        
        .status-indicator {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          
          &.success {
            background: rgba(103, 194, 58, 0.2);
            color: #67c23a;
          }
          
          &.error {
            background: rgba(245, 108, 108, 0.2);
            color: #f56c6c;
          }
        }
        
        .error-type {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.4);
          padding: 2px 6px;
          border-radius: 4px;
          border-left: 3px solid #f56c6c;
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}
</style>
