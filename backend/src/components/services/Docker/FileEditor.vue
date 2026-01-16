<template>
  <el-dialog 
    v-model="visible" 
    :title="`Edit Container: ${containerName}`" 
    width="1000px"
    class="modern-editor-dialog"
    @close="resetForm"
  >
    <el-tabs type="card" class="editor-tabs">
      <el-tab-pane label="Basic Settings">
        <div class="tab-content">
          <el-form :model="form" label-position="top" class="compact-form">
            <el-form-item label="Container Name" prop="name">
              <el-input 
                v-model="form.name" 
                size="large"
                placeholder="e.g. my-container"
              />
            </el-form-item>
            
            <el-form-item label="Image" prop="image">
              <el-select
                v-model="form.image"
                filterable
                remote
                size="large"
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
              <el-input 
                v-model="form.command" 
                size="large"
                placeholder="Optional command to run" 
              />
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="Network & Ports">
        <div class="tab-content">
          <el-form label-position="top">
            <el-form-item label="Port Bindings">
              <div class="port-list">
                <div v-for="(port, index) in form.ports" :key="index" class="port-item">
                  <el-input 
                    v-model="port.host" 
                    placeholder="Host port" 
                    size="small"
                    class="port-input"
                  />
                  <span class="port-separator">:</span>
                  <el-input 
                    v-model="port.container" 
                    placeholder="Container port" 
                    size="small"
                    class="port-input"
                  />
                  <el-select 
                    v-model="port.protocol" 
                    size="small"
                    class="protocol-select"
                  >
                    <el-option label="TCP" value="tcp" />
                    <el-option label="UDP" value="udp" />
                  </el-select>
                  <el-button
                    type="danger"
                    circle
                    size="small"
                    @click="removePort(index)"
                    class="remove-btn"
                  >
                    <el-icon><Icon icon="mdi:delete" /></el-icon>
                  </el-button>
                </div>
                <el-button 
                  @click="addPort" 
                  type="primary" 
                  plain
                  size="small"
                  class="add-btn"
                >
                  <el-icon><Icon icon="mdi:plus" /></el-icon>
                  Add Port
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="Volumes">
        <div class="tab-content">
          <el-form label-position="top">
            <el-form-item label="Volume Bindings">
              <div class="volume-list">
                <div v-for="(volume, index) in form.volumes" :key="index" class="volume-item">
                  <el-input 
                    v-model="volume.host" 
                    placeholder="Host path" 
                    size="small"
                    class="volume-input"
                  />
                  <span class="volume-separator">:</span>
                  <el-input 
                    v-model="volume.container" 
                    placeholder="Container path" 
                    size="small"
                    class="volume-input"
                  />
                  <el-select 
                    v-model="volume.mode" 
                    size="small"
                    class="mode-select"
                  >
                    <el-option label="RW (Read-Write)" value="rw" />
                    <el-option label="RO (Read-Only)" value="ro" />
                  </el-select>
                  <el-button
                    type="danger"
                    circle
                    size="small"
                    @click="removeVolume(index)"
                    class="remove-btn"
                  >
                    <el-icon><Icon icon="mdi:delete" /></el-icon>
                  </el-button>
                </div>
                <el-button 
                  @click="addVolume" 
                  type="primary" 
                  plain
                  size="small"
                  class="add-btn"
                >
                  <el-icon><Icon icon="mdi:plus" /></el-icon>
                  Add Volume
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="Environment">
        <div class="tab-content">
          <el-form label-position="top">
            <el-form-item label="Environment Variables">
              <div class="env-list">
                <div v-for="(env, index) in form.env" :key="index" class="env-item">
                  <el-input 
                    v-model="env.key" 
                    placeholder="Variable name" 
                    size="small"
                    class="env-key"
                  />
                  <el-input 
                    v-model="env.value" 
                    placeholder="Value" 
                    size="small"
                    class="env-value"
                  />
                  <el-button
                    type="danger"
                    circle
                    size="small"
                    @click="removeEnv(index)"
                    class="remove-btn"
                  >
                    <el-icon><Icon icon="mdi:delete" /></el-icon>
                  </el-button>
                </div>
                <el-button 
                  @click="addEnv" 
                  type="primary" 
                  plain
                  size="small"
                  class="add-btn"
                >
                  <el-icon><Icon icon="mdi:plus" /></el-icon>
                  Add Variable
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="dialog-footer">
        <el-button-group>
          <el-button 
            @click="validateForm" 
            :loading="validating"
            size="large"
            class="action-btn"
          >
            <el-icon><Icon icon="mdi:check-circle" /></el-icon>
            Validate
          </el-button>
          
          <el-button 
            @click="resetToOriginal"
            size="large"
            class="action-btn"
          >
            <el-icon><Icon icon="mdi:restore" /></el-icon>
            Reset
          </el-button>
        </el-button-group>
        
        <div class="footer-right">
          <el-button 
            @click="visible = false"
            size="large"
          >
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="saveChanges" 
            :disabled="errors.length > 0"
            :loading="saving"
            size="large"
          >
            <el-icon><Icon icon="mdi:content-save" /></el-icon>
            Save & Restart
          </el-button>
        </div>
      </div>
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
  
  if (!form.value.name) {
    errors.value.push('Container name is required');
  }
  
  if (!form.value.image) {
    errors.value.push('Image is required');
  }
  
  form.value.ports.forEach((port, index) => {
    if (!port.host || !port.container) {
      errors.value.push(`Port mapping ${index + 1} is incomplete`);
    }
  });
  
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
.modern-editor-dialog {
  border-radius: 12px;
}

.modern-editor-dialog :deep(.el-dialog__header) {
  padding: 20px 24px;
  border-bottom: 1px solid var(--el-border-color-light);
  margin: 0;
}

.modern-editor-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.modern-editor-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid var(--el-border-color-light);
}

.editor-tabs {
  padding: 0 20px;
}

.tab-content {
  padding: 16px 0;
}

.compact-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.port-list,
.volume-list,
.env-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.port-item,
.volume-item,
.env-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.port-input,
.volume-input {
  width: 120px;
}

.protocol-select,
.mode-select {
  width: 120px;
}

.env-key {
  width: 200px;
}

.env-value {
  flex: 1;
}

.port-separator,
.volume-separator {
  color: var(--el-text-color-placeholder);
  font-weight: bold;
}

.add-btn {
  margin-top: 10px;
}

.remove-btn {
  margin-left: auto;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding-left: 15px;
  padding-right: 15px;
}

:deep(.el-tabs__header) {
  margin: 0;
}

:deep(.el-tabs__item) {
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
}

:deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
</style>