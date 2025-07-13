<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Properties</h3>
        <button class="close-btn" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="modal-body">
        <div class="property-section">
          <h4>General</h4>
          <div class="property-row">
            <span class="property-label">Name:</span>
            <span class="property-value">{{ item.name }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Type:</span>
            <span class="property-value">{{ item.type === 'directory' ? 'Folder' : 'File' }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Location:</span>
            <span class="property-value">{{ path.dirname(item.path) || '/' }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Size:</span>
            <span class="property-value">{{ formatSize(item.size) }}</span>
          </div>
        </div>
        
        <div class="property-section">
          <h4>Dates</h4>
          <div class="property-row">
            <span class="property-label">Created:</span>
            <span class="property-value">{{ formatDate(item.created) }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Modified:</span>
            <span class="property-value">{{ formatDate(item.modified) }}</span>
          </div>
        </div>
        
        <div class="property-section" v-if="item.permissions">
          <h4>Permissions</h4>
          <div class="property-row">
            <span class="property-label">Mode:</span>
            <span class="property-value">{{ item.permissions.mode }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Owner:</span>
            <span class="property-value">{{ item.owner }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Group:</span>
            <span class="property-value">{{ item.group }}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn primary" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import path from 'path-browserify';

export default {
  components: { Icon },
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  emits: ['close'],
  setup(props) {
    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    return { path, formatSize, formatDate };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: var(--bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color);
  padding: 4px;
}

.modal-body {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn.primary {
  background-color: var(--primary-color);
  color: white;
  border: none;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.secondary {
  background-color: var(--secondary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.property-section {
  margin-bottom: 16px;
}

.property-section h4 {
  margin: 0 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}

.property-row {
  display: flex;
  margin-bottom: 8px;
}

.property-label {
  font-weight: 500;
  width: 100px;
  flex-shrink: 0;
}

.property-value {
  flex: 1;
}
</style>
