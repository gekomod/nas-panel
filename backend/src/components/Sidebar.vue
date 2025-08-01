<template>
  <el-menu
    class="sidebar-menu"
    :default-active="activeMenu"
    :collapse="isCollapsed"
    :background-color="theme === 'dark' ? 'var(--sidebar-bg)' : 'var(--sidebar-bg)'"
    :text-color="theme === 'dark' ? 'var(--sidebar-text)' : 'var(--sidebar-text)'"
    :active-text-color="theme === 'dark' ? 'var(--sidebar-active-text)' : 'var(--sidebar-active-text)'"
    unique-opened
    router
    :collapse-transition="false"
    style="--el-menu-hover-bg-color: var(--el-menu-hover-bg-color)"
  >
    <template v-for="item in menuItems" :key="item.path">
      <!-- Poziom 1 - główne elementy menu -->
      <el-sub-menu v-if="item.children" :index="item.path">
        <template #title>
          <Icon :icon="item.meta.icon" width="18" height="18" class="menu-icon" />
          <span>{{ item.meta.title }}</span>
        </template>
        
        <!-- Poziom 2 - podmenu -->
        <template v-for="child in item.children" :key="child.path">
          <el-sub-menu v-if="child.children" :index="child.path">
            <template #title>
              <Icon :icon="child.meta.icon" width="18" height="18" class="menu-icon" />
              <span>{{ child.meta.title }}</span>
            </template>
            
            <!-- Poziom 3 - elementy podpodmenu -->
            <el-menu-item
              v-for="subChild in child.children"
              :key="subChild.path"
              :index="subChild.path"
            >
              <Icon :icon="subChild.meta.icon" width="18" height="18" class="menu-icon" />
              <span>{{ subChild.meta.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          
          <el-menu-item v-else :index="child.path">
            <Icon :icon="child.meta.icon" width="18" height="18" class="menu-icon" />
            <span>{{ child.meta.title }}</span>
          </el-menu-item>
        </template>
      </el-sub-menu>
      
      <el-menu-item v-else :index="item.path">
        <Icon :icon="item.meta.icon" width="18" height="18" class="menu-icon" />
        <span>{{ item.meta.title }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
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

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)

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
.sidebar-menu {
  height: 100%;
  overflow-y: auto;
  transition: width 0.3s ease;
  
  &:not(.el-menu--collapse) {
    width: 260px;
    @media (max-width: 768px) {
      width: 200px;
    }
    @media (max-width: 480px) {
      width: 180px;
    }
  }

  .el-menu-item,
  .el-sub-menu__title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-icon {
    margin-right: 12px;
    @media (max-width: 480px) {
      margin-right: 8px;
    }
  }
}

/* Ukrywamy strzałki na małych ekranach gdy sidebar jest złożony */
@media (max-width: 768px) {
  .el-menu--collapse .el-sub-menu > .el-sub-menu__title .el-sub-menu__icon-arrow {
    display: none;
  }
}

.sidebar-menu {
  background-color: var(--sidebar-bg) !important;
  color: var(--sidebar-text) !important;
  
  .el-menu-item,
  .el-sub-menu__title {
    color: var(--sidebar-text) !important;
    
    &:hover {
      background-color: var(--sidebar-hover-bg) !important;
    }
  }

  .el-menu-item.is-active {
    color: var(--sidebar-active-text) !important;
    background-color: var(--sidebar-hover-bg) !important;
  }

  .el-sub-menu {
    .el-menu {
      background-color: var(--sidebar-submenu-bg) !important;
    }
  }


  &:not(.el-menu--collapse) {
    width: 260px;
  }

  .el-sub-menu {
    &:hover {
      background-color: var(--sidebar-hover-bg) !important;
    }
  
    .el-menu-item {
      padding-left: 40px !important;
    }

  }

  .menu-icon {
    margin-right: 16px;
    font-size: 18px;
    vertical-align: middle;
  }
}
</style>
