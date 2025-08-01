<template>
  <div class="docker-images">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search images..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>

      <div class="actions">
        <el-button type="primary" @click="fetchImages">
          <Icon icon="mdi:refresh" class="icon" />
          Refresh
        </el-button>
        <el-button type="success" @click="showPullDialog = true">
          <Icon icon="mdi:download" class="icon" />
          Pull Image
        </el-button>
        <el-button type="info" @click="showRegistryDialog = true">
          <Icon icon="mdi:login" class="icon" />
          Registry Login
        </el-button>
        <el-button type="warning" @click="showAutoUpdateDialog = true">
          <Icon icon="mdi:update" class="icon" />
          Auto Update
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredImages"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="Repository" label="Repository" />
      <el-table-column prop="Tag" label="Tag" width="120" />0
      <el-table-column prop="ImageID" label="Image ID" width="200">
        <template #default="{row}">
          <el-tooltip :content="row.ImageID" placement="top">
            <span>{{ row.ImageID.substring(0, 12) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="CreatedSince" label="Created" width="120" />
      <el-table-column prop="Size" label="Size" width="120" />
      <el-table-column label="Status" width="120">
        <template #default="{row}">
          <el-tag :type="getUpdateStatus(row).type" size="small">
            {{ getUpdateStatus(row).text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="220">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="danger"
              @click="deleteImage(row)"
              :loading="deletingImage === row.ImageID"
            >
              <Icon icon="mdi:delete" />
            </el-button>
            <el-button
              size="small"
              type="primary"
              @click="runImage(row.Repository)"
            >
              <Icon icon="mdi:play" />
            </el-button>
            <el-button
              size="small"
              type="success"
              @click="updateImage(row)"
              :loading="updatingImage === row.ImageID"
            >
              <Icon icon="mdi:update" />
            </el-button>
            <el-button
              size="small"
              type="info"
              @click="inspectImage(row.ImageID)"
            >
              <Icon icon="mdi:information" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showPullDialog" title="Pull Image">
      <el-form :model="pullForm" label-width="120px">
        <el-form-item label="Image Name">
          <el-input v-model="pullForm.image" placeholder="e.g. nginx:latest" />
        </el-form-item>
        <el-form-item label="Registry" v-if="loggedInRegistries.length > 0">
          <el-select v-model="pullForm.registry" placeholder="Select registry">
            <el-option label="Docker Hub" value="" />
            <el-option
              v-for="registry in loggedInRegistries"
              :key="registry.server"
              :label="registry.server"
              :value="registry.server"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPullDialog = false">Cancel</el-button>
        <el-button type="primary" @click="pullImage">Pull</el-button>
      </template>
    </el-dialog>

    <!-- Registry Login Dialog -->
    <el-dialog v-model="showRegistryDialog" title="Registry Login">
      <el-form :model="registryForm" label-width="120px">
        <el-form-item label="Registry">
          <el-select v-model="registryForm.registry">
            <el-option label="Docker Hub" value="https://index.docker.io/v1/" />
            <el-option label="GitHub" value="ghcr.io" />
            <el-option label="Custom" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="registryForm.registry === 'custom'" label="Custom URL">
          <el-input v-model="registryForm.customUrl" />
        </el-form-item>
        <el-form-item label="Username">
          <el-input v-model="registryForm.username" />
        </el-form-item>
        <el-form-item label="Password">
          <el-input v-model="registryForm.password" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRegistryDialog = false">Cancel</el-button>
        <el-button type="primary" @click="loginToRegistry">Login</el-button>
      </template>
    </el-dialog>

    <!-- Auto Update Dialog -->
    <el-dialog v-model="showAutoUpdateDialog" title="Auto Update Settings" width="50%">
      <el-form label-width="200px">
        <el-form-item label="Enable Auto Update">
          <el-switch v-model="autoUpdateEnabled" />
        </el-form-item>
        <el-form-item label="Update Schedule">
          <el-select v-model="autoUpdateSchedule" :disabled="!autoUpdateEnabled">
            <el-option label="Daily" value="daily" />
            <el-option label="Weekly" value="weekly" />
            <el-option label="Monthly" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="Update Time">
          <el-time-picker 
            v-model="autoUpdateTime" 
            :disabled="!autoUpdateEnabled"
            format="HH:mm" 
            value-format="HH:mm"
          />
        </el-form-item>
        <el-form-item label="Images to Update">
          <el-select
            v-model="selectedImagesForUpdate"
            multiple
            filterable
            :disabled="!autoUpdateEnabled"
            style="width: 100%"
          >
            <el-option
              v-for="img in images"
              :key="img.Repository + ':' + img.Tag"
              :label="img.Repository + ':' + img.Tag"
              :value="img.Repository + ':' + img.Tag"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button 
            type="primary" 
            @click="saveAutoUpdateSettings"
            :disabled="!autoUpdateEnabled"
          >
            Save Settings
          </el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <!-- Inspect Dialog -->
    <el-dialog v-model="inspectDialogVisible" title="Image Details" width="70%">
      <pre class="inspect-data">{{ inspectData }}</pre>
      <template #footer>
        <el-button @click="inspectDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const images = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showPullDialog = ref(false);
const showRegistryDialog = ref(false);
const showAutoUpdateDialog = ref(false);
const inspectDialogVisible = ref(false);
const inspectData = ref('');
const reloadKey = inject('reloadKey');
const pullForm = ref({
  image: '',
  registry: ''
});
const registryForm = ref({
  registry: 'https://index.docker.io/v2/',
  customUrl: '',
  username: '',
  password: ''
});
const loggedInRegistries = ref([]);
const autoUpdateEnabled = ref(false);
const autoUpdateSchedule = ref('weekly');
const autoUpdateTime = ref('02:00');
const selectedImagesForUpdate = ref([]);
const deletingImage = ref(null);
const updatingImage = ref(null);

const filteredImages = computed(() => {
  if (!searchQuery.value) return images.value;
  const query = searchQuery.value.toLowerCase();
  return images.value.filter(image => 
    image.Repository?.toLowerCase().includes(query) ||
    image.Tag?.toLowerCase().includes(query) ||
    image.ImageID?.toLowerCase().includes(query)
  );
});

const getUpdateStatus = (image) => {
  const fullName = `${image.Repository}:${image.Tag}`;
  const isAutoUpdated = selectedImagesForUpdate.value.includes(fullName);
  
  return {
    type: isAutoUpdated ? 'success' : 'info',
    text: isAutoUpdated ? 'Auto-update' : 'Manual'
  };
};

const fetchImages = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/images');
    images.value = response.data.images.map(img => ({
      Repository: img.Repository,
      Tag: img.Tag,
      ImageID: img.ID,
      CreatedSince: img.CreatedSince,
      Size: img.Size,
      // Dodaj pozostałe potrzebne pola
      Containers: img.Containers,
      VirtualSize: img.VirtualSize
    }));
    
    await fetchAutoUpdateSettings();
    await fetchLoggedInRegistries();
  } catch (error) {
    ElMessage.error('Failed to fetch images');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const pullImage = async () => {
  try {
    if (!pullForm.value.image) {
      ElMessage.warning('Please enter an image name');
      return;
    }

    loading.value = true;
    showPullDialog.value = false;

    let imageToPull = pullForm.value.image;
    if (pullForm.value.registry) {
      imageToPull = `${pullForm.value.registry}/${imageToPull}`;
    }

    const response = await axios.post('/services/docker/images/pull', {
      image: imageToPull
    });
    
    ElMessage.success(response.data.message);
    await fetchImages();
  } catch (error) {
    ElMessage.error('Failed to pull image');
    console.error(error);
  } finally {
    loading.value = false;
    pullForm.value.image = '';
    pullForm.value.registry = '';
  }
};

const deleteImage = async (image) => {
  try {
    await ElMessageBox.confirm(
      `This will permanently delete the image ${image.Repository}:${image.Tag}. Continue?`,
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    deletingImage.value = image.ImageID;
    await axios.delete('/services/docker/images/remove', {
      params: {
        image: `${image.Repository}:${image.Tag}`
      }
    });
    
    ElMessage.success('Image deleted successfully');
    await fetchImages();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete image');
      console.error(error);
    }
  } finally {
    deletingImage.value = null;
  }
};

const updateImage = async (image) => {
  try {
    updatingImage.value = image.ImageID;
    const response = await axios.post('/services/docker/images/pull', {
      image: `${image.Repository}:${image.Tag}`
    });
    
    ElMessage.success(response.data.message || 'Image updated successfully');
    await fetchImages();
  } catch (error) {
    ElMessage.error('Failed to update image');
    console.error(error);
  } finally {
    updatingImage.value = null;
  }
};

const runImage = async (repository) => {
  try {
    await axios.post('/services/docker/containers/create', {
      image: repository
    });
    ElMessage.success('Container created successfully');
  } catch (error) {
    ElMessage.error('Failed to create container');
    console.error(error);
  }
};

const inspectImage = async (imageId) => {
  try {
    const response = await axios.get(`/services/docker/images/inspect/${imageId}`);
    inspectData.value = JSON.stringify(response.data, null, 2);
    inspectDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to inspect image');
    console.error(error);
  }
};

const loginToRegistry = async () => {
  try {
    const registryUrl = registryForm.value.registry === 'custom' ? 
      registryForm.value.customUrl : registryForm.value.registry;
      
    await axios.post('/services/docker/registry/login', {
      server: registryUrl,
      username: registryForm.value.username,
      password: registryForm.value.password
    });
    
    ElMessage.success('Logged in successfully');
    showRegistryDialog.value = false;
    registryForm.value = {
      registry: 'https://index.docker.io/v1/',
      customUrl: '',
      username: '',
      password: ''
    };
    await fetchLoggedInRegistries();
  } catch (error) {
    ElMessage.error('Login failed: ' + error.message);
    console.error(error);
  }
};

const fetchLoggedInRegistries = async () => {
  try {
    const response = await axios.get('/services/docker/registry/list');
    loggedInRegistries.value = response.data.registries || [];
  } catch (error) {
    console.error('Failed to fetch registry info:', error);
  }
};

const fetchAutoUpdateSettings = async () => {
  try {
    const response = await axios.get('/services/docker/auto-update');
    autoUpdateEnabled.value = response.data.enabled || false;
    autoUpdateSchedule.value = response.data.schedule || 'weekly';
    autoUpdateTime.value = response.data.time || '02:00';
    selectedImagesForUpdate.value = response.data.images || [];
  } catch (error) {
    console.error('Failed to fetch auto-update settings:', error);
  }
};

const saveAutoUpdateSettings = async () => {
  try {
    await axios.post('/services/docker/auto-update', {
      enabled: autoUpdateEnabled.value,
      schedule: autoUpdateSchedule.value,
      time: autoUpdateTime.value,
      images: selectedImagesForUpdate.value
    });
    
    ElMessage.success('Auto update settings saved');
    showAutoUpdateDialog.value = false;
  } catch (error) {
    ElMessage.error('Failed to save settings: ' + error.message);
    console.error(error);
  }
};

const checkForUpdates = async () => {
  try {
    const response = await axios.get('/services/docker/auto-update/check');
    if (response.data.updates?.length > 0) {
      ElMessage.info(`${response.data.updates.length} images have updates available`);
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
};

watch(reloadKey, () => {
  fetchImages();
});

onMounted(() => {
  fetchImages();
  setInterval(checkForUpdates, 3600000);
  checkForUpdates();
});
</script>

<style scoped>
.docker-images {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 10px;
}

.icon {
  margin-right: 5px;
}

.inspect-data {
  max-height: 60vh;
  overflow: auto;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
