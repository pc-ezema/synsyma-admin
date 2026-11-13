<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Clock, CreditCard, FileText, Hourglass, RefreshCw,
  ShieldCheck, TrendingDown, TrendingUp, Truck, UserX, Wallet,
} from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth'
import { money, statusLabel } from '@/lib/bookings'
import { statusLabel as contractorStatusLabel, statusPill as contractorStatusPill } from '@/lib/contractors'
import { initials } from '@/lib/format'
import type { BookingStatus, ContractorStatus } from '@/types'
import TrendChart from '@/components/dashboard/TrendChart.vue'
import BarList from '@/components/dashboard/BarList.vue'

interface Point { t: string; v: number }
interface Kpi { key: string; label: string; value: number | null; previous: number | null; change: number | null; format: 'count' | 'money' | 'rating'; invert: boolean; sub?: string | null }
interface Attention { key: string; count: number; oldest?: string | null; no_id?: number; awaiting_background?: number; amount?: number }
interface BoardCard { id: string; reference: string; starts_at: string; service: string; city: string; contractor: string | null; problem: boolean }
interface NewCustomer { id: string; name: string; email: string; is_active: boolean; created_at: string | null }
interface NewContractor { id: string; name: string; type: 'company' | 'individual'; location: string; status: string; created_at: string | null }
interface FeedEvent { id: string; type: string; actor: string; from: string | null; to: string | null; note: string | null; at: string | null; booking_id: string; reference: string; service: string }
interface Dash {
  range: string; tz: string; generated_at: string
  can: { bookings: boolean; contractors: boolean; payouts: boolean; reviews: boolean; users: boolean }
  attention: Attention[]; kpis: Kpi[]
  charts?: {
    by_status?: { status: string; count: number }[]; services?: { name: string; count: number }[]; areas?: { name: string; count: number }[]
    bookings?: Point[]; revenue?: Point[]; ratings?: { rating: number; count: number }[]
  }
  board?: Record<string, BoardCard[]>
  feed?: FeedEvent[]
  people?: { customers?: NewCustomer[]; contractors?: NewContractor[] }
}

const auth = useAuthStore()
const RANGES = [{ key: 'today', label: 'Today' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: '90d', label: '90 days' }] as const
type RangeKey = (typeof RANGES)[number]['key']

function savedRange(): RangeKey {
  try { const v = localStorage.getItem('dash-range'); if (v && RANGES.some((r) => r.key === v)) return v as RangeKey } catch { /* fine */ }
  return '7d'
}
const range = ref<RangeKey>(savedRange())
const data = ref<Dash | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const flash = ref<Set<string>>(new Set())
let timer: number | undefined
let flashTimer: number | undefined
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

async function load(silent = false) {
  if (silent) refreshing.value = true; else loading.value = true
  error.value = ''
  try {
    const res = await api.get<{ data: Dash }>('/admin/dashboard', { params: { range: range.value, tz } })
    const before = new Map((data.value?.attention ?? []).map((a) => [a.key, a.count]))
    const changed = new Set<string>()
    for (const a of res.data.data.attention) if (before.has(a.key) && before.get(a.key) !== a.count) changed.add(a.key)
    data.value = res.data.data
    if (changed.size) {
      flash.value = changed
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => (flash.value = new Set()), 2500)
    }
  } catch (e) {
    if (!data.value) error.value = parseError(e, "Couldn't load the dashboard.").message
  } finally { loading.value = false; refreshing.value = false }
}

function schedule() {
  window.clearInterval(timer)
  timer = window.setInterval(() => { if (!document.hidden) load(true) }, 60_000)
}
function onVisible() { if (!document.hidden && data.value) load(true) }
onMounted(() => { load(); schedule(); document.addEventListener('visibilitychange', onVisible) })
onBeforeUnmount(() => { window.clearInterval(timer); window.clearTimeout(flashTimer); document.removeEventListener('visibilitychange', onVisible) })

function setRange(r: RangeKey) {
  range.value = r
  try { localStorage.setItem('dash-range', r) } catch { /* fine */ }
  load()
}

