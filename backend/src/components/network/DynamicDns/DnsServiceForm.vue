<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal" :class="themeClass">
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
            <label class="form-label">
              <Icon icon="mdi:web" class="mr-1" />
              {{ $t('dynamicDns.provider') }}
            </label>
            <el-select 
              v-model="form.provider" 
              class="form-control" 
              @change="providerChanged"
              :placeholder="$t('dynamicDns.selectProvider')"
              size="large"
            >
              <el-option value="">-- {{ $t('dynamicDns.selectProvider') }} --</el-option>
              <el-option 
                v-for="provider in providers" 
                :value="provider.id" 
                :key="provider.id"
                :label="provider.name"
              >
                <div class="provider-option">
                  <Icon :icon="provider.icon" class="mr-2" />
                  <span>{{ provider.name }}</span>
                </div>
              </el-option>
            </el-select>
          </div>

          <template v-if="form.provider">
            <div v-for="field in currentProvider.fields" :key="field.name" class="form-group">
              <label class="form-label">
                {{ $t(field.label) }}
                <span v-if="field.required" class="required">*</span>
              </label>
              <el-input
                v-model="form[field.name]"
                :type="field.type"
                :required="field.required"
                class="form-control"
                :placeholder="$t(field.label)"
                :show-password="field.type === 'password'"
                size="large"
              />
              <div v-if="field.hint" class="field-hint">
                <Icon icon="mdi:information" size="14" />
                {{ $t(field.hint) }}
              </div>
            </div>
          </template>

          <div class="form-group">
            <el-switch
              v-model="form.enabled"
              :active-text="$t('dynamicDns.enabled')"
              :inactive-text="$t('dynamicDns.disabled')"
              size="large"
            />
          </div>

          <div class="modal-footer">
            <el-button type="default" @click="closeModal" :disabled="saving">
              <Icon icon="mdi:close" />
              {{ $t('dynamicDns.cancel') }}
            </el-button>
            <el-button type="primary" native-type="submit" :loading="saving" :disabled="saving">
              <Icon :icon="saving ? 'mdi:loading' : 'mdi:content-save'" />
              {{ saving ? $t('dynamicDns.saving') : $t('dynamicDns.save') }}
            </el-button>
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
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const { themeClass } = useTheme()

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
    if (!(field.name in form.value)) {
      form.value[field.name] = ''
    }
  })
}

function closeModal() {
  emit('update:show', false)
}

async function handleSubmit() {
  saving.value = true
  try {
    // Validate required fields
    const currentFields = currentProvider.value.fields || []
    const missingFields = currentFields
      .filter(field => field.required && !form.value[field.name])
      .map(field => t(field.label))
    
    if (missingFields.length > 0) {
      throw new Error(t('dynamicDns.missingFields', { fields: missingFields.join(', ') }))
    }
    
    emit('save', form.value)
    closeModal()
  } catch (error) {
    console.error('Form validation error:', error)
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
  backdrop-filter: blur(2px);
}

.modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal.dark {
  background: #334155;
  color: #e2e8f0;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.modal.dark .modal-header {
  border-bottom-color: #475569;
}

.modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal.dark .modal-footer {
  border-top-color: #475569;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
  color: #1e293b;
}

.modal.dark .form-label {
  color: #e2e8f0;
}

.required {
  color: #ef4444;
  margin-left: 4px;
}

.form-control {
  width: 100%;
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.modal.dark .field-hint {
  color: #94a3b8;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mr-1 {
  margin-right: 4px;
}

.mr-2 {
  margin-right: 8px;
}

@media (max-width: 768px) {
  .modal {
    margin: 20px;
    max-height: calc(100vh - 40px);
  }
  
  .modal-header {
    padding: 16px 20px;
  }
  
  .modal-body {
    padding: 20px;
  }
  
  .modal-footer {
    padding: 16px 20px;
    flex-direction: column;
  }
  
  .modal-footer .el-button {
    width: 100%;
  }
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

:deep(.el-switch) {
  --el-switch-on-color: #10b981;
  --el-switch-off-color: #64748b;
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

:deep(.el-icon.is-loading) {
  animation: spin 1s linear infinite;
}
</style>
