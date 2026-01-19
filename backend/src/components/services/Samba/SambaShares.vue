<template>
  <div class="samba-shares-modern">
    <!-- Header -->
    <div class="section-header">
      <div class="header-left">
        <div class="title-wrapper">
          <div class="title-icon">
            <Icon icon="mdi:folder-multiple" width="24" />
          </div>
          <div>
            <h2>Udostępnienia</h2>
            <p class="subtitle">Zarządzaj udostępnieniami sieciowymi</p>
          </div>
        </div>
        <div v-if="!serviceStatus.running" class="status-alert">
          <Icon icon="mdi:alert-circle" width="16" />
          <span>Usługa Samba jest wyłączona</span>
        </div>
      </div>
      <el-button 
        type="primary" 
        @click="showCreateDialog = true"
        :disabled="!serviceStatus.running"
        class="create-btn"
      >
        <Icon icon="mdi:plus-circle" width="18" />
        <span>Nowe udostępnienie</span>
      </el-button>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && shares.length === 0" class="empty-state">
      <div class="empty-illustration">
        <Icon icon="mdi:folder-network-outline" width="64" />
      </div>
      <h3>Brak udostępnień</h3>
      <p>Dodaj swoje pierwsze udostępnienie sieciowe</p>
      <el-button 
        v-if="serviceStatus.running" 
        type="primary" 
        @click="showCreateDialog = true"
        class="empty-action"
      >
        <Icon icon="mdi:plus" width="16" />
        <span>Dodaj udostępnienie</span>
      </el-button>
    </div>

    <!-- Shares Grid -->
    <div v-else class="shares-grid">
      <div v-for="share in shares" :key="share.name" class="share-card">
        <div class="share-header">
          <div class="share-icon">
            <Icon icon="mdi:folder-shared" width="20" />
          </div>
          <div class="share-title">
            <h3>{{ share.name }}</h3>
            <div class="share-tags">
              <el-tag 
                :type="share.readOnly ? 'warning' : 'success'" 
                size="small"
                effect="plain"
              >
                {{ share.readOnly ? 'Tylko odczyt' : 'Odczyt/Zapis' }}
              </el-tag>
            </div>
          </div>
          <div class="share-actions">
            <el-dropdown trigger="click">
              <el-button text circle>
                <Icon icon="mdi:dots-vertical" width="20" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="editShare(share)">
                    <Icon icon="mdi:pencil" width="16" />
                    <span>Edytuj</span>
                  </el-dropdown-item>
                  <el-dropdown-item 
                    @click="deleteShare(share)"
                    style="color: var(--el-color-danger)"
                  >
                    <Icon icon="mdi:trash-can-outline" width="16" />
                    <span>Usuń</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        
        <div class="share-content">
          <div class="share-info">
            <div class="info-item">
              <Icon icon="mdi:folder" width="16" />
              <span class="info-label">Ścieżka:</span>
              <code class="info-value">{{ share.path }}</code>
            </div>
            <div v-if="share.comment" class="info-item">
              <Icon icon="mdi:comment-text" width="16" />
              <span class="info-label">Opis:</span>
              <span class="info-value">{{ share.comment }}</span>
            </div>
          </div>
        </div>
        
        <div class="share-footer">
          <div class="footer-actions">
            <el-button 
              size="small" 
              text
              @click="copySharePath(share)"
              class="footer-btn"
            >
              <Icon icon="mdi:content-copy" width="14" />
              <span>Kopiuj ścieżkę</span>
            </el-button>
            <el-button 
              size="small" 
              text
              @click="testShare(share)"
              class="footer-btn"
            >
              <Icon icon="mdi:test-tube" width="14" />
              <span>Testuj</span>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingShare ? 'Edytuj udostępnienie' : 'Nowe udostępnienie'"
      width="500px"
      class="modern-dialog"
    >
      <div class="dialog-content">
        <el-form 
          :model="shareForm" 
          :rules="formRules"
          ref="shareFormRef"
          label-position="top"
        >
          <el-form-item label="Nazwa udostępnienia" prop="name">
            <el-input 
              v-model="shareForm.name" 
              placeholder="np. documents"
              size="large"
            >
              <template #prefix>
                <Icon icon="mdi:tag" />
              </template>
            </el-input>
            <div class="form-hint">Tylko litery, cyfry, myślniki i podkreślenia</div>
          </el-form-item>
          
          <el-form-item label="Ścieżka folderu" prop="path">
            <el-input 
              v-model="shareForm.path" 
              placeholder="/ścieżka/do/folderu"
              size="large"
            >
              <template #prefix>
                <Icon icon="mdi:folder" />
              </template>
            </el-input>
            <div class="form-hint">Absolutna ścieżka do folderu</div>
          </el-form-item>
          
          <el-form-item label="Opis (opcjonalnie)">
            <el-input 
              v-model="shareForm.comment" 
              type="textarea"
              :rows="3"
              placeholder="Krótki opis udostępnienia"
              maxlength="255"
              show-word-limit
            />
          </el-form-item>
          
          <el-form-item label="Uprawnienia">
            <div class="permission-toggle">
              <div 
                class="toggle-option"
                :class="{ active: !shareForm.readOnly }"
                @click="shareForm.readOnly = false"
              >
                <div class="toggle-icon">
                  <Icon icon="mdi:pencil" width="20" />
                </div>
                <div class="toggle-content">
                  <div class="toggle-title">Odczyt/Zapis</div>
                  <div class="toggle-desc">Użytkownicy mogą edytować pliki</div>
                </div>
              </div>
              
              <div 
                class="toggle-option"
                :class="{ active: shareForm.readOnly }"
                @click="shareForm.readOnly = true"
              >
                <div class="toggle-icon">
                  <Icon icon="mdi:eye" width="20" />
                </div>
                <div class="toggle-content">
                  <div class="toggle-title">Tylko odczyt</div>
                  <div class="toggle-desc">Użytkownicy mogą tylko przeglądać</div>
                </div>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">
            Anuluj
          </el-button>
          <el-button 
            type="primary" 
            @click="saveShare"
            :loading="saving"
            class="save-btn"
          >
            <Icon icon="mdi:check" width="16" />
            <span>{{ editingShare ? 'Zapisz zmiany' : 'Utwórz udostępnienie' }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import { Icon } from '@iconify/vue';
import axios from 'axios';

const props = defineProps({
  serviceStatus: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['refresh-status']);

const shares = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const editingShare = ref(null);
const saving = ref(false);
const shareFormRef = ref(null);

const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  readOnly: false
});

