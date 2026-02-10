<template>
  <div class="backup-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:backup-restore" />
          </div>
          <div class="header-text">
            <h1>{{ $t('backup.title') }}</h1>
            <p class="subtitle">{{ $t('backup.subtitle') || 'Zarządzanie kopiami zapasowymi systemu' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="activeTab === 'create' ? 'primary' : 'default'"
              @click="activeTab = 'create'"
            >
              <Icon icon="mdi:plus-circle" />
              {{ $t('backup.create') }}
            </el-button>
            <el-button 
              :type="activeTab === 'restore' ? 'primary' : 'default'"
              @click="activeTab = 'restore'"
            >
              <Icon icon="mdi:restore" />
              {{ $t('backup.restore') }}
            </el-button>
            <el-button 
              :type="activeTab === 'history' ? 'primary' : 'default'"
              @click="activeTab = 'history'"
            >
              <Icon icon="mdi:history" />
              {{ $t('backup.history') }}
            </el-button>
            <el-button 
              :type="activeTab === 'schedule' ? 'primary' : 'default'"
              @click="activeTab = 'schedule'"
            >
              <Icon icon="mdi:calendar-clock" />
              {{ $t('backup.schedule') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="backup-content">
      <!-- Create Backup Tab -->
      <el-card v-if="activeTab === 'create'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:content-save-plus" />
              {{ $t('backup.create') }}
            </h2>
          </div>
        </template>

        <el-form 
          :model="backupForm" 
          label-position="top"
          @submit.prevent="createBackup"
          class="backup-form"
        >
          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.basicSettings') || 'Podstawowe ustawienia' }}</h3>
            
            <el-form-item :label="$t('backup.name')" required>
              <el-input 
                v-model="backupForm.name" 
                :placeholder="$t('backup.namePlaceholder') || 'Nazwa kopii zapasowej'"
                class="custom-input"
              />
              <span class="input-description">{{ $t('backup.nameDescription') || 'Wprowadź unikalną nazwę dla kopii zapasowej' }}</span>
            </el-form-item>

            <el-form-item :label="$t('backup.type')" required>
              <el-select v-model="backupForm.type" class="custom-select">
                <el-option
                  v-for="item in backupTypes"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
              <span class="input-description">{{ $t('backup.typeDescription') || 'Wybierz typ kopii zapasowej' }}</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.itemsss') || 'Elementy do kopii' }}</h3>
            
			<el-form-item :label="$t('backup.itemsss')">
			  <div class="items-grid">
				<el-card 
				  v-for="item in backupItems" 
				  :key="item.value"
				  :class="['item-card', { 'selected': backupForm.items.includes(item.value) }]"
				  @click="toggleItem(item.value)"
				  shadow="hover"
				>
				  <div class="item-content">
					<div class="item-icon">
					  <Icon :icon="item.icon || 'mdi:folder'" />
					</div>
					<div class="item-info">
					  <h4>{{ item.text }}</h4>
					  <p class="item-size">{{ item.size || 'Rozmiar: Nieznany' }}</p>
					</div>
					<div class="item-checkbox">
					  <el-checkbox 
						:model-value="backupForm.items.includes(item.value)" 
						@click.stop="toggleItem(item.value)"
					  />
					</div>
				  </div>
				</el-card>
			  </div>
			</el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.advancedSettings') || 'Zaawansowane ustawienia' }}</h3>
            
            <el-form-item :label="$t('backup.compression')">
              <el-select v-model="backupForm.compression" class="custom-select">
                <el-option
                  v-for="item in compressionLevels"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
              <span class="input-description">{{ $t('backup.compressionDescription') || 'Wybierz poziom kompresji' }}</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="backupForm.includeSystemConfig" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">{{ $t('backup.include_system_config') }}</span>
              </div>
              <span class="input-description">{{ $t('backup.includeSystemConfigDescription') || 'Uwzględnij konfigurację systemu w kopii' }}</span>
            </el-form-item>
          </div>

          <div class="form-actions">
            <el-button 
              type="primary" 
              native-type="submit"
              :loading="isCreating"
              class="create-button"
            >
              <Icon icon="mdi:content-save" />
              {{ $t('backup.create_button') }}
            </el-button>
          </div>
        </el-form>
      </el-card>

      <!-- Restore Backup Tab -->
      <el-card v-if="activeTab === 'restore'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:backup-restore" />
              {{ $t('backup.restore') }}
            </h2>
          </div>
        </template>

        <div v-if="loadingBackups" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>{{ $t('backup.loadingBackups') || 'Ładowanie dostępnych kopii...' }}</p>
        </div>

        <el-form v-else label-position="top" class="restore-form">
          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.selectBackup') || 'Wybierz kopię do przywrócenia' }}</h3>
            
            <el-form-item :label="$t('backup.select_backup')" required>
              <el-select 
                v-model="selectedBackup" 
                filterable
                :placeholder="$t('backup.selectBackupPlaceholder') || 'Wybierz kopię zapasową'"
                class="custom-select"
              >
                <el-option
                  v-for="backup in availableBackups"
                  :key="backup.id"
                  :label="backup.name"
                  :value="backup.id"
                  :disabled="backup.status !== 'completed'"
                >
                  <div class="backup-option">
                    <div class="backup-info">
                      <div class="backup-name">{{ backup.name }}</div>
                      <div class="backup-details">
                        <span class="backup-date">{{ formatDate(backup.created_at) }}</span>
                        <span class="backup-size">{{ formatSize(backup.size) }}</span>
                      </div>
                    </div>
                    <div class="backup-status">
                      <el-tag :type="getStatusType(backup.status)" size="small">
                        {{ $t(`backup.statuses.${backup.status}`) }}
                      </el-tag>
                    </div>
                  </div>
                </el-option>
              </el-select>
              <span class="input-description">{{ $t('backup.selectBackupDescription') || 'Wybierz kopię zapasową do przywrócenia' }}</span>
            </el-form-item>

            <div v-if="selectedBackup" class="selected-backup-info">
              <el-card shadow="never">
                <div class="backup-detail">
                  <h4>Szczegóły wybranej kopii:</h4>
                  <div class="detail-grid">
                    <div class="detail-item">
                      <span class="detail-label">Typ:</span>
                      <span class="detail-value">{{ getBackupType(selectedBackup) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Data utworzenia:</span>
                      <span class="detail-value">{{ formatDate(getBackupDate(selectedBackup)) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Rozmiar:</span>
                      <span class="detail-value">{{ formatSize(getBackupSize(selectedBackup)) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Status:</span>
                      <span class="detail-value">
                        <el-tag :type="getStatusType(getBackupStatus(selectedBackup))" size="small">
                          {{ $t(`backup.statuses.${getBackupStatus(selectedBackup)}`) }}
                        </el-tag>
                      </span>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.restoreOptions') || 'Opcje przywracania' }}</h3>
            
            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="restoreSystemConfig" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">{{ $t('backup.restore_system_config') }}</span>
              </div>
              <span class="input-description">{{ $t('backup.restoreSystemConfigDescription') || 'Przywróć konfigurację systemu' }}</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="verifyIntegrity" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">{{ $t('backup.verify_integrity') }}</span>
              </div>
              <span class="input-description">{{ $t('backup.verifyIntegrityDescription') || 'Zweryfikuj integralność kopii przed przywróceniem' }}</span>
            </el-form-item>
          </div>

          <div class="form-actions">
            <el-button 
              type="danger" 
              @click="restoreBackup"
              :loading="isRestoring"
              :disabled="!selectedBackup"
              class="restore-button"
            >
              <Icon icon="mdi:restore-alert" />
              {{ $t('backup.restore_button') }}
            </el-button>
          </div>
        </el-form>
      </el-card>

      <!-- History Tab -->
      <el-card v-if="activeTab === 'history'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:history" />
              {{ $t('backup.history') }}
              <el-tag v-if="filteredBackups.length > 0" size="small" type="info">
                {{ filteredBackups.length }} kopii
              </el-tag>
            </h2>
            <div class="card-header-actions">
              <el-select 
                v-model="historyFilter" 
                :placeholder="$t('backup.filter') || 'Filtruj'"
                clearable
                class="filter-select"
              >
                <el-option label="Wszystkie" value="" />
                <el-option label="Zakończone" value="completed" />
                <el-option label="W trakcie" value="in_progress" />
                <el-option label="Niepowodzenie" value="failed" />
              </el-select>
              <el-button 
                type="info" 
                plain 
                @click="fetchBackups"
                :loading="loading"
              >
                <Icon icon="mdi:refresh" />
                {{ $t('common.refresh') }}
              </el-button>
            </div>
          </div>
        </template>

        <div v-if="loading" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>{{ $t('backup.loadingHistory') || 'Ładowanie historii...' }}</p>
        </div>

        <el-empty 
          v-else-if="filteredBackups.length === 0" 
          :description="historyEmptyMessage" 
          class="empty-state"
        >
          <template #image>
            <Icon icon="mdi:database-off" width="120" height="120" />
          </template>
        </el-empty>

        <div v-else class="backups-list">
          <div 
            v-for="backup in paginatedBackups" 
            :key="backup.id"
            class="backup-item"
          >
            <div class="backup-icon">
              <el-icon :size="24" :color="getBackupIconColor(backup.type)">
                <Icon :icon="getBackupIcon(backup.type)" />
              </el-icon>
            </div>
            <div class="backup-content">
              <div class="backup-header">
                <h4>{{ backup.name }}</h4>
                <div class="backup-meta">
                  <el-tag :type="getStatusType(backup.status)" size="small" effect="plain">
                    {{ $t(`backup.statuses.${backup.status}`) }}
                  </el-tag>
                  <span class="backup-type">{{ $t(`backup.types.${backup.type}`) }}</span>
                </div>
              </div>
              <p class="backup-details">
                <span class="backup-date">{{ formatDate(backup.created_at) }}</span>
                <span class="backup-size">{{ formatSize(backup.size) }}</span>
              </p>
              <div v-if="backup.status === 'in_progress'" class="backup-progress">
                <el-progress 
                  :percentage="backup.progress || 0" 
                  :stroke-width="4"
                  :show-text="true"
                  :text-inside="true"
                />
              </div>
            </div>
            <div class="backup-actions">
              <el-button 
                size="small" 
                @click="downloadBackup(backup.id)"
                :disabled="backup.status !== 'completed'"
                :loading="downloadingId === backup.id"
              >
                <el-icon><Icon icon="mdi:download" /></el-icon>
                {{ $t('common.download') }}
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteBackup(backup.id)"
                :loading="deletingId === backup.id"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
                {{ $t('common.delete') }}
              </el-button>
            </div>
          </div>
        </div>

        <div v-if="!loading && filteredBackups.length > 0" class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="filteredBackups.length"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
            :disabled="loading"
          />
        </div>
      </el-card>

      <!-- Schedule Tab -->
      <el-card v-if="activeTab === 'schedule'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:calendar-clock" />
              {{ $t('backup.schedule') }}
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
            <h3 class="section-title">{{ $t('backup.scheduleSettings') || 'Ustawienia harmonogramu' }}</h3>
            
            <el-form-item :label="$t('backup.schedule_type')" required>
              <el-select v-model="scheduleForm.type" class="custom-select">
                <el-option
                  v-for="item in scheduleTypes"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
              <span class="input-description">{{ $t('backup.scheduleTypeDescription') || 'Wybierz typ harmonogramu' }}</span>
            </el-form-item>

            <div v-if="scheduleForm.type !== 'disabled'" class="schedule-details">
              <template v-if="scheduleForm.type === 'daily'">
                <el-form-item :label="$t('backup.daily_time')" required>
                  <el-time-picker
                    v-model="scheduleForm.dailyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    :placeholder="$t('backup.dailyTimePlaceholder') || 'Wybierz godzinę'"
                    class="custom-time-picker"
                  />
                  <span class="input-description">{{ $t('backup.dailyTimeDescription') || 'Godzina wykonania codziennej kopii' }}</span>
                </el-form-item>
              </template>

              <template v-else-if="scheduleForm.type === 'weekly'">
                <el-form-item :label="$t('backup.weekly_day')" required>
                  <el-select v-model="scheduleForm.weeklyDay" class="custom-select">
                    <el-option
                      v-for="day in weekDays"
                      :key="day.value"
                      :label="day.text"
                      :value="day.value"
                    />
                  </el-select>
                  <span class="input-description">{{ $t('backup.weeklyDayDescription') || 'Dzień tygodnia wykonania kopii' }}</span>
                </el-form-item>

                <el-form-item :label="$t('backup.weekly_time')" required>
                  <el-time-picker
                    v-model="scheduleForm.weeklyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    :placeholder="$t('backup.weeklyTimePlaceholder') || 'Wybierz godzinę'"
                    class="custom-time-picker"
                  />
                  <span class="input-description">{{ $t('backup.weeklyTimeDescription') || 'Godzina wykonania cotygodniowej kopii' }}</span>
                </el-form-item>
              </template>

              <template v-else-if="scheduleForm.type === 'monthly'">
                <el-form-item :label="$t('backup.monthly_day')" required>
                  <el-input-number
                    v-model="scheduleForm.monthlyDay"
                    :min="1"
                    :max="31"
                    controls-position="right"
                    class="custom-number-input"
                  />
                  <span class="input-description">{{ $t('backup.monthlyDayDescription') || 'Dzień miesiąca wykonania kopii' }}</span>
                </el-form-item>

                <el-form-item :label="$t('backup.monthly_time')" required>
                  <el-time-picker
                    v-model="scheduleForm.monthlyTime"
                    format="HH:mm"
                    value-format="HH:mm"
                    :placeholder="$t('backup.monthlyTimePlaceholder') || 'Wybierz godzinę'"
                    class="custom-time-picker"
                  />
                  <span class="input-description">{{ $t('backup.monthlyTimeDescription') || 'Godzina wykonania comiesięcznej kopii' }}</span>
                </el-form-item>
              </template>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-title">{{ $t('backup.retentionPolicy') || 'Polityka przechowywania' }}</h3>
            
            <el-form-item :label="$t('backup.retention')">
              <el-select v-model="scheduleForm.retention" class="custom-select">
                <el-option
                  v-for="item in retentionOptions"
                  :key="item.value"
                  :label="item.text"
                  :value="item.value"
                />
              </el-select>
              <span class="input-description">{{ $t('backup.retentionDescription') || 'Okres przechowywania kopii zapasowych' }}</span>
            </el-form-item>
          </div>

          <div v-if="scheduleForm.type !== 'disabled'" class="form-section">
            <h3 class="section-title">{{ $t('backup.nextBackup') || 'Następna kopia' }}</h3>
            
            <el-card shadow="never" class="next-backup-card">
              <div class="next-backup-info">
                <div class="next-backup-icon">
                  <Icon icon="mdi:calendar-check" />
                </div>
                <div class="next-backup-details">
                  <h4>{{ $t('backup.nextScheduledBackup') || 'Następna zaplanowana kopia:' }}</h4>
                  <p class="next-backup-time">{{ calculateNextBackup() }}</p>
                  <p class="next-backup-description">
                    {{ getScheduleDescription() }}
                  </p>
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
              {{ $t('backup.save_schedule') }}
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>

    <!-- Stats Card -->
    <el-card class="stats-card" shadow="hover">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-icon stat-total">
            <Icon icon="mdi:database" />
          </div>
          <div class="stat-info">
            <h3>{{ totalBackupsCount }}</h3>
            <p>{{ $t('backup.totalBackups') || 'Wszystkie kopie' }}</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-completed">
            <Icon icon="mdi:check-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ completedBackupsCount }}</h3>
            <p>{{ $t('backup.completedBackups') || 'Zakończone' }}</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-in-progress">
            <Icon icon="mdi:progress-clock" />
          </div>
          <div class="stat-info">
            <h3>{{ inProgressBackupsCount }}</h3>
            <p>{{ $t('backup.inProgressBackups') || 'W trakcie' }}</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-failed">
            <Icon icon="mdi:alert-circle" />
          </div>
          <div class="stat-info">
            <h3>{{ failedBackupsCount }}</h3>
            <p>{{ $t('backup.failedBackups') || 'Nieudane' }}</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-size">
            <Icon icon="mdi:harddisk" />
          </div>
          <div class="stat-info">
            <h3>{{ formatSize(totalBackupsSize) }}</h3>
            <p>{{ $t('backup.totalSize') || 'Łączny rozmiar' }}</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Shared data
const activeTab = ref('create')
const loading = ref(false)
const loadingBackups = ref(false)
const isCreating = ref(false)
const isRestoring = ref(false)
const isSaving = ref(false)

// Create Backup Tab
const backupForm = ref({
  type: 'full',
  name: '',
  items: [],
  compression: 'medium',
  includeSystemConfig: true
})

const backupTypes = [
  { value: 'full', text: t('backup.types.full') },
  { value: 'incremental', text: t('backup.types.incremental') },
  { value: 'differential', text: t('backup.types.differential') }
]

const backupItems = [
  { value: 'documents', text: t('backup.items.documents'), icon: 'mdi:file-document' },
  { value: 'photos', text: t('backup.items.photos'), icon: 'mdi:image' },
  { value: 'music', text: t('backup.items.music'), icon: 'mdi:music' },
  { value: 'videos', text: t('backup.items.videos'), icon: 'mdi:video' },
  { value: 'configuration', text: t('backup.items.configuration'), icon: 'mdi:cog' },
  { value: 'databases', text: t('backup.items.databases'), icon: 'mdi:database' },
  { value: 'logs', text: t('backup.items.logs'), icon: 'mdi:text-box' }
]

const compressionLevels = [
  { value: 'none', text: t('backup.compression_levels.none') },
  { value: 'low', text: t('backup.compression_levels.low') },
  { value: 'medium', text: t('backup.compression_levels.medium') },
  { value: 'high', text: t('backup.compression_levels.high') }
]

// Restore Backup Tab
const availableBackups = ref([])
const selectedBackup = ref('')
const restoreSystemConfig = ref(false)
const verifyIntegrity = ref(true)

// History Tab
const backups = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const historyFilter = ref('')
const downloadingId = ref(null)
const deletingId = ref(null)
const refreshInterval = ref(null)

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

// Computed properties
const filteredBackups = computed(() => {
  let result = [...backups.value]
  
  if (historyFilter.value) {
    result = result.filter(backup => backup.status === historyFilter.value)
  }
  
  // Sortowanie od najnowszych
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  
  return result
})

const paginatedBackups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredBackups.value.slice(start, end)
})

const totalBackupsCount = computed(() => backups.value.length)
const completedBackupsCount = computed(() => backups.value.filter(b => b.status === 'completed').length)
const inProgressBackupsCount = computed(() => backups.value.filter(b => b.status === 'in_progress').length)
const failedBackupsCount = computed(() => backups.value.filter(b => b.status === 'failed').length)
const totalBackupsSize = computed(() => backups.value.reduce((sum, backup) => sum + (backup.size || 0), 0))

const historyEmptyMessage = computed(() => {
  if (historyFilter.value) {
    return `Brak kopii ze statusem: ${historyFilter.value}`
  }
  return 'Brak dostępnych kopii zapasowych'
})

// Methods
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
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

const getBackupIcon = (type) => {
  const icons = {
    'full': 'mdi:database',
    'incremental': 'mdi:database-sync',
    'differential': 'mdi:database-arrow-up'
  }
  return icons[type] || 'mdi:database'
}

const getBackupIconColor = (type) => {
  const colors = {
    'full': '#3b82f6',
    'incremental': '#10b981',
    'differential': '#8b5cf6'
  }
  return colors[type] || '#6b7280'
}

const toggleItem = (itemValue) => {
  const index = backupForm.value.items.indexOf(itemValue)
  if (index === -1) {
    backupForm.value.items.push(itemValue)
  } else {
    backupForm.value.items.splice(index, 1)
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

const getBackupById = (id) => {
  return availableBackups.value.find(b => b.id === id) || backups.value.find(b => b.id === id)
}

const getBackupType = (id) => {
  const backup = getBackupById(id)
  return backup ? t(`backup.types.${backup.type}`) : 'Nieznany'
}

const getBackupDate = (id) => {
  const backup = getBackupById(id)
  return backup ? backup.created_at : null
}

const getBackupSize = (id) => {
  const backup = getBackupById(id)
  return backup ? backup.size : 0
}

const getBackupStatus = (id) => {
  const backup = getBackupById(id)
  return backup ? backup.status : 'unknown'
}

const calculateNextBackup = () => {
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

// API Methods
const createBackup = async () => {
  isCreating.value = true
  try {
    const response = await axios.post('/api/system/backup/create', backupForm.value)
    
    ElMessage.success({
      message: 'Rozpoczęto tworzenie kopii zapasowej',
      type: 'success',
      showClose: true
    })
    
    // Reset form
    backupForm.value.name = ''
    backupForm.value.items = []
    
    // Refresh lists
    setTimeout(() => {
      fetchBackups()
      fetchAvailableBackups()
    }, 2000)
    
  } catch (error) {
    ElMessage.error({
      message: error.response?.data?.message || 'Wystąpił błąd podczas tworzenia kopii',
      type: 'error',
      showClose: true
    })
  } finally {
    isCreating.value = false
  }
}

const fetchAvailableBackups = async () => {
  loadingBackups.value = true
  try {
    const response = await axios.get('/api/system/backup/list')
    availableBackups.value = response.data.backups || []
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania dostępnych kopii')
  } finally {
    loadingBackups.value = false
  }
}

const fetchBackups = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/system/backup/history', {
      params: {
        page: currentPage.value,
        per_page: pageSize.value
      }
    })
    backups.value = response.data.backups || []
    
    // Check for in-progress backups
    const inProgress = backups.value.filter(b => b.status === 'in_progress')
    if (inProgress.length > 0 && !refreshInterval.value) {
      startStatusRefresh()
    }
  } catch (error) {
    ElMessage.error('Błąd podczas ładowania historii kopii')
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
  }, 5000)
}

const restoreBackup = async () => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz przywrócić wybraną kopię zapasową? Ta operacja może nadpisać obecne dane.',
      'Potwierdzenie przywracania',
      {
        confirmButtonText: 'Przywróć',
        cancelButtonText: 'Anuluj',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    isRestoring.value = true
    await axios.post('/api/system/backup/restore', {
      backup_id: selectedBackup.value,
      restore_system_config: restoreSystemConfig.value,
      verify_integrity: verifyIntegrity.value
    })
    
    ElMessage.success('Rozpoczęto proces przywracania kopii')
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || 'Błąd podczas przywracania kopii')
    }
  } finally {
    isRestoring.value = false
  }
}

const downloadBackup = async (backupId) => {
  try {
    downloadingId.value = backupId
    
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

    ElMessage.success('Rozpoczęto pobieranie kopii')
    
  } catch (error) {
    if (error.response?.status === 404) {
      ElMessage.error('Kopia nie została znaleziona')
    } else if (error.response?.status === 423) {
      ElMessage.warning('Kopia nie jest jeszcze gotowa do pobrania')
    } else {
      ElMessage.error('Błąd podczas pobierania kopii')
    }
  } finally {
    downloadingId.value = null
  }
}

const deleteBackup = async (backupId) => {
  try {
    await ElMessageBox.confirm(
      'Czy na pewno chcesz usunąć tę kopię zapasową? Tej akcji nie można cofnąć.',
      'Potwierdzenie usunięcia',
      {
        confirmButtonText: 'Usuń',
        cancelButtonText: 'Anuluj',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    deletingId.value = backupId
    await axios.delete(`/api/system/backup/delete/${backupId}`)
    
    ElMessage.success('Kopia zapasowa została usunięta')
    fetchBackups()
    fetchAvailableBackups()
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas usuwania kopii')
    }
  } finally {
    deletingId.value = null
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

// Lifecycle
onMounted(() => {
  fetchAvailableBackups()
  fetchBackups()
  loadSchedule()
})

onBeforeUnmount(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.backup-dashboard {
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
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
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

.backup-content {
  margin-bottom: 24px;
}

.tab-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.tab-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.card-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
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

/* Form Styles */
.backup-form,
.restore-form,
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

.custom-input,
.custom-select,
.custom-time-picker,
.custom-number-input {
  width: 100%;
  max-width: 400px;
}

/* Items Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 12px;
  width: 100%;
}

.item-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.item-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.item-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.item-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  font-size: 22px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
}

.item-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.item-size {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.item-checkbox {
  flex-shrink: 0;
}

/* Backup Option */
.backup-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 0;
}

.backup-info {
  flex: 1;
}

.backup-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.backup-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.backup-date,
.backup-size {
  display: inline-block;
}

.backup-status {
  flex-shrink: 0;
}

/* Selected Backup Info */
.selected-backup-info {
  margin-top: 20px;
}

.backup-detail h4 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #1e293b;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #475569;
}

.detail-value {
  color: #1e293b;
}

/* Backups List */
.backups-list {
  padding: 8px 0;
}

.backup-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}

.backup-item:hover {
  background-color: #f8fafc;
}

.backup-item:last-child {
  border-bottom: none;
}

.backup-icon {
  flex-shrink: 0;
}

.backup-content {
  flex: 1;
  min-width: 0;
}

.backup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.backup-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
}

.backup-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.backup-type {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
}

.backup-details {
  display: flex;
  gap: 16px;
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.backup-date,
.backup-size {
  display: inline-block;
}

.backup-progress {
  margin-top: 12px;
  max-width: 300px;
}

.backup-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

/* Schedule Details */
.schedule-details {
  margin-top: 20px;
}

.next-backup-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
}

.next-backup-info {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.next-backup-icon {
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

.next-backup-details h4 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #1e293b;
}

.next-backup-time {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #3b82f6;
}

.next-backup-description {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding: 24px 24px 0;
  border-top: 1px solid #f1f5f9;
}

.create-button,
.restore-button,
.save-button {
  padding: 12px 32px;
  border-radius: 10px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.create-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
}

.restore-button {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
}

.save-button {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
}

.create-button:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.restore-button:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
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

.stat-total {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-completed {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-in-progress {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-failed {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.stat-size {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
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

/* Switch Container */
.switch-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.switch-label {
  font-weight: 500;
  color: #475569;
}

.custom-switch {
  :deep(.el-switch__core) {
    background-color: #cbd5e1 !important;
    border-color: #cbd5e1 !important;
  }
  
  :deep(.el-switch.is-checked .el-switch__core) {
    background-color: #3b82f6 !important;
    border-color: #3b82f6 !important;
  }
}

/* Pagination */
.pagination-section {
  margin-top: 24px;
  padding: 20px 24px 0;
  border-top: 1px solid #f1f5f9;
}

/* Filter Select */
.filter-select {
  width: 200px;
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
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header-actions {
    width: 100%;
  }
  
  .card-header-actions .filter-select {
    width: 100%;
  }
  
  .items-grid {
    grid-template-columns: 1fr;
  }
  
  .backup-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .backup-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .backup-actions {
    align-self: flex-end;
  }
  
  .stats-content {
    grid-template-columns: 1fr;
  }
  
  .next-backup-info {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .backup-item {
    padding: 16px;
  }
  
  .backup-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

/* Button styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

/* Input styling */
:deep(.el-input__inner) {
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  transition: all 0.3s ease;
}

:deep(.el-input__inner:hover),
:deep(.el-input__inner:focus) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Select styling */
:deep(.el-select .el-input__inner) {
  height: 40px;
}

/* Progress bar styling */
:deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

/* Tag styling */
:deep(.el-tag) {
  font-weight: 500;
}

/* Card hover effects */
.tab-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

/* Loading states */
.backup-item:has(:deep(.el-button.is-loading)) {
  opacity: 0.7;
}

/* Animation for in-progress backups */
@keyframes pulse {
  0% {
    background-color: rgba(245, 158, 11, 0.05);
  }
  50% {
    background-color: rgba(245, 158, 11, 0.1);
  }
  100% {
    background-color: rgba(245, 158, 11, 0.05);
  }
}

.backup-item:has(.backup-progress) {
  animation: pulse 2s infinite;
}
</style>
