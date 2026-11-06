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

// ---- status changes ----
async function setStatus(status: BookingStatus, note?: string): Promise<boolean> {
  busy.value = true
  try {
    const res = await api.patch<{ message: string; data: BookingDetail }>(`/admin/bookings/${id}/status`, { status, note })
    b.value = res.data.data; toast.success(res.data.message); return true
  } catch (e) { const err = parseError(e); if (why.open) why.error = err.message; else toast.error(err.message); return false }
  finally { busy.value = false }
}
async function markConfirmed() {
  const yes = await confirm({ title: 'Mark as confirmed?', message: 'Online payment is not connected yet. Only do this if you have the payment, for example while testing.', confirmText: 'Mark confirmed', tone: 'primary' })
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
const why = reactive({ open: false, text: '', error: '', saving: false })
function askCancel() { Object.assign(why, { open: true, text: '', error: '', saving: false }) }
async function submitCancel() {
  if (why.text.trim().length < 3) { why.error = 'Give a short reason.'; return }
  why.saving = true
  const ok = await setStatus('cancelled', why.text.trim())
  why.saving = false
  if (ok) why.open = false
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
          <button v-if="b.status === 'pending_payment'" type="button" class="btn btn-primary" :disabled="busy" @click="markConfirmed">Mark confirmed</button>
          <button v-if="b.status === 'confirmed'" type="button" class="btn btn-primary" :disabled="busy" @click="openAssign">Assign contractor</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-primary" :disabled="busy" @click="start">Start job</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-ghost" :disabled="busy" @click="openAssign">Reassign</button>
          <button v-if="b.status === 'assigned'" type="button" class="btn btn-ghost" :disabled="busy" @click="unassign">Remove contractor</button>
          <button v-if="b.status === 'in_progress'" type="button" class="btn btn-primary" :disabled="busy" @click="complete">Mark completed</button>
          <button v-if="['pending_payment', 'confirmed', 'assigned', 'in_progress', 'quote_requested', 'quote_sent'].includes(b.status)" type="button" class="btn btn-ghost danger" :disabled="busy" @click="askCancel">Cancel booking</button>
        </div>
      </div>

      <p v-if="b.status === 'confirmed'" class="note ok" role="status">This booking is confirmed and waiting for a contractor.</p>

      <div class="grid">
        <section class="card box">
          <h2>The job</h2>
          <dl>
            <dt>When</dt><dd>{{ localWhen(b.starts_at_local) }}<small>{{ b.timezone }} (customer's local time)</small></dd>
            <dt>Service</dt><dd>{{ b.service_name }}<small>{{ b.category_name }}</small></dd>
            <dt>Pricing</dt><dd>
              <template v-if="b.price_type === 'hourly'">Hourly: {{ cur(b.base_price) }} covers the first {{ b.included_hours }} hours, then {{ cur(b.additional_hour_price) }} per added hour</template>
              <template v-else-if="b.price_type === 'fixed'">Fixed price</template>
              <template v-else>Quote</template>
            </dd>
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
          <p v-if="why.error" class="err-text">{{ why.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="why.open = false">Keep booking</button>
          <button type="submit" form="cancel-form" class="btn btn-danger" :disabled="why.saving"><Loader2 v-if="why.saving" :size="16" class="spin" /> Cancel booking</button>
        </template>
      </Modal>
    </template>
  </div>
</template>

<style scoped>
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
</style>