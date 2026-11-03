<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Eye, EyeOff, Loader2, Mail, Plus, Search, ShieldCheck, Trash2, UserCog } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { ACCESS } from '@/lib/endpoints'
import { parseError } from '@/lib/errors'
import { formatDateTime, headline } from '@/lib/format'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import type { AdminRow, PageMeta, PermissionItem, Role } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('admins.create'))
const canUpdate = computed(() => auth.can('admins.update'))
const canDelete = computed(() => auth.can('admins.delete'))
const canResend = computed(() => auth.can('admins.resend'))
const canRoles = computed(() => auth.can('admins.roles.sync'))
const canDirect = computed(() => auth.can(['admins.permissions.give', 'admins.permissions.revoke']))
const canAccess = computed(() => canRoles.value || canDirect.value)
const canListRoles = computed(() => auth.can(['roles.index', 'permission.view']))

const rows = ref<AdminRow[]>([])
const meta = ref<PageMeta | null>(null)
const roles = ref<Role[]>([])
const perms = ref<PermissionItem[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const page = ref(1)
const busyId = ref<string | null>(null)
let t: number | undefined

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: AdminRow[]; meta: PageMeta }>('/admin/admins', { params: { page: page.value, per_page: 15, search: search.value.trim() || undefined } })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load administrators.").message } finally { loading.value = false }
}
async function loadRefs() {
  if (!canListRoles.value) return
  try {
    const [r, p] = await Promise.all([api.get<{ data: Role[] }>(`${ACCESS}/roles`), api.get<{ data: PermissionItem[] }>(`${ACCESS}/permissions`)])
    roles.value = r.data.data; perms.value = p.data.data
  } catch { /* the form shows an empty list */ }
}
onMounted(() => { load(); loadRefs() })
onBeforeUnmount(() => window.clearTimeout(t))
function onSearch() { window.clearTimeout(t); t = window.setTimeout(() => { page.value = 1; load() }, 300) }
function go(p: number) { page.value = p; load() }

const roleByName = (n: string) => roles.value.find((r) => r.name === n)
const isSelf = (a: AdminRow) => a.id === auth.user?.id
const isSuperRow = (a: AdminRow) => a.roles.includes('super_admin')

// ---- create ----
const form = reactive({ open: false, saving: false, name: '', email: '', password: '', show: false, roleIds: new Set<string>(), errors: {} as Record<string, string>, error: '' })
function openCreate() { Object.assign(form, { open: true, saving: false, name: '', email: '', password: '', show: false, roleIds: new Set<string>(), errors: {}, error: '' }) }
async function create() {
  form.errors = {}; form.error = ''
  if (!form.name.trim()) form.errors.name = 'Enter a name.'
  if (!/^\S+@\S+\.\S+$/.test(form.email)) form.errors.email = 'Enter a valid email.'
  if (form.password && form.password.length < 8) form.errors.password = 'Use at least 8 characters.'
  if (Object.keys(form.errors).length) return
  const names = roles.value.filter((r) => form.roleIds.has(r.id)).map((r) => r.label)
  const yes = await confirm({ title: 'Create this administrator?', message: `${form.name} (${form.email}) will get an email with their login details${names.length ? ` and the ${names.join(', ')} role${names.length > 1 ? 's' : ''}` : ''}.`, confirmText: 'Create and email details' })
  if (!yes) return
  form.saving = true
  try {
    const { data } = await api.post<{ data: { email_sent?: boolean } }>('/admin/admins', { name: form.name.trim(), email: form.email.trim(), password: form.password || undefined, roles: [...form.roleIds] })
    if (data.data.email_sent === false) toast.error('Administrator created, but the email could not be sent. Share the password another way or reset it.')
    else toast.success('Administrator created. Login details sent to their email.'); form.open = false; await load(); loadRefs()
  } catch (e) {
    const err = parseError(e); form.errors = err.fields
    if (!Object.keys(err.fields).length) form.error = err.message
  } finally { form.saving = false }
}

// ---- access editor ----
const access = reactive({ open: false, saving: false, admin: null as AdminRow | null, roleIds: new Set<string>(), direct: new Set<string>(), origRoles: new Set<string>(), origDirect: new Set<string>(), error: '' })
function openAccess(a: AdminRow) {
  const ids = new Set(a.roles.map((n) => roleByName(n)?.id).filter(Boolean) as string[])
  const direct = new Set(a.direct_permissions ?? [])
  Object.assign(access, { open: true, saving: false, admin: a, roleIds: new Set(ids), origRoles: new Set(ids), direct: new Set(direct), origDirect: new Set(direct), error: '' })
}
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
const accessChanged = computed(() => !sameSet(access.roleIds, access.origRoles) || !sameSet(access.direct, access.origDirect))
const flip = (s: Set<string>, v: string) => (s.has(v) ? s.delete(v) : s.add(v))

