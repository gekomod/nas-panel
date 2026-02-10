<template>
  <div class="docker-compose">
    <!-- Enhanced Header -->
    <div class="clean-header">
      <div class="header-left">
        <h2>
          <el-icon><Icon icon="mdi:docker" /></el-icon>
          Docker Compose
          <el-tag v-if="composeFiles.length > 0" type="info" size="small" class="ml-2">
            {{ composeFiles.length }} files
          </el-tag>
        </h2>
      </div>
      
      <div class="header-right">
        <el-input
          v-model="searchQuery"
          placeholder="Search compose files..."
          clearable
          size="small"
          style="width: 300px"
          @clear="fetchComposeFiles"
        >
          <template #prefix>
            <el-icon><Icon icon="mdi:magnify" /></el-icon>
          </template>
        </el-input>

        <div class="header-actions">
          <el-tooltip content="Refresh" placement="top">
            <el-button 
              type="info" 
              @click="fetchComposeFiles" 
              size="small"
              :loading="loading"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:refresh" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="New Compose File" placement="top">
            <el-button 
              type="primary" 
              @click="showCreateDialog = true" 
              size="small"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:plus" /></el-icon>
            </el-button>
          </el-tooltip>
          
          <el-tooltip content="Templates" placement="top">
            <el-button 
              type="success" 
              @click="loadTemplatesDialog" 
              size="small"
              class="action-btn"
            >
              <el-icon><Icon icon="mdi:file-download" /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- Main Table -->
    <div class="table-wrapper">
      <el-card shadow="never" class="clean-table-card" :class="{ 'empty': filteredComposeFiles.length === 0 }">
        <div v-if="filteredComposeFiles.length === 0 && !loading" class="empty-state">
          <el-icon size="64" class="empty-icon"><Icon icon="mdi:file-document-outline" /></el-icon>
          <h3>No Docker Compose files found</h3>
          <p>Create your first compose file to get started</p>
          <el-button type="primary" @click="showCreateDialog = true" size="small" class="create-btn">
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            Create your first compose
          </el-button>
        </div>
        
        <div v-else class="table-container">
          <el-table
            v-loading="loading"
            :data="filteredComposeFiles"
            class="clean-table"
            stripe
            @row-click="handleRowClick"
          >
            <el-table-column prop="name" label="File Name" min-width="250">
              <template #default="{row}">
                <div class="file-cell">
                  <el-icon class="file-icon"><Icon icon="mdi:file-document-outline" /></el-icon>
                  <div class="file-info">
                    <span class="file-name">{{ row.name }}</span>
                    <span class="file-date">{{ formatDate(row.modified) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column label="Status" width="150">
              <template #default="{row}">
                <el-tag 
                  :type="getContainerStatus(row).type" 
                  size="small"
                  :class="getContainerStatus(row).class"
                  class="status-tag"
                >
                  <el-icon :size="10" class="status-icon">
                    <Icon :icon="getContainerStatus(row).icon" />
                  </el-icon>
                  {{ getContainerStatus(row).text }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="Services" width="120">
              <template #default="{row}">
                <div class="services-cell">
                  <el-icon size="12" class="services-icon"><Icon icon="mdi:server" /></el-icon>
                  <span class="services-text">{{ row.servicesCount || '?' }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column label="Actions" width="240" fixed="right" class-name="actions-column">
              <template #default="{ row }">
                <div class="actions-container">
                  <div class="action-buttons">
                    <!-- Deploy/Stop button -->
                    <el-tooltip 
                      :content="getContainerStatus(row).text === 'Running' ? 'Stop' : 'Deploy'" 
                      placement="top"
                    >
                      <el-button
                        :type="getContainerStatus(row).text === 'Running' ? 'warning' : 'success'"
                        size="small"
                        circle
                        @click.stop="handleDeployStop(row)"
                        :loading="deployLoading[row.name]"
                        class="action-btn-circle"
                      >
                        <el-icon>
                          <Icon :icon="getContainerStatus(row).text === 'Running' ? 'mdi:stop' : 'mdi:play'" />
                        </el-icon>
                      </el-button>
                    </el-tooltip>
                    
                    <!-- Restart button -->
                    <el-tooltip content="Restart" placement="top">
                      <el-button
                        type="primary"
                        size="small"
                        circle
                        @click.stop="restartCompose(row)"
                        :loading="restartLoading[row.name]"
                        class="action-btn-circle"
                        :disabled="getContainerStatus(row).text !== 'Running'"
                      >
                        <el-icon><Icon icon="mdi:restart" /></el-icon>
                      </el-button>
                    </el-tooltip>
                    
                    <!-- Edit button -->
                    <el-tooltip content="Edit" placement="top">
                      <el-button
                        type="info"
                        size="small"
                        circle
                        @click.stop="editCompose(row.name)"
                        class="action-btn-circle"
                      >
                        <el-icon><Icon icon="mdi:pencil" /></el-icon>
                      </el-button>
                    </el-tooltip>
                    
                    <!-- Delete button -->
                    <el-tooltip content="Delete" placement="top">
                      <el-button
                        type="danger"
                        size="small"
                        circle
                        @click.stop="deleteCompose(row.name)"
                        :loading="deleteLoading[row.name]"
                        class="action-btn-circle"
                      >
                        <el-icon><Icon icon="mdi:delete" /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- Table footer -->
        <div class="table-footer" v-if="filteredComposeFiles.length > 0">
          <div class="footer-info">
            <span class="footer-text">
              Showing {{ filteredComposeFiles.length }} of {{ composeFiles.length }} files
            </span>
          </div>
          <div class="footer-actions">
            <el-button size="small" @click="showCreateDialog = true" class="footer-btn">
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              New Compose
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Create/Edit Compose Dialog -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingCompose ? 'Edit Docker Compose' : 'Create Docker Compose'" 
      width="800px"
      class="clean-dialog"
      @closed="resetCreateForm"
    >
      <div class="create-dialog-content">
        <el-form :model="composeForm" ref="composeFormRef" label-width="120px" label-position="top">
          <div class="form-row">
            <el-form-item 
              label="Container Name"
              prop="containerName"
              :rules="[
                { required: true, message: 'Container name is required', trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: 'Invalid container name' }
              ]"
              class="form-item-half"
            >
              <el-input 
                v-model="composeForm.containerName" 
                placeholder="my-awesome-app"
                @input="updateFilename"
                size="small"
              />
            </el-form-item>
            
            <el-form-item label="Filename" class="form-item-half">
              <el-input 
                v-model="composeForm.filename" 
                placeholder="docker-compose.yml" 
                size="small"
              >
                <template #append>
                  <span>.yml</span>
                </template>
              </el-input>
            </el-form-item>
          </div>
          
          <el-form-item label="Description">
            <el-input 
              v-model="composeForm.description" 
              type="textarea"
              :rows="2"
              placeholder="Brief description of this compose file"
              size="small"
            />
          </el-form-item>
          
          <el-form-item>
            <el-checkbox v-model="composeForm.autoStart" label="Start containers immediately" />
          </el-form-item>
          
          <el-form-item label="Compose Configuration">
            <div class="editor-header">
              <span>docker-compose.yml</span>
              <div class="editor-actions">
                <el-button size="small" @click="fillSampleConfig">
                  <el-icon><Icon icon="mdi:lightbulb-on" /></el-icon>
                  Sample
                </el-button>
                <el-button size="small" @click="formatYaml" type="primary">
                  <el-icon><Icon icon="mdi:code-braces" /></el-icon>
                  Format
                </el-button>
              </div>
            </div>
            <el-input
              v-model="composeForm.content"
              type="textarea"
              :rows="15"
              placeholder="version: '3'
services:
  web:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./html:/usr/share/nginx/html"
              class="code-editor"
              resize="none"
            />
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false" size="small">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="submitComposeForm"
            :loading="creatingCompose"
            size="small"
          >
            <el-icon><Icon icon="mdi:content-save" /></el-icon>
            {{ editingCompose ? 'Update' : 'Create' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Templates Dialog -->
    <el-dialog 
      v-model="showTemplatesDialog" 
      title="Docker Compose Templates" 
      width="800px"
      class="clean-dialog"
    >
      <div class="templates-header">
        <div class="filters-container">
          <el-input
            v-model="templateSearch"
            placeholder="Search templates..."
            size="small"
            class="search-input"
            clearable
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
        </div>
      </div>
      
      <div class="templates-grid">
        <div 
          v-for="template in filteredTemplates" 
          :key="template.name"
          class="template-card"
        >
          <div class="template-icon">
            <el-icon><Icon :icon="template.metadata?.icon || 'mdi:docker'" /></el-icon>
          </div>
          <div class="template-content">
            <h4 class="template-name">{{ template.name }}</h4>
            <p class="template-description">{{ template.description }}</p>
            <div class="template-meta">
              <span class="template-ports" v-if="template.metadata?.ports">
                <el-icon><Icon icon="mdi:network-outline" /></el-icon>
                {{ template.metadata.ports.length }} port(s)
              </span>
            </div>
          </div>
          <div class="template-actions">
            <el-button 
              type="primary" 
              size="small" 
              @click="useTemplate(template)"
              class="template-use-btn"
            >
              <el-icon><Icon icon="mdi:plus" /></el-icon>
              Use Template
            </el-button>
            <el-button 
              type="text" 
              size="small" 
              @click="previewTemplate(template)"
              class="template-preview-btn"
            >
              Preview
            </el-button>
          </div>
        </div>
      </div>
      
      <div v-if="filteredTemplates.length === 0" class="no-templates">
        <el-icon size="48"><Icon icon="mdi:file-search-outline" /></el-icon>
        <p>No templates found</p>
      </div>
    </el-dialog>

    <!-- Template Preview Dialog -->
    <el-dialog 
      v-model="showTemplatePreview" 
      :title="`Preview: ${selectedTemplate?.name}`" 
      width="800px"
      class="clean-dialog"
    >
      <div class="template-preview-container">
        <div class="template-meta" v-if="selectedTemplate?.metadata">
          <div class="meta-item" v-if="selectedTemplate.metadata.description">
            <el-icon><Icon icon="mdi:information-outline" /></el-icon>
            <span>{{ selectedTemplate.metadata.description }}</span>
          </div>
          <div class="meta-item" v-if="selectedTemplate.metadata.ports">
            <el-icon><Icon icon="mdi:network-outline" /></el-icon>
            <span>Ports: {{ selectedTemplate.metadata.ports.join(', ') }}</span>
          </div>
        </div>
        
        <div class="template-code">
          <pre class="template-preview">{{ previewTemplateContent }}</pre>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showTemplatePreview = false" size="small">Cancel</el-button>
          <el-button type="primary" @click="applyTemplate" size="small">
            <el-icon><Icon icon="mdi:file-import" /></el-icon>
            Use This Template
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Deploy Logs Dialog -->
    <el-dialog 
      v-model="deployDialogVisible" 
      :title="`Deploying ${currentDeployment}`" 
      width="900px"
      class="clean-dialog terminal-dialog"
      @closed="handleDeployDialogClosed"
    >
      <div class="terminal-container">
        <div ref="deployTerminalRef" class="terminal"></div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeDeploy" size="small">
            <el-icon><Icon icon="mdi:close" /></el-icon>
            Close
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// Reactive state
const composeFiles = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const showTemplatesDialog = ref(false);
const showTemplatePreview = ref(false);
const deployDialogVisible = ref(false);
const creatingCompose = ref(false);
const autoStartContainer = ref(true);
const containerStatuses = ref({});
const currentDeployment = ref('');

// Forms
const composeForm = ref({
  containerName: '',
  filename: '',
  content: '',
  description: '',
  autoStart: true
});

// Templates
const templates = ref([]);
const previewTemplateContent = ref('');
const selectedTemplate = ref(null);
const templateSearch = ref('');

// Dialogs
const editingCompose = ref(false);

// Terminal
const deployTerminalRef = ref(null);
const deployTerminal = ref(null);
const deployFitAddon = ref(null);
const deployEventSource = ref(null);

// Loading states
const deployLoading = ref({});
const restartLoading = ref({});
const deleteLoading = ref({});

// Default templates (simplified)
const defaultTemplates = [
  {
    name: 'Nginx Web Server',
    description: 'Basic Nginx web server with port 80 exposed',
    content: `version: '3'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    restart: unless-stopped`,
    metadata: {
      ports: [80],
      icon: 'mdi:nginx'
    }
  },
  {
    name: 'PostgreSQL Database',
    description: 'PostgreSQL database with persistent storage',
    content: `version: '3'
services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: example_password
      POSTGRES_USER: example_user
      POSTGRES_DB: example_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data: {}`,
    metadata: {
      ports: [5432],
      icon: 'mdi:database'
    }
  },
  {
    name: 'Redis',
    description: 'Redis in-memory data store',
    content: `version: '3'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
volumes:
  redis_data: {}`,
    metadata: {
      ports: [6379],
      icon: 'mdi:database'
    }
  }
];

// Computed properties
const filteredComposeFiles = computed(() => {
  if (!searchQuery.value) return composeFiles.value;
  const query = searchQuery.value.toLowerCase();
  return composeFiles.value.filter(file => 
    file.name.toLowerCase().includes(query)
  );
});

const filteredTemplates = computed(() => {
  let filtered = templates.value;
  
  if (templateSearch.value) {
    const search = templateSearch.value.toLowerCase();
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(search) || 
      t.description.toLowerCase().includes(search)
    );
  }
  
  return filtered;
});

// Helper functions
const formatContainerName = (name) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const updateFilename = () => {
  if (composeForm.value.containerName) {
    composeForm.value.filename = `${formatContainerName(composeForm.value.containerName)}`;
  } else {
    composeForm.value.filename = '';
  }
};

const formatDate = (dateString) => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
};

const getContainerStatus = (row) => {
  const status = containerStatuses.value[row.name] || 'not_found';
  
  const statusMap = {
    running: { 
      type: 'success', 
      text: 'Running', 
      icon: 'mdi:check-circle',
      class: 'status-running'
    },
    stopped: { 
      type: 'danger', 
      text: 'Stopped', 
      icon: 'mdi:stop-circle',
      class: 'status-stopped'
    },
    starting: { 
      type: 'warning', 
      text: 'Starting', 
      icon: 'mdi:loading',
      class: 'status-starting'
    },
    not_found: { 
      type: 'info', 
      text: 'Not running', 
      icon: 'mdi:help-circle',
      class: 'status-not-found'
    },
    error: { 
      type: 'danger', 
      text: 'Error', 
      icon: 'mdi:alert-circle',
      class: 'status-error'
    }
  };

  return statusMap[status] || statusMap.not_found;
};

const normalizeContainerName = (composeFileName) => {
  return composeFileName
    .replace('.yml', '')
    .replace('.yaml', '')
    .replace('docker-compose-', '')
    .split('-')[0];
};

// API functions
const fetchComposeFiles = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/compose');
    
    if (response.data.success && Array.isArray(response.data.files)) {
      composeFiles.value = response.data.files.map(file => ({
        name: file,
        modified: 'N/A',
        servicesCount: '?'
      }));
      
      // Update all statuses
      await updateAllStatuses();
    }
  } catch (error) {
    ElMessage.error('Failed to fetch compose files');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const checkContainerStatus = async (composeFileName) => {
  try {
    const cleanName = composeFileName
      .replace('.yml', '')
      .replace('.yaml', '')
      .replace('docker-compose-', '')
      .replace(/-1$/, '');

    const response = await axios.get(`/services/docker/container/status/${cleanName}`);
    
    if (response.data.status === 'running') {
      return 'running';
    }
    
    if (response.data.containerName?.includes(cleanName)) {
      return response.data.status === 'running' ? 'running' : 'stopped';
    }

    return 'not_found';
    
  } catch (error) {
    console.error('Error checking container status:', error);
    return 'error';
  }
};

const updateAllStatuses = async () => {
  for (const file of composeFiles.value) {
    const normalizedName = normalizeContainerName(file.name);
    containerStatuses.value[file.name] = await checkContainerStatus(normalizedName);
  }
};

const submitComposeForm = async () => {
  try {
    if (!composeForm.value.filename) {
      ElMessage.warning('Please specify a filename');
      return;
    }
    
    if (!composeForm.value.content) {
      ElMessage.warning('Please provide compose file content');
      return;
    }

    const filename = composeForm.value.filename.endsWith('.yml') 
      ? composeForm.value.filename 
      : `${composeForm.value.filename}.yml`;

    creatingCompose.value = true;
    
    if (editingCompose.value) {
      await axios.put(`/services/docker/compose/${filename}`, {
        content: composeForm.value.content
      });
      ElMessage.success('Compose file updated successfully');
    } else {
      await axios.post('/services/docker/compose_add', {
        filename: filename,
        content: composeForm.value.content
      });
      ElMessage.success('Compose file created successfully');
    }
    
    if (composeForm.value.autoStart && !editingCompose.value) {
      const containerName = filename.replace('.yml', '').replace('.yaml', '');
      containerStatuses.value[containerName] = 'starting';
      setTimeout(() => {
        deployCompose(filename);
      }, 1000);
    }

    showCreateDialog.value = false;
    resetCreateForm();
    await fetchComposeFiles();
  } catch (error) {
    const errorMsg = error.response?.data?.message || 
                    error.response?.data?.error || 
                    'Failed to save compose file';
    ElMessage.error(errorMsg);
    console.error('Error details:', error);
  } finally {
    creatingCompose.value = false;
  }
};

const resetCreateForm = () => {
  composeForm.value = {
    containerName: '',
    filename: '',
    content: '',
    description: '',
    autoStart: true
  };
  editingCompose.value = false;
};

const editCompose = async (filename) => {
  try {
    const response = await axios.get(`/services/docker/compose/${filename}`);
    composeForm.value = {
      containerName: filename.replace('.yml', '').replace('.yaml', ''),
      filename: filename.replace('.yml', '').replace('.yaml', ''),
      content: response.data.content,
      description: '',
      autoStart: false
    };
    editingCompose.value = true;
    showCreateDialog.value = true;
  } catch (error) {
    ElMessage.error('Failed to load compose file');
    console.error(error);
  }
};

const deleteCompose = async (filename) => {
  try {
    await ElMessageBox.confirm(
      'This will permanently delete the compose file. Continue?',
      'Warning',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    );

    deleteLoading.value[filename] = true;
    await axios.delete(`/services/docker/compose/${filename}`);
    ElMessage.success('Compose file deleted successfully');
    await fetchComposeFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete compose file');
      console.error(error);
    }
  } finally {
    deleteLoading.value[filename] = false;
  }
};

const handleDeployStop = async (row) => {
  const status = containerStatuses.value[row.name];
  if (status === 'running') {
    await stopCompose(row);
  } else {
    deployCompose(row.name);
  }
};

const deployCompose = async (filename) => {
  try {
    deployLoading.value[filename] = true;
    currentDeployment.value = filename;
    deployDialogVisible.value = true;
    
    await nextTick();
    initDeployTerminal();
    
    deployTerminal.value.writeln('Starting deployment...');
    deployTerminal.value.writeln('========================\r\n');

    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const wsUrl = `${protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT}`;
    deployEventSource.value = new EventSource(`${wsUrl}/services/docker/composer/deploy-stream?file=${filename}`);
    
    deployEventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          const lines = data.message.split('\r\n');
          lines.forEach(line => {
            if (line.trim().length > 0) {
              deployTerminal.value.writeln(line);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing event data:', e);
      }
    };

    deployEventSource.value.onerror = (error) => {
      deployTerminal.value.writeln('\r\nError in deployment stream');
      closeDeployStream();
    };

    const containerName = filename.replace('.yml', '').replace('.yaml', '');
    setTimeout(async () => {
      const status = await checkContainerStatus(containerName);
      containerStatuses.value[containerName] = status;
      deployLoading.value[filename] = false;
    }, 5000);
  } catch (error) {
    console.error('Deployment error:', error);
    deployLoading.value[filename] = false;
  }
};

const stopCompose = async (row) => {
  try {
    const cleanName = normalizeContainerName(row.name);
    await axios.post(`/services/docker/container/${cleanName}/stop`);
    ElMessage.success('Compose stopped successfully');
    containerStatuses.value[row.name] = 'stopped';
  } catch (error) {
    ElMessage.error('Failed to stop compose');
    console.error(error);
  }
};

const restartCompose = async (row) => {
  try {
    restartLoading.value[row.name] = true;
    const cleanName = normalizeContainerName(row.name);
    await axios.post(`/services/docker/container/${cleanName}/restart`);
    ElMessage.success('Compose restarted successfully');
    containerStatuses.value[row.name] = 'starting';
    
    setTimeout(async () => {
      const status = await checkContainerStatus(cleanName);
      containerStatuses.value[row.name] = status;
      restartLoading.value[row.name] = false;
    }, 3000);
  } catch (error) {
    ElMessage.error('Failed to restart compose');
    console.error(error);
    restartLoading.value[row.name] = false;
  }
};

// Terminal functions
const initDeployTerminal = () => {
  if (deployTerminal.value) {
    try {
      deployTerminal.value.dispose();
    } catch (e) {
      console.warn('Error disposing terminal:', e);
    }
  }

  deployTerminal.value = new Terminal({
    cursorBlink: false,
    fontFamily: 'monospace',
    fontSize: 14,
    convertEol: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#f0f0f0'
    },
    rendererType: 'canvas',
    disableStdin: true,
    scrollback: 1000
  });

  deployFitAddon.value = new FitAddon();
  deployTerminal.value.loadAddon(deployFitAddon.value);
  
  if (deployTerminalRef.value) {
    deployTerminal.value.open(deployTerminalRef.value);
    deployFitAddon.value.fit();
  }
};

const closeDeployStream = () => {
  if (deployEventSource.value) {
    deployEventSource.value.close();
    deployEventSource.value = null;
  }

  if (deployTerminal.value) {
    try {
      if (deployFitAddon.value) {
        deployTerminal.value.loadAddon(deployFitAddon.value);
        deployFitAddon.value.dispose();
        deployFitAddon.value = null;
      }
      deployTerminal.value.dispose();
      deployTerminal.value = null;
    } catch (e) {
      console.warn('Error cleaning up terminal:', e);
    }
  }
};

const handleDeployDialogClosed = () => {
  closeDeployStream();
  deployDialogVisible.value = false;
};

const closeDeploy = () => {
  handleDeployDialogClosed();
};

// Template functions
const loadTemplates = async () => {
  try {
    // Try to load from external source
    const response = await axios.get(
      'https://raw.githubusercontent.com/gekomod/docker-templates/main/contents/templates.json',
      {
        headers: {
          'Accept': 'application/vnd.github.v3.raw'
        },
        timeout: 5000
      }
    );
    
    if (response.data && Array.isArray(response.data.templates)) {
      templates.value = response.data.templates;
    } else {
      templates.value = defaultTemplates;
    }
  } catch (error) {
    console.log('Using default templates:', error.message);
    templates.value = defaultTemplates;
  }
};

const loadTemplatesDialog = async () => {
  showTemplatesDialog.value = true;
  if (templates.value.length === 0) {
    await loadTemplates();
  }
};

const previewTemplate = (template) => {
  selectedTemplate.value = template;
  previewTemplateContent.value = template.content;
  showTemplatePreview.value = true;
};

const useTemplate = (template) => {
  composeForm.value = {
    containerName: template.name.toLowerCase().replace(/ /g, '-'),
    filename: template.name.toLowerCase().replace(/ /g, '-'),
    content: template.content,
    description: template.description,
    autoStart: true
  };
  showTemplatesDialog.value = false;
  showCreateDialog.value = true;
};

const applyTemplate = () => {
  useTemplate(selectedTemplate.value);
  showTemplatePreview.value = false;
};

// Form helpers
const fillSampleConfig = () => {
  composeForm.value.content = `version: '3.8'

services:
  app:
    image: nginx:alpine
    container_name: my-app
    ports:
      - "8080:80"
    restart: unless-stopped
    environment:
      - NGINX_ENV=production`;
};

const formatYaml = () => {
  try {
    // Simple YAML formatting
    const lines = composeForm.value.content.split('\n');
    let indent = 0;
    const formatted = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.endsWith(':')) {
        const result = '  '.repeat(indent) + trimmed;
        indent++;
        return result;
      } else if (trimmed === '') {
        indent = Math.max(0, indent - 1);
        return '';
      } else {
        return '  '.repeat(indent) + trimmed;
      }
    }).join('\n');
    
    composeForm.value.content = formatted;
    ElMessage.success('YAML formatted');
  } catch (e) {
    ElMessage.error('Formatting failed');
  }
};

