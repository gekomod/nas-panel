import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import TerminalView from '@/views/TerminalView.vue'
import FileManager from '@/components/FileManager/FileBrowser.vue'
import NotificationsView from '@/views/NotificationsView.vue'
import { useAuth } from './services/AuthService'
import { i18n } from './locales' // importujemy bezpośrednio i18n

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/LoginView.vue'),
    meta: { 
      hideInMenu: true,
      hideLayout: true,
      icon: 'mdi:login',
      title: 'routes.login'
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
      title: 'routes.dashboard',
      requiresAuth: true,
      icon: 'mdi:view-dashboard' 
    } 
  },
  {
    path: '/files',
    meta: { 
      title: 'routes.files',
      requiresAuth: true,
      icon: 'mdi:folder-multiple' 
    },
    children: [
      { 
        path: '/files/explorer', 
        name: 'Files',
        component: FileManager,
        meta: { 
          title: 'routes.files_explorer',
          requiresAuth: true,
          icon: 'mdi:folder-multiple' 
        } 
      },
      {
        path: '/files/shares',
        meta: {
          title: 'routes.files_shares',
          requiresAuth: true,
          icon: 'mdi:share-variant'
        }
      }
    ]
  },
  {
    path: '/network',
    meta: { 
      title: 'routes.network',
      requiresAuth: true,
      icon: 'mdi:network' 
    },
    children: [
      {
        path: '/network/interfaces',
        name: 'Interfaces',
        component: () => import('@/components/network/Interfaces.vue'),
        meta: { 
          title: 'routes.network_interfaces',
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
          title: 'routes.interface_details',
          requiresAuth: true,
          hideInMenu: true 
        }
      },
      {
        path: '/network/firewall',
        name: 'Firewall',
        component: () => import('@/components/network/firewall/Firewall.vue'),
        meta: { 
          title: 'routes.firewall',
          requiresAuth: true,
          icon: 'mdi:firewall' 
        }
      },
      {
        path: '/network/vpn',
        name: 'VPN',
        component: () => import('@/components/network/vpn/Vpn.vue'),
        meta: { 
          title: 'routes.vpn',
          requiresAuth: true,
          icon: 'mdi:lock' 
        }
      },
      {
        path: '/network/dynamic-dns',
        name: 'DynamicDns',
        component: () => import('@/components/network/DynamicDns/DynamicDns.vue'),
        meta: { 
          title: 'routes.dynamic_dns',
          requiresAuth: true,
          icon: 'mdi:ip-network' 
        }
      }
    ]
  },
  {
    path: '/power',
    meta: { 
      title: 'routes.power_management',
      requiresAuth: true,
      icon: 'mdi:power-plug' 
    },
    children: [
      {
        path: '/power/schedule',
        name: 'PowerSchedule',
        component: () => import('@/components/power/Schedule.vue'),
        meta: { 
          title: 'routes.power_schedule',
          requiresAuth: true,
          icon: 'mdi:clock-outline' 
        }
      },
      {
        path: '/power/wake-on-lan',
        name: 'WakeOnLAN',
        component: () => import('@/components/power/WakeOnLAN.vue'),
        meta: { 
          title: 'routes.wake_on_lan',
          requiresAuth: true,
          icon: 'mdi:lan-connect' 
        }
      },
      {
        path: '/power/ups',
        name: 'UPSMonitoring',
        component: () => import('@/components/power/UPSMonitoring.vue'),
        meta: { 
          title: 'routes.ups_monitoring',
          requiresAuth: true,
          icon: 'mdi:car-battery' 
        }
      },
      {
        path: '/power/actions',
        name: 'PowerActions',
        component: () => import('@/components/power/PowerActions.vue'),
        meta: { 
          title: 'routes.power_actions',
          requiresAuth: true,
          icon: 'mdi:power' 
        }
      },
      {
        path: '/power/energy',
        name: 'EnergyMonitoring',
        component: () => import('@/components/power/EnergyMonitoring.vue'),
        meta: { 
          title: 'routes.energy_monitoring',
          requiresAuth: true,
          icon: 'mdi:lightning-bolt' 
        }
      }
    ]
  },
  {
    path: '/services',
    meta: { 
      title: 'routes.services',
      requiresAuth: true,
      icon: 'mdi:server-network' 
    },
    children: [
      {
        path: '/services/samba',
        component: () => import('@/components/services/Samba/SambaDash.vue'),
        meta: { 
          title: 'routes.samba',
          requiresAuth: true,
          icon: 'mdi:folder-network' 
        }
      },
      {
        path: '/services/docker',
        name: 'Docker',
        component: () => import('@/components/services/Docker/DockerStatus.vue'),
        meta: { 
          title: 'routes.docker',
          requiresAuth: true,
          icon: 'mdi:docker' 
        }
      },
      {
        path: '/services/ssh',
        name: 'SSH',
        component: () => import('@/components/services/Ssh/SshSettings.vue'),
        meta: { 
          title: 'routes.ssh',
          requiresAuth: true,
          icon: 'mdi:console-network' 
        }
      },
      {
        path: '/services/webdav',
        name: 'WebDAV',
        component: () => import('@/components/services/Webdav/Webdav.vue'),
        meta: { 
          title: 'routes.webdav',
          requiresAuth: true,
          icon: 'mdi:web' 
        }
      },
      {
        path: '/services/ftp-sftp',
        name: 'FTP-SFTP',
        component: () => import('@/components/services/FtpSftp/FtpSftp.vue'),
        meta: { 
          title: 'routes.ftp_sftp',
          requiresAuth: true,
          icon: 'mdi:folder-network' 
        }
      }
    ]
  },
  {
    path: '/storage',
    meta: { 
      title: 'routes.storage',
      requiresAuth: true,
      icon: 'mdi:database' 
    },
    children: [
      {
        path: '/storage/disks',
        name: 'Storage',
        component: () => import('@/components/storage/StorageDisks.vue'),
        meta: { 
          title: 'routes.storage_disks',
          requiresAuth: true,
          icon: 'mdi:harddisk' 
        }
      },
      {
        path: '/storage/filesystems',
        name: 'FileSystems',
        component: () => import('@/components/storage/StorageFilesystems.vue'),
        meta: { 
          title: 'routes.storage_filesystems',
          requiresAuth: true,
          icon: 'mdi:file-cabinet' 
        }
      },
      {
        path: '/storage/smart',
        meta: { 
          title: 'routes.smart',
          requiresAuth: true,
          icon: 'mdi:harddisk-plus' 
        },
        children: [
          {
            path: '/storage/smart/devices',
            name: 'SMARTDevices',
            component: () => import('@/components/storage/smart/StorageSmartDevices.vue'),
            meta: { 
              title: 'routes.smart_devices',
              requiresAuth: true,
              icon: 'mdi:harddisk-plus' 
            }
          },
          {
            path: '/storage/smart/devices/details/:device',
            name: 'StorageSmartDetails',
            component: () => import('@/components/storage/smart/Details.vue'),
            props: true,
            meta: {
              title: 'routes.smart_details',
              requiresAuth: true,
              hideInMenu: true
            }
          }
        ]
      }
    ]
  },
  {
    path: '/system',
    meta: { 
      title: 'routes.system',
      requiresAuth: true,
      icon: 'mdi:cog' 
    },
    children: [
      {
        path: '/system/users',
        name: 'Users',
        component: () => import('@/components/system/Users.vue'),
        meta: { 
          title: 'routes.users',
          requiresAuth: true,
          icon: 'mdi:account-group' 
        }
      },
      { 
        path: '/system/terminal', 
        name: 'Terminal',
        component: TerminalView,
        meta: { 
          title: 'routes.terminal',
          requiresAuth: true,
          icon: 'mdi:console' 
        } 
      },
      {
        path: '/system/updates',
        name: 'SystemUpdates',
        component: () => import('@/components/system/updates/Updates.vue'),
        meta: { 
          title: 'routes.system_updates',
          requiresAuth: true,
          icon: 'mdi:update' 
        }
      },
      {
        path: '/system/cron-jobs',
        name: 'CronJobs',
        component: () => import('@/components/system/Cron/CronJobs.vue'),
        meta: { 
          title: 'routes.cron_jobs',
          requiresAuth: true,
          icon: 'mdi:firework'
        }
      },
      {
        path: '/system/antivirus',
        name: 'Antivirus',
        component: () => import('@/components/system/Antivirus/Antivirus.vue'),
        meta: { 
          title: 'routes.antivirus',
          requiresAuth: true,
          icon: 'mdi:security'
        }
      },
      {
        path: '/system/backup',
        name: 'Backup',
        component: () => import('@/components/system/Backup/Backup.vue'),
        meta: { 
          title: 'routes.backup',
          requiresAuth: true,
          icon: 'mdi:backup-restore' 
        }
      },
      {
        path: '/system/settings',
        name: 'SystemSettings',
        component: () => import('@/components/system/Settings/Settings.vue'),
        meta: { 
          title: 'routes.system_settings',
          requiresAuth: true,
          icon: 'mdi:cog-outline' 
        }
      },
      {
        path: '/notifications',
        name: 'Notifications',
        component: NotificationsView,
        meta: { 
          title: 'routes.notifications',
          requiresAuth: true,
          icon: 'mdi:bell' 
        }
      }
    ]
  },
  {
    path: '/diagnostics',
    meta: { 
      title: 'routes.diagnostics',
      requiresAuth: true,
      icon: 'mdi:chart-box' 
    },
    children: [
      {
        path: '/diagnostics/processes',
        name: 'ProcessMonitor',
        component: () => import('@/components/diagnostics/Processes/ProcessMonitor.vue'),
        meta: { 
          title: 'routes.process_monitor',
          requiresAuth: true,
          icon: 'mdi:chart-box-outline' 
        }
      },
      {
        path: '/diagnostics/system-logs',
        meta: { 
          title: 'routes.system_logs',
          requiresAuth: true,
          icon: 'mdi:file-document-outline' 
        },
        children: [
          {
            path: '/diagnostics/system-logs/local',
            name: 'SystemLogs',
            component: () => import('@/components/diagnostics/system-logs/LocalLogs.vue'),
            meta: { 
              title: 'routes.local_logs',
              requiresAuth: true,
              icon: 'mdi:file-document-multiple-outline' 
            }
          },
          {
            path: '/diagnostics/system-logs/remote',
            name: 'RemoteLogs',
            component: () => import('@/components/diagnostics/system-logs/RemoteLogs.vue'),
            meta: { 
              title: 'routes.remote_logs',
              requiresAuth: true,
              icon: 'mdi:server-network' 
            }
          }
        ]
      }
    ]
  },
  {
    path: '/server/:type(restart|shutdown)',
    name: 'ServerStatus',
    component: () => import('@/components/system/ServerStatus.vue'),
    props: true,
    meta: { 
        title: 'routes.server_status',
	requiresAuth: false,
	hideInMenu: true,
	hideLayout: true
	  }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { isAuthenticated, checkAuth } = useAuth()
  
  // Używamy bezpośrednio zaimportowanego i18n
  if (i18n && i18n.global) {
    const t = i18n.global.t
    document.title = to.meta.title 
      ? `${t(to.meta.title)} | Nas-Panel` 
      : 'Nas-Panel'
  } else {
    // Fallback na wypadek braku i18n
    document.title = to.meta.title 
      ? `${to.meta.title} | NAS Panel` 
      : 'NAS Panel'
  }

  if (to.meta.requiresAuth) {
    const authenticated = await checkAuth()
    if (!authenticated) {
      return '/login'
    }
  }
})

export default router
