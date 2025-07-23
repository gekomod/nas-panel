<template>
  <div class="app-container" :class="theme">
    <template v-if="!isLoginPage">
      <Navbar 
        @toggle-sidebar="toggleSidebar" 
        :theme="theme"
        @theme-changed="handleThemeChange"
      />
      
      <div class="main-container" :class="{'horizontal-layout': sidebarMode === 'horizontal'}">
        <!-- Sidebar w trybie vertical -->
        <Sidebar 
          v-if="sidebarMode === 'vertical'"
          :is-collapsed="isSidebarCollapsed" 
          :theme="theme"
        />

        <div class="main-content" :class="{ 
          'collapsed': isSidebarCollapsed && sidebarMode === 'vertical',
          'horizontal-layout': sidebarMode === 'horizontal'
        }">
          <div v-if="sidebarMode === 'horizontal'" class="horizontal-navbar">
            <HorizontalSidebar :theme="theme" />
          </div>
          
          <router-view />
        </div>
      </div>
    </template>
    
    <router-view v-else />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import Navbar from '@/components/Navbar.vue'
import Sidebar from '@/components/Sidebar.vue'
import HorizontalSidebar from '@/components/HorizontalSidebar.vue'

const route = useRoute()
const isSidebarCollapsed = ref(false)
const sidebarMode = ref('horizontal')
const theme = ref('system') // 'light', 'dark', or 'system'

const isLoginPage = computed(() => route.path === '/login')

const toggleSidebar = () => {
  if (sidebarMode.value === 'vertical') {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }
}

const handleThemeChange = (newTheme) => {
  theme.value = newTheme
  applyTheme(newTheme)
  localStorage.setItem('theme', newTheme)
}

const applyTheme = (themeToApply) => {
  const resolvedTheme = themeToApply === 'system' 
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : themeToApply

  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
}

const fetchSettings = async () => {
  try {
    const response = await axios.get('/system/settings')
    sidebarMode.value = response.data.ui?.sidebarMode || 'horizontal'
    theme.value = response.data.ui?.theme || localStorage.getItem('theme') || 'system'
    applyTheme(theme.value)
  } catch (error) {
    console.error('Failed to load settings, using default:', error)
    sidebarMode.value = 'horizontal'
    theme.value = localStorage.getItem('theme') || 'system'
    applyTheme(theme.value)
  }
}

// Watch for system theme changes
onMounted(() => {
  fetchSettings()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })
})
</script>


<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-regular);
}

.app-container.dark {
  --el-bg-color: #1a1a1a;
  --el-text-color-regular: #e5e5e5;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  &.horizontal-layout {
    flex-direction: column;
  }
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  transition: margin-left 0.3s;
  background-color: var(--el-bg-color-page);
  
  &.collapsed {
    margin-left: 64px;
  }
  
  &.horizontal-layout {
    margin-left: 0;
    padding-top: 0;
  }
}

.horizontal-navbar {
  background-color: var(--el-menu-bg-color);
  color: var(--el-menu-text-color);
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    
    &.collapsed {
      margin-left: 0;
    }
  }
  
  .horizontal-navbar {
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
