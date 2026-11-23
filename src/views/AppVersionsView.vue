<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Apple, Loader2, Smartphone } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'

type Platform = 'ios' | 'android'
interface Row { platform: Platform; min_version: string; latest_version: string; store_url: string | null; message: string | null }

const auth = useAuthStore()
const canManage = computed(() => auth.can('settings.manage'))
const platforms: { key: Platform; label: string; icon: typeof Apple }[] = [
  { key: 'ios', label: 'iOS (App Store)', icon: Apple }, { key: 'android', label: 'Android (Google Play)', icon: Smartphone },
]

const blank = () => ({ min_version: '', latest_version: '', store_url: '', message: '' })
const form = reactive<Record<Platform, ReturnType<typeof blank>>>({ ios: blank(), android: blank() })
const saved = reactive<Record<Platform, string>>({ ios: '', android: '' })
const errors = reactive<Record<Platform, Record<string, string>>>({ ios: {}, android: {} })
const saving = reactive<Record<Platform, boolean>>({ ios: false, android: false })
const loading = ref(true)
const error = ref('')

function fill(r: Row) {
  form[r.platform] = { min_version: r.min_version, latest_version: r.latest_version, store_url: r.store_url ?? '', message: r.message ?? '' }
  saved[r.platform] = r.min_version
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: Record<Platform, Row> }>('/admin/app-versions')
    ;(Object.values(data.data) as Row[]).forEach(fill)
  } catch (e) { error.value = parseError(e, "Couldn't load app versions.").message } finally { loading.value = false }
}
onMounted(load)

const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0 }

async function save(p: Platform, label: string) {
  const f = form[p]; const e = errors[p]
  Object.keys(e).forEach((k) => delete e[k])
  f.min_version = f.min_version.trim(); f.latest_version = f.latest_version.trim()
  if (!VERSION.test(f.min_version)) e.min_version = 'Use the form 1.2.3.'
  if (!VERSION.test(f.latest_version)) e.latest_version = 'Use the form 1.2.3.'
  if (!e.min_version && !e.latest_version && cmp(f.min_version, f.latest_version) > 0) e.latest_version = 'The latest version cannot be lower than the minimum.'
  if (f.store_url.trim() && !/^https?:\/\//i.test(f.store_url.trim())) e.store_url = 'Enter a full link starting with https://'
  if (Object.keys(e).length) return

  // Raising the minimum locks people out until they update: confirm it.
  if (cmp(f.min_version, saved[p]) > 0) {
    const yes = await confirm({
      title: `Force ${label} users to update?`,
      message: `Everyone on ${label} below ${f.min_version} will be blocked until they update. Only do this once ${f.min_version} is live in the store.`,
      confirmText: 'Force update', tone: 'danger',
    })
    if (!yes) return
  }

  saving[p] = true
  try {
    const res = await api.put<{ message: string; data: Row }>(`/admin/app-versions/${p}`, {
      min_version: f.min_version, latest_version: f.latest_version,
      store_url: f.store_url.trim() || null, message: f.message.trim() || null,
    })
    fill(res.data.data); toast.success(res.data.message)
  } catch (err) {
    const pe = parseError(err)
    if (pe.fields) Object.entries(pe.fields).forEach(([k, v]) => { e[k] = String(v) })
    else toast.error(pe.message)
  } finally { saving[p] = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>App versions</h1><p>Control which app versions can run. Below the minimum, the app is blocked until the person updates. Below the latest, they only see a gentle "update available" notice.</p></div>
    </div>

    <div v-if="loading" class="card pad"><span v-for="i in 3" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <div v-else class="stack">
      <form v-for="pl in platforms" :key="pl.key" class="card box" novalidate @submit.prevent="save(pl.key, pl.label)">
        <h2><component :is="pl.icon" :size="18" /> {{ pl.label }}</h2>
        <div class="row">
          <div>
            <label class="label" :for="pl.key + 'a'">Minimum version (forced)</label>
            <input :id="pl.key + 'a'" v-model="form[pl.key].min_version" class="input" placeholder="1.0.0" :readonly="!canManage" :class="{ invalid: errors[pl.key].min_version }">
            <p v-if="errors[pl.key].min_version" class="err-text">{{ errors[pl.key].min_version }}</p>
          </div>
          <div>
            <label class="label" :for="pl.key + 'b'">Latest version (optional nudge)</label>
            <input :id="pl.key + 'b'" v-model="form[pl.key].latest_version" class="input" placeholder="1.0.0" :readonly="!canManage" :class="{ invalid: errors[pl.key].latest_version }">
            <p v-if="errors[pl.key].latest_version" class="err-text">{{ errors[pl.key].latest_version }}</p>
          </div>
          <div class="wide">
            <label class="label" :for="pl.key + 'c'">Store link</label>
            <input :id="pl.key + 'c'" v-model="form[pl.key].store_url" class="input" :placeholder="pl.key === 'ios' ? 'https://apps.apple.com/app/id…' : 'https://play.google.com/store/apps/details?id=…'" :readonly="!canManage" :class="{ invalid: errors[pl.key].store_url }">
            <p v-if="errors[pl.key].store_url" class="err-text">{{ errors[pl.key].store_url }}</p>
          </div>
          <div class="wide">
            <label class="label" :for="pl.key + 'd'">Message (optional)</label>
            <input :id="pl.key + 'd'" v-model="form[pl.key].message" class="input" maxlength="300" placeholder="A new version with important improvements is ready." :readonly="!canManage">
          </div>
        </div>
        <div v-if="canManage" class="bar"><button type="submit" class="btn btn-primary" :disabled="saving[pl.key]"><Loader2 v-if="saving[pl.key]" :size="16" class="spin" />{{ saving[pl.key] ? 'Saving…' : 'Save ' + pl.label }}</button></div>
      </form>
      <p class="note">Release order: publish the new build to the store first. Raise the minimum only once it is live, otherwise people are sent to the store with nothing to install.</p>
    </div>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.stack { display: grid; gap: 16px; max-width: 860px; }
.box { padding: 20px; }
h2 { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.row { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; margin: 12px 0 16px; }
.row .wide { grid-column: 1 / -1; }
.bar { display: flex; }
.note { font-size: 13px; color: var(--text-mute); line-height: 1.5; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
</style>