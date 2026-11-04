<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Loader2, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import ImagePicker from '@/components/ui/ImagePicker.vue'
import type { PageMeta, PriceType, ServiceCategory, ServiceItem } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('services.create'))
const canUpdate = computed(() => auth.can('services.update'))
const canDelete = computed(() => auth.can('services.delete'))
const canCategories = computed(() => auth.can('categories.view'))

const rows = ref<ServiceItem[]>([])
const meta = ref<PageMeta | null>(null)
const categories = ref<ServiceCategory[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const categoryFilter = ref('')
const tierFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const busyId = ref<string | null>(null)
let t: number | undefined

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: ServiceItem[]; meta: PageMeta }>('/admin/services', {
      params: { page: page.value, per_page: 15, search: search.value.trim() || undefined, category_id: categoryFilter.value || undefined, tier: tierFilter.value || undefined, is_active: statusFilter.value || undefined },
    })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load services.").message } finally { loading.value = false }
}
async function loadCategories() {
  if (!canCategories.value) return
  try { categories.value = (await api.get<{ data: ServiceCategory[] }>('/admin/service-categories')).data.data } catch { /* the form shows an empty list */ }
}
onMounted(() => { load(); loadCategories() })
onBeforeUnmount(() => window.clearTimeout(t))
function onSearch() { window.clearTimeout(t); t = window.setTimeout(() => { page.value = 1; load() }, 300) }
function onFilter() { page.value = 1; load() }
function go(p: number) { page.value = p; load() }

const priceTypes: { value: PriceType; label: string; hint: string }[] = [
  { value: 'hourly', label: 'Hourly', hint: 'A price for the first hours, then an optional price for each extra hour.' },
  { value: 'fixed', label: 'Fixed', hint: 'One flat price for the whole job.' },
  { value: 'quote', label: 'Get a quote', hint: 'No price is shown. The customer asks for a quote.' },
]
const currencies = [{ v: 'USD', l: 'USD ($)' }, { v: 'NGN', l: 'NGN (₦)' }, { v: 'GBP', l: 'GBP (£)' }, { v: 'EUR', l: 'EUR (€)' }]

// ---- add / edit ----
const blank = () => ({ id: null as string | null, category_id: '', name: '', tier: '', description: '', price_type: 'hourly' as PriceType, currency: 'USD', base_price: '', included_hours: '2', additional_hour_price: '', team_size: '', parts_tbd: false, home_protection: true, is_active: true })
const form = reactive({ open: false, saving: false, image: null as File | null, imageUrl: null as string | null, removeImage: false, ...blank(), errors: {} as Record<string, string>, error: '' })
function openAdd() { Object.assign(form, { open: true, saving: false, image: null, imageUrl: null, removeImage: false, ...blank(), category_id: categoryFilter.value || categories.value[0]?.id || '', errors: {}, error: '' }) }
function openEdit(s: ServiceItem) {
  Object.assign(form, {
    open: true, saving: false, image: null, imageUrl: s.image_url, removeImage: false, id: s.id, category_id: s.category_id, name: s.name, tier: s.tier ?? '', description: s.description ?? '',
    price_type: s.price_type, currency: s.currency, base_price: s.base_price != null ? String(s.base_price) : '',
    included_hours: s.included_hours != null ? String(s.included_hours) : '2',
    additional_hour_price: s.additional_hour_price != null ? String(s.additional_hour_price) : '',
    team_size: s.team_size != null ? String(s.team_size) : '', parts_tbd: s.parts_tbd, home_protection: s.home_protection, is_active: s.is_active,
    errors: {}, error: '',
  })
}

