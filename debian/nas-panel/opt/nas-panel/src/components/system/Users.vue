<template>
  <div class="users-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>Zarządzanie użytkownikami</span>
          <el-button type="primary" @click="showAddUserDialog = true">
            Dodaj użytkownika
          </el-button>
        </div>
      </template>

      <el-table :data="users" border style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="Nazwa użytkownika" />
        <el-table-column prop="email" label="Email" />
        <el-table-column prop="role" label="Rola" />
        <el-table-column label="Akcje" width="180">
          <template #default="scope">
            <el-button size="small" @click="handleEdit(scope.row)">Edytuj</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">Usuń</el-button>
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

    <!-- Dialog dodawania/edycji użytkownika -->
    <el-dialog v-model="showAddUserDialog" :title="editMode ? 'Edytuj użytkownika' : 'Dodaj użytkownika'">
      <el-form :model="userForm" label-width="120px">
        <el-form-item label="Nazwa użytkownika">
          <el-input v-model="userForm.username" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="userForm.email" />
        </el-form-item>
        <el-form-item label="Hasło" v-if="!editMode">
          <el-input v-model="userForm.password" type="password" />
        </el-form-item>
        <el-form-item label="Rola">
          <el-select v-model="userForm.role" placeholder="Wybierz rolę">
            <el-option label="Administrator" value="admin" />
            <el-option label="Użytkownik" value="user" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddUserDialog = false">Anuluj</el-button>
        <el-button type="primary" @click="submitUserForm">Zapisz</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const users = ref([
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin' },
  { id: 2, username: 'user1', email: 'user1@example.com', role: 'user' },
  { id: 3, username: 'user2', email: 'user2@example.com', role: 'user' }
])

const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 3
})

const showAddUserDialog = ref(false)
const editMode = ref(false)
const currentUserId = ref(null)

const userForm = ref({
  username: '',
  email: '',
  password: '',
  role: 'user'
})

const handleEdit = (user) => {
  editMode.value = true
  currentUserId.value = user.id
  userForm.value = {
    username: user.username,
    email: user.email,
    role: user.role
  }
  showAddUserDialog.value = true
}

const handleDelete = (user) => {
  ElMessageBox.confirm(`Czy na pewno chcesz usunąć użytkownika ${user.username}?`, 'Potwierdzenie', {
    confirmButtonText: 'Tak',
    cancelButtonText: 'Anuluj',
    type: 'warning'
  }).then(() => {
    users.value = users.value.filter(u => u.id !== user.id)
    ElMessage.success('Użytkownik został usunięty')
  })
}

const submitUserForm = () => {
  if (editMode.value) {
    // Aktualizacja istniejącego użytkownika
    const index = users.value.findIndex(u => u.id === currentUserId.value)
    users.value[index] = {
      ...users.value[index],
      ...userForm.value
    }
    ElMessage.success('Użytkownik został zaktualizowany')
  } else {
    // Dodanie nowego użytkownika
    const newUser = {
      id: users.value.length + 1,
      ...userForm.value
    }
    users.value.push(newUser)
    ElMessage.success('Użytkownik został dodany')
  }
  showAddUserDialog.value = false
  resetUserForm()
}

const resetUserForm = () => {
  userForm.value = {
    username: '',
    email: '',
    password: '',
    role: 'user'
  }
  editMode.value = false
  currentUserId.value = null
}

const handlePageChange = (page) => {
  pagination.value.currentPage = page
  // Tutaj możesz dodać logikę pobierania danych dla nowej strony
}
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
</style>
