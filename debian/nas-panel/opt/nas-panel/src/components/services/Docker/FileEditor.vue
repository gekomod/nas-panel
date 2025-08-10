<template>
  <el-dialog 
    v-model="visible" 
    :title="`Edit Container: ${containerName}`" 
    width="80%"
    top="5vh"
    @close="resetForm"
  >
    <el-form :model="form" label-width="120px" label-position="top">
      <el-tabs type="border-card">
        <el-tab-pane label="Basic Settings">
          <el-form-item label="Container Name" prop="name">
            <el-input v-model="form.name" />
          </el-form-item>
          
          <el-form-item label="Image" prop="image">
            <el-select
              v-model="form.image"
              filterable
              remote
              :remote-method="searchImages"
              placeholder="Select or search for image"
            >
              <el-option
                v-for="img in availableImages"
                :key="img"
                :label="img"
                :value="img"
              />
            </el-select>
          </el-form-item>
          
          <el-form-item label="Command" prop="command">
            <el-input v-model="form.command" placeholder="Optional command to run" />
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="Network & Ports">
          <el-form-item label="Port Bindings">
            <div v-for="(port, index) in form.ports" :key="index" class="port-item">
              <el-input v-model="port.host" placeholder="Host port" style="width: 120px" />
              <span class="port-separator">:</span>
              <el-input v-model="port.container" placeholder="Container port" style="width: 120px" />
              <el-select v-model="port.protocol" style="width: 100px; margin-left: 10px">
                <el-option label="TCP" value="tcp" />
                <el-option label="UDP" value="udp" />
              </el-select>
              <el-button
                type="danger"
                circle
                size="small"
                @click="removePort(index)"
                style="margin-left: 10px"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
              </el-button>
            </div>
            <el-button @click="addPort" type="primary" plain>
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Add Port
            </el-button>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="Volumes">
          <el-form-item label="Volume Bindings">
            <div v-for="(volume, index) in form.volumes" :key="index" class="volume-item">
              <el-input v-model="volume.host" placeholder="Host path" style="flex: 1" />
              <span class="volume-separator">:</span>
              <el-input v-model="volume.container" placeholder="Container path" style="flex: 1" />
              <el-select v-model="volume.mode" style="width: 120px; margin-left: 10px">
                <el-option label="RW (Read-Write)" value="rw" />
                <el-option label="RO (Read-Only)" value="ro" />
              </el-select>
              <el-button
                type="danger"
                circle
                size="small"
                @click="removeVolume(index)"
                style="margin-left: 10px"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
              </el-button>
            </div>
            <el-button @click="addVolume" type="primary" plain>
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Add Volume
            </el-button>
          </el-form-item>
        </el-tab-pane>
        
        <el-tab-pane label="Environment">
          <el-form-item label="Environment Variables">
            <div v-for="(env, index) in form.env" :key="index" class="env-item">
              <el-input v-model="env.key" placeholder="Variable name" style="width: 200px" />
              <el-input v-model="env.value" placeholder="Value" style="flex: 1; margin-left: 10px" />
              <el-button
                type="danger"
                circle
                size="small"
                @click="removeEnv(index)"
                style="margin-left: 10px"
              >
                <el-icon><Icon icon="mdi:delete" /></el-icon>
              </el-button>
            </div>
            <el-button @click="addEnv" type="primary" plain>
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Add Variable
            </el-button>
          </el-form-item>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <template #footer>
      <el-button-group>
        <el-button @click="validateForm" :loading="validating">
          <el-icon><Icon icon="mdi:check-circle" /></el-icon> Validate
        </el-button>
        
        <el-button @click="resetToOriginal">
          <el-icon><Icon icon="mdi:restore" /></el-icon> Reset
        </el-button>
        
        <el-divider direction="vertical" />
        
        <el-button @click="visible = false">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="saveChanges" 
          :disabled="errors.length > 0"
          :loading="saving"
        >
          Save & Restart
        </el-button>
      </el-button-group>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

const props = defineProps({
  containerId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['container-updated']);

const visible = ref(false);
const form = ref({
  name: '',
  image: '',
  command: '',
  ports: [],
  volumes: [],
  env: []
});
const originalConfig = ref({});
const availableImages = ref([]);
const errors = ref([]);
const saving = ref(false);
const validating = ref(false);
const containerName = ref('');

const searchImages = async (query) => {
  if (query) {
    try {
      const response = await axios.get('/services/docker/images/search', {
        params: { q: query }
      });
      availableImages.value = response.data.images || [];
    } catch (error) {
      console.error('Error searching images:', error);
    }
  }
};

const addPort = () => {
  form.value.ports.push({
    host: '',
    container: '',
    protocol: 'tcp'
  });
};

const removePort = (index) => {
  form.value.ports.splice(index, 1);
};

const addVolume = () => {
  form.value.volumes.push({
    host: '',
    container: '',
    mode: 'rw'
  });
};

const removeVolume = (index) => {
  form.value.volumes.splice(index, 1);
};

const addEnv = () => {
  form.value.env.push({ key: '', value: '' });
};

const removeEnv = (index) => {
  form.value.env.splice(index, 1);
};

const validateForm = () => {
  validating.value = true;
  errors.value = [];
  
  // Basic validation
  if (!form.value.name) {
    errors.value.push('Container name is required');
  }
  
  if (!form.value.image) {
    errors.value.push('Image is required');
  }
  
  // Port validation
  form.value.ports.forEach((port, index) => {
    if (!port.host || !port.container) {
      errors.value.push(`Port mapping ${index + 1} is incomplete`);
    }
  });
  
  // Volume validation
  form.value.volumes.forEach((volume, index) => {
    if (!volume.host || !volume.container) {
      errors.value.push(`Volume mapping ${index + 1} is incomplete`);
    }
  });
  
  validating.value = false;
  
  if (errors.value.length === 0) {
    ElMessage.success('Configuration is valid');
  }
};

const resetForm = () => {
  form.value = JSON.parse(JSON.stringify(originalConfig.value));
  errors.value = [];
};

const resetToOriginal = () => {
  form.value = JSON.parse(JSON.stringify(originalConfig.value));
  ElMessage.info('Configuration reset to original values');
};

const openEditor = async (containerId, name) => {
  try {
    containerName.value = name;
    const response = await axios.get(`/services/docker/container/${containerId}/config`);
    originalConfig.value = response.data.config;
    form.value = JSON.parse(JSON.stringify(originalConfig.value));
    visible.value = true;
    
    // Load available images
    searchImages(form.value.image.split(':')[0]);
  } catch (error) {
    ElMessage.error('Failed to load container configuration');
  }
};

const saveChanges = async () => {
  saving.value = true;
  
  try {
    const response = await axios.put(`/services/docker/container/${props.containerId}/config`, {
      config: form.value
    });
    
    ElMessage.success(response.data.message || 'Container updated successfully');
    emit('container-updated');
    visible.value = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.message || 'Failed to update container');
  } finally {
    saving.value = false;
  }
};

defineExpose({ openEditor });
</script>

<style scoped>
.port-item,
.volume-item,
.env-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.port-separator,
.volume-separator {
  margin: 0 8px;
  color: #909399;
}

.el-tabs {
  margin-top: 10px;
}

.el-form-item {
  margin-bottom: 22px;
}
</style>