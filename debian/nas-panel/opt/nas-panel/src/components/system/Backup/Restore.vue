<template>
  <div class="restore-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:backup-restore" />
          </div>
          <div class="header-text">
            <h1>Przywracanie kopii</h1>
            <p class="subtitle">Przywróć dane z wybranej kopii zapasowej</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="activeSection === 'select' ? 'primary' : 'default'"
              @click="activeSection = 'select'"
            >
              <Icon icon="mdi:database-search" />
              Wybierz kopię
            </el-button>
            <el-button 
              :type="activeSection === 'options' ? 'primary' : 'default'"
              @click="activeSection = 'options'"
              :disabled="!selectedBackup"
            >
              <Icon icon="mdi:cog" />
              Opcje
            </el-button>
            <el-button 
              :type="activeSection === 'confirm' ? 'primary' : 'default'"
              @click="activeSection = 'confirm'"
              :disabled="!selectedBackup"
            >
              <Icon icon="mdi:check-circle" />
              Potwierdź
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="restore-content">
      <!-- Select Backup Section -->
      <el-card v-if="activeSection === 'select'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:database-search" />
              Wybierz kopię do przywrócenia
            </h2>
          </div>
        </template>

        <div v-if="loadingBackups" class="loading-spinner">
          <el-icon :size="48" class="is-loading">
            <Icon icon="mdi:loading" />
          </el-icon>
          <p>Ładowanie dostępnych kopii...</p>
        </div>

        <div v-else class="backups-grid">
          <el-card 
            v-for="backup in availableBackups" 
            :key="backup.id"
            :class="['backup-card', { 'selected': selectedBackup === backup.id }]"
            @click="selectBackup(backup.id)"
            shadow="hover"
          >
            <div class="backup-card-content">
              <div class="backup-icon" :style="{ backgroundColor: getBackupTypeColor(backup.type) }">
                <Icon :icon="getBackupTypeIcon(backup.type)" />
              </div>
              <div class="backup-info">
                <h4>{{ backup.name }}</h4>
                <p class="backup-details">
                  <span class="backup-type">{{ getBackupTypeText(backup.type) }}</span>
                  <span class="backup-date">{{ formatDate(backup.created_at) }}</span>
                </p>
                <p class="backup-size">{{ formatSize(backup.size) }}</p>
              </div>
              <div class="backup-status">
                <el-tag :type="getStatusType(backup.status)" size="small">
                  {{ getStatusText(backup.status) }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </div>

        <div v-if="!loadingBackups && availableBackups.length === 0" class="empty-state">
          <Icon icon="mdi:database-off" width="80" height="80" />
          <p>Brak dostępnych kopii zapasowych</p>
          <el-button type="primary" @click="$router.push('/backup')">
            <Icon icon="mdi:plus" />
            Utwórz pierwszą kopię
          </el-button>
        </div>
      </el-card>

      <!-- Options Section -->
      <el-card v-if="activeSection === 'options'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:cog" />
              Opcje przywracania
            </h2>
          </div>
        </template>

        <div v-if="selectedBackup" class="selected-backup-info">
          <el-card shadow="never">
            <div class="backup-summary">
              <div class="summary-icon" :style="{ backgroundColor: getBackupTypeColor(selectedBackupType) }">
                <Icon :icon="getBackupTypeIcon(selectedBackupType)" />
              </div>
              <div class="summary-details">
                <h4>{{ selectedBackupName }}</h4>
                <div class="summary-meta">
                  <span class="summary-date">{{ formatDate(selectedBackupDate) }}</span>
                  <span class="summary-size">{{ formatSize(selectedBackupSize) }}</span>
                  <span class="summary-type">{{ getBackupTypeText(selectedBackupType) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <div class="options-form">
          <div class="form-section">
            <h3 class="section-title">Zakres przywracania</h3>
            
            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="restoreSystemConfig" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Przywróć konfigurację systemu</span>
              </div>
              <span class="input-description">Przywróć ustawienia systemowe i konfigurację aplikacji</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="restoreUserData" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Przywróć dane użytkowników</span>
              </div>
              <span class="input-description">Przywróć pliki i dane użytkowników</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="restoreDatabases" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Przywróć bazy danych</span>
              </div>
              <span class="input-description">Przywróć bazy danych i ich zawartość</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">Zaawansowane opcje</h3>
            
            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="verifyIntegrity" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Zweryfikuj integralność kopii</span>
              </div>
              <span class="input-description">Sprawdź poprawność i integralność kopii przed przywróceniem</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="createPreRestoreBackup" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Utwórz kopię przed przywróceniem</span>
              </div>
              <span class="input-description">Utwórz aktualną kopię systemu przed rozpoczęciem przywracania</span>
            </el-form-item>

            <el-form-item>
              <div class="switch-container">
                <el-switch 
                  v-model="stopServicesDuringRestore" 
                  inline-prompt
                  :active-text="$t('common.enabled')"
                  :inactive-text="$t('common.disabled')"
                  class="custom-switch"
                />
                <span class="switch-label">Zatrzymaj usługi podczas przywracania</span>
              </div>
              <span class="input-description">Zatrzymaj działające usługi na czas procesu przywracania</span>
            </el-form-item>
          </div>

          <div class="form-section">
            <h3 class="section-title">Obszar docelowy</h3>
            
            <el-form-item label="Lokalizacja przywracania">
              <el-select v-model="restoreLocation" class="custom-select">
                <el-option label="Lokalizacja oryginalna" value="original" />
                <el-option label="Alternatywna lokalizacja" value="alternative" />
                <el-option label="Nowy folder" value="new_folder" />
              </el-select>
              <span class="input-description">Wybierz gdzie mają zostać przywrócone dane</span>
            </el-form-item>

            <el-form-item v-if="restoreLocation === 'alternative'" label="Ścieżka alternatywna">
              <el-input 
                v-model="alternativePath" 
                placeholder="/path/to/restore"
                class="path-input"
              >
                <template #append>
                  <el-button @click="browsePath">
                    <Icon icon="mdi:folder-search" />
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </div>
        </div>
      </el-card>

      <!-- Confirm Section -->
      <el-card v-if="activeSection === 'confirm'" class="tab-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <h2>
              <Icon icon="mdi:check-circle" />
              Potwierdzenie przywracania
            </h2>
          </div>
        </template>

        <div class="confirmation-content">
          <div class="warning-card">
            <div class="warning-icon">
              <Icon icon="mdi:alert-circle" />
            </div>
            <div class="warning-content">
              <h3>Uwaga! Operacja przywracania</h3>
              <p>Przywracanie kopii zapasowej spowoduje nadpisanie istniejących danych. Upewnij się, że:</p>
              <ul>
                <li>Masz aktualną kopię bieżącego stanu systemu</li>
                <li>Wszystkie ważne dane zostały zabezpieczone</li>
                <li>System jest w trybie konserwacji lub nie używany</li>
                <li>Masz wystarczająco miejsca na dysku</li>
              </ul>
            </div>
          </div>

          <div class="summary-section">
            <h3 class="section-title">Podsumowanie operacji</h3>
            
            <el-card shadow="never" class="summary-card">
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Wybrana kopia:</span>
                  <span class="summary-value">{{ selectedBackupName }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Data kopii:</span>
                  <span class="summary-value">{{ formatDate(selectedBackupDate) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Typ kopii:</span>
                  <span class="summary-value">{{ getBackupTypeText(selectedBackupType) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Rozmiar:</span>
                  <span class="summary-value">{{ formatSize(selectedBackupSize) }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Konfiguracja systemu:</span>
                  <span class="summary-value">
                    <el-tag :type="restoreSystemConfig ? 'success' : 'info'" size="small">
                      {{ restoreSystemConfig ? 'Przywróć' : 'Pomiń' }}
                    </el-tag>
                  </span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Dane użytkowników:</span>
                  <span class="summary-value">
                    <el-tag :type="restoreUserData ? 'success' : 'info'" size="small">
                      {{ restoreUserData ? 'Przywróć' : 'Pomiń' }}
                    </el-tag>
                  </span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Weryfikacja integralności:</span>
                  <span class="summary-value">
                    <el-tag :type="verifyIntegrity ? 'success' : 'warning'" size="small">
                      {{ verifyIntegrity ? 'Włączona' : 'Wyłączona' }}
                    </el-tag>
                  </span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Kopia przed przywróceniem:</span>
                  <span class="summary-value">
                    <el-tag :type="createPreRestoreBackup ? 'success' : 'warning'" size="small">
                      {{ createPreRestoreBackup ? 'Utworzona' : 'Nie tworz' }}
                    </el-tag>
                  </span>
                </div>
              </div>
            </el-card>
          </div>

          <div class="action-section">
            <el-alert 
              type="error" 
              show-icon 
              :closable="false"
              class="final-warning"
            >
              <template #title>
                <strong>Ostatnie ostrzeżenie!</strong>
              </template>
              <p>Ta operacja jest <strong>nieodwracalna</strong> i może spowodować utratę danych. 
              Upewnij się, że wybrano właściwą kopię i opcje przywracania.</p>
            </el-alert>

            <div class="action-buttons">
              <el-button @click="activeSection = 'options'">
                <Icon icon="mdi:arrow-left" />
                Wróć do opcji
              </el-button>
              <el-button 
                type="danger" 
                @click="restoreBackup"
                :loading="isRestoring"
                class="restore-button"
              >
                <Icon icon="mdi:backup-restore" />
                Rozpocznij przywracanie
              </el-button>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Progress Card (when restoring) -->
    <el-card v-if="isRestoring" class="progress-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:progress-clock" />
            Przywracanie w toku
          </h2>
        </div>
      </template>

      <div class="progress-content">
        <div class="progress-info">
          <h3>Trwa przywracanie kopii: {{ selectedBackupName }}</h3>
          <p class="progress-subtitle">Proszę czekać, operacja może zająć kilka minut...</p>
        </div>
        
        <div class="progress-stats">
          <div class="stat-item">
            <div class="stat-label">Postęp:</div>
            <div class="stat-value">{{ restoreProgress }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Przetworzone:</div>
            <div class="stat-value">{{ formatSize(restoredSize) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Pozostały czas:</div>
            <div class="stat-value">{{ estimatedTime }}</div>
          </div>
        </div>

        <div class="progress-bar-container">
          <el-progress 
            :percentage="restoreProgress" 
            :stroke-width="16"
            :show-text="true"
            :text-inside="true"
            status="success"
            class="main-progress"
          />
          
          <div class="sub-progress">
            <div class="sub-progress-item">
              <span class="sub-label">Weryfikacja</span>
              <el-progress 
                :percentage="verificationProgress" 
                :stroke-width="8"
                :show-text="false"
              />
            </div>
            <div class="sub-progress-item">
              <span class="sub-label">Ekstrakcja</span>
              <el-progress 
                :percentage="extractionProgress" 
                :stroke-width="8"
                :show-text="false"
              />
            </div>
            <div class="sub-progress-item">
              <span class="sub-label">Przywracanie</span>
              <el-progress 
                :percentage="restorationProgress" 
                :stroke-width="8"
                :show-text="false"
              />
            </div>
          </div>
        </div>

        <div class="progress-log">
          <h4>Log operacji:</h4>
          <div class="log-content">
            <div 
              v-for="(log, index) in restoreLogs" 
              :key="index"
              class="log-entry"
              :class="log.type"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Stats Card -->
    <el-card class="stats-card" shadow="hover">
      <div class="stats-content">
        <div class="stat-item">
          <div class="stat-icon stat-available">
            <Icon icon="mdi:database" />
          </div>
          <div class="stat-info">
            <h3>{{ availableBackups.length }}</h3>
            <p>Dostępne kopie</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-selected" v-if="selectedBackup">
            <Icon icon="mdi:database-check" />
          </div>
          <div class="stat-icon stat-not-selected" v-else>
            <Icon icon="mdi:database-remove" />
          </div>
          <div class="stat-info">
            <h3>{{ selectedBackup ? 'Wybrana' : 'Brak' }}</h3>
            <p>Wybrana kopia</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-restored">
            <Icon icon="mdi:backup-restore" />
          </div>
          <div class="stat-info">
            <h3>{{ lastRestoreDate || 'Nigdy' }}</h3>
            <p>Ostatnie przywrócenie</p>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon stat-size">
            <Icon icon="mdi:harddisk" />
          </div>
          <div class="stat-info">
            <h3>{{ formatSize(totalBackupsSize) }}</h3>
            <p>Łączny rozmiar kopii</p>
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
import { useRouter } from 'vue-router'

const router = useRouter()

// Stan komponentu
const activeSection = ref('select')
const loadingBackups = ref(false)
const isRestoring = ref(false)
const availableBackups = ref([])
const selectedBackup = ref('')

// Opcje przywracania
const restoreSystemConfig = ref(false)
const restoreUserData = ref(true)
const restoreDatabases = ref(true)
const verifyIntegrity = ref(true)
const createPreRestoreBackup = ref(true)
const stopServicesDuringRestore = ref(true)
const restoreLocation = ref('original')
const alternativePath = ref('')

// Postęp przywracania
const restoreProgress = ref(0)
const verificationProgress = ref(0)
const extractionProgress = ref(0)
const restorationProgress = ref(0)
const restoredSize = ref(0)
const estimatedTime = ref('obliczanie...')
const restoreLogs = ref([
  { time: '10:00:00', message: 'Rozpoczęto proces przywracania', type: 'info' },
  { time: '10:00:05', message: 'Weryfikacja integralności kopii', type: 'info' }
])

// Statystyki
const lastRestoreDate = ref(null)

// Computed properties
const selectedBackupData = computed(() => {
  return availableBackups.value.find(b => b.id === selectedBackup.value)
})

const selectedBackupName = computed(() => {
  return selectedBackupData.value?.name || 'Nie wybrano'
})

const selectedBackupType = computed(() => {
  return selectedBackupData.value?.type || 'unknown'
})

const selectedBackupDate = computed(() => {
  return selectedBackupData.value?.created_at || null
})

const selectedBackupSize = computed(() => {
  return selectedBackupData.value?.size || 0
})

const totalBackupsSize = computed(() => {
  return availableBackups.value.reduce((sum, backup) => sum + (backup.size || 0), 0)
})

// Methods
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

const selectBackup = (backupId) => {
  selectedBackup.value = backupId
  if (activeSection.value === 'select') {
    activeSection.value = 'options'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Nieznana data'
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

const getStatusText = (status) => {
  const texts = {
    completed: 'Zakończona',
    failed: 'Nieudana',
    in_progress: 'W trakcie',
    queued: 'W kolejce'
  }
  return texts[status] || status
}

const getBackupTypeIcon = (type) => {
  const icons = {
    'full': 'mdi:database',
    'incremental': 'mdi:database-sync',
    'differential': 'mdi:database-arrow-up'
  }
  return icons[type] || 'mdi:database'
}

const getBackupTypeColor = (type) => {
  const colors = {
    'full': '#3b82f6',
    'incremental': '#10b981',
    'differential': '#8b5cf6'
  }
  return colors[type] || '#6b7280'
}

const getBackupTypeText = (type) => {
  const texts = {
    'full': 'Pełna',
    'incremental': 'Przyrostowa',
    'differential': 'Różnicowa'
  }
  return texts[type] || 'Nieznany typ'
}

const browsePath = () => {
  // W rzeczywistej aplikacji tutaj byłoby okno wyboru folderu
  ElMessage.info('Funkcja przeglądania ścieżki nie jest zaimplementowana w tym demo')
}

const restoreBackup = async () => {
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz przywrócić kopię "${selectedBackupName.value}"? 
      Ta operacja jest nieodwracalna i może zająć kilka minut.`,
      'Ostateczne potwierdzenie przywracania',
      {
        confirmButtonText: 'Tak, przywróć',
        cancelButtonText: 'Anuluj',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
        dangerouslyUseHTMLString: true
      }
    )
    
    isRestoring.value = true
    
    // Symulacja procesu przywracania
    simulateRestoreProcess()
    
    // W rzeczywistej aplikacji tutaj byłoby wywołanie API:
    // await axios.post('/api/system/backup/restore', {
    //   backup_id: selectedBackup.value,
    //   restore_system_config: restoreSystemConfig.value,
    //   restore_user_data: restoreUserData.value,
    //   restore_databases: restoreDatabases.value,
    //   verify_integrity: verifyIntegrity.value,
    //   create_pre_restore_backup: createPreRestoreBackup.value,
    //   stop_services_during_restore: stopServicesDuringRestore.value,
    //   restore_location: restoreLocation.value,
    //   alternative_path: alternativePath.value
    // })
    
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Błąd podczas rozpoczynania przywracania')
    }
  }
}

const simulateRestoreProcess = () => {
  let progress = 0
  const totalSteps = 100
  
  const interval = setInterval(() => {
    progress += 1
    
    if (progress <= 20) {
      verificationProgress.value = progress * 5
      restoreLogs.value.push({
        time: new Date().toLocaleTimeString('pl-PL'),
        message: `Weryfikacja integralności: ${verificationProgress.value}%`,
        type: 'info'
      })
    } else if (progress <= 60) {
      extractionProgress.value = (progress - 20) * 2.5
      restoreLogs.value.push({
        time: new Date().toLocaleTimeString('pl-PL'),
        message: `Ekstrakcja danych: ${extractionProgress.value}%`,
        type: 'info'
      })
    } else {
      restorationProgress.value = (progress - 60) * 2.5
      restoreLogs.value.push({
        time: new Date().toLocaleTimeString('pl-PL'),
        message: `Przywracanie plików: ${restorationProgress.value}%`,
        type: 'info'
      })
    }
    
    restoreProgress.value = progress
    restoredSize.value = (selectedBackupSize.value * progress) / 100
    
    if (progress >= totalSteps) {
      clearInterval(interval)
      restoreLogs.value.push({
        time: new Date().toLocaleTimeString('pl-PL'),
        message: 'Przywracanie zakończone pomyślnie!',
        type: 'success'
      })
      
      setTimeout(() => {
        ElMessage.success('Przywracanie zakończone pomyślnie')
        isRestoring.value = false
        lastRestoreDate.value = new Date().toLocaleString('pl-PL')
        router.push('/backup/history')
      }, 2000)
    }
    
    // Aktualizuj pozostały czas
    const remaining = totalSteps - progress
    const minutes = Math.floor(remaining / 2)
    const seconds = (remaining % 2) * 30
    estimatedTime.value = `${minutes}:${seconds.toString().padStart(2, '0')}`
    
  }, 500)
}

onMounted(() => {
  fetchAvailableBackups()
})
</script>

<style scoped>
.restore-dashboard {
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
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
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

.restore-content {
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

/* Backups Grid */
.backups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 24px;
}

.backup-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
}

.backup-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.backup-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
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

.backup-card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.backup-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: white;
  font-size: 28px;
  flex-shrink: 0;
}

.backup-info {
  flex: 1;
  min-width: 0;
}

.backup-info h4 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.backup-details {
  display: flex;
  gap: 12px;
  margin: 0 0 4px;
  font-size: 12px;
  color: #64748b;
}

.backup-type,
.backup-date {
  display: inline-block;
}

.backup-size {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}

.backup-status {
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 60px 20px;
  text-align: center;
}

.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 16px;
}

/* Selected Backup Info */
.selected-backup-info {
  margin-bottom: 24px;
}

.backup-summary {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.summary-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: white;
  font-size: 30px;
  flex-shrink: 0;
}

.summary-details h4 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.summary-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #64748b;
}

.summary-date,
.summary-size,
.summary-type {
  display: inline-block;
}

/* Options Form */
.options-form {
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

.input-description {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.custom-select {
  width: 100%;
  max-width: 300px;
}

.path-input {
  max-width: 400px;
}

/* Confirmation Content */
.confirmation-content {
  padding: 24px;
}

.warning-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  border-radius: 12px;
  margin-bottom: 32px;
}

.warning-icon {
  color: #d97706;
  font-size: 32px;
  flex-shrink: 0;
}

.warning-content h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #92400e;
}

.warning-content p {
  margin: 0 0 12px;
  color: #92400e;
}

.warning-content ul {
  margin: 0;
  padding-left: 20px;
  color: #92400e;
}

.warning-content li {
  margin-bottom: 4px;
}

.summary-section {
  margin-bottom: 32px;
}

.summary-card {
  padding: 24px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-label {
  font-weight: 500;
  color: #475569;
}

.summary-value {
  font-weight: 600;
  color: #1e293b;
}

.action-section {
  margin-top: 32px;
}

.final-warning {
  margin-bottom: 24px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.restore-button {
  padding: 12px 32px;
  border-radius: 10px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
}

.restore-button:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

/* Progress Card */
.progress-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.progress-content {
  padding: 24px;
}

.progress-info {
  margin-bottom: 24px;
}

.progress-info h3 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #1e293b;
}

.progress-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  font-weight: 500;
  color: #475569;
}

.stat-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 18px;
}

.progress-bar-container {
  margin-bottom: 24px;
}

.main-progress {
  margin-bottom: 20px;
}

.sub-progress {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.sub-progress-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.progress-log {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.progress-log h4 {
  margin: 0;
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 16px;
  color: #1e293b;
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  font-family: monospace;
  font-size: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.info {
  color: #475569;
}

.log-entry.success {
  color: #10b981;
}

.log-entry.warning {
  color: #f59e0b;
}

.log-entry.error {
  color: #ef4444;
}

.log-time {
  color: #64748b;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
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

.stat-available {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.stat-selected {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-not-selected {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

.stat-restored {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-size {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
  }
  
  .backups-grid {
    grid-template-columns: 1fr;
  }
  
  .backup-card-content {
    flex-direction: column;
    text-align: center;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .progress-stats {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons .el-button {
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
  
  .backup-details {
    flex-direction: column;
    gap: 4px;
  }
  
  .summary-meta {
    flex-direction: column;
    gap: 4px;
  }
}

/* Switch styling */
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

/* Progress bar styling */
:deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

/* Card hover effects */
.tab-card:hover,
.progress-card:hover,
.stats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

/* Loading animation */
:deep(.el-progress-bar__inner) {
  transition: width 0.3s ease;
}

/* Log scrollbar */
.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.log-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
