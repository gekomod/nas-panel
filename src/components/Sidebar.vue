<template>
  <el-menu
    class="sidebar-menu"
    :default-active="activeMenu"
    :collapse="isCollapsed"
    background-color="#304156"
    text-color="#bfcbd9"
    active-text-color="#409EFF"
    unique-opened
    router
    :collapse-transition="false"
  >
    <template v-for="item in menuItems" :key="item.path">
      <!-- Poziom 1 - główne elementy menu -->
      <el-sub-menu v-if="item.children" :index="item.path">
        <template #title>
          <Icon :icon="item.icon" width="18" height="18" class="menu-icon" />
          <span>{{ item.title }}</span>
        </template>
        
        <!-- Poziom 2 - podmenu -->
        <template v-for="child in item.children" :key="child.path">
          <el-sub-menu v-if="child.children" :index="child.path">
            <template #title>
              <Icon :icon="child.icon" width="18" height="18" class="menu-icon" />
              <span>{{ child.title }}</span>
            </template>
            
            <!-- Poziom 3 - elementy podpodmenu -->
            <el-menu-item
              v-for="subChild in child.children"
              :key="subChild.path"
              :index="subChild.path"
            >
              <Icon :icon="subChild.icon" width="18" height="18" class="menu-icon" />
              <span>{{ subChild.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          
          <el-menu-item v-else :index="child.path">
            <Icon :icon="child.icon" width="18" height="18" class="menu-icon" />
            <span>{{ child.title }}</span>
          </el-menu-item>
        </template>
      </el-sub-menu>
      
      <el-menu-item v-else :index="item.path">
        <Icon :icon="item.icon" width="18" height="18" class="menu-icon" />
        <span>{{ item.title }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'

defineProps({
  isCollapsed: Boolean
})

const route = useRoute()
const activeMenu = computed(() => route.path)

const menuItems = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: 'mdi:view-dashboard'
  },
  {
    title: 'Pliki',
    path: '/files',
    icon: 'mdi:folder-multiple',
    children: [
      {
        title: 'Eksplorator',
        path: '/files/explorer',
        icon: 'mdi:folder-open'
      },
      {
        title: 'Udostępnianie',
        path: '/files/shares',
        icon: 'mdi:share-variant'
      }
    ]
  },
  {
    title: 'Storage',
    path: '/storage',
    icon: 'mdi:database',
    children: [
      {
        title: 'Dyski',
        path: '/storage/disks',
        icon: 'mdi:harddisk'
      },
      {
        title: 'Systemy Plików',
        path: '/storage/filesystems',
        icon: 'mdi:file-cabinet'
      },
       { title: 'S.M.A.R.T',
         path: '/storage/smart',
         icon: 'mdi:harddisk-plus',
         children: [
           {
             title: 'Urządzenia',
             path: '/storage/smart/devices',
             icon: 'mdi:file-cabinet'
           }
         ]
       }
    ]
  },
  {
    title: 'System',
    path: '/system',
    icon: 'mdi:cog',
    children: [
      {
        title: 'Użytkownicy',
        path: '/system/users',
        icon: 'mdi:account-group'
      },
      {
        title: 'Powiadomienia',
        path: '/system/notifications',
        icon: 'mdi:bell'
      },
      {
        title: 'Terminal',
        path: '/system/terminal',
        icon: 'mdi:console'
      },
      {
        title: 'Zgłoszenia',
        path: '/system/tickets',
        icon: 'mdi:ticket'
      }
    ]
  }
]
</script>

<style scoped>
.sidebar-menu {
  height: 100%;
  border-right: none;
  transition: width 0.3s;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 260px;
}

.el-menu-item,
.el-sub-menu__title {
  height: 48px;
  line-height: 48px;
}

.el-menu-item.is-active {
  background-color: #263445 !important;
}

.el-sub-menu .el-menu-item {
  padding-left: 60px !important;
}

.el-sub-menu .el-sub-menu__title {
  padding-left: 20px !important;
}

.el-sub-menu .el-sub-menu .el-menu-item {
  padding-left: 80px !important;
}

.menu-icon {
  margin-right: 16px;
  font-size: 18px;
  vertical-align: middle;
}
</style>
