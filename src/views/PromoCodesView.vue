<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Loader2, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { PageMeta, PromoCode, PromoState } from '@/types'

type StateFilter = '' | PromoState

const auth = useAuthStore()
const canCreate = computed(() => auth.can('promos.create'))
const canUpdate = computed(() => auth.can('promos.update'))
const canDelete = computed(() => auth.can('promos.delete'))

const rows = ref<PromoCode[]>([])
const meta = ref<PageMeta | null>(null)
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)
const search = ref('')
const state = ref<StateFilter>('')
const page = ref(1)
let t: number | undefined

const tabs: { key: StateFilter; label: string }[] = [
  { key: '', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'scheduled', label: 'Scheduled' }, { key: 'expired', label: 'Expired' }, { key: 'off', label: 'Switched off' },
]
const stateLabel: Record<PromoState, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', off: 'Off' }
const statePill: Record<PromoState, string> = { active: 'green', scheduled: '', expired: 'grey', off: 'grey' }

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: PromoCode[]; meta: PageMeta }>('/admin/promo-codes', { params: { search: search.value.trim() || undefined, state: state.value || undefined, page: page.value, per_page: 15 } })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load promo codes.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))
function refilter() { page.value = 1; load() }
function onSearch() { window.clearTimeout(t); t = window.setTimeout(refilter, 300) }
function setState(s: StateFilter) { state.value = s; refilter() }
function go(p: number) { page.value = p; load() }

const cur = (v: number | string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
function usage(p: PromoCode) { return p.max_uses ? `${p.used} of ${p.max_uses}` : `${p.used}` }
function window_(p: PromoCode) {
  if (!p.starts_on && !p.expires_on) return 'No dates'
  if (p.starts_on && p.expires_on) return `${p.starts_on} to ${p.expires_on}`
  return p.starts_on ? `From ${p.starts_on}` : `Until ${p.expires_on}`
}

// ---- add / edit ----
type FormText = 'code' | 'description' | 'value' | 'max_discount' | 'min_subtotal' | 'starts_on' | 'expires_on' | 'max_uses' | 'max_uses_per_user'
const blank = () => ({ id: null as string | null, locked: false, code: '', description: '', type: 'percent' as 'percent' | 'fixed', value: '', max_discount: '', min_subtotal: '', starts_on: '', expires_on: '', max_uses: '', max_uses_per_user: '1', first_booking_only: false, is_active: true })
const form = reactive({ open: false, saving: false, ...blank(), errors: {} as Record<string, string>, error: '' })

function openAdd() { Object.assign(form, { open: true, saving: false, ...blank(), errors: {}, error: '' }) }
function openEdit(p: PromoCode) {
  Object.assign(form, {
    open: true, saving: false, id: p.id, locked: p.used > 0, code: p.code, description: p.description ?? '', type: p.type, value: String(Number(p.value)),
    max_discount: p.max_discount == null ? '' : String(Number(p.max_discount)), min_subtotal: p.min_subtotal == null ? '' : String(Number(p.min_subtotal)),
    starts_on: p.starts_on ?? '', expires_on: p.expires_on ?? '', max_uses: p.max_uses == null ? '' : String(p.max_uses), max_uses_per_user: String(p.max_uses_per_user),
    first_booking_only: p.first_booking_only, is_active: p.is_active, errors: {}, error: '',
  })
}
function generate() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  form.code = Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join('')
}
const num = (s: string) => (s.trim() === '' ? null : Number(s))

async function save() {
  form.errors = {}; form.error = ''
  const e = form.errors
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(form.code.trim())) e.code = 'Use 3 to 30 letters, numbers, dashes or underscores, with no spaces.'
  const v = num(form.value)
  if (v === null || !Number.isFinite(v) || v <= 0) e.value = 'Enter an amount above 0.'
  else if (form.type === 'percent' && v > 100) e.value = 'A percentage cannot be more than 100.'
  for (const k of ['max_discount', 'min_subtotal'] as FormText[]) {
    const n = num(form[k]); if (n !== null && (!Number.isFinite(n) || n < 0)) e[k] = 'Enter an amount, or leave it empty.'
  }
  const mu = num(form.max_uses); if (mu !== null && (!Number.isInteger(mu) || mu < 1)) e.max_uses = 'Enter a whole number, or leave it empty.'
  const pu = num(form.max_uses_per_user); if (pu === null || !Number.isInteger(pu) || pu < 1) e.max_uses_per_user = 'Enter 1 or more.'
  if (form.starts_on && form.expires_on && form.expires_on < form.starts_on) e.expires_on = 'The last day must be on or after the first day.'
  if (Object.keys(e).length) return

  form.saving = true
  try {
    const body = {
      code: form.code.trim().toUpperCase(), description: form.description.trim() || null, type: form.type, value: v,
      max_discount: form.type === 'percent' ? num(form.max_discount) : null, min_subtotal: num(form.min_subtotal),
      starts_on: form.starts_on || null, expires_on: form.expires_on || null, max_uses: mu, max_uses_per_user: pu,
      first_booking_only: form.first_booking_only, is_active: form.is_active,
    }
    if (form.id) await api.patch(`/admin/promo-codes/${form.id}`, body)
    else await api.post('/admin/promo-codes', body)
    toast.success(form.id ? 'Promo code saved.' : 'Promo code added.'); form.open = false; await load()
  } catch (err) {
    const pe = parseError(err); form.errors = pe.fields
    if (!Object.keys(pe.fields).length) form.error = pe.message
  } finally { form.saving = false }
}

