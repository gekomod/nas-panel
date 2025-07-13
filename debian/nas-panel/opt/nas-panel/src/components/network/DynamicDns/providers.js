export default [
  {
    id: 'noip',
    name: 'No-IP',
    icon: 'mdi:ip-network-outline',
    fields: [
      { name: 'hostname', label: 'dynamicDns.hostname', type: 'text', required: true },
      { name: 'username', label: 'dynamicDns.username', type: 'text', required: true },
      { name: 'password', label: 'dynamicDns.password', type: 'password', required: true }
    ]
  },
  {
    id: 'dyndns',
    name: 'DynDNS',
    icon: 'mdi:ip',
    fields: [
      { name: 'hostname', label: 'dynamicDns.hostname', type: 'text', required: true },
      { name: 'username', label: 'dynamicDns.username', type: 'text', required: true },
      { name: 'password', label: 'dynamicDns.password', type: 'password', required: true }
    ]
  },
  {
    id: 'duckdns',
    name: 'DuckDNS',
    icon: 'mdi:duck',
    fields: [
      { name: 'hostname', label: 'dynamicDns.hostname', type: 'text', required: true },
      { name: 'token', label: 'dynamicDns.token', type: 'password', required: true }
    ]
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: 'mdi:cloud',
    fields: [
      { name: 'zone_id', label: 'dynamicDns.zoneId', type: 'text', required: true },
      { name: 'record_id', label: 'dynamicDns.recordId', type: 'text', required: true },
      { name: 'api_key', label: 'dynamicDns.apiKey', type: 'password', required: true },
      { name: 'email', label: 'dynamicDns.email', type: 'email', required: true }
    ]
  }
]
