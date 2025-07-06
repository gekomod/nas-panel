<!-- src/components/services/Samba/SambaShares.vue -->
<template>
  <div class="samba-shares-container">
    <el-alert 
      v-if="!sambaInstalled"
      title="Samba nie jest zainstalowane"
      type="error"
      :closable="false"
      show-icon
    >
      <template #default>
        <p>Aby korzystać z funkcji Samba, zainstaluj pakiet na serwerze:</p>
        <el-button type="primary" @click="installSamba" :loading="installing">
          Zainstaluj Sambę
        </el-button>
      </template>
    </el-alert>
    
    <template v-else>   
      <el-card :class="{'disabled-card': !sambaRunning}">
      <template #header>
        <div class="card-header">
          <h2>
            <el-icon><icon icon="mdi:folder-network" /></el-icon>
            Udostępnienia Samba
            <el-tag v-if="!sambaRunning" type="danger" effect="dark" class="status-tag">
              Samba wyłączona
            </el-tag>
          </h2>
          <el-button 
            type="primary" 
            @click="showCreateDialog = true"
            :disabled="!sambaAvailable"
          >
            <el-icon><icon icon="mdi:plus" /></el-icon>
            Nowe udostępnienie
          </el-button>
        </div>
      </template>

      <div v-if="!sambaRunning" class="disabled-overlay">
        <el-alert
          title="Usługa Samba jest wyłączona"
          type="error"
          :closable="false"
          center
          show-icon
        >
          <p>Aby zarządzać udostępnieniami, włącz usługę Samba w zakładce <router-link to="/services/samba/status">Status usługi</router-link></p>
        </el-alert>
      </div>

      <el-table 
        :data="shares" 
        v-loading="loading"
        empty-text="Brak udostępnień"
        style="width: 100%"
      >
        <el-table-column prop="name" label="Nazwa" width="180" />
        <el-table-column prop="path" label="Ścieżka" />
        <el-table-column prop="comment" label="Opis" />
        <el-table-column label="Tylko do odczytu" width="120">
          <template #default="{ row }">
            <el-tag :type="row.readOnly ? 'danger' : 'success'">
              {{ row.readOnly ? 'Tak' : 'Nie' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Operacje" width="150">
          <template #default="{ row }">
           <div class="action-buttons">
            <el-button 
              size="small" 
              circle
              @click="editShare(row)"
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
      </el-card>

      <!-- Dialog do tworzenia/edycji -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingShare ? 'Edytuj udostępnienie' : 'Nowe udostępnienie'"
      width="50%"
    >
      <el-form :model="shareForm" label-width="150px">
        <el-form-item label="Nazwa udostępnienia" required>
          <el-input v-model="shareForm.name" />
        </el-form-item>
        <el-form-item label="Ścieżka na serwerze" required>
          <el-input v-model="shareForm.path" placeholder="/ścieżka/do/folderu" />
        </el-form-item>
        <el-form-item label="Opis">
          <el-input v-model="shareForm.comment" />
        </el-form-item>
        <el-form-item label="Tylko do odczytu">
          <el-switch v-model="shareForm.readOnly" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Anuluj</el-button>
        <el-button 
          type="primary" 
          @click="saveShare"
          :loading="saving"
        >
          {{ editingShare ? 'Zapisz zmiany' : 'Utwórz udostępnienie' }}
        </el-button>
      </template>
    </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue'
import axios from 'axios';

const sambaInstalled = ref(true);
const installing = ref(false);
const shares = ref([]);
const sambaRunning = ref(false);
const loading = ref(false);
const currentShare = ref(null);
const sambaAvailable = ref(true);
const showCreateDialog = ref(false);
const editingShare = ref(null)
const saving = ref(false);

const shareForm = ref({
  name: '',
  path: '',
  comment: '',
  readOnly: false
});

onMounted(() => {
  checkSamba();
  if (sambaRunning.value = true) {
    loadShares();
  }
});

async function checkSamba() {
  try {
    const response = await axios.get('/services/samba/status');
    sambaInstalled.value = response.data.installed;
    sambaRunning.value = response.data.running;
    
    if (!sambaRunning.value) {
      ElMessage.warning('Usługa Samba jest wyłączona. Udostępnienia są niedostępne.');
    }
  } catch (error) {
    ElMessage.error('Błąd sprawdzania stanu Samby');
    sambaInstalled.value = false;
    sambaRunning.value = false;
  }
}

async function installSamba() {
  installing.value = true;
  try {
    await axios.post('/services/samba/install');
    ElMessage.success('Samba zainstalowana pomyślnie');
    sambaInstalled.value = true;
    loadShares();
  } catch (error) {
    ElMessage.error('Błąd instalacji Samby');
  } finally {
    installing.value = false;
  }
}

async function loadShares() {
  loading.value = true;
  try {
    const response = await axios.get('/services/samba/shares');
    shares.value = response.data.data || [];
  } catch (error) {
    ElMessage.error('Błąd ładowania udostępnień');
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
    loadShares();
  } catch (error) {
    ElMessage.error(error.response?.data?.error || 'Błąd podczas zapisywania');
  } finally {
    saving.value = false;
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
        beforeClose: async (action, instance, done) => {
          if (action === 'confirm') {
            instance.confirmButtonLoading = true;
            try {
              await axios.delete(`/services/samba/shares/${encodeURIComponent(share.name)}`);
              ElMessage.success('Udostępnienie zostało usunięte');
              await loadShares();
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
    if (error !== 'cancel') {
      console.error('Delete error:', error);
    }
  }
}
</script>

<style scoped>
.samba-shares-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.disabled-card {
  position: relative;
  opacity: 0.7;
}

.disabled-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.el-table[disabled] {
  pointer-events: none;
  opacity: 0.7;
}

.status-tag {
  margin-left: 10px;
  vertical-align: middle;
}


.actions {
  display: flex;
  gap: 12px;
}

.action-button {
  margin: 0;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.action-button:hover {
  transform: scale(1.1);
}
</style>
