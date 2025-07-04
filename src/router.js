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
  path: '/network',
  meta: { 
    title: 'Network',
    icon: 'mdi:network' 
  },
  children: [
    {
      path: 'interfaces',
      name: 'Interfaces',
      component: () => import('@/components/network/Interfaces.vue'),
      meta: { 
        title: 'Interfejsy sieciowe', 
        requiresAuth: true,
        icon: 'mdi:ethernet-cable' 
      }
    },
    {
      path: 'interfaces/details/:interface',
      name: 'InterfaceDetails',
      component: () => import('@/components/network/interfaces/details/Details.vue'),
      props: true,
      meta: { 
        title: 'Szczegóły interfejsu', 
        requiresAuth: true,
        hideInMenu: true 
      }
    },
    {
      path: 'firewall',
      name: 'Firewall',
      component: () => import('@/components/network/firewall/Firewall.vue'),
      meta: { 
        title: 'Zapora sieciowa', 
        requiresAuth: true,
        icon: 'mdi:firewall' 
      }
    },
    {
      path: 'vpn',
      name: 'VPN',
      component: () => import('@/components/network/vpn/Vpn.vue'),
      meta: { 
        title: 'VPN', 
        requiresAuth: true,
        icon: 'mdi:lock' 
      }
    }
  ]
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
      },
      {
	path: 'updates',
	name: 'SystemUpdates',
	component: () => import('@/components/system/updates/Updates.vue'),
	meta: { 
	  title: 'System Updates', 
	  requiresAuth: true,
	  icon: 'mdi:update' 
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
