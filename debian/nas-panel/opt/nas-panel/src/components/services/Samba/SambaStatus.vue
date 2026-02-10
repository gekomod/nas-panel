<template>
  <div class="samba-status">
    <div class="status-header">
      <h3>
        <Icon icon="mdi:server-network" width="20" class="header-icon" />
        <span>{{ $t('samba.status.title') }}</span>
      </h3>
    </div>

    <!-- Karty statusu -->
    <div class="status-cards">
      <div class="status-card" :class="getStatusCardClass()">
        <div class="card-icon">
          <Icon :icon="getStatusIcon()" width="32" />
        </div>
        <div class="card-content">
          <div class="card-title">{{ getStatusTitle() }}</div>
          <div class="card-subtitle">{{ getStatusSubtitle() }}</div>
        </div>
        <el-tag :type="getStatusTagType()" size="small" class="status-tag" effect="dark">
          {{ getStatusText() }}
        </el-tag>
      </div>

      <!-- Szczegóły statusu -->
      <div class="status-details">
        <div class="detail-row">
          <span class="detail-label">{{ $t('samba.status.installed') }}</span>
          <span class="detail-value">
            <Icon 
              :icon="status.installed ? 'mdi:check-circle' : 'mdi:close-circle'" 
              width="16"
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
              width="16"
              :class="status.running ? 'text-success' : 'text-danger'"
            />
            {{ status.running ? $t('common.yes') : $t('common.no') }}
          </span>
        </div>
        
        <div v-if="status.error" class="detail-row">
          <span class="detail-label">{{ $t('samba.status.error') }}</span>
          <span class="detail-value text-danger">
            <Icon icon="mdi:alert-circle" width="16" />
            {{ status.error }}
          </span>
        </div>
        
        <div v-if="status.version" class="detail-row">
          <span class="detail-label">{{ $t('samba.status.version') }}</span>
          <span class="detail-value">
            <Icon icon="mdi:tag" width="16" />
            {{ status.version }}
          </span>
        </div>
        
        <div v-if="status.lastCheck" class="detail-row">
          <span class="detail-label">{{ $t('samba.status.lastCheck') }}</span>
          <span class="detail-value">
            <Icon icon="mdi:clock-outline" width="16" />
            {{ formatDate(status.lastCheck) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Przyciski akcji -->
    <div class="status-actions">
      <el-button 
        type="primary" 
        @click="emit('status-changed')"
        size="small"
        class="refresh-btn"
        plain
      >
        <Icon icon="mdi:refresh" width="16" />
        {{ $t('samba.status.refresh') }}
      </el-button>
      
      <div class="status-info">
        <Icon icon="mdi:information" width="16" />
        <span>{{ $t('samba.status.autoRefresh') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
  status: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['status-changed']);

function getStatusCardClass() {
  if (!props.status.installed) return 'status-error';
  if (props.status.running) return 'status-success';
  return 'status-warning';
}

function getStatusIcon() {
  if (!props.status.installed) return 'mdi:server-off';
  if (props.status.running) return 'mdi:server-network';
  return 'mdi:server-network-off';
}

function getStatusTitle() {
  if (!props.status.installed) return 'Samba nie zainstalowana';
  if (props.status.running) return 'Samba działa';
  return 'Samba zatrzymana';
}

function getStatusSubtitle() {
  if (!props.status.installed) return 'Zainstaluj usługę aby rozpocząć';
  if (props.status.running) return 'Usługa działa poprawnie';
  return 'Uruchom usługę aby aktywować udostępnienia';
}

function getStatusTagType() {
  if (!props.status.installed) return 'danger';
  return props.status.running ? 'success' : 'warning';
}

function getStatusText() {
  if (!props.status.installed) return 'Nie zainstalowano';
  if (props.status.error) return 'Błąd';
  return props.status.running ? 'Działa' : 'Zatrzymana';
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}
</script>

<style scoped lang="scss">
.samba-status {
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --radius: 8px;
  --card-bg: var(--el-bg-color);
  --border-color: var(--el-border-color);
  --text-primary: var(--el-text-color-primary);
  --text-secondary: var(--el-text-color-secondary);
}

.status-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  
  h3 {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.header-icon {
  color: var(--el-color-primary);
}

.status-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.status-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }
  
  &.status-success::before {
    background-color: var(--el-color-success);
  }
  
  &.status-warning::before {
    background-color: var(--el-color-warning);
  }
  
  &.status-error::before {
    background-color: var(--el-color-danger);
  }
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  flex-shrink: 0;
  
  .status-success & {
    background: linear-gradient(135deg, rgba(var(--el-color-success-rgb), 0.1), rgba(var(--el-color-success-rgb), 0.05));
    color: var(--el-color-success);
  }
  
  .status-warning & {
    background: linear-gradient(135deg, rgba(var(--el-color-warning-rgb), 0.1), rgba(var(--el-color-warning-rgb), 0.05));
    color: var(--el-color-warning);
  }
  
  .status-error & {
    background: linear-gradient(135deg, rgba(var(--el-color-danger-rgb), 0.1), rgba(var(--el-color-danger-rgb), 0.05));
    color: var(--el-color-danger);
  }
}

.card-content {
  flex: 1;
}

.card-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-size: 1rem;
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.status-tag {
  font-weight: 500;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.status-details {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  
  &:last-child {
    border-bottom: none;
  }
}

.detail-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-success {
  color: var(--el-color-success);
}

.text-danger {
  color: var(--el-color-danger);
}

.status-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-color);
}

.refresh-btn {
  font-weight: 500;
  
  .iconify {
    transition: transform 0.3s ease;
  }
  
  &:hover .iconify {
    transform: rotate(180deg);
  }
}

.status-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
</style>
