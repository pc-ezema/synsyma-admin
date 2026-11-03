import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, bare } from '@/lib/api'
import { session, sessionFromResponse, type AuthPayload } from '@/lib/session'
import { disableAdminPush } from '@/lib/push'
import type { AdminUser } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AdminUser | null>(session.get()?.user ?? null)
  const authed = ref(!!session.get())
  const endReason = ref<string | null>(null)

  // Mirror the session module (covers refresh failures and other tabs)
  session.subscribe((s, why) => {
    user.value = s?.user ?? null
    authed.value = !!s
    endReason.value = s ? null : why ?? null
  })

  const isAuthenticated = computed(() => authed.value)
  const isSuperAdmin = computed(() => !!user.value?.roles.includes('super_admin'))

  function can(permission?: string | string[]): boolean {
    if (!permission || (Array.isArray(permission) && !permission.length)) return true
    if (!user.value) return false
    if (isSuperAdmin.value) return true
    const have = new Set(user.value.permissions)
    return (Array.isArray(permission) ? permission : [permission]).every((p) => have.has(p))
  }

  async function login(email: string, password: string, remember: boolean) {
    const { data } = await bare.post<{ data: AuthPayload }>('/admin/auth/login', { email, password })
    session.set(sessionFromResponse(data.data, remember))
  }

  /** Re-read roles and permissions so changes made by another admin apply without re-login. */
  async function refreshProfile() {
    if (!session.get()) return
    try {
      const { data } = await api.get<{ data: AuthPayload }>('/admin/auth/me')
      const p = data.data
      session.patchUser({ name: p.name, email: p.email, role: p.role ?? null, roles: p.roles ?? [], permissions: p.permissions ?? [], phone: p.phone ?? null, photo_url: p.photo_url ?? null })
    } catch { /* offline or expired; the interceptor handles expiry */ }
  }

  /** Apply profile changes (name, phone, photo) to the signed-in user without a reload. */
  function applyProfile(p: Partial<AdminUser>) { session.patchUser(p) }

  async function logout() {
    try { await disableAdminPush() } catch { /* ignore */ }
    try { await api.post('/admin/auth/logout') } catch { /* token may already be dead */ }
    session.clear('signed_out')
  }

  return { user, isAuthenticated, isSuperAdmin, endReason, can, login, logout, refreshProfile, applyProfile }
})
