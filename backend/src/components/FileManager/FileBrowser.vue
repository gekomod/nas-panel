<template>
  <div class="next-gen-file-manager">
    <!-- Floating Top Bar -->
    <div class="floating-bar">
      <div class="bar-left">
        <button class="nav-toggle" @click="navCollapsed = !navCollapsed">
          <Icon :icon="navCollapsed ? 'radix-icons:hamburger-menu' : 'radix-icons:cross-1'" />
        </button>
        <div class="breadcrumbs">
          <span 
            v-for="(part, index) in pathParts" 
            :key="index"
            @click="navigateTo(index)"
          >
            {{ part || 'Home' }}
            <Icon icon="radix-icons:chevron-right" v-if="index < pathParts.length - 1" />
          </span>
        </div>
      </div>
      <div class="bar-right">
        <div class="search-wrapper">
          <Icon icon="radix-icons:magnifying-glass" />
          <input 
            v-model="searchQuery" 
            placeholder="Search anything..."
            @input="debouncedSearch"
          />
        </div>
        <button class="action-btn" @click="toggleDarkMode">
          <Icon :icon="darkMode ? 'radix-icons:sun' : 'radix-icons:moon'" />
        </button>
        <button class="action-btn refresh-btn" @click="refresh">
          <Icon icon="radix-icons:update" :class="{ 'spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Glass Sidebar -->
      <div class="glass-sidebar" :class="{ 'collapsed': navCollapsed }">
        <div class="sidebar-section">
          <h3>Quick Access</h3>
          <div 
            v-for="location in locations" 
            :key="location.path"
            class="location-item"
            :class="{ 'active': currentPath === location.path }"
            @click="navigate(location.path)"
          >
            <Icon :icon="location.icon" />
            <span>{{ location.name }}</span>
          </div>
        </div>

        <div class="sidebar-section">
          <h3>Actions</h3>
          <button class="sidebar-btn" @click="showCreateFolderModal = true">
            <Icon icon="radix-icons:plus" /> New Folder
          </button>
          <button class="sidebar-btn" @click="uploadFile">
            <Icon icon="radix-icons:upload" /> Upload
          </button>
        </div>

        <div class="storage-info">
          <div class="storage-bar">
            <div :style="{ width: storagePercentage + '%' }" 
                 :class="getStorageUsageClass(storagePercentage)"></div>
          </div>
          <span>{{ freeSpace }} free of {{ totalSpace }}</span>
        </div>
      </div>

      <!-- File Display Area -->
      <div class="file-display">
        <!-- View Controls -->
        <div class="view-controls">
          <div class="view-options">
            <button 
              class="view-btn" 
              :class="{ 'active': viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <Icon icon="radix-icons:grid" />
            </button>
            <button 
              class="view-btn" 
              :class="{ 'active': viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              <Icon icon="radix-icons:list-bullet" />
            </button>
          </div>
          <div class="sort-options">
            <span>Sort by:</span>
            <select v-model="sortField" @change="sortOrder = 'asc'">
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="modified">Modified</option>
            </select>
            <button class="sort-direction" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
              <Icon :icon="sortOrder === 'asc' ? 'radix-icons:arrow-up' : 'radix-icons:arrow-down'" />
            </button>
          </div>
        </div>

        <!-- Loading/Error States -->
        <div v-if="loading" class="state-overlay">
          <div class="loading-spinner">
            <Icon icon="radix-icons:update" class="spin" />
            <span>Loading your files...</span>
          </div>
        </div>

        <div v-else-if="error" class="state-overlay error">
          <div class="error-content">
            <Icon icon="radix-icons:exclamation-triangle" />
            <span>{{ error }}</span>
            <button @click="refresh" class="modern-btn">Try Again</button>
          </div>
        </div>

        <!-- File Grid View -->
        <div v-else-if="viewMode === 'grid'" class="modern-grid">
          <div 
            v-for="item in filteredItems" 
            :key="item.path"
            class="grid-item"
            :class="{ 
              'selected': selectedItems.includes(item.path),
              'folder': item.type === 'directory'
            }"
            @click="handleItemClick(item, $event)"
            @dblclick="handleItemDoubleClick(item)"
            @contextmenu.prevent="showContextMenu(item, $event)"
          >
            <div class="item-icon">
              <Icon :icon="getFileIcon(item)" />
            </div>
            <div class="item-name">{{ item.name }}</div>
            <div class="item-meta">
              <span>{{ formatSize(item.size) }}</span>
              <span>{{ formatDate(item.modified) }}</span>
            </div>
            <div class="item-badge" v-if="selectedItems.includes(item.path)">
              <Icon icon="radix-icons:check" />
            </div>
          </div>
        </div>

        <!-- File List View -->
        <div v-else class="modern-list">
          <div class="list-header">
            <div class="list-col name-col" @click="sortBy('name')">
              <span>Name</span>
              <Icon v-if="sortField === 'name'" :icon="sortOrder === 'asc' ? 'radix-icons:arrow-up' : 'radix-icons:arrow-down'" />
            </div>
            <div class="list-col size-col" @click="sortBy('size')">
              <span>Size</span>
              <Icon v-if="sortField === 'size'" :icon="sortOrder === 'asc' ? 'radix-icons:arrow-up' : 'radix-icons:arrow-down'" />
            </div>
            <div class="list-col date-col" @click="sortBy('modified')">
              <span>Modified</span>
              <Icon v-if="sortField === 'modified'" :icon="sortOrder === 'asc' ? 'radix-icons:arrow-up' : 'radix-icons:arrow-down'" />
            </div>
          </div>
          <div 
            v-for="item in filteredItems" 
            :key="item.path"
            class="list-row"
            :class="{ 
              'selected': selectedItems.includes(item.path),
              'folder': item.type === 'directory'
            }"
            @click="handleItemClick(item, $event)"
            @dblclick="handleItemDoubleClick(item)"
            @contextmenu.prevent="showContextMenu(item, $event)"
          >
            <div class="list-col name-col">
              <Icon :icon="getFileIcon(item)" />
              <span>{{ item.name }}</span>
            </div>
            <div class="list-col size-col">{{ formatSize(item.size) }}</div>
            <div class="list-col date-col">{{ formatDate(item.modified) }}</div>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
          <span>{{ selectedItems.length }} selected</span>
          <span>{{ fileItems.length }} items</span>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.visible" 
      class="modern-context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div class="context-header">
        <Icon :icon="getFileIcon(contextMenu.item)" />
        <span>{{ contextMenu.item?.name }}</span>
      </div>
      <div class="context-divider"></div>
      <div class="context-item" @click="handleContextAction('open')">
        <Icon icon="radix-icons:open-in-new-window" /> Open
      </div>
      <div class="context-item" @click="handleContextAction('download')">
        <Icon icon="radix-icons:download" /> Download
      </div>
      <div class="context-item" @click="handleContextAction('edit')">
        <Icon icon="radix-icons:text" /> Edit
      </div>
      <div class="context-item" @click="handleContextAction('rename')">
        <Icon icon="radix-icons:pencil-1" /> Rename
      </div>
      <div class="context-divider"></div>
      <div class="context-item" @click="handleContextAction('delete')">
        <Icon icon="radix-icons:trash" /> Delete
      </div>
      <div class="context-item" @click="handleContextAction('permissions')">
        <Icon icon="radix-icons:lock-closed" /> Permissions
      </div>
      <div class="context-divider"></div>
      <div class="context-item" @click="handleContextAction('properties')">
        <Icon icon="radix-icons:info-circled" /> Properties
      </div>
    </div>

    <!-- Floating Action Button -->
    <button class="fab" @click="showCreateFolderModal = true">
      <Icon icon="radix-icons:plus" />
    </button>

    <!-- Modals (unchanged) -->
    <CreateFolderModal 
      v-if="showCreateFolderModal"
      @close="showCreateFolderModal = false"
      @create="createFolder"
    />

    <RenameModal 
      v-if="showRenameModal"
      :item="selectedItem"
      @close="showRenameModal = false"
      @rename="renameItem"
    />

    <PermissionsModal 
      v-if="showPermissionsModal"
      :items="selectedItems"
      @close="showPermissionsModal = false"
      @save="updatePermissions"
    />

  <FileEditorModal
    v-if="showFileEditorModal"
    :content="fileContent"
    :filename="selectedItem?.name"
    @save="saveFile"
    @close="showFileEditorModal = false"
  />

    <PropertiesModal 
      v-if="showPropertiesModal"
      :item="selectedItem"
      @close="showPropertiesModal = false"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import axios from 'axios';
