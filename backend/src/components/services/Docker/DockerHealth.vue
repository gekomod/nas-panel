<template>
  <div class="docker-health">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Icon icon="mdi:heart-pulse" /></el-icon>
          <span>Docker Health</span>
        </div>
      </template>
      
      <div v-if="loading" class="loading">
        <el-icon class="is-loading"><Icon icon="mdi:loading" /></el-icon>
        Checking health...
      </div>
      
      <div v-else class="health-status">
        <el-alert
          :title="healthStatus.title"
          :type="healthStatus.type"
          :description="healthStatus.description"
          :closable="false"
          show-icon
        />
        
        <div class="health-details">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Status">
              <el-tag :type="health.healthy ? 'success' : 'danger'">
                {{ health.healthy ? 'Healthy' : 'Unhealthy' }}
              </el-tag>
            </el-descriptions-item>
            
            <el-descriptions-item label="Containers">
              {{ health.containersCount || 0 }}
            </el-descriptions-item>
            
            <el-descriptions-item label="Last Check">
              {{ formatTime(health.timestamp) }}
            </el-descriptions-item>
            
            <el-descriptions-item label="Recovered" v-if="health.recovered">
              <el-tag type="success">Yes</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <div class="health-actions">
          <el-button 
            @click="checkHealth" 
            :loading="loading"
            type="primary"
            size="small"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            Re-check
          </el-button>
          
          <el-button 
            @click="restartDocker"
            type="warning"
            size="small"
            v-if="!health.healthy"
          >
            <el-icon><Icon icon="mdi:restart" /></el-icon>
            Restart Docker
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';

const health = ref({});
const loading = ref(false);

const checkHealth = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/health', {
      timeout: 10000
    });
    health.value = response.data;
  } catch (error) {
    health.value = {
      healthy: false,
      error: error.message
    };
  } finally {
    loading.value = false;
  }
};

const restartDocker = async () => {
  try {
    await axios.post('/services/docker/restart');
    ElMessage.success('Docker restart initiated');
    setTimeout(() => checkHealth(), 5000);
  } catch (error) {
    ElMessage.error('Failed to restart Docker');
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleTimeString();
};

const healthStatus = computed(() => {
  if (health.value.healthy) {
    return {
      title: 'Docker is running normally',
      type: 'success',
      description: 'All systems operational'
    };
  } else {
    return {
      title: 'Docker issues detected',
      type: 'error',
      description: health.value.error || 'Unknown error'
    };
  }
});

onMounted(() => {
  checkHealth();
  // Sprawdzaj co 60 sekund
  setInterval(checkHealth, 60000);
});
</script>

<style scoped>
.docker-health {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
}

.health-status {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.health-details {
  margin-top: 10px;
}

.health-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}
</style>