async function setActive(p: PromoCode, active: boolean) {
  const yes = await confirm({
    title: active ? `Switch on ${p.code}?` : `Switch off ${p.code}?`,
    message: active ? 'Customers will be able to use this code again (within its dates and limits).' : 'Customers will no longer be able to use this code. Bookings that already used it are not changed.',
    confirmText: active ? 'Switch on' : 'Switch off', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = p.id
  try { await api.patch(`/admin/promo-codes/${p.id}`, { is_active: active }); toast.success(active ? 'Code switched on.' : 'Code switched off.'); await load() }
  catch (err) { toast.error(parseError(err).message) } finally { busyId.value = null }
}
async function remove(p: PromoCode) {
  const yes = await confirm({ title: `Remove ${p.code}?`, message: 'This code is removed. This cannot be undone.', confirmText: 'Remove code', tone: 'danger' })
  if (!yes) return
  busyId.value = p.id
  try { await api.delete(`/admin/promo-codes/${p.id}`); toast.success('Promo code removed.'); await load() }
  catch (err) { toast.error(parseError(err).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Promo codes</h1><p>Discount codes customers type in when they book. They apply to the booking price, never to extra hours.</p></div>
      <button v-if="canCreate" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New code</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by state">
      <button v-for="tb in tabs" :key="tb.key" type="button" class="chip" role="tab" :class="{ on: state === tb.key }" :aria-selected="state === tb.key" @click="setState(tb.key)">{{ tb.label }}</button>
    </div>

    <div class="card">
      <div class="bar"><label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search by code or description" aria-label="Search promo codes" @input="onSearch" /></label></div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Tag :size="30" /><p>{{ search || state ? 'No codes match these filters.' : 'No promo codes yet.' }}</p><button v-if="canCreate && !search && !state" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New code</button></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Code</th><th>Discount</th><th>Dates</th><th class="num">Used</th><th class="num">Given away</th><th>State</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id">
              <td><strong class="code">{{ p.code }}</strong><small>{{ p.description || '—' }}</small></td>
              <td>{{ p.value_label }}<small v-if="p.type === 'percent' && p.max_discount">Up to {{ cur(p.max_discount) }}</small><small v-if="p.min_subtotal">Min spend {{ cur(p.min_subtotal) }}</small><small v-if="p.first_booking_only">First booking only</small></td>
              <td class="muted">{{ window_(p) }}</td>
              <td class="num">{{ usage(p) }}<small v-if="p.max_uses_per_user > 1">{{ p.max_uses_per_user }} per customer</small></td>
              <td class="num">{{ p.saved ? cur(p.saved) : '—' }}</td>
              <td><span class="pill" :class="statePill[p.state]">{{ stateLabel[p.state] }}</span></td>
              <td>
                <div class="acts">
                  <button v-if="canUpdate && (p.state === 'off')" type="button" class="btn btn-ghost btn-sm" :disabled="busyId === p.id" @click="setActive(p, true)">Switch on</button>
                  <button v-else-if="canUpdate && p.state !== 'expired'" type="button" class="btn btn-ghost btn-sm" :disabled="busyId === p.id" @click="setActive(p, false)">Switch off</button>
                  <button v-if="canUpdate" type="button" class="icon-btn" :aria-label="`Edit ${p.code}`" @click="openEdit(p)"><Pencil :size="16" /></button>
                  <button v-if="canDelete" type="button" class="icon-btn danger" :aria-label="`Remove ${p.code}`" :title="p.used > 0 ? 'Used on bookings. Switch it off instead' : 'Remove'" :disabled="busyId === p.id || p.used > 0" @click="remove(p)"><Loader2 v-if="busyId === p.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
                </div>
              </td>
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

    <Modal :open="form.open" :title="form.id ? 'Edit promo code' : 'New promo code'" :width="540" @close="form.open = false">
      <form id="promo-form" class="form" novalidate @submit.prevent="save">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>
        <div>
          <label class="label" for="p-code">Code</label>
          <div class="inline"><input id="p-code" v-model="form.code" class="input code-in" :class="{ invalid: form.errors.code }" maxlength="30" placeholder="WELCOME10" autocomplete="off" :disabled="form.locked" /><button v-if="!form.locked" type="button" class="btn btn-ghost" @click="generate">Generate</button></div>
          <p v-if="form.errors.code" class="err-text">{{ form.errors.code }}</p><p v-else-if="form.locked" class="hint">This code has been used, so it can't be renamed.</p><p v-else class="hint">Customers can type it in any case.</p>
        </div>
        <div><label class="label" for="p-desc">Message to the customer <span class="opt-note">(optional)</span></label><input id="p-desc" v-model="form.description" class="input" maxlength="160" placeholder="10% off your first booking" /><p v-if="form.errors.description" class="err-text">{{ form.errors.description }}</p><p v-else class="hint">Shown in the app when the code is applied.</p></div>

        <div class="grid2">
          <div>
            <span class="label">Type</span>
            <div class="seg" role="radiogroup" aria-label="Discount type">
              <button type="button" role="radio" :aria-checked="form.type === 'percent'" :class="{ on: form.type === 'percent' }" @click="form.type = 'percent'">Percent</button>
              <button type="button" role="radio" :aria-checked="form.type === 'fixed'" :class="{ on: form.type === 'fixed' }" @click="form.type = 'fixed'">Fixed amount</button>
            </div>
          </div>
          <div><label class="label" for="p-value">{{ form.type === 'percent' ? 'Percent off' : 'Amount off (USD)' }}</label><input id="p-value" v-model="form.value" class="input" :class="{ invalid: form.errors.value }" inputmode="decimal" :placeholder="form.type === 'percent' ? '10' : '15.00'" /><p v-if="form.errors.value" class="err-text">{{ form.errors.value }}</p></div>
        </div>

        <div class="grid2">
          <div v-if="form.type === 'percent'"><label class="label" for="p-max">Biggest discount <span class="opt-note">(optional)</span></label><input id="p-max" v-model="form.max_discount" class="input" :class="{ invalid: form.errors.max_discount }" inputmode="decimal" placeholder="50.00" /><p v-if="form.errors.max_discount" class="err-text">{{ form.errors.max_discount }}</p></div>
          <div><label class="label" for="p-min">Minimum spend <span class="opt-note">(optional)</span></label><input id="p-min" v-model="form.min_subtotal" class="input" :class="{ invalid: form.errors.min_subtotal }" inputmode="decimal" placeholder="100.00" /><p v-if="form.errors.min_subtotal" class="err-text">{{ form.errors.min_subtotal }}</p></div>
        </div>

        <div class="grid2">
          <div><label class="label" for="p-from">First day <span class="opt-note">(optional)</span></label><input id="p-from" v-model="form.starts_on" type="date" class="input" /></div>
          <div><label class="label" for="p-to">Last day <span class="opt-note">(optional)</span></label><input id="p-to" v-model="form.expires_on" type="date" class="input" :class="{ invalid: form.errors.expires_on }" /><p v-if="form.errors.expires_on" class="err-text">{{ form.errors.expires_on }}</p></div>
        </div>
        <p class="hint tight">Days are counted in UTC, and both are included.</p>

        <div class="grid2">
          <div><label class="label" for="p-uses">Total uses <span class="opt-note">(optional)</span></label><input id="p-uses" v-model="form.max_uses" class="input" :class="{ invalid: form.errors.max_uses }" inputmode="numeric" placeholder="No limit" /><p v-if="form.errors.max_uses" class="err-text">{{ form.errors.max_uses }}</p></div>
          <div><label class="label" for="p-per">Uses per customer</label><input id="p-per" v-model="form.max_uses_per_user" class="input" :class="{ invalid: form.errors.max_uses_per_user }" inputmode="numeric" /><p v-if="form.errors.max_uses_per_user" class="err-text">{{ form.errors.max_uses_per_user }}</p></div>
        </div>

        <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.first_booking_only" aria-label="First booking only" @click="form.first_booking_only = !form.first_booking_only" /><span>First booking only</span></label>
        <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.is_active" aria-label="Code is on" @click="form.is_active = !form.is_active" /><span>Code is on</span></label>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="promo-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> {{ form.id ? 'Save changes' : 'Add code' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; } .tabs .chip { white-space: nowrap; }
.bar { display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
td strong { display: block; } td small { display: block; color: var(--text-mute); }
.code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em; }
.muted { color: var(--text-mute); font-size: 14px; }
td.num, th.num { text-align: right; white-space: nowrap; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; } .danger { color: var(--danger); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
.form { display: grid; gap: 16px; } .opt-note { font-weight: 500; color: var(--text-mute); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } @media (max-width: 520px) { .grid2 { grid-template-columns: 1fr; } }
.inline { display: flex; gap: 10px; } .code-in { text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.hint.tight { margin-top: -8px; }
.seg { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; gap: 4px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; }
.seg button { height: 34px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-weight: 600; font-size: 14px; color: var(--text-mute); cursor: pointer; }
.seg button.on { background: var(--blue, #0066ff); color: #fff; }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 600; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>