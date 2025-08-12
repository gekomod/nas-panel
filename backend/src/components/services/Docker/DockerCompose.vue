<template>
  <div class="docker-compose">
    <div class="header">
      <el-button type="primary" plain @click="fetchComposeFiles" class="action-btn">
        <Icon icon="mdi:refresh" class="icon" />
        Refresh
      </el-button>
      <el-button type="success" plain @click="showCreateDialog = true" class="action-btn">
        <Icon icon="mdi:plus" class="icon" />
        New Compose
      </el-button>
      <el-button type="info" plain @click="loadTemplatesDialog" class="action-btn">
        <Icon icon="mdi:file-download" class="icon" />
        Add from Templates
      </el-button>
    </div>

    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="composeFiles"
        style="width: 100%"
        class="full-width-table"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b' }"
      >
        <el-table-column prop="name" label="FILE NAME" width="300">
          <template #default="{row}">
            <div class="file-name-cell">
              <Icon icon="mdi:file-document-outline" class="file-icon" />
              <span class="file-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="STATUS" width="180">
          <template #default="{row}">
            <el-tag 
              :type="getContainerStatus(row).type" 
              class="status-tag"
              :class="getContainerStatus(row).text.toLowerCase().replace(' ', '-')"
            >
              <el-icon v-if="getContainerStatus(row).loading" class="is-loading">
                <Icon icon="mdi:loading" />
              </el-icon>
              {{ getContainerStatus(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="modified" label="LAST MODIFIED" width="200" />
        
        <el-table-column label="ACTIONS" width="220" align="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-tooltip content="Deploy" placement="top">
                <el-button
                  size="small"
                  circle
                  type="primary"
                  @click="deployCompose(row.name)"
                  class="action-icon"
                >
                  <Icon icon="mdi:rocket-launch" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Edit" placement="top">
                <el-button
                  size="small"
                  circle
                  type="info"
                  @click="editCompose(row.name)"
                  class="action-icon"
                >
                  <Icon icon="mdi:pencil" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Delete" placement="top">
                <el-button
                  size="small"
                  circle
                  type="danger"
                  @click="deleteCompose(row.name)"
                  class="action-icon"
                >
                  <Icon icon="mdi:delete" />
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create Compose Dialog -->
    <el-dialog 
      v-model="showCreateDialog" 
      title="Create New Docker Compose" 
      width="900px"
      class="modern-dialog"
    >
      <el-form :model="composeForm" ref="composeFormRef" label-position="top">
        <div class="dialog-grid">
          <div class="form-section">
            <el-form-item 
              label="Container Name"
              prop="containerName"
              :rules="[
                { required: true, message: 'Please input container name', trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9\s]+$/, message: 'Only letters, numbers and spaces allowed' }
              ]"
            >
              <el-input 
                v-model="composeForm.containerName" 
                placeholder="My Awesome Container"
                @input="updateFilename"
                size="large"
              />
            </el-form-item>
            
            <el-form-item label="Filename (auto-generated)">
              <el-input 
                v-model="composeForm.filename" 
                disabled 
                placeholder="my-awesome-container.yml" 
                size="large"
              />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="composeForm.autoStart" label="Start containers immediately after creation" />
            </el-form-item>
          </div>
          
          <div class="editor-section">
            <el-form-item 
              label="Compose Configuration"
              prop="content"
              :rules="[
                { required: true, message: 'Please input compose content', trigger: 'blur' }
              ]"
            >
              <div class="editor-header">
                <span>docker-compose.yml</span>
                <el-button type="" @click="fillSampleConfig">
                  <Icon icon="mdi:lightbulb-on-outline" /> Sample Config
                </el-button>
              </div>
              <el-input
                v-model="composeForm.content"
                type="textarea"
                :rows="18"
                placeholder="version: '3'
