<template>
  <el-card class="widget-card" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:network" width="20" class="header-icon" />
        <span>Podstawowe informacje sieciowe</span>
      </div>
    </template>

    <div v-loading="loading" class="widget-content">
      <div v-for="iface in interfaces" :key="iface.device" class="interface-item">
        <div class="interface-name">
          <Icon :icon="iface.type === 'wireless' ? 'mdi:wifi' : 'mdi:ethernet'" width="16" />
          <span>{{ iface.device }}</span>
        </div>
        
        <div class="interface-details">
          <div class="detail-row">
            <span class="detail-label">Adres IP:</span>
            <span class="detail-value">{{ iface.address || 'Brak' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <el-tag :type="iface.status === 'up' ? 'success' : 'danger'" size="small">
              {{ iface.status === 'up' ? 'Aktywny' : 'Nieaktywny' }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'NetworkWidget',
  displayName: 'Interfejsy Sieciowe'
}
</script>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const interfaces = ref([])
const loading = ref(false)

const fetchInterfaces = async () => {
  try {
    loading.value = true
    const response = await axios.get('/network/interfaces')
    // Filtrujemy tylko aktywne interfejsy z adresem IP
    interfaces.value = response.data.filter(i => i.status === 'up' && i.address)
  } catch (error) {
    console.error('Błąd pobierania interfejsów:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchInterfaces()
})
</script>

<style scoped>
.network-widget {
  border-radius: 8px;
  height: 100%;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.header-icon {
  color: var(--el-color-primary);
}

.widget-content {
  padding: 2px 0;
}

.interface-item {
  border-bottom: 1px solid var(--el-border-color-light);
}

.interface-item:last-child {
  border-bottom: none;
}

.interface-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
}

.interface-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-value {
  font-size: 13px;
  font-family: monospace;
}
</style>
