<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, Loader2, MapPin, Phone, User } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import { countryName } from '@/lib/regions'
import { eventActor, localWhen, money, statusLabel, statusPill } from '@/lib/bookings'
import Modal from '@/components/ui/Modal.vue'
import type { BookingDetail, BookingStatus, ContractorOption } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.can('bookings.manage'))
const id = String(route.params.id)

const b = ref<BookingDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const notes = ref('')
const savingNotes = ref(false)

async function load() {
  loading.value = true; error.value = ''
  try { b.value = (await api.get<{ data: BookingDetail }>(`/admin/bookings/${id}`)).data.data; notes.value = b.value.admin_notes ?? '' }
  catch (e) { error.value = parseError(e, "Couldn't load this booking.").message } finally { loading.value = false }
}
onMounted(load)

const cur = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : money(v, b.value?.currency ?? 'USD'))
const paymentLabel: Record<string, string> = { requires_payment: 'Not paid', succeeded: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Partly refunded' }

// ---- status changes ----
async function setStatus(status: BookingStatus, note?: string, refund?: RefundChoice): Promise<boolean> {
  busy.value = true
  try {
    const res = await api.patch<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/status`, { status, note, refund })
    b.value = res.data.data; toast.success(res.data.message); return true
  } catch (e) { const err = parseError(e); if (why.open) why.error = err.message; else toast.error(err.message); return false }
  finally { busy.value = false }
}
async function markConfirmed() {
  const yes = await confirm({ title: 'Mark as confirmed?', message: 'Card payments confirm a booking automatically. Only do this if you received payment another way.', confirmText: 'Mark confirmed', tone: 'primary' })
  if (yes) await setStatus('confirmed')
}
async function start() {
  const yes = await confirm({ title: 'Start this job?', message: 'Use this when the contractor has arrived and begun.', confirmText: 'Mark in progress', tone: 'primary' })
  if (yes) await setStatus('in_progress')
}
async function complete() {
  const yes = await confirm({ title: 'Mark as completed?', message: 'The job is finished. This cannot be undone.', confirmText: 'Mark completed', tone: 'primary' })
  if (yes) await setStatus('completed')
}
async function unassign() {
  const yes = await confirm({ title: 'Remove the contractor?', message: 'The booking goes back to "Needs contractor".', confirmText: 'Remove contractor', tone: 'danger' })
  if (yes) await setStatus('confirmed')
}

// ---- cancel (needs a reason) ----
type RefundChoice = 'none' | 'policy' | 'full'
const why = reactive({ open: false, text: '', error: '', saving: false, refund: 'none' as RefundChoice })
function askCancel() {
  const q = b.value?.cancel_quote
  Object.assign(why, { open: true, text: '', error: '', saving: false, refund: q && q.refund > 0 ? 'policy' : 'none' })
}
async function submitCancel() {
  if (why.text.trim().length < 3) { why.error = 'Give a short reason.'; return }
  why.saving = true
  const ok = await setStatus('cancelled', why.text.trim(), (b.value?.refundable ?? 0) > 0 ? why.refund : 'none')
  why.saving = false
  if (ok) why.open = false
}

// ---- reschedule ----
const rs = reactive({ open: false, value: '', note: '', error: '', saving: false })
function askReschedule() { Object.assign(rs, { open: true, value: (b.value?.starts_at_local ?? '').slice(0, 16), note: '', error: '', saving: false }) }
async function submitReschedule() {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rs.value)) { rs.error = 'Choose a date and time.'; return }
  rs.saving = true; rs.error = ''
  try {
    const res = await api.patch<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/reschedule`, { starts_at_local: rs.value, note: rs.note.trim() || undefined })
    b.value = res.data.data; toast.success(res.data.message); rs.open = false
  } catch (e) { rs.error = parseError(e).message } finally { rs.saving = false }
}

