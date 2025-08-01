<template>
  <div class="history-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:history" />
          </el-icon>
          <span>{{ $t('backup.history') }}</span>
        </div>
      </template>

      <el-table 
        :data="backups" 
        v-loading="loading"
        empty-text="No backups available"
        style="width: 100%"
      >
        <el-table-column prop="name" :label="$t('backup.history_table.name')" />
        <el-table-column :label="$t('backup.history_table.type')">
          <template #default="{row}">
            <el-tag>{{ $t(`backup.types.${row.type}`) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('backup.history_table.date')">
          <template #default="{row}">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('backup.history_table.size')">
          <template #default="{row}">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('backup.history_table.status')">
          <template #default="{row}">
            <el-tag :type="getStatusType(row.status)">
              {{ $t(`backup.statuses.${row.status}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('backup.history_table.actions')" width="180">
          <template #default="{row}">
            <el-button 
              size="small" 
              @click="downloadBackup(row.id)"
              :disabled="row.status !== 'completed'"
            >
              <el-icon><Icon icon="mdi:download" /></el-icon>
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteBackup(row.id)"
            >
              <el-icon><Icon icon="mdi:delete" /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalBackups"
          @current-change="fetchBackups"
          layout="prev, pager, next"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const backups = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const totalBackups = ref(0)

const fetchBackups = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/system/backup/history', {
      params: {
        page: currentPage.value,
        per_page: pageSize.value
      }
    })
    backups.value = response.data.backups
    totalBackups.value = response.data.total
  } catch (error) {
    ElMessage.error(t('backup.history_fetch_error'))
  } finally {
    loading.value = false
  }
}

const downloadBackup = async (backupId) => {
  try {
    // 1. Rozpocznij pobieranie
    const response = await axios({
      method: 'get',
      url: `/api/system/backup/download/${backupId}`,
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Download progress: ${percent}%`);
          // Możesz dodać aktualizację paska postępu w UI
        }
      }
    });

    // 2. Sprawdź czy otrzymaliśmy dane
    if (!response.data) {
      throw new Error('No data received from server');
    }

    // 3. Utwórz link do pobrania
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // 4. Ustaw nazwę pliku z nagłówka Content-Disposition lub domyślną
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `backup-${backupId}.tar.gz`;
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1];
      }
    }
    
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    
    // 5. Wyzwól pobieranie
    link.click();
    
    // 6. Sprzątanie
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      link.remove();
    }, 100);

    // 7. Opcjonalnie pokaż potwierdzenie
    ElMessage.success('Backup download started');

  } catch (error) {
    console.error('Download error:', error);
    
    // Bardziej szczegółowa obsługa błędów
    if (error.response) {
      // Serwer odpowiedział, ale ze statusem błędu
      if (error.response.status === 404) {
        ElMessage.error('Backup not found on server');
      } else if (error.response.status === 423) {
        ElMessage.warning('Backup is not ready for download yet');
      } else {
        const errorMsg = error.response.data?.error || 
                        error.response.statusText || 
                        'Download failed';
        ElMessage.error(errorMsg);
      }
    } else if (error.request) {
      // Żądanie zostało wysłane, ale nie otrzymano odpowiedzi
      ElMessage.error('No response from server. Check your connection.');
    } else {
      // Inne błędy
      ElMessage.error(error.message || 'Failed to download backup');
    }
  }
};

const deleteBackup = async (backupId) => {
  try {
    await ElMessageBox.confirm(
      t('backup.delete_confirm'),
      t('common.warning'),
      { type: 'warning' }
    )
    await axios.delete(`/api/system/backup/delete/${backupId}`)
    ElMessage.success(t('backup.delete_success'))
    fetchBackups()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('backup.delete_error'))
    }
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getStatusType = (status) => {
  const types = {
    completed: 'success',
    failed: 'danger',
    in_progress: 'warning',
    queued: 'info'
  }
  return types[status] || ''
}

onMounted(fetchBackups)
</script>

<style scoped>
.history-container {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
