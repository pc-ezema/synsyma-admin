<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, ChevronRight, Download, Loader2, Receipt, Search } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { formatDateTime } from '@/lib/format'
import { money } from '@/lib/bookings'
import type { PageMeta, PaymentFilter, PaymentGateway, PaymentRow, PaymentTotals } from '@/types'

const router = useRouter()
const rows = ref<PaymentRow[]>([])
const meta = ref<PageMeta | null>(null)
const totals = ref<PaymentTotals | null>(null)
const gateways = ref<PaymentGateway[]>([])
const loading = ref(true)
const error = ref('')
const exporting = ref(false)
const search = ref('')
const status = ref<PaymentFilter>('')
const from = ref('')
const to = ref('')
const page = ref(1)
let t: number | undefined

const stateLabel: Record<PaymentRow['state'], string> = { paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded', failed: 'Failed', unpaid: 'Not paid' }
const statePill: Record<PaymentRow['state'], string> = { paid: 'green', partially_refunded: '', refunded: 'grey', failed: 'red', unpaid: 'grey' }
const tabs: { key: PaymentFilter; label: string }[] = [
  { key: '', label: 'All' }, { key: 'paid', label: 'Paid' }, { key: 'refunded', label: 'Refunded' }, { key: 'failed', label: 'Failed' }, { key: 'unpaid', label: 'Not paid' },
]

const params = computed(() => ({
  search: search.value.trim() || undefined, status: status.value || undefined, from: from.value || undefined, to: to.value || undefined,
}))

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: PaymentRow[]; meta: PageMeta; totals: PaymentTotals; gateways: PaymentGateway[] }>('/admin/payments', { params: { ...params.value, page: page.value, per_page: 15 } })
    rows.value = data.data; meta.value = data.meta; totals.value = data.totals; gateways.value = data.gateways ?? []
  } catch (e) { error.value = parseError(e, "Couldn't load payments.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))

function refilter() { page.value = 1; load() }
function onSearch() { window.clearTimeout(t); t = window.setTimeout(refilter, 300) }
function setStatus(s: PaymentFilter) { status.value = s; refilter() }
function go(p: number) { page.value = p; load() }
function clearDates() { from.value = ''; to.value = ''; refilter() }

async function exportCsv() {
  exporting.value = true
  try {
    const res = await api.get<Blob>('/admin/payments/export', { params: params.value, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `synsyma-payments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  } catch (e) { toast.error(parseError(e, "Couldn't export payments.").message) } finally { exporting.value = false }
}

const cur = (v: number, c = 'USD') => money(v, c)
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Payments</h1><p>Every card payment and refund. Amounts are in the booking currency.</p></div>
      <button type="button" class="btn btn-ghost" :disabled="exporting || !rows.length" @click="exportCsv">
        <Loader2 v-if="exporting" :size="16" class="spin" /><Download v-else :size="16" /> Export CSV
      </button>
    </div>

    <ul v-if="gateways.length" class="gw" aria-label="Payment methods">
      <li v-for="g in gateways" :key="g.id" :class="{ on: g.on }">
        <span class="dot" aria-hidden="true" />{{ g.label }}: <strong>{{ g.on ? 'on' : 'off' }}</strong><template v-if="g.on"> · {{ g.mode === 'live' ? 'live mode' : 'test mode' }}</template>
      </li>
    </ul>

    <div class="stats">
      <div class="card stat"><span>Collected</span><strong>{{ totals ? cur(totals.collected) : '—' }}</strong><small>{{ totals?.paid_count ?? 0 }} paid</small></div>
      <div class="card stat"><span>Refunded</span><strong>{{ totals ? cur(totals.refunded) : '—' }}</strong></div>
      <div class="card stat"><span>Net</span><strong>{{ totals ? cur(totals.net) : '—' }}</strong><small>Collected minus refunds</small></div>
      <div class="card stat"><span>Payments</span><strong>{{ totals?.count ?? '—' }}</strong><small>In this view</small></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by status">
      <button v-for="tb in tabs" :key="tb.key" type="button" role="tab" class="chip" :class="{ on: status === tb.key }" :aria-selected="status === tb.key" @click="setStatus(tb.key)">{{ tb.label }}</button>
    </div>

    <div class="card">
      <div class="bar">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search booking reference, service, customer email or Stripe reference" aria-label="Search payments" @input="onSearch" /></label>
        <label class="date"><span>From</span><input v-model="from" type="date" aria-label="From date" @change="refilter"></label>
        <label class="date"><span>To</span><input v-model="to" type="date" aria-label="To date" @change="refilter"></label>
        <button v-if="from || to" type="button" class="btn btn-ghost btn-sm" @click="clearDates">Clear dates</button>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 56px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Receipt :size="30" /><p>{{ search || status || from || to ? 'No payments match these filters.' : 'No payments yet. They will appear here when customers pay for bookings.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th>Status</th><th class="num">Amount</th><th class="num">Refunded</th><th class="num">Net</th><th>Method</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" class="click" tabindex="0" @click="router.push(`/bookings/${p.booking_id}`)" @keydown.enter="router.push(`/bookings/${p.booking_id}`)">
              <td><span class="line">{{ formatDateTime(p.paid_at ?? p.created_at) }}</span></td>
              <td><strong>{{ p.service_name }}</strong><small>{{ p.reference }}<template v-if="p.purpose === 'extra_hours'"> · {{ p.hours }} extra {{ p.hours === 1 ? 'hour' : 'hours' }}</template></small></td>
              <td><span class="line">{{ p.customer_name }}</span><small>{{ p.customer_email }}</small></td>
              <td><span class="pill" :class="statePill[p.state]">{{ stateLabel[p.state] }}</span><small v-if="p.failure_message" class="why">{{ p.failure_message }}</small></td>
              <td class="num">{{ cur(p.amount, p.currency) }}</td>
              <td class="num">{{ p.refunded_total ? cur(p.refunded_total, p.currency) : '—' }}</td>
              <td class="num"><strong>{{ p.state === 'paid' || p.state === 'partially_refunded' || p.state === 'refunded' ? cur(p.net, p.currency) : '—' }}</strong></td>
              <td>
                <span class="pill">{{ p.provider === 'paypal' ? 'PayPal' : 'Stripe' }}</span>
                <span v-if="p.card && p.provider !== 'paypal'" class="muted"> {{ p.card }}</span>
              </td>
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
.gw { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0 0 14px; padding: 0; font-size: 13px; color: var(--text-mute); }
.gw li { display: inline-flex; align-items: center; gap: 7px; }
.gw .dot { width: 8px; height: 8px; border-radius: 50%; background: #B5BAC6; }
.gw li.on .dot { background: #1BA864; }
.gw strong { color: var(--text); font-weight: 600; }
.stats { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-bottom: 16px; }
.stat { padding: 16px 18px; display: grid; gap: 4px; }
.stat span { font-size: 13px; color: var(--text-mute); }
.stat strong { font-family: var(--font-display); font-size: 24px; font-weight: 600; }
.stat small { font-size: 12px; color: var(--text-mute); }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
.tabs .chip { white-space: nowrap; }
.bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
.date { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; font-size: 13px; color: var(--text-mute); }
.date input { border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
td strong { display: block; } td small { display: block; color: var(--text-mute); } .line { display: block; }
td.num, th.num { text-align: right; white-space: nowrap; }
.why { max-width: 220px; margin-top: 4px; font-size: 12px; }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(0, 102, 255, 0.04); }
.go { width: 36px; color: var(--text-mute); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
</style>