services:
  web:
    image: nginx
    ports:
      - '80:80'"
                class="code-editor"
              />
            </el-form-item>
          </div>
        </div>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showCreateDialog = false" size="large">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="submitComposeForm"
            :loading="creatingCompose"
            size="large"
          >
            <Icon icon="mdi:content-save" /> Save Configuration
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Edit Dialog -->
    <el-dialog 
      v-model="showEditDialog" 
      :title="`Editing ${editForm.filename}`" 
      width="900px"
      class="modern-dialog"
    >
      <div class="editor-container">
        <div class="editor-header">
          <span>{{ editForm.filename }}</span>
          <el-button type="text" @click="formatYaml">
            <Icon icon="mdi:code-braces" /> Format
          </el-button>
        </div>
        <el-input
          v-model="editForm.content"
          type="textarea"
          :rows="20"
          class="code-editor"
        />
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showEditDialog = false" size="large">Discard Changes</el-button>
          <el-button type="primary" @click="saveComposeFile" size="large">
            <Icon icon="mdi:content-save-check" /> Save Changes
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Deploy Status Dialog -->
    <el-dialog 
      v-model="deployDialogVisible" 
      :title="`Deploying ${currentDeployment}`" 
      width="900px"
      class="modern-dialog terminal-dialog"
      @closed="handleDeployDialogClosed"
    >
      <div class="terminal-container">
        <div ref="deployTerminalRef" class="terminal"></div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeDeploy" size="large">
            <Icon icon="mdi:close" /> Close
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Templates Dialog -->
    <el-dialog 
      v-model="showTemplatesDialog" 
      title="Docker Compose Templates" 
      width="900px"
      class="modern-dialog"
    >
      <el-input
        v-model="templateSearch"
        placeholder="Search templates..."
        size="large"
        class="search-input"
        clearable
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>
      
      <el-table
        :data="filteredTemplates"
        style="width: 100%"
        class="templates-table"
        @row-click="handleTemplateSelect"
        empty-text="No templates found"
      >
        <el-table-column width="80">
          <template #default="{ row }">
            <div class="template-icon">
              <Icon :icon="row.metadata?.icon || 'mdi:docker'" />
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="name" label="TEMPLATE">
          <template #default="{ row }">
            <div class="template-info">
              <div class="template-name">{{ row.name }}</div>
              <div class="template-description">{{ row.description }}</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column width="180" align="right">
          <template #default="{ row }">
            <div class="template-actions">
              <el-button
                size="small"
                type="info"
                @click.stop="previewTemplate(row)"
                class="preview-btn"
              >
                <Icon icon="mdi:eye-outline" /> Preview
              </el-button>
              <el-button
                size="small"
                type="success"
                @click.stop="deployTemplateDirectly(row)"
                v-if="row.metadata?.autoStart !== false"
                class="deploy-btn"
              >
                <Icon icon="mdi:rocket-launch" /> Deploy
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Template Preview Dialog -->
    <el-dialog 
      v-model="showTemplatePreview" 
      :title="`Preview: ${selectedTemplate?.name}`" 
      width="900px"
      class="modern-dialog"
    >
      <div class="template-meta" v-if="selectedTemplate?.metadata">
        <div class="meta-item" v-if="selectedTemplate.metadata.description">
          <Icon icon="mdi:information-outline" class="meta-icon" />
          <span>{{ selectedTemplate.metadata.description }}</span>
        </div>
        <div class="meta-item" v-if="selectedTemplate.metadata.ports">
          <Icon icon="mdi:network-outline" class="meta-icon" />
          <span>Ports: {{ selectedTemplate.metadata.ports.join(', ') }}</span>
        </div>
        <div class="meta-item" v-if="selectedTemplate.metadata.volumes">
          <Icon icon="mdi:harddisk" class="meta-icon" />
          <span>Volumes: {{ selectedTemplate.metadata.volumes.join(', ') }}</span>
        </div>
      </div>
      
      <div class="template-preview-container">
        <pre class="template-preview">{{ previewTemplateContent }}</pre>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-checkbox v-model="autoStartContainer" label="Start containers immediately" />
          <el-button @click="showTemplatePreview = false" size="large">Cancel</el-button>
          <el-button type="primary" @click="useTemplate" size="large">
            <Icon icon="mdi:file-import" /> Use This Template
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import axios from 'axios';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const composeFiles = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const deployDialogVisible = ref(false);
const creatingCompose = ref(false);
const autoStartContainer = ref(true);
const containerStatuses = ref({});
const currentDeployment = ref('');

const deployTerminalRef = ref(null);
const deployTerminal = ref(null);
const deployFitAddon = ref(null);
const deployEventSource = ref(null);

const showTemplatesDialog = ref(false);
const showTemplatePreview = ref(false);
const templates = ref([]);
const previewTemplateContent = ref('');
const selectedTemplate = ref(null);
const templateSearch = ref('');

