import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { ElNotification } from 'element-plus'
import './assets/main.css'
import { initDatabase } from './database/sqlite-service'
import { i18n } from './locales'


async function initializeApp() {
  try {
    await initDatabase();

    const app = createApp(App)
    
    app.use(router)
    app.use(ElementPlus)
    app.use(i18n)
    app.mount('#app')
    
      app.config.globalProperties.$notify({
        title: 'Warning',
        message: 'Running in limited mode',
        type: 'warning',
        duration: 5000
      })
  } catch (error) {
    console.error('App initialization failed:', error)
    document.getElementById('app').innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Application Error</h2>
        <p>${error.message}</p>
        <p>Please refresh the page.</p>
      </div>
    `
  }
}

initializeApp()
