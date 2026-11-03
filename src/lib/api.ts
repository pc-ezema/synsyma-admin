import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { session, sessionFromResponse, type AuthPayload } from './session'

const baseURL = import.meta.env.VITE_API_URL as string
const headers = { Accept: 'application/json' }

export const api = axios.create({ baseURL, headers, timeout: 20000 })
/** No interceptors. Used for login and refresh to avoid loops. */
export const bare = axios.create({ baseURL, headers, timeout: 20000 })

const SKIP = /\/admin\/auth\/(login|refresh)$/
const EARLY_MS = 30_000

let inflight: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const before = session.reload()
  if (!before) return null
  const used = before.refreshToken

  const run = async (): Promise<string | null> => {
    // Another tab may have refreshed while we waited for the lock
    const latest = session.reload()
    if (!latest) return null
    if (latest.refreshToken !== used) return latest.token
    try {
      const { data } = await bare.post<{ data: AuthPayload }>('/admin/auth/refresh', { refresh_token: latest.refreshToken })
      const next = sessionFromResponse(data.data, latest.remember)
      // Refresh response may omit profile fields; keep what we know
      next.user = { ...latest.user, ...Object.fromEntries(Object.entries(next.user).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))) } as typeof next.user
      session.set(next)
      return next.token
    } catch (e) {
      const status = (e as AxiosError).response?.status
      if (status && [401, 403, 422].includes(status)) session.clear('expired')
      return null // network errors keep the session so the user can retry
    }
  }

  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  return locks ? locks.request('syn_admin_refresh', run) : run()
}

export function refreshSession(): Promise<string | null> {
  if (!inflight) inflight = doRefresh().finally(() => { inflight = null })
  return inflight
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (SKIP.test(config.url ?? '')) return config
  let s = session.get()
  if (!s) return config
  if (s.expiresAt - Date.now() < EARLY_MS) {
    await refreshSession()
    s = session.get()
  }
  if (s) config.headers.Authorization = `Bearer ${s.token}`
  return config
})

type Retryable = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as Retryable | undefined
    if (error.response?.status === 401 && config && !config._retried && !SKIP.test(config.url ?? '') && session.get()) {
      config._retried = true
      const token = await refreshSession()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return api.request(config)
      }
      if (!session.get()) return Promise.reject(error)
    }
    return Promise.reject(error)
  },
)

/** Fetch a protected file (chat attachment) as a blob. Absolute URLs are used as-is. */
export async function fetchBlob(url: string): Promise<Blob> {
  const res = await api.get(url, { responseType: 'blob' })
  return res.data
}
