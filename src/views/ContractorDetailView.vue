<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, BadgeCheck, Building2, Download, ExternalLink, FileText, Loader2, Pencil, Trash2, Upload, User } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import { countryName } from '@/lib/regions'
import { fileSize, kindLabel, statusLabel, statusPill } from '@/lib/contractors'
import Modal from '@/components/ui/Modal.vue'
import ContractorEditModal from '@/components/contractors/ContractorEditModal.vue'
import type { DocKind, ContractorDetail, ContractorDoc, ServiceCategory } from '@/types'
import PayoutDetailsCard from '@/components/payouts/PayoutDetailsCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canUpdate = computed(() => auth.can('contractors.update'))
const canDelete = computed(() => auth.can('contractors.delete'))
const canSeePayout = computed(() => auth.can('payouts.view'))
const id = String(route.params.id)

const p = ref<ContractorDetail | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const categories = ref<{ id: string; name: string }[]>([])
const busy = ref(false)

async function load() {
  loading.value = true; error.value = ''
  try { p.value = (await api.get<{ data: ContractorDetail }>(`/admin/contractors/${id}`)).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load this contractor.").message } finally { loading.value = false }
}
async function loadCategories() {
  if (!auth.can('categories.view')) return
  try { categories.value = (await api.get<{ data: ServiceCategory[] }>('/admin/service-categories')).data.data.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name })) } catch { /* the form explains */ }
}
onMounted(() => { load(); loadCategories() })

// ---- approve / reject / suspend ----
const reason = reactive({ open: false, status: 'rejected' as 'rejected' | 'suspended', text: '', error: '', saving: false })
async function approve(reinstate: boolean) {
  if (!p.value) return
  const yes = await confirm({
    title: reinstate ? `Reinstate ${p.value.name}?` : `Approve ${p.value.name}?`,
    message: 'They can be assigned bookings straight away.', confirmText: reinstate ? 'Reinstate' : 'Approve', tone: 'primary',
  })
  if (!yes) return
  await setStatus('approved')
}
function askReason(status: 'rejected' | 'suspended') { Object.assign(reason, { open: true, status, text: '', error: '', saving: false }) }
async function submitReason() {
  if (reason.text.trim().length < 3) { reason.error = 'Give a short reason.'; return }
  reason.saving = true
  const ok = await setStatus(reason.status, reason.text.trim())
  reason.saving = false
  if (ok) reason.open = false
}
async function setStatus(status: string, why?: string): Promise<boolean> {
  busy.value = true
  try {
    const res = await api.patch<{ message: string; data: ContractorDetail }>(`/admin/contractors/${id}/status`, { status, reason: why })
    p.value = res.data.data; toast.success(res.data.message); return true
  } catch (e) { const err = parseError(e); if (reason.open) reason.error = err.message; else toast.error(err.message); return false }
  finally { busy.value = false }
}
async function remove() {
  if (!p.value) return
  const yes = await confirm({ title: `Remove ${p.value.name}?`, message: 'The contractor and their uploaded documents are removed. This cannot be undone.', confirmText: 'Remove contractor', tone: 'danger' })
  if (!yes) return
  busy.value = true
  try { await api.delete(`/admin/contractors/${id}`); toast.success('Contractor removed.'); router.replace('/contractors') }
  catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}

// ---- documents ----
const upload = reactive({ kind: 'id' as DocKind, busy: false })
const fileInput = ref<HTMLInputElement | null>(null)
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]; input.value = ''
  if (!f) return
  if (f.size > 5 * 1024 * 1024) { toast.error('The file must be 5 MB or smaller.'); return }
  const fd = new FormData(); fd.append('kind', upload.kind); fd.append('file', f)
  upload.busy = true
  try { await api.post(`/admin/contractors/${id}/documents`, fd); toast.success('Document added.'); await load() }
  catch (err) { toast.error(parseError(err, "The file couldn't be uploaded.").message) } finally { upload.busy = false }
}
async function fetchDoc(d: ContractorDoc): Promise<string> {
  const res = await api.get<Blob>(`/admin/contractors/${id}/documents/${d.id}`, { responseType: 'blob' })
  return URL.createObjectURL(new Blob([res.data], { type: d.mime }))
}
async function openDoc(d: ContractorDoc) {
  const w = window.open('', '_blank') // opened first so the browser doesn't block it
  try { const u = await fetchDoc(d); if (w) w.location.href = u; else saveDoc(u, d) }
  catch (e) { w?.close(); toast.error(parseError(e, "Couldn't open the file.").message) }
}
async function downloadDoc(d: ContractorDoc) {
  try { saveDoc(await fetchDoc(d), d) } catch (e) { toast.error(parseError(e, "Couldn't download the file.").message) }
}
function saveDoc(url: string, d: ContractorDoc) { const a = document.createElement('a'); a.href = url; a.download = d.original_name; a.click() }
async function toggleVerified(d: ContractorDoc) {
  try { const r = await api.patch<{ data: ContractorDoc }>(`/admin/contractors/${id}/documents/${d.id}`, { verified: !d.verified }); d.verified = r.data.data.verified }
  catch (e) { toast.error(parseError(e).message) }
}
async function removeDoc(d: ContractorDoc) {
  const yes = await confirm({ title: 'Remove this document?', message: `${kindLabel[d.kind]}: ${d.original_name}. This cannot be undone.`, confirmText: 'Remove document', tone: 'danger' })
  if (!yes) return
  try { await api.delete(`/admin/contractors/${id}/documents/${d.id}`); toast.success('Document removed.'); await load() }
  catch (e) { toast.error(parseError(e).message) }
}
</script>

