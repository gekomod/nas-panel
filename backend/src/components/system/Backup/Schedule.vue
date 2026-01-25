<template>
  <div class="schedule-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:calendar-clock" />
          </div>
          <div class="header-text">
            <h1>{{ $t('backup.schedule') }}</h1>
            <p class="subtitle">Harmonogram automatycznych kopii zapasowych</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="scheduleForm.type === 'disabled' ? 'danger' : 'default'"
              @click="scheduleForm.type = 'disabled'"
            >
              <Icon icon="mdi:calendar-remove" />
              Wyłączony
            </el-button>
            <el-button 
              :type="scheduleForm.type === 'daily' ? 'primary' : 'default'"
              @click="scheduleForm.type = 'daily'"
            >
              <Icon icon="mdi:calendar-today" />
              Codziennie
            </el-button>
            <el-button 
              :type="scheduleForm.type === 'weekly' ? 'primary' : 'default'"
              @click="scheduleForm.type = 'weekly'"
            >
              <Icon icon="mdi:calendar-week" />
              Co tydzień
            </el-button>
            <el-button 
              :type="scheduleForm.type === 'monthly' ? 'primary' : 'default'"
              @click="scheduleForm.type = 'monthly'"
            >
              <Icon icon="mdi:calendar-month" />
              Co miesiąc
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="schedule-content">
      <!-- Schedule Settings Card -->
      <el-card class="settings-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:cog" />
              Ustawienia harmonogramu
              <el-tag :type="scheduleForm.type === 'disabled' ? 'danger' : 'success'" size="small">
                {{ scheduleForm.type === 'disabled' ? 'Wyłączony' : 'Aktywny' }}
              </el-tag>
            </h2>
          </div>
        </template>

        <el-form 
          :model="scheduleForm" 
          label-position="top"
          @submit.prevent="saveSchedule"
          class="schedule-form"
        >
          <div class="form-section">
            <h3 class="section-title">Konfiguracja harmonogramu</h3>
            
            <div v-if="scheduleForm.type !== 'disabled'" class="schedule-details">
              <template v-if="scheduleForm.type === 'daily'">
                <el-form-item label="Godzina wykonania" required>
                  <el-time-picker
                    v-model="scheduleForm.dailyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="Wybierz godzinę"
                    class="custom-time-picker"
                  />
                  <span class="input-description">Godzina o której codziennie będzie tworzona kopia zapasowa</span>
                </el-form-item>
              </template>

              <template v-else-if="scheduleForm.type === 'weekly'">
                <el-form-item label="Dzień tygodnia" required>
                  <div class="week-days">
                    <el-card 
                      v-for="day in weekDays" 
                      :key="day.value"
                      :class="['day-card', { 'selected': scheduleForm.weeklyDay === day.value }]"
                      @click="scheduleForm.weeklyDay = day.value"
                      shadow="hover"
                    >
                      <div class="day-content">
                        <div class="day-icon">
                          <Icon :icon="getDayIcon(day.value)" />
                        </div>
                        <h4>{{ day.text }}</h4>
                      </div>
                    </el-card>
                  </div>
                  <span class="input-description">Wybierz dzień tygodnia dla cotygodniowej kopii</span>
                </el-form-item>

                <el-form-item label="Godzina wykonania" required>
                  <el-time-picker
                    v-model="scheduleForm.weeklyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="Wybierz godzinę"
                    class="custom-time-picker"
                  />
                  <span class="input-description">Godzina o której co tydzień będzie tworzona kopia zapasowa</span>
                </el-form-item>
              </template>

              <template v-else-if="scheduleForm.type === 'monthly'">
                <el-form-item label="Dzień miesiąca" required>
                  <div class="month-days">
                    <el-card 
                      v-for="day in monthDays" 
                      :key="day"
                      :class="['month-day-card', { 'selected': scheduleForm.monthlyDay === day }]"
                      @click="scheduleForm.monthlyDay = day"
                      shadow="hover"
                    >
                      <div class="month-day-content">
                        <span class="day-number">{{ day }}</span>
                      </div>
                    </el-card>
                  </div>
                  <el-input-number
                    v-model="scheduleForm.monthlyDay"
                    :min="1"
                    :max="31"
                    controls-position="right"
                    class="month-day-input"
                  />
                  <span class="input-description">Wybierz dzień miesiąca dla comiesięcznej kopii (1-31)</span>
                </el-form-item>

                <el-form-item label="Godzina wykonania" required>
                  <el-time-picker
                    v-model="scheduleForm.monthlyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    placeholder="Wybierz godzinę"
                    class="custom-time-picker"
                  />
                  <span class="input-description">Godzina o której co miesiąc będzie tworzona kopia zapasowa</span>
                </el-form-item>
              </template>
            </div>

            <div v-else class="disabled-message">
              <el-card shadow="never" class="info-card">
                <div class="info-content">
                  <Icon icon="mdi:information-outline" class="info-icon" />
                  <div class="info-text">
                    <h4>Harmonogram wyłączony</h4>
                    <p>Automatyczne kopie zapasowe nie będą tworzone. Włącz harmonogram, aby skonfigurować automatyczne tworzenie kopii.</p>
                  </div>
                </div>
              </el-card>
            </div>
          </div>

          <div v-if="scheduleForm.type !== 'disabled'" class="form-section">
            <h3 class="section-title">Polityka przechowywania</h3>
            
            <el-form-item label="Okres przechowywania">
              <div class="retention-options">
                <el-card 
                  v-for="option in retentionOptions" 
                  :key="option.value"
                  :class="['retention-card', { 'selected': scheduleForm.retention === option.value }]"
                  @click="scheduleForm.retention = option.value"
                  shadow="hover"
                >
                  <div class="retention-content">
                    <div class="retention-icon" :style="{ backgroundColor: getRetentionColor(option.value) }">
                      <Icon :icon="getRetentionIcon(option.value)" />
                    </div>
                    <div class="retention-info">
                      <h4>{{ option.text }}</h4>
                      <p class="retention-desc">{{ getRetentionDescription(option.value) }}</p>
                    </div>
                  </div>
                </el-card>
              </div>
              <span class="input-description">Okres czasu, przez który kopie będą przechowywane przed automatycznym usunięciem</span>
            </el-form-item>
          </div>

          <div v-if="scheduleForm.type !== 'disabled'" class="form-section">
            <h3 class="section-title">Podgląd harmonogramu</h3>
            
            <el-card shadow="never" class="preview-card">
              <div class="preview-content">
                <div class="preview-icon">
                  <Icon icon="mdi:calendar-check" />
                </div>
                <div class="preview-details">
                  <h4>Następna zaplanowana kopia:</h4>
                  <p class="preview-time">{{ calculateNextBackup() }}</p>
                  <p class="preview-description">{{ getScheduleDescription() }}</p>
                  <div class="preview-info">
                    <div class="info-item">
                      <Icon icon="mdi:clock-outline" />
                      <span>Godzina: {{ getScheduleTime() }}</span>
                    </div>
                    <div class="info-item">
                      <Icon icon="mdi:calendar-outline" />
                      <span>Częstotliwość: {{ getScheduleFrequency() }}</span>
                    </div>
                    <div class="info-item">
                      <Icon icon="mdi:database-clock" />
                      <span>Przechowywanie: {{ getRetentionText() }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </div>

          <div class="form-actions">
            <el-button 
              type="primary" 
              native-type="submit"
              :loading="isSaving"
              class="save-button"
            >
              <Icon icon="mdi:content-save-check" />
              Zapisz harmonogram
            </el-button>
            <el-button 
              @click="resetSchedule"
              :disabled="isSaving"
            >
              <Icon icon="mdi:restore" />
              Przywróć domyślne
            </el-button>
          </div>
        </el-form>
      </el-card>

      <!-- Next Backups Card -->
      <el-card class="next-backups-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:calendar-arrow-right" />
              Nadchodzące kopie
            </h2>
          </div>
        </template>

        <div v-if="scheduleForm.type === 'disabled'" class="disabled-message">
          <p>Harmonogram jest wyłączony. Brak nadchodzących kopii.</p>
        </div>

        <div v-else class="next-backups-list">
          <div 
            v-for="(backup, index) in upcomingBackups" 
            :key="index"
            class="next-backup-item"
          >
            <div class="backup-number">
              <span class="number">{{ index + 1 }}</span>
            </div>
            <div class="backup-info">
              <h4>Kopia #{{ index + 1 }}</h4>
              <p class="backup-date">{{ backup.date }}</p>
              <p class="backup-time">Godzina: {{ backup.time }}</p>
            </div>
            <div class="backup-status">
              <el-tag type="info" size="small" effect="plain">
                Zaplanowana
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Stats Card -->
    <el-card class="stats-card" shadow="hover">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-icon stat-status" :style="{ background: scheduleStatusColor }">
            <Icon :icon="scheduleStatusIcon" />
          </div>
          <div class="stat-info">
            <h3>{{ scheduleStatusText }}</h3>
            <p>Status harmonogramu</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-frequency">
            <Icon :icon="scheduleFrequencyIcon" />
          </div>
          <div class="stat-info">
            <h3>{{ scheduleFrequencyText }}</h3>
            <p>Częstotliwość</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-time">
            <Icon icon="mdi:clock-outline" />
          </div>
          <div class="stat-info">
            <h3>{{ getScheduleTime() || '--:--' }}</h3>
            <p>Godzina wykonania</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-retention">
            <Icon icon="mdi:database-clock" />
          </div>
          <div class="stat-info">
            <h3>{{ getRetentionText() }}</h3>
            <p>Przechowywanie</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Schedule Form
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

const weekDays = [
  { value: 'monday', text: t('weekdays.monday') },
  { value: 'tuesday', text: t('weekdays.tuesday') },
  { value: 'wednesday', text: t('weekdays.wednesday') },
  { value: 'thursday', text: t('weekdays.thursday') },
  { value: 'friday', text: t('weekdays.friday') },
  { value: 'saturday', text: t('weekdays.saturday') },
  { value: 'sunday', text: t('weekdays.sunday') }
]

const monthDays = Array.from({ length: 31 }, (_, i) => i + 1)

const retentionOptions = [
  { value: '7d', text: t('backup.retention_options.7d') },
  { value: '14d', text: t('backup.retention_options.14d') },
  { value: '30d', text: t('backup.retention_options.30d') },
  { value: '90d', text: t('backup.retention_options.90d') },
  { value: '1y', text: t('backup.retention_options.1y') },
  { value: 'forever', text: t('backup.retention_options.forever') }
]

// Computed properties
const scheduleStatusText = computed(() => {
  return scheduleForm.value.type === 'disabled' ? 'Wyłączony' : 'Aktywny'
})

const scheduleStatusColor = computed(() => {
  return scheduleForm.value.type === 'disabled' 
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
})

const scheduleStatusIcon = computed(() => {
  return scheduleForm.value.type === 'disabled' 
    ? 'mdi:calendar-remove'
    : 'mdi:calendar-check'
})

const scheduleFrequencyText = computed(() => {
  switch(scheduleForm.value.type) {
    case 'daily': return 'Codziennie'
    case 'weekly': return 'Co tydzień'
    case 'monthly': return 'Co miesiąc'
    default: return 'Brak'
  }
})

const scheduleFrequencyIcon = computed(() => {
  switch(scheduleForm.value.type) {
    case 'daily': return 'mdi:calendar-today'
    case 'weekly': return 'mdi:calendar-week'
    case 'monthly': return 'mdi:calendar-month'
    default: return 'mdi:calendar-blank'
  }
})

const upcomingBackups = computed(() => {
  if (scheduleForm.value.type === 'disabled') return []
  
  const backups = []
  const now = new Date()
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(now)
    
    switch(scheduleForm.value.type) {
      case 'daily':
        date.setDate(date.getDate() + i + 1)
        date.setHours(scheduleForm.value.dailyTime.split(':')[0])
        date.setMinutes(scheduleForm.value.dailyTime.split(':')[1])
        break
        
      case 'weekly':
        const dayMap = {
          monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
          friday: 5, saturday: 6, sunday: 0
        }
        const targetDay = dayMap[scheduleForm.value.weeklyDay] || 1
        const currentDay = date.getDay()
        
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) {
          daysToAdd += 7
        }
        daysToAdd += (i * 7)
        
        date.setDate(date.getDate() + daysToAdd)
        date.setHours(scheduleForm.value.weeklyTime.split(':')[0])
        date.setMinutes(scheduleForm.value.weeklyTime.split(':')[1])
        break
        
      case 'monthly':
        date.setMonth(date.getMonth() + i + 1)
        date.setDate(scheduleForm.value.monthlyDay)
        date.setHours(scheduleForm.value.monthlyTime.split(':')[0])
        date.setMinutes(scheduleForm.value.monthlyTime.split(':')[1])
        break
    }
    
    backups.push({
      date: date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      datetime: date
    })
  }
  
  return backups
})

