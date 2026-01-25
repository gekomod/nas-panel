<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('systemUpdates.automaticUpdates')"
    width="50%"
    :close-on-click-modal="false"
    class="automatic-updates-dialog"
  >
    <div class="settings-content">
      <!-- Switch główny -->
      <div class="main-switch">
        <el-switch
          v-model="settings.enabled"
          size="large"
          inline-prompt
          :active-text="t('common.enabled')"
          :inactive-text="t('common.disabled')"
          style="--el-switch-on-color: var(--el-color-success)"
        />
        <div class="switch-description">
          <h4>{{ t('systemUpdates.automaticUpdates') }}</h4>
          <p>{{ t('systemUpdates.automaticUpdatesDescription') }}</p>
        </div>
      </div>
      
      <!-- Opcje tylko jeśli włączone -->
      <div v-if="settings.enabled" class="settings-options">
        <el-divider />
        
        <!-- Harmonogram -->
        <div class="setting-section">
          <h4>{{ t('systemUpdates.schedule') }}</h4>
          <p class="section-description">
            {{ t('systemUpdates.scheduleDescription') }}
          </p>
          
          <div class="schedule-options">
            <el-radio-group v-model="settings.scheduleType" class="schedule-type">
              <el-radio-button value="daily">
                {{ t('systemUpdates.daily') }}
              </el-radio-button>
              <el-radio-button value="weekly">
                {{ t('systemUpdates.weekly') }}
              </el-radio-button>
              <el-radio-button value="custom">
                {{ t('systemUpdates.custom') }}
              </el-radio-button>
            </el-radio-group>
            
            <div v-if="settings.scheduleType === 'custom'" class="custom-schedule">
              <el-input
                v-model="settings.customSchedule"
                placeholder="0 2 * * *"
                class="cron-input"
              >
                <template #prepend>
                  <Icon icon="mdi:clock-outline" width="16" />
                </template>
                <template #append>
                  <el-button @click="showCronHelper">
                    {{ t('systemUpdates.cronHelper') }}
                  </el-button>
                </template>
              </el-input>
              <div class="cron-hint">
                <Icon icon="mdi:information-outline" width="14" />
                <span>{{ t('systemUpdates.cronFormatHint') }}</span>
              </div>
            </div>
            
            <div v-else class="time-selection">
              <el-time-select
                v-model="settings.time"
                :placeholder="t('systemUpdates.selectTime')"
                :start="'00:00'"
                :step="'00:30'"
                :end="'23:30'"
                class="time-selector"
              />
              <div v-if="settings.scheduleType === 'weekly'" class="day-selection">
                <el-select
                  v-model="settings.dayOfWeek"
                  :placeholder="t('systemUpdates.selectDay')"
                  class="day-selector"
                >
                  <el-option
                    v-for="day in daysOfWeek"
                    :key="day.value"
                    :label="day.label"
                    :value="day.value"
                  />
                </el-select>
              </div>
            </div>
            
            <div class="next-run">
              <Icon icon="mdi:calendar-clock" width="16" />
              <span class="label">{{ t('systemUpdates.nextRun') }}:</span>
              <span class="value">{{ nextRunText }}</span>
            </div>
          </div>
        </div>
        
        <el-divider />
        
        <!-- Typ aktualizacji -->
        <div class="setting-section">
          <h4>{{ t('systemUpdates.updateType') }}</h4>
          <p class="section-description">
            {{ t('systemUpdates.updateTypeDescription') }}
          </p>
          
          <div class="update-type-options">
            <el-radio-group v-model="settings.updateType">
              <el-radio value="security" border>
                <div class="radio-option">
                  <Icon icon="mdi:shield-check" width="20" class="option-icon security" />
                  <div class="option-content">
                    <strong>{{ t('systemUpdates.securityOnly') }}</strong>
                    <p>{{ t('systemUpdates.securityOnlyDescription') }}</p>
                  </div>
                </div>
              </el-radio>
              
              <el-radio value="all" border>
                <div class="radio-option">
                  <Icon icon="mdi:package-variant" width="20" class="option-icon all" />
                  <div class="option-content">
                    <strong>{{ t('systemUpdates.allUpdates') }}</strong>
                    <p>{{ t('systemUpdates.allUpdatesDescription') }}</p>
                  </div>
                </div>
              </el-radio>
            </el-radio-group>
          </div>
          
          <div class="additional-options">
            <el-checkbox v-model="settings.autoInstall">
              {{ t('systemUpdates.autoInstallUpdates') }}
            </el-checkbox>
            <div class="checkbox-hint">
              {{ t('systemUpdates.autoInstallHint') }}
            </div>
          </div>
        </div>
        
        <el-divider />
        
        <!-- Powiadomienia -->
        <div class="setting-section">
          <h4>{{ t('systemUpdates.notifications') }}</h4>
          <p class="section-description">
            {{ t('systemUpdates.notificationsDescription') }}
          </p>
          
          <div class="notification-options">
            <el-checkbox-group v-model="settings.notificationMethods">
              <el-checkbox value="email">
                <div class="notification-option">
                  <Icon icon="mdi:email" width="16" />
                  <span>{{ t('systemUpdates.email') }}</span>
                </div>
              </el-checkbox>
              <el-checkbox value="system">
                <div class="notification-option">
                  <Icon icon="mdi:bell-outline" width="16" />
                  <span>{{ t('systemUpdates.systemNotification') }}</span>
                </div>
              </el-checkbox>
              <el-checkbox value="webhook">
                <div class="notification-option">
                  <Icon icon="mdi:webhook" width="16" />
                  <span>{{ t('systemUpdates.webhook') }}</span>
                </div>
              </el-checkbox>
            </el-checkbox-group>
            
            <div v-if="settings.notificationMethods.includes('email')" class="email-settings">
              <el-input
                v-model="settings.emailAddress"
                :placeholder="t('systemUpdates.emailPlaceholder')"
                class="email-input"
              >
                <template #prepend>
                  <Icon icon="mdi:at" width="16" />
                </template>
              </el-input>
            </div>
            
            <div v-if="settings.notificationMethods.includes('webhook')" class="webhook-settings">
              <el-input
                v-model="settings.webhookUrl"
                :placeholder="t('systemUpdates.webhookPlaceholder')"
                class="webhook-input"
              >
                <template #prepend>
                  <Icon icon="mdi:link" width="16" />
                </template>
              </el-input>
            </div>
          </div>
        </div>
        
        <el-divider />
        
        <!-- Zaawansowane opcje -->
        <div class="setting-section">
          <el-collapse v-model="activeAdvancedOptions">
            <el-collapse-item name="advanced">
              <template #title>
                <h4>{{ t('systemUpdates.advancedOptions') }}</h4>
              </template>
              
              <div class="advanced-options">
                <div class="advanced-option">
                  <el-checkbox v-model="settings.rebootAfterUpdate">
                    {{ t('systemUpdates.rebootAfterUpdate') }}
                  </el-checkbox>
                  <div class="option-hint">
                    {{ t('systemUpdates.rebootAfterUpdateHint') }}
                  </div>
                </div>
                
                <div class="advanced-option">
                  <el-checkbox v-model="settings.cleanAfterUpdate">
                    {{ t('systemUpdates.cleanAfterUpdate') }}
                  </el-checkbox>
                  <div class="option-hint">
                    {{ t('systemUpdates.cleanAfterUpdateHint') }}
                  </div>
                </div>
                
                <div class="advanced-option">
                  <el-checkbox v-model="settings.skipKernelUpdates">
                    {{ t('systemUpdates.skipKernelUpdates') }}
                  </el-checkbox>
                  <div class="option-hint">
                    {{ t('systemUpdates.skipKernelUpdatesHint') }}
                  </div>
                </div>
                
                <div class="advanced-option">
                  <div class="option-label">
                    <span>{{ t('systemUpdates.maxConcurrentDownloads') }}</span>
                    <el-tooltip :content="t('systemDownloads.concurrentDownloadsHint')" placement="top">
                      <Icon icon="mdi:information-outline" width="14" />
                    </el-tooltip>
                  </div>
                  <el-slider
                    v-model="settings.concurrentDownloads"
                    :min="1"
                    :max="10"
                    :step="1"
                    show-stops
                    show-input
                    class="concurrent-slider"
                  />
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
      
      <!-- Podgląd harmonogramu -->
      <div v-if="settings.enabled" class="schedule-preview">
        <div class="preview-header">
          <Icon icon="mdi:calendar-text" width="20" />
          <h4>{{ t('systemUpdates.schedulePreview') }}</h4>
        </div>
        <div class="preview-content">
          <pre class="cron-preview">{{ cronExpression }}</pre>
          <div class="preview-description">
            {{ scheduleDescription }}
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="saveSettings"
          :loading="saving"
        >
          {{ t('common.save') }}
        </el-button>
      </div>
    </template>
    
    <!-- Cron Helper Dialog -->
    <CronHelperDialog 
      v-model="cronHelperVisible"
      @apply="applyCronExpression"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import CronHelperDialog from './CronHelperDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const { t } = useI18n()

