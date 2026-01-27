<template>
  <div class="horizontal-sidebar">
    <div class="sidebar-header">
      <div class="header-left">
        <div class="logo-area">
          <slot name="logo">
            <div class="default-logo">
              <Icon icon="mdi:application" />
              <span>Dashboard</span>
            </div>
          </slot>
        </div>
      </div>
      <div class="header-right">
        <div class="header-actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>

    <div class="horizontal-menu-container">
      <el-menu
        mode="horizontal"
        :default-active="activeMenu"
        :background-color="theme === 'dark' ? 'var(--horizontal-bg-dark)' : 'var(--horizontal-bg)'"
        :text-color="theme === 'dark' ? 'var(--horizontal-text-dark)' : 'var(--horizontal-text)'"
        :active-text-color="theme === 'dark' ? 'var(--horizontal-active-dark)' : 'var(--horizontal-active)'"
        router
        class="horizontal-menu"
        @select="handleMenuSelect"
      >
        <template v-for="(item, index) in menuItems" :key="index">
          <!-- Poziom 1 - główne elementy -->
          <el-sub-menu 
            v-if="item.children && item.children.length > 0"
            :index="item.path"
            :class="{
              'is-opened': openedMenu === index,
              'is-active': isActivePath(item.path)
            }"
          >
            <template #title>
              <div class="menu-item-content">
                <div class="menu-icon-wrapper">
                  <el-icon v-if="item.meta.icon">
                    <Icon :icon="item.meta.icon" />
                  </el-icon>
                </div>
                <span class="menu-title">{{ $t(item.meta.title) }}</span>
                <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
              </div>
            </template>
            
            <!-- Poziom 2 - podmenu -->
            <template v-for="(child, childIndex) in item.children" :key="childIndex">
              <el-sub-menu
                v-if="child.children && child.children.length > 0"
                :index="child.path"
                :class="{
                  'is-opened': openedSubMenu === `${index}-${childIndex}`,
                  'is-active': isActivePath(child.path)
                }"
              >
                <template #title>
                  <div class="menu-item-content">
                    <div class="menu-icon-wrapper">
                      <el-icon v-if="child.meta.icon">
                        <Icon :icon="child.meta.icon" />
                      </el-icon>
                    </div>
                    <span class="menu-title">{{ $t(child.meta.title) }}</span>
                  </div>
                </template>
                
                <!-- Poziom 3 - elementy podpodmenu -->
                <el-menu-item
                  v-for="(subChild, subIndex) in child.children"
                  :key="subIndex"
                  :index="subChild.path"
                  :class="{ 'is-active': isActivePath(subChild.path) }"
                >
                  <div class="menu-item-content">
                    <div class="menu-icon-wrapper">
                      <el-icon v-if="subChild.meta.icon">
                        <Icon :icon="subChild.meta.icon" />
                      </el-icon>
                    </div>
                    <span class="menu-title">{{ $t(subChild.meta.title) }}</span>
                  </div>
                </el-menu-item>
              </el-sub-menu>
              
              <el-menu-item 
                v-else 
                :index="child.path"
                :class="{ 'is-active': isActivePath(child.path) }"
              >
                <div class="menu-item-content">
                  <div class="menu-icon-wrapper">
                    <el-icon v-if="child.meta.icon">
                      <Icon :icon="child.meta.icon" />
                    </el-icon>
                  </div>
                  <span class="menu-title">{{ $t(child.meta.title) }}</span>
                </div>
              </el-menu-item>
            </template>
          </el-sub-menu>
          
          <el-menu-item 
            v-else 
            :index="item.path"
            :class="{ 'is-active': isActivePath(item.path) }"
          >
            <div class="menu-item-content">
              <div class="menu-icon-wrapper">
                <el-icon v-if="item.meta.icon">
                  <Icon :icon="item.meta.icon" />
                </el-icon>
              </div>
              <span class="menu-title">{{ $t(item.meta.title) }}</span>
              <span class="menu-badge" v-if="item.meta.badge">{{ item.meta.badge }}</span>
            </div>
          </el-menu-item>
        </template>
      </el-menu>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)
const openedMenu = ref(null)
const openedSubMenu = ref(null)

const props = defineProps({
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark', 'system'].includes(value)
  }
})

