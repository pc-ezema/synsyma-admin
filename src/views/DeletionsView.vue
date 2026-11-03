<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertCircle, Search, UserMinus } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import Modal from '@/components/ui/Modal.vue'
import type { AccountDeletion, DeletionSummary, PageMeta } from '@/types'

const rows = ref<AccountDeletion[]>([])
const meta = ref<PageMeta | null>(null)
const summary = ref<DeletionSummary | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const reason = ref('')
const page = ref(1)
const open = ref<AccountDeletion | null>(null)
let t: number | undefined

const reasons: Record<string, string> = {
  not_using: 'I no longer use the app', found_alternative: 'I found another service',
  privacy: 'Privacy concerns', bad_experience: 'I had a bad experience', other: 'Other',
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: AccountDeletion[]; meta: PageMeta }>('/admin/account-deletions', { params: { page: page.value, per_page: 15, search: search.value.trim() || undefined, reason: reason.value || undefined } })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load deleted accounts.").message } finally { loading.value = false }
}
async function loadSummary() {
  try { summary.value = (await api.get<{ data: DeletionSummary }>('/admin/account-deletions/summary')).data.data } catch { /* cards stay hidden */ }
}
onMounted(() => { load(); loadSummary() })
onBeforeUnmount(() => window.clearTimeout(t))
function onSearch() { window.clearTimeout(t); t = window.setTimeout(() => { page.value = 1; load() }, 300) }
function onReason() { page.value = 1; load() }
function go(p: number) { page.value = p; load() }
</script>

<template>
  <div>
    <div class="page-head"><div><h1>Deleted accounts</h1><p>A permanent record of customers who deleted their own account from the app.</p></div></div>

    <div v-if="summary" class="stats">
      <div class="card stat"><small>All time</small><strong>{{ summary.total }}</strong></div>
      <div class="card stat"><small>Last 30 days</small><strong>{{ summary.last_30_days }}</strong></div>
      <div class="card stat"><small>Last 7 days</small><strong>{{ summary.last_7_days }}</strong></div>
    </div>

    <div class="card">
      <div class="bar">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search name, email or phone" aria-label="Search deleted accounts" @input="onSearch" /></label>
        <select v-model="reason" class="input sel" aria-label="Filter by reason" @change="onReason"><option value="">All reasons</option><option v-for="(l, k) in reasons" :key="k" :value="k">{{ l }}</option></select>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 44px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><UserMinus :size="30" /><p>No deleted accounts{{ search || reason ? ' match your search' : ' yet' }}.</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Customer</th><th>Reason</th><th>Platform</th><th>Deleted</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="click" tabindex="0" @click="open = r" @keydown.enter="open = r">
              <td><strong>{{ r.name }}</strong><small>{{ r.email || r.phone || 'No contact' }}</small></td>
              <td><span v-if="r.reason_label" class="pill grey">{{ r.reason_label }}</span><span v-else class="muted">Not given</span></td>
              <td class="muted cap">{{ r.platform || '-' }}</td>
              <td class="muted">{{ formatDateTime(r.deleted_at) }}</td>
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

    <Modal :open="!!open" title="Deleted account" :width="520" @close="open = null">
      <dl v-if="open" class="det">
        <div><dt>Name</dt><dd>{{ open.name }}</dd></div>
        <div><dt>Email</dt><dd>{{ open.email || '-' }}</dd></div>
        <div><dt>Phone</dt><dd>{{ open.phone || '-' }}</dd></div>
        <div><dt>Reason</dt><dd>{{ open.reason_label || 'Not given' }}</dd></div>
        <div v-if="open.comment"><dt>Comment</dt><dd class="wrap">{{ open.comment }}</dd></div>
        <div><dt>Platform</dt><dd class="cap">{{ open.platform || '-' }}</dd></div>
        <div><dt>Joined</dt><dd>{{ formatDateTime(open.account_created_at) }}</dd></div>
        <div><dt>Deleted</dt><dd>{{ formatDateTime(open.deleted_at) }}</dd></div>
        <div><dt>IP address</dt><dd class="mono">{{ open.ip_address || '-' }}</dd></div>
        <div><dt>User ID</dt><dd class="mono">{{ open.user_id || '-' }}</dd></div>
      </dl>
      <template #footer><button type="button" class="btn btn-ghost" @click="open = null">Close</button></template>
    </Modal>
  </div>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat { padding: 16px 18px; } .stat small { color: var(--text-mute); font-weight: 600; } .stat strong { display: block; font-family: var(--font-display); font-size: 28px; margin-top: 2px; }
.bar { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; border-bottom: 1px solid var(--line); } .bar .field { flex: 1; min-width: 220px; max-width: 360px; height: 44px; } .sel { width: auto; min-width: 200px; height: 44px; }
.pad { padding: 16px; }
td strong { display: block; } td small { color: var(--text-mute); }
.muted { color: var(--text-mute); font-size: 14px; } .cap { text-transform: capitalize; }
.click { cursor: pointer; } .click:hover td, .click:focus-visible td { background: rgba(0, 102, 255, 0.04); outline: none; }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px; border-top: 1px solid var(--line); color: var(--text-mute); font-size: 14px; }
.det { display: grid; gap: 0; margin: 0; } .det > div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(4, 20, 59, 0.06); } .det > div:last-child { border-bottom: 0; }
.det dt { color: var(--text-mute); font-weight: 600; } .det dd { margin: 0; font-weight: 600; min-width: 0; word-break: break-word; } .det .wrap { font-weight: 500; white-space: pre-wrap; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
@media (max-width: 560px) { .stats { grid-template-columns: 1fr; } }
</style>
