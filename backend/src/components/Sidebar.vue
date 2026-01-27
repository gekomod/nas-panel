<template>
  <div class="sidebar-container">
    <div class="mobile-toggle" @click="toggleMobileMenu" v-if="isMobile">
      <div class="mobile-toggle-icon">
        <Icon :icon="isMobileMenuOpen ? 'ep:close' : 'ep:menu'" width="20" height="20" />
      </div>
    </div>

    <div 
      class="mobile-overlay" 
      v-if="isMobile && isMobileMenuOpen" 
      @click="isMobileMenuOpen = false"
    ></div>

    <div 
      class="sidebar-menu-wrapper"
      :class="{
        'mobile-menu': isMobile,
        'mobile-menu-open': isMobileMenuOpen,
        'collapsed': isCollapsed && !isMobile,
        'dark-theme': actualTheme === 'dark'
      }"
    >
      <!-- Logo Section -->
      <div class="sidebar-logo" v-if="!isCollapsed || isMobile">
        <div class="logo-icon">
          <Icon icon="mdi:chart-box" width="28" height="28" />
        </div>
        <div class="logo-text">
          <span class="logo-main">Dashboard</span>
          <span class="logo-sub">Pro</span>
        </div>
      </div>
      
      <div class="sidebar-divider"></div>

      <!-- Menu Items -->
      <div class="menu-scroll-area">
        <el-menu
          class="sidebar-menu"
          :class="{ 'dark-theme': actualTheme === 'dark' }"
          :default-active="activeMenu"
          :collapse="isCollapsed && !isMobile"
          :background-color="actualTheme === 'dark' ? 'var(--sidebar-bg-dark)' : 'transparent'"
          :text-color="actualTheme === 'dark' ? 'var(--sidebar-text-dark)' : 'var(--sidebar-text)'"
          :active-text-color="actualTheme === 'dark' ? 'var(--sidebar-active-dark)' : 'var(--sidebar-active)'"
          unique-opened
          router
          :collapse-transition="false"
        >
          <template v-for="(item, index) in menuItems" :key="item.path">
            <el-sub-menu v-if="item.children" :index="item.path">
              <template #title>
                <div class="menu-item-wrapper">
                  <div class="menu-icon-container" :class="{ 'active': isActivePath(item.path) }">
                    <Icon :icon="item.meta.icon" width="20" height="20" class="menu-icon" />
                  </div>
                  <span class="menu-title">{{ $t(item.meta.title) }}</span>
                  <div class="menu-indicators">
                    <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
                    <Icon icon="ep:arrow-down" width="12" height="12" class="menu-arrow" />
                  </div>
                </div>
              </template>
              
              <div class="submenu-items">
                <template v-for="child in item.children" :key="child.path">
                  <div class="submenu-item" v-if="child.children">
                    <div class="submenu-header">
                      <div class="submenu-icon">
                        <Icon :icon="child.meta.icon" width="16" height="16" />
                      </div>
                      <span class="submenu-title">{{ $t(child.meta.title) }}</span>
                    </div>
                    <div class="submenu-children">
                      <el-menu-item
                        v-for="subChild in child.children"
                        :key="subChild.path"
                        :index="subChild.path"
                        :class="{ 'active': isActivePath(subChild.path) }"
                      >
                        <div class="menu-item-wrapper">
                          <div class="menu-icon-container">
                            <Icon :icon="subChild.meta.icon" width="14" height="14" class="menu-icon" />
                          </div>
                          <span class="menu-title">{{ $t(subChild.meta.title) }}</span>
                          <div class="menu-indicators">
                            <span class="menu-badge" v-if="subChild.meta.badge">{{ subChild.meta.badge }}</span>
                          </div>
                        </div>
                      </el-menu-item>
                    </div>
                  </div>
                  
                  <el-menu-item v-else :index="child.path" :class="{ 'active': isActivePath(child.path) }">
                    <div class="menu-item-wrapper">
                      <div class="menu-icon-container" :class="{ 'active': isActivePath(child.path) }">
                        <Icon :icon="child.meta.icon" width="16" height="16" class="menu-icon" />
                      </div>
                      <span class="menu-title">{{ $t(child.meta.title) }}</span>
                      <div class="menu-indicators">
                        <span class="menu-badge" v-if="child.meta.badge">{{ child.meta.badge }}</span>
                      </div>
                    </div>
                  </el-menu-item>
                </template>
              </div>
            </el-sub-menu>
            
            <el-menu-item v-else :index="item.path" :class="{ 'active': isActivePath(item.path) }">
              <div class="menu-item-wrapper">
                <div class="menu-icon-container" :class="{ 'active': isActivePath(item.path) }">
                  <Icon :icon="item.meta.icon" width="20" height="20" class="menu-icon" />
                </div>
                <span class="menu-title">{{ $t(item.meta.title) }}</span>
                <div class="menu-indicators">
                  <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
                </div>
              </div>
            </el-menu-item>
          </template>
        </el-menu>
      </div>

      <!-- Bottom Section -->
      <div class="sidebar-bottom">
        <div class="theme-toggle-container">
          <div class="theme-toggle" @click="toggleTheme">
            <div class="theme-toggle-icon" :class="{ 'active': actualTheme === 'dark' }">
              <Icon :icon="actualTheme === 'dark' ? 'ep:sunny' : 'ep:moon'" width="18" height="18" />
            </div>
            <span v-if="!isCollapsed || isMobile" class="theme-toggle-text">
              {{ actualTheme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
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
const systemTheme = ref('light')

// Sprawdź preferencje systemowe
const checkSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    systemTheme.value = 'dark'
  } else {
    systemTheme.value = 'light'
  }
}

