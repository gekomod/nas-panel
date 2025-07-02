<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Rename {{ item.type === 'directory' ? 'Folder' : 'File' }}</h3>
        <button class="close-btn" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>New Name</label>
          <input 
            v-model="newName" 
            ref="nameInput"
            @keyup.enter="rename"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" @click="$emit('close')">Cancel</button>
        <button 
          class="btn primary" 
          @click="rename"
          :disabled="!isValid || newName === item.name"
        >
          Rename
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';

export default {
  components: { Icon },
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'rename'],
  setup(props, { emit }) {
    const newName = ref(props.item.name);
    const nameInput = ref(null);

    onMounted(() => {
      nameInput.value.focus();
      nameInput.value.select();
    });

    const isValid = computed(() => {
      return newName.value.trim() && !newName.value.includes('/');
    });

    const rename = () => {
      if (isValid.value && newName.value !== props.item.name) {
        emit('rename', newName.value.trim());
      }
    };

    return { newName, nameInput, isValid, rename };
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
</style>
