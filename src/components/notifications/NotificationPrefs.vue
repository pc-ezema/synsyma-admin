<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertCircle, Bell, BellOff, BellRing, Loader2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { disableAdminPush, enableAdminPush, pushConfigured, pushState, pushSupported } from '@/lib/push'
import type { AlertPref } from '@/types'

const auth = useAuthStore()
const types = ref<AlertPref[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const busy = ref(false)
let t: number | undefined

const pushOn = computed(() => pushState.registered)

async function load() {
  loading.value = true; error.value = ''
  try { types.value = (await api.get<{ data: { types: AlertPref[] } }>('/admin/notifications/preferences')).data.data.types }
  catch (e) { error.value = parseError(e, "Couldn't load your alert settings.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))

/** Saves a moment after the last tick, so several quick changes go out as one request. */
function changed() { window.clearTimeout(t); t = window.setTimeout(save, 500) }
async function save() {
  saving.value = true
  try {
    const prefs = Object.fromEntries(types.value.map((p) => [p.type, { push: p.push, email: p.email }]))
    await api.put('/admin/notifications/preferences', { prefs })
    toast.success('Alert settings saved.')
  } catch (e) { toast.error(parseError(e).message) } finally { saving.value = false }
}

async function turnOn() {
  busy.value = true
  try {
    const r = await enableAdminPush()
    if (r === 'enabled') toast.success('Browser alerts are on for this browser.')
    else if (r === 'denied') toast.error('Alerts are blocked. Allow notifications for this site in your browser settings.')
  } catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}
async function turnOff() { busy.value = true; try { await disableAdminPush(); toast.success('Browser alerts are off for this browser.') } finally { busy.value = false } }
</script>

<template>
  <section class="card pad prefs">
    <h3><Bell :size="18" /> Alerts</h3>
    <p class="hint">Choose what reaches you. Alerts always appear in the bell. Push goes to every browser where you turned alerts on, and email goes to {{ auth.user?.email }}.</p>

    <div class="browser">
      <template v-if="pushOn"><BellRing :size="17" /><span>Browser alerts are <strong>on</strong> in this browser.</span><button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="turnOff">Turn off</button></template>
      <template v-else-if="pushState.denied"><BellOff :size="17" /><span>This browser is blocking alerts. Allow notifications for this site in its settings, then reload.</span></template>
      <template v-else-if="pushSupported()"><BellOff :size="17" /><span>Browser alerts are <strong>off</strong> in this browser.</span><button type="button" class="btn btn-primary btn-sm" :disabled="busy" @click="turnOn"><Loader2 v-if="busy" :size="15" class="spin" /> Turn on</button></template>
      <template v-else><BellOff :size="17" /><span>{{ pushConfigured() ? 'This browser cannot show alerts.' : 'Browser alerts are not set up for this dashboard yet.' }}</span></template>
    </div>

    <div v-if="loading" class="pad0"><span v-for="i in 3" :key="i" class="skeleton" style="height: 40px; margin-bottom: 8px" /></div>
    <p v-else-if="error" class="alert" role="alert"><AlertCircle :size="16" /> {{ error }} <button type="button" class="btn btn-ghost btn-sm" @click="load">Try again</button></p>
    <p v-else-if="!types.length" class="hint">Your role has no alerts to send you yet.</p>
    <table v-else class="grid">
      <thead><tr><th>Alert</th><th>Browser push</th><th>Email</th></tr></thead>
      <tbody>
        <tr v-for="p in types" :key="p.type">
          <td>{{ p.label }}</td>
          <td><label class="tick"><input v-model="p.push" type="checkbox" :aria-label="`${p.label} by browser push`" @change="changed"><span class="sr-only">Push</span></label></td>
          <td><label class="tick"><input v-model="p.email" type="checkbox" :aria-label="`${p.label} by email`" @change="changed"><span class="sr-only">Email</span></label></td>
        </tr>
      </tbody>
    </table>
    <p v-if="saving" class="hint"><Loader2 :size="14" class="spin" /> Saving...</p>
  </section>
</template>

<style scoped>
.prefs { display: grid; gap: 14px; }
.prefs h3 { display: flex; align-items: center; gap: 8px; margin: 0; }
.hint { margin: 0; color: var(--text-mute); font-size: 14px; display: flex; align-items: center; gap: 6px; }
.browser { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 14px; border-radius: 12px; background: rgba(0, 102, 255, 0.06); font-size: 14px; }
.browser span { flex: 1 1 200px; }
.grid { width: 100%; border-collapse: collapse; }
.grid th { text-align: left; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-mute); padding: 6px 0; }
.grid th:nth-child(n + 2), .grid td:nth-child(n + 2) { text-align: center; width: 110px; }
.grid td { padding: 11px 0; border-top: 1px solid var(--line); }
.tick { display: inline-grid; place-items: center; min-width: 40px; min-height: 40px; cursor: pointer; }
.tick input { width: 18px; height: 18px; accent-color: var(--blue); cursor: pointer; }
.alert { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(214, 69, 69, 0.08); color: var(--danger); font-size: 14px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>