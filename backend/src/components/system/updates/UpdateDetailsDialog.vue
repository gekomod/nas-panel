<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('systemUpdates.updateDetails')"
    width="60%"
    :close-on-click-modal="false"
    class="update-details-dialog"
    @closed="handleDialogClosed"
  >
    <div v-if="update" class="details-content">
      <!-- Header z podstawowymi informacjami -->
      <div class="package-header">
        <div class="package-icon-title">
          <Icon :icon="getPackageIcon(update.name)" width="32" height="32" class="package-icon-large" />
          <div class="package-title">
            <h3>{{ update.name }}</h3>
            <div class="package-meta">
              <el-tag size="small" type="info">{{ update.section || 'unknown' }}</el-tag>
              <PriorityBadge :priority="getPriority(update)" />
            </div>
          </div>
        </div>
        
        <div class="version-info">
          <div class="version-row">
            <span class="version-label">{{ t('systemUpdates.currentVersion') }}</span>
            <el-tag size="large" effect="plain" class="version-tag">
              {{ update.current_version }}
            </el-tag>
          </div>
          <Icon icon="mdi:arrow-right-thick" width="24" class="version-arrow" />
          <div class="version-row">
            <span class="version-label">{{ t('systemUpdates.newVersion') }}</span>
            <el-tag size="large" type="success" effect="dark" class="version-tag">
              {{ update.new_version }}
            </el-tag>
          </div>
        </div>
      </div>
      
      <el-divider />
      
      <!-- Tabs z pełnymi szczegółami -->
      <el-tabs v-model="activeTab" class="details-tabs">
        <el-tab-pane :label="t('systemUpdates.description')" name="description">
          <div class="tab-content">
            <div class="description-full">
              <h4>{{ t('systemUpdates.packageDescription') }}</h4>
              <div class="description-text">
                <pre v-if="update.description">{{ update.description }}</pre>
                <p v-else class="no-description">
                  {{ t('systemUpdates.noDescriptionAvailable') }}
                </p>
              </div>
              
              <div v-if="update.maintainer" class="maintainer-info">
                <h4>{{ t('systemUpdates.maintainer') }}</h4>
                <div class="maintainer">
                  <Icon icon="mdi:account" width="16" />
                  <span>{{ update.maintainer }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane :label="t('systemUpdates.dependencies')" name="dependencies">
          <div class="tab-content">
            <div v-if="loadingDeps" class="loading-deps">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ t('systemUpdates.loadingDependencies') }}</span>
            </div>
            
            <div v-else-if="dependencies && dependencies.length > 0" class="dependencies-list">
              <h4>{{ t('systemUpdates.dependencyCount', { count: dependencies.length }) }}</h4>
              <div class="dependencies-grid">
                <div 
                  v-for="dep in dependencies" 
                  :key="dep"
                  class="dependency-item"
                >
                  <Icon icon="mdi:package-variant" width="14" />
                  <span class="dependency-name">{{ dep }}</span>
                </div>
              </div>
            </div>
            
            <div v-else class="no-dependencies">
              <Icon icon="mdi:check-circle-outline" width="48" class="no-deps-icon" />
              <h4>{{ t('systemUpdates.noDependencies') }}</h4>
              <p>{{ t('systemUpdates.thisPackageHasNoDependencies') }}</p>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane :label="t('systemUpdates.changelog')" name="changelog">
          <div class="tab-content">
            <div v-if="loadingChangelog" class="loading-changelog">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ t('systemUpdates.loadingChangelog') }}</span>
            </div>
            
            <div v-else-if="changelog" class="changelog-content">
              <div class="changelog-header">
                <h4>{{ t('systemUpdates.packageChangelog') }}</h4>
                <el-button 
                  size="small" 
                  @click="copyChangelog"
                  :disabled="!changelog"
                >
                  <template #icon>
                    <Icon icon="mdi:content-copy" width="14" />
                  </template>
                  {{ t('common.copy') }}
                </el-button>
              </div>
              <div class="changelog-text" ref="changelogRef">
                <pre v-html="changelog"></pre>
              </div>
            </div>
            
            <div v-else class="no-changelog">
              <Icon icon="mdi:text-box-remove-outline" width="48" class="no-changelog-icon" />
              <h4>{{ t('systemUpdates.noChangelog') }}</h4>
              <p>{{ t('systemUpdates.changelogNotAvailable') }}</p>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane :label="t('systemUpdates.installationInfo')" name="installation">
          <div class="tab-content">
            <div class="installation-info">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">
                    <Icon icon="mdi:harddisk" width="16" />
                    {{ t('systemUpdates.downloadSize') }}
                  </div>
                  <div class="info-value">
                    {{ update.size ? formatSize(update.size) : t('systemUpdates.unknown') }}
                  </div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">
                    <Icon icon="mdi:security" width="16" />
                    {{ t('systemUpdates.updateType') }}
                  </div>
                  <div class="info-value">
                    <el-tag 
                      size="small" 
                      :type="update.is_security ? 'danger' : 'info'"
                    >
                      {{ update.is_security ? t('systemUpdates.securityUpdate') : t('systemUpdates.regularUpdate') }}
                    </el-tag>
                  </div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">
                    <Icon icon="mdi:update" width="16" />
                    {{ t('systemUpdates.updateNeeded') }}
                  </div>
                  <div class="info-value">
                    <el-tag 
                      size="small" 
                      :type="update.is_kernel ? 'warning' : 'success'"
                    >
                      {{ update.is_kernel ? t('systemUpdates.kernelUpdate') : t('systemUpdates.userSpace') }}
                    </el-tag>
                  </div>
                </div>
                
                <div v-if="update.repository" class="info-item">
                  <div class="info-label">
                    <Icon icon="mdi:server" width="16" />
                    {{ t('systemUpdates.repository') }}
                  </div>
                  <div class="info-value">
                    <code>{{ update.repository }}</code>
                  </div>
                </div>
              </div>
              
              <div class="install-note">
                <el-alert 
                  :title="t('systemUpdates.installationNote')" 
                  type="info" 
                  show-icon 
                  :closable="false"
                >
                  <template #default>
                    <p>{{ t('systemUpdates.installationNoteText') }}</p>
                  </template>
                </el-alert>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <div v-else class="no-update-selected">
      <Icon icon="mdi:package-variant-remove" width="64" class="no-update-icon" />
      <h3>{{ t('systemUpdates.noPackageSelected') }}</h3>
      <p>{{ t('systemUpdates.selectPackageToViewDetails') }}</p>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeDialog">
          {{ t('common.close') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="emit('install', update)"
          :loading="installing"
          :disabled="!update"
          class="install-btn"
        >
          <template #icon>
            <Icon icon="mdi:package-down" width="16" />
          </template>
          {{ t('systemUpdates.installThisUpdate') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { Loading } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import PriorityBadge from './PriorityBadge.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  update: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'install'])

const { t } = useI18n()

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3001}`
})

// Reactive state
const activeTab = ref('description')
const dependencies = ref([])
const changelog = ref('')
const loadingDeps = ref(false)
const loadingChangelog = ref(false)
const installing = ref(false)
const changelogRef = ref(null)

// Computed
const packageName = computed(() => props.update?.name || '')

// Watch for update changes
watch(() => props.update, (newUpdate) => {
  if (newUpdate) {
    resetDialog()
    if (props.modelValue) {
      loadAdditionalData()
    }
  }
}, { deep: true })

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.update) {
    resetDialog()
    loadAdditionalData()
  }
})

// Methods
const getPackageIcon = (packageName) => {
  const icons = {
    'kernel': 'mdi:chip',
    'firefox': 'mdi:firefox',
    'chrome': 'mdi:google-chrome',
    'docker': 'mdi:docker',
    'nginx': 'mdi:nginx',
    'apache': 'mdi:apache',
    'python': 'mdi:language-python',
    'php': 'mdi:language-php',
    'node': 'mdi:nodejs',
    'mysql': 'mdi:database',
    'postgresql': 'mdi:database',
    'redis': 'mdi:database',
    'vim': 'mdi:code-tags',
    'git': 'mdi:git',
    'ssh': 'mdi:lock',
    'ssl': 'mdi:security',
    'curl': 'mdi:download',
    'wget': 'mdi:download'
  }
  
  for (const [key, icon] of Object.entries(icons)) {
    if (packageName.includes(key)) return icon
  }
  
  return 'mdi:package-variant'
}

const getPriority = (pkg) => {
  if (pkg.name.includes('security')) return 'critical'
  if (pkg.name.includes('kernel')) return 'high'
  if (pkg.description?.toLowerCase().includes('bug')) return 'medium'
  return 'low'
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const loadAdditionalData = async () => {
  if (!props.update?.name) return
  
  // Załaduj zależności
  loadingDeps.value = true
  try {
    const depsResponse = await api.get(`/system/updates/check-deps/${props.update.name}`)
    dependencies.value = depsResponse.data.dependencies || []
  } catch (error) {
    console.error('Failed to load dependencies:', error)
    dependencies.value = []
  } finally {
    loadingDeps.value = false
  }
  
  // Załaduj changelog tylko jeśli użytkownik przejdzie na tę zakładkę
  if (activeTab.value === 'changelog') {
    loadChangelog()
  }
}

const loadChangelog = async () => {
  if (!props.update?.name || changelog.value) return
  
  loadingChangelog.value = true
  try {
    const response = await api.get(`/system/updates/changelog/${props.update.name}`)
    changelog.value = response.data.changelog || ''
  } catch (error) {
    console.error('Failed to load changelog:', error)
    changelog.value = ''
  } finally {
    loadingChangelog.value = false
  }
}

const copyChangelog = async () => {
  if (!changelog.value) return
  
  try {
    const plainText = changelog.value
      .replace(/<br>/g, '\n')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
    
    await navigator.clipboard.writeText(plainText)
    ElMessage.success(t('systemUpdates.changelogCopied'))
  } catch (error) {
    console.error('Failed to copy changelog:', error)
    ElMessage.error(t('systemUpdates.copyFailed'))
  }
}

const closeDialog = () => {
  emit('update:modelValue', false)
}

const handleDialogClosed = () => {
  resetDialog()
}

const resetDialog = () => {
  activeTab.value = 'description'
  dependencies.value = []
  changelog.value = ''
  loadingDeps.value = false
  loadingChangelog.value = false
  installing.value = false
}

// Watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === 'changelog' && !changelog.value && !loadingChangelog.value) {
    loadChangelog()
  }
})

// Expose methods if needed
defineExpose({
  loadAdditionalData
})
</script>

<style scoped>
.update-details-dialog {
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
    max-height: 70vh;
    overflow-y: auto;
  }
  
  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid var(--el-border-color-light);
  }
}

.details-content {
  padding: 0;
}

.package-header {
  padding: 24px 24px 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.package-icon-title {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  
  .package-icon-large {
    color: var(--el-color-primary);
    flex-shrink: 0;
  }
  
  .package-title {
    h3 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      word-break: break-word;
    }
    
    .package-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
}

.version-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  
  .version-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    
    .version-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .version-tag {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      padding: 8px 12px;
    }
  }
  
  .version-arrow {
    color: var(--el-color-primary);
  }
}

:deep(.el-divider) {
  margin: 0;
}

.details-tabs {
  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 24px;
    background: var(--el-fill-color-lighter);
  }
  
  :deep(.el-tabs__nav-wrap)::after {
    height: 1px;
  }
  
  :deep(.el-tabs__nav-scroll) {
    padding: 0;
  }
  
  :deep(.el-tabs__item) {
    padding: 0 20px;
    height: 48px;
    font-weight: 500;
    
    &:hover {
      color: var(--el-color-primary);
    }
  }
  
  :deep(.el-tabs__active-bar) {
    height: 3px;
  }
}

.tab-content {
  padding: 24px;
}

.description-full {
  h4 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .description-text {
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.6;
      color: var(--el-text-color-regular);
      font-size: 14px;
      font-family: inherit;
    }
  }
  
  .no-description {
    color: var(--el-text-color-secondary);
    font-style: italic;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    text-align: center;
  }
  
  .maintainer-info {
    margin-top: 24px;
    
    h4 {
      margin-bottom: 8px;
    }
    
    .maintainer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--el-fill-color-lighter);
      border-radius: 8px;
      border-left: 4px solid var(--el-color-primary);
      
      span {
        font-family: monospace;
        font-size: 13px;
      }
    }
  }
}

.loading-deps,
.loading-changelog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
  
  .el-icon {
    font-size: 32px;
    color: var(--el-color-primary);
  }
  
  span {
    color: var(--el-text-color-secondary);
  }
}

.dependencies-list {
  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
  
  .dependencies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
  }
  
  .dependency-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--el-fill-color);
      border-color: var(--el-color-primary-light-5);
      transform: translateX(2px);
    }
    
    .dependency-name {
      font-size: 13px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      word-break: break-word;
    }
  }
}

.no-dependencies,
.no-changelog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  
  .no-deps-icon,
  .no-changelog-icon {
    color: var(--el-color-success);
    margin-bottom: 16px;
    opacity: 0.8;
  }
  
  h4 {
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }
  
  p {
    margin: 0;
    color: var(--el-text-color-secondary);
    max-width: 400px;
  }
}

.changelog-content {
  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
  
  .changelog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .changelog-text {
    max-height: 400px;
    overflow-y: auto;
    padding: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    border: 1px solid var(--el-border-color-light);
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
      font-size: 12px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      color: var(--el-text-color-regular);
    }
  }
}

.installation-info {
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    
    .info-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
    
    .info-value {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      
      code {
        background: var(--el-fill-color);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
      }
    }
  }
  
  .install-note {
    margin-top: 24px;
  }
}

.no-update-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
  
  .no-update-icon {
    color: var(--el-color-info);
    margin-bottom: 20px;
    opacity: 0.7;
  }
  
  h3 {
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
  }
  
  p {
    margin: 0;
    color: var(--el-text-color-secondary);
    max-width: 400px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .install-btn {
    min-width: 160px;
  }
}

@media (max-width: 768px) {
  .package-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .version-info {
    width: 100%;
    justify-content: center;
  }
  
  .dependencies-grid {
    grid-template-columns: 1fr !important;
  }
  
  .info-grid {
    grid-template-columns: 1fr !important;
  }
  
  :deep(.el-dialog) {
    width: 90% !important;
    margin-top: 5vh !important;
  }
}
</style>