const composeForm = ref({
  containerName: '',
  filename: '',
  content: '',
  autoStart: true
});

const editForm = ref({
  filename: '',
  content: ''
});

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
      autoStart: true,
      ports: [80],
      icon: 'mdi:nginx'
    }
  },
  {
    name: 'WordPress with MySQL',
    description: 'Complete WordPress setup with MySQL database',
    content: `version: '3'
services:
  db:
    image: mysql:5.7
    volumes:
      - db_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: example_root_password
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: example_password

  wordpress:
    depends_on:
      - db
    image: wordpress:latest
    ports:
      - "8000:80"
    restart: always
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: example_password
      WORDPRESS_DB_NAME: wordpress
volumes:
  db_data: {}`,
    metadata: {
      autoStart: true,
      ports: [8000],
      icon: 'mdi:wordpress'
    }
  },
  {
    name: 'PostgreSQL',
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
      autoStart: true,
      ports: [5432],
      icon: 'mdi:database'
    }
  }
];

const filteredTemplates = computed(() => {
  if (!templateSearch.value) return templates.value;
  const search = templateSearch.value.toLowerCase();
  return templates.value.filter(t => 
    t.name.toLowerCase().includes(search) || 
    t.description.toLowerCase().includes(search)
  );
});

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
    composeForm.value.filename = `${formatContainerName(composeForm.value.containerName)}.yml`;
  } else {
    composeForm.value.filename = '';
  }
};

const fetchComposeFiles = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/compose');
    composeFiles.value = response.data.files.map(file => ({
      name: file,
      size: 'N/A',
      modified: 'N/A'
    }));
    
    await Promise.all(composeFiles.value.map(async file => {
      const normalizedName = normalizeContainerName(file.name);
      containerStatuses.value[file.name] = await checkContainerStatus(normalizedName);
    }));
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

const getContainerStatus = (row) => {
  const status = containerStatuses.value[row.name] || 'not_found';
  
  const statusMap = {
    running: { type: 'success', text: 'Running', icon: 'mdi:check-circle' },
    stopped: { type: 'danger', text: 'Stopped', icon: 'mdi:stop-circle' },
    not_found: { type: 'info', text: 'Not running', icon: 'mdi:help-circle' },
    error: { type: 'danger', text: 'Error', icon: 'mdi:alert-circle' },
    default: { type: 'info', text: 'Unknown', icon: 'mdi:help-circle' }
  };

  const config = statusMap[status] || statusMap.default;
  
  return {
    ...config,
    loading: false
  };
};

const normalizeContainerName = (composeFileName) => {
  return composeFileName
    .replace('.yml', '')
    .replace('.yaml', '')
    .replace('docker-compose-', '')
    .split('-')[0];
};

const submitComposeForm = async () => {
  try {
    await createComposeFile();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Validation failed:', error);
    }
  }
};

const createComposeFile = async () => {
  try {
    if (!composeForm.value.containerName) {
      ElMessage.warning('Please specify a container name');
      return;
    }
    
    if (!composeForm.value.filename) {
      ElMessage.warning('Please provide a valid container name');
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
    const response = await axios.post('/services/docker/compose_add', {
      filename: filename,
      content: composeForm.value.content,
      autoStart: composeForm.value.autoStart
    });

    ElMessage.success(response.data.message || 'Compose file created successfully');
    
    if (composeForm.value.autoStart) {
      const containerName = filename.replace('.yml', '').replace('.yaml', '');
      containerStatuses.value[containerName] = 'starting';
      setTimeout(() => {
        deployCompose(filename);
      }, 1000);
    }

    showCreateDialog.value = false;
    composeForm.value = { filename: 'docker-compose.yml', content: '', autoStart: true };
    await fetchComposeFiles();
  } catch (error) {
    const errorMsg = error.response?.data?.message || 
                    error.response?.data?.error || 
                    'Failed to create compose file';
    ElMessage.error(errorMsg);
    console.error('Error details:', error);
  } finally {
    creatingCompose.value = false;
  }
};

const editCompose = async (filename) => {
  try {
    const response = await axios.get(`/services/docker/compose/${filename}`);
    editForm.value = {
      filename,
      content: response.data.content
    };
    showEditDialog.value = true;
  } catch (error) {
    ElMessage.error('Failed to load compose file');
    console.error(error);
  }
};

const saveComposeFile = async () => {
  try {
    await axios.put(`/services/docker/compose/${editForm.value.filename}`, {
      content: editForm.value.content
    });
    ElMessage.success('Compose file saved successfully');
    showEditDialog.value = false;
    await fetchComposeFiles();
  } catch (error) {
    ElMessage.error('Failed to save compose file');
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

    await axios.delete(`/services/docker/compose/${filename}`);
    ElMessage.success('Compose file deleted successfully');
    await fetchComposeFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to delete compose file');
      console.error(error);
    }
  }
};

