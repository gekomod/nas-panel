<template>
  <div class="login-container">
    <div class="login-background">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <!-- Kontener dla alertu i karty -->
    <div class="login-card-wrapper" :class="{'has-error': error}">
      <transition name="slide-down">
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
          class="floating-alert"
        />
      </transition>

      <div class="login-card">
      
      <div class="language-switcher">
        <el-tooltip effect="dark" :content="$t('language.change')" placement="left">
          <el-dropdown trigger="click" @command="changeLanguage">
            <el-button circle class="lang-btn">
              <Icon :icon="currentLanguage.icon" width="20" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item 
                  v-for="lang in availableLanguages" 
                  :key="lang.code"
                  :command="lang.code"
                  :class="{ 'active': currentLanguage.code === lang.code }"
                >
                  <Icon :icon="lang.icon" width="18" />
                  <span>{{ lang.name }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
          <el-tooltip effect="dark" :content="darkMode ? $t('theme.light') : $t('theme.dark')" placement="left">
    <el-button circle class="theme-btn" @click="toggleDarkMode">
      <Icon :icon="darkMode ? 'mdi:weather-sunny' : 'mdi:weather-night'" width="20" />
    </el-button>
  </el-tooltip>
      </div>
      
        <div class="brand-logo">
          <div class="logo-container">
            <svg class="logo-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="url(#paint0_linear)"/>
              <rect x="21" y="12" width="6" height="6" rx="1" fill="white"/>
              <rect x="30" y="21" width="6" height="6" rx="1" fill="white"/>
              <rect x="21" y="30" width="6" height="6" rx="1" fill="white"/>
              <rect x="12" y="21" width="6" height="6" rx="1" fill="white"/>
              <defs>
                <linearGradient id="paint0_linear" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6A11CB"/>
                  <stop offset="0.5" stop-color="#2575FC"/>
                  <stop offset="1" stop-color="#11998E"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="logo-text-container">
              <span class="logo-text">NAS-PANEL</span>
              <span class="logo-subtext">Control Center</span>
            </div>
          </div>
        </div>
        
        <h2 class="login-title">{{ $t('login.title') }}</h2>
        <p class="login-subtitle">{{ $t('login.welcome') }}</p>
        
    <el-form @submit.prevent="handleLogin" class="login-form">
      <el-form-item>
        <el-input
          v-model="username"
          :placeholder="$t('login.usernamePlaceholder')"
          size="large"
        >
          <template #prefix>
            <Icon icon="mdi:account-outline" width="20" />
          </template>
        </el-input>
      </el-form-item>
      
      <el-form-item>
        <el-input
          v-model="password"
          type="password"
          :placeholder="$t('login.passwordPlaceholder')"
          size="large"
          show-password
        >
          <template #prefix>
            <Icon icon="mdi:lock-outline" width="20" />
          </template>
        </el-input>
      </el-form-item>
          
          <div class="login-actions">
            <el-checkbox v-model="rememberMe" :label="$t('login.rememberMe')" />
            <router-link to="/forgot-password" class="forgot-password">
              {{ $t('login.forgotPassword') }}
            </router-link>
          </div>
          
          <el-button
            type="primary"
            native-type="submit"
            :loading="loading"
            size="large"
            class="login-button"
          >
            {{ $t('login.submit') }}
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/services/AuthService'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const error = ref('')

const availableLanguages = [
  { code: 'pl', name: 'Polski', icon: 'emojione-v1:flag-for-poland' },
  { code: 'en', name: 'English', icon: 'emojione-v1:flag-for-united-kingdom' },
  { code: 'de', name: 'Deutsch', icon: 'emojione-v1:flag-for-germany' }
]

const currentLanguage = computed(() => 
  availableLanguages.find(lang => lang.code === locale.value) || availableLanguages[0]
)

const changeLanguage = (langCode) => {
  locale.value = langCode
  localStorage.setItem('userLanguage', langCode)
}

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const result = await login(username.value, password.value)
    if (result.success) {
      router.push('/')
    } else {
      error.value = result.error || t('login.error')
    }
  } catch (err) {
    error.value = t('login.error')
  } finally {
    loading.value = false
  }
}

const darkMode = ref(false)

