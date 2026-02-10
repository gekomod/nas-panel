<template>
  <div class="cron-jobs-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:clock-outline" />
          </div>
          <div class="header-text">
            <h1>{{ $t('cronJobs.title') }}</h1>
            <p class="subtitle">{{ $t('cronJobs.subtitle') || 'Zarządzaj zaplanowanymi zadaniami systemowymi' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button 
            type="primary" 
            @click="showAddDialog"
            :loading="addingJob"
          >
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            {{ $t('cronJobs.addJob') }}
          </el-button>
          <el-button 
            @click="fetchJobs"
            :loading="loading"
            plain
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            {{ $t('common.refresh') || 'Odśwież' }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Stats Card -->
    <el-card class="stats-card" shadow="hover">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-icon stat-total">
            <Icon icon="mdi:clock" />
          </div>
          <div class="stat-info">
            <h3>{{ totalJobs }}</h3>
            <p>Wszystkie zadania</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-active">
            <Icon icon="mdi:play-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ activeJobs }}</h3>
            <p>Aktywne zadania</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-inactive">
            <Icon icon="mdi:pause-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ inactiveJobs }}</h3>
            <p>Nieaktywne zadania</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-system">
            <Icon icon="mdi:shield-check" />
          </div>
          <div class="stat-info">
            <h3>{{ systemJobs }}</h3>
            <p>Zadania systemowe</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="cron-content">
      <!-- Actions Card -->
      <el-card class="actions-card" shadow="hover">
        <div class="actions-content">
          <div class="actions-info">
            <h3>Filtry i akcje</h3>
            <p>Zarządzaj widocznością i stanem zadań</p>
          </div>
          <div class="actions-filters">
            <el-select 
              v-model="statusFilter" 
              placeholder="Status" 
              clearable
              @change="handleFilterChange"
            >
              <el-option label="Wszystkie" value="all" />
              <el-option label="Aktywne" value="active" />
              <el-option label="Nieaktywne" value="inactive" />
              <el-option label="Systemowe" value="system" />
              <el-option label="Użytkownika" value="user" />
            </el-select>
            <el-input
              v-model="searchQuery"
              placeholder="Szukaj po nazwie lub komendzie..."
              clearable
              @input="handleSearch"
              class="search-input"
            >
              <template #prefix>
                <el-icon><Icon icon="mdi:magnify" /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </el-card>

      <!-- Jobs List Card -->
      <el-card class="jobs-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:list-box-outline" />
              Lista zadań cron
              <el-tag v-if="filteredJobs.length !== totalJobs" size="small" type="info">
                Pokazano {{ filteredJobs.length }} z {{ totalJobs }}
              </el-tag>
            </h2>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>Ładowanie zadań...</p>
        </div>

        <el-empty 
          v-else-if="filteredJobs.length === 0" 
          :description="emptyMessage" 
          class="empty-state"
        >
          <template #image>
            <Icon icon="mdi:clock-off-outline" width="120" height="120" />
          </template>
          <template #extra>
            <el-button type="primary" @click="showAddDialog">
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Dodaj pierwsze zadanie
            </el-button>
          </template>
        </el-empty>

        <div v-else class="jobs-list">
          <div 
            v-for="job in paginatedJobs" 
            :key="job.id"
            :class="['job-item', { 'system-job': job.isSystemJob, 'inactive': !job.isActive }]"
          >
            <div class="job-icon">
              <el-icon 
                :size="24"
                :color="job.isSystemJob ? '#8b5cf6' : job.isActive ? '#10b981' : '#64748b'"
              >
                <Icon :icon="job.isSystemJob ? 'mdi:shield-check' : job.isActive ? 'mdi:play-circle' : 'mdi:pause-circle'" />
              </el-icon>
            </div>
            <div class="job-content">
              <div class="job-header">
                <div class="job-title">
                  <h4>
                    {{ job.name }}
                    <el-tag 
                      v-if="job.isSystemJob" 
                      size="mini" 
                      type="info" 
                      effect="plain"
                      class="system-tag"
                    >
                      <el-icon size="12"><Icon icon="mdi:shield" /></el-icon>
                      System
                    </el-tag>
                  </h4>
                  <div class="job-schedule">
                    <el-tag :type="job.isActive ? 'success' : 'info'">
                      {{ job.schedule }}
                    </el-tag>
                  </div>
                </div>
                <div class="job-meta">
                  <span class="job-time" :title="formatFullDate(job.nextRun)" v-if="job.nextRun">
                    <Icon icon="mdi:calendar-clock" />
                    Następne: {{ formatRelativeTime(job.nextRun) }}
                  </span>
                  <span class="job-time" :title="formatFullDate(job.lastRun)" v-if="job.lastRun">
                    <Icon icon="mdi:history" />
                    Ostatnio: {{ formatRelativeTime(job.lastRun) }}
                  </span>
                </div>
              </div>
              <div class="job-description">
                <p>{{ job.description || 'Brak opisu' }}</p>
              </div>
              <div class="job-command">
                <el-text truncated type="info">
                  <code>{{ job.command }}</code>
                </el-text>
                <el-tooltip content="Kopiuj komendę">
                  <el-button 
                    size="small" 
                    text 
                    @click="copyToClipboard(job.command)"
                  >
                    <el-icon><Icon icon="mdi:content-copy" /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </div>
            <div class="job-actions">
              <el-tooltip content="Uruchom teraz">
                <el-button 
                  size="small" 
                  circle 
                  @click="runJob(job.id)"
                  :loading="runningJobs[job.id]"
                  :disabled="job.isSystemJob && !job.isActive"
                >
                  <el-icon><Icon icon="mdi:play" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip :content="job.isActive ? 'Wyłącz' : 'Włącz'">
                <el-button 
                  size="small" 
                  circle 
                  :type="job.isActive ? 'warning' : 'success'"
                  @click="toggleJob(job.id)"
                  :disabled="job.isSystemJob"
                >
                  <el-icon>
                    <Icon :icon="job.isActive ? 'mdi:pause' : 'mdi:play'" />
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="Edytuj" v-if="!job.isSystemJob">
                <el-button 
                  size="small" 
                  circle 
                  type="primary"
                  @click="editJob(job)"
                >
                  <el-icon><Icon icon="mdi:pencil" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="Usuń">
                <el-button 
                  size="small" 
                  circle 
                  type="danger"
                  @click="deleteJob(job.id)"
                  :disabled="job.isSystemJob"
                >
                  <el-icon><Icon icon="mdi:delete" /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </div>

        <div v-if="!loading && filteredJobs.length > 0" class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="filteredJobs.length"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </el-card>
    </div>

    <!-- Dialog dodawania/edycji zadania -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form 
        :model="currentJob" 
        label-position="top"
        :rules="rules"
        ref="jobForm"
      >
        <el-form-item :label="$t('cronJobs.name')" prop="name">
          <el-input 
            v-model="currentJob.name" 
            placeholder="Nazwa zadania"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item :label="$t('cronJobs.schedule')" prop="schedule">
          <el-input 
            v-model="currentJob.schedule" 
            placeholder="* * * * *"
            class="schedule-input"
          >
            <template #append>
              <el-button @click="showCronHelp = true">
                <Icon icon="mdi:help-circle" />
                Pomoc
              </el-button>
              <el-button 
                v-if="currentJob.schedule"
                @click="validateSchedule(currentJob.schedule)"
              >
                <Icon icon="mdi:check" />
                Sprawdź
              </el-button>
            </template>
          </el-input>
          <div class="schedule-preview" v-if="currentJob.schedule && scheduleValid">
            <el-text type="success">
              <Icon icon="mdi:check-circle" />
              Następne wykonanie: {{ nextRunPreview }}
            </el-text>
          </div>
          <div class="schedule-error" v-if="currentJob.schedule && !scheduleValid">
            <el-text type="danger">
              <Icon icon="mdi:alert-circle" />
              Nieprawidłowy format cron
            </el-text>
          </div>
        </el-form-item>
        
        <el-form-item :label="$t('cronJobs.command')" prop="command">
          <el-input 
            v-model="currentJob.command" 
            type="textarea" 
            :rows="3"
            placeholder="np: curl http://example.com/api/ping"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item :label="$t('cronJobs.description')">
          <el-input 
            v-model="currentJob.description" 
            type="textarea" 
            :rows="2"
            placeholder="Opis zadania (opcjonalnie)"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item v-if="!isEditMode">
          <el-checkbox v-model="currentJob.isActive">
            Aktywuj zadanie od razu
          </el-checkbox>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="saveJob"
          :loading="savingJob"
          :disabled="!scheduleValid"
        >
          {{ isEditMode ? $t('common.save') : $t('common.add') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Pomoc dla składni cron -->
    <el-dialog v-model="showCronHelp" title="Składnia cron" width="500px">
      <div class="cron-help">
        <h4>Format: <code>* * * * *</code></h4>
        <p>Kolejność pól: <strong>minuta godzina dzień-miesiąca miesiąc dzień-tygodnia</strong></p>
        
        <el-divider />
        
        <h5>Przykłady:</h5>
        <ul>
          <li><code>* * * * *</code> - co minutę</li>
          <li><code>*/5 * * * *</code> - co 5 minut</li>
          <li><code>0 * * * *</code> - co godzinę (o pełnej godzinie)</li>
          <li><code>0 0 * * *</code> - codziennie o północy</li>
          <li><code>0 0 * * 0</code> - co niedzielę o północy</li>
          <li><code>0 9-17 * * 1-5</code> - co godzinę od 9:00 do 17:00 w dni robocze</li>
          <li><code>0 0 1 * *</code> - pierwszego dnia każdego miesiąca</li>
        </ul>
        
        <el-divider />
        
        <h5>Specjalne wartości:</h5>
        <ul>
          <li><code>@yearly</code> - raz w roku (0 0 1 1 *)</li>
          <li><code>@monthly</code> - raz w miesiącu (0 0 1 * *)</li>
          <li><code>@weekly</code> - raz w tygodniu (0 0 * * 0)</li>
          <li><code>@daily</code> - raz dziennie (0 0 * * *)</li>
          <li><code>@hourly</code> - raz na godzinę (0 * * * *)</li>
          <li><code>@reboot</code> - przy każdym restarcie systemu</li>
        </ul>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'

const { t } = useI18n()
const { copy } = useClipboard()

// State
const jobs = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const showCronHelp = ref(false)
const addingJob = ref(false)
const savingJob = ref(false)
const runningJobs = ref({})
const currentPage = ref(1)
const pageSize = ref(10)
const statusFilter = ref('all')
const searchQuery = ref('')
const isEditMode = ref(false)
const scheduleValid = ref(true)
const nextRunPreview = ref('')

// Form data
const currentJob = ref({
  id: '',
  name: '',
  schedule: '',
  command: '',
  description: '',
  isActive: true
})

const jobForm = ref()

// Validation rules
const rules = {
  name: [
    { required: true, message: 'Nazwa jest wymagana', trigger: 'blur' },
    { min: 3, message: 'Nazwa musi mieć co najmniej 3 znaki', trigger: 'blur' }
  ],
  schedule: [
    { required: true, message: 'Harmonogram jest wymagany', trigger: 'blur' },
    { 
      validator: (rule, value, callback) => {
        if (value && !validateCronExpression(value)) {
          callback(new Error('Nieprawidłowy format harmonogramu cron'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  command: [
    { required: true, message: 'Komenda jest wymagana', trigger: 'blur' },
    { min: 3, message: 'Komenda musi mieć co najmniej 3 znaki', trigger: 'blur' }
  ]
}

// Computed properties
const totalJobs = computed(() => jobs.value.length)
const activeJobs = computed(() => jobs.value.filter(j => j.isActive).length)
const inactiveJobs = computed(() => jobs.value.filter(j => !j.isActive).length)
const systemJobs = computed(() => jobs.value.filter(j => j.isSystemJob).length)

const filteredJobs = computed(() => {
  let result = [...jobs.value]
  
  // Filter by status
  if (statusFilter.value === 'active') {
    result = result.filter(j => j.isActive)
  } else if (statusFilter.value === 'inactive') {
    result = result.filter(j => !j.isActive)
  } else if (statusFilter.value === 'system') {
    result = result.filter(j => j.isSystemJob)
  } else if (statusFilter.value === 'user') {
    result = result.filter(j => !j.isSystemJob)
  }
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(j => 
      j.name.toLowerCase().includes(query) ||
      j.command.toLowerCase().includes(query) ||
      (j.description && j.description.toLowerCase().includes(query))
    )
  }
  
  // Sort by status and date
  result.sort((a, b) => {
    if (a.isActive !== b.isActive) return b.isActive - a.isActive
    if (a.isSystemJob !== b.isSystemJob) return b.isSystemJob - a.isSystemJob
    return new Date(b.nextRun || 0) - new Date(a.nextRun || 0)
  })
  
  return result
})

const paginatedJobs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredJobs.value.slice(start, end)
})

const emptyMessage = computed(() => {
  if (statusFilter.value !== 'all' || searchQuery.value) {
    return `Brak zadań dla wybranych filtrów`
  }
  return 'Brak zadań cron. Dodaj pierwsze zadanie!'
})

const dialogTitle = computed(() => {
  return isEditMode.value ? 'Edytuj zadanie cron' : 'Dodaj nowe zadanie cron'
})

// Methods
const validateCronExpression = (expression) => {
  try {
    // Simple cron validation
    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5 && !expression.startsWith('@')) {
      return false
    }
    
    // Check for special strings
    const specials = ['@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly', '@reboot']
    if (specials.includes(expression)) {
      return true
    }
    
    // Basic validation for numeric ranges
    const validators = [
      (v) => /^[\d*,\/\-\?LW]+$/.test(v), // minute
      (v) => /^[\d*,\/\-\?]+$/.test(v),   // hour
      (v) => /^[\d*,\/\-\?LW]+$/.test(v), // day of month
      (v) => /^[\d*,\/\-\?]+$/.test(v),   // month
      (v) => /^[\d*,\/\-\?L#]+$/.test(v), // day of week
    ]
    
    for (let i = 0; i < 5; i++) {
      if (!validators[i](parts[i])) {
        return false
      }
    }
    
    return true
  } catch {
    return false
  }
}

const validateSchedule = (schedule) => {
  scheduleValid.value = validateCronExpression(schedule)
  if (scheduleValid.value) {
    // Calculate next run for preview
    try {
      const now = new Date()
      const nextRun = calculateNextRun(schedule)
      if (nextRun) {
        nextRunPreview.value = formatDateTime(nextRun)
      }
    } catch (error) {
      console.error('Error calculating next run:', error)
    }
  }
  return scheduleValid.value
}

const calculateNextRun = (cronExpression) => {
  try {
    // Simple next run calculation
    const now = new Date()
    const nextRun = new Date(now)
    
    const parts = cronExpression.split(/\s+/)
    if (parts.length === 5) {
      const [minute, hour] = parts
      
      if (minute !== '*' && minute !== '*/1') {
        nextRun.setMinutes(parseInt(minute) || 0)
        if (nextRun < now) {
          nextRun.setHours(nextRun.getHours() + 1)
        }
      }
      
      if (hour !== '*' && hour !== '*/1') {
        nextRun.setHours(parseInt(hour) || 0)
        if (nextRun < now) {
          nextRun.setDate(nextRun.getDate() + 1)
        }
      }
    }
    
    return nextRun
  } catch (error) {
    console.error('Error calculating next run:', error)
    return null
  }
}

const formatDateTime = (date) => {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatRelativeTime = (date) => {
  if (!date) return 'nigdy'
  const now = new Date()
  const d = new Date(date)
  const diffInHours = Math.floor((d - now) / (1000 * 60 * 60))
  
  if (diffInHours < 0) {
    return 'przeszłe'
  } else if (diffInHours < 1) {
    const diffInMinutes = Math.floor((d - now) / (1000 * 60))
    return `za ${diffInMinutes} min`
  } else if (diffInHours < 24) {
    return `za ${diffInHours} godz.`
  } else {
    return d.toLocaleDateString('pl-PL')
  }
}

const formatFullDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('pl-PL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const fetchJobs = async () => {
  loading.value = true
  try {
    const response = await axios.get('/system/cron-jobs')
    jobs.value = response.data.map(job => ({
      ...job,
      nextRun: job.nextRun ? new Date(job.nextRun) : null,
      lastRun: job.lastRun ? new Date(job.lastRun) : null,
      isActive: job.isActive !== undefined ? job.isActive : true
    }))
  } catch (error) {
    ElMessage.error(t('cronJobs.fetchError') || 'Błąd podczas ładowania zadań')
    console.error('Fetch jobs error:', error)
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  isEditMode.value = false
  currentJob.value = {
    id: '',
    name: '',
    schedule: '',
    command: '',
    description: '',
    isActive: true
  }
  scheduleValid.value = true
  nextTick(() => {
    if (jobForm.value) {
      jobForm.value.clearValidate()
    }
  })
  dialogVisible.value = true
}

const editJob = (job) => {
  isEditMode.value = true
  currentJob.value = {
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    command: job.command,
    description: job.description || '',
    isActive: job.isActive
  }
  validateSchedule(job.schedule)
  nextTick(() => {
    if (jobForm.value) {
      jobForm.value.clearValidate()
    }
  })
  dialogVisible.value = true
}

const saveJob = async () => {
  if (!jobForm.value) return
  
  try {
    await jobForm.value.validate()
    
    if (!validateSchedule(currentJob.value.schedule)) {
      ElMessage.warning('Popraw harmonogram przed zapisaniem')
      return
    }
    
    savingJob.value = true
    
    if (isEditMode.value) {
      // Update existing job
      await axios.put(`/system/cron-jobs/${currentJob.value.id}`, currentJob.value)
      ElMessage.success('Zadanie zaktualizowane pomyślnie')
    } else {
      // Create new job
      const response = await axios.post('/system/cron-jobs', currentJob.value)
      currentJob.value.id = response.data.id
      ElMessage.success('Zadanie dodane pomyślnie')
    }
    
    dialogVisible.value = false
    await fetchJobs()
  } catch (error) {
    if (error.response?.status === 400) {
      ElMessage.error(error.response.data.error || 'Błąd walidacji danych')
    } else if (error.name !== 'ValidateError') {
      ElMessage.error('Błąd podczas zapisywania zadania')
      console.error('Save job error:', error)
    }
  } finally {
    savingJob.value = false
  }
}

const deleteJob = async (id) => {
  const job = jobs.value.find(j => j.id === id)
  if (!job) return
  
  if (job.isSystemJob) {
    ElMessage.warning('Zadania systemowe nie mogą być usunięte')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz usunąć zadanie "${job.name}"?`,
      'Potwierdzenie usunięcia',
      { 
        type: 'warning',
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj'
      }
    )
    
    await axios.delete(`/system/cron-jobs/${id}`)
    ElMessage.success('Zadanie usunięte pomyślnie')
    await fetchJobs()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania zadania')
      console.error('Delete job error:', error)
    }
  }
}

const runJob = async (id) => {
  const job = jobs.value.find(j => j.id === id)
  if (!job) return
  
  if (job.isSystemJob && !job.isActive) {
    ElMessage.warning('Nie można uruchomić nieaktywnego zadania systemowego')
    return
  }
  
  try {
    runningJobs.value[id] = true
    await axios.post(`/system/cron-jobs/${id}/run`)
    ElMessage.success('Zadanie uruchomione pomyślnie')
    
    // Refresh to update last run time
    await fetchJobs()
  } catch (error) {
    ElMessage.error('Błąd podczas uruchamiania zadania')
    console.error('Run job error:', error)
  } finally {
    runningJobs.value[id] = false
  }
}

const toggleJob = async (id) => {
  const job = jobs.value.find(j => j.id === id)
  if (!job || job.isSystemJob) return
  
  try {
    const newStatus = !job.isActive
    await axios.patch(`/system/cron-jobs/${id}/status`, { isActive: newStatus })
    
    job.isActive = newStatus
    ElMessage.success(`Zadanie ${newStatus ? 'aktywowane' : 'dezaktywowane'} pomyślnie`)
  } catch (error) {
    ElMessage.error('Błąd podczas zmiany statusu zadania')
    console.error('Toggle job error:', error)
  }
}

const copyToClipboard = async (text) => {
  try {
    await copy(text)
    ElMessage.success('Skopiowano do schowka')
  } catch (error) {
    ElMessage.error('Błąd podczas kopiowania')
  }
}

const handleFilterChange = () => {
  currentPage.value = 1
}

const handleSearch = () => {
  currentPage.value = 1
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

onMounted(() => {
  fetchJobs()
})
</script>

<style scoped>
.cron-jobs-dashboard {
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
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
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

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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

.stat-total {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-inactive {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
}

.stat-system {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-info h3 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.cron-content {
  margin-bottom: 24px;
}

.actions-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.actions-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  flex-wrap: wrap;
  gap: 20px;
}

.actions-info h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1e293b;
  font-weight: 600;
}

.actions-info p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.actions-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

.search-input {
  width: 300px;
}

.jobs-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  min-height: 400px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
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

.loading-spinner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80px 0;
  min-height: 300px;
}

.loading-spinner p {
  margin-top: 16px;
  color: #64748b;
}

.empty-state {
  padding: 80px 0;
  min-height: 300px;
}

.jobs-list {
  padding: 8px 0;
}

.job-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.job-item:hover {
  background-color: #f8fafc;
}

.job-item.system-job {
  background-color: rgba(139, 92, 246, 0.05);
  border-left: 3px solid #8b5cf6;
}

.job-item.inactive {
  opacity: 0.7;
  background-color: rgba(100, 116, 139, 0.05);
}

.job-item:last-child {
  border-bottom: none;
}

.job-icon {
  flex-shrink: 0;
  margin-top: 4px;
}

.job-content {
  flex: 1;
  min-width: 0;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.job-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.job-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.system-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.job-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.job-time {
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

.job-description p {
  margin: 0 0 12px;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.job-command {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  border: 1px solid #e2e8f0;
}

.job-command code {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.pagination-section {
  margin-top: 24px;
  padding: 20px 24px 0;
  border-top: 1px solid #f1f5f9;
}

.schedule-input {
  margin-bottom: 8px;
}

.schedule-preview,
.schedule-error {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cron-help {
  line-height: 1.6;
}

.cron-help ul {
  margin: 8px 0;
  padding-left: 20px;
}

.cron-help li {
  margin: 4px 0;
}

.cron-help code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

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
  }
  
  .actions-content {
    flex-direction: column;
    text-align: center;
  }
  
  .actions-filters {
    width: 100%;
    flex-direction: column;
  }
  
  .search-input {
    width: 100%;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .job-item {
    flex-direction: column;
    gap: 12px;
  }
  
  .job-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .job-meta {
    align-items: flex-start;
  }
  
  .job-actions {
    align-self: flex-end;
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
  
  .job-item {
    padding: 16px;
  }
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.el-button--primary) {
  background: #3b82f6;
  border-color: #3b82f6;
}

:deep(.el-button--primary:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.el-button--danger) {
  background: #ef4444;
  border-color: #ef4444;
}

:deep(.el-button--danger:hover) {
  background: #dc2626;
  border-color: #dc2626;
}

:deep(.el-tag) {
  font-weight: 500;
}

:deep(.el-pagination) {
  justify-content: center;
}

@keyframes pulse {
  0% {
    background-color: rgba(59, 130, 246, 0.05);
  }
  50% {
    background-color: rgba(59, 130, 246, 0.1);
  }
  100% {
    background-color: rgba(59, 130, 246, 0.05);
  }
}

.job-item.system-job:hover {
  animation: pulse 2s infinite;
}

.actions-card:hover,
.jobs-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

.empty-state :deep(.el-empty__image) {
  opacity: 0.8;
}

.empty-state :deep(.el-empty__description) {
  color: #64748b;
  font-size: 15px;
}
</style>
