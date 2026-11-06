<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, CalendarCheck, ChevronRight, Search } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { localWhen, statusLabel, statusPill } from '@/lib/bookings'
import type { BookingRow, BookingStatus, BookingSummary, PageMeta } from '@/types'

const router = useRouter()
const rows = ref<BookingRow[]>([])
const meta = ref<PageMeta | null>(null)
const summary = ref<BookingSummary | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const status = ref<'' | BookingStatus>('')
const page = ref(1)
let t: number | undefined

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: BookingRow[]; meta: PageMeta }>('/admin/bookings', {
      params: { page: page.value, per_page: 15, search: search.value.trim() || undefined, status: status.value || undefined },
    })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load bookings.").message } finally { loading.value = false }
}
async function loadSummary() { try { summary.value = (await api.get<{ data: BookingSummary }>('/admin/bookings/summary')).data.data } catch { /* tabs just show no counts */ } }
onMounted(() => { load(); loadSummary() })
onBeforeUnmount(() => window.clearTimeout(t))

function onSearch() { window.clearTimeout(t); t = window.setTimeout(() => { page.value = 1; load() }, 300) }
function setStatus(s: '' | BookingStatus) { status.value = s; page.value = 1; load() }
function go(p: number) { page.value = p; load() }

const tabs = computed<{ key: '' | BookingStatus; label: string; n: number | null }[]>(() => [
  { key: '', label: 'All', n: summary.value?.all ?? null },
  { key: 'confirmed', label: 'Needs contractor', n: summary.value?.confirmed ?? null },
  { key: 'assigned', label: 'Assigned', n: summary.value?.assigned ?? null },
  { key: 'in_progress', label: 'In progress', n: summary.value?.in_progress ?? null },
  { key: 'pending_payment', label: 'Awaiting payment', n: summary.value?.pending_payment ?? null },
  { key: 'quote_requested', label: 'Quotes', n: summary.value?.quote_requested ?? null },
  { key: 'completed', label: 'Completed', n: summary.value?.completed ?? null },
  { key: 'cancelled', label: 'Cancelled', n: summary.value?.cancelled ?? null },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Bookings</h1><p>Every booking from the app. Assign a contractor once a booking is confirmed.</p></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by status">
      <button v-for="tb in tabs" :key="tb.key" type="button" role="tab" class="chip" :class="{ on: status === tb.key }" :aria-selected="status === tb.key" @click="setStatus(tb.key)">
        {{ tb.label }}<span v-if="tb.n !== null" class="n" :class="{ attention: tb.key === 'confirmed' && tb.n > 0 && status !== 'confirmed' }">{{ tb.n }}</span>
      </button>
    </div>

    <div class="card">
      <div class="bar">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search reference, service, city or customer email" aria-label="Search bookings" @input="onSearch" /></label>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 56px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><CalendarCheck :size="30" /><p>{{ search || status ? 'No bookings match these filters.' : 'No bookings yet. They will appear here when customers book in the app.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Booking</th><th>Customer</th><th>When</th><th>Where</th><th>Contractor</th><th>Total</th><th>Status</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="b in rows" :key="b.id" class="click" tabindex="0" @click="router.push(`/bookings/${b.id}`)" @keydown.enter="router.push(`/bookings/${b.id}`)">
              <td><strong>{{ b.service_name }}<template v-if="b.tier"> · {{ b.tier }}</template></strong><small>{{ b.reference }}</small></td>
              <td><span class="line">{{ b.customer_name }}</span><small>{{ b.customer_email }}</small></td>
              <td><span class="line">{{ localWhen(b.starts_at_local) }}</span></td>
              <td><span class="line">{{ b.city }}</span><small>{{ b.region }}</small></td>
              <td>{{ b.contractor_name || '—' }}</td>
              <td>{{ b.total_label }}</td>
              <td><span class="pill" :class="statusPill[b.status]">{{ statusLabel[b.status] }}</span></td>
              <td class="go"><ChevronRight :size="18" aria-hidden="true" /></td>
            </tr>
          </tbody>
        </table>
      </div>

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
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
.tabs .chip { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.n { min-width: 20px; padding: 0 6px; font-size: 12px; line-height: 20px; text-align: center; border-radius: 10px; background: rgba(4, 20, 59, 0.08); }
.chip.on .n { background: rgba(255, 255, 255, 0.22); }
.n.attention { background: var(--danger); color: #fff; }
.bar { display: flex; gap: 10px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 240px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
td strong { display: block; } td small { display: block; color: var(--text-mute); } .line { display: block; }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(0, 102, 255, 0.04); }
.go { width: 36px; color: var(--text-mute); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
</style>