// Methods
const getDayIcon = (day) => {
  const icons = {
    monday: 'mdi:calendar-week-begin',
    tuesday: 'mdi:calendar-week',
    wednesday: 'mdi:calendar-week',
    thursday: 'mdi:calendar-week',
    friday: 'mdi:calendar-week-end',
    saturday: 'mdi:calendar-weekend',
    sunday: 'mdi:calendar-weekend'
  }
  return icons[day] || 'mdi:calendar'
}

const getRetentionIcon = (retention) => {
  const icons = {
    '7d': 'mdi:calendar-week',
    '14d': 'mdi:calendar-blank',
    '30d': 'mdi:calendar-month',
    '90d': 'mdi:calendar-quarter',
    '1y': 'mdi:calendar-year',
    'forever': 'mdi:calendar-star'
  }
  return icons[retention] || 'mdi:calendar-clock'
}

const getRetentionColor = (retention) => {
  const colors = {
    '7d': '#f59e0b',
    '14d': '#3b82f6',
    '30d': '#10b981',
    '90d': '#8b5cf6',
    '1y': '#ef4444',
    'forever': '#6366f1'
  }
  return colors[retention] || '#6b7280'
}

const getRetentionDescription = (retention) => {
  const descriptions = {
    '7d': '7 dni',
    '14d': '2 tygodnie',
    '30d': '1 miesiąc',
    '90d': '3 miesiące',
    '1y': '1 rok',
    'forever': 'Bez ograniczeń'
  }
  return descriptions[retention] || retention
}

