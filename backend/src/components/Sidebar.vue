<template>
  <div class="sidebar-container">
    <div class="mobile-toggle" @click="toggleMobileMenu" v-if="isMobile">
      <Icon :icon="isMobileMenuOpen ? 'ep:close' : 'ep:menu'" width="24" height="24" />
    </div>

    <div 
      class="mobile-overlay" 
      v-if="isMobile && isMobileMenuOpen" 
      @click="isMobileMenuOpen = false"
    ></div>

    <el-menu
      class="sidebar-menu"
      :class="{
        'mobile-menu': isMobile,
        'mobile-menu-open': isMobileMenuOpen,
        'el-menu--dark': theme === 'dark'
      }"
      :default-active="activeMenu"
      :collapse="isCollapsed && !isMobile"
      :background-color="theme === 'dark' ? 'var(--sidebar-bg)' : 'var(--sidebar-bg)'"
      :text-color="theme === 'dark' ? 'var(--sidebar-text)' : 'var(--sidebar-text)'"
      :active-text-color="theme === 'dark' ? 'var(--sidebar-active-text)' : 'var(--sidebar-active-text)'"
      unique-opened
      router
      :collapse-transition="false"
    >
      <template v-for="item in menuItems" :key="item.path">
        <el-sub-menu v-if="item.children" :index="item.path">
          <template #title>
            <Icon :icon="item.meta.icon" width="18" height="18" class="menu-icon" />
            <span class="menu-title">{{ item.meta.title }}</span>
            <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
          </template>
          
          <template v-for="child in item.children" :key="child.path">
            <el-sub-menu v-if="child.children" :index="child.path">
              <template #title>
                <Icon :icon="child.meta.icon" width="18" height="18" class="menu-icon" />
                <span class="menu-title">{{ child.meta.title }}</span>
                <span class="menu-badge" v-if="child.meta.badge">{{ child.meta.badge }}</span>
              </template>
              
              <el-menu-item
                v-for="subChild in child.children"
                :key="subChild.path"
                :index="subChild.path"
              >
                <Icon :icon="subChild.meta.icon" width="18" height="18" class="menu-icon" />
                <span class="menu-title">{{ subChild.meta.title }}</span>
                <span class="menu-badge" v-if="subChild.meta.badge">{{ subChild.meta.badge }}</span>
              </el-menu-item>
            </el-sub-menu>
            
            <el-menu-item v-else :index="child.path">
              <Icon :icon="child.meta.icon" width="18" height="18" class="menu-icon" />
              <span class="menu-title">{{ child.meta.title }}</span>
              <span class="menu-badge" v-if="child.meta.badge">{{ child.meta.badge }}</span>
            </el-menu-item>
          </template>
        </el-sub-menu>
        
        <el-menu-item v-else :index="item.path">
          <Icon :icon="item.meta.icon" width="18" height="18" class="menu-icon" />
          <span class="menu-title">{{ item.meta.title }}</span>
          <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
        </el-menu-item>
      </template>

      <div class="theme-toggle" @click="toggleTheme">
        <Icon :icon="theme === 'dark' ? 'ep:sunny' : 'ep:moon'" width="18" height="18" />
        <span v-if="!isCollapsed || isMobile">{{ theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}</span>
      </div>
    </el-menu>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const props = defineProps({
  isCollapsed: Boolean,
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark', 'system'].includes(value)
  }
})

const emit = defineEmits(['toggle-theme'])

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)
const isMobile = ref(false)
const isMobileMenuOpen = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) {
    isMobileMenuOpen.value = false
  }
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const toggleTheme = () => {
  emit('toggle-theme', props.theme === 'dark' ? 'light' : 'dark')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

const menuItems = computed(() => {
  const buildMenu = (routes, parentPath = '') => {
    return routes
      .filter(route => route.meta && !route.meta.hideInMenu)
      .map(route => {
        const fullPath = parentPath 
          ? `${route.path}`.replace(/\/+/g, '/')
          : route.path
        
        const children = route.children 
          ? buildMenu(route.children, fullPath)
          : []
        
        return {
          path: fullPath,
          meta: route.meta,
          children: children.length > 0 ? children : null
        }
      })
  }

  return buildMenu(router.options.routes)
})
</script>

<style lang="scss" scoped>
.sidebar-container {
  position: relative;
}

.mobile-toggle {
  display: none;
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 2001;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1999;
}

.sidebar-menu {
  height: 100vh;
  overflow-y: auto;
  transition: all 0.3s ease;
  position: relative;
  z-index: 2000;
  
  &:not(.el-menu--collapse) {
    width: 260px;
  }

  &.mobile-menu {
    position: fixed;
    top: 0;
    left: 0;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 2000;
    height: 100vh;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);

    &.mobile-menu-open {
      transform: translateX(0);
    }
  }

  .el-menu-item,
  .el-sub-menu__title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    position: relative;
    transition: all 0.2s ease;

    &:hover {
      transform: translateX(4px);
      background-color: var(--sidebar-hover-bg) !important;
      color: var(--sidebar-hover-text) !important;
      
      .menu-icon {
        color: var(--sidebar-hover-text) !important;
      }
    }
  }

  .menu-icon {
    margin-right: 12px;
    flex-shrink: 0;
    color: var(--sidebar-text);
    transition: color 0.2s ease;
  }

  .menu-title {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-badge {
    background: var(--el-color-primary);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
  }

  .theme-toggle {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--sidebar-text);
    transition: all 0.2s ease;
    margin-top: auto;
    position: absolute;
    bottom: 0;
    width: 100%;

    &:hover {
      background-color: var(--sidebar-hover-bg);
      color: var(--sidebar-hover-text);
    }

    span {
      margin-left: 10px;
    }
  }

  .el-menu-item.is-active {
    background-color: var(--sidebar-active-bg) !important;
    color: var(--sidebar-active-text) !important;
    
    .menu-icon {
      color: var(--sidebar-active-text) !important;
    }
  }
}

/* Dodaj te zmienne do swojego głównego pliku CSS lub tutaj */
:root {
  /* Light theme */
  --sidebar-bg: #ffffff;
  --sidebar-text: #333333;
  --sidebar-active-text: #409eff;
  --sidebar-hover-text: #409eff;
  --sidebar-hover-bg: #ecf5ff;
  --sidebar-active-bg: #ecf5ff;
  --sidebar-submenu-bg: #f5f5f5;

  /* Dark theme - zostaną użyte gdy theme="dark" */
  --el-menu-dark-bg: #1a1a1a;
  --el-menu-dark-text: #e0e0e0;
  --el-menu-dark-active-text: #409eff;
  --el-menu-dark-hover-bg: rgba(255, 255, 255, 0.1);
}

.el-menu--dark {
  --sidebar-bg: var(--el-menu-dark-bg);
  --sidebar-text: var(--el-menu-dark-text);
  --sidebar-active-text: var(--el-menu-dark-active-text);
  --sidebar-hover-text: var(--el-menu-dark-active-text);
  --sidebar-hover-bg: var(--el-menu-dark-hover-bg);
  --sidebar-active-bg: var(--el-menu-dark-hover-bg);
  --sidebar-submenu-bg: #121212;
}

/* Reszta styli pozostaje bez zmian */
@media (max-width: 992px) {
  .sidebar-menu:not(.el-menu--collapse) {
    width: 220px;
  }
}

@media (max-width: 768px) {
  .mobile-toggle {
    display: block;
  }

  .sidebar-menu {
    &:not(.mobile-menu) {
      display: none;
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.el-menu-item,
.el-sub-menu__title {
  animation: fadeIn 0.3s ease forwards;
}
</style>