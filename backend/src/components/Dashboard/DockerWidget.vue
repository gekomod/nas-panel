<template>
  <el-card class="widget-card" shadow="hover">
    <template #header>
      <div class="widget-header">
        <Icon icon="mdi:docker" width="20" class="header-icon" />
        <span>Kontenery Docker</span>
        <el-tag :type="dockerStatusTagType" size="small" class="status-tag">
          {{ dockerStatusText }}
        </el-tag>
      </div>
    </template>

    <div v-if="!dockerRunning" class="docker-offline">
      <el-empty description="Docker jest wyłączony">
        <el-button 
          type="primary" 
          size="small"
          @click="startDocker"
          :loading="startingDocker"
        >
          <Icon icon="mdi:power" class="button-icon" />
          Uruchom Docker
        </el-button>
      </el-empty>
    </div>

    <div v-else v-loading="loading" class="widget-content">
      <div v-if="containers.length === 0" class="no-containers">
        <el-empty :image-size="100" description="Brak uruchomionych kontenerów" />
      </div>
      
      <div v-else v-for="container in containers" :key="container.id" class="container-item">
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const containers = ref([])
const loading = ref(false)
const dockerStatus = ref('unknown')
const startingDocker = ref(false)
let intervalId = null

const dockerRunning = computed(() => dockerStatus.value === 'active')
const dockerStatusText = computed(() => {
  return dockerStatus.value === 'active' ? 'Docker działa' : 'Docker wyłączony'
})
const dockerStatusTagType = computed(() => {
  return dockerStatus.value === 'active' ? 'success' : 'danger'
})

const fetchDockerStatus = async () => {
  try {
    const response = await axios.get('/services/docker/status')
    dockerStatus.value = response.data.status || 'unknown'
    
    // Pobierz kontenery tylko jeśli Docker jest uruchomiony
    if (dockerRunning.value) {
      await fetchContainers()
    } else {
      containers.value = []
    }
  } catch (error) {
    console.error('Błąd pobierania statusu Dockera:', error)
    dockerStatus.value = 'inactive'
  }
}

const fetchContainers = async () => {
  try {
    loading.value = true
    const response = await axios.get('/services/docker/containers', {
      params: { all: true }
    })
    
    let containersData = []
    
    if (Array.isArray(response.data)) {
      containersData = response.data
    } else if (response.data.containers) {
      containersData = response.data.containers
    } else if (response.data.data) {
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
    containers.value = []
  } finally {
    loading.value = false
  }
}

const startDocker = async () => {
  try {
    startingDocker.value = true
    await axios.post('/services/docker/start')
    ElMessage.success('Docker został uruchomiony')
    await fetchDockerStatus()
  } catch (error) {
    console.error('Błąd uruchamiania Dockera:', error)
    ElMessage.error('Nie udało się uruchomić Dockera')
  } finally {
    startingDocker.value = false
  }
}

const toggleContainer = async (container) => {
  try {
    container.loading = true
    const action = container.state === 'running' ? 'stop' : 'start'
    await axios.post(`/services/docker/container/${container.id}/${action}`)
    
    ElMessage.success(`Kontener ${container.names} ${action === 'stop' ? 'zatrzymany' : 'uruchomiony'}`)
    container.state = action === 'stop' ? 'exited' : 'running'
  } catch (error) {
    console.error('Błąd zmiany stanu kontenera:', error)
    ElMessage.error(`Nie udało się zmienić stanu kontenera ${container.names}`)
  } finally {
    container.loading = false
  }
}

onMounted(() => {
  fetchDockerStatus()
  intervalId = setInterval(fetchDockerStatus, 15000)
})

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

.status-tag {
  margin-left: auto;
}

.widget-content {
  padding: 2px 0;
  max-height: 200px;
  overflow-y: auto;
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

.docker-offline {
  padding: 20px 0;
  text-align: center;
}

.no-containers {
  padding: 20px 0;
}

.el-empty {
    --el-empty-padding: 0px !important;
}

.button-icon {
  margin-right: 5px;
}
</style>
