import { reactive } from 'vue'
import { api } from './api'

/**
 * Firebase web push for the dashboard: new chat messages and the bell's alerts (new bookings, quotes, low ratings).
 * Fully optional: if the VITE_FIREBASE_* variables are missing, every function here quietly does nothing.
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
export const pushConfigured = () => !!(cfg.apiKey && cfg.projectId && cfg.appId && vapid)
export const pushSupported = () => 'Notification' in window && 'serviceWorker' in navigator && pushConfigured()
export const pushPermission = () => ('Notification' in window ? Notification.permission : 'denied')

/** registered: this browser's token was actually saved on the API (not just "permission granted"). denied: the browser blocked alerts. */
export const pushState = reactive({ registered: !!stored(), denied: pushPermission() === 'denied' })

async function getToken(): Promise<string | null> {
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
    import('firebase/app'), import('firebase/messaging'),
  ])
  const app = getApps()[0] ?? initializeApp(cfg)
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  return getToken(getMessaging(app), { vapidKey: vapid, serviceWorkerRegistration: reg })
}

async function register(token: string) {
  await api.post('/admin/devices', { token, platform: 'web' }) // chat alerts
  try { await api.post('/admin/notifications/devices', { token }) } catch { /* the bell still works; alerts just stay in-app */ }
  try { localStorage.setItem(KEY, token) } catch { /* ignore */ }
  pushState.registered = true
}

// ---- alerts that arrive while the dashboard is open (the service worker handles the closed-tab case) ----
export interface LiveAlert { title: string; body: string; url: string }
const handlers = new Set<(a: LiveAlert) => void>()
let listening = false

/** Be told when an alert arrives while this tab is open. Returns a function that stops listening. */
export function onAlert(fn: (a: LiveAlert) => void): () => void {
  handlers.add(fn)
  void listenForAlerts()
  return () => { handlers.delete(fn) }
}

async function listenForAlerts() {
  if (listening || !pushSupported() || Notification.permission !== 'granted') return
  listening = true
  try {
    const [{ initializeApp, getApps }, { getMessaging, onMessage }] = await Promise.all([import('firebase/app'), import('firebase/messaging')])
    const app = getApps()[0] ?? initializeApp(cfg)
    onMessage(getMessaging(app), (p) => {
      const d = p.data ?? {}
      if (d.kind !== 'admin_alert') return
      handlers.forEach((h) => h({ title: d.title ?? '', body: d.body ?? '', url: d.url ?? '/notifications' }))
    })
  } catch (e) { listening = false; console.error('Live alerts failed:', e) }
}

/** Ask permission (needs a click) and register this browser. */
export async function enableAdminPush(): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') { pushState.denied = perm === 'denied'; return 'denied' }
  pushState.denied = false
  const token = await getToken()
  if (token) await register(token)
  void listenForAlerts()
  return 'enabled'
}

/** On later visits, silently refresh the registration if permission was already given. */
export async function resumeAdminPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return
  try { const t = await getToken(); if (t) await register(t); void listenForAlerts() } catch (e) { console.error('Push resume failed:', e) }
}

/** Turn alerts off for this browser, and before logout so it stops receiving alerts for the signed-out account. */
export async function disableAdminPush() {
  let token: string | null = null
  try { token = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (!token) return
  try { await api.delete('/admin/devices', { data: { token } }) } catch { /* best effort */ }
  try { await api.delete('/admin/notifications/devices', { data: { token } }) } catch { /* best effort */ }
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  pushState.registered = false
}