const handleRowClick = (row) => {
  // Handle row click if needed
};

onMounted(() => {
  fetchComposeFiles();
  
  // Refresh statuses every 30 seconds
  const interval = setInterval(async () => {
    if (composeFiles.value.length > 0) {
      await updateAllStatuses();
    }
  }, 30000);

  onBeforeUnmount(() => {
    clearInterval(interval);
    closeDeployStream();
  });
});

onBeforeUnmount(() => {
  closeDeployStream();
});
</script>

<style scoped>
.docker-compose {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  overflow: hidden;
}

/* Header styles */
.clean-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h2 .el-icon {
  font-size: 22px;
  color: #2496ed;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  min-width: auto;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Table styles */
.table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 20px;
}

.clean-table-card {
  height: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.clean-table-card.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.table-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Table styling */
.clean-table {
  flex: 1;
  border: none;
  --el-table-border-color: #f1f5f9;
  --el-table-header-bg-color: #f8fafc;
  width: 100% !important;
}

:deep(.clean-table .el-table__header-wrapper) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

:deep(.clean-table .el-table__header th) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
  font-weight: 600;
  padding: 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

:deep(.clean-table .el-table__row:hover > td) {
  background-color: #f8fafc !important;
}

:deep(.clean-table .el-table__row.el-table__row--striped) {
  background-color: #f8fafc;
}

:deep(.clean-table .el-table__row.el-table__row--striped:hover > td) {
  background-color: #f1f5f9 !important;
}

/* Cell styles */
.file-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  overflow: hidden;
}