// Sprawdź zapisane preferencje przy załadowaniu
onMounted(() => {
  const savedMode = localStorage.getItem('darkMode')
  if (savedMode) {
    darkMode.value = savedMode === 'true'
    updateDarkMode()
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    darkMode.value = true
    updateDarkMode()
  }
})

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  localStorage.setItem('darkMode', darkMode.value)
  updateDarkMode()
}

const updateDarkMode = () => {
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.login-background {
  position: absolute;
  width: 100%;
  height: 100%;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
}

.shape-1 {
  width: 300px;
  height: 300px;
  top: -50px;
  left: -50px;
  background: linear-gradient(45deg, #6a11cb 0%, #2575fc 100%);
  opacity: 0.8;
}

.shape-2 {
  width: 200px;
  height: 200px;
  bottom: -30px;
  right: -30px;
  background: linear-gradient(45deg, #11998e 0%, #38ef7d 100%);
  opacity: 0.8;
}

.login-card-wrapper {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}

.has-error .login-card {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.login-card {
  width: 100%;
  padding: 40px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  z-index: 1;
  animation: fadeIn 0.6s ease-out;
}

.floating-alert {
  width: 100%;
  border-radius: 12px 12px 0 0 !important;
  margin-bottom: 0 !important;
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 2;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: none !important;
}

.brand-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.logo-container:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 4px 8px rgba(106, 17, 203, 0.15));
}

.logo-icon {
  width: 44px;
  height: 44px;
  transition: all 0.3s ease;
}

.logo-text-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.logo-text {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(90deg, #6a11cb 0%, #2575fc 50%, #11998e 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.8px;
  line-height: 1;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.logo-subtext {
  font-size: 10px;
  color: #7f8c8d;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  margin-top: 3px;
  font-weight: 500;
}

.login-title {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2c3e50;
}

.login-subtitle {
  text-align: center;
  color: #7f8c8d;
  margin-bottom: 32px;
  font-size: 14px;
}

.login-form {
  margin-top: 24px;
}

.login-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.forgot-password {
  font-size: 13px;
  color: #7f8c8d;
  text-decoration: none;
  transition: color 0.3s;
}

.forgot-password:hover {
  color: #409eff;
}

.login-button {
  width: 100%;
  margin-bottom: 20px;
  font-weight: 500;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-down-enter-active {
  animation: slideIn 0.3s ease-out;
}
.slide-down-leave-active {
  animation: slideOut 0.3s ease-in;
}

:deep(.el-input__prefix) {
  display: flex;
  align-items: center;
  padding-right: 8px;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-20px);
    opacity: 0;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
    margin: 20px;
  }
  
  .logo-container {
    flex-direction: column;
    gap: 8px;
  }
  
  .logo-text-container {
    align-items: center;
    text-align: center;
  }
  
  .logo-text {
    font-size: 20px;
  }

  .floating-alert {
    top: -40px;
  }
}


.language-switcher {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;

  display: flex;
  gap: 8px;

}

.lang-btn {
  padding: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
}

.lang-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

:deep(.el-dropdown-menu__item.active) {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* Animacja przełączania */
:deep(.el-dropdown-menu) {
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


:root.dark {
  --el-color-primary: #409EFF;
  --el-bg-color: #1a1a1a;
  --el-text-color-primary: #e5e5e5;
  --el-text-color-regular: #d0d0d0;
  --el-border-color-light: #333;
  --el-fill-color-light: #2a2a2a;
}

:root.dark .login-container {
  background: linear-gradient(135deg, #121212 0%, #1e1e1e 100%);
}

:root.dark .login-card {
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

:root.dark .logo-subtext {
  color: #a0a0a0;
}

:root.dark .login-title {
  color: #f0f0f0;
}

:root.dark .login-subtitle {
  color: #a0a0a0;
}

:root.dark .forgot-password {
  color: #a0a0a0;
}

:root.dark .forgot-password:hover {
  color: var(--el-color-primary);
}

:root.dark .shape-1 {
  opacity: 0.5;
}

:root.dark .shape-2 {
  opacity: 0.5;
}

:root.dark .lang-btn,
:root.dark .theme-btn {
  background: rgba(30, 30, 30, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:root.dark .lang-btn:hover,
:root.dark .theme-btn:hover {
  background: rgba(60, 60, 60, 0.5);
}

/* Style dla przycisku theme */
.theme-btn {
  padding: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
  margin-left: 8px;
}

.theme-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

</style>