// ---- refund on its own ----
const rf = reactive({ open: false, amount: '', note: '', error: '', saving: false })
function askRefund() { Object.assign(rf, { open: true, amount: String(b.value?.refundable ?? ''), note: '', error: '', saving: false }) }
async function submitRefund() {
  const amt = Number(rf.amount)
  if (!amt || amt <= 0) { rf.error = 'Enter an amount.'; return }
  if (amt > (b.value?.refundable ?? 0)) { rf.error = `The most you can refund is ${cur(b.value?.refundable ?? 0)}.`; return }
  if (rf.note.trim().length < 3) { rf.error = 'Give a short reason.'; return }
  rf.saving = true; rf.error = ''
  try {
    const res = await api.post<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/refund`, { amount: amt, note: rf.note.trim() })
    b.value = res.data.data; toast.success(res.data.message); rf.open = false
  } catch (e) { rf.error = parseError(e).message } finally { rf.saving = false }
}

// ---- quote ----
const qt = reactive({ open: false, saving: false, price: '', days: 7, message: '', errors: {} as Record<string, string>, error: '' })
const quoteStateLabel: Record<string, string> = { requested: 'Waiting for your price', sent: 'Sent, waiting for the customer', expired: 'Expired', accepted: 'Accepted', closed: 'Closed' }
function openQuote() {
  const q = b.value?.quote
  Object.assign(qt, { open: true, saving: false, errors: {}, error: '', price: q?.price ? String(q.price) : '', days: 7, message: q?.message ?? '' })
}
async function submitQuote() {
  qt.errors = {}; qt.error = ''
  const n = Number(qt.price)
  if (!qt.price.trim() || !Number.isFinite(n) || n <= 0) { qt.errors.price = 'Enter the price for this job.'; return }
  qt.saving = true
  try {
    const res = await api.post<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/quote`, { price: n, valid_days: qt.days, message: qt.message.trim() || null })
    b.value = res.data.data; toast.success(res.data.message); qt.open = false
  } catch (e) { const pe = parseError(e); qt.errors = pe.fields; if (!Object.keys(pe.fields).length) qt.error = pe.message } finally { qt.saving = false }
}
async function withdrawQuote() {
  const yes = await confirm({ title: 'Withdraw this quote?', message: 'The customer can no longer accept it. The request stays open so you can send a new price.', confirmText: 'Withdraw quote', tone: 'danger' })
  if (!yes) return
  busy.value = true
  try { const res = await api.delete<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/quote`); b.value = res.data.data; toast.success(res.data.message) }
  catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}

// ---- assign ----
const assign = reactive({ open: false, loading: false, saving: false, error: '', picked: '', options: [] as ContractorOption[] })
async function openAssign() {
  Object.assign(assign, { open: true, loading: true, saving: false, error: '', picked: b.value?.contractor_id ?? '', options: [] })
  try { assign.options = (await api.get<{ data: ContractorOption[] }>(`/admin/bookings/${id}/contractor-options`)).data.data }
  catch (e) { assign.error = parseError(e, "Couldn't load contractors.").message } finally { assign.loading = false }
}
async function submitAssign() {
  if (!assign.picked) { assign.error = 'Choose a contractor.'; return }
  assign.saving = true; assign.error = ''
  try {
    const res = await api.patch<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/assign`, { contractor_id: assign.picked })
    b.value = res.data.data; toast.success(res.data.message); assign.open = false
  } catch (e) { assign.error = parseError(e).message } finally { assign.saving = false }
}