import { debounce } from 'lodash-es';
import CreateFolderModal from './modals/CreateFolderModal.vue';
import RenameModal from './modals/RenameModal.vue';
import PermissionsModal from './modals/PermissionsModal.vue';
import PropertiesModal from './modals/PropertiesModal.vue';
import FileEditorModal from './modals/FileEditorModal.vue';

axios.defaults.baseURL = `${window.location.protocol}//${window.location.hostname}:3000`;

export default {
  components: {
    Icon,
    CreateFolderModal,
    RenameModal,
    PermissionsModal,
    PropertiesModal,
    FileEditorModal
  },
  setup() {
    // State (unchanged from original)
    const currentPath = ref('/');
    const fileItems = ref([]);
    const selectedItems = ref([]);
    const selectedItem = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const viewMode = ref('grid');
    const sortField = ref('name');
    const sortOrder = ref('asc');
    const searchQuery = ref('');
    const darkMode = ref(false);
    const navCollapsed = ref(false);
    const freeSpace = ref('0 GB');
    const totalSpace = ref('0 GB');
    const storagePercentage = ref(0);
    
    // Modals (unchanged)
    const showCreateFolderModal = ref(false);
    const showRenameModal = ref(false);
    const showPermissionsModal = ref(false);
    const showPropertiesModal = ref(false);
    const showFileEditorModal = ref(false);
    const fileContent = ref('');
    const editingFilePath = ref('');
    
    // Context Menu (unchanged)
    const contextMenu = ref({
      visible: false,
      x: 0,
      y: 0,
      item: null
    });

    // Locations with updated icons
    const locations = [
      { name: 'Home', path: '/', icon: 'ph:house-duotone' },
      { name: 'Documents', path: '/Documents', icon: 'ph:file-text-duotone' },
      { name: 'Pictures', path: '/Pictures', icon: 'ph:image-duotone' },
      { name: 'Downloads', path: '/Downloads', icon: 'ph:download-duotone' },
      { name: 'Music', path: '/Music', icon: 'ph:music-notes-duotone' },
      { name: 'Videos', path: '/Videos', icon: 'ph:film-strip-duotone' }
    ];

    // Computed properties (unchanged)
    const pathParts = computed(() => {
      return currentPath.value.split('/').filter(part => part !== '');
    });

    const filteredItems = computed(() => {
      let items = [...fileItems.value];
      
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        items = items.filter(item => 
          item.name.toLowerCase().includes(query)
        );
      }
      
      return items.sort((a, b) => {
        let comparison = 0;
        
        if (sortField.value === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortField.value === 'size') {
          comparison = a.size - b.size;
        } else if (sortField.value === 'modified') {
          comparison = new Date(a.modified) - new Date(b.modified);
        }

        return sortOrder.value === 'asc' ? comparison : -comparison;
      });
    });

    // Methods (unchanged except for icon updates in getFileIcon)
    const fetchFiles = async () => {
      loading.value = true;
      error.value = null;
      try {
        const response = await axios.get('/api/files', {
          params: { path: currentPath.value }
        });
        fileItems.value = response.data.files;
        freeSpace.value = response.data.freeSpace;
        totalSpace.value = response.data.totalSpace;
        
        const free = parseFloat(freeSpace.value);
        const total = parseFloat(totalSpace.value);
        storagePercentage.value = ((total - free) / total) * 100;
      } catch (err) {
        error.value = 'Failed to load files';
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const openFileEditor = async (file) => {
      try {
        loading.value = true;
        const response = await axios.get('/api/files/read/', {
          params: { filepath: file.path }
        });
        fileContent.value = response.data.content;
        editingFilePath.value = file.path;
        selectedItem.value = file;
        showFileEditorModal.value = true;
      } catch (err) {
        error.value = 'Failed to open file for editing';
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const saveFile = async (content) => {
      try {
        loading.value = true;
        await axios.post('/api/files/write', {
          path: editingFilePath.value,
          content
        });
        showFileEditorModal.value = false;
        refresh();
      } catch (err) {
        error.value = 'Failed to save file';
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const navigate = (path) => {
      currentPath.value = path;
      selectedItems.value = [];
    };

    const navigateTo = (index) => {
      const newPath = '/' + pathParts.value.slice(0, index + 1).join('/');
      navigate(newPath);
    };

    const refresh = () => {
      fetchFiles();
    };

    const sortBy = (field) => {
      if (sortField.value === field) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
      } else {
        sortField.value = field;
        sortOrder.value = 'asc';
      }
    };

    const handleItemClick = (item, event) => {
      if (event.ctrlKey || event.metaKey) {
        const index = selectedItems.value.indexOf(item.path);
        if (index === -1) {
          selectedItems.value.push(item.path);
        } else {
          selectedItems.value.splice(index, 1);
        }
      } else if (event.shiftKey) {
        if (selectedItems.value.length === 0) {
          selectedItems.value.push(item.path);
        } else {
          const lastSelected = selectedItems.value[selectedItems.value.length - 1];
          const lastIndex = fileItems.value.findIndex(f => f.path === lastSelected);
          const currentIndex = fileItems.value.findIndex(f => f.path === item.path);
          
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          
          selectedItems.value = [
            ...new Set([
              ...selectedItems.value,
              ...fileItems.value.slice(start, end + 1).map(f => f.path)
            ])
          ];
        }
      } else {
        selectedItems.value = [item.path];
      }
      
      selectedItem.value = item;
    };

    const handleItemDoubleClick = (item) => {
      if (item.type === 'directory') {
        navigate(item.path);
      } else {
        downloadFile(item);
      }
    };

    const showContextMenu = (item, event) => {
      contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        item
      };
      
      const closeMenu = () => {
        contextMenu.value.visible = false;
        document.removeEventListener('click', closeMenu);
      };
      
      document.addEventListener('click', closeMenu);
    };

    const handleContextAction = (action) => {
      contextMenu.value.visible = false;
      
      switch (action) {
        case 'open':
          if (contextMenu.value.item.type === 'directory') {
            navigate(contextMenu.value.item.path);
          } else {
            downloadFile(contextMenu.value.item);
          }
          break;
        case 'edit':
          openFileEditor(contextMenu.value.item);
          break;
        case 'download':
          downloadFile(contextMenu.value.item);
          break;
        case 'rename':
          selectedItem.value = contextMenu.value.item;
          showRenameModal.value = true;
          break;
        case 'delete':
          deleteItems([contextMenu.value.item.path]);
          break;
        case 'permissions':
          selectedItems.value = [contextMenu.value.item.path];
          showPermissionsModal.value = true;
          break;
        case 'properties':
          selectedItem.value = contextMenu.value.item;
          showPropertiesModal.value = true;
          break;
      }
    };

    const performAction = (action) => {
      switch (action) {
        case 'delete':
          deleteItems(selectedItems.value);
          break;
        case 'rename':
          if (selectedItems.value.length === 1) {
            selectedItem.value = fileItems.value.find(
              item => item.path === selectedItems.value[0]
            );
            showRenameModal.value = true;
          }
          break;
      }
    };

    const createFolder = async (folderName) => {
      try {
        await axios.post('/api/files/create-folder', {
          path: currentPath.value,
          name: folderName
        });
        refresh();
        showCreateFolderModal.value = false;
      } catch (err) {
        error.value = 'Failed to create folder';
        console.error(err);
      }
    };

    const renameItem = async (newName) => {
      try {
        await axios.post('/api/files/rename', {
          oldPath: selectedItem.value.path,
          newName
        });
        refresh();
        showRenameModal.value = false;
      } catch (err) {
        error.value = 'Failed to rename item';
        console.error(err);
      }
    };

    const deleteItems = async (paths) => {
      if (!paths.length) return;
      
      try {
        await axios.post('/api/files/delete', { paths });
        refresh();
        selectedItems.value = [];
      } catch (err) {
        error.value = 'Failed to delete items';
        console.error(err);
      }
    };

    const downloadFile = (file) => {
      window.open(axios.defaults.baseURL+`/api/files/download?path=${encodeURIComponent(file.path)}`, '_blank');
    };

    const uploadFile = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        const formData = new FormData();
        
        files.forEach(file => {
          formData.append('files', file);
        });
        
        formData.append('path', currentPath.value);
        
        try {
          await axios.post('/api/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          refresh();
        } catch (err) {
          error.value = 'Failed to upload files';
          console.error(err);
        }
      };
      
      input.click();
    };

    const updatePermissions = async (permissions) => {
      try {
        await axios.post('/api/files/permissions', {
          paths: selectedItems.value,
          permissions
        });
        refresh();
        showPermissionsModal.value = false;
      } catch (err) {
        error.value = 'Failed to update permissions';
        console.error(err);
      }
    };

    const toggleDarkMode = () => {
      darkMode.value = !darkMode.value;
      document.body.classList.toggle('dark-mode', darkMode.value);
    };

const getFileIcon = (item) => {
  if (item.type === 'directory') return 'ph:folder-duotone';

  const extension = item.name.split('.').pop().toLowerCase();

  const textFiles = ['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf'];

  if (textFiles.includes(extension)) {
    return 'radix-icons:file-text';
  }
  
  const iconMap = {
        // Documents
        pdf: 'ph:file-pdf-duotone',
        doc: 'ph:file-doc-duotone',
        docx: 'ph:file-doc-duotone',
        xls: 'ph:file-xls-duotone',
        xlsx: 'ph:file-xls-duotone',
        ppt: 'ph:file-ppt-duotone',
        pptx: 'ph:file-ppt-duotone',
        txt: 'ph:file-text-duotone',
        csv: 'ph:file-csv-duotone',
        
        // Images
        jpg: 'ph:image-duotone',
        jpeg: 'ph:image-duotone',
        png: 'ph:image-duotone',
        gif: 'ph:image-duotone',
        svg: 'ph:image-duotone',
        webp: 'ph:image-duotone',
        
        // Audio
        mp3: 'ph:music-notes-duotone',
        wav: 'ph:music-notes-duotone',
        ogg: 'ph:music-notes-duotone',
        
        // Video
        mp4: 'ph:film-strip-duotone',
        mov: 'ph:film-strip-duotone',
        avi: 'ph:film-strip-duotone',
        mkv: 'ph:film-strip-duotone',
        
        // Archives
        zip: 'ph:file-zip-duotone',
        rar: 'ph:file-zip-duotone',
        '7z': 'ph:file-zip-duotone',
        tar: 'ph:file-zip-duotone',
        gz: 'ph:file-zip-duotone',
        
        // Code
        js: 'ph:file-js-duotone',
        ts: 'ph:file-ts-duotone',
        html: 'ph:file-html-duotone',
        css: 'ph:file-css-duotone',
        json: 'ph:file-json-duotone',
        py: 'ph:file-py-duotone',
        java: 'ph:file-java-duotone',
        cpp: 'ph:file-cpp-duotone',
        
        // Config
        xml: 'ph:file-xml-duotone',
        yml: 'ph:file-code-duotone',
        yaml: 'ph:file-code-duotone',
        ini: 'ph:file-config-duotone',
        conf: 'ph:file-config-duotone'
  };

  return iconMap[extension] || 'ph:file-duotone';
};

    const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const getStorageUsageClass = (percent) => {
      if (percent > 90) return 'critical';
      if (percent > 70) return 'warning';
      return 'normal';
    };

    const debouncedSearch = debounce(() => {}, 300);

    onMounted(() => {
      fetchFiles();
      document.body.classList.toggle('dark-mode', darkMode.value);
    });

    watch(currentPath, () => {
      fetchFiles();
    });

    return {
      // State
      currentPath,
      fileItems,
      selectedItems,
      selectedItem,
      loading,
      error,
      viewMode,
      sortField,
      sortOrder,
      searchQuery,
      darkMode,
      navCollapsed,
      freeSpace,
      totalSpace,
      storagePercentage,
      
      // Modals
      showCreateFolderModal,
      showRenameModal,
      showPermissionsModal,
      showPropertiesModal,
      showFileEditorModal,
      fileContent,
      openFileEditor,
      saveFile,
  
      // Context Menu
      contextMenu,
      
      // Locations
      locations,
      
      // Computed
      pathParts,
      filteredItems,
      
      // Methods
      navigate,
      navigateTo,
      refresh,
      sortBy,
      handleItemClick,
      handleItemDoubleClick,
      showContextMenu,
      handleContextAction,
      performAction,
      createFolder,
      renameItem,
      deleteItems,
      downloadFile,
      uploadFile,
      updatePermissions,
      toggleDarkMode,
      getFileIcon,
      formatSize,
      formatDate,
      getStorageUsageClass,
      debouncedSearch
    };
  }
};
</script>

<style scoped>
.next-gen-file-manager {
  --bg-color: #f8fafc;
  --text-color: #0f172a;
  --primary-color: #3b82f6;
  --primary-light: #eff6ff;
  --secondary-color: #ffffff;
  --border-color: #e2e8f0;
  --hover-color: #f1f5f9;
  --selected-color: #dbeafe;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  --success-color: #10b981;
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-border: rgba(255, 255, 255, 0.2);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.dark-mode .next-gen-file-manager {
  --bg-color: #0f172a;
  --text-color: #f8fafc;
  --primary-color: #60a5fa;
  --primary-light: #1e3a8a;
  --secondary-color: #1e293b;
  --border-color: #334155;
  --hover-color: #1e293b;
  --selected-color: #1e40af;
  --glass-bg: rgba(15, 23, 42, 0.8);
  --glass-border: rgba(255, 255, 255, 0.1);
}

.floating-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background-color: var(--secondary-color);
  box-shadow: var(--shadow-md);
  border-bottom: 1px solid var(--border-color);
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-toggle {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.nav-toggle:hover {
  background-color: var(--hover-color);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumbs span {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: var(--transition);
}

.breadcrumbs span:hover {
  background-color: var(--hover-color);
  color: var(--primary-color);
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-wrapper {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  gap: 8px;
  width: 240px;
  transition: var(--transition);
}

.search-wrapper:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.search-wrapper input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-color);
  font-size: 14px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.action-btn:hover {
  background-color: var(--hover-color);
}

.refresh-btn.spin {
  animation: spin 1s linear infinite;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.glass-sidebar {
  width: 280px;
  padding: 16px;
  background-color: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  z-index: 40;
}

.glass-sidebar.collapsed {
  transform: translateX(-100%);
}

.sidebar-section {
  margin-bottom: 24px;
}

.sidebar-section h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color);
  opacity: 0.6;
  margin-bottom: 12px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 4px;
}

.location-item:hover {
  background-color: var(--hover-color);
}

.location-item.active {
  background-color: var(--selected-color);
  color: var(--primary-color);
}

.sidebar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 8px;
}

.sidebar-btn:hover {
  background-color: var(--primary-color);
  opacity: 0.9;
}

.storage-info {
  margin-top: auto;
  padding: 16px 0;
}

.storage-bar {
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.storage-bar div {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
}

.storage-bar div.warning {
  background-color: var(--warning-color);
}

.storage-bar div.critical {
  background-color: var(--error-color);
}

.file-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
}

.view-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-options {
  display: flex;
  gap: 8px;
}

.view-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.view-btn.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.sort-options select {
  background-color: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 8px;
  outline: none;
  cursor: pointer;
}

.sort-direction {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.sort-direction:hover {
  background-color: var(--hover-color);
}

.state-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-color);
  opacity: 0.7;
}

.error {
  color: var(--error-color);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.modern-btn {
  padding: 10px 20px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: var(--transition);
}

.modern-btn:hover {
  opacity: 0.9;
}

.modern-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding: 8px;
}

.grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 12px;
  background-color: var(--secondary-color);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
}

.grid-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-color);
}

