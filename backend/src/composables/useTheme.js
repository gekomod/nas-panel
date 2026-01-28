import { ref, onMounted, watch } from 'vue'

export function useTheme() {
  const theme = ref(localStorage.getItem('theme') || 'system')
  const isDarkMode = ref(false)

  const updateTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = theme.value === 'dark' || (theme.value === 'system' && prefersDark)
    
    isDarkMode.value = shouldBeDark
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
    
    // Zaktualizuj Element Plus theme
    const el = document.querySelector('html')
    if (el) {
      el.setAttribute('class', shouldBeDark ? 'dark' : '')
    }
  }

  const setTheme = (newTheme) => {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    updateTheme()
  }

  const toggleTheme = () => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  onMounted(() => {
    updateTheme()
    
    // Obserwuj zmiany systemowego theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', updateTheme)
    
    // Cleanup
    return () => mediaQuery.removeEventListener('change', updateTheme)
  })

  watch(theme, updateTheme)

  return {
    theme,
    isDarkMode,
    setTheme,
    toggleTheme
  }
}
