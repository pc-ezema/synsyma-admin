<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Copy, Landmark, Loader2, Pencil, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { PayoutDetails, PayoutMethod } from '@/types'

const props = defineProps<{ contractorId: string; contractorName: string }>()
const emit = defineEmits<{ (e: 'changed', summary: string | null): void }>()

const auth = useAuthStore()
const canManage = computed(() => auth.can('payouts.manage'))
const base = `/admin/payouts/contractors/${props.contractorId}/details`

const data = ref<PayoutDetails | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true; error.value = ''
  try { data.value = (await api.get<{ data: PayoutDetails | null }>(base)).data.data; emit('changed', data.value?.summary ?? null) }
  catch (e) { error.value = parseError(e, "Couldn't load the payout details.").message } finally { loading.value = false }
}
onMounted(load)

const methods: { id: PayoutMethod; label: string }[] = [
  { id: 'bank_transfer', label: 'Bank transfer' }, { id: 'etransfer', label: 'Interac e-Transfer' },
  { id: 'paypal', label: 'PayPal' }, { id: 'other', label: 'Other' },
]
const labels: Record<string, string> = {
  institution_number: 'Institution number', transit_number: 'Transit number', routing_number: 'Routing number',
  sort_code: 'Sort code', account_number: 'Account number', account_type: 'Account type', email: 'Email', instructions: 'Instructions',
}
const countries = { CA: 'Canada', US: 'United States', GB: 'United Kingdom' } as const

// the rows shown on the card, in a sensible order
const rows = computed(() => {
  const d = data.value
  if (!d) return [] as [string, string][]
  const order = ['institution_number', 'transit_number', 'routing_number', 'sort_code', 'account_number', 'account_type', 'email', 'instructions']
  return order.filter((k) => d.details[k]).map((k) => [k, d.details[k]] as [string, string])
})
async function copy(v: string) {
  try { await navigator.clipboard.writeText(v); toast.success('Copied.') } catch { toast.error("Couldn't copy. Select it and copy by hand.") }
}

// ---- edit ----
const f = reactive({ open: false, saving: false, method: 'bank_transfer' as PayoutMethod, country: 'CA' as 'CA' | 'US' | 'GB', holder_name: '', bank_name: '', details: {} as Record<string, string>, errors: {} as Record<string, string>, error: '' })
const fieldKeys = computed(() => {
  if (f.method === 'bank_transfer') return f.country === 'US' ? ['routing_number', 'account_number', 'account_type'] : f.country === 'GB' ? ['sort_code', 'account_number'] : ['institution_number', 'transit_number', 'account_number']
  return f.method === 'other' ? ['instructions'] : ['email']
})
function openEdit() {
  const d = data.value
  Object.assign(f, {
    open: true, saving: false, errors: {}, error: '',
    method: d?.method ?? 'bank_transfer', country: d?.country ?? 'CA',
    holder_name: d?.holder_name ?? props.contractorName, bank_name: d?.bank_name ?? '',
    details: d && d.revealed ? { ...d.details } : {},
  })
}
async function save() {
  f.errors = {}; f.error = ''; f.saving = true
  const details: Record<string, string> = {}
  for (const k of fieldKeys.value) details[k] = (f.details[k] ?? '').trim()
  try {
    const res = await api.put<{ message: string }>(base, { method: f.method, country: f.method === 'bank_transfer' ? f.country : null, holder_name: f.holder_name.trim(), bank_name: f.bank_name.trim() || null, details })
    toast.success(res.data.message); f.open = false; await load()
  } catch (e) {
    const pe = parseError(e); f.errors = pe.fields
    if (!Object.keys(pe.fields).length) f.error = pe.message
  } finally { f.saving = false }
}
const err = (k: string) => f.errors[`details.${k}`]

async function remove() {
  const yes = await confirm({ title: 'Remove payout details?', message: `${props.contractorName}'s saved payout details will be deleted. You can add them again later.`, confirmText: 'Remove details', tone: 'danger' })
  if (!yes) return
  try { await api.delete(base); toast.success('Payout details removed.'); await load() } catch (e) { toast.error(parseError(e).message) }
}
</script>

