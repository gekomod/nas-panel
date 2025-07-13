<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <h3>
          <Icon :icon="editingService ? 'mdi:pencil' : 'mdi:plus'" width="20" height="20" />
          {{ editingService ? $t('dynamicDns.editService') : $t('dynamicDns.addService') }}
        </h3>
        <button class="btn-icon" @click="closeModal">
          <Icon icon="mdi:close" width="20" height="20" />
        </button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>{{ $t('dynamicDns.provider') }}</label>
            <select v-model="form.provider" class="form-control" @change="providerChanged">
              <option value="">-- {{ $t('dynamicDns.selectProvider') }} --</option>
              <option v-for="provider in providers" :value="provider.id" :key="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>

          <template v-if="form.provider">
            <div v-for="field in currentProvider.fields" :key="field.name" class="form-group">
              <label>{{ $t(field.label) }}</label>
              <input
                v-model="form[field.name]"
                :type="field.type"
                :required="field.required"
                class="form-control"
              >
            </div>
          </template>

          <div class="form-check">
            <input
              type="checkbox"
              v-model="form.enabled"
              id="enabled"
              class="form-check-input"
            >
            <label for="enabled" class="form-check-label">
              {{ $t('dynamicDns.enabled') }}
            </label>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('dynamicDns.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? $t('dynamicDns.saving') : $t('dynamicDns.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

const props = defineProps({
  show: Boolean,
  service: Object,
  providers: Array
})

const emit = defineEmits(['update:show', 'save'])

const form = ref({
  provider: '',
  enabled: true
})
const saving = ref(false)

const editingService = computed(() => !!props.service)

const currentProvider = computed(() => {
  return props.providers.find(p => p.id === form.value.provider) || { fields: [] }
})

watch(() => props.show, (val) => {
  if (val && props.service) {
    form.value = { ...props.service }
  } else if (val) {
    // Reset form
    form.value = {
      provider: '',
      enabled: true
    }
    // Clear all provider-specific fields
    props.providers.forEach(provider => {
      provider.fields.forEach(field => {
        form.value[field.name] = ''
      })
    })
  }
})

function providerChanged() {
  // Clear previous provider fields
  const currentFields = currentProvider.value.fields || []
  currentFields.forEach(field => {
    form.value[field.name] = ''
  })
}

function closeModal() {
  emit('update:show', false)
}

async function handleSubmit() {
  saving.value = true
  try {
    emit('save', form.value)
    closeModal()
  } finally {
    saving.value = false
  }
}
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
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #1976d2;
  color: white;
}

.btn-primary:hover {
  background-color: #1565c0;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #555;
}

.btn-icon:hover {
  background-color: #f5f5f5;
}

.form-group {
  margin-bottom: 15px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-check {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.form-check-input {
  margin-right: 8px;
}
</style>
