import logger from './utils/logger'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { ElNotification } from 'element-plus'
import './assets/main.scss'
import { initDatabase } from './database/sqlite-service'
import { i18n } from './locales'
import lodash from 'lodash'
import { NotificationPlugin } from './services/NotificationService'

const env = {
  NODE_ENV: import.meta.env.MODE || 'development',
  VUE_APP_VERSION: import.meta.env.VUE_APP_VERSION || 'unknown'
}

async function profilePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  logger.debug(`[Perf] Starting: ${name}`)
  
  try {
    const result = await fn()
    const end = performance.now()
    logger.debug(`[Perf] Completed: ${name} in ${(end - start).toFixed(2)}ms`)
    return result
  } catch (error) {
    const end = performance.now()
    logger.error(`[Perf] Failed: ${name} after ${(end - start).toFixed(2)}ms`, { 
      error: error instanceof Error ? error.message : String(error),
      duration: `${(end - start).toFixed(2)}ms` 
    })
    throw error
  }
}

function showError(error: unknown, context?: Record<string, unknown>) {
  // Ulepszona obsługa błędów null/undefined
  if (error === null || error === undefined) {
    logger.error('Received null/undefined error', { context })
    return
  }

  const errorObj = error instanceof Error ? error : new Error(String(error))
  const errorMessage = errorObj.message || 'Unknown error'

  logger.error('Application Error', { 
    message: errorMessage,
    stack: errorObj.stack,
    ...context 
  })
  
  if (typeof ElNotification !== 'undefined') {
    ElNotification.error({
      title: 'Application Error',
      message: errorMessage,
      duration: 5000,
      showClose: true,
      position: 'bottom-right'
    })
  }
  
  const appElement = document.getElementById('app')
  if (appElement && !appElement.innerHTML.includes('Application Error') && errorMessage !== 'Unknown error') {
    appElement.innerHTML = `
      <div style="
        padding: 20px; 
        color: #fff;
        background-color: #f56c6c;
        border-radius: 4px;
        margin: 20px;
        font-family: sans-serif;
      ">
        <h2 style="margin-top: 0;">Application Error</h2>
        <p><strong>Message:</strong> ${errorMessage}</p>
        ${errorObj.stack ? 
          `<pre style="overflow: auto; background: rgba(0,0,0,0.1); padding: 10px; border-radius: 3px;">${errorObj.stack}</pre>` : ''}
        <p>Please refresh the page or contact support if the problem persists.</p>
      </div>
    `
  }
}

async function initializeApp() {
  try {
    logger.info('Starting application initialization', { env })
    
    await profilePerformance('Database initialization', initDatabase)

    const app = createApp(App)
    
    app.config.errorHandler = (err, instance, info) => {
      // Ignoruj puste błędy
      if (err === null || err === undefined) return
      
      showError(err, {
        component: instance?.$options.name || 'Unknown',
        info,
        type: 'vue_error_handler'
      })
      return false
    }
    
    // Usunięto compilerOptions które mogły powodować problemy
    delete app.config.compilerOptions
    
    await profilePerformance('Router setup', () => {
      app.use(router)
      return Promise.resolve()
    })
    
    await profilePerformance('ElementPlus setup', () => {
      app.use(ElementPlus)
      return Promise.resolve()
    })
    
    await profilePerformance('i18n setup', () => {
      app.use(i18n)
      return Promise.resolve()
    })
    
    await profilePerformance('Lodash setup', () => {
      app.use(lodash)
      return Promise.resolve()
    })

    await profilePerformance('Notification setup', () => {
      app.use(NotificationPlugin)
      return Promise.resolve()
    })

    await profilePerformance('App mounting', async () => {
      const rootElement = document.getElementById('app')
      if (rootElement) {
        app.mount('#app')
      } else {
        throw new Error('Root element #app not found')
      }
      return Promise.resolve()
    })
    
    if (env.NODE_ENV === "development") {
      ElNotification({
        title: 'Development Mode',
        message: 'Running in development environment',
        type: 'warning',
        duration: 5000,
        position: 'bottom-right'
      })
      
      logger.debug('Application running in development mode', {
        env: env.NODE_ENV,
        version: env.VUE_APP_VERSION
      })
    }
    
    logger.info('Application initialized successfully')
  } catch (error) {
    showError(error, {
      stage: 'initialization'
    })
  }
}

const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
  // Rozszerzona lista ignorowanych błędów
  if (event instanceof ErrorEvent && (
      event.message?.includes('Failed to fetch dynamically imported module') ||
      event.message?.includes('Loading chunk') ||
      event.message?.includes('Unexpected token') ||
      event.error === null
  )) {
    logger.warn('Ignored frontend error', {
      message: event.message,
      type: 'ignored_error'
    })
    return
  }
  
  if (event instanceof PromiseRejectionEvent) {
    // Ignoruj puste odrzucenia
    if (event.reason === null || event.reason === undefined) return
    
    showError(new Error(`Unhandled promise rejection: ${String(event.reason)}`), {
      reason: event.reason,
      type: 'unhandled_rejection'
    })
  } else if (event.error) {
    showError(event.error, {
      type: 'window_error'
    })
  }
}

window.addEventListener('error', handleGlobalError)
window.addEventListener('unhandledrejection', handleGlobalError)

initializeApp().catch(error => {
  logger.fatal('Application bootstrap failed', { 
    error: error instanceof Error ? error.message : String(error)
  })
})