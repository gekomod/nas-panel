<template>
  <div class="users-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('users.management') }}</span>
          <el-button type="primary" @click="openAddUserDialog">
            {{ $t('users.addUser') }}
          </el-button>
        </div>
      </template>

      <el-table :data="users" border style="width: 100%" v-loading="loading">
        <el-table-column prop="username" :label="$t('users.username')" />
        <el-table-column prop="id" label="UID" width="100" />
        <el-table-column :label="$t('users.isAdmin')" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.isAdmin ? 'danger' : 'info'">
              {{ scope.row.isAdmin ? $t('common.yes') : $t('common.no') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('users.groups')" min-width="200">
          <template #default="scope">
            <div class="groups-container">
              <template v-for="group in scope.row.groups" :key="group">
                <el-tag v-if="group === scope.row.username" class="group-tag">
                  {{ group }}
                </el-tag>
                <el-tag v-else-if="group === 'root'" type="danger" class="group-tag">
                  {{ group }}
                </el-tag>
                <el-tag v-else type="info" class="group-tag">
                  {{ group }}
                </el-tag>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.actions')" width="180">
          <template #default="scope">
            <el-button size="small" @click="openEditUserDialog(scope.row)">
              {{ $t('common.edit') }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="handleDelete(scope.row)"
              :disabled="scope.row.username === 'root'"
            >
              {{ $t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- Dialog dodawania użytkownika -->
    <el-dialog 
      v-model="showAddUserDialog" 
      :title="$t('users.addUserDialog.title')"
      width="600px"
    >
      <el-form :model="newUserForm" label-width="160px">
        <el-form-item :label="$t('users.username')" required>
          <el-input v-model="newUserForm.username" />
        </el-form-item>
        <el-form-item :label="$t('users.password')" required>
          <el-input v-model="newUserForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item :label="$t('users.isAdmin')">
          <el-switch v-model="newUserForm.isAdmin" />
          <el-text type="info" v-if="newUserForm.isAdmin">
            {{ $t('users.addUserDialog.adminNote') }}
          </el-text>
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
              <span style="float: right; color: #8492a6; font-size: 13px">
                (GID: {{ group.gid }})
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button 
          type="primary" 
          @click="addUser"
          :disabled="!newUserForm.username || !newUserForm.password"
        >
          {{ $t('users.addUser') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog edycji użytkownika -->
    <el-dialog 
      v-model="showEditUserDialog" 
      :title="$t('users.editUserDialog.title')"
      width="600px"
    >
      <el-form :model="editUserForm" label-width="160px">
        <el-form-item :label="$t('users.username')">
          <el-input v-model="editUserForm.username" disabled />
        </el-form-item>
        <el-form-item :label="$t('users.newPassword')">
          <el-input v-model="editUserForm.password" type="password" show-password />
          <el-text type="info">{{ $t('users.editUserDialog.passwordNote') }}</el-text>
        </el-form-item>
        <el-form-item :label="$t('users.isAdmin')">
          <el-switch v-model="editUserForm.isAdmin" />
          <el-text type="info" v-if="editUserForm.isAdmin">
            {{ $t('users.editUserDialog.adminNote') }}
          </el-text>
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
              <span style="float: right; color: #8492a6; font-size: 13px">
                (GID: {{ group.gid }})
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditUserDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="updateUser">
          {{ $t('common.saveChanges') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const users = ref([])
const systemGroups = ref([])
const loading = ref(false)

const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const showAddUserDialog = ref(false)
const showEditUserDialog = ref(false)
const currentUser = ref(null)

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

// Pobierz użytkowników i grupy systemowe
const fetchData = async () => {
  try {
    loading.value = true
    const [usersResponse, groupsResponse] = await Promise.all([
      axios.get('/api/system/users'),
      axios.get('/api/system/groups')
    ])
    
    users.value = usersResponse.data.map(user => ({
      ...user,
      isAdmin: user.groups.includes('root')
    }))
    
    systemGroups.value = groupsResponse.data
    pagination.value.total = users.value.length
  } catch (error) {
    console.error('Błąd pobierania danych:', error)
    ElMessage.error(t('users.errors.fetchData'))
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
    isAdmin: user.groups.includes('root'),
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
        type: 'warning'
      }
    )
    
    await axios.delete(`/api/system/users/${user.username}`)
    ElMessage.success(t('users.deleteSuccess'))
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Błąd usuwania użytkownika:', error)
      ElMessage.error(t('users.errors.delete'))
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

    await axios.post('/api/system/users', payload)
    ElMessage.success(t('users.addSuccess'))
    showAddUserDialog.value = false
    fetchData()
  } catch (error) {
    console.error('Błąd dodawania użytkownika:', error)
    ElMessage.error(error.response?.data?.error || t('users.errors.add'))
  }
}

const updateUser = async () => {
  try {
    const payload = {
      password: editUserForm.value.password || undefined,
      isAdmin: editUserForm.value.isAdmin,
      groups: editUserForm.value.selectedGroups
    }

    await axios.put(`/api/system/users/${currentUser.value.username}`, payload)
    ElMessage.success(t('users.updateSuccess'))
    showEditUserDialog.value = false
    fetchData()
  } catch (error) {
    console.error('Błąd aktualizacji użytkownika:', error)
    ElMessage.error(error.response?.data?.error || t('users.errors.update'))
  }
}

const handlePageChange = (page) => {
  pagination.value.currentPage = page
}

// Pobierz dane przy załadowaniu komponentu
onMounted(fetchData)
</script>

<style scoped>
.users-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}

.groups-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.group-tag {
  margin-right: 5px;
  margin-bottom: 5px;
}
</style>
