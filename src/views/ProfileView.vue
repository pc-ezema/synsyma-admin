<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Camera, Check, Circle, Eye, EyeOff, KeyRound, Loader2, Mail, Trash2, UserRound } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime, headline } from '@/lib/format'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import type { AdminUser } from '@/types'

type Profile = AdminUser & { last_login_at?: string | null; created_at?: string | null }

const auth = useAuthStore()
const profile = ref<Profile | null>(null)
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true; loadError.value = ''
  try {
    const { data } = await api.get<{ data: Profile }>('/admin/profile')
    profile.value = data.data
    info.name = data.data.name
    info.phone = data.data.phone ?? ''
  } catch (e) { loadError.value = parseError(e, "Couldn't load your profile.").message } finally { loading.value = false }
}
onMounted(load)

function apply(p: Profile) {
  profile.value = p
  auth.applyProfile({ name: p.name, phone: p.phone ?? null, photo_url: p.photo_url ?? null })
}

// ---- details ----
const info = reactive({ name: '', phone: '', saving: false, errors: {} as Record<string, string>, error: '' })
const infoChanged = computed(() => !!profile.value && (info.name.trim() !== profile.value.name || info.phone.trim() !== (profile.value.phone ?? '')))

async function saveInfo() {
  info.errors = {}; info.error = ''
  if (info.name.trim().length < 2) { info.errors.name = 'Enter your name.'; return }
  info.saving = true
  try {
    const { data } = await api.patch<{ data: Profile }>('/admin/profile', { name: info.name.trim(), phone: info.phone.trim() || null })
    apply(data.data)
    toast.success('Profile updated.')
  } catch (e) {
    const err = parseError(e)
    info.errors = err.fields
    if (!Object.keys(err.fields).length) info.error = err.message
  } finally { info.saving = false }
}

// ---- photo ----
const fileInput = ref<HTMLInputElement | null>(null)
const photoBusy = ref(false)
const okTypes = ['image/jpeg', 'image/png', 'image/webp']

async function pickPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!okTypes.includes(f.type)) return toast.error('Use a JPG, PNG or WebP photo.')
  if (f.size > 2 * 1024 * 1024) return toast.error('The photo must be 2MB or smaller.')
  photoBusy.value = true
  try {
    const form = new FormData(); form.append('photo', f)
    const { data } = await api.post<{ data: Profile }>('/admin/profile/photo', form)
    apply(data.data); toast.success('Photo updated.')
  } catch (err) { toast.error(parseError(err).message) } finally { photoBusy.value = false }
}

async function removePhoto() {
  const yes = await confirm({ title: 'Remove your photo?', message: 'Your initials will show instead. You can upload a new photo any time.', confirmText: 'Remove photo', tone: 'danger' })
  if (!yes) return
  photoBusy.value = true
  try {
    const { data } = await api.delete<{ data: Profile }>('/admin/profile/photo')
    apply(data.data); toast.success('Photo removed.')
  } catch (err) { toast.error(parseError(err).message) } finally { photoBusy.value = false }
}

// ---- password ----
const pw = reactive({ current: '', next: '', again: '', show: false, saving: false, errors: {} as Record<string, string>, error: '' })
const rules = computed(() => [
  { ok: pw.next.length >= 8, text: 'At least 8 characters' },
  { ok: /[A-Za-z]/.test(pw.next), text: 'A letter' },
  { ok: /\d/.test(pw.next), text: 'A number' },
  { ok: pw.next.length > 0 && pw.next === pw.again, text: 'Both passwords match' },
])
const pwReady = computed(() => !!pw.current && rules.value.every((r) => r.ok))

async function savePassword() {
  pw.errors = {}; pw.error = ''
  if (!pwReady.value) { pw.error = 'Fill in every field and meet the rules below.'; return }
  if (pw.next === pw.current) { pw.errors.password = 'Choose a password different from your current one.'; return }
  const yes = await confirm({
    title: 'Change your password?',
    message: 'You will stay signed in here. Every other device will be signed out.',
    confirmText: 'Change password',
  })
  if (!yes) return
  pw.saving = true
  try {
    await api.put('/admin/profile/password', { current_password: pw.current, password: pw.next, password_confirmation: pw.again })
    pw.current = pw.next = pw.again = ''
    toast.success('Password changed. Other devices were signed out.')
  } catch (e) {
    const err = parseError(e)
    pw.errors = err.fields
    if (!Object.keys(err.fields).length) pw.error = err.message
    if (err.fields.current_password) pw.current = ''
  } finally { pw.saving = false }
}
</script>

