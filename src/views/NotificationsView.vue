<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, Bell, CalendarCheck, FileText, Star, UserMinus } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { useNotificationStore } from '@/stores/notifications'
import type { AdminNotification, PageMeta } from '@/types'

const router = useRouter()
const notes = useNotificationStore()

const rows = ref<AdminNotification[]>([])
const meta = ref<PageMeta | null>(null)
const loading = ref(true)
const error = ref('')
const filter = ref<'all' | 'unread'>('all')
const page = ref(1)

const icons: Record<string, unknown> = { booking_to_assign: CalendarCheck, quote_requested: FileText, low_review: Star, payment_failed: AlertCircle, deletion_request: UserMinus }
const iconFor = (t: string) => (icons[t] ?? Bell) as typeof Bell

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: AdminNotification[]; meta: PageMeta; unread_count: number }>('/admin/notifications', { params: { filter: filter.value, page: page.value, per_page: 20 } })
    rows.value = data.data; meta.value = data.meta; notes.unread = data.unread_count
  } catch (e) { error.value = parseError(e, "Couldn't load notifications.").message } finally { loading.value = false }
}
onMounted(load)

function setFilter(f: 'all' | 'unread') { filter.value = f; page.value = 1; load() }
function go(p: number) { page.value = p; load() }
async function markAll() { await notes.markAll(); await load() }
async function openItem(n: AdminNotification) { await notes.markRead(n); if (n.link) router.push(n.link) }
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Notifications</h1><p>What needs your team. Choose what reaches you, and by push or email, on <router-link to="/profile" class="lnk">My profile</router-link>.</p></div>
      <div class="acts"><button type="button" class="btn btn-ghost" :disabled="!notes.unread" @click="markAll">Mark all as read</button></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter">
      <button type="button" role="tab" class="chip" :class="{ on: filter === 'all' }" :aria-selected="filter === 'all'" @click="setFilter('all')">All</button>
      <button type="button" role="tab" class="chip" :class="{ on: filter === 'unread' }" :aria-selected="filter === 'unread'" @click="setFilter('unread')">Unread<template v-if="notes.unread"> ({{ notes.unread }})</template></button>
    </div>

    <div class="card">
      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 64px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Bell :size="30" /><p>{{ filter === 'unread' ? 'Nothing unread. You are all caught up.' : 'No notifications yet. New bookings, quote requests and low ratings show up here.' }}</p></div>
      <ul v-else class="list">
        <li v-for="n in rows" :key="n.id">
          <button type="button" class="row" :class="{ unread: !n.read }" @click="openItem(n)">
            <span class="ic"><component :is="iconFor(n.type)" :size="18" /></span>
            <span class="tx"><strong>{{ n.title }}</strong><span class="body">{{ n.body }}</span><small>{{ formatDateTime(n.created_at) }}</small></span>
            <span v-if="!n.read" class="pill green">New</span>
          </button>
        </li>
      </ul>

      <div v-if="meta && meta.last_page > 1" class="pager">
        <button type="button" class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="go(page - 1)">Previous</button>
        <span>Page {{ meta.current_page }} of {{ meta.last_page }}</span>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="page >= meta.last_page" @click="go(page + 1)">Next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.lnk { color: var(--blue-ink); text-decoration: none; } .lnk:hover { text-decoration: underline; }
.tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.list { list-style: none; margin: 0; padding: 0; }
.list li + li { border-top: 1px solid var(--line); }
.row { display: flex; align-items: flex-start; gap: 14px; width: 100%; padding: 14px 18px; background: none; border: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.row:hover { background: rgba(4, 20, 59, 0.03); } .row.unread { background: rgba(0, 102, 255, 0.05); }
.ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: rgba(0, 102, 255, 0.1); color: var(--blue-ink); }
.tx { flex: 1; min-width: 0; display: grid; gap: 2px; } .tx strong { font-size: 15px; }
.body { color: var(--text-dim); font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; } .tx small { color: var(--text-mute); font-size: 12.5px; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
</style>