import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { TOKEN_KEY, USER_KEY } from '@/lib/api'

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  avatar?: string | null
}

const MOCK = import.meta.env.VITE_MOCK_AUTH === 'true'

function read(key: string) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(read(TOKEN_KEY))
  const user = ref<AdminUser | null>(JSON.parse(read(USER_KEY) ?? 'null'))
  const isAuthenticated = computed(() => !!token.value)

  /**
   * Expects: POST /auth/login -> { token: string, user: { id, name, email, role } }
   * (adjust the mapping below to match your Authentication module's response)
   */
  async function login(email: string, password: string, remember: boolean) {
    let data: { token: string; user: AdminUser }
    if (MOCK) {
      data = { token: 'mock-token', user: { id: 1, name: 'Ada Admin', email, role: 'Super admin' } }
    } else {
      const res = await api.post('/auth/login', { email, password, device_name: 'admin-dashboard' })
      data = res.data.data ?? res.data
    }
    const store = remember ? localStorage : sessionStorage
    store.setItem(TOKEN_KEY, data.token)
    store.setItem(USER_KEY, JSON.stringify(data.user))
    token.value = data.token
    user.value = data.user
  }

  async function logout() {
    try {
      if (!MOCK) await api.post('/auth/logout')
    } catch {
      /* token may already be invalid; clear locally regardless */
    }
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY)
      s.removeItem(USER_KEY)
    }
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, login, logout }
})
