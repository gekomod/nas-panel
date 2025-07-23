<template>
  <div class="docker-compose">
    <div class="header">
      <el-button type="primary" @click="fetchComposeFiles">
        <Icon icon="mdi:refresh" class="icon" />
        Refresh
      </el-button>
      <el-button type="success" @click="showCreateDialog = true">
        <Icon icon="mdi:plus" class="icon" />
        New Compose
      </el-button>
      <el-button type="info" @click="loadTemplatesDialog">
        <Icon icon="mdi:file-download" class="icon" />
        Add from Templates
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="composeFiles"
      style="width: 100%"
      stripe
    >
      <el-table-column prop="name" label="File Name" />
      <el-table-column prop="size" label="Size" width="120" />
      <el-table-column prop="modified" label="Modified" width="180" />
      <el-table-column label="Actions" width="200">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              type="primary"
              @click="deployCompose(row.name)"
            >
              <Icon icon="mdi:rocket-launch" />
            </el-button>
            <el-button
              size="small"
              type="info"
              @click="editCompose(row.name)"
            >
              <Icon icon="mdi:pencil" />
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteCompose(row.name)"
            >
              <Icon icon="mdi:delete" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

<el-dialog v-model="showCreateDialog" title="Create Compose File" width="80%">
  <el-form :model="composeForm" ref="composeFormRef">
    <el-form-item 
      label="File Name"
      prop="filename"
      :rules="[
        { required: true, message: 'Please input file name', trigger: 'blur' },
        { pattern: /\.(yml|yaml)$/, message: 'File must end with .yml or .yaml' }
      ]"
    >
      <el-input v-model="composeForm.filename" placeholder="docker-compose.yml" />
    </el-form-item>
    <el-form-item 
      label="Content"
      prop="content"
      :rules="[
        { required: true, message: 'Please input compose content', trigger: 'blur' }
      ]"
    >
      <el-input
        v-model="composeForm.content"
        type="textarea"
        :rows="15"
        placeholder="version: '3'
services:
  web:
    image: nginx
    ports:
      - '80:80'"
      />
    </el-form-item>
  </el-form>
  <template #footer>
    <el-button @click="showCreateDialog = false">Cancel</el-button>
    <el-button 
      type="primary" 
      @click="submitComposeForm"
      :loading="creatingCompose"
    >
      Save
    </el-button>
  </template>
</el-dialog>

    <el-dialog v-model="showEditDialog" title="Edit Compose File" width="80%">
      <el-form :model="editForm">
        <el-form-item>
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="15"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveComposeFile">Save</el-button>
      </template>
    </el-dialog>

  <el-dialog 
    v-model="deployDialogVisible" 
    title="Deploy Status" 
    width="80%"
    @closed="handleDeployDialogClosed"
  >
    <div class="terminal-container">
      <div ref="deployTerminalRef" class="terminal"></div>
    </div>
    <template #footer>
      <el-button @click="closeDeploy">Close</el-button>
    </template>
  </el-dialog>
    
    <!-- Nowy dialog z szablonami -->
    <el-dialog v-model="showTemplatesDialog" title="Add from Templates" width="60%">
      <el-table
        :data="templates"
        style="width: 100%"
        @row-click="handleTemplateSelect"
      >
        <el-table-column prop="name" label="Template Name" />
        <el-table-column prop="description" label="Description" />
        <el-table-column label="Actions" width="120">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              @click.stop="previewTemplate(row)"
            >
              Preview
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Dialog podglądu szablonu -->
    <el-dialog v-model="showTemplatePreview" title="Template Preview" width="80%">
      <pre class="template-preview">{{ previewTemplateContent }}</pre>
      <template #footer>
        <el-button @click="showTemplatePreview = false">Cancel</el-button>
        <el-button type="primary" @click="useTemplate">
          Use This Template
        </el-button>
      </template>
    </el-dialog>
    
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
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
const deployLog = ref('');
const creatingCompose = ref(false);

const deployTerminalRef = ref(null);
const deployTerminal = ref(null);
const deployFitAddon = ref(null);
const deployEventSource = ref(null);