// Obliczony rzeczywisty motyw do użycia w stylach
const actualTheme = computed(() => {
  if (props.theme === 'system') {
    return systemTheme.value
  }
  return props.theme
})

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
  // Przełącz między trybami (light/dark/system nie zmieniamy tutaj)
  // To powinno być obsługiwane przez rodzica
  emit('toggle-theme', props.theme === 'dark' ? 'light' : 'dark')
}

const isActivePath = (path) => {
  return activeMenu.value.startsWith(path)
}

// Nasłuchuj zmian preferencji systemowych
let mediaQueryListener = null

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // Sprawdź i nasłuchuj zmiany motywu systemowego
  checkSystemTheme()
  
  mediaQueryListener = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQueryListener.addEventListener('change', checkSystemTheme)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  if (mediaQueryListener) {
    mediaQueryListener.removeEventListener('change', checkSystemTheme)
  }
})

// Dodaj watch dla props.theme aby móc debugować
watch(() => props.theme, (newTheme) => {
  console.log('Theme changed to:', newTheme)
})

// Obserwuj zmianę actualTheme (dla debugowania)
watch(actualTheme, (newTheme) => {
  console.log('Actual theme changed to:', newTheme)
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
  height: 100%;
}

.mobile-toggle {
  display: none;
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 2001;
  
  .mobile-toggle-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    color: #f8fafc;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
    border: 1px solid #1e293b;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    &:hover {
      background: #1e293b;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1998;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sidebar-menu-wrapper {
  height: 100vh;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2000;
  width: 280px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.collapsed {
    width: 80px;
    
    .sidebar-logo {
      padding: 20px 10px;
      
      .logo-text {
        display: none;
      }
      
      .logo-icon {
        margin: 0 auto;
      }
    }
    
    .menu-title,
    .menu-badge,
    .menu-arrow,
    .user-info,
    .theme-toggle-text {
      display: none;
    }
    
    .menu-item-wrapper {
      justify-content: center;
    }
    
    .user-profile {
      justify-content: center;
      padding: 16px 10px;
    }
    
    .theme-toggle {
      justify-content: center;
      padding: 12px 10px;
    }
    
    .submenu-items {
      display: none;
    }
  }
  
  &.mobile-menu {
    position: fixed;
    top: 0;
    left: 0;
    transform: translateX(-100%);
    z-index: 1999;
    height: 100vh;
    box-shadow: 4px 0 40px rgba(0, 0, 0, 0.3);
    border-radius: 0 24px 24px 0;
    border: none;

    &.mobile-menu-open {
      transform: translateX(0);
      animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(-100%);
      opacity: 0.5;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
}

.sidebar-logo {
  padding: 28px 24px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #334155;
  
  .logo-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: 14px;
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
  }
  
  .logo-text {
    display: flex;
    flex-direction: column;
    
    .logo-main {
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    
    .logo-sub {
      font-size: 12px;
      font-weight: 500;
      color: #94a3b8;
      margin-top: 2px;
    }
  }
}

.sidebar-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #334155 20%, #334155 80%, transparent 100%);
  margin: 0 24px;
}

.menu-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 2px;
    
    &:hover {
      background: #64748b;
    }
  }
}