// Reactive state
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const saving = ref(false)
const cronHelperVisible = ref(false)
const activeAdvancedOptions = ref([])

// Dni tygodnia
const daysOfWeek = [
  { value: '0', label: t('systemUpdates.sunday') },
  { value: '1', label: t('systemUpdates.monday') },
  { value: '2', label: t('systemUpdates.tuesday') },
  { value: '3', label: t('systemUpdates.wednesday') },
  { value: '4', label: t('systemUpdates.thursday') },
  { value: '5', label: t('systemUpdates.friday') },
  { value: '6', label: t('systemUpdates.saturday') }
]

// Computed properties
const cronExpression = computed(() => {
  if (!props.settings.enabled) return ''
  
  if (props.settings.scheduleType === 'custom') {
    return props.settings.customSchedule
  }
  
  const [hour, minute] = props.settings.time.split(':')
  
  if (props.settings.scheduleType === 'daily') {
    return `${minute} ${hour} * * *`
  } else if (props.settings.scheduleType === 'weekly') {
    return `${minute} ${hour} * * ${props.settings.dayOfWeek}`
  }
  
  return ''
})

const scheduleDescription = computed(() => {
  if (!props.settings.enabled) return t('systemUpdates.scheduleDisabled')
  
  if (props.settings.scheduleType === 'daily') {
    return t('systemUpdates.dailyAt', { time: props.settings.time })
  } else if (props.settings.scheduleType === 'weekly') {
    const day = daysOfWeek.find(d => d.value === props.settings.dayOfWeek)?.label
    return t('systemUpdates.weeklyAt', { day, time: props.settings.time })
  } else if (props.settings.scheduleType === 'custom') {
    return t('systemUpdates.customSchedule')
  }
  
  return ''
})

