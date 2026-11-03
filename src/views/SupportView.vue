<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Loader2, Mail, MessageCircle, Pencil, Phone, Plus, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { ContactType, SupportContact } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('support.create'))
const canUpdate = computed(() => auth.can('support.update'))
const canDelete = computed(() => auth.can('support.delete'))

const rows = ref<SupportContact[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)

const groups = [
  { type: 'phone' as ContactType, title: 'Phone numbers', hint: 'Shown on the app Help screen. Tapping one opens the phone dialer.', icon: Phone, placeholder: '+234 903 945 9108' },
  { type: 'email' as ContactType, title: 'Email addresses', hint: 'Shown on the app Help screen. Tapping one opens the mail app.', icon: Mail, placeholder: 'support@synsyma.com' },
  { type: 'whatsapp' as ContactType, title: 'WhatsApp number', hint: 'Appears as the floating chat button in the app. Only one number can be on at a time.', icon: MessageCircle, placeholder: '+234 801 234 5678' },
]
const byType = (t: ContactType) => rows.value.filter((r) => r.type === t)
const meta = (t: ContactType) => groups.find((g) => g.type === t)!

async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await api.get<{ data: SupportContact[] }>('/admin/support/contacts')).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load support contacts.").message } finally { loading.value = false }
}
onMounted(load)

// ---- add / edit ----
const form = reactive({ open: false, saving: false, id: null as string | null, type: 'phone' as ContactType, label: '', value: '', is_active: true, errors: {} as Record<string, string>, error: '' })
function openAdd(type: ContactType) { Object.assign(form, { open: true, saving: false, id: null, type, label: '', value: '', is_active: true, errors: {}, error: '' }) }
function openEdit(c: SupportContact) { Object.assign(form, { open: true, saving: false, id: c.id, type: c.type, label: c.label ?? '', value: c.value, is_active: c.is_active, errors: {}, error: '' }) }

const valueOk = (t: ContactType, v: string) =>
  t === 'email' ? /^\S+@\S+\.\S+$/.test(v) : t === 'whatsapp' ? /^\+?[0-9\s\-()]{8,20}$/.test(v) : /^\+?[0-9\s\-()]{7,20}$/.test(v)

async function save() {
  form.errors = {}; form.error = ''
  const value = form.value.trim()
  if (!value) form.errors.value = 'This is required.'
  else if (!valueOk(form.type, value)) form.errors.value = form.type === 'email' ? 'Enter a valid email address.' : form.type === 'whatsapp' ? 'Include the country code, for example +2348012345678.' : 'Enter a valid phone number.'
  if (Object.keys(form.errors).length) return

  if (form.type === 'whatsapp' && form.is_active) {
    const current = byType('whatsapp').find((c) => c.is_active && c.id !== form.id)
    if (current) {
      const yes = await confirm({ title: 'Replace the WhatsApp number?', message: `${current.value} will be switched off. The app shows one WhatsApp number at a time.`, confirmText: 'Use this number' })
      if (!yes) return
    }
  }

  form.saving = true
  try {
    const body: Record<string, unknown> = { label: form.label.trim() || null, value, is_active: form.is_active }
    if (form.id) await api.patch(`/admin/support/contacts/${form.id}`, body)
    else await api.post('/admin/support/contacts', { ...body, type: form.type })
    toast.success(form.id ? 'Contact updated.' : 'Contact added.'); form.open = false; await load()
  } catch (e) {
    const err = parseError(e); form.errors = err.fields
    if (!Object.keys(err.fields).length) form.error = err.message
  } finally { form.saving = false }
}

