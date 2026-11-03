<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Loader2, Lock, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { ACCESS } from '@/lib/endpoints'
import { parseError } from '@/lib/errors'
import { headline } from '@/lib/format'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { PermissionItem, Role } from '@/types'

const auth = useAuthStore()
const canCreate = computed(() => auth.can('roles.store'))
const canUpdate = computed(() => auth.can('roles.update'))
const canDelete = computed(() => auth.can('roles.destroy'))
const canSync = computed(() => auth.can('permission.sync'))

const roles = ref<Role[]>([])
const permissions = ref<PermissionItem[]>([])
const loading = ref(true)
const error = ref('')
const syncing = ref(false)

async function load() {
  loading.value = true; error.value = ''
  try {
    const [r, p] = await Promise.all([api.get<{ data: Role[] }>(`${ACCESS}/roles`), api.get<{ data: PermissionItem[] }>(`${ACCESS}/permissions`)])
    roles.value = r.data.data; permissions.value = p.data.data
  } catch (e) { error.value = parseError(e, "Couldn't load roles.").message } finally { loading.value = false }
}
onMounted(load)

const groups = computed(() => {
  const map = new Map<string, PermissionItem[]>()
  for (const p of permissions.value) map.set(p.group, [...(map.get(p.group) ?? []), p])
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

// ---- editor ----
const editor = reactive({ open: false, loading: false, saving: false, role: null as Role | null, name: '', selected: new Set<string>(), original: new Set<string>(), nameError: '', error: '' })
const isSuper = computed(() => editor.role?.name === 'super_admin')
const readOnly = computed(() => (editor.role ? !canUpdate.value : !canCreate.value) || isSuper.value)

function openNew() {
  Object.assign(editor, { open: true, loading: false, saving: false, role: null, name: '', selected: new Set<string>(), original: new Set<string>(), nameError: '', error: '' })
}
async function openEdit(r: Role) {
  Object.assign(editor, { open: true, loading: true, saving: false, role: r, name: r.name, selected: new Set<string>(), original: new Set<string>(), nameError: '', error: '' })
  try {
    const { data } = await api.get<{ data: Role }>(`${ACCESS}/roles/${r.id}`)
    const set = new Set(data.data.permissions ?? [])
    editor.selected = isSuperRole(r) ? new Set(permissions.value.map((p) => p.name)) : set
    editor.original = new Set(set)
  } catch (e) { editor.error = parseError(e).message } finally { editor.loading = false }
}
const isSuperRole = (r: Role) => r.name === 'super_admin'

function toggle(name: string) {
  if (readOnly.value) return
  editor.selected.has(name) ? editor.selected.delete(name) : editor.selected.add(name)
}
const groupState = (items: PermissionItem[]) => {
  const n = items.filter((i) => editor.selected.has(i.name)).length
  return n === 0 ? 'none' : n === items.length ? 'all' : 'some'
}
function toggleGroup(items: PermissionItem[]) {
  if (readOnly.value) return
  const all = groupState(items) === 'all'
  items.forEach((i) => (all ? editor.selected.delete(i.name) : editor.selected.add(i.name)))
}
const changed = computed(() => editor.selected.size !== editor.original.size || [...editor.selected].some((p) => !editor.original.has(p)))

function normalizeName() { editor.name = editor.name.trim().toLowerCase().replace(/[\s-]+/g, '_') }

async function save() {
  normalizeName(); editor.nameError = ''; editor.error = ''
  if (!/^[a-z][a-z0-9_]{1,48}$/.test(editor.name)) { editor.nameError = 'Use 2 to 49 lowercase letters, numbers or underscores, starting with a letter.'; return }
  const r = editor.role
  if (r && changed.value && (r.admins_count ?? 0) > 0) {
    const yes = await confirm({
      title: 'Change permissions for this role?',
      message: `${r.admins_count} administrator${r.admins_count === 1 ? '' : 's'} with this role will get the new access right away.`,
      confirmText: 'Save changes',
    })
    if (!yes) return
  }
  editor.saving = true
  const body = { name: editor.name, permissions: [...editor.selected] }
  try {
    if (r) await api.patch(`${ACCESS}/roles/${r.id}`, isSuper.value ? { name: editor.name } : body)
    else await api.post(`${ACCESS}/roles`, body)
    toast.success(r ? 'Role updated.' : 'Role created.')
    editor.open = false
    await load()
    if (r) auth.refreshProfile()
  } catch (e) {
    const err = parseError(e)
    if (err.fields.name) editor.nameError = err.fields.name
    else editor.error = err.message
  } finally { editor.saving = false }
}

async function remove(r: Role) {
  const n = r.admins_count ?? 0
  const yes = await confirm({
    title: `Delete the "${r.label}" role?`,
    message: n ? `${n} administrator${n === 1 ? ' has' : 's have'} this role and will lose the access it gives. This cannot be undone.` : 'This cannot be undone.',
    confirmText: 'Delete role', tone: 'danger',
  })
  if (!yes) return
  try { await api.delete(`${ACCESS}/roles/${r.id}`); toast.success('Role deleted.'); await load() } catch (e) { toast.error(parseError(e).message) }
}

async function sync() {
  const yes = await confirm({
    title: 'Sync permissions from the API?',
    message: 'This adds any new permissions the API routes ask for. Nothing is removed and no role changes.',
    confirmText: 'Sync now',
  })
  if (!yes) return
  syncing.value = true
  try { await api.post(`${ACCESS}/permissions/sync`, { prune: false }); toast.success('Permissions synced.'); await load() } catch (e) { toast.error(parseError(e).message) } finally { syncing.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Roles &amp; permissions</h1><p>Decide what each kind of administrator can see and do.</p></div>
      <div v-if="canSync || canCreate" class="head-actions">
        <button v-if="canSync" type="button" class="btn btn-ghost" :disabled="syncing" @click="sync"><Loader2 v-if="syncing" :size="16" class="spin" /><RefreshCw v-else :size="16" /> Sync permissions</button>
        <button v-if="canCreate" type="button" class="btn btn-primary" @click="openNew"><Plus :size="18" /> New role</button>
      </div>
    </div>

    <div v-if="loading" class="grid"><div v-for="i in 3" :key="i" class="card role"><span class="skeleton" style="height: 18px; width: 50%" /><span class="skeleton" style="height: 14px; width: 80%" /><span class="skeleton" style="height: 36px" /></div></div>
    <div v-else-if="error" class="card empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
    <div v-else class="grid">
      <article v-for="r in roles" :key="r.id" class="card role">
        <div class="r-top">
          <span class="ico" :class="{ gold: r.name === 'super_admin' }"><ShieldCheck :size="20" /></span>
          <div><h3>{{ r.label }}</h3><code>{{ r.name }}</code></div>
          <span v-if="r.is_system" class="pill grey"><Lock :size="11" /> System</span>
        </div>
        <p class="stats">
          <span><Users :size="15" /> {{ r.admins_count ?? 0 }} admin{{ r.admins_count === 1 ? '' : 's' }}</span>
          <span><ShieldCheck :size="15" /> {{ r.name === 'super_admin' ? 'All' : r.permissions_count }} permissions</span>
        </p>
        <div class="r-actions">
          <button type="button" class="btn btn-ghost btn-sm" @click="openEdit(r)"><Pencil :size="15" /> {{ canUpdate && r.name !== 'super_admin' ? 'Edit' : 'View' }}</button>
          <button v-if="canDelete && !r.is_system" type="button" class="btn btn-ghost btn-sm danger" :aria-label="`Delete ${r.label}`" @click="remove(r)"><Trash2 :size="15" /> Delete</button>
        </div>
      </article>
    </div>

    <Modal :open="editor.open" :title="editor.role ? (readOnly ? editor.role.label : `Edit ${editor.role.label}`) : 'New role'" :width="720" @close="editor.open = false">
      <div v-if="editor.loading" class="center"><Loader2 :size="22" class="spin" /></div>
      <form v-else id="role-form" class="form" novalidate @submit.prevent="save">
        <p v-if="editor.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ editor.error }}</p>
        <p v-if="isSuper" class="notice">The super admin role always has every permission and cannot be changed.</p>
        <div>
          <label class="label" for="rname">Role name</label>
          <input id="rname" v-model="editor.name" class="input" :class="{ invalid: editor.nameError }" :disabled="readOnly || editor.role?.is_system" placeholder="support_agent" autocomplete="off" @blur="normalizeName" />
          <p v-if="editor.nameError" class="err-text">{{ editor.nameError }}</p>
          <p v-else-if="editor.role?.is_system" class="hint">System roles keep their name.</p>
          <p v-else class="hint">Lowercase with underscores, for example support_agent.</p>
        </div>

        <fieldset :disabled="readOnly">
          <legend class="label">Permissions <span class="pill">{{ editor.selected.size }} selected</span></legend>
          <p v-if="!groups.length" class="hint">No permissions yet. Use "Sync permissions" first.</p>
          <div v-for="g in groups" :key="g.name" class="pgroup">
            <button type="button" class="pg-head" :disabled="readOnly" @click="toggleGroup(g.items)">
              <span class="cb" :class="groupState(g.items)" aria-hidden="true" />
              <strong>{{ headline(g.name) }}</strong>
            </button>
            <div class="plist">
              <label v-for="p in g.items" :key="p.id" class="perm" :title="p.description || p.name">
                <input type="checkbox" :checked="editor.selected.has(p.name)" :disabled="readOnly" @change="toggle(p.name)" />
                <span class="ptext">
                  <span class="pname">{{ headline(p.name.slice(g.name.length + 1)) }}</span>
                  <small v-if="p.description">{{ p.description }}</small>
                </span>
                <code>{{ p.name }}</code>
              </label>
            </div>
          </div>
        </fieldset>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="editor.open = false">{{ readOnly ? 'Close' : 'Cancel' }}</button>
        <button v-if="!readOnly" type="submit" form="role-form" class="btn btn-primary" :disabled="editor.saving || editor.loading || (!!editor.role && !changed && editor.name === editor.role.name)">
          <Loader2 v-if="editor.saving" :size="16" class="spin" /> {{ editor.role ? 'Save changes' : 'Create role' }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.head-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.role { display: grid; gap: 14px; padding: 20px; align-content: start; }
.r-top { display: flex; align-items: center; gap: 12px; }
.r-top > div { flex: 1; min-width: 0; }
h3 { font-family: var(--font-display); font-size: 17px; font-weight: 600; }
code { font-size: 12.5px; color: var(--text-mute); }
.ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.ico.gold { color: #8a5a00; background: rgba(255, 184, 0, 0.18); }
.stats { display: flex; gap: 16px; flex-wrap: wrap; color: var(--text-dim); font-size: 14px; }
.stats span { display: inline-flex; align-items: center; gap: 6px; }
.r-actions { display: flex; gap: 8px; }
.danger { color: var(--danger); }
.center { display: grid; place-items: center; padding: 40px; }
.form { display: grid; gap: 18px; }
fieldset { margin: 0; padding: 0; border: 0; min-width: 0; display: grid; gap: 10px; }
legend { padding: 0; display: flex; align-items: center; gap: 8px; }
.pgroup { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.pg-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; text-align: left; background: rgba(4, 20, 59, 0.03); border: 0; border-bottom: 1px solid var(--line); }
.cb { position: relative; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid rgba(4, 20, 59, 0.35); background: #fff; }
.cb.all, .cb.some { background: var(--syn-blue-dark); border-color: var(--syn-blue-dark); }
.cb.all::after { content: ''; position: absolute; left: 5px; top: 1px; width: 5px; height: 10px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.cb.some::after { content: ''; position: absolute; left: 3px; right: 3px; top: 7px; height: 2px; background: #fff; }
.plist { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.perm { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; cursor: pointer; font-size: 14.5px; }
.perm:hover { background: rgba(0, 102, 255, 0.04); }
.perm input { width: 17px; height: 17px; margin-top: 2px; flex: none; accent-color: var(--syn-blue-dark); }
.ptext { display: grid; min-width: 0; line-height: 1.35; }
.pname { font-weight: 600; }
.ptext small { color: var(--text-mute); font-size: 13px; }
.perm code { margin-left: auto; flex: none; padding-top: 2px; }
.alert { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.notice { padding: 10px 12px; font-size: 14px; color: #0b3d91; background: rgba(0, 102, 255, 0.07); border: 1px solid rgba(0, 102, 255, 0.25); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .perm code { display: none; } }
</style>
