<template>
  <el-card class="smart-details-container">
    <template #header>
      <div class="details-header">
        <el-page-header @back="goBack" :content="deviceName">
          <template #title>
            <div class="header-title">
              <Icon icon="mdi:harddisk" width="24" height="24" />
              <span>Szczegóły urządzenia</span>
            </div>
          </template>
          <template #extra>
            <el-tag type="info" size="large">
              {{ devicePath }}
            </el-tag>
          </template>
        </el-page-header>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="smart-tabs">
      <el-tab-pane label="Podstawowe informacje" name="basic">
        <DeviceBasicInfo 
          v-if="deviceData"
          :device="deviceData"
        />
      </el-tab-pane>
      
  <el-tab-pane label="Atrybuty SMART" name="attributes">
    <SmartAttributes 
      :attributes="deviceData?.ata_smart_attributes || {}" 
    />
  </el-tab-pane>
      
      <el-tab-pane label="Historia testów" name="tests">
        <TestHistory 
          v-if="deviceData?.test_history"
          :tests="deviceData.test_history"
        />
      </el-tab-pane>
      
      <el-tab-pane label="Surowe dane" name="raw">
        <pre class="raw-data">{{ rawData }}</pre>
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import DeviceBasicInfo from './DeviceBasicInfo.vue'
import SmartAttributes from './SmartAttributes.vue'
import TestHistory from './TestHistory.vue'

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

const route = useRoute()
const router = useRouter()

const devicePath = ref(decodeURIComponent(route.params.device))
const deviceData = ref(null)
const loading = ref(false)
const error = ref(null)
const activeTab = ref('basic')

const deviceName = computed(() => {
  return deviceData.value?.model || devicePath.value
})

const rawData = computed(() => {
  return JSON.stringify(deviceData.value, null, 2)
})

const goBack = () => {
  router.push('/storage/smart/devices')
}

const fetchDeviceDetails = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await axios.get(`/api/storage/smart/details/${encodeURIComponent(devicePath.value)}`)
    deviceData.value = response.data.data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to load device details'
    console.error('Error fetching device details:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchDeviceDetails)
</script>

<style scoped>
.smart-details-container {
  margin: 20px;
  min-height: calc(100vh - 120px);
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.smart-tabs {
  margin-top: 20px;
}

.raw-data {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  max-height: 600px;
  overflow: auto;
  font-family: monospace;
  white-space: pre-wrap;
}

:deep(.el-tabs__header) {
  margin-bottom: 20px;
}
</style>