async function saveAccess() {
  const a = access.admin!
  const yes = await confirm({ title: `Change access for ${a.name}?`, message: 'The new roles and permissions apply the next time they open a page.', confirmText: 'Save access' })
  if (!yes) return
  access.saving = true; access.error = ''
  try {
    if (canRoles.value && !sameSet(access.roleIds, access.origRoles)) await api.put(`${ACCESS}/admins/${a.id}/roles`, { roles: [...access.roleIds] })
    if (canDirect.value) for (const p of access.direct) if (!access.origDirect.has(p)) await api.post(`${ACCESS}/admins/${a.id}/permissions`, { permission: p })
    if (canDirect.value) for (const p of access.origDirect) if (!access.direct.has(p)) await api.delete(`${ACCESS}/admins/${a.id}/permissions`, { data: { permission: p } })
    toast.success('Access updated.'); access.open = false; await load()
  } catch (e) { access.error = parseError(e).message } finally { access.saving = false }
}

// ---- status & delete ----
async function setActive(a: AdminRow, active: boolean) {
  const yes = await confirm({
    title: active ? `Enable ${a.name}?` : `Disable ${a.name}?`,
    message: active ? 'They will be able to sign in again.' : 'They will be signed out everywhere and cannot sign in until you enable the account again.',
    confirmText: active ? 'Enable account' : 'Disable account', tone: active ? 'primary' : 'danger',
  })
  if (!yes) return
  busyId.value = a.id
  try { await api.patch(`/admin/admins/${a.id}`, { is_active: active }); a.is_active = active; toast.success(active ? 'Account enabled.' : 'Account disabled.') } catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function resend(a: AdminRow) {
  const yes = await confirm({
    title: `Send new login details to ${a.name}?`,
    message: `We will set a new temporary password and email it to ${a.email}. Their current password stops working and they are signed out everywhere.`,
    confirmText: 'Send new details',
  })
  if (!yes) return
  busyId.value = a.id
  try { await api.post(`/admin/admins/${a.id}/resend-credentials`); toast.success(`New login details sent to ${a.email}.`) } catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function remove(a: AdminRow) {
  const yes = await confirm({ title: `Delete ${a.name}?`, message: 'Their account and sign-ins are removed. This cannot be undone.', confirmText: 'Delete administrator', tone: 'danger' })
  if (!yes) return
  busyId.value = a.id
  try { await api.delete(`/admin/admins/${a.id}`); toast.success('Administrator deleted.'); await load() } catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Administrators</h1><p>People who can sign in to this dashboard.</p></div>
      <button v-if="canCreate" type="button" class="btn btn-primary" @click="openCreate"><Plus :size="18" /> New administrator</button>
    </div>

    <div class="card">
      <div class="bar"><label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search name or email" aria-label="Search administrators" @input="onSearch" /></label></div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 44px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><UserCog :size="30" /><p>No administrators found.</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Administrator</th><th>Roles</th><th>Last sign-in</th><th>Active</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="a in rows" :key="a.id">
              <td><div class="who"><UserAvatar :name="a.name" :size="38" /><div><strong>{{ a.name }} <i v-if="isSelf(a)" class="pill grey">You</i></strong><small>{{ a.email }}</small></div></div></td>
              <td><span v-for="r in a.roles" :key="r" class="pill" :class="{ green: r === 'super_admin' }">{{ headline(r) }}</span><span v-if="!a.roles.length" class="muted">None</span></td>
              <td class="muted">{{ formatDateTime(a.last_login_at) }}</td>
              <td>
                <button type="button" class="switch" role="switch" :aria-checked="a.is_active" :aria-label="`${a.is_active ? 'Disable' : 'Enable'} ${a.name}`" :disabled="!canUpdate || isSelf(a) || busyId === a.id" @click="setActive(a, !a.is_active)" />
              </td>
              <td>
                <div class="acts">
                  <button v-if="canAccess" type="button" class="btn btn-ghost btn-sm" :disabled="isSelf(a) && !auth.isSuperAdmin" @click="openAccess(a)"><ShieldCheck :size="15" /> Access</button>
                  <button v-if="canResend && a.is_active && !isSelf(a) && (!isSuperRow(a) || auth.isSuperAdmin)" type="button" class="icon-btn" :aria-label="`Resend login details to ${a.name}`" title="Resend login details" :disabled="busyId === a.id" @click="resend(a)"><Loader2 v-if="busyId === a.id" :size="16" class="spin" /><Mail v-else :size="16" /></button>
                  <button v-if="canDelete && !isSelf(a) && !isSuperRow(a)" type="button" class="icon-btn danger" :aria-label="`Delete ${a.name}`" :disabled="busyId === a.id" @click="remove(a)"><Trash2 :size="16" /></button>
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

    <!-- Create -->
    <Modal :open="form.open" title="New administrator" :width="520" @close="form.open = false">
      <form id="admin-form" class="form" novalidate @submit.prevent="create">
        <p v-if="form.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ form.error }}</p>
        <div><label class="label" for="a-name">Full name</label><input id="a-name" v-model="form.name" class="input" :class="{ invalid: form.errors.name }" autocomplete="off" /><p v-if="form.errors.name" class="err-text">{{ form.errors.name }}</p></div>
        <div><label class="label" for="a-email">Email</label><input id="a-email" v-model.trim="form.email" type="email" class="input" :class="{ invalid: form.errors.email }" autocomplete="off" /><p v-if="form.errors.email" class="err-text">{{ form.errors.email }}</p></div>
        <div>
          <label class="label" for="a-pass">Temporary password <span class="opt-note">(optional)</span></label>
          <div class="field" :class="{ bad: form.errors.password }"><input id="a-pass" v-model="form.password" :type="form.show ? 'text' : 'password'" autocomplete="new-password" /><button type="button" class="eye" :aria-label="form.show ? 'Hide password' : 'Show password'" @click="form.show = !form.show"><EyeOff v-if="form.show" :size="18" /><Eye v-else :size="18" /></button></div>
          <p v-if="form.errors.password" class="err-text">{{ form.errors.password }}</p><p v-else class="hint">Leave blank and we will generate one. Either way it is emailed to them.</p>
        </div>
        <fieldset v-if="roles.length"><legend class="label">Roles</legend>
          <label v-for="r in roles" :key="r.id" class="opt"><input type="checkbox" :checked="form.roleIds.has(r.id)" @change="flip(form.roleIds, r.id)" /><span>{{ r.label }}</span><code>{{ r.permissions_count }} permissions</code></label>
        </fieldset>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="admin-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> Create</button>
      </template>
    </Modal>

    <!-- Access -->
    <Modal :open="access.open" :title="`Access for ${access.admin?.name ?? ''}`" :width="620" @close="access.open = false">
      <div class="form">
        <p v-if="access.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ access.error }}</p>
        <fieldset v-if="canRoles"><legend class="label">Roles</legend>
          <label v-for="r in roles" :key="r.id" class="opt"><input type="checkbox" :checked="access.roleIds.has(r.id)" @change="flip(access.roleIds, r.id)" /><span>{{ r.label }}</span><code>{{ r.permissions_count }} permissions</code></label>
          <p class="hint">An administrator with no role gets the default "admin" role.</p>
        </fieldset>
        <fieldset v-if="canDirect"><legend class="label">Extra permissions</legend>
          <p class="hint">Given on top of their roles, for one person only.</p>
          <div class="chips"><button v-for="p in perms" :key="p.id" type="button" class="chip" :title="p.description || p.name" :class="{ on: access.direct.has(p.name) }" :aria-pressed="access.direct.has(p.name)" @click="flip(access.direct, p.name)">{{ p.name }}</button></div>
        </fieldset>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="access.open = false">Cancel</button>
        <button type="button" class="btn btn-primary" :disabled="access.saving || !accessChanged" @click="saveAccess"><Loader2 v-if="access.saving" :size="16" class="spin" /> Save access</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.opt-note { font-weight: 500; color: var(--text-mute); }
.bar { padding: 16px; border-bottom: 1px solid var(--line); } .bar .field { max-width: 360px; height: 44px; }
.pad { padding: 16px; }
.who { display: flex; align-items: center; gap: 12px; } .who strong { display: flex; align-items: center; gap: 8px; } .who small { display: block; color: var(--text-mute); }
.pill { margin: 0 4px 4px 0; } .muted { color: var(--text-mute); font-size: 14px; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; } .danger { color: var(--danger); }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px; border-top: 1px solid var(--line); color: var(--text-mute); font-size: 14px; }
.form { display: grid; gap: 16px; } fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 4px; min-width: 0; }
.opt { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 12px; cursor: pointer; } .opt input { width: 17px; height: 17px; accent-color: var(--syn-blue-dark); } .opt code { margin-left: auto; font-size: 12.5px; color: var(--text-mute); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.field.bad { border-color: var(--danger); }
.eye { display: grid; place-items: center; width: 32px; height: 32px; background: none; border: 0; color: var(--text-mute); }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