const getRetentionText = () => {
  return scheduleForm.value.retention ? getRetentionDescription(scheduleForm.value.retention) : 'Nie ustawiono'
}

const calculateNextBackup = () => {
  if (scheduleForm.value.type === 'disabled') return 'Brak harmonogramu'
  
  const now = new Date()
  const next = new Date(now)
  
  switch(scheduleForm.value.type) {
    case 'daily':
      next.setHours(scheduleForm.value.dailyTime.split(':')[0])
      next.setMinutes(scheduleForm.value.dailyTime.split(':')[1])
      next.setSeconds(0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      break
      
    case 'weekly':
      const dayMap = {
        monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
        friday: 5, saturday: 6, sunday: 0
      }
      next.setHours(scheduleForm.value.weeklyTime.split(':')[0])
      next.setMinutes(scheduleForm.value.weeklyTime.split(':')[1])
      next.setSeconds(0)
      
      const targetDay = dayMap[scheduleForm.value.weeklyDay] || 1
      const currentDay = next.getDay()
      
      let daysToAdd = targetDay - currentDay
      if (daysToAdd < 0 || (daysToAdd === 0 && next <= now)) {
        daysToAdd += 7
      }
      
      next.setDate(next.getDate() + daysToAdd)
      break
      
    case 'monthly':
      next.setHours(scheduleForm.value.monthlyTime.split(':')[0])
      next.setMinutes(scheduleForm.value.monthlyTime.split(':')[1])
      next.setSeconds(0)
      next.setDate(scheduleForm.value.monthlyDay)
      
      if (next <= now) {
        next.setMonth(next.getMonth() + 1)
      }
      break
  }
  
  return next.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getScheduleDescription = () => {
  switch(scheduleForm.value.type) {
    case 'daily':
      return `Codziennie o ${scheduleForm.value.dailyTime}`
    case 'weekly':
      return `Co tydzień w ${t(`weekdays.${scheduleForm.value.weeklyDay}`)} o ${scheduleForm.value.weeklyTime}`
    case 'monthly':
      return `Co miesiąc ${scheduleForm.value.monthlyDay}. dnia o ${scheduleForm.value.monthlyTime}`
    default:
      return 'Harmonogram wyłączony'
  }
}

const getScheduleTime = () => {
  switch(scheduleForm.value.type) {
    case 'daily': return scheduleForm.value.dailyTime
    case 'weekly': return scheduleForm.value.weeklyTime
    case 'monthly': return scheduleForm.value.monthlyTime
    default: return null
  }
}

const getScheduleFrequency = () => {
  switch(scheduleForm.value.type) {
    case 'daily': return 'Codziennie'
    case 'weekly': return 'Co tydzień'
    case 'monthly': return 'Co miesiąc'
    default: return 'Brak'
  }
}

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
    console.error('Error loading schedule:', error)
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
    
    ElMessage.success('Harmonogram został zapisany')
    
  } catch (error) {
    ElMessage.error(error.response?.data?.message || 'Błąd podczas zapisywania harmonogramu')
  } finally {
    isSaving.value = false
  }
}