<template>
  <section class="card pd">
    <div class="head">
      <h2><Landmark :size="18" /> Payout details</h2>
      <div v-if="canManage && !loading && !error" class="acts">
        <button v-if="data" type="button" class="btn btn-ghost btn-sm" @click="remove"><Trash2 :size="15" /> Remove</button>
        <button type="button" class="btn btn-ghost btn-sm" @click="openEdit"><Pencil :size="15" /> {{ data ? 'Edit' : 'Add details' }}</button>
      </div>
    </div>

    <div v-if="loading" class="skeleton" style="height: 70px" />
    <p v-else-if="error" class="bad"><AlertCircle :size="16" /> {{ error }} <button type="button" class="link" @click="load">Try again</button></p>
    <p v-else-if="!data" class="none">No payout details yet.<template v-if="canManage"> Add them so you know where to send the money.</template></p>
    <template v-else>
      <dl class="grid">
        <div><dt>Method</dt><dd>{{ data.method_label }}</dd></div>
        <div><dt>Name on account</dt><dd>{{ data.holder_name }}</dd></div>
        <div v-if="data.country"><dt>Country</dt><dd>{{ countries[data.country] }}</dd></div>
        <div v-if="data.bank_name"><dt>Bank</dt><dd>{{ data.bank_name }}</dd></div>
        <div v-for="[k, v] in rows" :key="k" :class="{ wide: k === 'instructions' }">
          <dt>{{ labels[k] }}</dt>
          <dd class="val"><span :class="{ mono: data.revealed && k !== 'instructions' }">{{ k === 'account_type' ? v.charAt(0).toUpperCase() + v.slice(1) : v }}</span>
            <button v-if="data.revealed && k !== 'account_type'" type="button" class="cp" :aria-label="`Copy ${labels[k]}`" @click="copy(v)"><Copy :size="14" /></button></dd>
        </div>
      </dl>
      <p v-if="!data.revealed" class="hint">Numbers are hidden. You need permission to manage payouts to see them in full.</p>
    </template>

    <Modal :open="f.open" :title="data ? 'Edit payout details' : 'Add payout details'" :width="520" @close="f.open = false">
      <form id="pd-form" class="form" novalidate @submit.prevent="save">
        <p v-if="f.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ f.error }}</p>
        <div><label class="label" for="pd-method">How do you pay them?</label>
          <select id="pd-method" v-model="f.method" class="select"><option v-for="m in methods" :key="m.id" :value="m.id">{{ m.label }}</option></select></div>
        <div><label class="label" for="pd-holder">Name on the account</label>
          <input id="pd-holder" v-model="f.holder_name" class="input" :class="{ invalid: f.errors.holder_name }" maxlength="120" autocomplete="off" />
          <p v-if="f.errors.holder_name" class="err-text">{{ f.errors.holder_name }}</p></div>
        <template v-if="f.method === 'bank_transfer'">
          <div class="two">
            <div><label class="label" for="pd-country">Country</label>
              <select id="pd-country" v-model="f.country" class="select"><option v-for="(l, k) in countries" :key="k" :value="k">{{ l }}</option></select></div>
            <div><label class="label" for="pd-bank">Bank name <span class="opt">(optional)</span></label>
              <input id="pd-bank" v-model="f.bank_name" class="input" maxlength="120" autocomplete="off" /></div>
          </div>
        </template>
        <div v-for="k in fieldKeys" :key="`${f.method}-${f.country}-${k}`">
          <label class="label" :for="`pd-${k}`">{{ labels[k] }}</label>
          <select v-if="k === 'account_type'" :id="`pd-${k}`" v-model="f.details[k]" class="select"><option value="" disabled>Choose…</option><option value="checking">Checking</option><option value="savings">Savings</option></select>
          <textarea v-else-if="k === 'instructions'" :id="`pd-${k}`" v-model="f.details[k]" class="input" rows="4" maxlength="600" placeholder="Where and how to send the money" :class="{ invalid: err(k) }" />
          <input v-else :id="`pd-${k}`" v-model="f.details[k]" class="input" :class="{ invalid: err(k) }" :type="k === 'email' ? 'email' : 'text'" :inputmode="k === 'email' ? 'email' : 'numeric'" maxlength="190" autocomplete="off" />
          <p v-if="err(k)" class="err-text">{{ err(k) }}</p>
        </div>
        <p class="hint">Stored encrypted. Only admins who can manage payouts see the full numbers.</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="f.open = false">Cancel</button>
        <button type="submit" form="pd-form" class="btn btn-primary" :disabled="f.saving"><Loader2 v-if="f.saving" :size="16" class="spin" /> Save details</button>
      </template>
    </Modal>
  </section>
</template>

<style scoped>
.pd { padding: 16px 18px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.acts { display: flex; gap: 8px; }
.none { color: var(--text-mute); } .bad { display: flex; align-items: center; gap: 8px; color: var(--danger); }
.link { font-weight: 600; color: var(--blue-ink); text-decoration: underline; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px 20px; }
.grid .wide { grid-column: 1 / -1; }
dt { color: var(--text-mute); font-size: 12px; font-weight: 600; margin-bottom: 2px; }
dd { font-weight: 600; overflow-wrap: anywhere; white-space: pre-wrap; }
.val { display: flex; align-items: center; gap: 8px; }
.mono { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.cp { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: var(--text-dim); } .cp:hover { background: rgba(0, 0, 0, 0.06); color: var(--blue-ink); }
.hint { margin-top: 12px; color: var(--text-mute); font-size: 13px; }
.form { display: grid; gap: 16px; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .opt { font-weight: 500; color: var(--text-mute); }
@media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>