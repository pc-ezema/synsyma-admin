<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Image as ImageIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import ImagePicker from '@/components/ui/ImagePicker.vue'
import type { BannerLink, PageMeta, PromoBanner, ServiceCategory, ServiceItem } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('banners.create'))
const canUpdate = computed(() => auth.can('banners.update'))
const canDelete = computed(() => auth.can('banners.delete'))

const rows = ref<PromoBanner[]>([])
const services = ref<ServiceItem[]>([])
const categories = ref<ServiceCategory[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await api.get<{ data: PromoBanner[] }>('/admin/banners')).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load banners.").message } finally { loading.value = false }
}
async function loadLinks() {
  try { categories.value = (await api.get<{ data: ServiceCategory[] }>('/admin/service-categories')).data.data } catch { /* the picker stays empty */ }
  try { services.value = (await api.get<{ data: ServiceItem[]; meta: PageMeta }>('/admin/services', { params: { is_active: 1, per_page: 100 } })).data.data } catch { /* the picker stays empty */ }
}
onMounted(() => { load(); loadLinks() })

const serviceName = (s: ServiceItem) => (s.tier ? `${s.name} (${s.tier})` : s.name)
function linkText(b: PromoBanner) {
  if (b.link_type === 'service') { const s = services.value.find((x) => x.id === b.link_value); return s ? `Opens ${serviceName(s)}` : 'Opens a service' }
  if (b.link_type === 'category') { const c = categories.value.find((x) => x.slug === b.link_value); return c ? `Opens ${c.name}` : 'Opens a category' }
  return b.promo_code ? 'Copies the code' : 'No link'
}
function runs(b: PromoBanner) {
  if (!b.starts_on && !b.ends_on) return 'Always'
  if (b.starts_on && b.ends_on) return `${b.starts_on} to ${b.ends_on}`
  return b.starts_on ? `From ${b.starts_on}` : `Until ${b.ends_on}`
}

// ---- add / edit ----
const blank = () => ({ id: null as string | null, title: '', subtitle: '', link_type: 'none' as BannerLink, link_value: '', promo_code: '', starts_on: '', ends_on: '', sort_order: '', is_active: true })
const form = reactive({ open: false, saving: false, image: null as File | null, imageUrl: null as string | null, removeImage: false, ...blank(), errors: {} as Record<string, string>, error: '' })
function openAdd() { Object.assign(form, { open: true, saving: false, image: null, imageUrl: null, removeImage: false, ...blank(), errors: {}, error: '' }) }
function openEdit(b: PromoBanner) {
  Object.assign(form, {
    open: true, saving: false, image: null, imageUrl: b.image_url, removeImage: false, id: b.id, title: b.title, subtitle: b.subtitle ?? '', link_type: b.link_type, link_value: b.link_value ?? '',
    promo_code: b.promo_code ?? '', starts_on: b.starts_on ?? '', ends_on: b.ends_on ?? '', sort_order: String(b.sort_order), is_active: b.is_active, errors: {}, error: '',
  })
}
function setLink(t: BannerLink) { form.link_type = t; form.link_value = '' }

async function save() {
  form.errors = {}; form.error = ''
  const e = form.errors
  if (form.title.trim().length < 2) e.title = 'Enter a title of at least 2 characters.'
  if (form.link_type !== 'none' && !form.link_value) e.link_value = form.link_type === 'service' ? 'Choose a service.' : 'Choose a category.'
  if (form.promo_code && !/^[A-Za-z0-9_-]{3,30}$/.test(form.promo_code.trim())) e.promo_code = 'Use 3 to 30 letters, numbers, dashes or underscores.'
  if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) e.ends_on = 'The last day must be on or after the first day.'
  if (form.sort_order !== '' && !/^\d{1,5}$/.test(form.sort_order.trim())) e.sort_order = 'Use a whole number.'
  if (Object.keys(e).length) return

  form.saving = true
  let id = form.id
  try {
    const body: Record<string, unknown> = {
      title: form.title.trim(), subtitle: form.subtitle.trim() || null, link_type: form.link_type, link_value: form.link_type === 'none' ? null : form.link_value,
      promo_code: form.promo_code.trim() || null, starts_on: form.starts_on || null, ends_on: form.ends_on || null, is_active: form.is_active,
    }
    if (form.sort_order !== '') body.sort_order = Number(form.sort_order)
    if (id) await api.patch(`/admin/banners/${id}`, body)
    else id = (await api.post<{ data: PromoBanner }>('/admin/banners', body)).data.data.id
  } catch (err) {
    const pe = parseError(err); form.errors = pe.fields
    if (!Object.keys(pe.fields).length) form.error = pe.message
    form.saving = false; return
  }
  // The photo goes up after the banner is saved. If only the photo fails, say so and keep the form open.
  try {
    if (form.image) { const fd = new FormData(); fd.append('image', form.image); await api.post(`/admin/banners/${id}/image`, fd) }
    else if (form.removeImage && form.imageUrl) await api.delete(`/admin/banners/${id}/image`)
  } catch (err) {
    const m = parseError(err).message
    form.id = id; form.image = null; form.error = `The banner was saved, but ${m.charAt(0).toLowerCase()}${m.slice(1)}`; form.saving = false; await load(); return
  }
  toast.success(form.id ? 'Banner saved.' : 'Banner added.'); form.open = false; form.saving = false; await load()
}

