<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2>Logowanie do systemu</h2>
      </template>
      
      <el-form @submit.prevent="handleLogin">
        <el-form-item label="Nazwa użytkownika">
          <el-input 
            v-model="username" 
            placeholder="Podaj login systemowy"
          />
        </el-form-item>
        
        <el-form-item label="Hasło">
          <el-input 
            v-model="password" 
            type="password" 
            placeholder="Podaj hasło"
            show-password
          />
        </el-form-item>
        
        <el-button 
          type="primary" 
          native-type="submit" 
          :loading="loading"
        >
          Zaloguj
        </el-button>
        
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          class="error-alert"
        />
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/services/AuthService'

const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  const result = await login(username.value, password.value)
  
  if (result.success) {
    router.push('/')
  } else {
    error.value = result.error || 'Logowanie nie powiodło się'
  }
  
  loading.value = false
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
}

.login-card {
  width: 400px;
}

.error-alert {
  margin-top: 20px;
}
</style>
