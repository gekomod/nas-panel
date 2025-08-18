<template>
  <div class="samba-shares">
    <div class="section-header">
      <h2>
        <el-icon><icon icon="mdi:folder-network" /></el-icon>
        {{ $t('samba.shares.title') }}
        <el-tag v-if="!serviceStatus.running" type="danger" effect="dark" class="status-tag">
          {{ $t('samba.status.stopped') }}
        </el-tag>
      </h2>
      <el-button 
        type="primary" 
        @click="showCreateDialog = true"
        :disabled="!serviceStatus.running || loading"
      >
        <el-icon><icon icon="mdi:plus" /></el-icon>
        {{ $t('samba.shares.newShare') }}
      </el-button>
    </div>

    <div v-if="!serviceStatus.running" class="service-disabled-alert">
      <el-alert
        :title="$t('samba.alerts.serviceStopped.title')"
        type="error"
        :closable="false"
        center
        show-icon
      />
    </div>

    <el-empty 
      v-if="!loading && shares.length === 0" 
      :description="$t('samba.shares.noShares')"
      class="empty-state"
    />
    
    <el-table 
      v-else
      :data="shares" 
      v-loading="loading"
      style="width: 100%"
      :empty-text="$t('common.noData')"
      class="shares-table"
    >
      <el-table-column prop="name" :label="$t('samba.shares.columns.name')" width="180" />
      <el-table-column prop="path" :label="$t('samba.shares.columns.path')" />
      <el-table-column prop="comment" :label="$t('samba.shares.columns.comment')" />
      <el-table-column :label="$t('samba.shares.columns.readOnly')" width="120">
        <template #default="{ row }">
          <el-tag :type="row.readOnly ? 'danger' : 'success'">
            {{ row.readOnly ? $t('common.yes') : $t('common.no') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.actions')" width="150">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button 
              size="small" 
              circle
              @click="editShare(row)"
              :title="$t('common.edit')"
              icon="Edit"
              class="action-button"
              link
            >
              <Icon icon="mdi:edit" width="16" />
            </el-button>
            <el-button 
              size="small" 
              circle
              type="danger"
              @click="deleteShare(row)"
              :title="$t('common.delete')"
              icon="Delete"
              class="action-button"
              link
            >
              <Icon icon="mdi:delete" width="16" />
            </el-button>
          </div> 
        </template>
      </el-table-column>
    </el-table>

    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingShare ? $t('samba.shares.editTitle') : $t('samba.shares.createTitle')"
      width="50%"
      class="share-dialog"
    >
      <el-form :model="shareForm" :label-width="locale === 'pl' ? '150px' : '180px'">
        <el-form-item :label="$t('samba.shares.form.name')" required>
          <el-input v-model="shareForm.name" />
        </el-form-item>
        <el-form-item :label="$t('samba.shares.form.path')" required>
          <el-input v-model="shareForm.path" placeholder="/ścieżka/do/folderu" />
        </el-form-item>
        <el-form-item :label="$t('samba.shares.form.comment')">
          <el-input v-model="shareForm.comment" />
        </el-form-item>
        <el-form-item :label="$t('samba.shares.form.readOnly')">
          <el-switch v-model="shareForm.readOnly" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button 
          type="primary" 
          @click="saveShare"
          :loading="saving"
        >
          {{ editingShare ? $t('common.save') : $t('common.create') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, watch } from 'vue';
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
const error = ref(null);

const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  readOnly: false
});

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
  error.value = null;
  try {
    const response = await axios.get('/services/samba/shares');
   
    if (response.data && Array.isArray(response.data.data)) {
      shares.value = response.data.data;
    } else {
      throw new Error('Nieprawidłowy format danych');
    }
  } catch (err) {
    error.value = err;
    console.error('Błąd ładowania udostępnień:', err);
    
    let errorMessage = 'Błąd ładowania udostępnień';
    if (err.response) {
      if (err.response.status === 404) {
        errorMessage = 'Endpoint API nie znaleziony';
      } else if (err.response.data && err.response.data.error) {
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
    await loadShares();
    emit('refresh-status');
  } catch (error) {
    ElMessage.error(error.response?.data?.error || 'Błąd podczas zapisywania');
  } finally {
    saving.value = false;
  }
}

async function deleteShare(share) {
  try {
    await ElMessageBox.confirm(
      t('samba.shares.deleteConfirm', { name: share.name }),
      t('common.confirmation'),
      { 
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        beforeClose: async (action, instance, done) => {
          if (action === 'confirm') {
            instance.confirmButtonLoading = true;
            try {
              await axios.delete(`/services/samba/shares/${encodeURIComponent(share.name)}`);
              ElMessage.success(t('samba.shares.deleteSuccess'));
              await loadShares();
              emit('refresh-status');
              done();
            } catch (error) {
              ElMessage.error(error.response?.data?.error || t('samba.errors.deleteFailed'));
              instance.confirmButtonLoading = false;
            }
          } else {
            done();
          }
        }
      }
    );
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete error:', error);
    }
  }
}
</script>

<style scoped>
.samba-shares {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
}

.section-header h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 1.3rem;
}

.status-tag {
  margin-left: 10px;
}

.service-disabled-alert {
  margin-bottom: 20px;
}

.empty-state {
  padding: 40px 0;
  background: #fff;
  border-radius: 4px;
}

.shares-table {
  background: #fff;
  border-radius: 4px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-button {
  margin: 0;
  padding: 6px;
}

.action-button:hover {
  transform: scale(1.1);
}

.share-dialog :deep(.el-dialog__body) {
  padding: 20px;
}
</style>