import { reactive } from 'vue'
import { api } from './api'

/**
 * Firebase web push for new-message alerts. Fully optional: if the VITE_FIREBASE_*
 * variables are missing, every function here quietly does nothing.
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
const KEY = 'syn_admin_push_token'

const stored = () => { try { return localStorage.getItem(KEY) } catch { return null } }
/** True only when this browser's token was actually saved on the API (not just "permission granted"). */
export const pushState = reactive({ registered: !!stored() })

export const pushConfigured = () => !!(cfg.apiKey && cfg.projectId && cfg.appId && vapid)
export const pushSupported = () => 'Notification' in window && 'serviceWorker' in navigator && pushConfigured()
export const pushPermission = () => ('Notification' in window ? Notification.permission : 'denied')

async function getToken(): Promise<string | null> {
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
    import('firebase/app'), import('firebase/messaging'),
  ])
  const app = getApps()[0] ?? initializeApp(cfg)
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  return getToken(getMessaging(app), { vapidKey: vapid, serviceWorkerRegistration: reg })
}

async function register(token: string) {
  await api.post('/admin/devices', { token, platform: 'web' })
  try { localStorage.setItem(KEY, token) } catch { /* ignore */ }
  pushState.registered = true
}

/** Ask permission (needs a click) and register this browser. */
export async function enableAdminPush(): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const token = await getToken()
  if (token) await register(token)
  return 'enabled'
}

/** On later visits, silently refresh the registration if permission was already given. */
export async function resumeAdminPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return
  try { const t = await getToken(); if (t) await register(t) } catch (e) { console.error('Push resume failed:', e) }
}

/** Call before logout so this browser stops receiving alerts for the signed-out account. */
export async function disableAdminPush() {
  let token: string | null = null
  try { token = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (!token) return
  try { await api.delete('/admin/devices', { data: { token } }) } catch { /* best effort */ }
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  pushState.registered = false
}