const money = /^\d{1,8}(\.\d{1,2})?$/
async function save() {
  form.errors = {}; form.error = ''
  if (!form.category_id) form.errors.category_id = 'Choose a category.'
  if (form.name.trim().length < 2) form.errors.name = 'Enter a name of at least 2 characters.'
  if (form.price_type !== 'quote') {
    if (!money.test(form.base_price.trim())) form.errors.base_price = 'Enter the price, for example 200 or 199.50.'
    if (form.price_type === 'hourly') {
      if (!/^\d{1,2}$/.test(form.included_hours.trim()) || +form.included_hours < 1 || +form.included_hours > 24) form.errors.included_hours = 'Enter 1 to 24 hours.'
      if (form.additional_hour_price.trim() && !money.test(form.additional_hour_price.trim())) form.errors.additional_hour_price = 'Enter a price, for example 85.'
    }
  }
  if (form.team_size.trim() && (!/^\d{1,2}$/.test(form.team_size.trim()) || +form.team_size < 1)) form.errors.team_size = 'Enter 1 or more.'
  if (Object.keys(form.errors).length) return

  const quote = form.price_type === 'quote'
  const hourly = form.price_type === 'hourly'
  const body = {
    category_id: form.category_id, name: form.name.trim(), tier: form.tier || null, description: form.description.trim() || null,
    price_type: form.price_type, currency: form.currency,
    base_price: quote ? null : Number(form.base_price),
    included_hours: hourly ? Number(form.included_hours) : null,
    additional_hour_price: hourly && form.additional_hour_price.trim() ? Number(form.additional_hour_price) : null,
    team_size: form.team_size.trim() ? Number(form.team_size) : null,
    parts_tbd: form.parts_tbd, home_protection: form.home_protection, is_active: form.is_active,
  }
  form.saving = true
  try {
    const res = form.id
      ? await api.patch<{ data: ServiceItem }>(`/admin/services/${form.id}`, body)
      : await api.post<{ data: ServiceItem }>('/admin/services', body)
    const id = res.data.data.id
    let photoFailed = ''
    try {
      if (form.image) { const fd = new FormData(); fd.append('image', form.image); await api.post(`/admin/services/${id}/image`, fd) }
      else if (form.removeImage && form.imageUrl) await api.delete(`/admin/services/${id}/image`)
    } catch (e) { photoFailed = parseError(e, "The photo couldn't be saved.").message }
    if (photoFailed) {
      form.id = id; form.image = null; form.error = `Saved, but ${photoFailed.charAt(0).toLowerCase()}${photoFailed.slice(1)}`; await load(); loadCategories(); return
    }
    toast.success(form.id ? 'Service updated.' : 'Service added.'); form.open = false; await load(); loadCategories()
  } catch (e) {
    const err = parseError(e); form.errors = err.fields
    if (!Object.keys(err.fields).length) form.error = err.message
  } finally { form.saving = false }
}

