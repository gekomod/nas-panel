<template>
  <el-descriptions :column="2" border>
    <el-descriptions-item :label="t('storageSmart.details.produce')">
      <el-tag>{{ device.model_family }}</el-tag>
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.model')">
      {{ device.model_name }}
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.serial')">
      {{ device.serial_number }}
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.capacity')">
      {{ formatBytes(device.user_capacity.bytes) }}
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.temperature')">
      <el-tag :type="getTempType(device.temperature.current)">
        {{ device.temperature.current }}°C
      </el-tag>
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.smartStatus')">
      <el-tag :type="getSmartStatusType(device.smart_status)" effect="dark">
        {{ getSmartStatusText(device.smart_status) }}
      </el-tag>
    </el-descriptions-item>

    <el-descriptions-item :label="t('storageSmart.details.powerCycleCount')">
      <el-tag type="info">
        {{ formatNumber(device.power_cycle_count) || t('common.na') }}
      </el-tag>
    </el-descriptions-item>
    
    <el-descriptions-item :label="t('storageSmart.details.powerOnHours')">
      <el-tag type="info">
        {{ formatNumber(device.power_on_time?.hours) || 0 }} {{ t('storageSmart.details.hours') }}
      </el-tag>
    </el-descriptions-item>

    <el-descriptions-item :label="t('storageSmart.details.firmware')">
      {{ device.firmware_version }}
    </el-descriptions-item>

    <el-descriptions-item :label="t('storageSmart.details.wwn')">
      {{ device.wwn.naa }}x{{ device.wwn.id }}
    </el-descriptions-item>

    <el-descriptions-item :label="t('storageSmart.details.interfaceSpeed')">
      <div class="speed-info">
        <div class="speed-current">
          <el-tag type="info">
            {{ formatSpeed(device.interface_speed?.current) }}
          </el-tag>
          <span class="speed-label">{{ t('storageSmart.details.currentSpeed') }}</span>
        </div>
        <div class="speed-max">
          <el-tag>
            {{ formatSpeed(device.interface_speed?.max) }}
          </el-tag>
          <span class="speed-label">{{ t('storageSmart.details.maxSpeed') }}</span>
        </div>
      </div>
    </el-descriptions-item>
  </el-descriptions>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals) + ' ' + sizes[i])
}

const formatNumber = (value) => {
  return value?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || '0'
}

const formatSpeed = (speed) => {
  if (!speed) return t('common.na')
  return speed.string || `${speed.units_per_second} Gb/s`
}

defineProps({
  device: {
    type: Object,
    required: true
  }
})

const getTempType = (temp) => {
  if (temp > 60) return 'danger'
  if (temp > 50) return 'warning'
  return 'success'
}

const getSmartStatusType = (smartStatus) => {
  if (!smartStatus) return 'info'
  return smartStatus.passed ? 'success' : 'danger'
}

const getSmartStatusText = (smartStatus) => {
  if (!smartStatus) return 'Nieznany'
  return smartStatus.passed ? 'PASSED' : 'FAILED'
}

</script>

<style scoped>
.speed-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.speed-current,
.speed-max {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 0.85em;
  color: var(--el-text-color-secondary);
}

:deep(.el-tag) {
  min-width: 80px;
  justify-content: center;
}
</style>