// ---- private notes ----
async function saveNotes() {
  savingNotes.value = true
  try { const r = await api.patch<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/notes`, { admin_notes: notes.value }); b.value = r.data.data; toast.success(r.data.message) }
  catch (e) { toast.error(parseError(e).message) } finally { savingNotes.value = false }
}
</script>

<template>
  <div>
    <button type="button" class="back" @click="router.push('/bookings')"><ArrowLeft :size="16" /> Bookings</button>

    <div v-if="loading && !b" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 48px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <template v-else-if="b">
      <div class="page-head">
        <div>
          <h1>{{ b.service_name }}<template v-if="b.tier"> · {{ b.tier }}</template> <span class="pill" :class="statusPill[b.status]">{{ statusLabel[b.status] }}</span></h1>
          <p>{{ b.reference }} · booked {{ formatDateTime(b.created_at) }}</p>
        </div>
        <div v-if="canManage" class="acts">
          <button v-if="b.status === 'quote_requested' || (b.status === 'quote_sent' && b.quote)" type="button" class="btn btn-primary" :disabled="busy" @click="openQuote">{{ b.status === 'quote_sent' ? 'Revise quote' : 'Send quote' }}</button>
          <button v-if="b.status === 'quote_sent'" type="button" class="btn btn-ghost" :disabled="busy" @click="withdrawQuote">Withdraw quote</button>
          <button v-if="b.status === 'pending_payment'" type="button" class="btn btn-primary" :disabled="busy" @click="markConfirmed">Mark confirmed</button>
          <button v-if="b.status === 'confirmed'" type="button" class="btn btn-primary" :disabled="busy" @click="openAssign">Assign contractor</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-primary" :disabled="busy" @click="start">Start job</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-ghost" :disabled="busy" @click="openAssign">Reassign</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-ghost" :disabled="busy" @click="unassign">Remove contractor</button>
          <button v-if="b.status === 'in_progress'" type="button" class="btn btn-primary" :disabled="busy" @click="complete">Mark completed</button>
          <button v-if="['pending_payment', 'confirmed', 'assigned'].includes(b.status)" type="button" class="btn btn-ghost" :disabled="busy" @click="askReschedule">Reschedule</button>
          <button v-if="b.refundable > 0" type="button" class="btn btn-ghost" :disabled="busy" @click="askRefund">Refund…</button>
          <button v-if="['pending_payment', 'confirmed', 'assigned', 'in_progress', 'quote_requested', 'quote_sent'].includes(b.status)" type="button" class="btn btn-ghost danger" :disabled="busy" @click="askCancel">Cancel booking</button>
        </div>
      </div>

      <p v-if="b.status === 'confirmed'" class="note ok" role="status">This booking is confirmed and waiting for a contractor.</p>

      <div class="grid">
        <section v-if="b.quote" class="card box wide">
          <h2>Quote</h2>
          <dl>
            <dt>State</dt><dd><span class="pill" :class="{ green: b.quote.state === 'accepted', grey: b.quote.state === 'closed' || b.quote.state === 'expired' }">{{ quoteStateLabel[b.quote.state] }}</span></dd>
            <template v-if="b.quote.price_label"><dt>Price</dt><dd><strong>{{ b.quote.price_label }}</strong><small>Before any extras, no tax added</small></dd></template>
            <template v-if="b.quote.sent_at"><dt>Sent</dt><dd>{{ formatDateTime(b.quote.sent_at) }}</dd></template>
            <template v-if="b.quote.expires_at"><dt>{{ b.quote.state === 'expired' ? 'Expired' : 'Open until' }}</dt><dd>{{ formatDateTime(b.quote.expires_at) }}</dd></template>
            <template v-if="b.quote.accepted_at"><dt>Accepted</dt><dd>{{ formatDateTime(b.quote.accepted_at) }}</dd></template>
            <template v-if="b.quote.message"><dt>Your message</dt><dd class="pre">{{ b.quote.message }}</dd></template>
          </dl>
          <p v-if="b.quote.state === 'requested'" class="muted hint">Read the customer's notes below, then use Send quote to set the price. They accept it in the app and pay.</p>
        </section>

        <section class="card box">
          <h2>The job</h2>
          <dl>
            <dt>When</dt><dd>{{ localWhen(b.starts_at_local) }}<small>{{ b.timezone }} (customer's local time)</small></dd>
            <dt>Service</dt><dd>{{ b.service_name }}<small>{{ b.category_name }}</small></dd>
            <dt>Pricing</dt><dd>
              <template v-if="b.price_type === 'hourly'">Hourly: {{ cur(b.base_price) }} covers the first {{ b.included_hours }} hours, then {{ cur(b.additional_hour_price) }} per added hour</template>
              <template v-else-if="b.price_type === 'fixed'">Fixed price</template>
              <template v-else>Quote<template v-if="b.quote?.price_label">: {{ b.quote.price_label }}</template></template>
            </dd>
            <template v-if="b.extra_hours > 0"><dt>Extra hours</dt><dd>{{ b.extra_hours }} added by the customer</dd></template>
            <template v-if="b.reschedule_count > 0"><dt>Rescheduled</dt><dd>{{ b.reschedule_count }} {{ b.reschedule_count === 1 ? 'time' : 'times' }} by the customer</dd></template>
            <dt>Customer notes</dt><dd>{{ b.notes || 'None' }}</dd>
          </dl>
        </section>

        <section class="card box">
          <h2>Customer</h2>
          <dl>
            <dt><User :size="14" /> Name</dt><dd>{{ b.customer_name }}</dd>
            <dt>Email</dt><dd><a v-if="b.customer_email" :href="`mailto:${b.customer_email}`">{{ b.customer_email }}</a><template v-else>—</template></dd>
            <dt><Phone :size="14" /> Phone</dt><dd><a v-if="b.customer_phone" :href="`tel:${b.customer_phone}`">{{ b.customer_phone }}</a><template v-else>—</template></dd>
            <dt><MapPin :size="14" /> Address</dt><dd>{{ b.address_line1 }}<template v-if="b.address_line2">, {{ b.address_line2 }}</template><br />{{ b.city }}, {{ b.region }} {{ b.postal_code }}<br />{{ countryName(b.country) }}<small v-if="b.instructions">Access: {{ b.instructions }}</small></dd>
          </dl>
        </section>

        <section class="card box">
          <h2>Price</h2>
          <dl>
            <dt>Subtotal</dt><dd>{{ cur(b.subtotal) }}</dd>
            <dt>Discount</dt><dd>{{ Number(b.discount_total) ? `−${cur(b.discount_total)}` : '—' }}<small v-if="b.promo_code">Code {{ b.promo_code }}</small></dd>
            <dt>Tax</dt><dd>{{ Number(b.tax_total) ? cur(b.tax_total) : '—' }}</dd>
            <dt>Total</dt><dd><strong>{{ b.price_type === 'quote' ? 'Quote' : cur(b.total) }}</strong></dd>
          </dl>
          <h3>Payments</h3>
          <template v-if="b.payments?.length">
            <dl v-for="(pm, i) in b.payments" :key="pm.id" :class="{ sep: i > 0 }">
              <dt>For</dt><dd>{{ pm.purpose === 'extra_hours' ? `${pm.hours} extra ${pm.hours === 1 ? 'hour' : 'hours'}` : 'The booking' }} · {{ cur(pm.amount) }}</dd>
              <dt>Status</dt><dd>{{ paymentLabel[pm.status] ?? pm.status }}</dd>
              <dt>Paid</dt><dd>{{ pm.paid_at ? formatDateTime(pm.paid_at) : '—' }}</dd>
              <dt>Method</dt><dd>{{ pm.provider === 'paypal' ? 'PayPal' : pm.card_last4 ? `${(pm.card_brand ?? 'Card').toUpperCase()} •••• ${pm.card_last4}` : '—' }}</dd>
              <template v-if="Number(pm.refunded_total)"><dt>Refunded</dt><dd>{{ cur(pm.refunded_total) }}</dd></template>
              <template v-if="pm.failure_message"><dt>Last error</dt><dd>{{ pm.failure_message }}</dd></template>
              <template v-if="pm.stripe_payment_intent_id"><dt>Reference</dt><dd><small>{{ pm.stripe_payment_intent_id }}</small></dd></template>
            </dl>
          </template>
          <p v-else class="muted">No payment attempt yet.</p>
          <template v-if="b.ledger">
            <h3>Contractor earnings</h3>
            <dl>
              <dt>Customer paid</dt><dd>{{ cur(b.ledger.customer_paid) }}</dd>
              <dt>Commission</dt><dd>{{ b.ledger.commission_percent }}%</dd>
              <dt>Contractor share</dt><dd><strong>{{ cur(b.ledger.contractor_share) }}</strong></dd>
              <dt>Payout</dt><dd>{{ b.ledger.state === 'paid' ? 'Paid' : b.ledger.state === 'payable' ? 'Ready to pay' : `On hold until ${formatDateTime(b.ledger.payable_at)}` }}</dd>
            </dl>
          </template>
        </section>

        <section class="card box">
          <h2>Contractor</h2>
          <template v-if="b.contractor_id">
            <p><router-link :to="`/contractors/${b.contractor_id}`" class="lnk">{{ b.contractor_name }}</router-link></p>
            <p class="muted">Assigned {{ formatDateTime(b.assigned_at) }}</p>
          </template>
          <p v-else class="muted">No contractor assigned yet.</p>
          <h3>Private notes</h3>
          <textarea v-model="notes" class="input ta" rows="3" maxlength="2000" :readonly="!canManage" aria-label="Private notes" placeholder="Only admins see this." />
          <button v-if="canManage" type="button" class="btn btn-ghost btn-sm save" :disabled="savingNotes || notes === (b.admin_notes ?? '')" @click="saveNotes"><Loader2 v-if="savingNotes" :size="15" class="spin" /> Save notes</button>
        </section>

        <section class="card box wide">
          <h2>Timeline</h2>
          <ol class="tl">
            <li v-for="e in [...b.events].reverse()" :key="e.id">
              <strong>
                <template v-if="e.type === 'created'">Booking created</template>
                <template v-else-if="e.type === 'assigned'">Assigned to {{ e.note }}</template>
                <template v-else-if="e.type === 'rescheduled'">Rescheduled</template>
                <template v-else-if="e.type === 'quote_sent'">Quote sent</template>
                <template v-else-if="e.type === 'quote_revised'">Quote revised</template>
                <template v-else-if="e.type === 'quote_withdrawn'">Quote withdrawn</template>
                <template v-else-if="e.type === 'quote_accepted'">Quote accepted</template>
                <template v-else-if="e.type === 'quote_declined'">Quote declined</template>
                <template v-else-if="e.type === 'quote_expired'">Quote expired</template>
                <template v-else-if="e.type === 'extra_hours'">Extra hours added</template>
                <template v-else-if="e.type === 'refund'">Refund</template>
                <template v-else-if="e.type === 'payment_failed'">Payment failed</template>
                <template v-else-if="e.type === 'payment_late'">Late payment refunded</template>
                <template v-else-if="e.type === 'payment_received'">Payment received</template>
                <template v-else-if="e.to_status">{{ statusLabel[e.to_status] }}</template>
                <template v-else>Note</template>
              </strong>
              <small>{{ eventActor[e.actor] }} · {{ formatDateTime(e.created_at) }}</small>
              <span v-if="e.note && e.type !== 'assigned'" class="why">{{ e.note }}</span>
            </li>
          </ol>
        </section>
      </div>

      <Modal :open="assign.open" title="Assign a contractor" :width="560" @close="assign.open = false">
        <div v-if="assign.loading"><span v-for="i in 3" :key="i" class="skeleton" style="height: 56px; margin-bottom: 10px" /></div>
        <p v-else-if="!assign.options.length && !assign.error" class="muted">No approved contractor offers {{ b.category_name || 'this category' }} yet. Check Contractors, or add one first.</p>
        <fieldset v-else class="opts">
          <legend class="sr-only">Contractors</legend>
          <label v-for="o in assign.options" :key="o.id" class="opt" :class="{ on: assign.picked === o.id }">
            <input v-model="assign.picked" type="radio" name="contractor" :value="o.id" />
            <span class="ob"><strong>{{ o.name }}</strong><small>{{ o.type === 'company' ? 'Company' : 'Individual' }} · {{ o.phone }}</small></span>
            <span class="pill" :class="o.covers_area ? 'green' : 'grey'">{{ o.covers_area ? 'Covers this area' : 'Other area' }}</span>
          </label>
        </fieldset>
        <p v-if="assign.error" class="err-text">{{ assign.error }}</p>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="assign.open = false">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="assign.saving || assign.loading || !assign.picked" @click="submitAssign"><Loader2 v-if="assign.saving" :size="16" class="spin" /> Assign</button>
        </template>
      </Modal>

      <Modal :open="why.open" title="Cancel this booking" :width="460" @close="why.open = false">
        <form id="cancel-form" novalidate @submit.prevent="submitCancel">
          <label class="label" for="why">Reason <span class="muted">(kept on record)</span></label>
          <textarea id="why" v-model="why.text" class="input ta" rows="3" maxlength="300" :class="{ invalid: why.error }" />
          <fieldset v-if="b.refundable > 0" class="rf">
            <legend class="label">Refund the customer</legend>
            <label v-if="b.cancel_quote"><input v-model="why.refund" type="radio" value="policy"> Per policy: {{ cur(b.cancel_quote.refund) }}<small>{{ b.cancel_quote.message }}</small></label>
            <label><input v-model="why.refund" type="radio" value="full"> Full refund: {{ cur(b.refundable) }}</label>
            <label><input v-model="why.refund" type="radio" value="none"> No refund</label>
          </fieldset>
          <p v-if="why.error" class="err-text">{{ why.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="why.open = false">Keep booking</button>
          <button type="submit" form="cancel-form" class="btn btn-danger" :disabled="why.saving"><Loader2 v-if="why.saving" :size="16" class="spin" /> Cancel booking</button>
        </template>
      </Modal>

      <Modal :open="qt.open" :title="b.status === 'quote_sent' ? 'Revise the quote' : 'Send a quote'" :width="480" @close="qt.open = false">
        <form id="quote-form" novalidate @submit.prevent="submitQuote">
          <p v-if="qt.error" class="err-text">{{ qt.error }}</p>
          <p class="muted">The customer sees this price in the app and can accept or decline. Accepting lets them pay straight away. Prices are in {{ b.currency }} with no tax added.</p>
          <label class="label" for="qt-price">Price ({{ b.currency }})</label>
          <input id="qt-price" v-model="qt.price" class="input" :class="{ invalid: qt.errors.price }" inputmode="decimal" placeholder="e.g. 480.00" autocomplete="off">
          <p v-if="qt.errors.price" class="err-text">{{ qt.errors.price }}</p>
          <label class="label" for="qt-days">Stays open for</label>
          <select id="qt-days" v-model.number="qt.days" class="select"><option :value="3">3 days</option><option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option></select>
          <p v-if="qt.errors.valid_days" class="err-text">{{ qt.errors.valid_days }}</p>
          <label class="label" for="qt-msg">Message to the customer <span class="muted">(optional)</span></label>
          <textarea id="qt-msg" v-model="qt.message" class="input ta" rows="4" maxlength="1000" placeholder="What the price covers, how long it should take, anything you need from them" />
          <p v-if="qt.errors.message" class="err-text">{{ qt.errors.message }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="qt.open = false">Cancel</button>
          <button type="submit" form="quote-form" class="btn btn-primary" :disabled="qt.saving"><Loader2 v-if="qt.saving" :size="16" class="spin" /> {{ b.status === 'quote_sent' ? 'Send revised quote' : 'Send quote' }}</button>
        </template>
      </Modal>

      <Modal :open="rs.open" title="Reschedule this booking" :width="440" @close="rs.open = false">
        <form id="reschedule-form" novalidate @submit.prevent="submitReschedule">
          <p class="muted">Times are in the customer's local time ({{ b.timezone }}). The contractor, if any, stays assigned, so tell them about the change.</p>
          <label class="label" for="rs-when">New date and time</label>
          <input id="rs-when" v-model="rs.value" type="datetime-local" step="900" class="input" :class="{ invalid: rs.error }">
          <label class="label" for="rs-note">Note <span class="muted">(kept on record)</span></label>
          <textarea id="rs-note" v-model="rs.note" class="input ta" rows="2" maxlength="300" />
          <p v-if="rs.error" class="err-text">{{ rs.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="rs.open = false">Close</button>
          <button type="submit" form="reschedule-form" class="btn btn-primary" :disabled="rs.saving"><Loader2 v-if="rs.saving" :size="16" class="spin" /> Reschedule</button>
        </template>
      </Modal>

      <Modal :open="rf.open" title="Refund this booking" :width="440" @close="rf.open = false">
        <form id="refund-form" novalidate @submit.prevent="submitRefund">
          <p class="muted">Paid {{ cur(b.payment?.amount) }}. You can refund up to {{ cur(b.refundable) }}. The money goes back to the customer's card through Stripe.</p>
          <label class="label" for="rf-amt">Amount</label>
          <input id="rf-amt" v-model="rf.amount" class="input" inputmode="decimal" :class="{ invalid: rf.error }">
          <label class="label" for="rf-note">Reason <span class="muted">(kept on record)</span></label>
          <textarea id="rf-note" v-model="rf.note" class="input ta" rows="2" maxlength="300" />
          <p v-if="rf.error" class="err-text">{{ rf.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="rf.open = false">Close</button>
          <button type="submit" form="refund-form" class="btn btn-danger" :disabled="rf.saving"><Loader2 v-if="rf.saving" :size="16" class="spin" /> Refund</button>
        </template>
      </Modal>
    </template>
  </div>
</template>

<style scoped>
dl.sep { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.rf { border: 0; padding: 0; margin: 14px 0 0; display: grid; gap: 8px; }
.rf label { display: block; font-size: 14px; }
.rf small { display: block; margin-left: 22px; color: var(--text-mute); }
.pad { padding: 16px; }
.back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; font-weight: 600; color: var(--text-dim); }
.back:hover { color: var(--blue-ink); }
.page-head h1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.danger { color: var(--danger); }
.note { margin-bottom: 16px; padding: 12px 14px; font-size: 14px; border-radius: 12px; }
.note.ok { background: rgba(0, 102, 255, 0.07); border: 1px solid rgba(0, 102, 255, 0.25); }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; align-items: start; }
.wide { grid-column: 1 / -1; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
.box { padding: 20px; }
.box h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.box h3 { margin: 16px 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-mute); }
dl { display: grid; grid-template-columns: 120px 1fr; gap: 10px 14px; margin: 0; }
dt { color: var(--text-mute); font-size: 14px; display: flex; align-items: flex-start; gap: 5px; } dd { margin: 0; overflow-wrap: anywhere; }
dd small { display: block; color: var(--text-mute); }
dd a, .lnk { color: var(--blue-ink); text-decoration: none; } dd a:hover, .lnk:hover { text-decoration: underline; }
.muted { color: var(--text-mute); font-size: 14px; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.save { margin-top: 8px; }
.tl { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 2px solid var(--line); display: grid; gap: 16px; }
.tl li { position: relative; }
.tl li::before { content: ''; position: absolute; left: -24px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--blue); }
.tl strong { display: block; } .tl small { color: var(--text-mute); }
.why { display: block; margin-top: 4px; font-size: 14px; color: var(--text-dim); }
.opts { border: 0; padding: 0; margin: 0; display: grid; gap: 10px; }
.opt { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 14px; cursor: pointer; }
.opt.on { border-color: var(--blue); background: rgba(0, 102, 255, 0.05); }
.opt input { accent-color: var(--blue); width: 18px; height: 18px; }
.ob { flex: 1; min-width: 0; } .ob strong { display: block; } .ob small { color: var(--text-mute); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.pre { white-space: pre-wrap; line-height: 1.5; }
.hint { margin-top: 12px; }
</style>