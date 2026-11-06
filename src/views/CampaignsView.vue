<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import QRCode from 'qrcode'
import { AlertCircle, Copy, Download, Loader2, Plus, QrCode, Trash2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import Modal from '@/components/ui/Modal.vue'
import type { ContractorCampaign } from '@/types'

const auth = useAuthStore()
const canManage = computed(() => auth.can('campaigns.manage'))

const rows = ref<ContractorCampaign[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)
const images = reactive<Record<string, string>>({})

/** The page a scan opens. Set VITE_PUBLIC_URL if the public site lives on another address. */
const base = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin).replace(/\/$/, '')
const linkFor = (c: ContractorCampaign) => `${base}/?ref=${c.code}`

async function draw(c: ContractorCampaign) {
  if (images[c.code]) return
  try { images[c.code] = await QRCode.toDataURL(linkFor(c), { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#04143B', light: '#FFFFFF' } }) }
  catch { /* the card shows the link without a picture */ }
}
async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await api.get<{ data: ContractorCampaign[] }>('/admin/contractor-campaigns')).data.data; rows.value.forEach(draw) }
  catch (e) { error.value = parseError(e, "Couldn't load QR codes.").message } finally { loading.value = false }
}
onMounted(load)

const form = reactive({ open: false, name: '', error: '', saving: false })
function openAdd() { Object.assign(form, { open: true, name: '', error: '', saving: false }) }
async function create() {
  if (form.name.trim().length < 2) { form.error = 'Give it a name, like "Toronto flyers".'; return }
  form.saving = true; form.error = ''
  try { await api.post('/admin/contractor-campaigns', { name: form.name.trim() }); toast.success('QR code created.'); form.open = false; await load() }
  catch (e) { form.error = parseError(e).message } finally { form.saving = false }
}

async function copy(c: ContractorCampaign) {
  try { await navigator.clipboard.writeText(linkFor(c)); toast.success('Link copied.') } catch { toast.error("Couldn't copy. Select the link and copy it.") }
}
function download(c: ContractorCampaign) {
  const url = images[c.code]; if (!url) return
  const a = document.createElement('a'); a.href = url; a.download = `synsyma-join-${c.code}.png`; a.click()
}
async function setActive(c: ContractorCampaign, active: boolean) {
  if (!active) {
    const yes = await confirm({ title: `Switch off ${c.name}?`, message: 'People who scan it can still apply, but it will no longer be counted for this advert.', confirmText: 'Switch off', tone: 'danger' })
    if (!yes) return
  }
  busyId.value = c.id
  try { await api.patch(`/admin/contractor-campaigns/${c.id}`, { is_active: active }); c.is_active = active; toast.success(active ? 'QR code is on.' : 'QR code is off.') }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
async function remove(c: ContractorCampaign) {
  const yes = await confirm({ title: `Remove ${c.name}?`, message: 'Printed copies of this QR code will stop being counted. This cannot be undone.', confirmText: 'Remove QR code', tone: 'danger' })
  if (!yes) return
  busyId.value = c.id
  try { await api.delete(`/admin/contractor-campaigns/${c.id}`); toast.success('QR code removed.'); await load() }
  catch (e) { toast.error(parseError(e).message) } finally { busyId.value = null }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>QR codes</h1><p>Print one on each advert. Scanning it opens the contractor sign-up page, and you see which advert works.</p></div>
      <button v-if="canManage" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New QR code</button>
    </div>

    <div v-if="loading && !rows.length" class="cards"><span v-for="i in 3" :key="i" class="skeleton" style="height: 330px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>
    <div v-else-if="!rows.length" class="card"><div class="empty"><QrCode :size="30" /><p>No QR codes yet.</p><button v-if="canManage" type="button" class="btn btn-primary" @click="openAdd"><Plus :size="18" /> New QR code</button></div></div>

    <div v-else class="cards">
      <article v-for="c in rows" :key="c.id" class="card qr" :class="{ off: !c.is_active }">
        <header>
          <div><h2>{{ c.name }}</h2><small>{{ c.is_active ? 'On' : 'Off' }}</small></div>
          <button v-if="canManage" type="button" class="switch" role="switch" :aria-checked="c.is_active" :aria-label="`${c.is_active ? 'Switch off' : 'Switch on'} ${c.name}`" :disabled="busyId === c.id" @click="setActive(c, !c.is_active)" />
        </header>
        <div class="img"><img v-if="images[c.code]" :src="images[c.code]" :alt="`QR code for ${c.name}`" width="200" height="200" /><span v-else class="skeleton" style="width: 200px; height: 200px" /></div>
        <p class="link">{{ linkFor(c) }}</p>
        <dl><div><dt>Scans</dt><dd>{{ c.scans }}</dd></div><div><dt>Applications</dt><dd>{{ c.signups }}</dd></div></dl>
        <footer>
          <button type="button" class="btn btn-ghost btn-sm" @click="copy(c)"><Copy :size="15" /> Copy link</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="!images[c.code]" @click="download(c)"><Download :size="15" /> Download</button>
          <button v-if="canManage" type="button" class="icon-btn danger" :aria-label="`Remove ${c.name}`" :title="c.signups > 0 ? 'Applications came from this code. Switch it off instead.' : 'Remove'" :disabled="busyId === c.id || c.signups > 0" @click="remove(c)"><Loader2 v-if="busyId === c.id" :size="16" class="spin" /><Trash2 v-else :size="16" /></button>
        </footer>
      </article>
    </div>

    <Modal :open="form.open" title="New QR code" :width="440" @close="form.open = false">
      <form id="qr-form" novalidate @submit.prevent="create">
        <label class="label" for="qr-name">Name</label>
        <input id="qr-name" v-model="form.name" class="input" :class="{ invalid: form.error }" maxlength="120" placeholder="Toronto flyers" autocomplete="off" />
        <p v-if="form.error" class="err-text">{{ form.error }}</p>
        <p v-else class="hint">Only you see this. Use the advert or place it will be printed on.</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="form.open = false">Cancel</button>
        <button type="submit" form="qr-form" class="btn btn-primary" :disabled="form.saving"><Loader2 v-if="form.saving" :size="16" class="spin" /> Create QR code</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.qr { padding: 18px; display: grid; gap: 12px; }
.qr.off .img { opacity: 0.45; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
header h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; overflow-wrap: anywhere; } header small { color: var(--text-mute); }
.img { display: grid; place-items: center; padding: 10px; background: #fff; border: 1px solid var(--line); border-radius: 16px; }
.img img { width: 100%; max-width: 200px; height: auto; }
.link { font-size: 12.5px; color: var(--text-mute); overflow-wrap: anywhere; }
dl { display: flex; gap: 24px; margin: 0; } dt { font-size: 12px; color: var(--text-mute); } dd { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 600; }
footer { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } footer .danger { margin-left: auto; color: var(--danger); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
