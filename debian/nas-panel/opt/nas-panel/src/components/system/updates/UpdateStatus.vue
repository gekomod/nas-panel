<template>
  <div class="update-status">
    <div v-if="status.progress > 0" class="status-container">
      <el-progress 
        :percentage="status.progress" 
        :status="status.status"
        :text-inside="true"
        :stroke-width="20"
        :indeterminate="status.indeterminate"
      />
      <div class="status-meta">
        <span class="status-message">
          <el-icon :class="statusIcon">
            <component :is="statusIconComponent" />
          </el-icon>
          {{ status.message }}
        </span>
        <span class="status-time">{{ status.time }}</span>
      </div>
    </div>
    <div v-else class="status-pending">
      <el-icon><Clock /></el-icon>
      {{ status.message }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Clock, CircleCheck, Warning, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  status: {
    type: Object,
    required: true,
    default: () => ({
      progress: 0,
      status: '',
      message: '',
      time: '',
      indeterminate: false
    })
  }
})

const statusIcon = computed(() => {
  return {
    'success': 'status-icon success',
    'exception': 'status-icon error',
    '': 'status-icon pending'
  }[props.status.status]
})

const statusIconComponent = computed(() => {
  return {
    'success': CircleCheck,
    'exception': Warning,
    '': Loading
  }[props.status.status]
})
</script>

<style scoped>
.update-status {
  width: 100%;
}

.status-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.status-message {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-icon {
  font-size: 14px;
}

.status-icon.success {
  color: var(--el-color-success);
}

.status-icon.error {
  color: var(--el-color-error);
}

.status-icon.pending {
  color: var(--el-color-warning);
  animation: spin 1s linear infinite;
}

.status-pending {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
}

.status-time {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
