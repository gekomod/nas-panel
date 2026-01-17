<template>
  <div class="samba-shares">
    <!-- Nagłówek sekcji -->
    <div class="section-header">
      <div class="section-title">
        <Icon icon="mdi:folder-network" width="20" class="section-icon" />
        <h3>{{ $t('samba.shares.title') }}</h3>
        <el-tag v-if="!serviceStatus.running" type="danger" size="small" class="service-status">
          {{ $t('samba.status.stopped') }}
        </el-tag>
      </div>
      <el-button 
        type="primary" 
        size="small"
        @click="showCreateDialog = true"
        :disabled="!serviceStatus.running || loading"
        class="add-button"
      >
        <Icon icon="mdi:plus" width="16" />
        {{ $t('samba.shares.newShare') }}
      </el-button>
    </div>

    <!-- Alert o wyłączonej usłudze -->
    <el-alert
      v-if="!serviceStatus.running"
      :title="$t('samba.alerts.serviceStopped.title')"
      type="error"
      :closable="false"
      show-icon
      class="service-alert"
    />

    <!-- Stan pusty -->
    <div 
      v-if="!loading && shares.length === 0" 
      class="empty-state"
    >
      <Icon icon="mdi:folder-off-outline" width="48" class="empty-icon" />
      <p>{{ $t('samba.shares.noShares') }}</p>
      <el-button 
        v-if="serviceStatus.running" 
        type="primary" 
        size="small"
        @click="showCreateDialog = true"
      >
        {{ $t('samba.shares.newShare') }}
      </el-button>
    </div>

    <!-- Tabela udostępnień -->
    <el-table 
      v-else
      :data="shares" 
      v-loading="loading"
      style="width: 100%"
      :empty-text="$t('common.noData')"
      class="shares-table"
      size="small"
    >
      <el-table-column 
        prop="name" 
        :label="$t('samba.shares.columns.name')" 
        width="180"
      >
        <template #default="{ row }">
          <div class="share-name">
            <Icon icon="mdi:folder-shared" width="16" class="share-icon" />
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column prop="path" :label="$t('samba.shares.columns.path')">
        <template #default="{ row }">
          <div class="share-path">
            <Icon icon="mdi:folder" width="16" />
            <code>{{ row.path }}</code>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="comment" 
        :label="$t('samba.shares.columns.comment')"
        min-width="150"
      >
        <template #default="{ row }">
          <span v-if="row.comment" class="share-comment">
            {{ row.comment }}
          </span>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      
      <el-table-column 
        :label="$t('samba.shares.columns.readOnly')" 
        width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag 
            :type="row.readOnly ? 'warning' : 'success'" 
            size="small"
            effect="plain"
          >
            {{ row.readOnly ? $t('common.yes') : $t('common.no') }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column 
        :label="$t('common.actions')" 
        width="120"
        align="right"
      >
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button 
              size="small" 
              circle
              @click="editShare(row)"
              :title="$t('common.edit')"
              link
              class="action-btn"
            >
              <Icon icon="mdi:pencil" width="16" />
            </el-button>
            <el-button 
              size="small" 
              circle
              type="danger"
              @click="deleteShare(row)"
              :title="$t('common.delete')"
              link
              class="action-btn"
            >
              <Icon icon="mdi:trash-can-outline" width="16" />
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- Dialog tworzenia/edycji -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingShare ? $t('samba.shares.editTitle') : $t('samba.shares.createTitle')"
      width="500px"
      class="share-dialog"
      :close-on-click-modal="false"
    >
      <el-form 
        :model="shareForm" 
        :rules="formRules"
        ref="shareFormRef"
        label-position="top"
        @submit.prevent="saveShare"
      >
        <el-form-item 
          :label="$t('samba.shares.form.name')" 
          prop="name"
          required
        >
          <el-input 
            v-model="shareForm.name" 
            :placeholder="$t('samba.shares.form.namePlaceholder')"
            maxlength="32"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item 
          :label="$t('samba.shares.form.path')" 
          prop="path"
          required
        >
          <el-input 
            v-model="shareForm.path" 
            :placeholder="$t('samba.shares.form.pathPlaceholder')"
            @keyup.enter="saveShare"
          >
            <template #prepend>
              <Icon icon="mdi:folder" />
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item :label="$t('samba.shares.form.comment')">
          <el-input 
            v-model="shareForm.comment" 
            type="textarea"
            :rows="2"
            :placeholder="$t('samba.shares.form.commentPlaceholder')"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item :label="$t('samba.shares.form.readOnly')">
          <div class="switch-container">
            <el-switch v-model="shareForm.readOnly" />
            <span class="switch-label">
              {{ shareForm.readOnly ? $t('common.yes') : $t('common.no') }}
            </span>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false">
            {{ $t('common.cancel') }}
          </el-button>
          <el-button 
            type="primary" 
            @click="saveShare"
            :loading="saving"
          >
            {{ editingShare ? $t('common.save') : $t('common.create') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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
    
    let errorMessage = 'Błąd ładowania udostępnień';
    if (err.response) {
      if (err.response.status === 404) {
        errorMessage = 'Endpoint API nie znaleziony';
      } else if (err.response.data?.error) {
        errorMessage = err.response.data.error;
      }
    } else if (err.request) {
      errorMessage = 'Brak odpowiedzi od serwera';
    }
    
    ElMessage.error(errorMessage);
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
      ElMessage.success('Udostępnienie zaktualizowane');
    } else {
      await axios.post('/services/samba/shares', shareForm.value);
      ElMessage.success('Udostępnienie utworzone');
    }
    
    showCreateDialog.value = false;
    resetForm();
    await loadShares();
    emit('refresh-status');
  } catch (error) {
    ElMessage.error(error.response?.data?.error || 'Błąd podczas zapisywania');
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
        beforeClose: async (action, instance, done) => {
          if (action === 'confirm') {
            instance.confirmButtonLoading = true;
            try {
              await axios.delete(`/services/samba/shares/${encodeURIComponent(share.name)}`);
              ElMessage.success('Udostępnienie usunięte');
              await loadShares();
              emit('refresh-status');
              done();
            } catch (error) {
              ElMessage.error(error.response?.data?.error || 'Błąd podczas usuwania');
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

watch(showCreateDialog, (newVal) => {
  if (!newVal) {
    nextTick(() => resetForm());
  }
});
</script>

<style scoped lang="scss">
.samba-shares {
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.section-icon {
  color: #6366f1;
}

.section-title h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.service-status {
  font-size: 0.75rem;
  height: 22px;
}

.add-button {
  font-weight: 500;
}

.service-alert {
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px var(--spacing-md);
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  margin-bottom: var(--spacing-md);
  color: var(--border-color);
}

.empty-state p {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 0.875rem;
}

.shares-table {
  border-radius: var(--radius);
  overflow: hidden;
  
  :deep(.el-table__header) {
    th {
      background-color: var(--card-bg);
      font-weight: 600;
    }
  }
  
  :deep(.el-table__row) {
    &:hover {
      background-color: rgba(99, 102, 241, 0.04);
    }
  }
}

.share-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.share-icon {
  color: #6366f1;
}

.share-path {
  display: flex;
  align-items: center;
  gap: 8px;
  
  code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8125rem;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-primary);
  }
}

.dark .share-path code {
  background: rgba(255, 255, 255, 0.08);
}

.share-comment {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.action-btn {
  padding: 6px;
  
  &:hover {
    transform: translateY(-1px);
  }
}

.share-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
  }
  
  :deep(.el-dialog__header) {
    padding: var(--spacing-md) var(--spacing-md) 0;
    margin: 0;
  }
  
  :deep(.el-dialog__body) {
    padding: var(--spacing-md);
  }
  
  :deep(.el-dialog__footer) {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }
}

.switch-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.switch-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
