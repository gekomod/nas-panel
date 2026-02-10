<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="Cron Expression Helper"
    width="600px"
    class="cron-helper-dialog"
  >
    <div class="cron-helper-content">
      <div class="cron-presets">
        <h4>Common Presets</h4>
        <div class="presets-grid">
          <div 
            v-for="preset in presets" 
            :key="preset.expression"
            class="preset-item"
            @click="selectPreset(preset)"
          >
            <div class="preset-expression">{{ preset.expression }}</div>
            <div class="preset-description">{{ preset.description }}</div>
          </div>
        </div>
      </div>
      
      <el-divider />
      
      <div class="cron-builder">
        <h4>Custom Builder</h4>
        <div class="builder-section">
          <div class="builder-row">
            <span class="builder-label">Minute</span>
            <el-input v-model="customCron.minute" placeholder="*" />
            <span class="builder-example">0-59, *</span>
          </div>
          <div class="builder-row">
            <span class="builder-label">Hour</span>
            <el-input v-model="customCron.hour" placeholder="*" />
            <span class="builder-example">0-23, *</span>
          </div>
          <div class="builder-row">
            <span class="builder-label">Day of Month</span>
            <el-input v-model="customCron.dayOfMonth" placeholder="*" />
            <span class="builder-example">1-31, *</span>
          </div>
          <div class="builder-row">
            <span class="builder-label">Month</span>
            <el-input v-model="customCron.month" placeholder="*" />
            <span class="builder-example">1-12, *</span>
          </div>
          <div class="builder-row">
            <span class="builder-label">Day of Week</span>
            <el-input v-model="customCron.dayOfWeek" placeholder="*" />
            <span class="builder-example">0-6 (0=Sunday), *</span>
          </div>
        </div>
        
        <div class="cron-preview">
          <div class="preview-label">Cron Expression:</div>
          <div class="preview-expression">{{ builtCron }}</div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="applyExpression">Apply</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'apply'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const presets = ref([
  { expression: '0 2 * * *', description: 'Daily at 2:00 AM' },
  { expression: '0 0 * * 0', description: 'Weekly on Sunday at midnight' },
  { expression: '0 0 1 * *', description: 'Monthly on the 1st at midnight' },
  { expression: '*/30 * * * *', description: 'Every 30 minutes' },
  { expression: '0 */6 * * *', description: 'Every 6 hours' },
  { expression: '0 9-17 * * 1-5', description: 'Every hour from 9 AM to 5 PM on weekdays' }
])

const customCron = ref({
  minute: '*',
  hour: '*',
  dayOfMonth: '*',
  month: '*',
  dayOfWeek: '*'
})

const builtCron = computed(() => {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = customCron.value
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
})

const selectPreset = (preset) => {
  const parts = preset.expression.split(' ')
  customCron.value = {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4]
  }
}

const applyExpression = () => {
  emit('apply', builtCron.value)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.cron-helper-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.cron-helper-content {
  padding: 20px;
}

.cron-presets {
  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.preset-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    transform: translateY(-2px);
  }
  
  .preset-expression {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-color-primary);
    margin-bottom: 4px;
  }
  
  .preset-description {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.cron-builder {
  h4 {
    margin: 16px 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.builder-section {
  .builder-row {
    display: grid;
    grid-template-columns: 120px 1fr 100px;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .builder-label {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
  
  .builder-example {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }
}

.cron-preview {
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  
  .preview-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }
  
  .preview-expression {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-color-primary);
    padding: 8px 12px;
    background: var(--el-bg-color-page);
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
