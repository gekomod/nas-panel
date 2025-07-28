<template>
  <div class="restore-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:backup-restore" />
          </el-icon>
          <span>{{ $t('backup.restore') }}</span>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item :label="$t('backup.select_backup')" required>
          <el-select 
            v-model="selectedBackup" 
            filterable
            :loading="loadingBackups"
          >
            <el-option
              v-for="backup in availableBackups"
              :key="backup.id"
              :label="backup.name"
              :value="backup.id"
              :disabled="backup.status !== 'completed'"
            >
              <span style="float: left">{{ backup.name }}</span>
              <span style="float: right; color: var(--el-text-color-secondary);">
                {{ formatDate(backup.created_at) }} ({{ formatSize(backup.size) }})
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="restoreSystemConfig">
            {{ $t('backup.restore_system_config') }}
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="verifyIntegrity">
            {{ $t('backup.verify_integrity') }}
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button 
            type="primary" 
            @click="restoreBackup"
            :loading="isRestoring"
            :disabled="!selectedBackup"
          >
            {{ $t('backup.restore_button') }}
          </el-button>
        </el-form-item>
      </el-form>
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

const availableBackups = ref([])
const selectedBackup = ref('')
const restoreSystemConfig = ref(false)
const verifyIntegrity = ref(true)
const isRestoring = ref(false)
const loadingBackups = ref(false)

const fetchBackups = async () => {
  loadingBackups.value = true
  try {
    const response = await axios.get('/api/system/backup/list')
    availableBackups.value = response.data.backups
  } catch (error) {
    ElMessage.error(t('backup.fetch_error'))
  } finally {
    loadingBackups.value = false
  }
}

const restoreBackup = async () => {
  try {
    await ElMessageBox.confirm(
      t('backup.restore_confirm'),
      t('common.warning'),
      { type: 'warning' }
    )
    
    isRestoring.value = true
    const response = await axios.post('/api/system/backup/restore', {
      backup_id: selectedBackup.value,
      restore_system_config: restoreSystemConfig.value,
      verify_integrity: verifyIntegrity.value
    })
    
    ElMessage.success(t('backup.restore_success'))
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || t('backup.restore_error'))
    }
  } finally {
    isRestoring.value = false
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

onMounted(fetchBackups)
</script>

<style scoped>
.restore-container {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
</style>
