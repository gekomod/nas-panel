<template>
  <div class="app-container">
    <!-- Navbar z logo -->
    <Navbar @toggle-sidebar="toggleSidebar" />
    
    <div class="main-container">
      <!-- Sidebar bez logo -->
      <Sidebar :is-collapsed="isSidebarCollapsed" />
      
      <!-- Główna zawartość -->
      <div class="main-content" :class="{ 'collapsed': isSidebarCollapsed }">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Navbar from '@/components/Navbar.vue'
import Sidebar from '@/components/Sidebar.vue'

const isSidebarCollapsed = ref(false)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  transition: margin-left 0.3s;
  background-color: #f0f2f5;
}

.main-content.collapsed {
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }
  
  .main-content.collapsed {
    margin-left: 0;
  }
}
</style>