async function setActive(s: ServiceItem, active: boolean) {
  const yes = await confirm({
    title: active ? `Show ${s.name} in the app?` : `Hide ${s.name} from the app?`,
    message: active ? 'Customers will be able to book this service again.' : 'Customers will no longer see or book this service.',
    confirmText: active ? 'Show service' : 'Hide service', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = s.id
  try { await api.patch(`/admin/services/${s.id}`, { is_active: active }); s.is_active = active; toast.success(active ? 'Service is live.' : 'Service hidden.') }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function remove(s: ServiceItem) {
  const yes = await confirm({ title: `Remove ${s.name}?`, message: 'This service is removed from the list. Past bookings keep their record. This cannot be undone.', confirmText: 'Remove service', tone: 'danger' })
  if (!yes) return
  busyId.value = s.id
  try { await api.delete(`/admin/services/${s.id}`); toast.success('Service removed.'); await load(); loadCategories() }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Services</h1><p>What customers can book, and what it costs.</p></div>
      <button v-if="canCreate && canCategories" type="button" class="btn btn-primary" :disabled="!categories.length" :title="categories.length ? '' : 'Add a category first'" @click="openAdd"><Plus :size="18" /> New service</button>
    </div>

    <div class="card">
      <div class="bar">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search services" aria-label="Search services" @input="onSearch" /></label>
        <select v-if="categories.length" v-model="categoryFilter" class="select sel" aria-label="Filter by category" @change="onFilter"><option value="">All categories</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        <select v-model="tierFilter" class="select sel" aria-label="Filter by tier" @change="onFilter"><option value="">All tiers</option><option value="premium">Premium</option><option value="regular">Regular</option></select>
        <select v-model="statusFilter" class="select sel" aria-label="Filter by status" @change="onFilter"><option value="">Live and hidden</option><option value="1">Live</option><option value="0">Hidden</option></select>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Wrench :size="30" /><p>No services{{ search || categoryFilter || tierFilter || statusFilter ? ' match your filters' : ' yet' }}.</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Service</th><th>Price</th><th>Team</th><th>Live</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="s in rows" :key="s.id" :class="{ off: !s.is_active }">
              <td>
                <div class="cell"><img v-if="s.image_url" :src="s.image_url" alt="" class="mini" /><span v-else class="mini ph" aria-hidden="true" /><div>
                <strong>{{ s.name }} <i v-if="s.tier" class="pill" :class="s.tier === 'premium' ? '' : 'grey'">{{ s.tier === 'premium' ? 'Premium' : 'Regular' }}</i></strong>
                <small>{{ s.category_name || '-' }}</small>
                </div></div>
              </td>
              <td>
                <strong>{{ s.price_label }}</strong>
                <small v-if="s.additional_label">{{ s.additional_label }}</small>
                <small v-if="s.parts_note">{{ s.parts_note }}</small>
              </td>
              <td class="muted">{{ s.team_size ? (s.team_size === 1 ? '1 person' : `${s.team_size} people`) : '-' }}</td>
              <td><button type="button" class="switch" role="switch" :aria-checked="s.is_active" :aria-label="`${s.is_active ? 'Hide' : 'Show'} ${s.name}`" :disabled="!canUpdate || busyId === s.id" @click="setActive(s, !s.is_active)" /></td>
              <td>
                <div class="acts">
                  <button v-if="canUpdate" type="button" class="icon-btn" :aria-label="`Edit ${s.name}`" @click="openEdit(s)"><Pencil :size="16" /></button>
                  <button v-if="canDelete" type="button" class="icon-btn danger" :aria-label="`Remove ${s.name}`" :disabled="busyId === s.id" @click="remove(s)"><Loader2 v-if="busyId === s.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
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

    <Modal :open="form.open" :title="form.id ? 'Edit service' : 'New service'" :width="600" @close="form.open = false">
      <form id="service-form" class="form" novalidate @submit.prevent="save">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>

        <div class="two">
          <div>
            <label class="label" for="s-cat">Category</label>
            <select id="s-cat" v-model="form.category_id" class="select" :class="{ invalid: form.errors.category_id }"><option value="" disabled>Choose a category</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select>
            <p v-if="form.errors.category_id" class="err-text">{{ form.errors.category_id }}</p>
          </div>
          <div>
            <label class="label" for="s-tier">Badge</label>
            <select id="s-tier" v-model="form.tier" class="select"><option value="">None</option><option value="premium">Premium</option><option value="regular">Regular</option></select>
          </div>
        </div>

        <div><span class="label">Photo <span class="opt-note">(optional)</span></span><ImagePicker :current="form.imageUrl" :file="form.image" :removed="form.removeImage" :error="form.errors.image" @pick="(f) => { form.image = f; form.removeImage = false; form.errors.image = '' }" @clear="() => { form.image = null; form.removeImage = true }" @invalid="(m) => (form.errors.image = m)" /></div>
        <div><label class="label" for="s-name">Name</label><input id="s-name" v-model="form.name" class="input" :class="{ invalid: form.errors.name }" maxlength="120" placeholder="Car Detailing" autocomplete="off" /><p v-if="form.errors.name" class="err-text">{{ form.errors.name }}</p></div>
        <div><label class="label" for="s-desc">Description <span class="opt-note">(optional)</span></label><textarea id="s-desc" v-model="form.description" class="input ta" rows="3" maxlength="1000" /><p v-if="form.errors.description" class="err-text">{{ form.errors.description }}</p></div>

        <fieldset>
          <legend class="label">How is it priced?</legend>
          <div class="seg" role="radiogroup" aria-label="Price type">
            <button v-for="p in priceTypes" :key="p.value" type="button" class="chip" :class="{ on: form.price_type === p.value }" role="radio" :aria-checked="form.price_type === p.value" @click="form.price_type = p.value">{{ p.label }}</button>
          </div>
          <p class="hint">{{ priceTypes.find((p) => p.value === form.price_type)?.hint }}</p>
        </fieldset>

        <div v-if="form.price_type !== 'quote'" class="three">
          <div>
            <label class="label" for="s-cur">Currency</label>
            <select id="s-cur" v-model="form.currency" class="select"><option v-for="c in currencies" :key="c.v" :value="c.v">{{ c.l }}</option></select>
          </div>
          <div>
            <label class="label" for="s-price">{{ form.price_type === 'hourly' ? 'Price for the first hours' : 'Price' }}</label>
            <input id="s-price" v-model="form.base_price" class="input" :class="{ invalid: form.errors.base_price }" inputmode="decimal" placeholder="200" />
            <p v-if="form.errors.base_price" class="err-text">{{ form.errors.base_price }}</p>
          </div>
          <div v-if="form.price_type === 'hourly'">
            <label class="label" for="s-hours">First hours</label>
            <input id="s-hours" v-model="form.included_hours" class="input" :class="{ invalid: form.errors.included_hours }" inputmode="numeric" placeholder="2" />
            <p v-if="form.errors.included_hours" class="err-text">{{ form.errors.included_hours }}</p>
          </div>
        </div>
        <div v-if="form.price_type === 'hourly'">
          <label class="label" for="s-extra">Price for each extra hour <span class="opt-note">(optional)</span></label>
          <input id="s-extra" v-model="form.additional_hour_price" class="input" :class="{ invalid: form.errors.additional_hour_price }" inputmode="decimal" placeholder="85" />
          <p v-if="form.errors.additional_hour_price" class="err-text">{{ form.errors.additional_hour_price }}</p>
        </div>

        <div>
          <label class="label" for="s-team">People sent <span class="opt-note">(optional)</span></label>
          <input id="s-team" v-model="form.team_size" class="input narrow" :class="{ invalid: form.errors.team_size }" inputmode="numeric" placeholder="2" />
          <p v-if="form.errors.team_size" class="err-text">{{ form.errors.team_size }}</p><p v-else class="hint">1 for a one-person job, 2 for a team of two.</p>
        </div>

        <div class="toggles">
          <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.parts_tbd" aria-label="Parts replacement price to be confirmed" @click="form.parts_tbd = !form.parts_tbd" /><span>Parts replacement is priced separately (TBD)</span></label>
          <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.home_protection" aria-label="Home protection plan included" @click="form.home_protection = !form.home_protection" /><span>Home protection plan included</span></label>
          <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.is_active" aria-label="Show in the app" @click="form.is_active = !form.is_active" /><span>Show in the app</span></label>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="service-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> {{ form.id ? 'Save changes' : 'Add service' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.bar { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; border-bottom: 1px solid var(--line); } .bar .field { flex: 1; min-width: 220px; max-width: 340px; height: 44px; } .sel { width: auto; min-width: 150px; height: 44px; }
.pad { padding: 16px; }
td strong { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } td small { display: block; color: var(--text-mute); }
tr.off td:not(:nth-last-child(-n + 2)) { opacity: 0.55; }
.muted { color: var(--text-mute); font-size: 14px; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; } .danger { color: var(--danger); }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px; border-top: 1px solid var(--line); color: var(--text-mute); font-size: 14px; }
.form { display: grid; gap: 16px; } fieldset { margin: 0; padding: 0; border: 0; min-width: 0; } .opt-note { font-weight: 500; color: var(--text-mute); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.seg { display: flex; flex-wrap: wrap; gap: 8px; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; } .narrow { max-width: 140px; }
.toggles { display: grid; gap: 12px; padding-top: 4px; }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 600; font-size: 14.5px; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.select.invalid { border-color: var(--danger); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) { .two, .three { grid-template-columns: 1fr; } }
.cell { display: flex; align-items: center; gap: 12px; }
.mini { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex: none; }
.mini.ph { background: var(--surface-2, #eef2f9); }
</style>
