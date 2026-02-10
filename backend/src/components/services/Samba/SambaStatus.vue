<template>
  <div class="samba-status">
    <!-- Status Cards -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:server-network" />
          </div>
          <div class="header-text">
            <h2>{{ $t('samba.status.title') }}</h2>
            <p class="subtitle">{{ $t('samba.status.subtitle') }}</p>
          </div>
        </div>
        
        <div class="status-badge" :class="statusClass">
          <div class="status-indicator" :class="statusClass"></div>
          <span>{{ statusText }}</span>
        </div>
        
        <div class="header-actions compact">
          <el-button 
            type="primary" 
            @click="emit('status-changed')"
            size="small"
            plain
            class="refresh-btn"
          >
            <Icon icon="mdi:refresh" width="14" />
            {{ $t('common.refresh') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Status Details -->
    <el-card class="status-details-card" shadow="hover">
      <div class="status-details">
        <div class="detail-row">
          <span class="detail-label">{{ $t('samba.status.installed') }}</span>
          <span class="detail-value">
            <Icon 
              :icon="status.installed ? 'mdi:check-circle' : 'mdi:close-circle'" 
              width="14"
              :class="status.installed ? 'text-success' : 'text-danger'"
            />
            {{ status.installed ? $t('common.yes') : $t('common.no') }}
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">{{ $t('samba.status.running') }}</span>
          <span class="detail-value">
            <Icon 
              :icon="status.running ? 'mdi:check-circle' : 'mdi:close-circle'" 
              width="14"
              :class="status.running ? 'text-success' : 'text-danger'"
            />
            {{ status.running ? $t('common.yes') : $t('common.no') }}
          </span>
        </div>
        
        <div v-if="status.error" class="detail-row error">
          <span class="detail-label">{{ $t('samba.status.error') }}</span>
          <span class="detail-value text-danger">
            <Icon icon="mdi:alert-circle" width="14" />
            {{ status.error }}
          </span>
        </div>
      </div>
    </el-card>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <el-button 
        type="primary" 
        @click="emit('status-changed')"
        size="small"
        class="refresh-btn"
      >
        <Icon icon="mdi:refresh" width="14" />
        {{ $t('common.refresh') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const props = defineProps({
  status: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['status-changed']);

const statusClass = computed(() => {
  if (!props.status.installed) return 'error';
  if (props.status.running) return 'success';
  return 'warning';
});

const statusText = computed(() => {
  if (!props.status.installed) return t('samba.status.notInstalled');
  if (props.status.running) return t('samba.status.running');
  return t('samba.status.stopped');
});
</script>

<style scoped lang="scss">
.samba-status {
  --card-bg: var(--el-bg-color);
  --border-color: var(--el-border-color);
  --text-primary: var(--el-text-color-primary);
  --text-secondary: var(--el-text-color-secondary);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
}

/* Header */
.dashboard-header.compact {
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
}

.dashboard-header.compact .header-content {
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.header-icon.small {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: var(--radius-md);
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
  
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: var(--spacing-xs) 0 0;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 500;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &.success {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  &.warning {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
  
  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  &.success {
    background: #22c55e;
  }
  
  &.warning {
    background: #f59e0b;
  }
  
  &.error {
    background: #ef4444;
  }
}

.header-actions.compact {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.refresh-btn {
  .iconify {
    transition: transform 0.3s ease;
  }
  
  &:hover .iconify {
    transform: rotate(180deg);
  }
}

/* Status Details */
.status-details-card {
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
  
  :deep(.el-card__body) {
    padding: 0;
  }
}

.status-details {
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    
    &:last-child {
      border-bottom: none;
    }
    
    &.error {
      background: rgba(239, 68, 68, 0.05);
    }
  }
}

.detail-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-success {
  color: #22c55e;
}

.text-danger {
  color: #ef4444;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
  }
  
  .status-badge {
    align-self: flex-start;
  }
  
  .header-actions.compact {
    width: 100%;
    justify-content: center;
  }
}
</style>
