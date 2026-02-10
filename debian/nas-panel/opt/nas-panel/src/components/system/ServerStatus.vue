<template>
  <div class="server-status-container">
    <div class="status-background">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <div class="status-card">
      <div class="status-header">
        <div class="status-icon" :class="statusClass">
          <Icon :icon="statusIcon" width="64" />
        </div>
        <h1 class="status-title">{{ title }}</h1>
        <p class="status-message">{{ message }}</p>
      </div>

      <!-- ODLICZANIE 30 SEKUND -->
      <div class="countdown-container" v-if="showCountdown && !isOnline">
        <div class="countdown-circle">
          <div class="countdown-number">{{ countdownSeconds }}</div>
          <svg class="countdown-svg" width="120" height="120">
            <circle 
              class="countdown-circle-bg"
              cx="60" 
              cy="60" 
              r="54" 
            />
            <circle 
              class="countdown-circle-progress"
              cx="60" 
              cy="60" 
              r="54" 
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
            />
          </svg>
        </div>
        <p class="countdown-text">Przewidywany czas do zakończenia restartu</p>
        <p class="checking-status">Sprawdzanie statusu serwera...</p>
      </div>
      
     <div class="initiating-message" v-if="restartInitiated && !isOnline">
      <div class="initiating-box">
        <Icon icon="mdi:progress-upload" width="24" />
        <p>Inicjowanie restartu serwera...</p>
        <p>Proszę czekać, to może potrwać do 3 minut</p>
      </div>
     </div>

      <!-- KOMUNIKAT BŁĘDU -->
      <div class="error-message" v-if="connectionError && !isOnline">
        <div class="error-box">
          <Icon icon="mdi:alert-circle" width="24" />
          <p>Nie można połączyć się z serwerem. Kontynuowanie prób...</p>
        </div>
      </div>

      <div class="status-countdown" v-if="redirectCountdown > 0 && isOnline">
        <p class="countdown-text">
          <Icon icon="mdi:timer-outline" width="20" />
          Przekierowanie na stronę logowania za: {{ redirectCountdown }}s
        </p>
      </div>

      <div class="status-actions">
        <el-button 
          type="primary" 
          @click="forceCheckStatus"
          :loading="checking"
          size="large"
          v-if="!isOnline"
        >
          <Icon icon="mdi:refresh" width="20" />
          Wymuś sprawdzenie statusu
        </el-button>
        <el-button 
          @click="goToLogin"
          size="large"
          v-if="isOnline"
        >
          <Icon icon="mdi:login" width="20" />
          Przejdź do logowania
        </el-button>
        <el-button 
          @click="goToHome"
          size="large"
          type="text"
        >
          <Icon icon="mdi:home" width="20" />
          Strona główna
        </el-button>
      </div>

      <div class="status-info" v-if="!isOnline && operationType === 'restart'">
        <div class="info-box">
          <Icon icon="mdi:information-outline" width="24" />
          <p>Serwer jest w trakcie restartu. Prosimy o cierpliwość.</p>
          <p>Typowy czas restartu: 1-3 minuty</p>
        </div>
      </div>

      <div class="success-message" v-if="isOnline && operationType === 'restart'">
        <div class="success-box">
          <Icon icon="mdi:check-circle" width="24" />
          <p>Serwer jest już online! Możesz się zalogować.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import serverService from '@/services/ServerService'

const route = useRoute()
const router = useRouter()

const isOnline = ref(false)
const checking = ref(false)
const restartInitiated = ref(false)
const connectionError = ref(false)
const countdownSeconds = ref(180)
const redirectCountdown = ref(5)
const checkInterval = ref(null)
const countdownInterval = ref(null)
const redirectInterval = ref(null)
const alreadyRedirected = ref(false)

const operationType = computed(() => route.params.type || 'restart')
const showCountdown = computed(() => operationType.value === 'restart' && !isOnline.value)

// Obliczenia dla okręgu odliczania
const circumference = computed(() => 2 * Math.PI * 54)
const strokeDashoffset = computed(() => {
  const progress = (180 - countdownSeconds.value) / 180
  return circumference.value * (1 - progress)
})

const title = computed(() => {
  if (isOnline.value && operationType.value === 'restart') {
    return 'Serwer online!'
  }
  return operationType.value === 'restart' 
    ? 'Trwa restart serwera' 
    : 'Serwer wyłączony'
})

