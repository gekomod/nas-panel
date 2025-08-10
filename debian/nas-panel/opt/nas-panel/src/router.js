import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TerminalView from '@/views/TerminalView.vue'
import FileManager from '@/components/FileManager/FileBrowser.vue'
import NotificationsView from '@/views/NotificationsView.vue'
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
      title: 'Dashboard', 
      requiresAuth: true,
      icon: 'mdi:view-dashboard' 
    } 
  },
  {
  path: '/files',
  meta: { 
    title: 'Pliki',
    requiresAuth: true,
    icon: 'mdi:folder-multiple' 
  },
  children: [
	  { 
	    path: '/files/explorer', 
	    name: 'Files',
	    component: FileManager,
	    meta: { 
	      title: 'Eksplorator', 
	      requiresAuth: true,
	      icon: 'mdi:folder-multiple' 
	    } 
	  },
	  {
           path: '/files/shares',
           meta: {
             title: 'Udostępnianie',
             requiresAuth: true,
             icon: 'mdi:share-variant'
           }
          }
  ]
  },
{
  path: '/network',
  meta: { 
    title: 'Network',
    requiresAuth: true,
    icon: 'mdi:network' 
  },
  children: [
    {
      path: '/network/interfaces',
      name: 'Interfaces',
      component: () => import('@/components/network/Interfaces.vue'),
      meta: { 
        title: 'Interfejsy sieciowe', 
        requiresAuth: true,
        icon: 'mdi:ethernet-cable' 
      }
    },
    {
      path: '/network/interfaces/details/:interface',
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
      path: '/network/firewall',
      name: 'Firewall',
      component: () => import('@/components/network/firewall/Firewall.vue'),
      meta: { 
        title: 'Zapora sieciowa', 
        requiresAuth: true,
        icon: 'mdi:firewall' 
      }
    },
    {
      path: '/network/vpn',
      name: 'VPN',
      component: () => import('@/components/network/vpn/Vpn.vue'),
      meta: { 
        title: 'VPN', 
        requiresAuth: true,
        icon: 'mdi:lock' 
      }
    },
    {
      path: '/network/dynamic-dns',
      name: 'DynamicDns',
      component: () => import('@/components/network/DynamicDns/DynamicDns.vue'),
      meta: { 
        title: 'Dynamic DNS', 
        requiresAuth: true,
        icon: 'mdi:ip-network' 
      }
    }
  ]
},
{
  path: '/services',
  meta: { 
    title: 'Services',
    requiresAuth: true,
    icon: 'mdi:server-network' 
  },
  children: [
  {
   path: '/samba',
   meta: { 
     title: 'Samba',
     requiresAuth: true,
     icon: 'mdi:folder-network' 
   },
    children: [
   
	    {
	      path: '/services/samba/shares',
	      name: 'Samba',
	      component: () => import('@/components/services/Samba/SambaShares.vue'),
	      meta: { 
		title: 'Samba', 
		requiresAuth: true,
		icon: 'mdi:folder-network' 
	      }
	    },
	    {
	      path: '/services/samba/settings',
	      name: 'SambaSettings',
	      component: () => import('@/components/services/Samba/SambaSettings.vue'),
	      meta: { 
		title: 'Samba Settings', 
		requiresAuth: true,
		icon: 'mdi:cog' 
	      }
	    },
	    {
	      path: '/services/samba/status',
	      name: 'SambaStatus',
	      component: () => import('@/components/services/Samba/SambaStatus.vue'),
	      meta: { 
		title: 'Status usługi',
		requiresAuth: true,
		icon: 'mdi:server-network' 
	      }
	    }
	    ]
    },
    {
      path: '/services/docker',
      name: 'Docker',
      component: () => import('@/components/services/Docker/DockerStatus.vue'),
      meta: { 
        title: 'Docker', 
        requiresAuth: true,
        icon: 'mdi:docker' 
      }
    },
    {
      path: '/services/ssh',
      name: 'SSH',
      component: () => import('@/components/services/Ssh/SshSettings.vue'),
      meta: { 
        title: 'SSH', 
        requiresAuth: true,
        icon: 'mdi:console-network' 
        }
    },
    {
      path: '/services/webdav',
      name: 'WebDAV',
      component: () => import('@/components/services/Webdav/Webdav.vue'),
      meta: { 
        title: 'WebDAV', 
        requiresAuth: true,
        icon: 'mdi:web' 
      }
    },
    {
      path: '/services/ftp-sftp',
      name: 'FTP-SFTP',
      component: () => import('@/components/services/FtpSftp/FtpSftp.vue'),
      meta: { 
        title: 'FTP/SFTP', 
        requiresAuth: true,
        icon: 'mdi:folder-network' 
      }
    }
  ]
},
  {
    path: '/storage',
    meta: { 
      title: 'Storage',
      requiresAuth: true,
      icon: 'mdi:database' 
    },
    children: [
      {
        path: '/storage/disks',
        name: 'Storage',
        component: () => import('@/components/storage/StorageDisks.vue'),
        meta: { 
          title: 'Dyski', 
          requiresAuth: true,
          icon: 'mdi:harddisk' 
        }
      },
      {
        path: '/storage/filesystems',
        name: 'File Systems',
        component: () => import('@/components/storage/StorageFilesystems.vue'),
        meta: { 
          title: 'Systemy Plików', 
          requiresAuth: true,
          icon: 'mdi:file-cabinet' 
        }
      },
      {
	    path: '/storage/smart',
	    meta: { 
	      title: 'S.M.A.R.T',
	      requiresAuth: true,
	      icon: 'mdi:harddisk-plus' 
	    },
	    children: [
	      {
		path: '/storage/smart/devices',
		name: 'SMART Devices',
		component: () => import('@/components/storage/smart/StorageSmartDevices.vue'),
		meta: { 
		  title: 'Urządzenia', 
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
        }
    ]
  },
  {
    path: '/system',
    meta: { 
      title: 'System',
      requiresAuth: true,
      icon: 'mdi:cog' 
    },
    children: [
      {
        path: '/system/users',
        name: 'Użytkownicy',
        component: () => import('@/components/system/Users.vue'),
        meta: { 
          title: 'Użytkownicy', 
          requiresAuth: true,
          icon: 'mdi:account-group' 
        }
      },
      { 
        path: '/system/terminal', 
        name: 'Terminal',
        component: TerminalView,
        meta: { 
          title: 'Terminal', 
          requiresAuth: true,
          icon: 'mdi:console' 
        } 
      },
      {
	path: '/system/updates',
	name: 'SystemUpdates',
	component: () => import('@/components/system/updates/Updates.vue'),
	meta: { 
	  title: 'System Updates', 
	  requiresAuth: true,
	  icon: 'mdi:update' 
	}
      },
      {
	path: '/system/cron-jobs',
	name: 'CronJobs',
	component: () => import('@/components/system/Cron/CronJobs.vue'),
	meta: { 
	  title: 'Cron Jobs',
	  requiresAuth: true,
	  icon: 'mdi:firework'
	}
      },
      {
	path: '/system/antivirus',
	name: 'Antivirus',
	component: () => import('@/components/system/Antivirus/Antivirus.vue'),
	meta: { 
	  title: 'Antivirus',
	  requiresAuth: true,
	  icon: 'mdi:security'
	}
      },
	{
	  path: '/system/backup',
	  name: 'Backup',
	  component: () => import('@/components/system/Backup/Backup.vue'),
	  meta: { 
	    title: 'Backup',
	    requiresAuth: true,
	    icon: 'mdi:backup-restore' 
	  }
	},
      {
        path: '/system/settings',
        name: 'SystemSettings',
        component: () => import('@/components/system/Settings/Settings.vue'),
        meta: { 
          title: 'Ustawienia', 
          requiresAuth: true,
          icon: 'mdi:cog-outline' 
        }
      },
        {
    path: '/notifications',
    name: 'Notifications',
    component: NotificationsView,
    meta: { title: 'Powiadomienia', icon: 'mdi:bell', requiresAuth: true }
  }
    ]
  },
  {
    path: '/diagnostics',
    meta: { 
      title: 'Diagnostics',
      icon: 'mdi:chart-box' 
    },
    children: [
      {
        path: '/diagnostics/processes',
        name: 'ProcessMonitor',
        component: () => import('@/components/diagnostics/Processes/ProcessMonitor.vue'),
        meta: { 
          title: 'Monitor procesów', 
          requiresAuth: true,
          icon: 'mdi:chart-box-outline' 
        }
      },
      {
	  path: '/diagnostics/system-logs',
	  meta: { 
	    title: 'System Logs',
	    requiresAuth: true,
	    icon: 'mdi:file-document-outline' 
	  },
	  children: [
	    {
	      path: '/diagnostics/system-logs/local',
	      name: 'SystemLogs',
	      component: () => import('@/components/diagnostics/system-logs/LocalLogs.vue'),
	      meta: { 
		title: 'Local Logs', 
		requiresAuth: true,
		icon: 'mdi:file-document-multiple-outline' 
	      }
	    },
	    {
	      path: '/diagnostics/system-logs/remote',
	      name: 'RemoteLogs',
	      component: () => import('@/components/diagnostics/system-logs/RemoteLogs.vue'),
	      meta: { 
		title: 'Remote Logs', 
		requiresAuth: true,
		icon: 'mdi:server-network' 
	      }
	    }
	  ]
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
