<template>
  <el-card class="samba-status">
    <template #header>
      <div class="card-header">
        <h2>
          <el-icon><icon icon="mdi:server-network" /></el-icon>
          Status usługi Samba
        </h2>
      </div>
    </template>

    <el-descriptions :column="1" border>
      <el-descriptions-item label="Zainstalowana">
        <el-tag :type="status.installed ? 'success' : 'danger'">
          {{ status.installed ? 'Tak' : 'Nie' }}
        </el-tag>
        <el-button 
          v-if="!status.installed"
          type="primary"
          link
          @click="installSamba"
          :loading="installing"
        >
          (Zainstaluj Sambę)
        </el-button>
      </el-descriptions-item>
      
      <el-descriptions-item label="Status">
        <el-tag :type="getStatusTagType(status)">
          {{ getStatusText(status) }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <div class="actions">
      <el-button 
        type="primary" 
        @click="toggleSamba('start')"
        :disabled="status.running || !status.installed"
        :loading="loading"
      >
        <el-icon><icon icon="mdi:play" /></el-icon>
        Włącz
      </el-button>
      
      <el-button 
        type="danger" 
        @click="toggleSamba('stop')"
        :disabled="!status.running"
        :loading="loading"
      >
        <el-icon><icon icon="mdi:stop" /></el-icon>
        Wyłącz
      </el-button>
      
      <el-button 
        @click="restartSamba"
        :disabled="!status.running"
        :loading="restarting"
      >
        <el-icon><icon icon="mdi:refresh" /></el-icon>
        Restartuj
      </el-button>
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue'
import axios from 'axios';

const status = ref({
  installed: false,
  active: false,
  running: false
});
const loading = ref(false);
const restarting = ref(false);
const installing = ref(false);

onMounted(() => {
  checkStatus();
});

function getStatusTagType(status) {
  if (!status.installed) return 'danger';
  return status.running ? 'success' : 'warning';
}

function getStatusText(status) {
  if (!status.installed) return 'Nie zainstalowano';
  if (status.error) return 'Błąd: ' + status.error;
  return status.running ? 'Działa' : 'Zatrzymana';
}

async function checkStatus() {
  try {
    const response = await axios.get('/services/samba/status');
    status.value = {
      ...response.data,
      error: null
    };
  } catch (error) {
    status.value = {
      installed: false,
      active: false,
      running: false,
      error: error.response?.data?.error || 'Błąd połączenia'
    };
    console.error('Status check error:', error);
  }
}

async function toggleSamba(action) {
  loading.value = true;
  try {
    await axios.post('/services/samba/toggle', { action });
    ElMessage.success(`Usługa Samba ${action === 'start' ? 'włączona' : 'wyłączona'}`);
    await checkStatus();
  } catch (error) {
    ElMessage.error(`Błąd podczas ${action === 'start' ? 'włączania' : 'wyłączania'} usługi`);
  } finally {
    loading.value = false;
  }
}

async function restartSamba() {
  restarting.value = true;
  try {
    await axios.post('/services/samba/toggle', { action: 'stop' });
    await axios.post('/services/samba/toggle', { action: 'start' });
    ElMessage.success('Usługa Samba zrestartowana');
    await checkStatus();
  } catch (error) {
    ElMessage.error('Błąd podczas restartowania usługi');
  } finally {
    restarting.value = false;
  }
}

async function installSamba() {
  installing.value = true;
  try {
    await axios.post('/services/samba/install');
    ElMessage.success('Instalacja Samby rozpoczęta');
    await checkStatus();
  } catch (error) {
    ElMessage.error('Błąd podczas instalacji Samby');
  } finally {
    installing.value = false;
  }
}
</script>

<style scoped>
.samba-status {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.el-descriptions {
  margin-top: 20px;
}
</style>