async function setActive(b: PromoBanner, active: boolean) {
  const yes = await confirm({
    title: active ? 'Show this banner?' : 'Hide this banner?',
    message: active ? 'It will appear on the app home screen again (within its dates).' : 'Customers will no longer see it on the home screen.',
    confirmText: active ? 'Show banner' : 'Hide banner', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = b.id
  try { await api.patch(`/admin/banners/${b.id}`, { is_active: active }); b.is_active = active; toast.success(active ? 'Banner is live.' : 'Banner hidden.') }
  catch (err) { toast.error(parseError(err).message) } finally { busyId.value = null }
}
async function remove(b: PromoBanner) {
  const yes = await confirm({ title: `Remove “${b.title}”?`, message: 'The banner and its photo are removed. This cannot be undone.', confirmText: 'Remove banner', tone: 'danger' })
  if (!yes) return
  busyId.value = b.id
  try { await api.delete(`/admin/banners/${b.id}`); toast.success('Banner removed.'); await load() }
  catch (err) { toast.error(parseError(err).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Banners</h1><p>The promotions shown at the top of the app home screen. Lower order numbers show first.</p></div>
      <button v-if="canCreate" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New banner</button>
    </div>

    <div class="card">
      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 3" :key="i" class="skeleton" style="height: 64px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><ImageIcon :size="30" /><p>No banners yet.</p><button v-if="canCreate" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New banner</button></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Banner</th><th>Tap does</th><th>Shown</th><th>Order</th><th>Live</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="b in rows" :key="b.id">
              <td><div class="cell"><img v-if="b.image_url" :src="b.image_url" alt="" class="mini" /><span v-else class="mini ph" aria-hidden="true" /><div><strong>{{ b.title }}</strong><small>{{ b.subtitle || '—' }}</small></div></div></td>
              <td>{{ linkText(b) }}<small v-if="b.promo_code">Code {{ b.promo_code }}</small></td>
              <td class="muted">{{ runs(b) }}</td>
              <td class="muted">{{ b.sort_order }}</td>
              <td><button type="button" class="switch" role="switch" :aria-checked="b.is_active" :aria-label="`${b.is_active ? 'Hide' : 'Show'} ${b.title}`" :disabled="!canUpdate || busyId === b.id" @click="setActive(b, !b.is_active)" /></td>
              <td>
                <div class="acts">
                  <button v-if="canUpdate" type="button" class="icon-btn" :aria-label="`Edit ${b.title}`" @click="openEdit(b)"><Pencil :size="16" /></button>
                  <button v-if="canDelete" type="button" class="icon-btn danger" :aria-label="`Remove ${b.title}`" :disabled="busyId === b.id" @click="remove(b)"><Loader2 v-if="busyId === b.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal :open="form.open" :title="form.id ? 'Edit banner' : 'New banner'" :width="540" @close="form.open = false">
      <form id="banner-form" class="form" novalidate @submit.prevent="save">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>
        <div><span class="label">Photo <span class="opt-note">(optional, wide photos look best)</span></span><ImagePicker :current="form.imageUrl" :file="form.image" :removed="form.removeImage" :error="form.errors.image" @pick="(f) => { form.image = f; form.removeImage = false; form.errors.image = '' }" @clear="() => { form.image = null; form.removeImage = true }" @invalid="(m) => (form.errors.image = m)" /></div>
        <div><label class="label" for="b-title">Title</label><input id="b-title" v-model="form.title" class="input" :class="{ invalid: form.errors.title }" maxlength="80" placeholder="15% off your first clean" autocomplete="off" /><p v-if="form.errors.title" class="err-text">{{ form.errors.title }}</p></div>
        <div><label class="label" for="b-sub">Second line <span class="opt-note">(optional)</span></label><input id="b-sub" v-model="form.subtitle" class="input" maxlength="160" placeholder="Book before the end of the month" autocomplete="off" /></div>

        <div>
          <span class="label">When tapped</span>
          <div class="seg3" role="radiogroup" aria-label="When tapped">
            <button type="button" role="radio" :aria-checked="form.link_type === 'none'" :class="{ on: form.link_type === 'none' }" @click="setLink('none')">Nothing</button>
            <button type="button" role="radio" :aria-checked="form.link_type === 'service'" :class="{ on: form.link_type === 'service' }" @click="setLink('service')">Open a service</button>
            <button type="button" role="radio" :aria-checked="form.link_type === 'category'" :class="{ on: form.link_type === 'category' }" @click="setLink('category')">Open a category</button>
          </div>
          <select v-if="form.link_type === 'service'" v-model="form.link_value" class="input sel" :class="{ invalid: form.errors.link_value }" aria-label="Service"><option value="">Choose a service</option><option v-for="s in services" :key="s.id" :value="s.id">{{ serviceName(s) }}</option></select>
          <select v-if="form.link_type === 'category'" v-model="form.link_value" class="input sel" :class="{ invalid: form.errors.link_value }" aria-label="Category"><option value="">Choose a category</option><option v-for="c in categories" :key="c.id" :value="c.slug">{{ c.name }}</option></select>
          <p v-if="form.errors.link_value" class="err-text">{{ form.errors.link_value }}</p>
        </div>

        <div><label class="label" for="b-code">Promo code to show <span class="opt-note">(optional)</span></label><input id="b-code" v-model="form.promo_code" class="input code-in" :class="{ invalid: form.errors.promo_code }" maxlength="30" placeholder="WELCOME10" autocomplete="off" /><p v-if="form.errors.promo_code" class="err-text">{{ form.errors.promo_code }}</p><p v-else class="hint">Shown on the banner. If nothing opens when tapped, tapping copies this code.</p></div>

        <div class="grid2">
          <div><label class="label" for="b-from">First day <span class="opt-note">(optional)</span></label><input id="b-from" v-model="form.starts_on" type="date" class="input" /></div>
          <div><label class="label" for="b-to">Last day <span class="opt-note">(optional)</span></label><input id="b-to" v-model="form.ends_on" type="date" class="input" :class="{ invalid: form.errors.ends_on }" /><p v-if="form.errors.ends_on" class="err-text">{{ form.errors.ends_on }}</p></div>
        </div>
        <div v-if="form.id"><label class="label" for="b-order">Display order</label><input id="b-order" v-model="form.sort_order" class="input" :class="{ invalid: form.errors.sort_order }" inputmode="numeric" /><p v-if="form.errors.sort_order" class="err-text">{{ form.errors.sort_order }}</p></div>
        <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.is_active" aria-label="Show in the app" @click="form.is_active = !form.is_active" /><span>Show in the app</span></label>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="banner-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> {{ form.id ? 'Save changes' : 'Add banner' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
td strong { display: block; } td small { display: block; color: var(--text-mute); }
.cell { display: flex; align-items: center; gap: 12px; } .mini { width: 72px; height: 40px; border-radius: 8px; object-fit: cover; flex: none; background: var(--surface-2, #eef2f9); } .mini.ph { display: inline-block; }
.muted { color: var(--text-mute); font-size: 14px; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; } .danger { color: var(--danger); }
.form { display: grid; gap: 16px; } .opt-note { font-weight: 500; color: var(--text-mute); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } @media (max-width: 520px) { .grid2 { grid-template-columns: 1fr; } }
.code-in { text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.seg3 { display: grid; grid-template-columns: repeat(3, 1fr); padding: 4px; gap: 4px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; margin-bottom: 10px; }
.seg3 button { height: 34px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-weight: 600; font-size: 13px; color: var(--text-mute); cursor: pointer; }
.seg3 button.on { background: var(--blue, #0066ff); color: #fff; }
.sel { width: 100%; }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 600; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>