<template>
  <div class="async-component">
    <!-- Stan ładowania -->
    <div v-if="state === 'loading'" class="async-loading">
      <slot name="loading">
        <div class="default-loading">
          <el-icon class="loading-icon" :size="32"><Loading /></el-icon>
          <p>{{ loadingText }}</p>
        </div>
      </slot>
    </div>

    <!-- Stan błędu -->
    <div v-else-if="state === 'error'" class="async-error">
      <slot name="error" :error="error" :retry="loadComponent">
        <div class="default-error">
          <el-icon class="error-icon" :size="32"><Warning /></el-icon>
          <h3>{{ errorTitle }}</h3>
          <p>{{ errorMessage }}</p>
          <el-button type="primary" @click="loadComponent" :loading="retrying">
            {{ retryButtonText }}
          </el-button>
        </div>
      </slot>
    </div>

    <!-- Stan timeout -->
    <div v-else-if="state === 'timeout'" class="async-timeout">
      <slot name="timeout" :retry="loadComponent">
        <div class="default-timeout">
          <el-icon class="timeout-icon" :size="32"><Clock /></el-icon>
          <h3>{{ timeoutTitle }}</h3>
          <p>{{ timeoutMessage }}</p>
          <el-button type="primary" @click="loadComponent" :loading="retrying">
            {{ retryButtonText }}
          </el-button>
        </div>
      </slot>
    </div>

    <!-- Załadowany komponent -->
    <component
      v-else-if="state === 'loaded'"
      :is="loadedComponent"
      v-bind="$attrs"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent, watch } from 'vue'
import { ElIcon, ElButton } from 'element-plus'
import { Loading, Warning, Clock } from '@element-plus/icons-vue'

const props = defineProps({
  // Funkcja ładująca komponent (powinna zwracać import())
  loader: {
    type: Function,
    required: true
  },
  // Opóźnienie przed pokazaniem wskaźnika ładowania (ms)
  delay: {
    type: Number,
    default: 200
  },
  // Timeout dla ładowania (ms)
  timeout: {
    type: Number,
    default: 10000
  },
  // Tekst ładowania
  loadingText: {
    type: String,
    default: 'Ładowanie komponentu...'
  },
  // Tytuł błędu
  errorTitle: {
    type: String,
    default: 'Błąd ładowania'
  },
  // Komunikat błędu
  errorMessage: {
    type: String,
    default: 'Wystąpił problem podczas ładowania komponentu.'
  },
  // Tytuł timeout
  timeoutTitle: {
    type: String,
    default: 'Przekroczono czas ładowania'
  },
  // Komunikat timeout
  timeoutMessage: {
    type: String,
    default: 'Ładowanie komponentu trwa zbyt długo.'
  },
  // Tekst przycisku ponowienia
  retryButtonText: {
    type: String,
    default: 'Spróbuj ponownie'
  },
  // Czy ponownie ładować przy zmianie klucza
  reloadOnKeyChange: {
    type: Boolean,
    default: true
  },
  // Klucz do śledzenia zmian (zmiana wymusza ponowne ładowanie)
  componentKey: {
    type: [String, Number],
    default: ''
  }
})

const emit = defineEmits(['loaded', 'error', 'timeout', 'loading'])

const state = ref('idle') // 'idle', 'loading', 'loaded', 'error', 'timeout'
const loadedComponent = ref(null)
const error = ref(null)
const retrying = ref(false)
const timeoutId = ref(null)

// Główna funkcja ładująca komponent
const loadComponent = async () => {
  try {
    state.value = 'loading'
    retrying.value = true
    error.value = null
    emit('loading')

    // Ustaw timeout
    if (props.timeout > 0) {
      timeoutId.value = setTimeout(() => {
        if (state.value === 'loading') {
          state.value = 'timeout'
          emit('timeout')
        }
      }, props.timeout)
    }

    // Ładuj komponent
    const component = await props.loader()
    
    // Czyścimy timeout jeśli udało się załadować
    if (timeoutId.value) {
      clearTimeout(timeoutId.value)
      timeoutId.value = null
    }

    loadedComponent.value = defineAsyncComponent({
      loader: () => component,
      delay: props.delay,
      timeout: props.timeout,
      onError: (err, retry, fail) => {
        state.value = 'error'
        error.value = err
        emit('error', err)
      }
    })

    state.value = 'loaded'
    emit('loaded', component)
  } catch (err) {
    state.value = 'error'
    error.value = err
    emit('error', err)
  } finally {
    retrying.value = false
  }
}

// Obserwuj zmiany klucza komponentu
watch(() => props.componentKey, () => {
  if (props.reloadOnKeyChange) {
    loadComponent()
  }
})

// Ładuj komponent przy montowaniu
onMounted(() => {
  loadComponent()
})
</script>

<style scoped>
.async-component {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.default-loading,
.default-error,
.default-timeout {
  text-align: center;
  padding: 2rem;
  color: var(--el-text-color-secondary);
}

.loading-icon {
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

.error-icon {
  color: var(--el-color-error);
}

.timeout-icon {
  color: var(--el-color-warning);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