const message = computed(() => {
  if (isOnline.value && operationType.value === 'restart') {
    return 'Restart został pomyślnie zakończony.'
  }
  const minutes = Math.floor(countdownSeconds.value / 60)
  const seconds = countdownSeconds.value % 60
  return operationType.value === 'restart'
    ? `Przewidywany czas: ${minutes}m ${seconds}s`
    : 'Serwer został bezpiecznie wyłączony.'
})

const statusClass = computed(() => ({
  'status-offline': !isOnline.value,
  'status-online': isOnline.value
}))

const statusIcon = computed(() => {
  return isOnline.value ? 'mdi:check-circle' : 'mdi:progress-clock'
})

// Odliczanie 3 minut
const startCountdown = () => {
  countdownInterval.value = setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value--
    } else {
      clearInterval(countdownInterval.value)
    }
  }, 1000)
}

const checkServerStatus = async () => {
  if (alreadyRedirected.value) return
  
  checking.value = true
  
  try {
    const status = await serverService.checkStatus()
    isOnline.value = status
    
    if (status && operationType.value === 'restart') {
      console.log('Server is back online!')
      clearInterval(checkInterval.value)
      startRedirectCountdown()
    }
  } catch (error) {
    console.log('Server status check:', error.message)
    connectionError.value = true
    isOnline.value = false
  } finally {
    checking.value = false
  }
}

const forceCheckStatus = async () => {
  await checkServerStatus()
}

const startChecking = () => {
  // Sprawdzaj co 5 sekund
  checkInterval.value = setInterval(() => {
    checkServerStatus()
  }, 5000)
}

const startRestartOperation = async () => {
  checking.value = true
  restartInitiated.value = true
  isOnline.value = false
  
  try {
    const result = await serverService.restart()
    console.log('Restart result:', result)

    setTimeout(() => {
      startChecking()
      startCountdown()
    }, 15000)
    
  } catch (error) {
    console.error('Restart error:', error)
    connectionError.value = true
  } finally {
    checking.value = false
  }
}

const startRedirectCountdown = () => {
  alreadyRedirected.value = true
  redirectInterval.value = setInterval(() => {
    redirectCountdown.value--
    if (redirectCountdown.value <= 0) {
      clearInterval(redirectInterval.value)
      goToLogin()
    }
  }, 1000)
}

const goToLogin = () => {
  router.push('/login')
}

const goToHome = () => {
  // Przekieruj do strony głównej, przeglądarka może mieć cache
  window.location.href = '/'
}

onMounted(() => {
  if (operationType.value === 'restart') {
    // Rozpocznij restart dopiero po zamontowaniu komponentu
    setTimeout(() => {
      startRestartOperation()
    }, 1000)
  } else if (operationType.value === 'shutdown') {
    // Logika dla shutdown
    isOnline.value = false
  }
})

onUnmounted(() => {
  if (checkInterval.value) clearInterval(checkInterval.value)
  if (countdownInterval.value) clearInterval(countdownInterval.value)
  if (redirectInterval.value) clearInterval(redirectInterval.value)
})
</script>

<style scoped>
.server-status-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.status-background {
  position: absolute;
  width: 100%;
  height: 100%;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
}

.shape-1 {
  width: 300px;
  height: 300px;
  top: -50px;
  left: -50px;
  background: linear-gradient(45deg, #6a11cb 0%, #2575fc 100%);
  opacity: 0.8;
}

.shape-2 {
  width: 200px;
  height: 200px;
  bottom: -30px;
  right: -30px;
  background: linear-gradient(45deg, #11998e 0%, #38ef7d 100%);
  opacity: 0.8;
}

.status-card {
  width: 100%;
  max-width: 500px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  text-align: center;
  z-index: 1;
}

.status-header {
  margin-bottom: 30px;
}

.status-icon {
  margin-bottom: 20px;
  transition: all 0.3s ease;
}

.status-offline {
  color: #e6a23c; /* warning color */
}

.status-online {
  color: #67c23a; /* success color */
  animation: pulse 2s infinite;
}

.status-title {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 10px;
}

.status-message {
  font-size: 16px;
  color: #7f8c8d;
  line-height: 1.5;
}

.status-progress {
  margin: 30px 0;
}

.progress-bar {
  margin-bottom: 15px;
}

.progress-text {
  font-size: 14px;
  color: #7f8c8d;
  margin: 0;
}

.status-countdown {
  margin: 20px 0;
}

.countdown-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #409eff;
  font-weight: 500;
  margin: 0;
}

.status-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
}

