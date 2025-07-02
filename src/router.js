import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FilesView from '@/views/FilesView.vue'
import AppsView from '@/views/AppsView.vue'
import TerminalView from '@/views/TerminalView.vue'
import FileManager from '@/components/FileManager/FileBrowser.vue'
import { useAuth } from './services/AuthService'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/LoginView.vue'),
    meta: { 
      hideInMenu: true,
      icon: 'mdi:login' 
    }
  },
  {
    path: '/',
    redirect: '/dashboard',
    meta: { 
      hideInMenu: true 
    }
  },
  { 
    path: '/dashboard', 
    name: 'Dashboard',
    component: HomeView,
    meta: { 
      title: 'Pulpit', 
      requiresAuth: true,
      icon: 'mdi:view-dashboard' 
    } 
  },
  { 
    path: '/files/explorer', 
    name: 'Files',
    component: FileManager,
    meta: { 
      title: 'Pliki', 
      requiresAuth: true,
      icon: 'mdi:folder-multiple' 
    } 
  },
  { 
    path: '/apps', 
    name: 'Apps',
    component: AppsView,
    meta: { 
      title: 'Aplikacje', 
      requiresAuth: true,
      icon: 'mdi:apps' 
    } 
  },
  {
    path: '/storage',
    meta: { 
      title: 'Storage',
      icon: 'mdi:database' 
    },
    children: [
      {
        path: 'disks',
        name: 'Storage',
        component: () => import('@/components/storage/StorageDisks.vue'),
        meta: { 
          title: 'Dyski', 
          requiresAuth: true,
          icon: 'mdi:harddisk' 
        }
      },
      {
        path: 'filesystems',
        name: 'File Systems',
        component: () => import('@/components/storage/StorageFilesystems.vue'),
        meta: { 
          title: 'File Systems', 
          requiresAuth: true,
          icon: 'mdi:file-cabinet' 
        }
      },
      {
        path: 'smart/devices',
        name: 'SMART Devices',
        component: () => import('@/components/storage/smart/StorageSmartDevices.vue'),
        meta: { 
          title: 'Monitorowane urządzenia', 
          requiresAuth: true,
          icon: 'mdi:harddisk-plus' 
        }
      },
      {
        path: '/storage/smart/devices/details/:device',
        name: 'StorageSmartDetails',
        component: () => import('@/components/storage/smart/Details.vue'),
        props: true
      }
    ]
  },
  {
    path: '/system',
    meta: { 
      title: 'System',
      icon: 'mdi:cog' 
    },
    children: [
      {
        path: 'users',
        name: 'Użytkownicy',
        component: () => import('@/components/system/Users.vue'),
        meta: { 
          title: 'Użytkownicy', 
          requiresAuth: true,
          icon: 'mdi:account-group' 
        }
      },
      { 
        path: 'terminal', 
        name: 'Terminal',
        component: TerminalView,
        meta: { 
          title: 'Terminal', 
          requiresAuth: true,
          icon: 'mdi:console' 
        } 
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { isAuthenticated, checkAuth } = useAuth()
  
  if (to.meta.requiresAuth) {
    const authenticated = await checkAuth()
    if (!authenticated) {
      return '/login'
    }
  }
})

// Dynamiczne zmiany tytułu strony
router.beforeEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | NAS Panel` : 'NAS Panel'
})

export default router