.sidebar-menu {
  border-right: none !important;
  background: transparent !important;
  
  .el-menu-item,
  :deep(.el-sub-menu__title) {
    height: 48px;
    margin: 4px 0;
    border-radius: 12px;
    padding: 0 12px !important;
    border: 1px solid transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    background: transparent !important;
    
    .menu-item-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
      gap: 12px;
      height: 100%;
    }
    
    .menu-icon-container {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      
      .menu-icon {
        color: #94a3b8;
        transition: all 0.3s ease;
      }
      
      &.active {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        
        .menu-icon {
          color: white;
        }
      }
    }
    
    .menu-title {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #cbd5e1;
      transition: all 0.3s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .menu-indicators {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .menu-badge {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 8px;
      min-width: 24px;
      text-align: center;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
    }
    
    .menu-arrow {
      color: #64748b;
      transition: transform 0.3s ease;
    }
    
    &:hover {
      background: rgba(255, 255, 255, 0.05) !important;
      border-color: #475569;
      
      .menu-icon-container {
        background: rgba(255, 255, 255, 0.1);
        
        .menu-icon {
          color: #e2e8f0;
        }
        
        &.active {
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          transform: scale(1.05);
        }
      }
      
      .menu-title {
        color: #f1f5f9;
      }
      
      .menu-arrow {
        color: #94a3b8;
      }
    }
    
    &:active {
      transform: scale(0.98);
    }
  }
  
  :deep(.el-sub-menu.is-opened) {
    > .el-sub-menu__title {
      .menu-arrow {
        transform: rotate(180deg);
        color: #3b82f6;
      }
    }
  }
  
  .el-menu-item.is-active,
  :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.15) 100%) !important;
    border-color: rgba(59, 130, 246, 0.3);
    
    .menu-icon-container {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      
      .menu-icon {
        color: white;
      }
      
      &.active {
        background: white;
        
        .menu-icon {
          color: #3b82f6;
        }
      }
    }
    
    .menu-title {
      color: #3b82f6 !important;
      font-weight: 600;
    }
    
    .menu-badge {
      background: rgba(59, 130, 246, 0.9);
      color: white;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
    }
    
    .menu-arrow {
      color: #3b82f6;
    }
    
    &:hover {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(29, 78, 216, 0.2) 100%) !important;
      
      .menu-icon-container {
        &.active {
          background: white;
        }
      }
    }
  }
  
  .submenu-items {
    margin: 8px 0;
    padding-left: 16px;
    border-left: 2px solid rgba(255, 255, 255, 0.05);
    
    .submenu-item {
      margin-bottom: 12px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .submenu-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        margin-bottom: 4px;
        border-radius: 8px;
        
        .submenu-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          color: #94a3b8;
        }
        
        .submenu-title {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.02em;
        }
      }
      
      .submenu-children {
        padding-left: 12px;
        
        .el-menu-item {
          height: 36px;
          padding: 0 10px !important;
          margin: 2px 0;
          
          .menu-icon-container {
            width: 28px;
            height: 28px;
            background: rgba(255, 255, 255, 0.02);
            
            .menu-icon {
              width: 14px;
              height: 14px;
            }
          }
          
          .menu-title {
            font-size: 13px;
            color: #94a3b8;
          }
          
          &:hover {
            background: rgba(255, 255, 255, 0.03) !important;
            
            .menu-icon-container {
              background: rgba(255, 255, 255, 0.05);
            }
            
            .menu-title {
              color: #cbd5e1;
            }
          }
          
          &.active {
            background: rgba(59, 130, 246, 0.1) !important;
            border-color: rgba(59, 130, 246, 0.2);
            
            .menu-icon-container {
              background: rgba(59, 130, 246, 0.2);
            }
            
            .menu-title {
              color: #3b82f6 !important;
            }
          }
        }
      }
    }
    
    .el-menu-item {
      height: 40px;
      padding-left: 16px !important;
      
      .menu-icon-container {
        width: 32px;
        height: 32px;
      }
      
      &.active {
        background: rgba(59, 130, 246, 0.15) !important;
        
        .menu-icon-container {
          background: #3b82f6;
          
          .menu-icon {
            color: white;
          }
        }
        
        .menu-title {
          color: #3b82f6 !important;
        }
      }
    }
  }
}

.sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid #334155;
  padding: 20px;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 16px;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
  
  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(59, 130, 246, 0.3);
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  
  .user-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    
    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .user-role {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }
  }
}