const greeting = computed(() => {
  const h = new Date().getHours()
  return `Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}, ${auth.user?.name ?? 'there'}`
})
const updated = computed(() => data.value ? new Date(data.value.generated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

// ---------------------------------------------------------------- needs attention
interface Card { key: string; title: string; hint: string; to: string; icon: unknown; tone: 'red' | 'amber' | 'blue'; count: number }
const META: Record<string, { title: (a: Attention) => string; hint: (a: Attention) => string; to: string; icon: unknown; tone: Card['tone'] }> = {
  unassigned: { title: () => 'Paid, no contractor', hint: (a) => (a.oldest ? `Oldest waiting since ${when(a.oldest)}` : 'Assign a contractor'), to: '/bookings?status=confirmed', icon: UserX, tone: 'red' },
  unassigned_soon: { title: () => 'Start within 24h, no contractor', hint: () => 'Most urgent to assign', to: '/bookings?status=confirmed', icon: Clock, tone: 'red' },
  not_on_the_way: { title: () => 'Starting soon, not on the way', hint: () => 'Within 2 hours', to: '/bookings?status=assigned', icon: Truck, tone: 'amber' },
  problems: { title: () => 'Problems reported', hint: () => 'Customer needs an answer', to: '/bookings', icon: AlertTriangle, tone: 'red' },
  quotes_to_price: { title: () => 'Quotes to price', hint: () => 'Customers are waiting', to: '/bookings?status=quote_requested', icon: FileText, tone: 'amber' },
  quotes_expiring: { title: () => 'Quotes expiring in 24h', hint: () => 'Follow up or let lapse', to: '/bookings?status=quote_sent', icon: Hourglass, tone: 'amber' },
  payment_failed: { title: () => 'Failed payments', hint: () => 'Last 7 days, still unpaid', to: '/bookings?status=pending_payment', icon: CreditCard, tone: 'amber' },
  contractors_pending: {
    title: () => 'Contractors to review',
    hint: (a) => [a.no_id ? `${a.no_id} missing ID` : '', a.awaiting_background ? `${a.awaiting_background} awaiting background check` : ''].filter(Boolean).join(', ') || 'Ready to review',
    to: '/contractors?status=pending', icon: ShieldCheck, tone: 'blue',
  },
  payouts_due: { title: () => 'Contractors to pay', hint: (a) => (a.amount ? `${money(a.amount)} due` : 'Balances due'), to: '/payouts', icon: Wallet, tone: 'blue' },
}
const cards = computed<Card[]>(() =>
  (data.value?.attention ?? []).flatMap((a): Card[] => {
    const m = META[a.key]
    if (!m || a.count <= 0) return []
    return [{ key: a.key, title: m.title(a), hint: m.hint(a), to: m.to, icon: m.icon, tone: m.tone, count: a.count }]
  }),
)
function when(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------- numbers
function show(k: Kpi): string {
  if (k.value === null) return 'No data'
  if (k.format === 'money') return money(k.value)
  if (k.format === 'rating') return k.value.toFixed(2)
  return new Intl.NumberFormat('en-US').format(k.value)
}
function tone(k: Kpi): 'good' | 'bad' | 'flat' {
  if (k.change === null || k.change === 0) return 'flat'
  return (k.change > 0) !== k.invert ? 'good' : 'bad'
}
const periodText = computed(() => (range.value === 'today' ? 'same time yesterday' : 'previous period'))

// ---------------------------------------------------------------- board and feed
const COLS: { key: string; label: string }[] = [
  { key: 'confirmed', label: 'Needs contractor' }, { key: 'assigned', label: 'Assigned' }, { key: 'en_route', label: 'On the way' },
  { key: 'in_progress', label: 'In progress' }, { key: 'completed', label: 'Completed' },
]
const boardTotal = computed(() => COLS.reduce((n, c) => n + (data.value?.board?.[c.key]?.length ?? 0), 0))
function clock(iso: string): string { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }

function statusName(s: string | null): string { return s ? (statusLabel[s as BookingStatus] ?? s.replace(/_/g, ' ')) : '' }
function describe(e: FeedEvent): string {
  const who = e.actor === 'customer' ? 'Customer' : e.actor === 'admin' ? 'Admin' : 'System'
  switch (e.type) {
    case 'created': return 'Booking created'
    case 'payment_succeeded': case 'payment_received': return 'Payment received'
    case 'payment_failed': return 'Payment failed'
    case 'payment_late': return 'Payment is late'
    case 'assigned': return 'Contractor assigned'
    case 'rescheduled': return `${who} rescheduled`
    case 'refund': return 'Refund issued'
    case 'cancelled': return 'Customer cancelled'
    case 'extra_hours': return 'Extra hours added'
    case 'status': return e.to ? `${who}: ${statusName(e.to)}` : `${who} changed the status`
    case 'problem_reported': return 'Customer reported a problem'
    case 'problem_resolved': return 'Problem resolved'
    case 'review_added': return 'New review'
    case 'review_edited': return 'Review edited'
    default: return e.type.startsWith('quote_') ? `Quote ${e.type.slice(6)}` : e.type.replace(/_/g, ' ')
  }
}
function contractorLabel(s: string): string { return contractorStatusLabel[s as ContractorStatus] ?? s }
function contractorPill(s: string): string { return contractorStatusPill[s as ContractorStatus] ?? '' }
function ago(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const statusBars = computed(() => (data.value?.charts?.by_status ?? []).map((s) => ({ name: statusName(s.status), count: s.count })))
const ratingBars = computed(() => (data.value?.charts?.ratings ?? []).map((r) => ({ name: `${r.rating} star${r.rating === 1 ? '' : 's'}`, count: r.count })))
const allClear = computed(() => !!data.value && cards.value.length === 0 && data.value.attention.length > 0)
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>{{ greeting }}</h1><p>Here is how things stand across Synsyma.</p></div>
      <div class="tools">
        <div class="ranges" role="tablist" aria-label="Time range">
          <button v-for="r in RANGES" :key="r.key" type="button" role="tab" class="chip" :class="{ on: range === r.key }" :aria-selected="range === r.key" @click="setRange(r.key)">{{ r.label }}</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm refresh" :disabled="refreshing || loading" :aria-label="`Refresh. Updated ${updated}`" @click="load(true)">
          <RefreshCw :size="15" :class="{ spin: refreshing }" /> <span>{{ updated ? `Updated ${updated}` : 'Refresh' }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading && !data" class="stack"><span v-for="i in 4" :key="i" class="skeleton" style="height: 110px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load()">Try again</button></div></div>

    <template v-else-if="data">
      <!-- Needs attention -->
      <section v-if="data.attention.length" aria-labelledby="att-h" class="sec">
        <h2 id="att-h" class="sh">Needs attention</h2>
        <div v-if="cards.length" class="att">
          <RouterLink v-for="c in cards" :key="c.key" :to="c.to" class="acard card" :class="[c.tone, { flash: flash.has(c.key) }]">
            <span class="aico" aria-hidden="true"><component :is="c.icon" :size="20" /></span>
            <span class="atxt"><strong>{{ c.title }}</strong><small>{{ c.hint }}</small></span>
            <span class="acount">{{ c.count }}</span>
          </RouterLink>
        </div>
        <div v-else-if="allClear" class="card clear"><CheckCircle2 :size="22" /> <span>All clear. Nothing needs your attention right now.</span></div>
      </section>

      <!-- Numbers -->
      <section v-if="data.kpis.length" aria-labelledby="kpi-h" class="sec">
        <h2 id="kpi-h" class="sh">Overview <small>{{ RANGES.find((r) => r.key === range)?.label }}, compared with the {{ periodText }}</small></h2>
        <div class="kpis">
          <div v-for="k in data.kpis" :key="k.key" class="card kpi">
            <span class="kl">{{ k.label }}</span>
            <strong class="kv">{{ show(k) }}</strong>
            <span v-if="k.sub" class="kc flat">{{ k.sub }}</span>
            <span v-else-if="k.change !== null" class="kc" :class="tone(k)">
              <TrendingUp v-if="k.change > 0" :size="14" /><TrendingDown v-else-if="k.change < 0" :size="14" />
              {{ k.change > 0 ? '+' : '' }}{{ k.change }}%
            </span>
            <span v-else-if="k.previous !== null || k.key === 'owed'" class="kc flat">{{ k.key === 'owed' ? 'Right now' : 'No change' }}</span>
            <span v-else class="kc flat">Nothing to compare</span>
          </div>
        </div>
      </section>

      <!-- Charts -->
      <section v-if="data.charts && (data.charts.bookings || data.charts.revenue || data.charts.ratings)" aria-labelledby="ch-h" class="sec">
        <h2 id="ch-h" class="sh">Trends</h2>
        <div v-if="data.charts.bookings || data.charts.revenue" class="two">
          <div v-if="data.charts.bookings" class="card box"><h3>New bookings</h3><TrendChart :points="data.charts.bookings" title="New bookings" /></div>
          <div v-if="data.charts.revenue" class="card box"><h3>Revenue, net of refunds</h3><TrendChart :points="data.charts.revenue" format="money" title="Revenue" /></div>
        </div>
        <div class="three">
          <div v-if="data.charts.by_status" class="card box"><h3>Bookings by status</h3><BarList :items="statusBars" /></div>
          <div v-if="data.charts.services" class="card box"><h3>Top services</h3><BarList :items="data.charts.services" /></div>
          <div v-if="data.charts.areas" class="card box"><h3>Top areas</h3><BarList :items="data.charts.areas" /></div>
          <div v-if="data.charts.ratings" class="card box"><h3>Ratings</h3><BarList :items="ratingBars" empty="No reviews in this period." /></div>
        </div>
      </section>

      <!-- Today's board -->
      <section v-if="data.board" aria-labelledby="bd-h" class="sec">
        <h2 id="bd-h" class="sh">Today's jobs <small>{{ boardTotal }} scheduled</small></h2>
        <p v-if="!boardTotal" class="card note">No jobs scheduled for today.</p>
        <div v-else class="board">
          <div v-for="c in COLS" :key="c.key" class="col">
            <h3>{{ c.label }} <span class="n">{{ data.board[c.key]?.length ?? 0 }}</span></h3>
            <RouterLink v-for="j in data.board[c.key] ?? []" :key="j.id" :to="`/bookings/${j.id}`" class="job card" :class="{ bad: j.problem }">
              <span class="jt">{{ clock(j.starts_at) }}<span v-if="j.problem" class="pill red">Problem</span></span>
              <strong>{{ j.service }}</strong>
              <small>{{ j.city }}<template v-if="j.contractor"> · {{ j.contractor }}</template></small>
              <small class="ref">{{ j.reference }}</small>
            </RouterLink>
            <p v-if="!(data.board[c.key]?.length)" class="empty-col">None</p>
          </div>
        </div>
      </section>

      <!-- Newest people -->
      <section v-if="data.people && (data.people.customers || data.people.contractors)" aria-labelledby="pp-h" class="sec">
        <h2 id="pp-h" class="sh">Newest people</h2>
        <div class="two">
          <div v-if="data.people.customers" class="card ppl">
            <div class="ph"><h3>Newest customers</h3><RouterLink v-if="auth.can('users.view')" to="/users" class="all">View all</RouterLink></div>
            <p v-if="!data.people.customers.length" class="note">No customers yet.</p>
            <ul v-else>
              <li v-for="u in data.people.customers" :key="u.id">
                <RouterLink :to="`/users/${u.id}`">
                  <span class="av" aria-hidden="true">{{ initials(u.name) }}</span>
                  <span class="pt"><strong>{{ u.name }}</strong><small>{{ u.email }}</small></span>
                  <span v-if="!u.is_active" class="pill grey">Inactive</span>
                  <time class="fa" :datetime="u.created_at ?? undefined">{{ ago(u.created_at) }}</time>
                </RouterLink>
              </li>
            </ul>
          </div>
          <div v-if="data.people.contractors" class="card ppl">
            <div class="ph"><h3>Newest contractors</h3><RouterLink v-if="auth.can('contractors.view')" to="/contractors" class="all">View all</RouterLink></div>
            <p v-if="!data.people.contractors.length" class="note">No contractors yet.</p>
            <ul v-else>
              <li v-for="c in data.people.contractors" :key="c.id">
                <RouterLink :to="`/contractors/${c.id}`">
                  <span class="av" aria-hidden="true">{{ initials(c.name) }}</span>
                  <span class="pt"><strong>{{ c.name }}</strong><small>{{ c.type === 'company' ? 'Company' : 'Individual' }} · {{ c.location }}</small></span>
                  <span class="pill" :class="contractorPill(c.status)">{{ contractorLabel(c.status) }}</span>
                  <time class="fa" :datetime="c.created_at ?? undefined">{{ ago(c.created_at) }}</time>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Activity -->
      <section v-if="data.feed" aria-labelledby="fd-h" class="sec">
        <h2 id="fd-h" class="sh">Latest activity</h2>
        <div class="card feed">
          <p v-if="!data.feed.length" class="note">Nothing yet.</p>
          <ul v-else>
            <li v-for="e in data.feed" :key="e.id">
              <RouterLink :to="`/bookings/${e.booking_id}`">
                <span class="fd" :class="e.actor" aria-hidden="true" />
                <span class="ft"><strong>{{ describe(e) }}</strong><small>{{ e.reference }} · {{ e.service }}<template v-if="e.note"> · {{ e.note }}</template></small></span>
                <time class="fa" :datetime="e.at ?? undefined">{{ ago(e.at) }}</time>
              </RouterLink>
            </li>
          </ul>
        </div>
      </section>

      <p v-if="!data.attention.length && !data.kpis.length && !data.board && !data.feed" class="card note">Your role doesn't include any dashboard sections yet. Ask an admin to give you access to bookings, contractors, payouts or reviews.</p>
    </template>
  </div>
</template>

<style scoped>
.tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ranges { display: flex; gap: 6px; }
.refresh { display: inline-flex; align-items: center; gap: 6px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.stack { display: grid; gap: 14px; }
.sec { margin-bottom: 28px; }
.sh { margin: 0 0 12px; font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.sh small { margin-left: 8px; font-family: var(--font-body); font-weight: 500; font-size: 13px; color: var(--text-mute); }

.att { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); }
.acard { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: inherit; text-decoration: none; border-left: 4px solid var(--blue-ink); transition: transform 0.15s, box-shadow 0.15s; }
.acard:hover { transform: translateY(-2px); }
.acard.red { border-left-color: var(--danger); } .acard.amber { border-left-color: #e8a317; }
.aico { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 12px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.acard.red .aico { color: var(--danger); background: rgba(217, 45, 74, 0.1); } .acard.amber .aico { color: #b57a00; background: rgba(232, 163, 23, 0.16); }
.atxt { flex: 1; min-width: 0; } .atxt strong { display: block; font-size: 14.5px; } .atxt small { display: block; color: var(--text-mute); font-size: 12.5px; }
.acount { font: 700 24px var(--font-display); }
.acard.flash { animation: pulse 1.2s ease-out 2; } @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(0, 102, 255, 0.45); } 100% { box-shadow: 0 0 0 14px rgba(0, 102, 255, 0); } }
.clear { display: flex; align-items: center; gap: 10px; padding: 16px 18px; color: var(--green-ink); font-weight: 600; }

.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); }
.kpi { display: grid; gap: 4px; padding: 16px 18px; }
.kl { font-size: 13px; color: var(--text-mute); } .kv { font: 700 26px var(--font-display); letter-spacing: -0.02em; }
.kc { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 700; }
.kc.good { color: var(--green-ink); } .kc.bad { color: var(--danger); } .kc.flat { color: var(--text-mute); font-weight: 500; }

.two { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-bottom: 14px; }
.three { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.box { padding: 18px 20px; } .box h3 { margin: 0 0 12px; font-size: 14px; font-weight: 700; }
.note { padding: 18px 20px; color: var(--text-mute); margin: 0; }

.board { display: grid; gap: 12px; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); overflow-x: auto; padding-bottom: 6px; }
.col h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--text-dim); }
.n { min-width: 20px; padding: 0 6px; font-size: 12px; line-height: 20px; text-align: center; border-radius: 10px; background: rgba(4, 20, 59, 0.08); }
.job { display: grid; gap: 2px; margin-bottom: 8px; padding: 10px 12px; color: inherit; text-decoration: none; }
.job:hover { box-shadow: 0 8px 22px -12px rgba(4, 20, 59, 0.35); } .job.bad { border-color: rgba(217, 45, 74, 0.5); }
.jt { display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--blue-ink); font-size: 13px; }
.job small { color: var(--text-mute); } .job .ref { font-size: 11.5px; }
.empty-col { margin: 0; padding: 12px; font-size: 13px; color: var(--text-mute); text-align: center; border: 1px dashed var(--line); border-radius: 12px; }

.feed { padding: 6px 8px; } .feed ul { list-style: none; margin: 0; padding: 0; }
.feed li + li { border-top: 1px solid var(--line); }
.feed a { display: flex; align-items: center; gap: 12px; padding: 12px 10px; color: inherit; text-decoration: none; border-radius: 10px; }
.feed a:hover { background: rgba(0, 102, 255, 0.04); }
.fd { width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--blue-ink); } .fd.customer { background: #e8a317; } .fd.system { background: var(--text-mute); }
.ft { flex: 1; min-width: 0; } .ft strong { display: block; font-size: 14px; } .ft small { display: block; color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppl { padding: 6px 8px; }
.ppl .ph { display: flex; align-items: center; justify-content: space-between; padding: 12px 10px 6px; }
.ppl h3 { margin: 0; font-size: 14px; font-weight: 700; }
.ppl .all { font-size: 13px; font-weight: 600; color: var(--blue-ink); text-decoration: none; } .ppl .all:hover { text-decoration: underline; }
.ppl ul { list-style: none; margin: 0; padding: 0; } .ppl li + li { border-top: 1px solid var(--line); }
.ppl li a { display: flex; align-items: center; gap: 12px; padding: 10px; color: inherit; text-decoration: none; border-radius: 10px; }
.ppl li a:hover { background: rgba(0, 102, 255, 0.04); }
.av { display: grid; place-items: center; width: 34px; height: 34px; flex: none; font-size: 12px; font-weight: 700; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); border-radius: 50%; }
.pt { flex: 1; min-width: 0; } .pt strong { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pt small { display: block; color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fa { flex: none; font-size: 12.5px; color: var(--text-mute); }
@media (prefers-reduced-motion: reduce) { .acard.flash, .spin { animation: none; } .acard { transition: none; } }
</style>