const showTemplatesDialog = ref(false);
const showTemplatePreview = ref(false);
const templates = ref([]);
const previewTemplateContent = ref('');
const selectedTemplate = ref(null);

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
    restart: unless-stopped`
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
  db_data: {}`
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
  postgres_data: {}`
  }
];

const composeForm = ref({
  filename: 'docker-compose.yml',
  content: ''
});
const editForm = ref({
  filename: '',
  content: ''
});

const fetchComposeFiles = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/services/docker/compose');
    composeFiles.value = response.data.files.map(file => ({
      name: file,
      size: 'N/A', // Would need additional API endpoint for file details
      modified: 'N/A'
    }));
  } catch (error) {
    ElMessage.error('Failed to fetch compose files');
    console.error(error);
  } finally {
    loading.value = false;
  }
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
    // Basic validation
    if (!composeForm.value.filename) {
      ElMessage.warning('Please specify a file name');
      return;
    }
    
    if (!composeForm.value.content) {
      ElMessage.warning('Please provide compose file content');
      return;
    }

    // Ensure filename ends with .yml or .yaml
    const filename = composeForm.value.filename.endsWith('.yml') || 
                     composeForm.value.filename.endsWith('.yaml') 
                     ? composeForm.value.filename 
                     : `${composeForm.value.filename}.yml`;

    const response = await axios.post('/services/docker/compose_add', {
      filename: filename,
      content: composeForm.value.content
    });

    ElMessage.success(response.data.message || 'Compose file created successfully');
    showCreateDialog.value = false;
    composeForm.value = { filename: 'docker-compose.yml', content: '' };
    await fetchComposeFiles();
  } catch (error) {
    const errorMsg = error.response?.data?.message || 
                    error.response?.data?.error || 
                    'Failed to create compose file';
    ElMessage.error(errorMsg);
    console.error('Error details:', error);
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



// Inicjalizacja terminala
const initDeployTerminal = () => {
  // Najpierw posprzątaj istniejące instancje
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
	  convertEol: true,  // Wymuszaj konwersję znaków końca linii
	  theme: {
	    background: '#1e1e1e',
	    foreground: '#f0f0f0'
	  },
	  rendererType: 'canvas', // Lepsza wydajność
	  disableStdin: true,     // Wyłącz wejście z klawiatury
	  scrollback: 1000        // Zwiększ bufor przewijania
	});

  deployFitAddon.value = new FitAddon();
  deployTerminal.value.loadAddon(deployFitAddon.value);
  
  if (deployTerminalRef.value) {
    deployTerminal.value.open(deployTerminalRef.value);
    deployFitAddon.value.fit();
  }
};

// Zamknięcie strumienia deploy
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

// Obsługa zamknięcia dialogu
const handleDeployDialogClosed = () => {
  closeDeployStream();
  deployDialogVisible.value = false;
};

// Ręczne zamknięcie przez przycisk
const closeDeploy = () => {
  handleDeployDialogClosed();
};

// Funkcja deploy
const deployCompose = async (filename) => {
  try {
    deployDialogVisible.value = true;
    
    await nextTick();
    initDeployTerminal();
    
    deployTerminal.value.writeln('Starting deployment...');
    deployTerminal.value.writeln('========================\r\n');

    // Połączenie EventSource
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const wsUrl = `${protocol}//${window.location.hostname}:3000`;
    deployEventSource.value = new EventSource(`${wsUrl}/services/docker/composer/deploy-stream?file=${filename}`);
    
deployEventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          // Prawidłowe wyświetlanie tekstu w terminalu
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
  } catch (error) {
    console.error('Deployment error:', error);
    if (deployTerminal.value) {
      deployTerminal.value.writeln('Error: ' + error.message);
    }
  }
};


const loadTemplates = async () => {
  try {
    // Najpierw spróbuj pobrać z GitHub
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
    content: selectedTemplate.value.content
  };
};

const handleTemplateSelect = (row) => {
  selectedTemplate.value = row;
  composeForm.value = {
    filename: `${row.name.toLowerCase().replace(/ /g, '-')}.yml`,
    content: row.content
  };
  showTemplatesDialog.value = false;
  showCreateDialog.value = true;
};

const loadTemplatesDialog = async () => {
    showTemplatesDialog.value = true;
    loadTemplates();
}

onMounted(() => {
  fetchComposeFiles();
});

onBeforeUnmount(() => {
    closeDeployStream();
});
</script>

<style scoped>
.docker-compose {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 20px;
}

.icon {
  margin-right: 5px;
}

.deploy-log {
  max-height: 60vh;
  overflow: auto;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
}

.template-preview {
  max-height: 60vh;
  overflow: auto;
  background: #f8f8f8;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  border: 1px solid #eaeaea;
}

.terminal-container {
  width: 100%;
  height: 70vh;
  background: #1e1e1e;
  padding: 10px;
  border-radius: 4px;
}

.terminal {
  width: 100%;
  height: 100%;
}
</style>