const nextRunText = computed(() => {
  // Tutaj można dodać logikę obliczania następnego uruchomienia
  // Na razie zwracamy przykładowy tekst
  return t('systemUpdates.nextRunCalculated')
})

// Methods
const saveSettings = async () => {
  saving.value = true
  
  try {
    // Walidacja
    if (props.settings.enabled && props.settings.scheduleType === 'custom') {
      if (!isValidCronExpression(props.settings.customSchedule)) {
        throw new Error(t('systemUpdates.invalidCronExpression'))
      }
    }
    
    // Emituj zdarzenie do rodzica
    emit('save', props.settings)
    
    ElMessage.success(t('systemUpdates.settingsSaved'))
    emit('update:modelValue', false)
    dialogVisible.value = false
    
  } catch (error) {
    ElMessage.error(error.message || t('systemUpdates.saveFailed'))
  } finally {
    saving.value = false
  }
}

const showCronHelper = () => {
  cronHelperVisible.value = true
}

const applyCronExpression = (expression) => {
  props.settings.customSchedule = expression
}

const isValidCronExpression = (expression) => {
  // Prosta walidacja wyrażenia cron
  const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/
  return cronRegex.test(expression)
}

// Initialize default values if not set
watch(() => props.settings, (newSettings) => {
  // Ustaw domyślne wartości jeśli brakuje
  const defaults = {
    enabled: false,
    scheduleType: 'daily',
    customSchedule: '0 2 * * *',
    time: '02:00',
    dayOfWeek: '0',
    updateType: 'security',
    autoInstall: false,
    notificationMethods: ['system'],
    emailAddress: '',
    webhookUrl: '',
    rebootAfterUpdate: false,
    cleanAfterUpdate: true,
    skipKernelUpdates: false,
    concurrentDownloads: 3
  }
  
  Object.keys(defaults).forEach(key => {
    if (newSettings[key] === undefined) {
      newSettings[key] = defaults[key]
    }
  })
}, { deep: true, immediate: true })
</script>

