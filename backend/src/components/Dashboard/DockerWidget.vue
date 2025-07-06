<template>
  <el-card class="widget-card" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:docker" width="20" class="header-icon" />
        <span>Kontenery Docker</span>
      </div>
    </template>

    <div v-loading="loading" class="widget-content">
      <div v-for="container in containers" :key="container.id" class="container-item">
        <div class="container-name">
          <span>{{ container.names }}</span>
        </div>
        
        <el-button
          :type="container.state === 'running' ? 'success' : 'danger'"
          size="small"
          plain
          @click="toggleContainer(container)"
          :loading="container.loading"
        >
          {{ container.state === 'running' ? 'Uruchomiony' : 'Zatrzymany' }}
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script>
export default {
  name: 'DockerWidget',
  displayName: 'Kontenery Docker'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const containers = ref([])
const loading = ref(false)
let intervalId = null

const fetchContainers = async () => {
  try {
    loading.value = true
    const response = await axios.get('/services/docker/containers',{
      params: { all: true }
    })
    
    // Handle different response formats
    let containersData = []
    
    if (Array.isArray(response.data)) {
      // If response is already an array
      containersData = response.data
    } else if (response.data.containers) {
      // If response is an object with containers property
      containersData = response.data.containers
    } else if (response.data.data) {
      // If response is nested under data property
      containersData = response.data.data
    }
    
    containers.value = containersData.map(container => ({
      id: container.ID || container.containerID,
      names: container.Names || container.containerNames,
      state: container.State || container.status,
      loading: false
    }))
    
  } catch (error) {
    console.error('Błąd pobierania kontenerów:', error)
    ElMessage.error('Nie udało się pobrać listy kontenerów')
    containers.value = [] // Set empty array on error
  } finally {
    loading.value = false
  }
}

const toggleContainer = async (container) => {
  try {
    container.loading = true
    const action = container.state === 'running' ? 'stop' : 'start'
    await axios.post(`/services/docker/container/${container.id}/${action}`)
    
    ElMessage.success(`Kontener ${container.name} ${action === 'stop' ? 'zatrzymany' : 'uruchomiony'}`)
    container.state = action === 'stop' ? 'exited' : 'running'
  } catch (error) {
    console.error('Błąd zmiany stanu kontenera:', error)
    ElMessage.error(`Nie udało się zmienić stanu kontenera ${container.name}`)
  } finally {
    container.loading = false
  }
}

onMounted(() => {
  fetchContainers()
  intervalId = setInterval(fetchContainers, 15000)
})

// Sprzątanie
onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.widget-card {
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

.container-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-light);
}

.container-item:last-child {
  border-bottom: none;
}

.container-name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}
</style>