<template>
  <div class="page">
    <div class="page-head"><div><h1>My profile</h1><p>Your details, photo and password.</p></div></div>

    <div v-if="loading" class="stack"><div class="card pad"><span class="skeleton" style="height: 84px; width: 84px; border-radius: 50%" /><span class="skeleton" style="height: 18px; width: 40%; margin-top: 14px" /></div></div>
    <div v-else-if="loadError" class="card empty"><AlertCircle :size="28" /><p>{{ loadError }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>

    <div v-else-if="profile" class="stack">
      <!-- identity -->
      <section class="card pad identity">
        <div class="av">
          <UserAvatar :name="profile.name" :src="profile.photo_url" :size="88" />
          <span v-if="photoBusy" class="av-busy"><Loader2 :size="22" class="spin" /></span>
        </div>
        <div class="who">
          <h2>{{ profile.name }}</h2>
          <p class="muted">{{ profile.email }}</p>
          <p class="roles"><span v-for="r in profile.roles" :key="r" class="pill" :class="{ green: r === 'super_admin' }">{{ headline(r) }}</span></p>
          <div class="photo-actions">
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="pickPhoto" />
            <button type="button" class="btn btn-ghost btn-sm" :disabled="photoBusy" @click="fileInput?.click()"><Camera :size="15" /> {{ profile.photo_url ? 'Change photo' : 'Upload photo' }}</button>
            <button v-if="profile.photo_url" type="button" class="btn btn-ghost btn-sm danger" :disabled="photoBusy" @click="removePhoto"><Trash2 :size="15" /> Remove</button>
          </div>
        </div>
        <dl class="facts">
          <div><dt>Last sign-in</dt><dd>{{ formatDateTime(profile.last_login_at) }}</dd></div>
          <div><dt>Member since</dt><dd>{{ formatDateTime(profile.created_at) }}</dd></div>
        </dl>
      </section>

      <!-- details -->
      <form class="card pad form" novalidate @submit.prevent="saveInfo">
        <h3><UserRound :size="18" /> Personal details</h3>
        <p v-if="info.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ info.error }}</p>
        <div class="two">
          <div><label class="label" for="p-name">Full name</label><input id="p-name" v-model="info.name" class="input" :class="{ invalid: info.errors.name }" autocomplete="name" /><p v-if="info.errors.name" class="err-text">{{ info.errors.name }}</p></div>
          <div><label class="label" for="p-phone">Phone <span class="opt">(optional)</span></label><input id="p-phone" v-model="info.phone" class="input" :class="{ invalid: info.errors.phone }" inputmode="tel" autocomplete="tel" placeholder="+234 801 234 5678" /><p v-if="info.errors.phone" class="err-text">{{ info.errors.phone }}</p></div>
        </div>
        <div>
          <label class="label" for="p-email">Email</label>
          <div class="field locked"><Mail :size="17" /><input id="p-email" :value="profile.email" disabled /></div>
          <p class="hint">Your email is your sign-in. Ask a super admin if it needs to change.</p>
        </div>
        <div class="actions"><button type="submit" class="btn btn-primary" :disabled="info.saving || !infoChanged"><Loader2 v-if="info.saving" :size="16" class="spin" /> Save changes</button></div>
      </form>

      <!-- password -->
      <form class="card pad form" novalidate @submit.prevent="savePassword">
        <h3><KeyRound :size="18" /> Change password</h3>
        <p v-if="pw.error" class="alert" role="alert"><AlertCircle :size="16" /> {{ pw.error }}</p>
        <div>
          <label class="label" for="pw-cur">Current password</label>
          <div class="field" :class="{ bad: pw.errors.current_password }"><input id="pw-cur" v-model="pw.current" :type="pw.show ? 'text' : 'password'" autocomplete="current-password" /></div>
          <p v-if="pw.errors.current_password" class="err-text">{{ pw.errors.current_password }}</p>
        </div>
        <div class="two">
          <div>
            <label class="label" for="pw-new">New password</label>
            <div class="field" :class="{ bad: pw.errors.password }"><input id="pw-new" v-model="pw.next" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" /></div>
            <p v-if="pw.errors.password" class="err-text">{{ pw.errors.password }}</p>
          </div>
          <div>
            <label class="label" for="pw-again">Confirm new password</label>
            <div class="field"><input id="pw-again" v-model="pw.again" :type="pw.show ? 'text' : 'password'" autocomplete="new-password" /><button type="button" class="eye" :aria-label="pw.show ? 'Hide passwords' : 'Show passwords'" @click="pw.show = !pw.show"><EyeOff v-if="pw.show" :size="18" /><Eye v-else :size="18" /></button></div>
          </div>
        </div>
        <ul class="rules"><li v-for="r in rules" :key="r.text" :class="{ ok: r.ok }"><Check v-if="r.ok" :size="14" /><Circle v-else :size="14" /> {{ r.text }}</li></ul>
        <div class="actions"><button type="submit" class="btn btn-primary" :disabled="pw.saving || !pwReady"><Loader2 v-if="pw.saving" :size="16" class="spin" /> Change password</button></div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page { width: 100%; }
.stack { display: grid; gap: 18px; grid-template-columns: 1fr; }
@media (min-width: 1100px) {
  .stack { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .identity { grid-column: 1 / -1; }
}
.pad { padding: 22px; }
.muted { color: var(--text-mute); }
.identity { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center; }
.av { position: relative; }
.av-busy { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%; color: #fff; background: rgba(4, 20, 59, 0.55); }
.who h2 { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
.roles { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.photo-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.danger { color: var(--danger); }
.facts { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 4px 0 0; padding-top: 16px; border-top: 1px solid var(--line); }
.facts dt { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-mute); }
.facts dd { margin: 2px 0 0; font-weight: 600; }
.form { display: grid; gap: 16px; }
.form h3 { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 17px; font-weight: 600; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.opt { font-weight: 500; color: var(--text-mute); }
.field.locked { background: rgba(4, 20, 59, 0.04); }
.field.locked input { color: var(--text-dim); cursor: not-allowed; }
.field.bad { border-color: var(--danger); }
.eye { display: grid; place-items: center; width: 32px; height: 32px; margin-right: -6px; background: none; border: 0; border-radius: 8px; color: var(--text-mute); }
.eye:hover { color: var(--blue-ink); background: rgba(4, 20, 59, 0.06); }
.rules { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; color: var(--text-mute); }
.rules li { display: inline-flex; align-items: center; gap: 6px; }
.rules li.ok { color: var(--green-ink); }
.actions { display: flex; justify-content: flex-end; }
.alert { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } .identity { grid-template-columns: 1fr; justify-items: start; } }
</style>