const resetSchedule = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz przywrócić domyślne ustawienia harmonogramu?',
      'Potwierdzenie resetu',
      {
        confirmButtonText: 'Przywróć',
        cancelButtonText: 'Anuluj',
        type: 'warning'
      }
    )
    
    scheduleForm.value = {
      type: 'disabled',
      dailyTime: '02:00',
      weeklyDay: 'monday',
      weeklyTime: '02:00',
      monthlyDay: 1,
      monthlyTime: '02:00',
      retention: '30d'
    }
    
    ElMessage.success('Przywrócono domyślne ustawienia')
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas resetowania harmonogramu')
    }
  }
}

onMounted(() => {
  loadSchedule()
})
</script>

<style scoped>
.schedule-dashboard {
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dashboard-header {
  background: white;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.header-actions .el-button-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.header-actions .el-button {
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.schedule-content {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-card,
.next-backups-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.settings-card:hover,
.next-backups-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.card-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 600;
}

.schedule-form {
  padding: 24px;
}

.form-section {
  margin-bottom: 32px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.input-description {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.custom-time-picker {
  width: 200px;
}

/* Week Days */
.week-days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.day-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
}

.day-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.day-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.day-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
}

.day-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #3b82f6;
  font-size: 20px;
}

.day-content h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

/* Month Days */
.month-days {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.month-day-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 8px;
  background: white;
  text-align: center;
}

.month-day-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.month-day-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.month-day-content {
  padding: 8px;
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.month-day-input {
  width: 200px;
  margin-top: 12px;
}

/* Retention Options */
.retention-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.retention-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
}

.retention-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.retention-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.retention-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.retention-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: white;
  font-size: 22px;
  flex-shrink: 0;
}

.retention-info {
  flex: 1;
}

.retention-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.retention-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

/* Preview Card */
.preview-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
}