.file-icon {
  color: #3b82f6;
  font-size: 20px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.file-name {
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-date {
  font-size: 11px;
  color: #94a3b8;
}

/* Status tags */
.status-tag {
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 11px;
}

.status-icon {
  font-size: 12px !important;
}

.status-running {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.status-stopped {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #dc2626;
  border: 1px solid #fecaca;
}

.status-starting {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
  border: 1px solid #fde68a;
}

.status-not-found {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #475569;
  border: 1px solid #e2e8f0;
}

.status-error {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #dc2626;
  border: 1px solid #fecaca;
}

/* Services cell */
.services-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.services-icon {
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}

.services-text {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

/* Actions */
.actions-container {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
}

.action-btn-circle {
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.action-btn-circle:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 16px;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  color: #cbd5e1;
  font-size: 60px !important;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 24px 0;
  max-width: 350px;
  line-height: 1.5;
  color: #64748b;
  font-size: 14px;
}

.create-btn {
  border-radius: 8px;
  padding: 8px 20px;
  font-weight: 600;
  font-size: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  transition: all 0.2s ease;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* Table footer */
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #f1f5f9;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.footer-info {
  color: #64748b;
  font-size: 12px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.2s ease;
}

.footer-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* Dialog styles */
.clean-dialog :deep(.el-dialog) {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.clean-dialog :deep(.el-dialog__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.clean-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.clean-dialog :deep(.el-dialog__footer) {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Create dialog */
.create-dialog-content {
  max-height: 70vh;
  overflow-y: auto;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.form-item-half {
  flex: 1;
}

/* Editor styles */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.editor-header span {
  color: #475569;
  font-weight: 600;
  font-size: 14px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.code-editor {
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.code-editor :deep(.el-textarea__inner) {
  font-family: inherit;
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  resize: none;
}

/* Templates dialog */
.templates-header {
  margin-bottom: 16px;
}

.filters-container {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 8px 4px;
}

.template-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #3b82f6;
}

.template-icon {
  font-size: 32px;
  color: #3b82f6;
  text-align: center;
}

.template-content {
  flex: 1;
}

.template-name {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 16px;
  font-weight: 600;
}

.template-description {
  margin: 0 0 12px 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
}

.template-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.template-ports {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.template-actions {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.template-use-btn {
  flex: 1;
}

.template-preview-btn {
  padding: 0;
}

.no-templates {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 16px;
  text-align: center;
  color: #64748b;
}

.no-templates .el-icon {
  color: #cbd5e1;
  margin-bottom: 16px;
}

/* Template preview */
.template-preview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow: hidden;
}

.template-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
}

.meta-item .el-icon {
  color: #94a3b8;
  font-size: 16px;
}

.template-code {
  flex: 1;
  overflow: auto;
}

.template-preview {
  margin: 0;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #334155;
}

/* Terminal dialog */
.terminal-dialog :deep(.el-dialog__body) {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 70vh;
}

.terminal-container {
  flex: 1;
  background: #1e1e1e;
  overflow: hidden;
}

.terminal {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .clean-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-right {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  
  .action-buttons {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .templates-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}

@media (max-width: 768px) {
  .clean-header {
    padding: 12px;
  }
  
  .header-left h2 {
    font-size: 18px;
  }
  
  .table-wrapper {
    padding: 12px;
  }
  
  .clean-dialog {
    width: 95% !important;
  }
  
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  
  .templates-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 576px) {
  .table-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .footer-actions {
    justify-content: center;
  }
  
  .create-btn {
    padding: 6px 16px;
    font-size: 12px;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.clean-table-card, .template-card {
  animation: fadeIn 0.3s ease-out;
}

/* Custom scrollbar */
:deep(.clean-table .el-table__body-wrapper) {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f1f5f9;
  border-radius: 3px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #cbd5e1;
  border-radius: 3px;
}

:deep(.clean-table .el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #94a3b8;
}

/* Utility classes */
.ml-2 {
  margin-left: 8px;
}
</style>
