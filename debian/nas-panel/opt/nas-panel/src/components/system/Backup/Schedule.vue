<template>
  <div class="schedule-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon size="24">
            <Icon icon="mdi:calendar-clock" />
          </el-icon>
          <span>{{ $t('backup.schedule') }}</span>
        </div>
      </template>

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
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
    ElMessage.error(t('backup.schedule_load_error'))
  }
}

const saveSchedule = async () => {
  isSaving.value = true;
  try {
    const payload = {
      schedule: {
        type: scheduleForm.value.type,
        retention: scheduleForm.value.retention
      }
    };

    if (scheduleForm.value.type === 'daily') {
      payload.schedule.daily_time = scheduleForm.value.dailyTime;
    } 
    else if (scheduleForm.value.type === 'weekly') {
      payload.schedule.weekly_day = scheduleForm.value.weeklyDay;
      payload.schedule.weekly_time = scheduleForm.value.weeklyTime;
    } 
    else if (scheduleForm.value.type === 'monthly') {
      payload.schedule.monthly_day = scheduleForm.value.monthlyDay;
      payload.schedule.monthly_time = scheduleForm.value.monthlyTime;
    }

    const response = await axios.post('/api/system/backup/schedule', payload);
    //schedule, command, name, description
    await axios.post('/system/cron-jobs', {
      name: 'Backup Schedule',
      description: t('backup.schedule_description'),
      job: 'backup_schedule',
      command: `/usr/bin/nas-backup --type ${scheduleForm.value.type}`,
      schedule: scheduleForm.value.type === 'daily' ? `0 ${scheduleForm.value.dailyTime.split(':')[1]} ${scheduleForm.value.dailyTime.split(':')[0]} * * *` :
                scheduleForm.value.type === 'weekly' ? `0 ${scheduleForm.value.weeklyTime.split(':')[1]} ${scheduleForm.value.weeklyTime.split(':')[0]} * * ${scheduleForm.value.weeklyDay}` :
                scheduleForm.value.type === 'monthly' ? `0 ${scheduleForm.value.monthlyTime.split(':')[1]} ${scheduleForm.value.monthlyTime.split(':')[0]} ${scheduleForm.value.monthlyDay} * *` :
                '0 0 * * *'
    });
    
    ElMessage.success(t('backup.schedule_saved'));
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || 
                    error.response?.data?.message || 
                    t('backup.schedule_save_error');
    ElMessage.error(errorMsg);
    throw error;
  } finally {
    isSaving.value = false;
  }
};

onMounted(loadSchedule)
</script>

<style scoped>
.schedule-container {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
</style>
