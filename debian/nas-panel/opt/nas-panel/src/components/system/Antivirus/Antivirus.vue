<template>
  <el-card class="antivirus-status">
    <template #header>
      <div class="card-header">
        <h2>
          <el-icon><icon icon="mdi:shield-check" /></el-icon>
          {{ $t('antivirus.title') }}
        </h2>
      </div>
    </template>

    <el-descriptions :column="1" border>
      <el-descriptions-item :label="$t('antivirus.installed')">
        <el-tag :type="packageInfo.installed ? 'success' : 'danger'">
          {{ packageInfo.installed ? $t('common.yes') : $t('common.no') }}
        </el-tag>
        <el-button 
          v-if="!packageInfo.installed"
          type="primary"
          link
          @click="installAntivirus"
          :loading="installing"
        >
          ({{ $t('antivirus.install') }})
        </el-button>
      </el-descriptions-item>
      
      <el-descriptions-item :label="$t('antivirus.status')">
        <el-tag :type="getStatusTagType(status)">
          {{ statusText }}
        </el-tag>
      </el-descriptions-item>

      <el-descriptions-item :label="$t('antivirus.version')">
        {{ packageInfo.version || $t('antivirus.unknown') }}
      </el-descriptions-item>

      <el-descriptions-item :label="$t('antivirus.virus_db')">
        {{ virusDbVersion || $t('antivirus.not_loaded') }}
        <el-button 
          type="primary"
          link
          @click="checkForUpdates"
          :loading="updating"
        >
          ({{ $t('antivirus.check_updates') }})
        </el-button>
      </el-descriptions-item>

      <el-descriptions-item :label="$t('antivirus.last_update')">
        {{ lastUpdate || $t('antivirus.never') }}
      </el-descriptions-item>
    </el-descriptions>

    <el-tabs v-model="activeTab" class="antivirus-tabs">
      <el-tab-pane :label="$t('antivirus.scanner')" name="scanner">
        <div class="scan-options">
          <el-radio-group v-model="scanType">
            <el-radio-button value="quick">
              <el-icon><icon icon="mdi:flash" /></el-icon>
              {{ $t('antivirus.quick_scan') }}
            </el-radio-button>
            <el-radio-button value="full">
              <el-icon><icon icon="mdi:harddisk" /></el-icon>
              {{ $t('antivirus.full_scan') }}
            </el-radio-button>
            <el-radio-button value="custom">
              <el-icon><icon icon="mdi:folder-multiple" /></el-icon>
              {{ $t('antivirus.custom_scan') }}
            </el-radio-button>
          </el-radio-group>

          <div v-if="scanType === 'custom'" class="custom-scan-paths">
            <el-input 
              v-model="customPath" 
              :placeholder="$t('antivirus.enter_path')"
              @keyup.enter="addCustomPath"
            >
              <template #append>
                <el-button @click="addCustomPath">
                  <el-icon><icon icon="mdi:plus" /></el-icon>
                </el-button>
              </template>
            </el-input>
            <div class="path-list">
              <el-tag
                v-for="(path, index) in customPaths"
                :key="index"
                closable
                @close="removeCustomPath(index)"
              >
                <el-icon><icon icon="mdi:folder" /></el-icon>
                {{ path }}
              </el-tag>
            </div>
          </div>

          <el-button 
            type="primary" 
            @click="startScan"
            :disabled="isScanning"
            :loading="isScanning"
            class="scan-button"
          >
            <el-icon><icon icon="mdi:shield-sync" /></el-icon>
            {{ isScanning ? $t('antivirus.scanning') : $t('antivirus.start_scan') }}
          </el-button>
        </div>

        <div v-if="isScanning || scanResults" class="scan-progress">
          <el-divider>
            <el-icon><icon icon="mdi:file-document-outline" /></el-icon>
            {{ $t('antivirus.scan_report') }}
          </el-divider>

          <div class="scan-stats">
            <el-space>
              <el-tag>
                <el-icon><icon icon="mdi:clock-outline" /></el-icon>
                {{ $t('antivirus.duration') }}: {{ scanDuration }}
              </el-tag>
              <el-tag>
                <el-icon><icon icon="mdi:file-tree" /></el-icon>
                {{ $t('antivirus.scanned') }}: {{ scannedItems }} {{ $t('antivirus.items') }}
              </el-tag>
            </el-space>
          </div>

          <el-progress 
            :percentage="scanProgress" 
            :stroke-width="20" 
            :text-inside="true"
            status="success"
            class="progress-bar"
          />

          <el-divider>
            <el-icon><icon icon="mdi:progress-upload" /></el-icon>
            {{ $t('antivirus.realtime_events') }}
          </el-divider>

          <div class="event-stream">
            <el-scrollbar height="200px" class="event-stream">
              <div 
                v-for="(event, index) in eventStream" 
                :key="index"
                class="event-item"
                :class="{
                  'info-event': event.type === 'info',
                  'warning-event': event.type === 'warning',
                  'danger-event': event.type === 'danger',
                  'success-event': event.type === 'success'
                }"
              >
                <el-icon>
                  <icon :icon="eventIcons[event.type]" />
                </el-icon>
                <span class="event-time">[{{ event.time }}]</span>
                {{ event.message }}
              </div>
            </el-scrollbar>
          </div>

          <div v-if="detectedThreats.length > 0" class="threats-detected">
            <el-divider>
              <el-icon><icon icon="mdi:alert-octagon" /></el-icon>
              {{ $t('antivirus.detected_threats', { count: detectedThreats.length }) }}
            </el-divider>

            <el-table :data="detectedThreats" height="250" border>
              <el-table-column prop="name" :label="$t('antivirus.threat_name')" width="180" />
              <el-table-column prop="path" :label="$t('antivirus.path')" />
              <el-table-column :label="$t('antivirus.actions')" width="200">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="removeThreat(row)">
                    <el-icon><icon icon="mdi:delete" /></el-icon>
                    {{ $t('antivirus.remove') }}
                  </el-button>
                  <el-button type="warning" size="small" @click="quarantineThreat(row)">
                    <el-icon><icon icon="mdi:content-cut" /></el-icon>
                    {{ $t('antivirus.quarantine') }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="$t('antivirus.history')" name="history">
        <div class="history-filters">
          <el-select v-model="historyFilter" :placeholder="$t('antivirus.filter_history')">
            <el-option :label="$t('antivirus.all_scans')" value="all" />
            <el-option :label="$t('antivirus.last_week')" value="week" />
            <el-option :label="$t('antivirus.last_month')" value="month" />
            <el-option :label="$t('antivirus.only_threats')" value="threats" />
          </el-select>

          <el-button @click="refreshHistory" type="primary">
            <el-icon><icon icon="mdi:refresh" /></el-icon>
            {{ $t('antivirus.refresh') }}
          </el-button>
        </div>

        <el-timeline class="history-list">
          <el-timeline-item
            v-for="(scan, index) in filteredHistory"
            :key="index"
            :timestamp="formatDate(scan.timestamp)"
            placement="top"
          >
            <el-card>
              <div class="history-item-header">
                <el-tag :type="scan.threatsDetected > 0 ? 'danger' : 'success'">
                  <el-icon>
                    <icon :icon="scan.threatsDetected > 0 ? 'mdi:alert-octagon' : 'mdi:check-circle'" />
                  </el-icon>
                  {{ $t(`antivirus.scan_types.${scan.scanType}`) }} {{ $t('antivirus.scan') }}
                </el-tag>
                <el-space>
                  <el-tag>
                    <el-icon><icon icon="mdi:clock-outline" /></el-icon>
                    {{ scan.duration }}
                  </el-tag>
                  <el-tag>
                    <el-icon><icon icon="mdi:file-tree" /></el-icon>
                    {{ scan.itemsScanned }} {{ $t('antivirus.items') }}
                  </el-tag>
                  <el-tag v-if="scan.threatsDetected > 0" type="danger">
                    <el-icon><icon icon="mdi:virus" /></el-icon>
                    {{ scan.threatsDetected }} {{ $t('antivirus.threats') }}
                  </el-tag>
                </el-space>
              </div>
              <el-button 
                @click="showScanDetails(scan)" 
                type="primary" 
                size="small"
                class="mt-2"
              >
                <el-icon><icon icon="mdi:information" /></el-icon>
                {{ $t('antivirus.details') }}
              </el-button>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </el-tab-pane>

      <el-tab-pane :label="$t('antivirus.settings')" name="settings">
        <el-form :model="settings" label-width="250px">
          <el-form-item :label="$t('antivirus.auto_updates')">
            <el-switch v-model="settings.autoUpdate" />
          </el-form-item>

          <el-form-item :label="$t('antivirus.update_frequency')" v-if="settings.autoUpdate">
            <el-select v-model="settings.updateFrequency">
              <el-option :label="$t('antivirus.daily')" value="daily" />
              <el-option :label="$t('antivirus.weekly')" value="weekly" />
              <el-option :label="$t('antivirus.monthly')" value="monthly" />
            </el-select>
          </el-form-item>

          <el-form-item :label="$t('antivirus.realtime_protection')">
            <el-switch v-model="settings.realtimeProtection" />
          </el-form-item>

          <el-form-item :label="$t('antivirus.threat_notifications')">
            <el-switch v-model="settings.notifications" />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="saveSettings">
              <el-icon><icon icon="mdi:content-save" /></el-icon>
              {{ $t('antivirus.save_settings') }}
            </el-button>
            <el-button @click="checkForUpdates">
              <el-icon><icon icon="mdi:cloud-download" /></el-icon>
              {{ $t('antivirus.check_updates') }}
            </el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElNotification } from 'element-plus';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

