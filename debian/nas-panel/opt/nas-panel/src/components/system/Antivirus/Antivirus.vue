<template>
  <div class="antivirus-dashboard">
    <!-- Header Card -->
    <el-card class="dashboard-header" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Icon icon="mdi:shield-check" />
          </div>
          <div class="header-text">
            <h1>{{ $t('antivirus.title') }}</h1>
            <p class="subtitle">{{ $t('antivirus.subtitle') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              :type="activeTab === 'dashboard' ? 'primary' : 'default'"
              @click="activeTab = 'dashboard'"
            >
              <Icon icon="mdi:view-dashboard" />
              {{ $t('antivirus.dashboard') }}
            </el-button>
            <el-button 
              :type="activeTab === 'scanner' ? 'primary' : 'default'"
              @click="activeTab = 'scanner'"
            >
              <Icon icon="mdi:shield-scan" />
              {{ $t('antivirus.scanner') }}
            </el-button>
            <el-button 
              :type="activeTab === 'history' ? 'primary' : 'default'"
              @click="activeTab = 'history'"
            >
              <Icon icon="mdi:history" />
              {{ $t('antivirus.history') }}
            </el-button>
            <el-button 
              :type="activeTab === 'settings' ? 'primary' : 'default'"
              @click="activeTab = 'settings'"
            >
              <Icon icon="mdi:cog" />
              {{ $t('antivirus.settings') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Status Cards Grid -->
    <div v-if="activeTab === 'dashboard' || activeTab === 'scanner'" class="status-cards">
      <el-card class="status-card" shadow="hover">
        <div class="card-content">
          <div class="card-icon" :class="{ 'installed': packageInfo.installed, 'not-installed': !packageInfo.installed }">
            <Icon :icon="packageInfo.installed ? 'mdi:shield-check' : 'mdi:shield-off'" />
          </div>
          <div class="card-info">
            <h3>{{ $t('antivirus.status') }}</h3>
            <p class="status-value">
              <el-tag :type="packageInfo.installed ? 'success' : 'danger'" size="large">
                {{ packageInfo.installed ? $t('antivirus.installed') : $t('antivirus.not_installed') }}
              </el-tag>
            </p>
            <p class="status-detail">{{ statusText }}</p>
            <el-button 
              v-if="!packageInfo.installed"
              type="primary"
              size="small"
              @click="installAntivirus"
              :loading="installing"
              class="install-btn"
            >
              <Icon icon="mdi:download" />
              {{ $t('antivirus.install') }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card class="status-card" shadow="hover">
        <div class="card-content">
          <div class="card-icon db-icon">
            <Icon icon="mdi:database" />
          </div>
          <div class="card-info">
            <h3>{{ $t('antivirus.virus_db') }}</h3>
            <p class="status-value">{{ virusDbVersion || $t('antivirus.not_loaded') }}</p>
            <p class="status-detail">{{ lastUpdate ? $t('antivirus.last_update') + ': ' + lastUpdate : '' }}</p>
            <el-button 
              type="primary" 
              size="small" 
              @click="checkForUpdates"
              :loading="updating"
              :disabled="!packageInfo.installed"
            >
              <Icon icon="mdi:cloud-download" />
              {{ $t('antivirus.check_updates') }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card class="status-card" shadow="hover">
        <div class="card-content">
          <div class="card-icon version-icon">
            <Icon icon="mdi:tag" />
          </div>
          <div class="card-info">
            <h3>{{ $t('antivirus.version') }}</h3>
            <p class="status-value">{{ packageInfo.version || $t('antivirus.unknown') }}</p>
            <p class="status-detail">ClamAV Antivirus</p>
          </div>
        </div>
      </el-card>

      <el-card class="status-card" shadow="hover">
        <div class="card-content">
          <div class="card-icon realtime-icon">
            <Icon :icon="settings.realtimeProtection ? 'mdi:shield-sync' : 'mdi:shield-off'" />
          </div>
          <div class="card-info">
            <h3>{{ $t('antivirus.realtime_protection') }}</h3>
            <p class="status-value">
              <el-switch
                v-model="settings.realtimeProtection"
                :disabled="!packageInfo.installed"
                @change="toggleRealtimeProtection"
              />
            </p>
            <p class="status-detail">
              {{ settings.realtimeProtection ? $t('antivirus.realtime_active') : $t('antivirus.realtime_inactive') }}
            </p>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Scanner Tab -->
    <el-card v-if="activeTab === 'scanner'" class="scanner-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:shield-scan" />
            {{ $t('antivirus.scanner') }}
          </h2>
        </div>
      </template>

      <!-- Scan Type Selection -->
      <div class="scan-type-section">
        <h3 class="section-title">{{ $t('antivirus.select_scan_type') }}</h3>
        <div class="scan-type-grid">
          <el-card 
            class="scan-type-card" 
            :class="{ 'selected': scanType === 'quick' }"
            @click="scanType = 'quick'"
            shadow="hover"
          >
            <div class="scan-type-content">
              <div class="scan-type-icon quick-icon">
                <Icon icon="mdi:lightning-bolt" />
              </div>
              <div class="scan-type-info">
                <h4>{{ $t('antivirus.quick_scan') }}</h4>
                <p class="scan-description">{{ $t('antivirus.quick_scan_desc') }}</p>
                <el-tag type="info" size="small">
                  <Icon icon="mdi:clock-fast" />
                  ~2 {{ $t('antivirus.minutes') }}
                </el-tag>
              </div>
            </div>
          </el-card>

          <el-card 
            class="scan-type-card"
            :class="{ 'selected': scanType === 'full' }"
            @click="scanType = 'full'"
            shadow="hover"
          >
            <div class="scan-type-content">
              <div class="scan-type-icon full-icon">
                <Icon icon="mdi:harddisk" />
              </div>
              <div class="scan-type-info">
                <h4>{{ $t('antivirus.full_scan') }}</h4>
                <p class="scan-description">{{ $t('antivirus.full_scan_desc') }}</p>
                <el-tag type="warning" size="small">
                  <Icon icon="mdi:clock" />
                  ~20 {{ $t('antivirus.minutes') }}
                </el-tag>
              </div>
            </div>
          </el-card>

          <el-card 
            class="scan-type-card"
            :class="{ 'selected': scanType === 'custom' }"
            @click="scanType = 'custom'"
            shadow="hover"
          >
            <div class="scan-type-content">
              <div class="scan-type-icon custom-icon">
                <Icon icon="mdi:folder-cog" />
              </div>
              <div class="scan-type-info">
                <h4>{{ $t('antivirus.custom_scan') }}</h4>
                <p class="scan-description">{{ $t('antivirus.custom_scan_desc') }}</p>
                <el-tag type="success" size="small">
                  <Icon icon="mdi:folder-multiple" />
                  {{ $t('antivirus.custom_paths') }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- Custom Paths Input -->
      <div v-if="scanType === 'custom'" class="custom-paths-section">
        <h3 class="section-title">{{ $t('antivirus.custom_paths') }}</h3>
        <div class="paths-input-container">
          <el-input
            v-model="customPath"
            :placeholder="$t('antivirus.enter_path_placeholder')"
            @keyup.enter="addCustomPath"
            class="path-input"
          >
            <template #prepend>
              <Icon icon="mdi:folder" />
            </template>
            <template #append>
              <el-button @click="addCustomPath" type="primary">
                <Icon icon="mdi:plus" />
                {{ $t('antivirus.add') }}
              </el-button>
            </template>
          </el-input>
        </div>
        
        <div v-if="customPaths.length > 0" class="paths-list">
          <div class="paths-header">
            <span>{{ $t('antivirus.selected_paths') }} ({{ customPaths.length }})</span>
            <el-button @click="customPaths = []" type="text" size="small">
              <Icon icon="mdi:delete" />
              {{ $t('antivirus.clear_all') }}
            </el-button>
          </div>
          <div class="paths-tags">
            <el-tag
              v-for="(path, index) in customPaths"
              :key="index"
              closable
              @close="removeCustomPath(index)"
              class="path-tag"
            >
              <Icon icon="mdi:folder" />
              {{ path }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- Scan Controls -->
      <div class="scan-controls">
        <el-button
          type="primary"
          size="large"
          @click="startScan"
          :disabled="isScanning || !packageInfo.installed || (scanType === 'custom' && customPaths.length === 0)"
          :loading="isScanning"
          class="scan-button"
        >
          <Icon icon="mdi:shield-search" />
          {{ isScanning ? $t('antivirus.scanning') : $t('antivirus.start_scan') }}
        </el-button>
        
        <el-button
          v-if="isScanning"
          @click="stopScan"
          type="danger"
          size="large"
          class="stop-button"
        >
          <Icon icon="mdi:stop" />
          {{ $t('antivirus.stop_scan') }}
        </el-button>
        
        <el-button
          @click="clearResults"
          type="info"
          size="large"
          :disabled="isScanning"
        >
          <Icon icon="mdi:broom" />
          {{ $t('antivirus.clear_results') }}
        </el-button>
      </div>

      <!-- Scan Progress -->
      <div v-if="isScanning" class="scan-progress-section">
        <div class="progress-header">
          <h3>
            <Icon icon="mdi:progress-clock" />
            {{ $t('antivirus.scan_in_progress') }}
          </h3>
          <div class="progress-stats">
            <el-tag class="stat-tag">
              <Icon icon="mdi:clock-outline" />
              {{ $t('antivirus.duration') }}: {{ scanDuration }}
            </el-tag>
            <el-tag class="stat-tag">
              <Icon icon="mdi:file-document" />
              {{ $t('antivirus.scanned') }}: {{ scannedItems }}
            </el-tag>
            <el-tag v-if="currentFile" class="stat-tag file-tag">
              <Icon icon="mdi:file" />
              {{ currentFile.substring(0, 40) }}{{ currentFile.length > 40 ? '...' : '' }}
            </el-tag>
          </div>
        </div>
        
        <el-progress
          :percentage="scanProgress"
          :stroke-width="18"
          :text-inside="true"
          status="success"
          class="progress-bar"
        />
        
        <div class="progress-details">
          <div class="progress-info">
            <span>{{ scanProgress }}% {{ $t('antivirus.complete') }}</span>
            <span>{{ $t('antivirus.estimated_time') }}: {{ estimatedTime }}</span>
          </div>
        </div>
      </div>

      <!-- Event Stream -->
      <div v-if="isScanning || eventStream.length > 0" class="event-stream-section">
        <div class="section-header">
          <h3>
            <Icon icon="mdi:message-text" />
            {{ $t('antivirus.scan_log') }}
          </h3>
          <el-button @click="eventStream = []" type="text" size="small">
            <Icon icon="mdi:trash-can" />
            {{ $t('antivirus.clear_log') }}
          </el-button>
        </div>
        
        <el-card class="event-stream-card">
          <el-scrollbar height="250px">
            <div class="event-list">
              <div
                v-for="(event, index) in eventStream"
                :key="index"
                class="event-item"
                :class="event.type"
              >
                <div class="event-time">
                  <Icon icon="mdi:clock-outline" />
                  {{ event.time }}
                </div>
                <div class="event-content">
                  <Icon :icon="getEventIcon(event.type)" class="event-icon" />
                  <span>{{ event.message }}</span>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </div>

      <!-- Threats Detected -->
      <div v-if="detectedThreats.length > 0" class="threats-section">
        <div class="section-header">
          <h3 class="threats-title">
            <Icon icon="mdi:alert-octagon" />
            {{ $t('antivirus.detected_threats', { count: detectedThreats.length }) }}
          </h3>
          <div class="threats-actions">
            <el-button @click="removeAllThreats" type="danger" size="small">
              <Icon icon="mdi:delete" />
              {{ $t('antivirus.remove_all') }}
            </el-button>
            <el-button @click="quarantineAllThreats" type="warning" size="small">
              <Icon icon="mdi:lock" />
              {{ $t('antivirus.quarantine_all') }}
            </el-button>
          </div>
        </div>
        
        <el-table
          :data="detectedThreats"
          height="300"
          stripe
          class="threats-table"
        >
          <el-table-column prop="name" :label="$t('antivirus.threat_name')" width="200">
            <template #default="{ row }">
              <div class="threat-name-cell">
                <Icon icon="mdi:bug" class="threat-icon" />
                <span class="threat-name">{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="path" :label="$t('antivirus.path')">
            <template #default="{ row }">
              <div class="file-path-cell">
                <Icon icon="mdi:file" />
                <span class="file-path">{{ row.path }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="severity" :label="$t('antivirus.severity')" width="120">
            <template #default="{ row }">
              <el-tag :type="row.severity === 'high' ? 'danger' : 'warning'" class="severity-tag">
                {{ row.severity || 'high' }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column :label="$t('antivirus.actions')" width="150" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-tooltip :content="$t('antivirus.quarantine')" placement="top">
                  <el-button @click="quarantineThreat(row)" type="warning" size="small" circle>
                    <Icon icon="mdi:lock" />
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('antivirus.remove')" placement="top">
                  <el-button @click="removeThreat(row)" type="danger" size="small" circle>
                    <Icon icon="mdi:delete" />
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('antivirus.ignore')" placement="top">
                  <el-button @click="ignoreThreat(row)" type="info" size="small" circle>
                    <Icon icon="mdi:eye-off" />
                  </el-button>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Scan Results Summary -->
      <div v-if="scanResults" class="results-summary">
        <el-card class="summary-card" shadow="hover">
          <div class="summary-content">
            <div class="summary-icon" :class="scanResults.threatsDetected > 0 ? 'danger' : 'success'">
              <Icon :icon="scanResults.threatsDetected > 0 ? 'mdi:alert-octagon' : 'mdi:shield-check'" />
            </div>
            <div class="summary-info">
              <h3>{{ $t('antivirus.scan_completed') }}</h3>
              <div class="summary-stats">
                <div class="stat-item">
                  <Icon icon="mdi:file-check" />
                  <span class="stat-label">{{ $t('antivirus.files_scanned') }}:</span>
                  <span class="stat-value">{{ scanResults.itemsScanned }}</span>
                </div>
                <div class="stat-item">
                  <Icon :icon="scanResults.threatsDetected > 0 ? 'mdi:alert' : 'mdi:shield'" />
                  <span class="stat-label">{{ $t('antivirus.threats_found') }}:</span>
                  <span class="stat-value" :class="{ 'danger': scanResults.threatsDetected > 0 }">
                    {{ scanResults.threatsDetected }}
                  </span>
                </div>
                <div class="stat-item">
                  <Icon icon="mdi:timer" />
                  <span class="stat-label">{{ $t('antivirus.total_time') }}:</span>
                  <span class="stat-value">{{ scanResults.duration }}</span>
                </div>
                <div v-if="scanResults.dataScanned" class="stat-item">
                  <Icon icon="mdi:database" />
                  <span class="stat-label">{{ $t('antivirus.data_scanned') }}:</span>
                  <span class="stat-value">{{ scanResults.dataScanned }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- History Tab -->
    <el-card v-if="activeTab === 'history'" class="history-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:history" />
            {{ $t('antivirus.scan_history') }}
          </h2>
          <div class="history-filters">
            <el-select
              v-model="historyFilter"
              :placeholder="$t('antivirus.filter_history')"
              class="filter-select"
            >
              <el-option :label="$t('antivirus.all_scans')" value="all" />
              <el-option :label="$t('antivirus.last_week')" value="week" />
              <el-option :label="$t('antivirus.last_month')" value="month" />
              <el-option :label="$t('antivirus.only_threats')" value="threats" />
            </el-select>
            <el-button @click="refreshHistory" type="primary">
              <Icon icon="mdi:refresh" />
              {{ $t('antivirus.refresh') }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="filteredHistory.length === 0" class="empty-history">
        <div class="empty-icon">
          <Icon icon="mdi:file-document-outline" />
        </div>
        <h3>{{ $t('antivirus.no_history') }}</h3>
        <p>{{ $t('antivirus.no_history_desc') }}</p>
      </div>

      <el-timeline v-else class="history-timeline">
        <el-timeline-item
          v-for="(scan, index) in filteredHistory"
          :key="index"
          :timestamp="formatDate(scan.timestamp)"
          placement="top"
          :type="scan.threatsDetected > 0 ? 'danger' : 'success'"
          :icon="scan.threatsDetected > 0 ? 'mdi:alert-octagon' : 'mdi:check-circle'"
          size="large"
        >
          <el-card class="history-item" shadow="hover">
            <div class="history-item-header">
              <div class="scan-info">
                <h4 class="scan-type">
                  <Icon :icon="getScanTypeIcon(scan.scanType)" />
                  {{ $t(`antivirus.scan_types.${scan.scanType}`) }}
                </h4>
                <div class="scan-stats">
                  <el-tag class="stat-badge">
                    <Icon icon="mdi:clock-outline" />
                    {{ scan.duration }}
                  </el-tag>
                  <el-tag class="stat-badge">
                    <Icon icon="mdi:file-document" />
                    {{ scan.itemsScanned }}
                  </el-tag>
                  <el-tag v-if="scan.threatsDetected > 0" type="danger" class="threat-badge">
                    <Icon icon="mdi:alert" />
                    {{ scan.threatsDetected }} {{ $t('antivirus.threats') }}
                  </el-tag>
                  <el-tag v-else type="success" class="safe-badge">
                    <Icon icon="mdi:shield-check" />
                    {{ $t('antivirus.safe') }}
                  </el-tag>
                </div>
              </div>
              <div class="history-actions">
                <el-button @click="showScanDetails(scan)" type="primary" text>
                  <Icon icon="mdi:information" />
                  {{ $t('antivirus.details') }}
                </el-button>
                <el-button @click="deleteScanHistory(scan.id)" type="danger" text>
                  <Icon icon="mdi:delete" />
                  {{ $t('antivirus.delete') }}
                </el-button>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- Settings Tab -->
    <el-card v-if="activeTab === 'settings'" class="settings-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <Icon icon="mdi:cog" />
            {{ $t('antivirus.settings') }}
          </h2>
        </div>
      </template>

      <el-form :model="settings" label-width="200px" class="settings-form">
        <el-form-item :label="$t('antivirus.auto_updates')">
          <el-switch
            v-model="settings.autoUpdate"
            :disabled="!packageInfo.installed"
            inline-prompt
            :active-text="$t('common.on')"
            :inactive-text="$t('common.off')"
          />
          <div class="setting-description">
            {{ $t('antivirus.auto_updates_desc') }}
          </div>
        </el-form-item>

        <el-form-item v-if="settings.autoUpdate" :label="$t('antivirus.update_frequency')">
          <el-select v-model="settings.updateFrequency" class="frequency-select">
            <el-option :label="$t('antivirus.daily')" value="daily">
              <template #default>
                <div class="option-content">
                  <Icon icon="mdi:calendar-today" />
                  <span>{{ $t('antivirus.daily') }}</span>
                </div>
              </template>
            </el-option>
            <el-option :label="$t('antivirus.weekly')" value="weekly">
              <template #default>
                <div class="option-content">
                  <Icon icon="mdi:calendar-week" />
                  <span>{{ $t('antivirus.weekly') }}</span>
                </div>
              </template>
            </el-option>
            <el-option :label="$t('antivirus.monthly')" value="monthly">
              <template #default>
                <div class="option-content">
                  <Icon icon="mdi:calendar-month" />
                  <span>{{ $t('antivirus.monthly') }}</span>
                </div>
              </template>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('antivirus.realtime_protection')">
          <el-switch
            v-model="settings.realtimeProtection"
            :disabled="!packageInfo.installed"
            inline-prompt
            :active-text="$t('common.on')"
            :inactive-text="$t('common.off')"
            @change="toggleRealtimeProtection"
          />
          <div class="setting-description">
            {{ $t('antivirus.realtime_protection_desc') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('antivirus.threat_notifications')">
          <el-switch
            v-model="settings.notifications"
            inline-prompt
            :active-text="$t('common.on')"
            :inactive-text="$t('common.off')"
          />
          <div class="setting-description">
            {{ $t('antivirus.threat_notifications_desc') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('antivirus.scan_schedule')">
          <el-time-select
            v-model="settings.scanSchedule"
            :placeholder="$t('antivirus.select_time')"
            start="00:00"
            step="01:00"
            end="23:00"
            :disabled="!packageInfo.installed"
          />
          <div class="setting-description">
            {{ $t('antivirus.scan_schedule_desc') }}
          </div>
        </el-form-item>

        <el-divider />

        <el-form-item>
          <div class="form-actions">
            <el-button type="primary" @click="saveSettings" :loading="savingSettings">
              <Icon icon="mdi:content-save" />
              {{ $t('antivirus.save_settings') }}
            </el-button>
            <el-button @click="resetSettings">
              <Icon icon="mdi:restore" />
              {{ $t('antivirus.reset_defaults') }}
            </el-button>
            <el-button @click="checkForUpdates" type="success" :loading="updating">
              <Icon icon="mdi:cloud-download" />
              {{ $t('antivirus.check_updates_now') }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Reactive state
const activeTab = ref('dashboard');
const scanType = ref('quick');
const customPath = ref('');
const customPaths = ref([]);
const isScanning = ref(false);
const scanProgress = ref(0);
const scannedItems = ref(0);
const scanDuration = ref('0:00');
const eventStream = ref([]);
const detectedThreats = ref([]);
const scanResults = ref(null);
const packageInfo = ref({ installed: false });
const virusDbVersion = ref(null);
const lastUpdate = ref(null);
const status = ref('loading');
const historyFilter = ref('all');
const scanHistory = ref([]);
const currentEventSource = ref(null);
const settings = ref({
  autoUpdate: true,
  updateFrequency: 'daily',
  realtimeProtection: false,
  notifications: true,
  scanSchedule: '02:00'
});
const currentFile = ref('');
const estimatedTime = ref('--:--');
const installing = ref(false);
const updating = ref(false);
const savingSettings = ref(false);
const realtimeEventSource = ref(null);

// Computed
const statusText = computed(() => {
  if (!packageInfo.value.installed) return t('antivirus.not_installed');
  return packageInfo.value.active ? t('antivirus.status_active') : t('antivirus.status_inactive');
});

const filteredHistory = computed(() => {
  const now = new Date();
  return scanHistory.value.filter(scan => {
    if (historyFilter.value === 'all') return true;
    if (historyFilter.value === 'week') {
      const scanDate = new Date(scan.timestamp);
      return (now - scanDate) <= 7 * 24 * 60 * 60 * 1000;
    }
    if (historyFilter.value === 'month') {
      const scanDate = new Date(scan.timestamp);
      return (now - scanDate) <= 30 * 24 * 60 * 60 * 1000;
    }
    if (historyFilter.value === 'threats') {
      return scan.threatsDetected > 0;
    }
    return true;
  }).slice(0, 50); // Limit to 50 entries
});

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3000}`,
  timeout: 30000
});

// Methods
function getEventIcon(type) {
  const icons = {
    info: 'mdi:information',
    status: 'mdi:information',
    warning: 'mdi:alert',
    danger: 'mdi:alert-octagon',
    threat: 'mdi:alert-octagon',
    success: 'mdi:check-circle',
    file_scanned: 'mdi:file-document'
  };
  return icons[type] || 'mdi:information';
}

function getScanTypeIcon(scanType) {
  const icons = {
    quick: 'mdi:lightning-bolt',
    full: 'mdi:harddisk',
    custom: 'mdi:folder-cog'
  };
  return icons[scanType] || 'mdi:shield-scan';
}

function addEvent(type, message) {
  const time = new Date().toLocaleTimeString();
  const event = { type, message, time };
  eventStream.value.unshift(event);
  
  if (eventStream.value.length > 100) {
    eventStream.value.pop();
  }
  
  if ((type === 'danger' || type === 'threat') && settings.value.notifications) {
    ElNotification.warning({
      title: t('antivirus.threat_detected'),
      message: message,
      position: 'bottom-right',
      duration: 5000
    });
  }
}

function addCustomPath() {
  const path = customPath.value.trim();
  if (!path) return;
  
  if (customPaths.value.includes(path)) {
    addEvent('warning', t('antivirus.path_already_added'));
    return;
  }
  
  customPaths.value.push(path);
  customPath.value = '';
  addEvent('success', t('antivirus.path_added', { path }));
}

function removeCustomPath(index) {
  const path = customPaths.value[index];
  customPaths.value.splice(index, 1);
  addEvent('info', t('antivirus.path_removed', { path }));
}

async function checkPackage() {
  try {
    const response = await api.get('/api/antivirus/status');
    packageInfo.value = response.data;
    status.value = response.data.active ? 'active' : 'inactive';
    
    if (response.data.lastUpdate) {
      lastUpdate.value = new Date(response.data.lastUpdate).toLocaleString();
    }
    
    console.log('Package info:', packageInfo.value);
  } catch (error) {
    console.error('Error checking package:', error);
    status.value = 'error';
    packageInfo.value.installed = false;
  }
}

async function checkVirusDb() {
  try {
    const response = await api.get('/api/antivirus/virusdb');
    virusDbVersion.value = response.data.version;
    lastUpdate.value = new Date(response.data.updatedAt).toLocaleString();
  } catch (error) {
    console.error('Error checking virus DB:', error);
    addEvent('warning', t('antivirus.virus_db_error'));
  }
}

async function startScan() {
  if (isScanning.value || !packageInfo.value.installed) return;
  
  try {
    if (scanType.value === 'custom' && customPaths.value.length === 0) {
      ElMessage.warning(t('antivirus.no_custom_paths'));
      return;
    }
    
    isScanning.value = true;
    scanProgress.value = 0;
    scannedItems.value = 0;
    scanDuration.value = '0:00';
    estimatedTime.value = '--:--';
    eventStream.value = [];
    detectedThreats.value = [];
    scanResults.value = null;
    currentFile.value = '';
    
    addEvent('info', t('antivirus.scan_starting'));
    
    // Close existing connection
    if (currentEventSource.value) {
      currentEventSource.value.close();
    }
    
    const scanParams = {
      scanType: scanType.value,
      paths: scanType.value === 'custom' ? customPaths.value : []
    };
    
    currentEventSource.value = new EventSource(
      `${api.defaults.baseURL}/api/antivirus/scan?` +
      new URLSearchParams({
        scanType: scanParams.scanType,
        paths: JSON.stringify(scanParams.paths)
      })
    );
    
    const startTime = Date.now();
    let progressInterval;
    
    // Update duration every second
    progressInterval = setInterval(() => {
      if (isScanning.value) {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        scanDuration.value = formatDuration(duration);
        
        // Estimate remaining time
        if (scanProgress.value > 0 && scanProgress.value < 100) {
          const elapsedSeconds = duration;
          const estimatedTotalSeconds = (elapsedSeconds * 100) / scanProgress.value;
          const remainingSeconds = estimatedTotalSeconds - elapsedSeconds;
          estimatedTime.value = formatDuration(Math.max(0, Math.floor(remainingSeconds)));
        }
      } else {
        clearInterval(progressInterval);
      }
    }, 1000);
    
    currentEventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleScanEvent(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    currentEventSource.value.onerror = (error) => {
      console.error('SSE error:', error);
      addEvent('error', t('antivirus.scanner_connection_error'));
      stopScan();
      if (progressInterval) clearInterval(progressInterval);
    };
    
    currentEventSource.value.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        scanProgress.value = data.progress || 0;
        scannedItems.value = data.itemsScanned || scannedItems.value;
        
        if (data.message) {
          addEvent('info', data.message);
        }
      } catch (error) {
        console.error('Error parsing progress:', error);
      }
    });
    
    currentEventSource.value.addEventListener('threat', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!detectedThreats.value.some(t => t.path === data.path && t.name === data.name)) {
          detectedThreats.value.push(data);
          addEvent('threat', t('antivirus.threat_detected_message', { name: data.name }));
        }
      } catch (error) {
        console.error('Error parsing threat:', error);
      }
    });
    
    currentEventSource.value.addEventListener('info', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.file) {
          currentFile.value = data.file;
        }
        if (data.message) {
          addEvent('info', data.message);
        }
      } catch (error) {
        console.error('Error parsing info:', error);
      }
    });
    
    currentEventSource.value.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleComplete(data);
        if (progressInterval) clearInterval(progressInterval);
      } catch (error) {
        console.error('Error parsing complete:', error);
      }
    });
    
    currentEventSource.value.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        addEvent('error', data.message);
      } catch (error) {
        console.error('Error parsing error event:', error);
      }
    });
    
  } catch (error) {
    console.error('Scan start error:', error);
    addEvent('error', t('antivirus.scan_start_error'));
    isScanning.value = false;
  }
}

function stopScan() {
  if (currentEventSource.value) {
    currentEventSource.value.close();
    currentEventSource.value = null;
  }
  
  isScanning.value = false;
  currentFile.value = '';
  addEvent('warning', t('antivirus.scan_stopped'));
}

function handleScanEvent(data) {
  if (data.progress !== undefined) {
    scanProgress.value = data.progress;
  }
  
  if (data.itemsScanned !== undefined) {
    scannedItems.value = data.itemsScanned;
  }
  
  if (data.threat) {
    if (!detectedThreats.value.some(t => t.path === data.threat.path && t.name === data.threat.name)) {
      detectedThreats.value.push(data.threat);
    }
  }
  
  if (data.message) {
    addEvent(data.type || 'info', data.message);
  }
}

function handleComplete(data) {
  isScanning.value = false;
  scanProgress.value = 100;
  currentFile.value = '';
  
  addEvent('success', t('antivirus.scan_complete'));
  
  scanResults.value = {
    scanType: scanType.value,
    timestamp: new Date().toISOString(),
    duration: scanDuration.value,
    itemsScanned: data.itemsScanned || scannedItems.value,
    threatsDetected: detectedThreats.value.length,
    threats: [...detectedThreats.value],
    dataScanned: data.dataScanned || '0 MB'
  };
  
  saveScanResults(scanResults.value);
  
  if (currentEventSource.value) {
    currentEventSource.value.close();
    currentEventSource.value = null;
  }
}

async function saveScanResults(results) {
  try {
    const response = await api.post('/api/antivirus/scan/history', results);
    scanHistory.value.unshift(response.data);
    addEvent('info', t('antivirus.scan_results_saved'));
  } catch (error) {
    console.error('Error saving scan results:', error);
    addEvent('error', t('antivirus.scan_results_save_error'));
  }
}

async function loadHistory() {
  try {
    const response = await api.get('/api/antivirus/scan/history');
    scanHistory.value = response.data;
  } catch (error) {
    console.error('Error loading history:', error);
    addEvent('error', t('antivirus.history_load_error'));
  }
}

async function loadSettings() {
  try {
    const response = await api.get('/api/antivirus/settings');
    settings.value = { ...settings.value, ...response.data };
  } catch (error) {
    console.error('Error loading settings:', error);
    addEvent('warning', t('antivirus.using_default_settings'));
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    const response = await api.put('/api/antivirus/settings', settings.value);
    settings.value = response.data;
    addEvent('success', t('antivirus.settings_saved'));
  } catch (error) {
    console.error('Error saving settings:', error);
    addEvent('error', t('antivirus.settings_save_error'));
  } finally {
    savingSettings.value = false;
  }
}

async function resetSettings() {
  try {
    await ElMessageBox.confirm(
      t('antivirus.reset_settings_confirm'),
      t('antivirus.reset_settings'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    const response = await api.delete('/api/antivirus/settings');
    settings.value = response.data;
    addEvent('success', t('antivirus.settings_reset'));
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Error resetting settings:', error);
      addEvent('error', t('antivirus.settings_reset_error'));
    }
  }
}

function toggleRealtimeProtection() {
  if (settings.value.realtimeProtection) {
    initRealTimeProtection();
  } else {
    if (realtimeEventSource.value) {
      realtimeEventSource.value.close();
      realtimeEventSource.value = null;
      addEvent('info', t('antivirus.realtime_deactivated'));
    }
  }
}

function initRealTimeProtection() {
  if (realtimeEventSource.value) {
    realtimeEventSource.value.close();
  }
  
  if (settings.value.realtimeProtection && packageInfo.value.installed) {
    realtimeEventSource.value = new EventSource(`${api.defaults.baseURL}/api/antivirus/realtime`);
    
    realtimeEventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          addEvent('info', data.message);
        }
      } catch (error) {
        console.error('Error parsing realtime event:', error);
      }
    };
    
    realtimeEventSource.value.onerror = (error) => {
      console.error('Realtime SSE error:', error);
      setTimeout(() => {
        if (settings.value.realtimeProtection) {
          initRealTimeProtection();
        }
      }, 5000);
    };
    
    addEvent('info', t('antivirus.realtime_activated'));
  }
}

async function checkForUpdates() {
  if (!packageInfo.value.installed) {
    ElMessage.warning(t('antivirus.install_first'));
    return;
  }
  
  updating.value = true;
  addEvent('info', t('antivirus.checking_updates'));
  
  try {
    const response = await api.post('/api/antivirus/update');
    virusDbVersion.value = response.data.version;
    lastUpdate.value = new Date(response.data.updatedAt).toLocaleString();
    addEvent('success', t('antivirus.virus_db_updated'));
  } catch (error) {
    console.error('Error checking updates:', error);
    addEvent('error', t('antivirus.virus_db_update_error'));
  } finally {
    updating.value = false;
  }
}

async function quarantineThreat(threat) {
  try {
    await ElMessageBox.confirm(
      t('antivirus.quarantine_confirm', { name: threat.name }),
      t('antivirus.quarantine'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    await api.post(`/api/antivirus/threats/${threat.id}/quarantine`);
    addEvent('success', t('antivirus.threat_quarantined'));
    removeFromList(threat);
  } catch (error) {
    if (error !== 'cancel') {
      addEvent('error', t('antivirus.quarantine_error'));
    }
  }
}

async function quarantineAllThreats() {
  if (detectedThreats.value.length === 0) return;
  
  try {
    await ElMessageBox.confirm(
      t('antivirus.quarantine_all_confirm', { count: detectedThreats.value.length }),
      t('antivirus.quarantine_all'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    for (const threat of detectedThreats.value) {
      await api.post(`/api/antivirus/threats/${threat.id}/quarantine`);
    }
    
    addEvent('success', t('antivirus.all_threats_quarantined'));
    detectedThreats.value = [];
  } catch (error) {
    if (error !== 'cancel') {
      addEvent('error', t('antivirus.quarantine_all_error'));
    }
  }
}

async function removeThreat(threat) {
  try {
    await ElMessageBox.confirm(
      t('antivirus.remove_confirm', { name: threat.name }),
      t('antivirus.remove_threat'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'danger'
      }
    );
    
    await api.delete(`/api/antivirus/threats/${threat.id}`);
    addEvent('success', t('antivirus.threat_removed'));
    removeFromList(threat);
  } catch (error) {
    if (error !== 'cancel') {
      addEvent('error', t('antivirus.remove_error'));
    }
  }
}

async function removeAllThreats() {
  if (detectedThreats.value.length === 0) return;
  
  try {
    await ElMessageBox.confirm(
      t('antivirus.remove_all_confirm', { count: detectedThreats.value.length }),
      t('antivirus.remove_all_threats'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'danger'
      }
    );
    
    for (const threat of detectedThreats.value) {
      await api.delete(`/api/antivirus/threats/${threat.id}`);
    }
    
    addEvent('success', t('antivirus.all_threats_removed'));
    detectedThreats.value = [];
  } catch (error) {
    if (error !== 'cancel') {
      addEvent('error', t('antivirus.remove_all_error'));
    }
  }
}

function ignoreThreat(threat) {
  addEvent('info', t('antivirus.threat_ignored', { name: threat.name }));
  removeFromList(threat);
}

function removeFromList(threat) {
  const index = detectedThreats.value.findIndex(t => t.path === threat.path);
  if (index !== -1) {
    detectedThreats.value.splice(index, 1);
  }
}

async function installAntivirus() {
  installing.value = true;
  try {
    await api.post('/api/antivirus/install');
    addEvent('success', t('antivirus.install_success'));
    await checkPackage();
    await checkVirusDb();
  } catch (error) {
    console.error('Error installing antivirus:', error);
    addEvent('error', t('antivirus.install_error'));
  } finally {
    installing.value = false;
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function showScanDetails(scan) {
  ElMessageBox.alert(
    `
    <div class="scan-details">
      <h3>${t('antivirus.scan_details_title')}</h3>
      <div class="detail-item">
        <strong>${t('antivirus.scan_type')}:</strong> ${t(`antivirus.scan_types.${scan.scanType}`)}
      </div>
      <div class="detail-item">
        <strong>${t('antivirus.date')}:</strong> ${formatDate(scan.timestamp)}
      </div>
      <div class="detail-item">
        <strong>${t('antivirus.duration')}:</strong> ${scan.duration}
      </div>
      <div class="detail-item">
        <strong>${t('antivirus.files_scanned')}:</strong> ${scan.itemsScanned}
      </div>
      <div class="detail-item">
        <strong>${t('antivirus.threats_detected')}:</strong> ${scan.threatsDetected}
      </div>
      ${scan.dataScanned ? `<div class="detail-item">
        <strong>${t('antivirus.data_scanned')}:</strong> ${scan.dataScanned}
      </div>` : ''}
    </div>
    `,
    t('antivirus.scan_details'),
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: t('common.close')
    }
  );
}

async function deleteScanHistory(id) {
  try {
    await ElMessageBox.confirm(
      t('antivirus.delete_history_confirm'),
      t('antivirus.delete_history'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    await api.delete(`/api/antivirus/scan/history/${id}`);
    scanHistory.value = scanHistory.value.filter(scan => scan.id !== id);
    addEvent('success', t('antivirus.history_deleted'));
  } catch (error) {
    if (error !== 'cancel') {
      addEvent('error', t('antivirus.history_delete_error'));
    }
  }
}

async function refreshHistory() {
  await loadHistory();
  addEvent('info', t('antivirus.history_refreshed'));
}

function clearResults() {
  detectedThreats.value = [];
  scanResults.value = null;
  eventStream.value = [];
  addEvent('info', t('antivirus.results_cleared'));
}

// Lifecycle
onMounted(() => {
  checkPackage();
  loadSettings();
  loadHistory();
  checkVirusDb();
  initRealTimeProtection();
});

onBeforeUnmount(() => {
  if (currentEventSource.value) {
    currentEventSource.value.close();
  }
  if (realtimeEventSource.value) {
    realtimeEventSource.value.close();
  }
});
</script>

<style scoped>
.antivirus-dashboard {
  padding: 20px;
  min-height: 100vh;
}

.dashboard-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  font-size: 32px;
}

.header-text h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
}

.subtitle {
  margin: 4px 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.status-card {
  background: white;
  border-radius: 16px;
  border: none;
  transition: all 0.3s ease;
}

.status-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.card-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 28px;
}

.card-icon.installed {
  background: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.card-icon.not-installed {
  background: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}

.card-icon.db-icon {
  background: rgba(64, 158, 255, 0.1);
  color: #409EFF;
}

.card-icon.version-icon {
  background: rgba(230, 162, 60, 0.1);
  color: #E6A23C;
}

.card-icon.realtime-icon {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.card-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.status-value {
  margin: 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.status-detail {
  margin: 4px 0 8px;
  color: #7f8c8d;
  font-size: 13px;
}

.scanner-card,
.history-card,
.settings-card {
  background: white;
  border-radius: 16px;
  border: none;
  margin-bottom: 24px;
}

.card-header {
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
  gap: 10px;
  font-size: 24px;
  color: #2c3e50;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #2c3e50;
}

.scan-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.scan-type-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.scan-type-card:hover {
  transform: translateY(-2px);
}

.scan-type-card.selected {
  border-color: #409EFF;
  background: rgba(64, 158, 255, 0.05);
}

.scan-type-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.scan-type-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 24px;
}

.scan-type-icon.quick-icon {
  background: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.scan-type-icon.full-icon {
  background: rgba(230, 162, 60, 0.1);
  color: #E6A23C;
}

.scan-type-icon.custom-icon {
  background: rgba(64, 158, 255, 0.1);
  color: #409EFF;
}

.scan-type-info h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #2c3e50;
}

.scan-description {
  margin: 0 0 12px 0;
  color: #7f8c8d;
  font-size: 13px;
  line-height: 1.4;
}

.custom-paths-section {
  margin-bottom: 24px;
}

.paths-input-container {
  margin-bottom: 16px;
}

.path-input {
  margin-bottom: 12px;
}

.paths-list {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.paths-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #5d6d7e;
}

.paths-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.path-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
}

.scan-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.scan-button,
.stop-button {
  padding: 12px 32px;
  border-radius: 12px;
  font-weight: 600;
}

.scan-progress-section {
  background: rgba(64, 158, 255, 0.05);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.progress-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
}

.progress-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-tag.file-tag {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar {
  margin: 16px 0;
  border-radius: 8px;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  color: #7f8c8d;
  font-size: 14px;
}

.event-stream-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
}

.event-stream-card {
  border-radius: 12px;
}

.event-list {
  padding: 4px;
}

.event-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-left: 4px solid transparent;
}

.event-item.info {
  border-left-color: #409EFF;
  background: rgba(64, 158, 255, 0.05);
}

.event-item.warning {
  border-left-color: #E6A23C;
  background: rgba(230, 162, 60, 0.05);
}

.event-item.danger,
.event-item.threat {
  border-left-color: #F56C6C;
  background: rgba(245, 108, 108, 0.05);
}

.event-item.success {
  border-left-color: #67C23A;
  background: rgba(103, 194, 58, 0.05);
}

.event-time {
  min-width: 80px;
  color: #909399;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.event-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.event-icon {
  width: 16px;
  height: 16px;
}

.threats-section {
  margin-bottom: 24px;
}

.threats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
}

.threats-actions {
  display: flex;
  gap: 8px;
}

.threats-table {
  border-radius: 12px;
  overflow: hidden;
}

.threat-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.threat-icon {
  color: #F56C6C;
}

.file-path-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-path {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #5d6d7e;
  word-break: break-all;
}

.severity-tag {
  border-radius: 20px;
  padding: 4px 12px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.results-summary {
  margin-bottom: 24px;
}

.summary-card {
  border-radius: 12px;
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
}

.summary-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  font-size: 40px;
}

.summary-icon.success {
  background: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.summary-icon.danger {
  background: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}

.summary-info h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
}

.stat-value.danger {
  color: #F56C6C;
}

.history-filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-select {
  width: 200px;
}

.empty-history {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 50%;
  color: #909399;
  font-size: 40px;
}

.empty-history h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.empty-history p {
  margin: 0;
  color: #7f8c8d;
}

.history-timeline {
  padding: 20px 0;
}

.history-item {
  border-radius: 12px;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.scan-info {
  flex: 1;
}

.scan-type {
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
}

.scan-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-badge,
.threat-badge,
.safe-badge {
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-actions {
  display: flex;
  gap: 8px;
}

.settings-form {
  max-width: 800px;
  padding: 20px 0;
}

.frequency-select {
  width: 200px;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-description {
  margin-top: 8px;
  color: #7f8c8d;
  font-size: 13px;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .header-actions .el-button-group {
    width: 100%;
    display: flex;
  }
  
  .header-actions .el-button {
    flex: 1;
  }
  
  .scan-type-grid {
    grid-template-columns: 1fr;
  }
  
  .progress-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .history-item-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .el-button {
    width: 100%;
  }
}

/* Icon styling */
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

:deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

:deep(.el-timeline-item__icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