.grid-item.selected {
  background-color: var(--selected-color);
  border-color: var(--primary-color);
}

.grid-item.folder {
  border-left: 4px solid var(--primary-color);
}

.item-icon {
  font-size: 48px;
  margin-bottom: 12px;
  align-self: center;
  color: var(--text-color);
}

.grid-item.folder .item-icon {
  color: var(--primary-color);
}

.item-name {
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  margin-bottom: 8px;
  font-size: 14px;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.7;
  margin-top: auto;
}

.item-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  background-color: var(--primary-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.modern-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background-color: var(--secondary-color);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.list-header {
  display: flex;
  padding: 12px 16px;
  background-color: var(--secondary-color);
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 10;
  font-size: 14px;
}

.list-col {
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.name-col {
  flex: 3;
}

.size-col {
  flex: 1;
  max-width: 120px;
}

.date-col {
  flex: 1;
  max-width: 180px;
}

.list-row {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition);
}

.list-row:hover {
  background-color: var(--hover-color);
}

.list-row.selected {
  background-color: var(--selected-color);
}

.list-row.folder {
  border-left: 4px solid var(--primary-color);
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.7;
}

.modern-context-menu {
  position: fixed;
  background-color: var(--secondary-color);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 220px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.context-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--hover-color);
  font-weight: 500;
}

.context-divider {
  height: 1px;
  background-color: var(--border-color);
}

.context-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 14px;
}

.context-item:hover {
  background-color: var(--hover-color);
}

.fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  transition: var(--transition);
  z-index: 30;
}

.fab:hover {
  transform: translateY(-2px) scale(1.05);
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Smooth transitions */
.next-gen-file-manager,
.next-gen-file-manager * {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
</style>
