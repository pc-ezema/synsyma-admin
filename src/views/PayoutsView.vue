<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, ChevronRight, Download, Loader2, Search, Settings, Wallet } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import { money } from '@/lib/bookings'
import Modal from '@/components/ui/Modal.vue'
import type { PageMeta, PayoutRow, PayoutSettings, PayoutShow, PayoutTotals } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.can('payouts.manage'))

const rows = ref<PayoutRow[]>([])
const meta = ref<PageMeta | null>(null)
const totals = ref<PayoutTotals | null>(null)
const settings = ref<PayoutSettings | null>(null)
const loading = ref(true)
const error = ref('')
const exporting = ref(false)
const search = ref('')
const show = ref<PayoutShow>('')
const page = ref(1)
let t: number | undefined

const tabs: { key: PayoutShow; label: string }[] = [{ key: '', label: 'All' }, { key: 'owed', label: 'Ready to pay' }, { key: 'recover', label: 'Owe us' }]

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: PayoutRow[]; meta: PageMeta; totals: PayoutTotals; settings: PayoutSettings }>('/admin/payouts', { params: { search: search.value.trim() || undefined, show: show.value || undefined, page: page.value, per_page: 15 } })
    rows.value = data.data; meta.value = data.meta; totals.value = data.totals; settings.value = data.settings
  } catch (e) { error.value = parseError(e, "Couldn't load payouts.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))
function refilter() { page.value = 1; load() }
function onSearch() { window.clearTimeout(t); t = window.setTimeout(refilter, 300) }
function setShow(s: PayoutShow) { show.value = s; refilter() }
function go(p: number) { page.value = p; load() }
const cur = (v: number) => money(v, 'USD')

async function exportCsv() {
  exporting.value = true
  try {
    const res = await api.get<Blob>('/admin/payouts/export', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `synsyma-payouts-ready-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  } catch (e) { toast.error(parseError(e, "Couldn't export.").message) } finally { exporting.value = false }
}

// ---- settings ----
const set = reactive({ open: false, saving: false, commission: '', hold: '', errors: {} as Record<string, string>, error: '' })
function openSettings() {
  Object.assign(set, { open: true, saving: false, commission: String(settings.value?.default_commission_percent ?? 15), hold: String(settings.value?.hold_days ?? 3), errors: {}, error: '' })
}
async function saveSettings() {
  set.errors = {}; set.error = ''
  const c = Number(set.commission), h = Number(set.hold)
  if (set.commission.trim() === '' || !Number.isFinite(c) || c < 0 || c > 100) set.errors.default_commission_percent = 'Enter a percentage from 0 to 100.'
  if (set.hold.trim() === '' || !Number.isInteger(h) || h < 0 || h > 60) set.errors.hold_days = 'Enter a whole number of days from 0 to 60.'
  if (Object.keys(set.errors).length) return
  set.saving = true
  try {
    const res = await api.put<{ message: string; data: PayoutSettings }>('/admin/payouts/settings', { default_commission_percent: c, hold_days: h })
    settings.value = res.data.data; toast.success(res.data.message); set.open = false
  } catch (e) {
    const pe = parseError(e); set.errors = pe.fields
    if (!Object.keys(pe.fields).length) set.error = pe.message
  } finally { set.saving = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Payouts</h1><p>What each contractor has earned. You send the money yourself, then record it here.</p></div>
      <div class="head-actions">
        <button v-if="canManage" type="button" class="btn btn-ghost" @click="openSettings"><Settings :size="18" /> Settings</button>
        <button type="button" class="btn btn-ghost" :disabled="exporting || !totals?.payable" @click="exportCsv"><Loader2 v-if="exporting" :size="16" class="spin" /><Download v-else :size="18" /> Export CSV</button>
      </div>
    </div>

    <div v-if="totals" class="sum">
      <div class="card"><span>Ready to pay</span><strong>{{ cur(totals.payable) }}</strong><small>Past the {{ settings?.hold_days ?? 3 }}-day hold</small></div>
      <div class="card"><span>On hold</span><strong>{{ cur(totals.on_hold) }}</strong><small>Earned, still in the hold period</small></div>
      <div class="card"><span>Paid out</span><strong>{{ cur(totals.paid) }}</strong><small>All time</small></div>
      <div class="card"><span>Commission</span><strong>{{ settings?.default_commission_percent ?? 15 }}%</strong><small>Default, unless a contractor has their own</small></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter">
      <button v-for="tb in tabs" :key="tb.key" type="button" class="chip" role="tab" :class="{ on: show === tb.key }" :aria-selected="show === tb.key" @click="setShow(tb.key)">{{ tb.label }}</button>
    </div>

    <div class="card">
      <div class="bar"><label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search by name or email" aria-label="Search contractors" @input="onSearch" /></label></div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Wallet :size="30" /><p>{{ search || show ? 'No contractors match these filters.' : 'No earnings yet. They appear here when an assigned job is marked completed.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Contractor</th><th class="num">Ready to pay</th><th class="num">On hold</th><th class="num">Paid out</th><th>Last paid</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.contractor_id" class="click" tabindex="0" @click="router.push(`/payouts/${r.contractor_id}`)" @keydown.enter="router.push(`/payouts/${r.contractor_id}`)">
              <td><strong>{{ r.name }}</strong><small>{{ r.email || r.phone || '—' }}</small></td>
              <td class="num"><strong :class="{ owe: r.payable < 0, ready: r.payable > 0 }">{{ cur(r.payable) }}</strong><small v-if="r.payable < 0">Owes us</small></td>
              <td class="num">{{ cur(r.on_hold) }}</td>
              <td class="num">{{ cur(r.paid) }}</td>
              <td class="muted">{{ r.last_paid_at ? formatDateTime(r.last_paid_at) : 'Never' }}</td>
              <td class="chev"><ChevronRight :size="18" /></td>
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

    <Modal :open="set.open" title="Payout settings" :width="460" @close="set.open = false">
      <form id="payout-settings" class="form" novalidate @submit.prevent="saveSettings">
        <p v-if="set.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ set.error }}</p>
        <div><label class="label" for="ps-c">Default commission (%)</label><input id="ps-c" v-model="set.commission" class="input" :class="{ invalid: set.errors.default_commission_percent }" inputmode="decimal" /><p v-if="set.errors.default_commission_percent" class="err-text">{{ set.errors.default_commission_percent }}</p><p v-else class="hint">What Synsyma keeps from each job. A contractor with their own percentage on their profile uses that instead.</p></div>
        <div><label class="label" for="ps-h">Hold period (days)</label><input id="ps-h" v-model="set.hold" class="input" :class="{ invalid: set.errors.hold_days }" inputmode="numeric" /><p v-if="set.errors.hold_days" class="err-text">{{ set.errors.hold_days }}</p><p v-else class="hint">How long after a job is completed before the earnings are ready to pay. This covers disputes and refunds.</p></div>
        <p class="hint">Changes apply to jobs completed from now on. Earnings already worked out keep the rate they were created with.</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="set.open = false">Cancel</button>
        <button type="submit" form="payout-settings" class="btn btn-primary" :disabled="set.saving"><Loader2 v-if="set.saving" :size="16" class="spin" /> Save settings</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.head-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.sum .card { display: grid; gap: 4px; padding: 16px 18px; }
.sum span { color: var(--text-mute); font-size: 13px; font-weight: 600; }
.sum strong { font-size: 24px; font-family: var(--font-display); }
.sum small { color: var(--text-mute); font-size: 12px; }
@media (max-width: 900px) { .sum { grid-template-columns: repeat(2, 1fr); } }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; } .tabs .chip { white-space: nowrap; }
.bar { display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
td strong { display: block; } td small { display: block; color: var(--text-mute); }
td.num, th.num { text-align: right; white-space: nowrap; }
.ready { color: var(--syn-green-text); } .owe { color: var(--danger); }
.muted { color: var(--text-mute); font-size: 14px; }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(4, 20, 59, 0.03); } .chev { color: var(--text-mute); width: 32px; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
.form { display: grid; gap: 16px; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>