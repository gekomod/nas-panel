<template>
  <div class="users-dashboard">
    <!-- Compact Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:account-group" />
          </div>
          <div class="header-text">
            <h2>{{ $t('users.management') }}</h2>
            <p class="subtitle">{{ $t('users.subtitle') }}</p>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="header-stats">
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:account" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ users.length }}</div>
              <div class="stat-label">{{ $t('users.totalUsers') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:shield-account" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ adminUsersCount }}</div>
              <div class="stat-label">{{ $t('users.admins') }}</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:account-group" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ groupsCount }}</div>
              <div class="stat-label">{{ $t('users.groups') }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Quick Actions & Search -->
    <el-card class="combined-card" shadow="hover">
      <div class="combined-content">
        <div class="quick-actions">
          <el-button 
            type="primary" 
            size="small"
            @click="openAddUserDialog"
          >
            <Icon icon="mdi:account-plus" width="14" />
            {{ $t('users.addUser') }}
          </el-button>
          
          <el-button 
            type="info" 
            size="small"
            @click="fetchData(true)"
            :loading="loading"
          >
            <Icon icon="mdi:refresh" width="14" />
            {{ $t('common.refresh') }}
          </el-button>
        </div>

        <!-- Search & Filter -->
        <div class="search-section">
          <el-input
            v-model="searchQuery"
            :placeholder="$t('users.searchPlaceholder')"
            clearable
            size="small"
            class="search-input compact"
            @input="handleSearch"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" width="14" />
            </template>
          </el-input>
          
          <el-select 
            v-model="filterType" 
            :placeholder="$t('users.filterBy')" 
            clearable
            size="small"
            class="filter-select"
            @change="handleFilterChange"
          >
            <el-option :label="$t('users.all')" value="all" />
            <el-option :label="$t('users.admins')" value="admin" />
            <el-option :label="$t('users.regular')" value="regular" />
          </el-select>
          
          <el-select 
            v-model="selectedGroupFilter" 
            :placeholder="$t('users.filterByGroup')" 
            clearable
            size="small"
            class="filter-select"
            @change="handleGroupFilterChange"
          >
            <el-option
              v-for="group in availableGroups"
              :key="group.name"
              :label="group.name"
              :value="group.name"
            >
              <span>{{ group.name }}</span>
              <span style="margin-left: 8px; color: #8492a6; font-size: 11px">
                ({{ group.count }})
              </span>
            </el-option>
          </el-select>
        </div>
      </div>
    </el-card>

    <!-- Users List -->
    <el-card class="users-list-card" shadow="hover">
      <!-- Error Alert -->
      <el-alert 
        v-if="error" 
        :title="error" 
        type="error" 
        show-icon 
        closable 
        @close="error = ''"
        size="small"
        class="compact-alert"
      />

      <!-- Loading State -->
      <div v-if="loading && users.length === 0" class="loading-state">
        <el-icon :size="24" class="is-loading">
          <Icon icon="mdi:loading" />
        </el-icon>
        <span>{{ $t('users.loading') }}</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredUsers.length === 0 && !loading" class="empty-state compact">
        <Icon icon="mdi:account-off-outline" width="48" />
        <div class="empty-text">
          <h4>{{ $t('users.noUsers') }}</h4>
          <p>{{ $t('users.noUsersMessage') }}</p>
          <el-button type="primary" size="small" @click="openAddUserDialog">
            {{ $t('users.addUser') }}
          </el-button>
        </div>
      </div>

      <!-- Users List -->
      <div v-else class="users-list compact">
        <div 
          v-for="user in paginatedUsers" 
          :key="user.id"
          :class="['user-item', { 
            'is-root': user.username === 'root',
            'is-admin': user.isAdmin
          }]"
        >
          <div class="user-avatar">
            <div class="avatar-wrapper" :class="{ 'admin-badge': user.isAdmin }">
              <Icon 
                :icon="user.isAdmin ? 'mdi:shield-account' : 'mdi:account'" 
                width="20"
              />
            </div>
          </div>
          
          <div class="user-content">
            <div class="user-header">
              <div class="user-name">
                <span class="name-text">{{ user.username }}</span>
                <el-tag 
                  v-if="user.username === 'root'" 
                  size="mini" 
                  type="danger"
                  effect="dark"
                >
                  {{ $t('users.root') }}
                </el-tag>
                <el-tag 
                  v-else-if="user.isAdmin" 
                  size="mini" 
                  type="warning"
                  effect="plain"
                >
                  {{ $t('users.admin') }}
                </el-tag>
                <el-tag v-else size="mini" type="info" effect="plain">
                  {{ $t('users.user') }}
                </el-tag>
                <span class="user-id">UID: {{ user.id }}</span>
              </div>
              
              <div class="user-actions">
                <div class="action-buttons">
                  <el-button 
                    size="small" 
                    @click="openEditUserDialog(user)"
                    :disabled="user.username === 'root'"
                    class="mini-btn"
                  >
                    <Icon icon="mdi:pencil" width="12" />
                  </el-button>
                  
                  <el-button 
                    size="small" 
                    type="danger" 
                    @click="handleDelete(user)"
                    :disabled="user.username === 'root'"
                    class="mini-btn"
                  >
                    <Icon icon="mdi:delete" width="12" />
                  </el-button>
                </div>
              </div>
            </div>
            
            <div class="user-groups">
              <div class="groups-header">
                <Icon icon="mdi:account-group" width="12" />
                <span class="groups-label">{{ $t('users.groups') }}:</span>
              </div>
              <div class="groups-tags">
                <template v-for="group in user.groups" :key="group">
                  <el-tag 
                    v-if="group === user.username" 
                    size="mini" 
                    class="group-tag primary"
                  >
                    {{ group }}
                  </el-tag>
                  <el-tag 
                    v-else-if="group === 'root'" 
                    size="mini" 
                    type="danger"
                    class="group-tag"
                  >
                    {{ group }}
                  </el-tag>
                  <el-tag 
                    v-else 
                    size="mini" 
                    type="info"
                    class="group-tag"
                  >
                    {{ group }}
                  </el-tag>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && filteredUsers.length > 0" class="pagination compact">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredUsers.length"
          :page-sizes="[10, 20, 30]"
          layout="total, sizes, prev, pager, next"
          size="small"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- Add User Dialog -->
    <el-dialog 
      v-model="showAddUserDialog" 
      :title="$t('users.addUserDialog.title')"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="newUserForm" label-width="140px" size="small">
        <el-form-item :label="$t('users.username')" required>
          <el-input v-model="newUserForm.username" />
        </el-form-item>
        <el-form-item :label="$t('users.password')" required>
          <el-input 
            v-model="newUserForm.password" 
            type="password" 
            show-password 
          />
        </el-form-item>
        <el-form-item :label="$t('users.isAdmin')">
          <el-switch v-model="newUserForm.isAdmin" />
          <div class="form-hint">
            <Icon icon="mdi:information-outline" width="12" />
            {{ $t('users.addUserDialog.adminNote') }}
          </div>
        </el-form-item>
        <el-form-item :label="$t('users.additionalGroups')">
          <el-select 
            v-model="newUserForm.selectedGroups" 
            multiple
            filterable
            style="width: 100%"
            :placeholder="$t('users.selectGroups')"
          >
            <el-option
              v-for="group in systemGroups.filter(g => g.name !== 'root')"
              :key="group.name"
              :label="group.name"
              :value="group.name"
            >
              <span style="float: left">{{ group.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px">
                GID: {{ group.gid }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false" size="small">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="addUser"
          :disabled="!newUserForm.username || !newUserForm.password"
          size="small"
        >
          {{ $t('users.addUser') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Edit User Dialog -->
    <el-dialog 
      v-model="showEditUserDialog" 
      :title="$t('users.editUserDialog.title')"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="editUserForm" label-width="140px" size="small">
        <el-form-item :label="$t('users.username')">
          <el-input v-model="editUserForm.username" disabled />
        </el-form-item>
        <el-form-item :label="$t('users.newPassword')">
          <el-input 
            v-model="editUserForm.password" 
            type="password" 
            show-password 
            :placeholder="$t('users.passwordPlaceholder')"
          />
          <div class="form-hint">
            <Icon icon="mdi:information-outline" width="12" />
            {{ $t('users.editUserDialog.passwordNote') }}
          </div>
        </el-form-item>
        <el-form-item :label="$t('users.isAdmin')">
          <el-switch v-model="editUserForm.isAdmin" />
          <div class="form-hint">
            <Icon icon="mdi:information-outline" width="12" />
            {{ $t('users.editUserDialog.adminNote') }}
          </div>
        </el-form-item>
        <el-form-item :label="$t('users.additionalGroups')">
          <el-select 
            v-model="editUserForm.selectedGroups" 
            multiple
            filterable
            style="width: 100%"
            :placeholder="$t('users.selectGroups')"
          >
            <el-option
              v-for="group in systemGroups.filter(g => g.name !== 'root')"
              :key="group.name"
              :label="group.name"
              :value="group.name"
            >
              <span style="float: left">{{ group.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px">
                GID: {{ group.gid }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditUserDialog = false" size="small">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="updateUser"
          size="small"
        >
          {{ $t('common.saveChanges') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// API configuration
const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || 3001}`,
  timeout: 30000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
})

// Reactive state
const users = ref([])
const systemGroups = ref([])
const loading = ref(false)
const error = ref('')

// UI State
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const filterType = ref('all')
const selectedGroupFilter = ref('')

// Dialogs
const showAddUserDialog = ref(false)
const showEditUserDialog = ref(false)
const currentUser = ref(null)

// Forms
const newUserForm = ref({
  username: '',
  password: '',
  isAdmin: false,
  selectedGroups: []
})

const editUserForm = ref({
  username: '',
  password: '',
  isAdmin: false,
  selectedGroups: []
})

// Computed properties
const adminUsersCount = computed(() => {
  return users.value.filter(user => user.isAdmin).length
})

const groupsCount = computed(() => {
  const allGroups = new Set()
  users.value.forEach(user => {
    user.groups.forEach(group => allGroups.add(group))
  })
  return allGroups.size
})

const availableGroups = computed(() => {
  const groups = {}
  
  users.value.forEach(user => {
    user.groups.forEach(group => {
      if (group !== user.username) {
        if (!groups[group]) {
          groups[group] = { name: group, count: 0 }
        }
        groups[group].count++
      }
    })
  })
  
  return Object.values(groups).sort((a, b) => b.count - a.count)
})

const filteredUsers = computed(() => {
  let result = [...users.value]
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.id.toString().includes(query) ||
      user.groups.some(group => group.toLowerCase().includes(query))
    )
  }
  
  // Apply type filter
  if (filterType.value === 'admin') {
    result = result.filter(user => user.isAdmin)
  } else if (filterType.value === 'regular') {
    result = result.filter(user => !user.isAdmin)
  }
  
  // Apply group filter
  if (selectedGroupFilter.value) {
    result = result.filter(user => 
      user.groups.includes(selectedGroupFilter.value)
    )
  }
  
  return result
})

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredUsers.value.slice(start, end)
})

// Methods
const fetchData = async (showLoading = false) => {
  try {
    if (showLoading) loading.value = true
    error.value = ''
    
    const [usersResponse, groupsResponse] = await Promise.all([
      api.get('/api/system/users'),
      api.get('/api/system/groups')
    ])
    
    users.value = usersResponse.data.map(user => ({
      ...user,
      isAdmin: user.groups.includes('root')
    }))
    
    systemGroups.value = groupsResponse.data
  } catch (err) {
    error.value = t('users.errors.fetchData', { 
      error: err.response?.data?.message || err.message 
    })
    console.error('Error fetching data:', err)
  } finally {
    loading.value = false
  }
}

const openAddUserDialog = () => {
  newUserForm.value = {
    username: '',
    password: '',
    isAdmin: false,
    selectedGroups: []
  }
  showAddUserDialog.value = true
}

const openEditUserDialog = (user) => {
  currentUser.value = user
  editUserForm.value = {
    username: user.username,
    password: '',
    isAdmin: user.isAdmin,
    selectedGroups: user.groups.filter(g => g !== user.username && g !== 'root')
  }
  showEditUserDialog.value = true
}

const handleDelete = async (user) => {
  try {
    await ElMessageBox.confirm(
      t('users.deleteConfirm', { username: user.username }),
      t('common.confirmation'),
      {
        confirmButtonText: t('common.yes'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    await api.delete(`/api/system/users/${user.username}`)
    ElMessage.success(t('users.deleteSuccess'))
    await fetchData()
  } catch (err) {
    if (err !== 'cancel') {
      error.value = t('users.errors.delete', { 
        error: err.response?.data?.message || err.message 
      })
    }
  }
}

const addUser = async () => {
  try {
    const payload = {
      username: newUserForm.value.username,
      password: newUserForm.value.password,
      isAdmin: newUserForm.value.isAdmin,
      groups: newUserForm.value.selectedGroups
    }

    await api.post('/api/system/users', payload)
    ElMessage.success(t('users.addSuccess'))
    showAddUserDialog.value = false
    await fetchData()
  } catch (err) {
    error.value = t('users.errors.add', { 
      error: err.response?.data?.message || err.message 
    })
  }
}

const updateUser = async () => {
  try {
    const payload = {}
    
    if (editUserForm.value.password) {
      payload.password = editUserForm.value.password
    }
    
    if (editUserForm.value.isAdmin !== currentUser.value.isAdmin) {
      payload.isAdmin = editUserForm.value.isAdmin
    }
    
    if (editUserForm.value.selectedGroups) {
      payload.groups = editUserForm.value.selectedGroups
    }

    await api.put(`/api/system/users/${currentUser.value.username}`, payload)
    ElMessage.success(t('users.updateSuccess'))
    showEditUserDialog.value = false
    await fetchData()
  } catch (err) {
    error.value = t('users.errors.update', { 
      error: err.response?.data?.message || err.message 
    })
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleFilterChange = () => {
  currentPage.value = 1
}

const handleGroupFilterChange = () => {
  currentPage.value = 1
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

// Lifecycle hooks
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.users-dashboard {
  padding: 16px;
  min-height: 100vh;
  background: #f5f7fa;
}

:root[data-theme="dark"] .users-dashboard {
  background: #1a202c;
}

/* Compact Header */
.dashboard-header.compact {
  border-radius: 12px;
  margin-bottom: 16px;
}

.dashboard-header.compact .header-content {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.header-icon.small {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 10px;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
  min-width: 0;
}

.header-text h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[data-theme="dark"] .header-text h2 {
  color: #e4e7ed;
}

.header-text .subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
}

:root[data-theme="dark"] .header-text .subtitle {
  color: #a0aec0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 0 20px;
  flex: 1;
  justify-content: center;
}

.stat-item.small {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.stat-item.small .stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
  color: #409eff;
}

:root[data-theme="dark"] .stat-item.small .stat-icon {
  background: #2d3748;
}

.stat-item.small .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

:root[data-theme="dark"] .stat-item.small .stat-value {
  color: #e4e7ed;
}

.stat-item.small .stat-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

:root[data-theme="dark"] .stat-item.small .stat-label {
  color: #a0aec0;
}

/* Combined Card */
.combined-card {
  border-radius: 12px;
  margin-bottom: 16px;
}

.combined-content {
  padding: 16px;
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.search-section {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input.compact {
  width: 200px;
}

.filter-select {
  width: 140px;
}

/* Users List Card */
.users-list-card {
  border-radius: 12px;
}

/* Compact Alert */
.compact-alert {
  margin: 16px;
  border-radius: 6px;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
  font-size: 14px;
  gap: 8px;
}

:root[data-theme="dark"] .loading-state {
  color: #a0aec0;
}

/* Empty State */
.empty-state.compact {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 16px;
  text-align: left;
}

.empty-text h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

:root[data-theme="dark"] .empty-text h4 {
  color: #e4e7ed;
}

.empty-text p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}

:root[data-theme="dark"] .empty-text p {
  color: #a0aec0;
}

/* Users List */
.users-list.compact {
  padding: 0;
}

.user-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  transition: background-color 0.2s;
}

:root[data-theme="dark"] .user-item {
  border-bottom-color: #2d3748;
}

.user-item:hover {
  background-color: #fafafa;
}

:root[data-theme="dark"] .user-item:hover {
  background-color: #2d3748;
}

.user-item.is-root {
  background-color: rgba(245, 108, 108, 0.03);
}

.user-item.is-admin {
  background-color: rgba(255, 193, 7, 0.03);
}

.user-avatar {
  margin-top: 2px;
  flex-shrink: 0;
}

.avatar-wrapper {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff 0%, #1d4ed8 100%);
  border-radius: 10px;
  color: white;
}

.avatar-wrapper.admin-badge {
  background: linear-gradient(135deg, #e6a23c 0%, #d48806 100%);
}

.user-content {
  flex: 1;
  min-width: 0;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.user-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.name-text {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

:root[data-theme="dark"] .name-text {
  color: #e4e7ed;
}

.user-id {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.mini-btn {
  padding: 4px;
  min-width: auto;
}

/* Groups Section */
.user-groups {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 8px;
}

:root[data-theme="dark"] .user-groups {
  background: #2d3748;
}

.groups-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.groups-label {
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.groups-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.group-tag {
  margin: 0;
}

.group-tag.primary {
  background-color: rgba(64, 158, 255, 0.1);
  color: #409eff;
  border-color: rgba(64, 158, 255, 0.2);
}

:root[data-theme="dark"] .group-tag.primary {
  background-color: rgba(66, 153, 225, 0.2);
  color: #63b3ed;
  border-color: rgba(66, 153, 225, 0.3);
}

/* Form hints */
.form-hint {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Pagination */
.pagination.compact {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
}

:root[data-theme="dark"] .pagination.compact {
  border-top-color: #4a5568;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-left {
    min-width: auto;
  }
  
  .header-stats {
    order: 2;
    justify-content: space-around;
    gap: 12px;
  }
  
  .stat-item.small {
    flex-direction: column;
    text-align: center;
    gap: 4px;
  }
  
  .stat-item.small .stat-icon {
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 768px) {
  .users-dashboard {
    padding: 12px;
  }
  
  .header-stats {
    flex-wrap: wrap;
  }
  
  .stat-item.small {
    flex: 0 0 calc(50% - 8px);
    margin-bottom: 8px;
  }
  
  .search-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input.compact {
    width: 100%;
  }
  
  .filter-select {
    width: 100%;
  }
  
  .user-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .user-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .stat-item.small {
    flex: 0 0 100%;
    margin-bottom: 8px;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .user-name {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .empty-state.compact {
    flex-direction: column;
    text-align: center;
  }
}
</style>
