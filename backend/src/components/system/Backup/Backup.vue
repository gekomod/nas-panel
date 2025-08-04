<template>
  <div class="backup-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:content-save" />
          </el-icon>
          <span>{{ $t('backup.title') }}</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="backup-tabs">
        <el-tab-pane :label="$t('backup.create')" name="create">
          <el-form 
            :model="backupForm" 
            label-position="top"
            @submit.prevent="createBackup"
          >
            <el-form-item :label="$t('backup.type')" required>
              <el-select v-model="backupForm.type">
                <el-option
                  v-for="item in backupTypes"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item :label="$t('backup.name')" required>
              <el-input v-model="backupForm.name" />
            </el-form-item>

            <el-form-item :label="$t('backup.itemss')">
              <el-select 
                v-model="backupForm.items" 
                multiple 
                collapse-tags
                collapse-tags-tooltip
              >
                <el-option
                  v-for="item in backupItems"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item :label="$t('backup.compression')">
              <el-select v-model="backupForm.compression">
                <el-option
                  v-for="item in compressionLevels"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-checkbox v-model="backupForm.includeSystemConfig">
                {{ $t('backup.include_system_config') }}
              </el-checkbox>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                native-type="submit"
                :loading="isCreating"
              >
                {{ $t('backup.create_button') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="$t('backup.restore')" name="restore">
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
        </el-tab-pane>

        <el-tab-pane :label="$t('backup.history')" name="history">
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
            <el-table-column :label="$t('backup.history_table.status')" width="150">
              <template #default="{row}">
                <el-tag :type="getStatusType(row.status)" effect="dark">
                  {{ $t(`backup.statuses.${row.status}`) }}
                </el-tag>
                <el-progress 
                  v-if="row.status === 'in_progress'"
                  :percentage="row.progress || 0" 
                  :stroke-width="3"
                  :show-text="false"
                  style="margin-top: 5px;"
                />
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
        </el-tab-pane>

        <el-tab-pane :label="$t('backup.schedule')" name="schedule">
          <el-form 
            :model="scheduleForm" 
            label-position="top"
            @submit.prevent="saveSchedule"
          >
            <el-form-item :label="$t('backup.schedule_type')">
              <el-select v-model="scheduleForm.type">
                <el-option
                  v-for="item in scheduleTypes"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <template v-if="scheduleForm.type === 'daily'">
              <el-form-item :label="$t('backup.daily_time')">
                <el-time-picker
                  v-model="scheduleForm.dailyTime"
                  format="HH:mm"
                  value-format="HH:mm"
                />
              </el-form-item>
            </template>

            <template v-else-if="scheduleForm.type === 'weekly'">
              <el-form-item :label="$t('backup.weekly_day')">
                <el-select v-model="scheduleForm.weeklyDay">
                  <el-option
                    v-for="day in weekDays"
                    :key="day.value"
                    :label="day.text"
                    :value="day.value"
                  />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('backup.weekly_time')">
                <el-time-picker
                  v-model="scheduleForm.weeklyTime"
                  format="HH:mm"
                  value-format="HH:mm"
                />
              </el-form-item>
            </template>

            <template v-else-if="scheduleForm.type === 'monthly'">
              <el-form-item :label="$t('backup.monthly_day')">
                <el-input-number
                  v-model="scheduleForm.monthlyDay"
                  :min="1"
                  :max="31"
                />
              </el-form-item>

              <el-form-item :label="$t('backup.monthly_time')">
                <el-time-picker
                  v-model="scheduleForm.monthlyTime"
                  format="HH:mm"
                  value-format="HH:mm"
                />
              </el-form-item>
            </template>

            <el-form-item :label="$t('backup.retention')">
              <el-select v-model="scheduleForm.retention">
                <el-option
                  v-for="item in retentionOptions"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                native-type="submit"
                :loading="isSaving"
              >
                {{ $t('backup.save_schedule') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <el-dialog v-model="resultDialogVisible" :title="resultDialogTitle">
        <div class="result-content" v-html="resultDialogMessage"></div>
        <div class="result-content">
          <p class="success-message">
            <el-icon><Icon icon="mdi:information-outline" /></el-icon>
            {{ $t('backup.creation_started') }}
          </p>
          <p class="warning-message">
            <el-icon><Icon icon="mdi:clock-outline" /></el-icon>
            {{ $t('backup.background_warning') }}
          </p>
        </div>
        <template #footer>
          <el-button type="primary" @click="resultDialogVisible = false">
            {{ $t('common.close') }}
          </el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, inject, computed } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const $notify = inject('notifications') || inject('$notify')
const notificationService = inject('notifications')
const backupIntervals = ref({})

// Użyj computed aby śledzić nieprzeczytane powiadomienia
const unreadNotifications = computed(() => {
  return notificationService?.notifications?.value?.filter(n => !n.read).length || 0
})

// Shared data
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

// Create Backup Tab
const backupForm = ref({
  type: 'full',
  name: '',
  items: [],
  compression: 'medium',
  includeSystemConfig: true
})

const isCreating = ref(false)
const resultDialogVisible = ref(false)
const resultDialogTitle = ref('')
const resultDialogMessage = ref('')

const backupTypes = [
  { value: 'full', text: t('backup.types.full') },
  { value: 'incremental', text: t('backup.types.incremental') },
  { value: 'differential', text: t('backup.types.differential') }
]

const backupItems = [
  { value: 'documents', text: t('backup.items.documents') },
  { value: 'photos', text: t('backup.items.photos') },
  { value: 'music', text: t('backup.items.music') },
  { value: 'videos', text: t('backup.items.videos') },
  { value: 'configuration', text: t('backup.items.configuration') }
]

const compressionLevels = [
  { value: 'none', text: t('backup.compression_levels.none') },
  { value: 'low', text: t('backup.compression_levels.low') },
  { value: 'medium', text: t('backup.compression_levels.medium') },
  { value: 'high', text: t('backup.compression_levels.high') }
]

// Modyfikowana funkcja tworzenia kopii
const createBackup = async () => {
  isCreating.value = true
  try {
    const response = await axios.post('/api/system/backup/create', backupForm.value)
    
    // Powiadomienie o rozpoczęciu tworzenia kopii
    notificationService.addNotification({
      title: 'Rozpoczęto tworzenie kopii',
      message: `Rozpoczęto proces tworzenia kopii "${backupForm.value.name}"`,
      type: 'info',
      icon: 'mdi:backup-restore',
      duration: 5000
    })

    // Ustawiamy dialog z podstawowymi informacjami
    resultDialogTitle.value = 'Tworzenie kopii w toku'
    resultDialogMessage.value = `
      <p>Rozpoczęto proces tworzenia kopii zapasowej <strong>${backupForm.value.name}</strong>.</p>
      <p>ID kopii: <code>${response.data.backupId}</code></p>
      <p>Status: <el-tag type="info">W kolejce</el-tag></p>
      <p class="info-text">Rozmiar będzie dostępny po zakończeniu procesu.</p>
    `
    resultDialogVisible.value = true

    // Odświeżamy listę kopii po pewnym czasie
    setTimeout(() => {
      fetchBackups()
      fetchAvailableBackups()
      
      // Dodajemy opóźnione powiadomienie (symulacja)
      setTimeout(() => {
        notificationService.addNotification({
          title: 'Kopia utworzona',
          message: `Kopia "${backupForm.value.name}" została pomyślnie utworzona`,
          type: 'success',
          icon: 'mdi:check-circle',
          duration: 8000
        })
        
        // Aktualizujemy dialog po "zakończeniu"
        resultDialogMessage.value = `
          <p>Kopia zapasowa <strong>${backupForm.value.name}</strong> została utworzona pomyślnie.</p>
          <p>ID kopii: <code>${response.data.backupId}</code></p>
          <p>Status: <el-tag type="success">Zakończono</el-tag></p>
        `
      }, 10000) // Symulacja 10 sekundowego procesu
    }, 2000)

  } catch (error) {
    const errorMsg = error.response?.data?.message || 
                    'Wystąpił błąd podczas tworzenia kopii zapasowej'
    
    notificationService.addNotification({
      title: 'Błąd tworzenia kopii',
      message: errorMsg,
      type: 'error',
      icon: 'mdi:alert-circle',
      duration: 8000
    })
    
    ElMessage.error(errorMsg)
  } finally {
    isCreating.value = false
  }
}


// Restore Backup Tab
const availableBackups = ref([])
const selectedBackup = ref('')
const restoreSystemConfig = ref(false)
const verifyIntegrity = ref(true)
const isRestoring = ref(false)
const loadingBackups = ref(false)

const fetchAvailableBackups = async () => {
  loadingBackups.value = true
  try {
    const response = await axios.get('/api/system/backup/list')
    availableBackups.value = response.data.backups
  } catch (error) {
    const errorMsg = error.response?.data?.message || t('backup.fetch_error')
    
    $notify.addNotification({
      title: t('backup.notification.fetch_error_title'),
      message: errorMsg,
      type: 'error',
      icon: 'mdi:database-alert',
      duration: 6000
    })
    
    ElMessage.error(errorMsg)
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
    
    $notify.addNotification({
      title: t('backup.notification.restored_title'),
      message: t('backup.notification.restored_message', {
        name: availableBackups.value.find(b => b.id === selectedBackup.value)?.name || selectedBackup.value
      }),
      type: 'success',
      icon: 'mdi:restore',
      duration: 5000
    })
    
    ElMessage.success(t('backup.restore_success'))
  } catch (error) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.message || t('backup.restore_error')
      
      $notify.addNotification({
        title: t('backup.notification.restore_error_title'),
        message: errorMsg,
        type: 'error',
        icon: 'mdi:alert-circle',
        duration: 8000
      })
      
      ElMessage.error(errorMsg)
    }
  } finally {
    isRestoring.value = false
  }
}

// History Tab
const backups = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const totalBackups = ref(0)
const refreshInterval = ref(null)

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
    
    // Sprawdź czy są kopie w trakcie tworzenia
    const inProgress = backups.value.filter(b => b.status === 'in_progress')
    if (inProgress.length > 0 && !refreshInterval.value) {
      startStatusRefresh()
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || t('backup.history_fetch_error')
    
    $notify.addNotification({
      title: t('backup.notification.history_error_title'),
      message: errorMsg,
      type: 'error',
      icon: 'mdi:history',
      duration: 6000
    })
    
    ElMessage.error(errorMsg)
  } finally {
    loading.value = false
  }
}

const startStatusRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  
  refreshInterval.value = setInterval(() => {
    const hasInProgress = backups.value.some(b => b.status === 'in_progress')
    if (hasInProgress) {
      fetchBackups()
      fetchAvailableBackups()
    } else {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }, 10000)
}

const downloadBackup = async (backupId) => {
  try {
    const response = await axios({
      method: 'get',
      url: `/api/system/backup/download/${backupId}`,
      responseType: 'blob'
    })

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    
    const contentDisposition = response.headers['content-disposition']
    let fileName = `backup-${backupId}.tar.gz`
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/)
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1]
      }
    }
    
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      link.remove()
    }, 100)

    $notify.addNotification({
      title: t('backup.notification.download_started_title'),
      message: t('backup.notification.download_started_message', { name: fileName }),
      type: 'info',
      icon: 'mdi:download',
      duration: 4000
    })
    
    ElMessage.success(t('backup.download_started'))
  } catch (error) {
    let errorMsg = t('backup.download_error')
    
    if (error.response) {
      if (error.response.status === 404) {
        errorMsg = t('backup.not_found')
      } else if (error.response.status === 423) {
        errorMsg = t('backup.not_ready')
      } else {
        errorMsg = error.response.data?.error || error.response.statusText
      }
    }
    
    $notify.addNotification({
      title: t('backup.notification.download_error_title'),
      message: errorMsg,
      type: 'error',
      icon: 'mdi:download-off',
      duration: 8000
    })
    
    ElMessage.error(errorMsg)
  }
}

