import axios from 'axios'

export const TOKEN_KEY = 'synsyma_admin_token'
export const USER_KEY = 'synsyma_admin_user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // e.g. https://api.synsyma.com/api/v1
  headers: { Accept: 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLogin) {
      for (const s of [localStorage, sessionStorage]) {
        s.removeItem(TOKEN_KEY)
        s.removeItem(USER_KEY)
      }
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export default api
