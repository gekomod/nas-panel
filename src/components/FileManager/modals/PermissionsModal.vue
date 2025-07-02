<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Set Permissions</h3>
        <button class="close-btn" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="modal-body">
        <div class="permissions-grid">
          <div class="permission-header"></div>
          <div class="permission-header">Read</div>
          <div class="permission-header">Write</div>
          <div class="permission-header">Execute</div>
          
          <div class="permission-label">Owner</div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.owner.read" 
              id="owner-read"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.owner.write" 
              id="owner-write"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.owner.execute" 
              id="owner-execute"
            >
          </div>
          
          <div class="permission-label">Group</div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.group.read" 
              id="group-read"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.group.write" 
              id="group-write"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.group.execute" 
              id="group-execute"
            >
          </div>
          
          <div class="permission-label">Others</div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.others.read" 
              id="others-read"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.others.write" 
              id="others-write"
            >
          </div>
          <div class="permission-cell">
            <input 
              type="checkbox" 
              v-model="permissions.others.execute" 
              id="others-execute"
            >
          </div>
        </div>
        
        <div class="numeric-permission">
          <label>Numeric value:</label>
          <input 
            type="text" 
            v-model="numericPermission" 
            readonly
            class="numeric-input"
          >
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" @click="$emit('close')">Cancel</button>
        <button class="btn primary" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';

export default {
  components: { Icon },
  props: {
    items: {
      type: Array,
      required: true
    }
  },
  emits: ['close', 'save'],
  setup(props, { emit }) {
    const permissions = ref({
      owner: { read: true, write: true, execute: false },
      group: { read: true, write: false, execute: false },
      others: { read: true, write: false, execute: false }
    });

    // Oblicz wartość liczbową uprawnień
    const numericPermission = computed(() => {
      const owner = (permissions.value.owner.read ? 4 : 0) + 
                    (permissions.value.owner.write ? 2 : 0) + 
                    (permissions.value.owner.execute ? 1 : 0);
      
      const group = (permissions.value.group.read ? 4 : 0) + 
                    (permissions.value.group.write ? 2 : 0) + 
                    (permissions.value.group.execute ? 1 : 0);
      
      const others = (permissions.value.others.read ? 4 : 0) + 
                     (permissions.value.others.write ? 2 : 0) + 
                     (permissions.value.others.execute ? 1 : 0);
      
      return `${owner}${group}${others}`;
    });

    const save = () => {
      emit('save', {
        mode: parseInt(numericPermission.value, 8),
        owner: permissions.value.owner,
        group: permissions.value.group,
        others: permissions.value.others
      });
    };

    return { permissions, numericPermission, save };
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

.permissions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.permission-header {
  font-weight: 500;
  text-align: center;
  padding: 8px;
}

.permission-label {
  display: flex;
  align-items: center;
  padding: 8px;
}

.permission-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.numeric-permission {
  display: flex;
  align-items: center;
  gap: 8px;
}

.numeric-input {
  width: 50px;
  text-align: center;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-color);
  color: var(--text-color);
}
</style>
