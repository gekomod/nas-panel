<template>
  <div class="cron-jobs">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:clock-outline" />
          </el-icon>
          <span>{{ $t('cronJobs.title') }}</span>
        </div>
      </template>

      <div class="actions">
        <el-button type="primary" @click="showAddDialog">
          <el-icon class="el-icon--left"><Plus /></el-icon>
          {{ $t('cronJobs.addJob') }}
        </el-button>
      </div>

      <el-table 
        :data="jobs" 
        v-loading="loading"
        empty-text="No cron jobs"
        style="width: 100%"
      >
        <el-table-column prop="name" :label="$t('cronJobs.name')" />
        <el-table-column :label="$t('cronJobs.schedule')">
          <template #default="{row}">
            <el-tag>{{ row.schedule }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="$t('cronJobs.description')" />
        <el-table-column :label="$t('cronJobs.command')" width="300">
          <template #default="{row}">
            <el-text truncated>{{ row.command }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column :label="$t('cronJobs.status')">
  <template #default="{row}">
    <el-tag 
      :type="row.isActive ? 'success' : 'info'"
      :class="{'system-job': row.isSystemJob}"
    >
      {{ row.isActive ? $t('cronJobs.active') : $t('cronJobs.inactive') }}
      <el-icon v-if="row.isSystemJob" class="system-icon">
        <Icon icon="mdi:shield-check" />
      </el-icon>
    </el-tag>
  </template>
</el-table-column>

        <el-table-column :label="$t('cronJobs.lastRun')">
          <template #default="{row}">
            {{ row.lastRun ? formatDate(row.lastRun) : 'N/A' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('cronJobs.nextRun')">
          <template #default="{row}">
            {{ row.nextRun ? formatDate(row.nextRun) : 'N/A' }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('cronJobs.actions')" width="180">
          <template #default="{row}">
            <el-button 
              size="small" 
              @click="runJob(row.id)"
              :loading="runningJobs[row.id]"
            >
              {{ $t('cronJobs.run') }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteJob(row.id)"
            >
              {{ $t('cronJobs.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog dodawania nowego zadania -->
    <el-dialog v-model="addDialogVisible" :title="$t('cronJobs.addJob')">
      <el-form :model="newJob" label-position="top">
        <el-form-item :label="$t('cronJobs.name')" required>
          <el-input v-model="newJob.name" />
        </el-form-item>
        <el-form-item :label="$t('cronJobs.schedule')" required>
          <el-input v-model="newJob.schedule" placeholder="* * * * *">
            <template #append>
              <el-button @click="showCronHelp = true">
                <Icon icon="mdi:help-circle" />
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="$t('cronJobs.command')" required>
          <el-input 
            v-model="newJob.command" 
            type="textarea" 
            :rows="3"
            placeholder="np: curl http://example.com/api/ping"
          />
        </el-form-item>
        <el-form-item :label="$t('cronJobs.description')">
          <el-input v-model="newJob.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="addJob"
          :loading="addingJob"
        >
          {{ $t('common.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Pomoc dla składni cron -->
    <el-dialog v-model="showCronHelp" title="Składnia cron">
      <div class="cron-help">
        <p>Przykładowe formaty:</p>
        <ul>
          <li><strong>* * * * *</strong> - co minutę</li>
          <li><strong>*/5 * * * *</strong> - co 5 minut</li>
          <li><strong>0 * * * *</strong> - co godzinę</li>
          <li><strong>0 0 * * *</strong> - codziennie o północy</li>
          <li><strong>0 0 * * 0</strong> - co niedzielę o północy</li>
        </ul>
        <p>Kolejność pól: minuta (0-59), godzina (0-23), dzień miesiąca (1-31), miesiąc (1-12), dzień tygodnia (0-7, gdzie 0 i 7 to niedziela)</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

import { useNotifications } from '@/services/NotificationService'

const { addNotification } = useNotifications()

// Import tłumaczeń
import enLocales from './locales/en'
import plLocales from './locales/pl'

const { t, mergeLocaleMessage } = useI18n()

// Dodaj tłumaczenia do i18n
mergeLocaleMessage('en', enLocales)
mergeLocaleMessage('pl', plLocales)

const jobs = ref([])
const loading = ref(false)
const addDialogVisible = ref(false)
const showCronHelp = ref(false)
const addingJob = ref(false)
const runningJobs = ref({})

const newJob = ref({
  name: '',
  schedule: '',
  command: '',
  description: ''
})

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString()
}

const fetchJobs = async () => {
  loading.value = true;
  try {
    const response = await axios.get('/system/cron-jobs');
    jobs.value = response.data.map(job => ({
      ...job,
      nextRun: job.nextRun ? new Date(job.nextRun) : null,
      lastRun: job.lastRun ? new Date(job.lastRun) : null,
      isActive: job.isActive !== undefined ? job.isActive : true // Domyślnie aktywny
    }));
  } catch (error) {
    ElMessage.error(t('cronJobs.fetchError'));
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const showAddDialog = () => {
  newJob.value = {
    name: '',
    schedule: '',
    command: '',
    description: ''
  }
  addDialogVisible.value = true
}

const addJob = async () => {
  addingJob.value = true
  try {
    await axios.post('/system/cron-jobs', newJob.value)

  addNotification({
    title: 'Cron Job Added',
    message: 'A new cron job has been successfully added.',
    type: 'success'
  })
  
    ElMessage.success('Job added successfully')
    addDialogVisible.value = false
    await fetchJobs()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || 'Failed to add job')
  } finally {
    addingJob.value = false
  }
}

const deleteJob = async (id) => {
  try {
    const job = jobs.value.find(j => j.id === id);
    if (job?.isSystemJob) {
      ElMessage.warning('System jobs cannot be deleted');
      return;
    }

    await ElMessageBox.confirm(
      'Are you sure you want to delete this cron job?',
      'Confirm',
      { type: 'warning' }
    )
    await axios.delete(`/system/cron-jobs/${id}`)
    ElMessage.success('Job deleted')
    await fetchJobs()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete job')
    }
  }
}

const runJob = async (id) => {
  runningJobs.value[id] = true
  try {
    await axios.post(`/system/cron-jobs/${id}/run`)
    ElMessage.success('Job executed')
    await fetchJobs()
  } catch (error) {
    ElMessage.error('Job execution failed')
  } finally {
    runningJobs.value[id] = false
  }
}

onMounted(() => {
  fetchJobs()
})

</script>

<style scoped>
.cron-jobs {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.actions {
  margin-bottom: 20px;
}

.cron-help {
  line-height: 1.6;
}

.system-job {
  background-color: #f0f9ff;
  border-color: #d9ecff;
  color: #409eff;
}

.system-icon {
  margin-left: 5px;
  vertical-align: middle;
}
</style>