.preview-content {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.preview-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 12px;
  color: white;
  font-size: 28px;
}

.preview-details h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #1e293b;
}

.preview-time {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #3b82f6;
}

.preview-description {
  margin: 0 0 16px;
  color: #64748b;
  font-size: 14px;
}

.preview-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.info-item svg {
  color: #64748b;
}

/* Disabled Message */
.disabled-message {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.info-card {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.info-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.info-icon {
  color: #64748b;
  font-size: 32px;
  flex-shrink: 0;
}

.info-text h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #1e293b;
}

.info-text p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* Next Backups List */
.next-backups-list {
  padding: 16px;
}

.next-backup-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.next-backup-item:hover {
  background-color: #f8fafc;
}

.next-backup-item:last-child {
  border-bottom: none;
}

.backup-number {
  flex-shrink: 0;
}

.number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
}

.backup-info {
  flex: 1;
}

.backup-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: #1e293b;
}

.backup-date {
  margin: 0 0 4px;
  font-size: 14px;
  color: #475569;
}

.backup-time {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.backup-status {
  flex-shrink: 0;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px 24px 0;
  border-top: 1px solid #f1f5f9;
}

.save-button {
  padding: 12px 32px;
  border-radius: 10px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
}

.save-button:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

/* Stats Card */
.stats-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 20px;
}

.stats-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  padding: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 28px;
  color: white;
  flex-shrink: 0;
}

.stat-status {
  /* Dynamically set */
}

.stat-frequency {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-time {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-retention {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-info h3 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.stat-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    overflow-x: auto;
  }
  
  .header-actions .el-button-group {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;
    -webkit-overflow-scrolling: touch;
  }
  
  .week-days {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .retention-options {
    grid-template-columns: 1fr;
  }
  
  .preview-content {
    flex-direction: column;
    text-align: center;
  }
  
  .preview-info {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .el-button {
    width: 100%;
  }
  
  .stats-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .week-days {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .month-days {
    grid-template-columns: repeat(7, 1fr);
  }
}

/* Card hover effects */
.settings-card:hover,
.next-backups-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

/* Animation for selected items */
.day-card.selected,
.month-day-card.selected,
.retention-card.selected {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}
</style>
