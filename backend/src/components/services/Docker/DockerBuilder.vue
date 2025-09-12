<template>
  <div class="docker-builder">
    <div class="header">
      <el-input
        v-model="searchQuery"
        placeholder="Search builds..."
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>

      <div class="actions">
        <el-button type="primary" @click="fetchBuilds">
          <Icon icon="mdi:refresh" class="icon" />
          Refresh
        </el-button>
        <el-button type="success" @click="showCreateDialog = true">
          <Icon icon="mdi:plus" class="icon" />
          New Build
        </el-button>
        <el-button type="info" @click="showImportDialog = true">
          <Icon icon="mdi:github" class="icon" />
          Import from GitHub
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredBuilds"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="name" label="Build Name" />
      <el-table-column prop="tag" label="Tag" width="120" />
      <el-table-column prop="status" label="Status" width="120">
        <template #default="{row}">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created" label="Created" width="180" />
      <el-table-column prop="size" label="Size" width="100" />
      <el-table-column label="Actions" width="200">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="primary"
              @click="runImage(row.name + ':' + row.tag)"
              :disabled="row.status !== 'success'"
            >
              <Icon icon="mdi:play" />
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteImage(row.name + ':' + row.tag)"
            >
              <Icon icon="mdi:delete" />
            </el-button>
            <el-button
              size="small"
              type="info"
              @click="showBuildLogs(row.buildId)"
            >
              <Icon icon="mdi:file-document" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create Build Dialog -->
    <el-dialog v-model="showCreateDialog" title="Create Docker Build" width="800px">
      <el-form :model="buildForm" label-width="120px">
        <el-form-item label="Build Name" required>
          <el-input v-model="buildForm.name" placeholder="my-app" />
        </el-form-item>
        <el-form-item label="Tag" required>
          <el-input v-model="buildForm.tag" placeholder="latest" />
        </el-form-item>
        <el-form-item label="Dockerfile Content" required>
          <el-input
            v-model="buildForm.dockerfile"
            type="textarea"
            :rows="15"
            placeholder="FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD [&quot;npm&quot;, &quot;start&quot;]"
          />
        </el-form-item>
        <el-form-item label="Build Context">
          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handleFileUpload"
            :file-list="buildForm.files"
            multiple
          >
            <el-button type="primary">Select Build Files</el-button>
            <template #tip>
              <div class="el-upload__tip">Select additional files needed for build</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="startBuild">Start Build</el-button>
      </template>
    </el-dialog>

    <!-- Import from GitHub Dialog -->
    <el-dialog v-model="showImportDialog" title="Import from GitHub" width="600px">
      <el-form :model="importForm" label-width="120px">
        <el-form-item label="GitHub URL" required>
          <el-input v-model="importForm.url" placeholder="https://github.com/user/repo" />
        </el-form-item>
        <el-form-item label="Branch">
          <el-input v-model="importForm.branch" placeholder="main" />
        </el-form-item>
        <el-form-item label="Dockerfile Path">
          <el-input v-model="importForm.dockerfilePath" placeholder="Dockerfile" />
        </el-form-item>
        <el-form-item label="Image Name" required>
          <el-input v-model="importForm.name" placeholder="my-app" />
        </el-form-item>
        <el-form-item label="Tag" required>
          <el-input v-model="importForm.tag" placeholder="latest" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImportDialog = false">Cancel</el-button>
        <el-button type="primary" @click="importFromGitHub">Import & Build</el-button>
      </template>
    </el-dialog>

    <!-- Build Logs Dialog -->
    <el-dialog v-model="logsDialogVisible" :title="`Build Logs: ${selectedBuildId}`" width="80%">
      <div class="logs-content">
        <div class="logs-header">
          <el-button @click="copyLogs" type="" class="copy-btn">
            <Icon icon="mdi:content-copy" />
            Copy
          </el-button>
        </div>
        <pre class="logs-output">{{ buildLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="logsDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>

    <!-- Build Progress Dialog -->
    <el-dialog v-model="progressDialogVisible" :title="`Building: ${currentBuildName}`" width="80%">
      <div class="progress-content">
        <el-progress :percentage="buildProgress" :status="buildStatus" />
        <div class="progress-logs">
          <pre>{{ progressLogs }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const builds = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const showImportDialog = ref(false);
const logsDialogVisible = ref(false);
const progressDialogVisible = ref(false);
const buildLogs = ref('');
const progressLogs = ref('');
const buildProgress = ref(0);
const buildStatus = ref('');
const currentBuildName = ref('');
const selectedBuildId = ref('');

const buildForm = ref({
  name: '',
  tag: 'latest',
  dockerfile: '',
  files: []
});

const importForm = ref({
  url: '',
  branch: 'main',
  dockerfilePath: 'Dockerfile',
  name: '',
  tag: 'latest'
});

const filteredBuilds = computed(() => {
  if (!searchQuery.value) return builds.value;
  const query = searchQuery.value.toLowerCase();
  return builds.value.filter(build => 
    build.name.toLowerCase().includes(query) ||
    build.tag.toLowerCase().includes(query) ||
    build.status.toLowerCase().includes(query)
  );
});

const getStatusType = (status) => {
  const statusMap = {
    success: 'success',
    building: 'warning',
    error: 'danger',
    pending: 'info'
  };
  return statusMap[status] || 'info';
};

const fetchBuilds = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/builds');
    builds.value = response.data.builds;
  } catch (error) {
    ElMessage.error('Failed to fetch builds');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const handleFileUpload = (file, fileList) => {
  buildForm.value.files = fileList;
};

const startBuild = async () => {
  try {
    if (!buildForm.value.name || !buildForm.value.dockerfile) {
      ElMessage.warning('Please provide build name and Dockerfile content');
      return;
    }

    currentBuildName.value = buildForm.value.name;
    progressDialogVisible.value = true;
    progressLogs.value = 'Starting build...\n';
    buildProgress.value = 0;
    buildStatus.value = '';

    const formData = new FormData();
    formData.append('name', buildForm.value.name);
    formData.append('tag', buildForm.value.tag);
    formData.append('dockerfile', buildForm.value.dockerfile);

    // Add files to form data
    buildForm.value.files.forEach((file, index) => {
      formData.append(`file${index}`, file.raw);
    });

    const response = await axios.post('/services/docker/build', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        buildProgress.value = percent;
        progressLogs.value += `Upload progress: ${percent}%\n`;
      }
    });

    // Monitor build progress
    const buildId = response.data.buildId;
    monitorBuildProgress(buildId);

  } catch (error) {
    ElMessage.error('Failed to start build');
    console.error(error);
    progressDialogVisible.value = false;
  }
};

const monitorBuildProgress = async (buildId) => {
  try {
    const eventSource = new EventSource(`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}/services/docker/build/${buildId}/progress`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.log) {
        progressLogs.value += data.log + '\n';
      }
      
      if (data.progress) {
        buildProgress.value = data.progress;
      }
      
      if (data.status) {
        buildStatus.value = data.status;
        
        if (data.status === 'success' || data.status === 'error') {
          eventSource.close();
          setTimeout(() => {
            progressDialogVisible.value = false;
            fetchBuilds();
          }, 2000);
        }
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      progressDialogVisible.value = false;
      ElMessage.error('Build monitoring failed');
    };

  } catch (error) {
    console.error('Build monitoring error:', error);
  }
};

const importFromGitHub = async () => {
  try {
    if (!importForm.value.url || !importForm.value.name) {
      ElMessage.warning('Please provide GitHub URL and image name');
      return;
    }

    currentBuildName.value = importForm.value.name;
    progressDialogVisible.value = true;
    progressLogs.value = 'Starting import from GitHub...\n';
    buildProgress.value = 0;

    const response = await axios.post('/services/docker/build/github', importForm.value);

    const buildId = response.data.buildId;
    monitorBuildProgress(buildId);

  } catch (error) {
    ElMessage.error('Failed to import from GitHub');
    console.error(error);
    progressDialogVisible.value = false;
  }
};

const runImage = async (imageName) => {
  try {
    await axios.post('/services/docker/container/create', {
      name: imageName.replace(':', '-'),
      image: imageName
    });
    ElMessage.success('Container created successfully');
  } catch (error) {
    ElMessage.error('Failed to create container');
    console.error(error);
  }
};

const deleteImage = async (imageName) => {
  try {
    await ElMessageBox.confirm(
      `Delete image "${imageName}"?`,
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    await axios.delete('/services/docker/images/remove', {
      params: { image: imageName }
    });
    
    ElMessage.success('Image deleted successfully');
    await fetchBuilds();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete image');
      console.error(error);
    }
  }
};

const showBuildLogs = async (buildId) => {
  try {
    selectedBuildId.value = buildId;
    const response = await axios.get(`/services/docker/build/${buildId}/logs`);
    buildLogs.value = response.data.logs;
    logsDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('Failed to get build logs');
    console.error(error);
  }
};

const copyLogs = () => {
  navigator.clipboard.writeText(buildLogs.value)
    .then(() => ElMessage.success('Logs copied to clipboard'))
    .catch(() => ElMessage.error('Failed to copy logs'));
};

onMounted(() => {
  fetchBuilds();
});
</script>

<style scoped>
.docker-builder {
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

.logs-content {
  display: flex;
  flex-direction: column;
  height: 60vh;
}

.logs-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.logs-output {
  flex-grow: 1;
  overflow: auto;
  background: #1e1e1e;
  color: #f0f0f0;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Roboto Mono', monospace;
  white-space: pre-wrap;
  line-height: 1.5;
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-logs {
  height: 300px;
  overflow: auto;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Roboto Mono', monospace;
}

.progress-logs pre {
  margin: 0;
  white-space: pre-wrap;
}
</style>