<template>
  <div>
    <button type="button" class="back" @click="router.push('/contractors')"><ArrowLeft :size="16" /> Contractors</button>

    <div v-if="loading && !p" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 48px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <template v-else-if="p">
      <div class="page-head">
        <div class="title">
          <span class="ico" aria-hidden="true"><Building2 v-if="p.type === 'company'" :size="22" /><User v-else :size="22" /></span>
          <div>
            <h1>{{ p.name }} <span class="pill" :class="statusPill[p.status]">{{ statusLabel[p.status] }}</span></h1>
            <p>{{ p.type === 'company' ? 'Company' : 'Individual' }} · applied {{ formatDateTime(p.created_at) }}<template v-if="p.campaign_name"> · via {{ p.campaign_name }}</template><template v-else-if="p.source === 'admin'"> · added by an admin</template></p>
          </div>
        </div>
        <div v-if="canUpdate" class="acts">
          <button v-if="p.status === 'pending'" type="button" class="btn btn-primary" :disabled="busy" @click="approve(false)">Approve</button>
          <button v-if="p.status === 'pending'" type="button" class="btn btn-ghost" :disabled="busy" @click="askReason('rejected')">Reject</button>
          <button v-if="p.status === 'approved'" type="button" class="btn btn-ghost" :disabled="busy" @click="askReason('suspended')">Suspend</button>
          <button v-if="p.status === 'suspended' || p.status === 'rejected'" type="button" class="btn btn-primary" :disabled="busy" @click="approve(true)">{{ p.status === 'rejected' ? 'Approve anyway' : 'Reinstate' }}</button>
          <button type="button" class="btn btn-ghost" @click="editing = true"><Pencil :size="16" /> Edit</button>
          <button v-if="canDelete" type="button" class="btn btn-ghost danger" :disabled="busy" @click="remove"><Trash2 :size="16" /> Remove</button>
        </div>
      </div>

      <p v-if="p.status_reason && (p.status === 'rejected' || p.status === 'suspended')" class="note" role="status"><strong>Reason:</strong> {{ p.status_reason }}</p>

      <div class="grid">
        <section class="card box">
          <h2>Contact and address</h2>
          <dl>
            <dt>Contact</dt><dd>{{ p.contact_name }}</dd>
            <dt>Email</dt><dd><a :href="`mailto:${p.email}`">{{ p.email }}</a></dd>
            <dt>Phone</dt><dd><a :href="`tel:${p.phone}`">{{ p.phone }}</a></dd>
            <dt>Address</dt><dd>{{ p.address_line1 }}<br />{{ p.city }}, {{ p.region }} {{ p.postal_code }}<br />{{ countryName(p.country) }}</dd>
            <dt>Tax number</dt><dd>{{ p.tax_number || 'Not given' }}</dd>
          </dl>
          <template v-if="p.about"><h3>About</h3><p class="about">{{ p.about }}</p></template>
        </section>

        <section class="card box">
          <h2>Services and areas</h2>
          <h3>Offers</h3>
          <div v-if="p.categories.length" class="tags"><span v-for="c in p.categories" :key="c.id" class="pill">{{ c.name }}</span></div>
          <p v-else class="muted">No service categories chosen.</p>
          <h3>Covers</h3>
          <ul v-if="p.areas.length" class="areas"><li v-for="a in p.areas" :key="a.id">{{ a.city ? `${a.city}, ` : '' }}{{ a.region }}<small v-if="!a.city"> (whole area)</small></li></ul>
          <p v-else class="muted">No areas listed. Their home city is {{ p.city }}.</p>
          <h3>Commission</h3>
          <p>{{ p.commission_percent !== null ? `${p.commission_percent}% for this contractor` : 'Platform default' }}</p>
          <template v-if="p.admin_notes"><h3>Private notes</h3><p class="about">{{ p.admin_notes }}</p></template>
        </section>

        <PayoutDetailsCard v-if="canSeePayout" class="wide" :contractor-id="p.id" :contractor-name="p.name" />

        <section class="card box wide">
          <div class="doc-head">
            <h2>Documents</h2>
            <div v-if="canUpdate" class="up">
              <select v-model="upload.kind" class="select" aria-label="Document type"><option v-for="(l, k) in kindLabel" :key="k" :value="k">{{ l }}</option></select>
              <button type="button" class="btn btn-ghost btn-sm" :disabled="upload.busy" @click="fileInput?.click()"><Loader2 v-if="upload.busy" :size="15" class="spin" /><Upload v-else :size="15" /> Add file</button>
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,application/pdf" class="sr-only" tabindex="-1" @change="onFile" />
            </div>
          </div>
          <p v-if="!p.documents.length" class="muted">No documents uploaded. {{ p.type === 'individual' ? 'Individuals should have a photo ID on file.' : 'Insurance and licence files are worth having on file.' }}</p>
          <ul v-else class="docs">
            <li v-for="d in p.documents" :key="d.id">
              <FileText :size="20" class="fi" aria-hidden="true" />
              <div class="dn"><strong>{{ kindLabel[d.kind] }}</strong><small>{{ d.original_name }} · {{ fileSize(d.size) }}</small></div>
              <span v-if="d.verified" class="pill green"><BadgeCheck :size="12" /> Checked</span>
              <div class="dact">
                <button type="button" class="icon-btn" :aria-label="`Open ${d.original_name}`" @click="openDoc(d)"><ExternalLink :size="16" /></button>
                <button type="button" class="icon-btn" :aria-label="`Download ${d.original_name}`" @click="downloadDoc(d)"><Download :size="16" /></button>
                <button v-if="canUpdate" type="button" class="btn btn-ghost btn-sm" @click="toggleVerified(d)">{{ d.verified ? 'Unmark' : 'Mark checked' }}</button>
                <button v-if="canUpdate" type="button" class="icon-btn danger" :aria-label="`Remove ${d.original_name}`" @click="removeDoc(d)"><Trash2 :size="16" /></button>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <ContractorEditModal :open="editing" :contractor="p" :categories="categories" @close="editing = false" @saved="(x) => { p = x; editing = false }" />

      <Modal :open="reason.open" :title="reason.status === 'rejected' ? 'Reject this application' : 'Suspend this contractor'" :width="460" @close="reason.open = false">
        <form id="reason-form" novalidate @submit.prevent="submitReason">
          <label class="label" for="why">Reason <span class="muted">(kept on record)</span></label>
          <textarea id="why" v-model="reason.text" class="input ta" rows="3" maxlength="300" :class="{ invalid: reason.error }" />
          <p v-if="reason.error" class="err-text">{{ reason.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="reason.open = false">Cancel</button>
          <button type="submit" form="reason-form" class="btn btn-danger" :disabled="reason.saving"><Loader2 v-if="reason.saving" :size="16" class="spin" /> {{ reason.status === 'rejected' ? 'Reject application' : 'Suspend contractor' }}</button>
        </template>
      </Modal>
    </template>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; font-weight: 600; color: var(--text-dim); }
.back:hover { color: var(--blue-ink); }
.title { display: flex; align-items: center; gap: 14px; }
.title h1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ico { width: 46px; height: 46px; flex: none; display: grid; place-items: center; border-radius: 14px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.danger { color: var(--danger); }
.note { margin-bottom: 16px; padding: 12px 14px; font-size: 14px; background: rgba(217, 45, 74, 0.07); border: 1px solid rgba(217, 45, 74, 0.25); border-radius: 12px; }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; align-items: start; }
.wide { grid-column: 1 / -1; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
.box { padding: 20px; }
.box h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.box h3 { margin: 16px 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-mute); }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 10px 14px; margin: 0; }
dt { color: var(--text-mute); font-size: 14px; } dd { margin: 0; overflow-wrap: anywhere; }
dd a { color: var(--blue-ink); text-decoration: none; } dd a:hover { text-decoration: underline; }
.about { white-space: pre-wrap; line-height: 1.55; color: var(--text-dim); }
.muted { color: var(--text-mute); font-size: 14px; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; }
.areas { margin: 0; padding-left: 18px; line-height: 1.7; } .areas small { color: var(--text-mute); }
.doc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.doc-head h2 { margin: 0; }
.up { display: flex; gap: 8px; align-items: center; } .up .select { width: auto; height: 36px; }
.docs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.docs li { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; }
.fi { color: var(--blue-ink); flex: none; }
.dn { flex: 1 1 200px; min-width: 0; } .dn strong { display: block; } .dn small { color: var(--text-mute); overflow-wrap: anywhere; }
.dact { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
