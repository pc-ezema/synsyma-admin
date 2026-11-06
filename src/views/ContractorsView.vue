<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, Building2, ChevronRight, Plus, Search, User } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth'
import { countryName } from '@/lib/regions'
import { statusLabel, statusPill } from '@/lib/contractors'
import ContractorEditModal from '@/components/contractors/ContractorEditModal.vue'
import type { PageMeta, ContractorDetail, ContractorRow, ContractorStatus, ContractorSummary, ServiceCategory } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const canCreate = computed(() => auth.can('contractors.create'))

const rows = ref<ContractorRow[]>([])
const meta = ref<PageMeta | null>(null)
const summary = ref<ContractorSummary | null>(null)
const categories = ref<{ id: string; name: string }[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const status = ref<'' | ContractorStatus>('')
const type = ref('')
const country = ref('')
const page = ref(1)
const adding = ref(false)
let t: number | undefined

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: ContractorRow[]; meta: PageMeta }>('/admin/contractors', {
      params: { page: page.value, per_page: 15, search: search.value.trim() || undefined, status: status.value || undefined, type: type.value || undefined, country: country.value || undefined },
    })
    rows.value = data.data; meta.value = data.meta
  } catch (e) { error.value = parseError(e, "Couldn't load contractors.").message } finally { loading.value = false }
}
async function loadSummary() { try { summary.value = (await api.get<{ data: ContractorSummary }>('/admin/contractors/summary')).data.data } catch { /* tabs just show no counts */ } }
async function loadCategories() {
  if (!auth.can('categories.view')) return
  try { categories.value = (await api.get<{ data: ServiceCategory[] }>('/admin/service-categories')).data.data.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name })) } catch { /* the form explains */ }
}
onMounted(() => { load(); loadSummary(); loadCategories() })
onBeforeUnmount(() => window.clearTimeout(t))

function onSearch() { window.clearTimeout(t); t = window.setTimeout(() => { page.value = 1; load() }, 300) }
function setStatus(s: '' | ContractorStatus) { status.value = s; page.value = 1; load() }
function onFilter() { page.value = 1; load() }
function go(p: number) { page.value = p; load() }
function saved(p: ContractorDetail) { adding.value = false; router.push(`/contractors/${p.id}`) }

const tabs = computed<{ key: '' | ContractorStatus; label: string; n: number | null }[]>(() => [
  { key: '', label: 'All', n: summary.value?.total ?? null },
  { key: 'pending', label: 'Pending', n: summary.value?.pending ?? null },
  { key: 'approved', label: 'Approved', n: summary.value?.approved ?? null },
  { key: 'suspended', label: 'Suspended', n: summary.value?.suspended ?? null },
  { key: 'rejected', label: 'Rejected', n: summary.value?.rejected ?? null },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Contractors</h1><p>Companies and individuals who do the work. Approve applications and assign bookings to them.</p></div>
      <button v-if="canCreate" type="button" class="btn btn-primary" @click="adding = true"><Plus :size="18" /> New contractor</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by status">
      <button v-for="tb in tabs" :key="tb.key" type="button" role="tab" class="chip" :class="{ on: status === tb.key }" :aria-selected="status === tb.key" @click="setStatus(tb.key)">
        {{ tb.label }}<span v-if="tb.n !== null" class="n" :class="{ attention: tb.key === 'pending' && tb.n > 0 && status !== 'pending' }">{{ tb.n }}</span>
      </button>
    </div>

    <div class="card">
      <div class="bar">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search name, email, phone or city" aria-label="Search contractors" @input="onSearch" /></label>
        <select v-model="type" class="select sel" aria-label="Filter by type" @change="onFilter"><option value="">All types</option><option value="company">Companies</option><option value="individual">Individuals</option></select>
        <select v-model="country" class="select sel" aria-label="Filter by country" @change="onFilter"><option value="">All countries</option><option value="CA">Canada</option><option value="US">United States</option><option value="GB">United Kingdom</option></select>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Building2 :size="30" /><p>{{ search || status || type || country ? 'No contractors match these filters.' : 'No contractors yet. Applications from your QR codes will show here.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Contractor</th><th>Contact</th><th>Location</th><th>Services</th><th>Status</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" class="click" tabindex="0" @click="router.push(`/contractors/${p.id}`)" @keydown.enter="router.push(`/contractors/${p.id}`)">
              <td>
                <div class="who"><span class="ico" aria-hidden="true"><Building2 v-if="p.type === 'company'" :size="16" /><User v-else :size="16" /></span>
                  <div><strong>{{ p.name }}</strong><small>{{ p.type === 'company' ? 'Company' : 'Individual' }}<template v-if="p.campaign_name"> · via {{ p.campaign_name }}</template><template v-else-if="p.source === 'admin'"> · added by admin</template></small></div></div>
              </td>
              <td><span class="line">{{ p.contact_name }}</span><small>{{ p.email }}</small></td>
              <td><span class="line">{{ p.city }}, {{ p.region }}</span><small>{{ countryName(p.country) }}</small></td>
              <td>{{ p.categories_count ?? 0 }}</td>
              <td><span class="pill" :class="statusPill[p.status]">{{ statusLabel[p.status] }}</span></td>
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

    <ContractorEditModal :open="adding" :contractor="null" :categories="categories" @close="adding = false" @saved="saved" />
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
.tabs .chip { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.n { min-width: 20px; padding: 0 6px; font-size: 12px; line-height: 20px; text-align: center; border-radius: 10px; background: rgba(4, 20, 59, 0.08); }
.chip.on .n { background: rgba(255, 255, 255, 0.22); }
.n.attention { background: var(--danger); color: #fff; }
.bar { display: flex; gap: 10px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 240px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
.sel { width: auto; min-width: 150px; }
.who { display: flex; align-items: center; gap: 12px; }
.ico { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 10px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
td strong { display: block; } td small { display: block; color: var(--text-mute); } .line { display: block; }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(0, 102, 255, 0.04); }
.go { width: 36px; color: var(--text-mute); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
</style>
