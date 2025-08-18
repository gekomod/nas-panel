<template>
  <div class="samba-status">
    <div class="section-header">
      <h2>
        <el-icon><icon icon="mdi:server-network" /></el-icon>
        Status usługi
      </h2>
    </div>

    <el-descriptions :column="1" border class="status-descriptions">
      <el-descriptions-item label="Zainstalowana">
        <el-tag :type="status.installed ? 'success' : 'danger'">
          {{ status.installed ? 'Tak' : 'Nie' }}
        </el-tag>
      </el-descriptions-item>
      
      <el-descriptions-item label="Status">
        <el-tag :type="getStatusTagType(status)">
          {{ getStatusText(status) }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <div class="actions">
      <el-button type="primary" @click="emit('status-changed')">
        <el-icon><icon icon="mdi:refresh" /></el-icon>
        Odśwież status
      </el-button>
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

function getStatusTagType(status) {
  if (!status.installed) return 'danger';
  return status.running ? 'success' : 'warning';
}

function getStatusText(status) {
  if (!status.installed) return 'Nie zainstalowano';
  if (status.error) return 'Błąd: ' + status.error;
  return status.running ? 'Działa' : 'Zatrzymana';
}
</script>

<style scoped>
.samba-status {
  --description-bg: #ffffff;
  --description-border: #ebeef5;
  --description-title-bg: #f5f7fa;
}

.dark .samba-status {
  --description-bg: #1e1e1e;
  --description-border: #424242;
  --description-title-bg: #2d2d2d;
}

.samba-status {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-color);
}

.status-descriptions {
  margin-top: 10px;
  background: var(--description-bg);
  border-color: var(--description-border);
}

.status-descriptions :deep(.el-descriptions__title) {
  background: var(--description-title-bg);
}

.status-descriptions :deep(.el-descriptions__label) {
  color: var(--text-secondary);
}

.status-descriptions :deep(.el-descriptions__content) {
  color: var(--text-color);
}

.actions {
  margin-top: 20px;
}
</style>