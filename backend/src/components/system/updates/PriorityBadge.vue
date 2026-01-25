<template>
  <div class="priority-badge" :class="priorityClass">
    <div class="badge-content">
      <Icon :icon="priorityIcon" width="12" height="12" class="badge-icon" />
      <span class="badge-text">{{ priorityLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  priority: {
    type: String,
    required: true,
    validator: (value) => ['critical', 'high', 'medium', 'low', 'unknown'].includes(value)
  }
})

// Computed properties
const priorityLabel = computed(() => {
  const labels = {
    critical: t('systemUpdates.priorityCritical'),
    high: t('systemUpdates.priorityHigh'),
    medium: t('systemUpdates.priorityMedium'),
    low: t('systemUpdates.priorityLow'),
    unknown: t('systemUpdates.priorityUnknown')
  }
  return labels[props.priority] || labels.unknown
})

const priorityIcon = computed(() => {
  const icons = {
    critical: 'mdi:alert-octagram',
    high: 'mdi:alert-circle',
    medium: 'mdi:information',
    low: 'mdi:check-circle',
    unknown: 'mdi:help-circle'
  }
  return icons[props.priority] || icons.unknown
})

const priorityClass = computed(() => `priority-${props.priority}`)

const priorityColor = computed(() => {
  const colors = {
    critical: 'var(--el-color-danger)',
    high: 'var(--el-color-warning)',
    medium: 'var(--el-color-info)',
    low: 'var(--el-color-success)',
    unknown: 'var(--el-text-color-secondary)'
  }
  return colors[props.priority] || colors.unknown
})
</script>

<style scoped>
.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--el-box-shadow-light);
  }
}

.badge-content {
  display: flex;
  align-items: center;
  gap: 5px;
}

.badge-icon {
  flex-shrink: 0;
}

.badge-text {
  white-space: nowrap;
}

/* Priority styles */
.priority-critical {
  background: linear-gradient(135deg, var(--el-color-danger-light-8), var(--el-color-danger-light-6));
  color: var(--el-color-danger);
  border: 1px solid var(--el-color-danger-light-5);
  
  .badge-icon {
    color: var(--el-color-danger);
    animation: pulse 2s infinite;
  }
}

.priority-high {
  background: linear-gradient(135deg, var(--el-color-warning-light-8), var(--el-color-warning-light-6));
  color: var(--el-color-warning-dark-2);
  border: 1px solid var(--el-color-warning-light-5);
  
  .badge-icon {
    color: var(--el-color-warning);
  }
}

.priority-medium {
  background: linear-gradient(135deg, var(--el-color-info-light-8), var(--el-color-info-light-6));
  color: var(--el-color-info-dark-2);
  border: 1px solid var(--el-color-info-light-5);
  
  .badge-icon {
    color: var(--el-color-info);
  }
}

.priority-low {
  background: linear-gradient(135deg, var(--el-color-success-light-8), var(--el-color-success-light-6));
  color: var(--el-color-success-dark-2);
  border: 1px solid var(--el-color-success-light-5);
  
  .badge-icon {
    color: var(--el-color-success);
  }
}

.priority-unknown {
  background: linear-gradient(135deg, var(--el-fill-color-light), var(--el-fill-color));
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  
  .badge-icon {
    color: var(--el-text-color-secondary);
  }
}

/* Animation for critical priority */
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

/* Size variations */
.priority-badge.small {
  padding: 2px 6px;
  font-size: 10px;
  
  .badge-icon {
    width: 10px;
    height: 10px;
  }
}

.priority-badge.large {
  padding: 6px 14px;
  font-size: 12px;
  
  .badge-icon {
    width: 14px;
    height: 14px;
  }
}
</style>
