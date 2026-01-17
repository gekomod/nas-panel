<template>
  <div class="samba-status">
    <div class="status-header">
      <h3>
        <Icon icon="mdi:server-network" width="20" />
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
        <el-tag :type="getStatusTagType()" size="small" class="status-tag">
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
            {{ status.error }}
          </span>
        </div>
        
        <div v-if="status.version" class="detail-row">
          <span class="detail-label">{{ $t('samba.status.version') }}</span>
          <span class="detail-value">
            {{ status.version }}
          </span>
        </div>
        
        <div v-if="status.lastCheck" class="detail-row">
          <span class="detail-label">{{ $t('samba.status.lastCheck') }}</span>
          <span class="detail-value">
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
}

.status-header {
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.status-header h3 {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
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
  
  &.status-success {
    border-left: 4px solid #10b981;
  }
  
  &.status-warning {
    border-left: 4px solid #f59e0b;
  }
  
  &.status-error {
    border-left: 4px solid #ef4444;
  }
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.05));
  
  .status-success & {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
  }
  
  .status-warning & {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
  }
  
  .status-error & {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
  }
}

.card-content {
  flex: 1;
}

.card-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.status-tag {
  font-weight: 500;
  letter-spacing: 0.3px;
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
  color: #10b981;
}

.text-danger {
  color: #ef4444;
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
