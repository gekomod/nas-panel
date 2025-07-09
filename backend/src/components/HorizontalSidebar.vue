<template>
  <div class="horizontal-sidebar">
    <el-menu
      mode="horizontal"
      :default-active="activeMenu"
      :background-color="theme === 'dark' ? 'var(--sidebar-bg)' : 'var(--sidebar-bg)'"
      :text-color="theme === 'dark' ? 'var(--sidebar-text)' : 'var(--sidebar-text)'"
      :active-text-color="theme === 'dark' ? 'var(--sidebar-active-text)' : 'var(--sidebar-active-text)'"
      router
      class="full-width-menu"
    >
      <template v-for="(item, index) in menuItems" :key="index">
        <!-- Poziom 1 - główne elementy -->
        <el-sub-menu 
          v-if="item.children && item.children.length > 0"
          :index="item.path"
          @mouseenter.native="openMenu(index)"
          @mouseleave.native="closeMenu(index)"
          :class="{'is-opened': openedMenu === index}"
        >
          <template #title>
            <el-icon v-if="item.meta.icon">
              <icon :icon="item.meta.icon" />
            </el-icon>
            <span>{{ item.meta.title }}</span>
          </template>
          
          <!-- Poziom 2 - podmenu -->
          <template v-for="(child, childIndex) in item.children" :key="childIndex">
            <el-sub-menu
              v-if="child.children && child.children.length > 0"
              :index="child.path"
              @mouseenter.native="openSubMenu(`${index}-${childIndex}`)"
              @mouseleave.native="closeSubMenu(`${index}-${childIndex}`)"
              :class="{'is-opened': openedSubMenu === `${index}-${childIndex}`}"
            >
              <template #title>
                <el-icon v-if="child.meta.icon">
                  <icon :icon="child.meta.icon" />
                </el-icon>
                <span>{{ child.meta.title }}</span>
              </template>
              
              <!-- Poziom 3 - elementy podpodmenu -->
              <el-menu-item
                v-for="(subChild, subIndex) in child.children"
                :key="subIndex"
                :index="subChild.path"
              >
                <el-icon v-if="subChild.meta.icon">
                  <icon :icon="subChild.meta.icon" />
                </el-icon>
                <span>{{ subChild.meta.title }}</span>
              </el-menu-item>
            </el-sub-menu>
            
            <el-menu-item v-else :index="child.path">
              <el-icon v-if="child.meta.icon">
                <icon :icon="child.meta.icon" />
              </el-icon>
              <span>{{ child.meta.title }}</span>
            </el-menu-item>
          </template>
        </el-sub-menu>
        
        <el-menu-item v-else :index="item.path">
          <el-icon v-if="item.meta.icon">
            <icon :icon="item.meta.icon" />
          </el-icon>
          <span>{{ item.meta.title }}</span>
        </el-menu-item>
      </template>
    </el-menu>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
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

const openMenu = (index) => {
  openedMenu.value = index
}

const closeMenu = (index) => {
  if (openedMenu.value === index) {
    openedMenu.value = null
  }
}

const openSubMenu = (index) => {
  openedSubMenu.value = index
}

const closeSubMenu = (index) => {
  if (openedSubMenu.value === index) {
    openedSubMenu.value = null
  }
}
</script>

<style scoped>
.horizontal-sidebar {
  width: 100%;
  overflow-x: auto;
}

.full-width-menu {
  width: 100%;
  display: flex;
  flex-wrap: nowrap;
  border-bottom: none;
}


.el-menu--horizontal > .el-sub-menu,
.el-menu--horizontal > .el-menu-item {
  float: none;
  display: inline-block;
}

.el-menu--horizontal .el-sub-menu .el-sub-menu__title,
.el-menu--horizontal .el-menu-item {
  height: 48px;
  line-height: 48px;
}

.el-icon {
  margin-right: 8px;
  vertical-align: middle;
}
</style>

<style>
/* Globalne style dla menu */
.el-menu--horizontal .el-sub-menu .el-menu {
  position: absolute;
  background-color: #304156;
  min-width: 200px;
  z-index: 100;
  display: none;
  left: 0;
  top: 100%;
}

.el-menu--horizontal .el-sub-menu.is-opened .el-menu,
.el-menu--horizontal .el-sub-menu:hover .el-menu {
  display: block;
}

.el-menu--horizontal .el-sub-menu .el-sub-menu .el-menu {
  left: 100%;
  top: 0;
  margin-left: 0;
}

.el-menu--horizontal .el-sub-menu,
.el-menu--horizontal .el-menu-item {
  white-space: nowrap;
}

.el-menu--horizontal .el-sub-menu__title,
.el-menu--horizontal .el-menu-item {
  padding: 0 20px !important;
}

.el-menu--horizontal .el-sub-menu:hover > .el-sub-menu__title,
.el-menu--horizontal .el-menu-item:hover {
  background-color: #263445 !important;
}

.el-menu--horizontal .el-sub-menu__icon-arrow {
  right: 10px;
}
</style>