<style scoped>
.automatic-updates-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
  }
  
  :deep(.el-dialog__header) {
    padding: 20px 24px;
    border-bottom: 1px solid var(--el-border-color-light);
    margin: 0;
    
    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
    }
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
  }
  
  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid var(--el-border-color-light);
  }
}

.settings-content {
  padding: 24px;
}

.main-switch {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-color-primary-light-9);
  border-radius: 12px;
  margin-bottom: 24px;
  
  .switch-description {
    h4 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    p {
      margin: 0;
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
    }
  }
}

.settings-options {
  .setting-section {
    margin-bottom: 24px;
    
    h4 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    .section-description {
      margin: 0 0 16px;
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
    }
  }
}

.schedule-options {
  .schedule-type {
    margin-bottom: 16px;
    width: 100%;
    
    :deep(.el-radio-button) {
      flex: 1;
      
      .el-radio-button__inner {
        width: 100%;
        text-align: center;
      }
    }
  }
  
  .custom-schedule {
    .cron-input {
      margin-bottom: 8px;
    }
    
    .cron-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }
  }
  
  .time-selection {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
    
    .day-selection {
      flex: 1;
    }
  }
  
  .next-run {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    
    .label {
      font-weight: 500;
      color: var(--el-text-color-secondary);
    }
    
    .value {
      font-weight: 600;
      color: var(--el-color-primary);
    }
  }
}

.update-type-options {
  :deep(.el-radio) {
    display: block;
    margin-bottom: 12px;
    width: 100%;
    
    .el-radio__input {
      display: none;
    }
    
    .el-radio__label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      width: 100%;
      border-radius: 8px;
      border: 2px solid var(--el-border-color-light);
      transition: all 0.3s ease;
      
      &:hover {
        border-color: var(--el-color-primary-light-5);
      }
    }
    
    &.is-checked .el-radio__label {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }
  }
  
  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    
    .option-icon {
      flex-shrink: 0;
      margin-top: 2px;
      
      &.security {
        color: var(--el-color-danger);
      }
      
      &.all {
        color: var(--el-color-primary);
      }
    }
    
    .option-content {
      strong {
        display: block;
        margin-bottom: 4px;
        font-size: 14px;
        color: var(--el-text-color-primary);
      }
      
      p {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
        line-height: 1.4;
      }
    }
  }
}

.additional-options {
  margin-top: 16px;
  
  .checkbox-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
    margin-left: 28px;
  }
}

.notification-options {
  .notification-option {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .email-settings,
  .webhook-settings {
    margin-top: 16px;
    margin-left: 28px;
    
    .email-input,
    .webhook-input {
      max-width: 400px;
    }
  }
}

.advanced-options {
  .advanced-option {
    margin-bottom: 20px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .option-label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }
    
    .option-hint {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
      margin-left: 28px;
    }
    
    .concurrent-slider {
      margin-top: 12px;
      max-width: 400px;
    }
  }
}

.schedule-preview {
  margin-top: 24px;
  padding: 20px;
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
  
  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    
    h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
  
  .preview-content {
    .cron-preview {
      margin: 0 0 12px;
      padding: 12px 16px;
      background: var(--el-bg-color-page);
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      color: var(--el-color-primary);
      border: 1px solid var(--el-border-color-lighter);
      overflow-x: auto;
    }
    
    .preview-description {
      font-size: 14px;
      color: var(--el-text-color-regular);
      line-height: 1.4;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 90% !important;
    margin-top: 5vh !important;
  }
  
  .main-switch {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .schedule-type {
    flex-direction: column;
  }
  
  .time-selection {
    flex-direction: column;
  }
}
</style>
