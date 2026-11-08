<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, Loader2, Wallet } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import { money } from '@/lib/bookings'
import Modal from '@/components/ui/Modal.vue'
import type { LedgerEntry, PayoutContractor } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.can('payouts.manage'))
const id = String(route.params.id)

const d = ref<PayoutContractor | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'entries' | 'payouts'>('entries')

async function load() {
  loading.value = true; error.value = ''
  try { d.value = (await api.get<{ data: PayoutContractor }>(`/admin/payouts/contractors/${id}`)).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load this contractor.").message } finally { loading.value = false }
}
onMounted(load)

const cur = (v: number) => money(v, 'USD')
const stateLabel: Record<LedgerEntry['state'], string> = { paid: 'Paid', payable: 'Ready to pay', hold: 'On hold' }
const statePill: Record<LedgerEntry['state'], string> = { paid: 'grey', payable: 'green', hold: '' }
const rate = computed(() => d.value?.contractor.commission_percent ?? d.value?.default_commission_percent ?? 15)

// ---- record a payment ----
const pay = reactive({ open: false, saving: false, reference: '', note: '', errors: {} as Record<string, string>, error: '' })
function openPay() { Object.assign(pay, { open: true, saving: false, reference: '', note: '', errors: {}, error: '' }) }
async function submitPay() {
  if (!d.value) return
  pay.errors = {}; pay.error = ''
  if (pay.reference.trim().length < 2) { pay.errors.reference = 'Enter the bank or transfer reference for this payment.'; return }
  pay.saving = true
  try {
    const res = await api.post<{ message: string }>(`/admin/payouts/contractors/${id}/pay`, { amount: d.value.payable, reference: pay.reference.trim(), note: pay.note.trim() || null })
    toast.success(res.data.message); pay.open = false; await load()
  } catch (e) {
    const pe = parseError(e); pay.errors = pe.fields
    if (pe.fields.amount) { pay.error = pe.fields.amount; await load() } else if (!Object.keys(pe.fields).length) pay.error = pe.message
  } finally { pay.saving = false }
}
</script>

<template>
  <div>
    <button type="button" class="back" @click="router.push('/payouts')"><ArrowLeft :size="16" /> Payouts</button>

    <div v-if="loading && !d" class="skeleton" style="height: 220px" />
    <div v-else-if="error" class="card empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>

    <template v-else-if="d">
      <div class="page-head">
        <div><h1>{{ d.contractor.name }}</h1><p>{{ d.contractor.email || '—' }}<template v-if="d.contractor.phone"> · {{ d.contractor.phone }}</template> · Commission {{ rate }}%<template v-if="d.contractor.commission_percent === null"> (default)</template></p></div>
        <button v-if="canManage && d.payable > 0" type="button" class="btn btn-primary" @click="openPay"><Wallet :size="18" /> Record payment of {{ cur(d.payable) }}</button>
      </div>

      <div class="sum">
        <div class="card"><span>Ready to pay</span><strong :class="{ owe: d.payable < 0, ready: d.payable > 0 }">{{ cur(d.payable) }}</strong><small v-if="d.payable < 0">They owe us. It comes off their next payout.</small><small v-else>Past the hold period</small></div>
        <div class="card"><span>On hold</span><strong>{{ cur(d.on_hold) }}</strong><small>Still in the hold period</small></div>
        <div class="card"><span>Paid out</span><strong>{{ cur(d.paid) }}</strong><small>All time</small></div>
      </div>

      <div class="tabs" role="tablist"><button type="button" class="chip" role="tab" :class="{ on: tab === 'entries' }" :aria-selected="tab === 'entries'" @click="tab = 'entries'">Earnings</button><button type="button" class="chip" role="tab" :class="{ on: tab === 'payouts' }" :aria-selected="tab === 'payouts'" @click="tab = 'payouts'">Payments made</button></div>

      <div class="card">
        <template v-if="tab === 'entries'">
          <div v-if="!d.entries.length" class="empty"><p>No earnings yet.</p></div>
          <div v-else class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Job</th><th class="num">Customer paid</th><th class="num">Commission</th><th class="num">Contractor</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="e in d.entries" :key="e.id">
                  <td>
                    <RouterLink v-if="e.booking_id" :to="`/bookings/${e.booking_id}`" class="ref">{{ e.reference || 'Booking' }}</RouterLink>
                    <small>{{ e.type === 'adjustment' ? (e.note || 'Adjustment') : (e.service_name || 'Completed job') }}</small>
                  </td>
                  <td class="num">{{ e.type === 'earning' && e.gross !== null ? cur(e.gross) : '—' }}</td>
                  <td class="num">{{ e.type === 'earning' && e.gross !== null ? `${e.commission_percent}% · ${cur(e.gross - e.amount)}` : '—' }}</td>
                  <td class="num"><strong :class="{ owe: e.amount < 0 }">{{ e.amount < 0 ? '-' : '' }}{{ cur(Math.abs(e.amount)) }}</strong></td>
                  <td><span class="pill" :class="statePill[e.state]">{{ stateLabel[e.state] }}</span><small v-if="e.state === 'hold'">Ready {{ formatDateTime(e.payable_at) }}</small></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-else>
          <div v-if="!d.payouts.length" class="empty"><p>Nothing has been paid out yet.</p></div>
          <div v-else class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Date</th><th>Reference</th><th class="num">Amount</th><th>Recorded by</th></tr></thead>
              <tbody>
                <tr v-for="p in d.payouts" :key="p.id">
                  <td>{{ formatDateTime(p.paid_at) }}</td>
                  <td><strong>{{ p.reference }}</strong><small v-if="p.note">{{ p.note }}</small><small v-if="p.entries_count">{{ p.entries_count }} {{ p.entries_count === 1 ? 'entry' : 'entries' }}</small></td>
                  <td class="num"><strong>{{ cur(p.amount) }}</strong></td>
                  <td class="muted">{{ p.paid_by_name || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>

    <Modal :open="pay.open" title="Record a payment" :width="480" @close="pay.open = false">
      <form id="payout-pay" class="form" novalidate @submit.prevent="submitPay">
        <p v-if="pay.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ pay.error }}</p>
        <p class="lead">Send <strong>{{ d ? cur(d.payable) : '' }}</strong> to {{ d?.contractor.name }} from your bank or payment app first. Then record it here so the earnings are marked paid.</p>
        <div><label class="label" for="pp-ref">Bank or transfer reference</label><input id="pp-ref" v-model="pay.reference" class="input" :class="{ invalid: pay.errors.reference }" maxlength="120" placeholder="e.g. e-Transfer 8841209" autocomplete="off" /><p v-if="pay.errors.reference" class="err-text">{{ pay.errors.reference }}</p></div>
        <div><label class="label" for="pp-note">Note <span class="opt">(optional)</span></label><input id="pp-note" v-model="pay.note" class="input" maxlength="300" /></div>
        <p class="hint">This covers every earning that is ready to pay now. It cannot be undone.</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="pay.open = false">Cancel</button>
        <button type="submit" form="payout-pay" class="btn btn-primary" :disabled="pay.saving"><Loader2 v-if="pay.saving" :size="16" class="spin" /> I have sent it, record it</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; font-weight: 600; color: var(--text-dim); } .back:hover { color: var(--blue-ink); }
.sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
.sum .card { display: grid; gap: 4px; padding: 16px 18px; }
.sum span { color: var(--text-mute); font-size: 13px; font-weight: 600; }
.sum strong { font-size: 24px; font-family: var(--font-display); }
.sum small { color: var(--text-mute); font-size: 12px; }
@media (max-width: 760px) { .sum { grid-template-columns: 1fr; } }
.tabs { display: flex; gap: 8px; margin-bottom: 14px; }
td strong { display: block; } td small { display: block; color: var(--text-mute); }
td.num, th.num { text-align: right; white-space: nowrap; }
.ready { color: var(--syn-green-text); } .owe { color: var(--danger); }
.ref { font-weight: 700; color: var(--blue-ink); }
.muted { color: var(--text-mute); font-size: 14px; }
.form { display: grid; gap: 16px; } .lead { line-height: 1.5; } .opt { font-weight: 500; color: var(--text-mute); }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>