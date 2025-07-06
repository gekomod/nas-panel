import { ref } from 'vue'

// Stan globalny
const isAuthenticated = ref(false)
const currentUser = ref(null)
const authError = ref(null)

export const useAuth = () => {
  /**
   * Logowanie użytkownika
   * @param {string} username - Login systemowy
   * @param {string} password - Hasło
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = async (username, password) => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/login`, {
        method: 'POST',
        credentials: 'include', // Wymagane dla cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Logowanie nie powiodło się')
      }

      isAuthenticated.value = true
      currentUser.value = data.user
      authError.value = null
      return { success: true }
    } catch (error) {
      isAuthenticated.value = false
      currentUser.value = null
      authError.value = error.message
      return { 
        success: false, 
        error: error.message 
      }
    }
  }

  /**
   * Wylogowanie użytkownika
   * @returns {Promise<{success: boolean}>}
   */
  const logout = async () => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/logout`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Wylogowanie nie powiodło się')
      }

      isAuthenticated.value = false
      currentUser.value = null
      return { success: true }
    } catch (error) {
      authError.value = error.message
      return { success: false }
    }
  }

  /**
   * Sprawdzenie stanu autentykacji
   * @returns {Promise<boolean>}
   */
  const checkAuth = async () => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/api/check-auth`, {
        credentials: 'include',
      })

      const data = await response.json()
      isAuthenticated.value = data.authenticated
      currentUser.value = data.authenticated ? { username: data.user } : null
      return data.authenticated
    } catch (error) {
      isAuthenticated.value = false
      currentUser.value = null
      return false
    }
  }

  return {
    isAuthenticated,
    currentUser,
    authError,
    login,
    logout,
    checkAuth,
  }
}
