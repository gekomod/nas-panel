<template>
  <div v-if="showStatusBar" class="connection-status-bar" :class="statusClass">
    <div class="status-content">
      <i :class="statusIcon" class="status-icon"></i>
      <span class="status-text">{{ statusText }}</span>
      <div v-if="showProgress" class="status-progress">
        <el-progress 
          :percentage="progressPercentage" 
          :show-text="false"
          :stroke-width="2"
        />
      </div>
      <el-button 
        v-if="showReconnectButton"
        type="text" 
        size="small"
        @click="handleReconnect"
        class="reconnect-btn"
      >
        Ponów
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElProgress, ElButton } from 'element-plus'
import { useSessionDetection } from '@/composables/useSessionDetection'

const {
  connectionLost,
  checkingConnection,
  reconnectAttempts,
  reconnect
} = useSessionDetection()

const showStatusBar = computed(() => {
  return connectionLost.value && !checkingConnection.value
})

const statusClass = computed(() => {
  return connectionLost.value ? 'warning' : 'success'
})

const statusIcon = computed(() => {
  return connectionLost.value ? 'mdi:wifi-off' : 'mdi:wifi'
})

const statusText = computed(() => {
  return connectionLost.value 
    ? 'Utracono połączenie z serwerem'
    : 'Połączony'
})

const showProgress = computed(() => checkingConnection.value)
const showReconnectButton = computed(() => connectionLost.value && !checkingConnection.value)

const progressPercentage = computed(() => {
  return Math.min((reconnectAttempts.value / 3) * 100, 100)
})

const handleReconnect = async () => {
  await reconnect()
}
</script>

<style scoped>
.connection-status-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  padding: 8px 16px;
  font-size: 14px;
  animation: slideDown 0.3s ease-out;
  
  &.warning {
    background: linear-gradient(90deg, #e6a23c 0%, #b88222 100%);
    color: white;
  }
  
  &.success {
    background: linear-gradient(90deg, #67c23a 0%, #529b2e 100%);
    color: white;
  }
  
  .status-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .status-icon {
    font-size: 18px;
  }
  
  .status-text {
    font-weight: 500;
  }
  
  .status-progress {
    flex: 1;
    max-width: 200px;
  }
  
  .reconnect-btn {
    color: inherit;
    opacity: 0.9;
    
    &:hover {
      opacity: 1;
    }
  }
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>