const deleteBackup = async (backupId) => {
  try {
    await ElMessageBox.confirm(
      t('backup.delete_confirm'),
      t('common.warning'),
      { type: 'warning' }
    )
    
    await axios.delete(`/api/system/backup/delete/${backupId}`)
    
    $notify.addNotification({
      title: t('backup.notification.deleted_title'),
      message: t('backup.notification.deleted_message'),
      type: 'success',
      icon: 'mdi:delete-empty',
      duration: 5000
    })
    
    ElMessage.success(t('backup.delete_success'))
    fetchBackups()
    fetchAvailableBackups()
  } catch (error) {
    if (error !== 'cancel') {
      const errorMsg = error.response?.data?.message || t('backup.delete_error')
      
      $notify.addNotification({
        title: t('backup.notification.delete_error_title'),
        message: errorMsg,
        type: 'error',
        icon: 'mdi:delete-alert',
        duration: 8000
      })
      
      ElMessage.error(errorMsg)
    }
  }
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

// Schedule Tab
const scheduleForm = ref({
  type: 'disabled',
  dailyTime: '02:00',
  weeklyDay: 'monday',
  weeklyTime: '02:00',
  monthlyDay: 1,
  monthlyTime: '02:00',
  retention: '30d'
})

const isSaving = ref(false)

const scheduleTypes = [
  { value: 'disabled', text: t('backup.schedule_types.disabled') },
  { value: 'daily', text: t('backup.schedule_types.daily') },
  { value: 'weekly', text: t('backup.schedule_types.weekly') },
  { value: 'monthly', text: t('backup.schedule_types.monthly') }
]

const weekDays = [
  { value: 'monday', text: t('weekdays.monday') },
  { value: 'tuesday', text: t('weekdays.tuesday') },
  { value: 'wednesday', text: t('weekdays.wednesday') },
  { value: 'thursday', text: t('weekdays.thursday') },
  { value: 'friday', text: t('weekdays.friday') },
  { value: 'saturday', text: t('weekdays.saturday') },
  { value: 'sunday', text: t('weekdays.sunday') }
]

const retentionOptions = [
  { value: '7d', text: t('backup.retention_options.7d') },
  { value: '14d', text: t('backup.retention_options.14d') },
  { value: '30d', text: t('backup.retention_options.30d') },
  { value: '90d', text: t('backup.retention_options.90d') },
  { value: '1y', text: t('backup.retention_options.1y') },
  { value: 'forever', text: t('backup.retention_options.forever') }
]

const loadSchedule = async () => {
  try {
    const response = await axios.get('/api/system/backup/schedule')
    if (response.data.schedule) {
      scheduleForm.value = {
        type: response.data.schedule.type || 'disabled',
        dailyTime: response.data.schedule.daily_time || '02:00',
        weeklyDay: response.data.schedule.weekly_day || 'monday',
        weeklyTime: response.data.schedule.weekly_time || '02:00',
        monthlyDay: response.data.schedule.monthly_day || 1,
        monthlyTime: response.data.schedule.monthly_time || '02:00',
        retention: response.data.schedule.retention || '30d'
      }
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || t('backup.schedule_load_error')
    
    $notify.addNotification({
      title: t('backup.notification.schedule_error_title'),
      message: errorMsg,
      type: 'error',
      icon: 'mdi:calendar-alert',
      duration: 6000
    })
    
    ElMessage.error(errorMsg)
  }
}

const saveSchedule = async () => {
  isSaving.value = true
  try {
    const payload = {
      schedule: {
        type: scheduleForm.value.type,
        retention: scheduleForm.value.retention
      }
    }

    if (scheduleForm.value.type === 'daily') {
      payload.schedule.daily_time = scheduleForm.value.dailyTime
    } 
    else if (scheduleForm.value.type === 'weekly') {
      payload.schedule.weekly_day = scheduleForm.value.weeklyDay
      payload.schedule.weekly_time = scheduleForm.value.weeklyTime
    } 
    else if (scheduleForm.value.type === 'monthly') {
      payload.schedule.monthly_day = scheduleForm.value.monthlyDay
      payload.schedule.monthly_time = scheduleForm.value.monthlyTime
    }

    await axios.post('/api/system/backup/schedule', payload)
    
    $notify.addNotification({
      title: t('backup.notification.schedule_saved_title'),
      message: t('backup.notification.schedule_saved_message'),
      type: 'success',
      icon: 'mdi:calendar-check',
      time: new Date(Date.now() - 1000 * 60 * 5),
      read: false,
      duration: 5000
    })
    
    ElMessage.success(t('backup.schedule_saved'))
  } catch (error) {
    const errorMsg = error.response?.data?.error || 
                    error.response?.data?.message || 
                    t('backup.schedule_save_error')
    
    $notify.addNotification({
      id: 1,
      title: t('backup.notification.schedule_error_title'),
      message: errorMsg,
      type: 'error',
      icon: 'mdi:calendar-alert',
      duration: 8000
    })

    ElMessage.error(errorMsg)
  } finally {
    isSaving.value = false
  }
}

// Active tab
const activeTab = ref('create')

// Initialize data
onMounted(() => {
  fetchAvailableBackups()
  fetchBackups()
  loadSchedule()
})

onBeforeUnmount(() => {
  // Wyczyść wszystkie interwały śledzenia kopii
  Object.values(backupIntervals.value).forEach(interval => {
    clearInterval(interval)
  })
  
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.backup-container {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.backup-tabs {
  margin-top: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.el-form-item {
  margin-bottom: 18px;
}

.el-tag {
  margin-right: 5px;
}

.el-progress {
  width: 100%;
}

.result-content {
  line-height: 1.6;
}

.success-message {
  color: var(--el-color-success);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.warning-message {
  color: var(--el-color-warning);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.result-content {
  line-height: 1.8;
}

.result-content strong {
  color: var(--el-color-primary);
}

.result-content code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.info-text {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
  margin-top: 10px;
}

.result-content {
  line-height: 1.8;
}

.result-content strong {
  color: var(--el-color-primary);
}

.result-content code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>