// Dane i stan
const activeTab = ref('scanner');
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
const packageInfo = ref({});
const virusDbVersion = ref(null);
const lastUpdate = ref(null);
const status = ref('loading');
const historyFilter = ref('all');
const scanHistory = ref([]);
const currentEventSource = ref(null);
const settings = ref({
  autoUpdate: true,
  updateFrequency: 'daily',
  realtimeProtection: true,
  notifications: true
});
const eventIcons = {
  info: 'mdi:information',
  warning: 'mdi:alert',
  danger: 'mdi:alert-octagon',
  success: 'mdi:check-circle'
};
const installing = ref(false);
const updating = ref(false);

const toggleLanguage = () => {
  locale.value = locale.value === 'pl' ? 'en' : 'pl';
};

// Obliczenia
const statusText = computed(() => {
  switch (status.value) {
    case 'active': return t('antivirus.status_active');
    case 'error': return t('antivirus.status_error');
    case 'disabled': return t('antivirus.status_disabled');
    default: return t('antivirus.status_loading');
  }
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
  });
});

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:3000`,
  timeout: 30000
})

// Metody
function getStatusTagType(status) {
  if (status === 'error') return 'danger';
  if (status === 'disabled') return 'warning';
  return 'success';
}

const addEvent = (type, message) => {
  const time = new Date().toLocaleTimeString();
  eventStream.value.unshift({
    type,
    message,
    time
  });
  
  if (eventStream.value.length > 100) {
    eventStream.value.pop();
  }
  
  if (type === 'danger') {
    ElNotification.error({
      title: t('antivirus.threat_detected'),
      message: message,
      position: 'bottom-right'
    });
  }
};

function addCustomPath() {
  const path = customPath.value.trim();
  if (path && !customPaths.value.includes(path)) {
    customPaths.value.push(path);
    customPath.value = '';
  } else if (customPaths.value.includes(path)) {
    addEvent('warning', t('antivirus.path_already_added'));
  }
}

function removeCustomPath(index) {
  customPaths.value.splice(index, 1);
}

async function checkPackage() {
  try {
    const response = await axios.get('/api/antivirus/status');
    packageInfo.value = response.data;
    status.value = response.data.installed ? 'active' : 'disabled';
    
    if (response.data.lastUpdate) {
      lastUpdate.value = new Date(response.data.lastUpdate).toLocaleString();
    }
  } catch (error) {
    status.value = 'error';
    addEvent('error', t('antivirus.package_status_error'));
  }
}

async function checkVirusDb() {
  try {
    const response = await axios.get('/api/antivirus/virusdb');
    virusDbVersion.value = response.data.version;
    lastUpdate.value = new Date(response.data.updatedAt).toLocaleString();
  } catch (error) {
    addEvent('warning', t('antivirus.virus_db_error'));
  }
}

async function startScan() {
  if (isScanning.value) return;
  
  isScanning.value = true;
  scanProgress.value = 0;
  scannedItems.value = 0;
  eventStream.value = [];
  detectedThreats.value = [];
  const startTime = new Date();

  const scanParams = {
    scanType: scanType.value,
    paths: scanType.value === 'custom' ? customPaths.value : []
  };

  try {
    if (currentEventSource.value) {
      currentEventSource.value.close();
    }

    currentEventSource.value = new EventSource(`${api.defaults.baseURL}/api/antivirus/scan?${new URLSearchParams({
      scanType: scanParams.scanType,
      paths: JSON.stringify(scanParams.paths)
    })}`);

    currentEventSource.value.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleScanEvent(data, startTime);
    };

    currentEventSource.value.onerror = (error) => {
      addEvent('error', t('antivirus.scanner_connection_error'));
      isScanning.value = false;
      if (currentEventSource.value) {
        currentEventSource.value.close();
      }
    };

    currentEventSource.value.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      addEvent('info', data.message);
    });

    currentEventSource.value.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      scanProgress.value = data.progress;
      scannedItems.value = data.itemsScanned;
      
      const currentTime = new Date();
      const durationInSeconds = Math.floor((currentTime - startTime) / 1000);
      scanDuration.value = formatDuration(durationInSeconds);
      
      addEvent('info', t('antivirus.scan_progress', { progress: data.progress, items: data.itemsScanned }));
    });

    currentEventSource.value.addEventListener('threat', (event) => {
      const data = JSON.parse(event.data);
      detectedThreats.value.push(data);
      addEvent('danger', t('antivirus.threat_detected_message', { name: data.name }));
      
      ElNotification.warning({
        title: t('antivirus.threat_detected_warning'),
        message: t('antivirus.threat_detected_path', { name: data.name, path: data.path }),
        position: 'bottom-right',
        duration: 0
      });
    });

    currentEventSource.value.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      isScanning.value = false;
      addEvent('success', t('antivirus.scan_complete'));
      
      scanResults.value = {
        scanType: scanType.value,
        timestamp: new Date().toISOString(),
        duration: scanDuration.value,
        itemsScanned: scannedItems.value,
        threatsDetected: detectedThreats.value.length,
        threats: detectedThreats.value
      };
      
      saveScanResults(scanResults.value);
      
      if (currentEventSource.value) {
        currentEventSource.value.close();
      }
    });

  } catch (error) {
    addEvent('error', t('antivirus.scan_start_error'));
    isScanning.value = false;
    if (currentEventSource.value) {
      currentEventSource.value.close();
    }
  }
}

function handleScanEvent(data, startTime) {
  scanProgress.value = data.progress;
  scannedItems.value = data.itemsScanned;
  
  if (data.event) {
    addEvent(data.event.type || 'info', data.event.message);
  }
  
  if (data.threat) {
    detectedThreats.value.push(data.threat);
  }
  
  if (data.complete) {
    isScanning.value = false;
    scanResults.value = {
      scanType: scanType.value,
      timestamp: new Date().toISOString(),
      duration: formatDuration(data.duration),
      itemsScanned: scannedItems.value,
      threatsDetected: detectedThreats.value.length,
      threats: detectedThreats.value
    };
    
    saveScanResults(scanResults.value);
  }
}

async function saveScanResults(results) {
  try {
    const response = await axios.post('/api/antivirus/scan/history', results);
    scanHistory.value.unshift(response.data);
    addEvent('info', t('antivirus.scan_results_saved'));
  } catch (error) {
    addEvent('error', t('antivirus.scan_results_save_error'));
  }
}

async function loadHistory() {
  try {
    const response = await axios.get('/api/antivirus/scan/history');
    scanHistory.value = response.data;
  } catch (error) {
    addEvent('error', t('antivirus.history_load_error'));
  }
}

async function loadSettings() {
  try {
    const response = await axios.get('/api/antivirus/settings');
    settings.value = response.data;
  } catch (error) {
    addEvent('warning', t('antivirus.using_default_settings'));
  }
}

async function saveSettings() {
  try {
    const response = await axios.put('/api/antivirus/settings', settings.value);
    settings.value = response.data;
    addEvent('info', t('antivirus.settings_saved'));
    
    if (realtimeEventSource.value) {
      realtimeEventSource.value.close();
      initRealTimeProtection();
    }
  } catch (error) {
    addEvent('error', t('antivirus.settings_save_error'));
  }
}

const realtimeEventSource = ref(null);

function initRealTimeProtection() {
  if (settings.value.realtimeProtection) {
    realtimeEventSource.value = new EventSource(`${api.defaults.baseURL}/api/antivirus/realtime`);
    
    realtimeEventSource.value.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addEvent(data.type || 'info', data.message);
      
      if (data.threat) {
        detectedThreats.value.unshift(data.threat);
      }
    };
    
    realtimeEventSource.value.onerror = (error) => {
      addEvent('error', t('antivirus.realtime_disconnected'));
      setTimeout(() => initRealTimeProtection(), 5000);
    };
    
    addEvent('info', t('antivirus.realtime_activated'));
  }
}

async function checkForUpdates() {
  updating.value = true;
  addEvent('info', t('antivirus.checking_updates'));
  try {
    const response = await axios.post('/api/antivirus/update');
    virusDbVersion.value = response.data.version;
    lastUpdate.value = new Date(response.data.updatedAt).toLocaleString();
    addEvent('info', t('antivirus.virus_db_updated'));
  } catch (error) {
    addEvent('error', t('antivirus.virus_db_update_error'));
  } finally {
    updating.value = false;
  }
}

async function quarantineThreat(threat) {
  try {
    await axios.post(`/api/antivirus/threats/${threat.id}/quarantine`);
    addEvent('info', t('antivirus.threat_quarantined'));
    refreshHistory();
  } catch (error) {
    addEvent('error', t('antivirus.quarantine_error'));
  }
}

async function removeThreat(threat) {
  try {
    await axios.delete(`/api/antivirus/threats/${threat.id}`);
    addEvent('info', t('antivirus.threat_removed'));
    refreshHistory();
  } catch (error) {
    addEvent('error', t('antivirus.remove_error'));
  }
}

async function installAntivirus() {
  installing.value = true;
  try {
    await axios.post('/api/antivirus/install');
    addEvent('info', t('antivirus.install_started'));
    await checkPackage();
  } catch (error) {
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
  ElMessage.info(t('antivirus.scan_details', {
    type: t(`antivirus.scan_types.${scan.scanType}`),
    date: formatDate(scan.timestamp)
  }));
}

async function refreshHistory() {
  await loadHistory();
  addEvent('info', t('antivirus.history_refreshed'));
}

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
.antivirus-status {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.antivirus-tabs {
  margin-top: 20px;
}

.scan-options {
  margin-bottom: 20px;
}

.custom-scan-paths {
  margin: 15px 0;
}

.path-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scan-button {
  margin-top: 15px;
}

.scan-progress {
  margin-top: 20px;
}

.progress-bar {
  margin: 20px 0;
}

.event-stream {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 20px;
}

.event-item {
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9rem;
}

.event-item:last-child {
  border-bottom: none;
}

.info-event {
  color: var(--el-color-primary);
}

.warning-event {
  color: var(--el-color-warning);
}

.danger-event {
  color: var(--el-color-danger);
  font-weight: 600;
}

.history-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.history-list {
  margin-top: 20px;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.event-item {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-time {
  color: var(--el-text-color-secondary);
  font-size: 0.8em;
  margin-right: 8px;
}

.info-event {
  color: var(--el-color-primary);
}

.warning-event {
  color: var(--el-color-warning);
}

.danger-event {
  color: var(--el-color-danger);
  font-weight: bold;
}

.success-event {
  color: var(--el-color-success);
}

.mt-2 {
  margin-top: 8px;
}
</style>
