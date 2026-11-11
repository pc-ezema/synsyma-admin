<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, Bell, BellOff, BellRing, CalendarCheck, FileText, MessageSquare, Star, UserMinus } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useNotificationStore } from '@/stores/notifications'
import { toast } from '@/composables/useToast'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { disableAdminPush, enableAdminPush, pushConfigured, pushState, pushSupported } from '@/lib/push'
import type { AdminNotification } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const notes = useNotificationStore()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const busy = ref(false)

const total = computed(() => notes.unread)
const badge = computed(() => (notes.unread > 9 ? '9+' : String(notes.unread)))
const canChat = computed(() => auth.can('chat.view'))
const pushOn = computed(() => pushState.registered)

const icons: Record<string, unknown> = { booking_to_assign: CalendarCheck, quote_requested: FileText, low_review: Star, payment_failed: AlertCircle, deletion_request: UserMinus }
const iconFor = (t: string) => (icons[t] ?? Bell) as typeof Bell

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`
  return formatDateTime(iso)
}

/** Clicking the bell opens the list and, the first time, asks the browser for permission to send alerts.
 *  Browsers only allow that prompt from a click, which is why it lives here. */
async function toggle() {
  open.value = !open.value
  if (!open.value) return
  notes.loadLatest()
  await turnOn(true)
}

async function turnOn(quiet = false) {
  if (!pushSupported() || pushState.registered || pushState.denied) return
  busy.value = true
  try {
    const r = await enableAdminPush()
    if (r === 'enabled') toast.success('Browser alerts are on. We will tell you about new bookings, quotes and low ratings.')
    else if (r === 'denied' && !quiet) toast.error('Alerts are blocked. Allow notifications for this site in your browser settings.')
  } catch (e) {
    console.error('Push setup failed:', e)
    toast.error(e instanceof Error && !('isAxiosError' in e) ? `Alerts could not be turned on: ${e.message}` : parseError(e).message)
  } finally { busy.value = false }
}

async function turnOff() {
  busy.value = true
  try { await disableAdminPush(); toast.success('Browser alerts are off for this browser.') } finally { busy.value = false }
}

async function openItem(n: AdminNotification) {
  open.value = false
  notes.markRead(n)
  if (n.link) router.push(n.link)
}
function openChat() { open.value = false; router.push('/chat') }
function seeAll() { open.value = false; router.push('/notifications') }

function onDocClick(e: MouseEvent) { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })
</script>

<template>
  <div ref="root" class="bellwrap">
    <button class="icon-btn bell" type="button" aria-haspopup="dialog" :aria-expanded="open" :aria-label="total ? `Notifications, ${total} unread` : 'Notifications'" title="Notifications" @click="toggle">
      <BellRing v-if="pushOn" :size="19" /><Bell v-else :size="19" />
      <span v-if="total" class="badge" aria-hidden="true">{{ badge }}</span>
    </button>

    <div v-if="open" class="panel" role="dialog" aria-label="Notifications">
      <header>
        <strong>Notifications</strong>
        <button v-if="notes.unread" type="button" class="link" @click="notes.markAll()">Mark all as read</button>
      </header>

      <button v-if="canChat && chat.unread" type="button" class="row chatrow" @click="openChat">
        <span class="ic"><MessageSquare :size="17" /></span>
        <span class="tx"><strong>{{ chat.unread }} unread {{ chat.unread === 1 ? 'conversation' : 'conversations' }}</strong><small>Customers are waiting for a reply</small></span>
      </button>

      <div v-if="notes.loading && !notes.latest.length" class="pad"><span v-for="i in 3" :key="i" class="skeleton" style="height: 52px; margin-bottom: 8px" /></div>
      <p v-else-if="!notes.latest.length" class="empty-note">You are all caught up.</p>
      <ul v-else class="list">
        <li v-for="n in notes.latest" :key="n.id">
          <button type="button" class="row" :class="{ unread: !n.read }" @click="openItem(n)">
            <span class="ic"><component :is="iconFor(n.type)" :size="17" /></span>
            <span class="tx"><strong>{{ n.title }}</strong><span class="body">{{ n.body }}</span><small>{{ ago(n.created_at) }}</small></span>
            <span v-if="!n.read" class="dot" aria-label="Unread" />
          </button>
        </li>
      </ul>

      <footer>
        <span v-if="pushOn" class="st"><BellRing :size="15" /> Browser alerts on <button type="button" class="link" :disabled="busy" @click="turnOff">Turn off</button></span>
        <span v-else-if="pushState.denied" class="st warn"><BellOff :size="15" /> Blocked in this browser. Allow notifications for this site in its settings.</span>
        <button v-else-if="pushSupported()" type="button" class="link" :disabled="busy" @click="turnOn()">Turn on browser alerts</button>
        <span v-else-if="!pushConfigured()" class="st">Browser alerts are not set up for this dashboard.</span>
        <button type="button" class="link all" @click="seeAll">See all</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.bellwrap { position: relative; }
.bell { position: relative; }
.badge { position: absolute; top: 4px; right: 3px; min-width: 17px; height: 17px; padding: 0 4px; display: grid; place-items: center; border-radius: 999px; background: var(--danger); color: #fff; font-size: 10.5px; font-weight: 700; line-height: 1; box-shadow: 0 0 0 2px #fff; }

.panel { position: absolute; right: 0; top: calc(100% + 10px); z-index: 60; width: 380px; max-width: calc(100vw - 24px); display: flex; flex-direction: column; max-height: min(560px, calc(100dvh - 90px)); background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 24px 48px -16px rgba(4, 20, 59, 0.28); overflow: hidden; }
header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 10px; }
header strong { font-family: var(--font-display); font-size: 16px; }
.link { background: none; border: 0; padding: 0; color: var(--blue-ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.link:hover { text-decoration: underline; } .link:disabled { opacity: 0.55; cursor: default; text-decoration: none; }
.pad { padding: 4px 16px 12px; }
.empty-note { margin: 0; padding: 28px 16px 32px; text-align: center; color: var(--text-mute); font-size: 14px; }
.list { list-style: none; margin: 0; padding: 0 0 4px; overflow-y: auto; }
.row { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 11px 16px; background: none; border: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.row:hover { background: rgba(4, 20, 59, 0.04); }
.row.unread { background: rgba(0, 102, 255, 0.05); } .row.unread:hover { background: rgba(0, 102, 255, 0.09); }
.chatrow { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
.ic { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: rgba(0, 102, 255, 0.1); color: var(--blue-ink); }
.tx { flex: 1; min-width: 0; display: grid; gap: 1px; }
.tx strong { font-size: 14px; }
.body { font-size: 13px; line-height: 1.4; color: var(--text-dim); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tx small { font-size: 12px; color: var(--text-mute); }
.dot { flex: none; width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: var(--blue); }
footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 16px; border-top: 1px solid var(--line); background: rgba(4, 20, 59, 0.02); }
.st { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12.5px; color: var(--text-mute); min-width: 0; }
.st.warn { color: var(--danger); }
.all { margin-left: auto; flex: none; }

@media (max-width: 640px) {
  .bellwrap { position: static; }
  .panel { position: fixed; left: 12px; right: 12px; top: calc(var(--topbar-h) + 6px); width: auto; max-width: none; }
}
</style>