.theme-toggle-container {
  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
    
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: #475569;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      
      .theme-toggle-icon {
        &.active {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        
        &:not(.active) {
          background: #f8fafc;
          color: #0f172a;
        }
      }
    }
    
    &:active {
      transform: translateY(-1px);
    }
    
    .theme-toggle-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #94a3b8;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
      
      &.active {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
      }
    }
    
    .theme-toggle-text {
      font-size: 14px;
      font-weight: 500;
      color: #cbd5e1;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

/* Light Theme (overrides for light mode) */
.sidebar-menu-wrapper:not(.dark-theme) {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-right: 1px solid #e2e8f0;
  
  .sidebar-logo {
    border-bottom-color: #e2e8f0;
    
    .logo-text {
      .logo-main {
        color: #0f172a;
      }
      
      .logo-sub {
        color: #64748b;
      }
    }
  }
  
  .sidebar-divider {
    background: linear-gradient(90deg, transparent 0%, #e2e8f0 20%, #e2e8f0 80%, transparent 100%);
  }
  
  .menu-scroll-area {
    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
    }
    
    &::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      
      &:hover {
        background: #94a3b8;
      }
    }
  }
  
  .sidebar-menu {
    .el-menu-item,
    :deep(.el-sub-menu__title) {
      .menu-icon-container {
        background: rgba(0, 0, 0, 0.03);
        
        .menu-icon {
          color: #64748b;
        }
        
        &.active {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }
      }
      
      .menu-title {
        color: #334155;
      }
      
      .menu-arrow {
        color: #94a3b8;
      }
      
      &:hover {
        background: rgba(0, 0, 0, 0.03) !important;
        border-color: #cbd5e1;
        
        .menu-icon-container {
          background: rgba(0, 0, 0, 0.06);
          
          .menu-icon {
            color: #475569;
          }
        }
        
        .menu-title {
          color: #0f172a;
        }
      }
    }
    
    .el-menu-item.is-active,
    :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%) !important;
      border-color: rgba(59, 130, 246, 0.2);
      
      .menu-icon-container {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        
        .menu-icon {
          color: white;
        }
      }
      
      .menu-title {
        color: #1d4ed8 !important;
      }
      
      .menu-badge {
        background: rgba(59, 130, 246, 0.9);
      }
    }
    
    .submenu-items {
      border-left-color: rgba(0, 0, 0, 0.05);
      
      .submenu-item {
        .submenu-header {
          .submenu-icon {
            background: rgba(0, 0, 0, 0.02);
            color: #64748b;
          }
          
          .submenu-title {
            color: #64748b;
          }
        }
        
        .submenu-children {
          .el-menu-item {
            .menu-icon-container {
              background: rgba(0, 0, 0, 0.01);
            }
            
            .menu-title {
              color: #64748b;
            }
            
            &:hover {
              background: rgba(0, 0, 0, 0.02) !important;
              
              .menu-icon-container {
                background: rgba(0, 0, 0, 0.03);
              }
              
              .menu-title {
                color: #475569;
              }
            }
            
            &.active {
              background: rgba(59, 130, 246, 0.08) !important;
              border-color: rgba(59, 130, 246, 0.15);
              
              .menu-icon-container {
                background: rgba(59, 130, 246, 0.15);
              }
              
              .menu-title {
                color: #1d4ed8 !important;
              }
            }
          }
        }
      }
      
      .el-menu-item {
        &.active {
          background: rgba(59, 130, 246, 0.1) !important;
        }
      }
    }
  }
  
  .sidebar-bottom {
    border-top-color: #e2e8f0;
  }
  
  .user-profile {
    background: rgba(0, 0, 0, 0.02);
    
    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
    
    .user-info {
      .user-name {
        color: #0f172a;
      }
      
      .user-role {
        color: #64748b;
      }
    }
  }
  
  .theme-toggle-container {
    .theme-toggle {
      background: rgba(0, 0, 0, 0.02);
      
      &:hover {
        background: rgba(0, 0, 0, 0.04);
        border-color: #cbd5e1;
        
        .theme-toggle-icon {
          &:not(.active) {
            background: #0f172a;
            color: #f8fafc;
          }
        }
      }
      
      .theme-toggle-icon {
        background: rgba(0, 0, 0, 0.04);
        color: #64748b;
        
        &.active {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
      }
      
      .theme-toggle-text {
        color: #334155;
      }
    }
  }
  
  .mobile-toggle {
    .mobile-toggle-icon {
      background: white;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      
      &:hover {
        background: #f8fafc;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
      }
    }
  }
}

@media (max-width: 768px) {
  .mobile-toggle {
    display: block;
  }

  .sidebar-menu-wrapper:not(.mobile-menu) {
    display: none;
  }
}

/* Menu items animation */
.sidebar-menu {
  .el-menu-item,
  :deep(.el-sub-menu__title) {
    animation: slideInRight 0.4s ease forwards;
    animation-delay: calc(var(--item-index, 0) * 0.03s);
    opacity: 0;
    transform: translateX(-10px);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Focus styles for accessibility */
.sidebar-menu {
  .el-menu-item:focus-visible,
  :deep(.el-sub-menu__title:focus-visible) {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
}

/* Smooth transitions */
.sidebar-menu-wrapper,
.sidebar-menu-wrapper * {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