const deployTemplateDirectly = async (template) => {
  try {
    const result = await ElMessageBox.confirm(
      `Deploy ${template.name} stack?`,
      'Confirm Deployment',
      { 
        confirmButtonText: 'Deploy', 
        cancelButtonText: 'Cancel',
        showCheckbox: true,
        checkboxLabel: 'Start containers immediately'
      }
    );

    const shouldStart = result.value;
    const loadingKey = `deploy-${template.name}`;
    
    ElMessage.info({
      message: `Deploying ${template.name}...`,
      key: loadingKey,
      duration: 0
    });

    const filename = `${template.name.toLowerCase().replace(/ /g, '-')}.yml`;
    const response = await axios.post('/services/docker/compose_add', {
      filename: filename,
      content: template.content,
      autoStart: shouldStart
    });

    ElMessage.success({
      message: response.data.message,
      key: loadingKey
    });

    if (shouldStart) {
      containerStatuses.value[filename.replace('.yml', '')] = 'starting';
      setTimeout(() => {
        deployCompose(filename);
      }, 1000);
    }

    await fetchComposeFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Deployment failed: ' + error.message);
    }
  }
};

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

const deployCompose = async (filename) => {
  try {
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
    }, 5000);
  } catch (error) {
    console.error('Deployment error:', error);
    if (deployTerminal.value) {
      deployTerminal.value.writeln('Error: ' + error.message);
    }
  }
};

const loadTemplates = async () => {
  try {
    const response = await axios.get(
      'https://raw.githubusercontent.com/gekomod/docker-templates/main/contents/templates.json',
      {
        headers: {
          'Accept': 'application/vnd.github.v3.raw'
        }
      }
    );
    templates.value = response.data.templates || defaultTemplates;
  } catch (error) {
    console.log('Using default templates due to error:', error);
    templates.value = defaultTemplates;
  }
};

const previewTemplate = (template) => {
  selectedTemplate.value = template;
  previewTemplateContent.value = template.content;
  showTemplatePreview.value = true;
};

const useTemplate = () => {
  showCreateDialog.value = true;
  showTemplatePreview.value = false;
  showTemplatesDialog.value = false;
  composeForm.value = {
    filename: `${selectedTemplate.value.name.toLowerCase().replace(/ /g, '-')}.yml`,
    content: selectedTemplate.value.content,
    autoStart: autoStartContainer.value
  };
};

const handleTemplateSelect = (row) => {
  selectedTemplate.value = row;
  composeForm.value = {
    filename: `${row.name.toLowerCase().replace(/ /g, '-')}.yml`,
    content: row.content,
    autoStart: row.metadata?.autoStart !== false
  };
  showTemplatesDialog.value = false;
  showCreateDialog.value = true;
};

const loadTemplatesDialog = async () => {
  showTemplatesDialog.value = true;
  loadTemplates();
};

const fillSampleConfig = () => {
  composeForm.value.content = `version: '3.8'

services:
  app:
    image: nginx:alpine
    container_name: my-app
    ports:
      - "8080:80"
    volumes:
      - ./app:/usr/share/nginx/html
    restart: unless-stopped
    environment:
      - NGINX_ENV=production

  db:
    image: postgres:13
    container_name: my-db
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: example
      POSTGRES_USER: example
      POSTGRES_DB: example

volumes:
  db_data:
`;
};

const formatYaml = () => {
  try {
    const formatted = editForm.value.content
      .split('\n')
      .map(line => line.trim() === '' ? line : '  ' + line)
      .join('\n');
    editForm.value.content = formatted;
    ElMessage.success('YAML formatted');
  } catch (e) {
    ElMessage.error('Formatting failed');
  }
};

