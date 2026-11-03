import type { AdminUser } from '@/types'

export interface Session {
  token: string
  refreshToken: string
  expiresAt: number          // ms epoch, access token
  refreshExpiresAt: number | null
  remember: boolean
  user: AdminUser
}

/** Flat `data` payload returned by login and refresh. */
export interface AuthPayload {
  token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_at?: string | null
  id: string
  name: string
  email: string
  role?: string | null
  roles?: string[]
  permissions?: string[]
  phone?: string | null
  photo_url?: string | null
}

const KEY = 'syn_admin_session'
type Listener = (s: Session | null, reason?: string) => void
const listeners = new Set<Listener>()
let current: Session | null = null
let reason: string | null = null

function read(): Session | null {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(KEY)
      if (raw) return JSON.parse(raw) as Session
    } catch { /* storage blocked or corrupt */ }
  }
  return null
}

function write(s: Session | null) {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
    if (s) (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

function emit() { listeners.forEach((l) => l(current, reason ?? undefined)) }

current = read()

// Keep tabs in sync (another tab refreshed, signed in, or signed out)
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  current = read()
  if (!current) reason = 'signed_out'
  emit()
})

export function sessionFromResponse(p: AuthPayload, remember: boolean): Session {
  return {
    token: p.token,
    refreshToken: p.refresh_token,
    expiresAt: Date.now() + p.expires_in * 1000,
    refreshExpiresAt: p.refresh_token_expires_at ? new Date(p.refresh_token_expires_at).getTime() : null,
    remember,
    user: {
      id: p.id, name: p.name, email: p.email,
      role: p.role ?? null, roles: p.roles ?? [], permissions: p.permissions ?? [],
      phone: p.phone ?? null, photo_url: p.photo_url ?? null,
    },
  }
}

export const session = {
  get: () => current,
  reload() { current = read(); return current },
  set(s: Session) { current = s; reason = null; write(s); emit() },
  patchUser(u: Partial<AdminUser>) {
    if (!current) return
    current = { ...current, user: { ...current.user, ...u } }
    write(current); emit()
  },
  clear(why = 'signed_out') { current = null; reason = why; write(null); emit() },
  endReason: () => reason,
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l) },
}
