<template>
  <div class="docker-settings">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Icon icon="mdi:cog" /></el-icon>
          <span>Docker Configuration</span>
        </div>
      </template>

      <el-form :model="form" label-width="200px" label-position="left">
        <el-form-item label="Docker Daemon Port">
          <el-input-number v-model="form.daemonPort" :min="1" :max="65535" />
        </el-form-item>

        <el-form-item label="Enable IPv6">
          <el-switch v-model="form.ipv6Enabled" />
        </el-form-item>

        <el-form-item label="Default Logging Driver">
          <el-select v-model="form.loggingDriver" placeholder="Select logging driver">
            <el-option label="json-file" value="json-file" />
            <el-option label="syslog" value="syslog" />
            <el-option label="journald" value="journald" />
            <el-option label="gelf" value="gelf" />
            <el-option label="fluentd" value="fluentd" />
          </el-select>
        </el-form-item>

        <el-form-item label="Max Concurrent Downloads">
          <el-input-number v-model="form.maxConcurrentDownloads" :min="1" :max="10" />
        </el-form-item>

        <el-form-item label="Data Root Directory">
          <el-input v-model="form.dataRoot" placeholder="/var/lib/docker" />
        </el-form-item>
        
        <el-form-item label="Containerd Run Socket">
          <el-input v-model="form.containerd" placeholder="/run/containerd/containerd.sock" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveSettings">Save</el-button>
          <el-button @click="resetForm">Reset</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['save']);

const form = ref({
  daemonPort: 2375,
  ipv6Enabled: false,
  loggingDriver: 'json-file',
  maxConcurrentDownloads: 3,
  dataRoot: '/var/lib/docker',
  containerd: '/run/containerd/containerd.sock'
});

const loading = ref(true);
const saving = ref(false);
const settingsForm = ref(null);

// Initialize form with props
const initializeForm = () => {
  if (props.config) {
    form.value = {
      daemonPort: props.config.daemonPort || 2375,
      ipv6Enabled: props.config.ipv6Enabled || false,
      loggingDriver: props.config.loggingDriver || 'json-file',
      maxConcurrentDownloads: props.config.maxConcurrentDownloads || 3,
      dataRoot: props.config.dataRoot || '/var/lib/docker',
      containerd: props.config.containerd || '/run/containerd/containerd.sock'
    };
  }
  loading.value = false;
};

watch(() => props.config, (newConfig) => {
  if (newConfig) {
    form.value = { ...newConfig };
  }
}, { immediate: true });

const saveSettings = async () => {
  try {
    saving.value = true;
    await emit('save', form.value);
    ElMessage.success('Settings saved successfully');
  } catch (error) {
    ElMessage.error('Failed to save settings');
  } finally {
    saving.value = false;
  }
};

const resetForm = () => {
  initializeForm();
};

onMounted(() => {
  initializeForm();
});
</script>

<style scoped>
.docker-settings {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.el-form {
  max-width: 800px;
  margin-top: 20px;
}
</style>