.status-info {
  margin-top: 20px;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #91d5ff;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #409eff;
}

.info-box p {
  margin: 0;
  font-size: 14px;
}

.status-countdown {
  margin: 20px 0;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #91d5ff;
}

.countdown-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #409eff;
  font-weight: 500;
  margin: 0;
}

.success-message {
  margin-top: 20px;
  padding: 15px;
  background: #f0fff0;
  border-radius: 8px;
  border: 1px solid #91f591;
}

.success-box {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #52c41a;
}

.success-box p {
  margin: 0;
  font-weight: 500;
}

.status-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
  flex-wrap: wrap;
}

.countdown-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 30px 0;
}

.countdown-circle {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 15px;
}

.countdown-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: bold;
  color: var(--el-color-primary);
}

.countdown-svg {
  transform: rotate(-90deg);
}

.countdown-circle-bg {
  fill: none;
  stroke: var(--el-border-color-light);
  stroke-width: 6;
}

.countdown-circle-progress {
  fill: none;
  stroke: var(--el-color-primary);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.countdown-text {
  text-align: center;
  color: var(--el-text-color-regular);
  font-size: 0.9rem;
  margin: 0;
}

.status-countdown {
  margin: 20px 0;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #91d5ff;
}

.countdown-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #409eff;
  font-weight: 500;
  margin: 0;
}

.success-message {
  margin-top: 20px;
  padding: 15px;
  background: #f0fff0;
  border-radius: 8px;
  border: 1px solid #91f591;
}

.success-box {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #52c41a;
}

.success-box p {
  margin: 0;
  font-weight: 500;
}

.status-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
  flex-wrap: wrap;
}

.status-info {
  margin-top: 20px;
  padding: 15px;
  background: #fff6e6;
  border-radius: 8px;
  border: 1px solid #ffd591;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e6a23c;
}

.info-box p {
  margin: 0;
  font-size: 0.9rem;
}

.status-online {
  animation: pulse 2s infinite;
}

.checking-status {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 0.8rem;
  margin: 5px 0 0 0;
}

.error-message {
  margin: 20px 0;
  padding: 15px;
  background: #fff2f0;
  border-radius: 8px;
  border: 1px solid #ffccc7;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ff4d4f;
}

.error-box p {
  margin: 0;
  font-size: 0.9rem;
}

.status-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  margin: 30px 0;
}

.status-actions .el-button {
  margin: 5px 0;
}

/* Animacja dla przycisku refresh */
.el-button:active {
  transform: scale(0.98);
}

.el-button--primary {
  transition: all 0.3s ease;
}

.el-button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.initiating-message {
  margin: 20px 0;
  padding: 15px;
  background: #fff7e6;
  border-radius: 8px;
  border: 1px solid #ffd591;
}

.initiating-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #e6a23c;
  text-align: center;
}

.initiating-box p {
  margin: 0;
}

.initiating-box p:first-of-type {
  font-weight: 500;
}

.initiating-box p:last-of-type {
  font-size: 0.9rem;
}

:root.dark .initiating-message {
  background: rgba(230, 162, 60, 0.1);
  border-color: rgba(230, 162, 60, 0.3);
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}


@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
  .status-card {
    margin: 20px;
    padding: 30px 20px;
  }
  
  .status-title {
    font-size: 24px;
  }
  
  .status-actions {
    flex-direction: column;
  }
  
  .status-actions .el-button {
    width: 100%;
  }

  .countdown-circle {
    width: 100px;
    height: 100px;
  }
  
  .countdown-number {
    font-size: 1.5rem;
  }
}

:root.dark .status-card {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:root.dark .status-title {
  color: #f0f0f0;
}

:root.dark .status-message {
  color: #a0a0a0;
}

:root.dark .status-info {
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.3);
}

:root.dark .status-countdown {
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.3);
}

:root.dark .success-message {
  background: rgba(82, 196, 26, 0.1);
  border-color: rgba(82, 196, 26, 0.3);
}

:root.dark .status-countdown {
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.3);
}

:root.dark .success-message {
  background: rgba(82, 196, 26, 0.1);
  border-color: rgba(82, 196, 26, 0.3);
}

:root.dark .status-info {
  background: rgba(230, 162, 60, 0.1);
  border-color: rgba(230, 162, 60, 0.3);
}

:root.dark .error-message {
  background: rgba(255, 77, 79, 0.1);
  border-color: rgba(255, 77, 79, 0.3);
}
</style>