async function setActive(c: SupportContact, active: boolean) {
  const yes = await confirm({
    title: active ? 'Show this contact in the app?' : 'Hide this contact from the app?',
    message: active ? `${c.value} will appear on the Help screen.` : `${c.value} will no longer appear on the Help screen.`,
    confirmText: active ? 'Show' : 'Hide', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = c.id
  try { await api.patch(`/admin/support/contacts/${c.id}`, { is_active: active }); toast.success(active ? 'Contact is live.' : 'Contact hidden.'); await load() }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function remove(c: SupportContact) {
  const yes = await confirm({ title: 'Remove this contact?', message: `${c.value} is removed from the Help screen. This cannot be undone.`, confirmText: 'Remove contact', tone: 'danger' })
  if (!yes) return
  busyId.value = c.id
  try { await api.delete(`/admin/support/contacts/${c.id}`); toast.success('Contact removed.'); await load() }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head"><div><h1>Support contacts</h1><p>What customers see on the Help screen of the app. Changes go live straight away.</p></div></div>

    <div v-if="loading && !rows.length" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 44px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>

    <template v-else>
      <section v-for="g in groups" :key="g.type" class="card group">
        <header>
          <span class="ico"><component :is="g.icon" :size="20" /></span>
          <div class="txt"><h2>{{ g.title }}</h2><p>{{ g.hint }}</p></div>
          <button v-if="canCreate" type="button" class="btn btn-ghost btn-sm" @click="openAdd(g.type)"><Plus :size="15" /> Add</button>
        </header>
        <p v-if="!byType(g.type).length" class="none">Nothing added yet. {{ g.type === 'whatsapp' ? 'The floating button stays hidden until you add one.' : '' }}</p>
        <ul v-else>
          <li v-for="c in byType(g.type)" :key="c.id" :class="{ off: !c.is_active }">
            <div class="main"><strong>{{ c.value }}</strong><small>{{ c.label || 'No label' }}</small></div>
            <span v-if="!c.is_active" class="pill grey">Hidden</span>
            <button type="button" class="switch" role="switch" :aria-checked="c.is_active" :aria-label="`${c.is_active ? 'Hide' : 'Show'} ${c.value}`" :disabled="!canUpdate || busyId === c.id" @click="setActive(c, !c.is_active)" />
            <button v-if="canUpdate" type="button" class="icon-btn" :aria-label="`Edit ${c.value}`" @click="openEdit(c)"><Pencil :size="16" /></button>
            <button v-if="canDelete" type="button" class="icon-btn danger" :aria-label="`Remove ${c.value}`" :disabled="busyId === c.id" @click="remove(c)"><Loader2 v-if="busyId === c.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
          </li>
        </ul>
      </section>
    </template>

    <Modal :open="form.open" :title="`${form.id ? 'Edit' : 'Add'} ${form.type === 'email' ? 'email address' : form.type === 'whatsapp' ? 'WhatsApp number' : 'phone number'}`" :width="480" @close="form.open = false">
      <form id="contact-form" class="form" novalidate @submit.prevent="save">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>
        <div>
          <label class="label" for="c-value">{{ form.type === 'email' ? 'Email address' : form.type === 'whatsapp' ? 'WhatsApp number' : 'Phone number' }}</label>
          <input id="c-value" v-model="form.value" class="input" :class="{ invalid: form.errors.value }" :type="form.type === 'email' ? 'email' : 'tel'" :placeholder="meta(form.type).placeholder" autocomplete="off" />
          <p v-if="form.errors.value" class="err-text">{{ form.errors.value }}</p>
          <p v-else-if="form.type === 'whatsapp'" class="hint">Use the international format with the country code.</p>
        </div>
        <div>
          <label class="label" for="c-label">Label <span class="opt-note">(optional)</span></label>
          <input id="c-label" v-model="form.label" class="input" maxlength="60" placeholder="Customer care" autocomplete="off" />
          <p v-if="form.errors.label" class="err-text">{{ form.errors.label }}</p>
        </div>
        <label class="row"><button type="button" class="switch" role="switch" :aria-checked="form.is_active" aria-label="Show in the app" @click="form.is_active = !form.is_active" /><span>Show in the app</span></label>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="contact-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> {{ form.id ? 'Save changes' : 'Add contact' }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.group { margin-bottom: 18px; overflow: hidden; }
.group header { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: rgba(0, 102, 255, 0.1); color: var(--blue-ink); flex: none; }
.txt { flex: 1; min-width: 0; } .txt h2 { font-size: 16px; font-weight: 700; } .txt p { color: var(--text-mute); font-size: 14px; margin-top: 2px; }
.none { padding: 22px 20px; color: var(--text-mute); font-size: 14px; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(4, 20, 59, 0.06); } li:last-child { border-bottom: 0; }
li.off .main { opacity: 0.55; }
.main { flex: 1; min-width: 0; } .main strong { display: block; word-break: break-all; } .main small { color: var(--text-mute); }
.danger { color: var(--danger); }
.form { display: grid; gap: 16px; } .opt-note { font-weight: 500; color: var(--text-mute); }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 600; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) { .group header { flex-wrap: wrap; } li { flex-wrap: wrap; } }
</style>