const formRules = {
  name: [
    { required: true, message: 'Nazwa jest wymagana', trigger: 'blur' },
    { min: 1, max: 32, message: 'Nazwa musi mieć 1-32 znaków', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Tylko litery, cyfry, myślniki i podkreślenia', trigger: 'blur' }
  ],
  path: [
    { required: true, message: 'Ścieżka jest wymagana', trigger: 'blur' },
    { pattern: /^\/.+/, message: 'Ścieżka musi zaczynać się od /', trigger: 'blur' }
  ]
};

watch(() => props.serviceStatus.running, (newVal) => {
  if (newVal) {
    loadShares();
  } else {
    shares.value = [];
  }
});

onMounted(() => {
  if (props.serviceStatus.running) {
    loadShares();
  }
});

async function loadShares() {
  loading.value = true;
  try {
    const response = await axios.get('/services/samba/shares');
    
    if (response.data && Array.isArray(response.data.data)) {
      shares.value = response.data.data;
    } else {
      throw new Error('Nieprawidłowy format danych');
    }
  } catch (err) {
    console.error('Błąd ładowania udostępnień:', err);
    ElNotification.error({
      title: 'Błąd ładowania',
      message: 'Nie udało się załadować listy udostępnień',
      position: 'bottom-right'
    });
  } finally {
    loading.value = false;
  }
}

function editShare(share) {
  editingShare.value = share;
  shareForm.value = { ...share };
  showCreateDialog.value = true;
}

async function saveShare() {
  if (!shareFormRef.value) return;
  
  const valid = await shareFormRef.value.validate();
  if (!valid) return;
  
  saving.value = true;
  try {
    if (editingShare.value) {
      await axios.put(`/services/samba/shares/${editingShare.value.name}`, shareForm.value);
      ElNotification.success({
        title: 'Sukces',
        message: 'Udostępnienie zaktualizowane',
        position: 'bottom-right'
      });
    } else {
      await axios.post('/services/samba/shares', shareForm.value);
      ElNotification.success({
        title: 'Sukces',
        message: 'Udostępnienie utworzone',
        position: 'bottom-right'
      });
    }
    
    showCreateDialog.value = false;
    resetForm();
    await loadShares();
    emit('refresh-status');
  } catch (error) {
    ElNotification.error({
      title: 'Błąd',
      message: error.response?.data?.error || 'Błąd podczas zapisywania',
      position: 'bottom-right'
    });
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  shareForm.value = {
    name: '',
    path: '',
    comment: '',
    readOnly: false
  };
  editingShare.value = null;
  if (shareFormRef.value) {
    shareFormRef.value.resetFields();
  }
}

async function deleteShare(share) {
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz usunąć udostępnienie "${share.name}"?`,
      'Potwierdzenie usunięcia',
      {
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        customClass: 'modern-confirm',
        beforeClose: async (action, instance, done) => {
          if (action === 'confirm') {
            instance.confirmButtonLoading = true;
            try {
              await axios.delete(`/services/samba/shares/${encodeURIComponent(share.name)}`);
              ElNotification.success({
                title: 'Usunięto',
                message: 'Udostępnienie zostało usunięte',
                position: 'bottom-right'
              });
              await loadShares();
              emit('refresh-status');
              done();
            } catch (error) {
              ElNotification.error({
                title: 'Błąd',
                message: error.response?.data?.error || 'Błąd podczas usuwania',
                position: 'bottom-right'
              });
              instance.confirmButtonLoading = false;
            }
          } else {
            done();
          }
        }
      }
    );
  } catch (error) {
    // Anulowano
  }
}

function copySharePath(share) {
  navigator.clipboard.writeText(share.path);
  ElMessage.success('Ścieżka skopiowana do schowka');
}

function testShare(share) {
  ElNotification.info({
    title: 'Testowanie',
    message: `Rozpoczynam test udostępnienia ${share.name}`,
    position: 'bottom-right'
  });
}

watch(showCreateDialog, (newVal) => {
  if (!newVal) {
    nextTick(() => resetForm());
  }
});
</script>

<style scoped lang="scss">
.samba-shares-modern {
  --primary-color: #6366f1;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --border-color: #e2e8f0;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .samba-shares-modern {
  --bg-primary: #1e293b;
  --bg-secondary: #0f172a;
  --border-color: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
}

.samba-shares-modern {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 32px;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  .title-wrapper {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    
    .title-icon {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      
      .iconify {
        color: white;
      }
    }
    
    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .status-alert {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fecaca;
    border-radius: var(--radius-sm);
    color: #dc2626;
    font-size: 0.875rem;
    font-weight: 500;
    
    .dark & {
      background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%);
      border-color: #f87171;
    }
  }
}

.create-btn {
  background: linear-gradient(135deg, var(--primary-color) 0%, #8b5cf6 100%);
  border: none;
  padding: 10px 20px;
  font-weight: 600;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Empty State */
.empty-state {
  padding: 64px 32px;
  text-align: center;
  
  .empty-illustration {
    margin: 0 auto 24px;
    width: 96px;
    height: 96px;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .dark & {
      background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    }
    
    .iconify {
      color: var(--text-secondary);
      opacity: 0.5;
    }
  }
  
  h3 {
    margin: 0 0 8px;
    color: var(--text-primary);
    font-size: 1.25rem;
  }
  
  p {
    margin: 0 0 24px;
    color: var(--text-secondary);
  }
}

.empty-action {
  background: linear-gradient(135deg, var(--primary-color) 0%, #8b5cf6 100%);
  border: none;
  padding: 12px 24px;
  font-weight: 600;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Shares Grid */
.shares-grid {
  padding: 32px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.share-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-lg);
    transform: translateY(-4px);
  }
}

.share-header {
  padding: 20px 20px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
  
  .share-icon {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    
    .iconify {
      color: var(--primary-color);
    }
  }
  
  .share-title {
    flex: 1;
    
    h3 {
      margin: 0 0 8px;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
  
  .share-actions {
    .el-button {
      color: var(--text-secondary);
      
      &:hover {
        color: var(--text-primary);
      }
    }
  }
}

.share-tags {
  :deep(.el-tag) {
    font-weight: 500;
    border: none;
  }
}

.share-content {
  padding: 20px;
}

.share-info {
  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .iconify {
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    
    .info-label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      flex-shrink: 0;
    }
    
    .info-value {
      color: var(--text-primary);
      font-size: 0.875rem;
      flex: 1;
      min-width: 0;
      
      &.info-value code {
        background: var(--bg-primary);
        padding: 4px 8px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.75rem;
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.share-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.02);
  
  .dark & {
    background: rgba(255, 255, 255, 0.02);
  }
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  
  &:hover {
    color: var(--primary-color);
  }
}

/* Dialog */
.modern-dialog {
  :deep(.el-dialog) {
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  :deep(.el-dialog__header) {
    padding: 24px 32px 0;
    margin: 0;
    
    .el-dialog__title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
  
  :deep(.el-dialog__headerbtn) {
    top: 28px;
    right: 32px;
    
    .el-dialog__close {
      color: var(--text-secondary);
      font-size: 20px;
      
      &:hover {
        color: var(--text-primary);
      }
    }
  }
}

.dialog-content {
  padding: 24px 32px;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
  
  .el-form-item__label {
    color: var(--text-primary);
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 0.875rem;
  }
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.permission-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.toggle-option {
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--primary-color);
  }
  
  &.active {
    border-color: var(--primary-color);
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  }
  
  .toggle-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    
    .iconify {
      color: var(--text-primary);
    }
    
    .active & {
      background: var(--primary-color);
      
      .iconify {
        color: white;
      }
    }
  }
  
  .toggle-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  
  .toggle-desc {
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
}

.dialog-footer {
  padding: 0 32px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.save-btn {
  background: linear-gradient(135deg, var(--primary-color) 0%, #8b5cf6 100%);
  border: none;
  padding: 10px 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Confirm Dialog */
:deep(.modern-confirm) {
  .el-message-box {
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  .el-message-box__title {
    font-weight: 600;
  }
}

/* Loading State */
:deep(.el-loading-mask) {
  background: rgba(255, 255, 255, 0.8);
  
  .dark & {
    background: rgba(0, 0, 0, 0.8);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 16px;
    padding: 24px;
  }
  
  .shares-grid {
    grid-template-columns: 1fr;
    padding: 24px;
  }
  
  .permission-toggle {
    grid-template-columns: 1fr;
  }
  
  .dialog-content {
    padding: 16px;
  }
  
  :deep(.el-dialog) {
    width: 90% !important;
    max-width: 500px;
  }
}
</style>
