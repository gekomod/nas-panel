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
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredImages"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="Repository" label="Repository" />
      <el-table-column prop="Tag" label="Tag" width="120" />
      <el-table-column prop="ImageID" label="Image ID" width="200" />
      <el-table-column prop="CreatedSince" label="Created" width="120" />
      <el-table-column prop="Size" label="Size" width="120" />
      <el-table-column label="Actions" width="150">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="danger"
              @click="deleteImage(row.ImageID)"
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
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showPullDialog" title="Pull Image">
      <el-form :model="pullForm" label-width="120px">
        <el-form-item label="Image Name">
          <el-input v-model="pullForm.image" placeholder="e.g. nginx:latest" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPullDialog = false">Cancel</el-button>
        <el-button type="primary" @click="pullImage">Pull</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const images = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showPullDialog = ref(false);
const pullForm = ref({
  image: ''
});

const filteredImages = computed(() => {
  if (!searchQuery.value) return images.value;
  const query = searchQuery.value.toLowerCase();
  return images.value.filter(image => 
    image.Repository.toLowerCase().includes(query) ||
    image.Tag.toLowerCase().includes(query) ||
    image.ImageID.toLowerCase().includes(query)
  );
});

const fetchImages = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/images');
    images.value = response.data.images;
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
    
    const response = await axios.post('/services/docker/images/pull', {
      image: pullForm.value.image
    });
    
    ElMessage.success(response.data.message);
    await fetchImages();
  } catch (error) {
    ElMessage.error('Failed to pull image');
    console.error(error);
  } finally {
    loading.value = false;
    pullForm.value.image = '';
  }
};

const deleteImage = async (imageId) => {
  try {
    await ElMessageBox.confirm(
      'This will permanently delete the image. Continue?',
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    await axios.delete(`/services/docker/images/${imageId}`);
    ElMessage.success('Image deleted successfully');
    await fetchImages();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete image');
      console.error(error);
    }
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

onMounted(() => {
  fetchImages();
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
</style>
