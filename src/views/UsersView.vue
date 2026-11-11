<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, ChevronRight, Search, Users } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { money } from '@/lib/bookings'
import type { PageMeta, UserRow, UserSummary } from '@/types'

const router = useRouter()
const rows = ref<UserRow[]>([])
const meta = ref<PageMeta | null>(null)
const summary = ref<UserSummary | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const status = ref<'' | 'active' | 'inactive'>('')
const page = ref(1)
let t: number | undefined

const tabs: { key: '' | 'active' | 'inactive'; label: string }[] = [{ key: '', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive' }]

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: UserRow[]; meta: PageMeta; summary: UserSummary }>('/admin/users', {
      params: { search: search.value.trim() || undefined, status: status.value || undefined, page: page.value, per_page: 15 },
    })
    rows.value = data.data; meta.value = data.meta; summary.value = data.summary
  } catch (e) { error.value = parseError(e, "Couldn't load customers.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))

function refilter() { page.value = 1; load() }
function onSearch() { window.clearTimeout(t); t = window.setTimeout(refilter, 300) }
function setStatus(s: '' | 'active' | 'inactive') { status.value = s; refilter() }
function go(p: number) { page.value = p; load() }
const open = (u: UserRow) => router.push(`/users/${u.id}`)
const initials = (u: UserRow) => `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?'
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Users</h1><p>Your customers. Open one to see their bookings and reviews, message them, or deactivate the account.</p></div>
    </div>

    <div v-if="summary" class="stats">
      <div class="card stat"><span>Customers</span><strong>{{ summary.total }}</strong></div>
      <div class="card stat"><span>Joined this month</span><strong>{{ summary.this_month }}</strong></div>
      <div class="card stat"><span>Inactive</span><strong>{{ summary.inactive }}</strong></div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by status">
      <button v-for="tb in tabs" :key="tb.key" type="button" role="tab" class="chip" :class="{ on: status === tb.key }" :aria-selected="status === tb.key" @click="setStatus(tb.key)">{{ tb.label }}</button>
    </div>

    <div class="card">
      <div class="bar-row">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search name, email or phone" aria-label="Search customers" @input="onSearch" /></label>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 56px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Users :size="30" /><p>{{ search || status ? 'No customers match these filters.' : 'No customers yet. They appear here when people sign up in the app.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Customer</th><th>Phone</th><th>Bookings</th><th>Total paid</th><th>Joined</th><th>Last login</th><th>Status</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="u in rows" :key="u.id" class="click" :class="{ dim: !u.is_active }" tabindex="0" @click="open(u)" @keydown.enter="open(u)">
              <td>
                <div class="who"><span class="av" aria-hidden="true">{{ initials(u) }}</span><div><strong>{{ u.full_name || '—' }}</strong><small>{{ u.email }}<template v-if="!u.email_verified"> · not verified</template></small></div></div>
              </td>
              <td>{{ u.phone || '—' }}</td>
              <td>{{ u.bookings_count }}</td>
              <td>{{ u.paid_total ? money(u.paid_total, 'USD') : '—' }}</td>
              <td>{{ formatDateTime(u.created_at) }}</td>
              <td>{{ u.last_login_at ? formatDateTime(u.last_login_at) : 'Never' }}</td>
              <td><span class="pill" :class="u.is_active ? 'green' : 'grey'">{{ u.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td class="go"><ChevronRight :size="18" aria-hidden="true" /></td>
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
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
@media (max-width: 640px) { .stats { grid-template-columns: 1fr; } }
.stat { padding: 16px 18px; display: grid; gap: 4px; }
.stat span { font-size: 13px; color: var(--text-mute); }
.stat strong { font-family: var(--font-display); font-size: 28px; font-weight: 600; line-height: 1.1; }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; } .tabs .chip { white-space: nowrap; }
.bar-row { display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(0, 102, 255, 0.04); } tr.dim { opacity: 0.7; }
.who { display: flex; align-items: center; gap: 10px; }
.who strong { display: block; } .who small { display: block; color: var(--text-mute); }
.av { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(0, 102, 255, 0.1); color: var(--blue-ink); font-size: 13px; font-weight: 700; }
.go { color: var(--text-mute); text-align: right; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
</style>