onMounted(() => {
  fetchComposeFiles();

  const interval = setInterval(async () => {
    if (!composeFiles.value.length) return;
    
    await Promise.all(composeFiles.value.map(async file => {
      const name = file.name.replace('.yml', '').replace('.yaml', '');
      containerStatuses.value[name] = await checkContainerStatus(name);
    }));
  }, 10000);

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
  margin: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 24px;
}

.action-btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 500;
}

.table-card {
  flex: 1;
  margin: 0;
  padding: 0;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* TOTALNA KONTROLA NAD TABELĄ */
:deep(.el-table) {
  width: 100% !important;
  margin: 0;
  border: none;
  background: transparent;
  flex: 1;
}

:deep(.el-table__header),
:deep(.el-table__body) {
  width: 100% !important;
}

:deep(.el-table__header-wrapper),
:deep(.el-table__body-wrapper) {
  width: 100% !important;
  flex: 1;
}

/* TRYB NOCNY - JAWNE STYLE */
.dark :deep(.el-table) {
  color: var(--el-text-color-primary);
}

.dark :deep(.el-table th) {
  background-color: var(--el-bg-color) !important;
}

.dark :deep(.el-table tr) {
  background-color: var(--el-bg-color) !important;
}

.dark :deep(.el-table tr:hover > td) {
  background-color: var(--el-fill-color-dark) !important;
}

.modern-table {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: #f8fafc;
  max-width: 100%;
}

.modern-table :deep(.el-table__row) {
  transition: background 0.2s;
}

.modern-table :deep(.el-table__row:hover) {
  background: #f8fafc;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 20px;
  color: #64748b;
}

.file-name {
  font-weight: 500;
  color: #334155;
}

.status-tag {
  font-weight: 500;
  padding: 6px 10px;
  border-radius: 6px;
}

.status-tag.running {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #86efac;
}

.status-tag.stopped {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fca5a5;
}

.status-tag.not-running {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
}

.status-tag.error {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fca5a5;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.action-icon {
  padding: 8px;
}

.modern-dialog {
  border-radius: 12px;
}

.modern-dialog :deep(.el-dialog__header) {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  margin: 0;
}

.modern-dialog :deep(.el-dialog__body) {
  padding: 24px;
}

.modern-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

.dialog-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 24px;
}

.form-section {
  padding-right: 24px;
  border-right: 1px solid #e2e8f0;
}

.editor-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 14px;
}

.code-editor {
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.code-editor :deep(.el-textarea__inner) {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  box-shadow: none;
  color: #334155;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.terminal-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.terminal-container {
  width: 100%;
  height: 60vh;
  background: #1e1e1e;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.terminal {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.templates-table :deep(.el-table__row) {
  cursor: pointer;
  transition: background 0.2s;
}

.templates-table :deep(.el-table__row:hover) {
  background: #f8fafc;
}

.template-icon {
  font-size: 24px;
  color: #3b82f6;
  display: flex;
  justify-content: center;
}

.template-info {
  display: flex;
  flex-direction: column;
}

.template-name {
  font-weight: 500;
  color: #334155;
  margin-bottom: 4px;
}

.template-description {
  font-size: 13px;
  color: #64748b;
}

.template-actions {
  display: flex;
  gap: 8px;
}

.preview-btn {
  background: #e0e7ff;
  color: #4f46e5;
  border: none;
}

.deploy-btn {
  border: none;
}

.search-input {
  margin-bottom: 16px;
}

.search-input :deep(.el-input__prefix) {
  display: flex;
  align-items: center;
  padding-left: 12px;
}

.template-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
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

.meta-icon {
  font-size: 16px;
}

.template-preview-container {
  max-height: 60vh;
  overflow: auto;
}

.template-preview {
  margin: 0;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
}

.full-width-table {
  width: 100%;
  table-layout: fixed;
    --el-table-border-color: #e9ecef;
  --el-table-header-bg-color: #f8f9fa;
  --el-table-row-hover-bg-color: #f1f3f5;
}

:deep(.el-table__header-wrapper),
:deep(.el-table__body-wrapper) {
  width: 100% !important;
}

:deep(.el-table__header) th {
  padding: 12px 0;
  background-color: #f8f9fa;
}

:deep(.el-table__body) td {
  padding: 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-table__inner-wrapper) {
  width: 100% !important;
}

.terminal-dialog {
  height: 70vh;
}

:deep(.el-dialog__body) {
  padding: 0;
  height: calc(100% - 60px);
}


@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>