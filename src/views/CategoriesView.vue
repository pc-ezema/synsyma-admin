<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { ServiceCategory } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('categories.create'))
const canUpdate = computed(() => auth.can('categories.update'))
const canDelete = computed(() => auth.can('categories.delete'))

const rows = ref<ServiceCategory[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await api.get<{ data: ServiceCategory[] }>('/admin/service-categories')).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load categories.").message } finally { loading.value = false }
}
onMounted(load)

// ---- add / edit ----
const iconHints = ['cleaning', 'repairs', 'outdoors', 'moving', 'security']
const form = reactive({ open: false, saving: false, id: null as string | null, name: '', icon: '', description: '', sort_order: '', is_active: true, errors: {} as Record<string, string>, error: '' })
function openAdd() { Object.assign(form, { open: true, saving: false, id: null, name: '', icon: '', description: '', sort_order: '', is_active: true, errors: {}, error: '' }) }
function openEdit(c: ServiceCategory) { Object.assign(form, { open: true, saving: false, id: c.id, name: c.name, icon: c.icon ?? '', description: c.description ?? '', sort_order: String(c.sort_order), is_active: c.is_active, errors: {}, error: '' }) }

async function save() {
  form.errors = {}; form.error = ''
  if (form.name.trim().length < 2) form.errors.name = 'Enter a name of at least 2 characters.'
  if (form.icon && !/^[A-Za-z0-9_-]+$/.test(form.icon.trim())) form.errors.icon = 'Use letters, numbers, dashes or underscores only.'
  if (form.sort_order !== '' && !/^\d{1,5}$/.test(form.sort_order.trim())) form.errors.sort_order = 'Use a whole number.'
  if (Object.keys(form.errors).length) return

  form.saving = true
  try {
    const body: Record<string, unknown> = { name: form.name.trim(), icon: form.icon.trim() || null, description: form.description.trim() || null, is_active: form.is_active }
    if (form.sort_order !== '') body.sort_order = Number(form.sort_order)
    if (form.id) await api.patch(`/admin/service-categories/${form.id}`, body)
    else await api.post('/admin/service-categories', body)
    toast.success(form.id ? 'Category updated.' : 'Category added.'); form.open = false; await load()
  } catch (e) {
    const err = parseError(e); form.errors = err.fields
    if (!Object.keys(err.fields).length) form.error = err.message
  } finally { form.saving = false }
}

async function setActive(c: ServiceCategory, active: boolean) {
  const yes = await confirm({
    title: active ? `Show ${c.name} in the app?` : `Hide ${c.name} from the app?`,
    message: active ? 'Customers will be able to see this category again.' : 'Customers will no longer see this category or its services.',
    confirmText: active ? 'Show category' : 'Hide category', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = c.id
  try { await api.patch(`/admin/service-categories/${c.id}`, { is_active: active }); c.is_active = active; toast.success(active ? 'Category is live.' : 'Category hidden.') }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function remove(c: ServiceCategory) {
  const yes = await confirm({ title: `Remove ${c.name}?`, message: 'This category is removed. This cannot be undone.', confirmText: 'Remove category', tone: 'danger' })
  if (!yes) return
  busyId.value = c.id
  try { await api.delete(`/admin/service-categories/${c.id}`); toast.success('Category removed.'); await load() }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Categories</h1><p>The groups services are listed under in the app, like Cleaning or Repairs.</p></div>
      <button v-if="canCreate" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New category</button>
    </div>

    <div class="card">
      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 44px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Layers :size="30" /><p>No categories yet.</p><button v-if="canCreate" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New category</button></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Category</th><th>Services</th><th>Order</th><th>Live</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="c in rows" :key="c.id">
              <td><strong>{{ c.name }}</strong><small>{{ c.description || c.slug }}</small></td>
              <td>{{ c.services_count ?? 0 }}</td>
              <td class="muted">{{ c.sort_order }}</td>
              <td><button type="button" class="switch" role="switch" :aria-checked="c.is_active" :aria-label="`${c.is_active ? 'Hide' : 'Show'} ${c.name}`" :disabled="!canUpdate || busyId === c.id" @click="setActive(c, !c.is_active)" /></td>
              <td>
                <div class="acts">
                  <button v-if="canUpdate" type="button" class="icon-btn" :aria-label="`Edit ${c.name}`" @click="openEdit(c)"><Pencil :size="16" /></button>
                  <button v-if="canDelete" type="button" class="icon-btn danger" :aria-label="`Remove ${c.name}`" :title="(c.services_count ?? 0) > 0 ? 'Move or remove its services first' : 'Remove'" :disabled="busyId === c.id || (c.services_count ?? 0) > 0" @click="remove(c)"><Loader2 v-if="busyId === c.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal :open="form.open" :title="form.id ? 'Edit category' : 'New category'" :width="480" @close="form.open = false">
      <form id="category-form" class="form" novalidate @submit.prevent="save">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>
        <div><label class="label" for="c-name">Name</label><input id="c-name" v-model="form.name" class="input" :class="{ invalid: form.errors.name }" maxlength="80" placeholder="Cleaning" autocomplete="off" /><p v-if="form.errors.name" class="err-text">{{ form.errors.name }}</p></div>
        <div>
          <label class="label" for="c-icon">Icon key <span class="opt-note">(optional)</span></label>
          <input id="c-icon" v-model="form.icon" class="input" :class="{ invalid: form.errors.icon }" list="icon-hints" maxlength="40" placeholder="cleaning" autocomplete="off" />
          <datalist id="icon-hints"><option v-for="h in iconHints" :key="h" :value="h" /></datalist>
          <p v-if="form.errors.icon" class="err-text">{{ form.errors.icon }}</p><p v-else class="hint">The app picks the icon that matches this word.</p>
        </div>
        <div><label class="label" for="c-desc">Description <span class="opt-note">(optional)</span></label><textarea id="c-desc" v-model="form.description" class="input ta" rows="3" maxlength="500" /><p v-if="form.errors.description" class="err-text">{{ form.errors.description }}</p></div>
        <div v-if="form.id"><label class="label" for="c-order">Display order</label><input id="c-order" v-model="form.sort_order" class="input" :class="{ invalid: form.errors.sort_order }" inputmode="numeric" /><p v-if="form.errors.sort_order" class="err-text">{{ form.errors.sort_order }}</p><p v-else class="hint">Lower numbers show first.</p></div>
        <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.is_active" aria-label="Show in the app" @click="form.is_active = !form.is_active" /><span>Show in the app</span></label>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="category-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> {{ form.id ? 'Save changes' : 'Add category' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
td strong { display: block; } td small { color: var(--text-mute); }
.muted { color: var(--text-mute); font-size: 14px; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; } .danger { color: var(--danger); }
.form { display: grid; gap: 16px; } .opt-note { font-weight: 500; color: var(--text-mute); }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 600; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