const menuItems = computed(() => {
  const buildMenu = (routes, parentPath = '') => {
    return routes
      .filter(route => route.meta && !route.meta.hideInMenu)
      .map(route => {
        const fullPath = parentPath 
          ? `/${route.path}`.replace(/\/+/g, '/')
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

const isActivePath = (path) => {
  return activeMenu.value.startsWith(path)
}

const handleMenuSelect = (index) => {
  openedMenu.value = null
  openedSubMenu.value = null
}

const handleDocumentClick = (event) => {
  if (!event.target.closest('.horizontal-menu')) {
    openedMenu.value = null
    openedSubMenu.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.horizontal-sidebar {
  width: 100%;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  border-bottom: 1px solid #f1f5f9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .default-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border-radius: 12px;
    color: white;
    font-weight: 600;
    
    :deep(svg) {
      width: 24px;
      height: 24px;
    }
    
    span {
      font-size: 16px;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.horizontal-menu-container {
  overflow-x: auto;
  padding: 0 20px;
  
  &::-webkit-scrollbar {
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
    
    &:hover {
      background: #94a3b8;
    }
  }
}

.horizontal-menu {
  min-width: fit-content;
  border-bottom: none;
  height: 56px;
  background: transparent !important;
  display: flex;
  align-items: center;
  gap: 4px;
  
  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: 48px;
    line-height: 48px;
    border-radius: 12px;
    margin: 4px 2px;
    padding: 0 16px !important;
    border: 1px solid transparent;
    transition: all 0.3s ease;
    position: relative;
    overflow: visible;
    
    .menu-item-content {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 100%;
    }
    
    .menu-icon-wrapper {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(59, 130, 246, 0.08);
      border-radius: 8px;
      transition: all 0.3s ease;
      
      :deep(svg) {
        width: 18px;
        height: 18px;
      }
    }
    
    .menu-title {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .menu-badge {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 8px;
      margin-left: 6px;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    }
    
    &:hover {
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
      color: #1e293b !important;
      border-color: #cbd5e1;
      transform: translateY(-2px);
      
      .menu-icon-wrapper {
        background: rgba(59, 130, 246, 0.15);
        transform: scale(1.1);
      }
    }
  }
  
  :deep(.el-menu-item.is-active),
  :deep(.el-sub-menu.is-active .el-sub-menu__title) {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
    color: white !important;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    border-color: transparent;
    
    .menu-icon-wrapper {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .menu-badge {
      background: rgba(255, 255, 255, 0.9);
      color: #3b82f6;
      box-shadow: 0 2px 6px rgba(255, 255, 255, 0.2);
    }
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 3px;
      background: white;
      border-radius: 2px;
      box-shadow: 0 2px 4px rgba(255, 255, 255, 0.4);
    }
  }
}

:root {
  /* Light theme */
  --horizontal-bg: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  --horizontal-text: #1e293b;
  --horizontal-active: #ffffff;
}

.el-menu--dark.horizontal-menu {
  --horizontal-bg-dark: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  --horizontal-text-dark: #cbd5e1;
  --horizontal-active-dark: #3b82f6;
  
  background: var(--horizontal-bg-dark) !important;
  border-bottom: 1px solid #334155;
  
  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    color: var(--horizontal-text-dark) !important;
    
    .menu-icon-wrapper {
      background: rgba(255, 255, 255, 0.05);
    }
    
    &:hover {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
      color: white !important;
      border-color: #475569;
      
      .menu-icon-wrapper {
        background: rgba(96, 165, 250, 0.15);
      }
    }
  }
  
  :deep(.el-menu-item.is-active),
  :deep(.el-sub-menu.is-active .el-sub-menu__title) {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
}
</style>

<style>
/* Globalne style dla menu */
.el-menu--horizontal :deep(.el-sub-menu .el-menu) {
  position: absolute;
  background: white;
  min-width: 220px;
  z-index: 1000;
  display: none;
  left: 0;
  top: 100%;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 8px;
  margin-top: 4px;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.el-menu--horizontal :deep(.el-sub-menu.is-opened .el-menu),
.el-menu--horizontal :deep(.el-sub-menu:hover .el-menu) {
  display: block;
}

.el-menu--horizontal :deep(.el-sub-menu .el-sub-menu .el-menu) {
  left: 100%;
  top: -8px;
  margin-left: 8px;
}

.el-menu--horizontal :deep(.el-menu--popup) {
  min-width: 200px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 8px;
}

.el-menu--horizontal :deep(.el-menu-item),
.el-menu--horizontal :deep(.el-sub-menu__title) {
  white-space: nowrap;
}

.el-menu--horizontal :deep(.el-sub-menu__icon-arrow) {
  right: 10px;
  transition: transform 0.3s ease;
  margin-left: 8px;
}

.el-menu--horizontal :deep(.el-sub-menu.is-opened .el-sub-menu__icon-arrow) {
  transform: rotate(180deg);
}

/* Dark theme for dropdowns */
.el-menu--dark.el-menu--horizontal :deep(.el-sub-menu .el-menu) {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.el-menu--dark.el-menu--horizontal :deep(.el-menu--popup) {
  background: #1e293b;
  border-color: #334155;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .sidebar-header {
    padding: 0 16px;
    height: 56px;
  }
  
  .horizontal-menu-container {
    padding: 0 8px;
  }
  
  .horizontal-menu {
    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
      padding: 0 12px !important;
      font-size: 13px;
      
      .menu-icon-wrapper {
        width: 28px;
        height: 28px;
        
        :deep(svg) {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .logo-area .default-logo span {
    display: none;
  }
  
  .horizontal-menu {
    :deep(.el-menu-item .menu-title),
    :deep(.el-sub-menu__title .menu-title) {
      font-size: 12px;
    }
  }
}
</style>
