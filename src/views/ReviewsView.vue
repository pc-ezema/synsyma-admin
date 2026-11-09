<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ChevronRight, EyeOff, Loader2, Search, Star, X } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import Modal from '@/components/ui/Modal.vue'
import StarRating from '@/components/reviews/StarRating.vue'
import type { PageMeta, ReviewRow, ReviewSummary } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canModerate = computed(() => auth.can('reviews.moderate'))

const rows = ref<ReviewRow[]>([])
const meta = ref<PageMeta | null>(null)
const summary = ref<ReviewSummary | null>(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const visibility = ref<'' | 'visible' | 'hidden'>('')
const rating = ref(0)
const contractorId = ref(typeof route.query.contractor === 'string' ? route.query.contractor : '')
const page = ref(1)
let t: number | undefined

const tabs: { key: '' | 'visible' | 'hidden'; label: string }[] = [{ key: '', label: 'All' }, { key: 'visible', label: 'Visible' }, { key: 'hidden', label: 'Hidden' }]

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: ReviewRow[]; meta: PageMeta; summary: ReviewSummary }>('/admin/reviews', {
      params: { search: search.value.trim() || undefined, visibility: visibility.value || undefined, rating: rating.value || undefined, contractor_id: contractorId.value || undefined, page: page.value, per_page: 15 },
    })
    rows.value = data.data; meta.value = data.meta; summary.value = data.summary
  } catch (e) { error.value = parseError(e, "Couldn't load reviews.").message } finally { loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => window.clearTimeout(t))

function refilter() { page.value = 1; load() }
function onSearch() { window.clearTimeout(t); t = window.setTimeout(refilter, 300) }
function setVisibility(v: '' | 'visible' | 'hidden') { visibility.value = v; refilter() }
function setRating(r: number) { rating.value = rating.value === r ? 0 : r; refilter() }
function clearContractor() { contractorId.value = ''; router.replace({ path: '/reviews' }); refilter() }
function go(p: number) { page.value = p; load() }

// ---- hide (needs a reason) / show again ----
const hide = reactive({ open: false, row: null as ReviewRow | null, reason: '', error: '', saving: false })
function askHide(r: ReviewRow) { Object.assign(hide, { open: true, row: r, reason: '', error: '', saving: false }) }
async function submitHide() {
  if (!hide.row) return
  if (hide.reason.trim().length < 3) { hide.error = 'Give a short reason.'; return }
  hide.saving = true; hide.error = ''
  try {
    const res = await api.patch<{ message: string }>(`/admin/reviews/${hide.row.id}/visibility`, { hidden: true, reason: hide.reason.trim() })
    toast.success(res.data.message); hide.open = false; await load()
  } catch (e) { hide.error = parseError(e).message } finally { hide.saving = false }
}
async function show(r: ReviewRow) {
  const yes = await confirm({ title: 'Show this review again?', message: 'It counts towards the contractor\'s average once more.', confirmText: 'Show review', tone: 'primary' })
  if (!yes) return
  try { const res = await api.patch<{ message: string }>(`/admin/reviews/${r.id}/visibility`, { hidden: false }); toast.success(res.data.message); await load() }
  catch (e) { toast.error(parseError(e).message) }
}

const maxBar = computed(() => {
  const vals = Object.values(summary.value?.distribution ?? {}) as number[]
  return Math.max(1, ...vals)
})
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Reviews</h1><p>What customers say about finished jobs. Hidden reviews are kept but do not count towards averages.</p></div>
    </div>

    <div v-if="summary" class="top">
      <div class="card avg">
        <span class="lbl">Average rating</span>
        <strong>{{ summary.average !== null ? summary.average.toFixed(1) : '—' }}</strong>
        <StarRating :rating="summary.average ?? 0" :size="20" />
        <small>{{ summary.count }} visible {{ summary.count === 1 ? 'review' : 'reviews' }}<template v-if="summary.hidden"> · {{ summary.hidden }} hidden</template></small>
      </div>
      <div class="card dist" role="group" aria-label="Filter by rating">
        <button v-for="n in [5, 4, 3, 2, 1]" :key="n" type="button" class="drow" :class="{ on: rating === n }" :aria-pressed="rating === n" @click="setRating(n)">
          <span class="n">{{ n }} <Star :size="13" aria-hidden="true" /></span>
          <span class="bar"><i :style="{ width: `${((summary.distribution[String(n)] ?? 0) / maxBar) * 100}%` }" /></span>
          <span class="c">{{ summary.distribution[String(n)] ?? 0 }}</span>
        </button>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="Filter by visibility">
      <button v-for="tb in tabs" :key="tb.key" type="button" role="tab" class="chip" :class="{ on: visibility === tb.key }" :aria-selected="visibility === tb.key" @click="setVisibility(tb.key)">{{ tb.label }}</button>
      <button v-if="contractorId" type="button" class="chip on" @click="clearContractor">One contractor <X :size="14" aria-hidden="true" /></button>
    </div>

    <div class="card">
      <div class="bar-row">
        <label class="field"><Search :size="17" /><input v-model="search" type="search" placeholder="Search comment, booking reference, customer or contractor" aria-label="Search reviews" @input="onSearch" /></label>
      </div>

      <div v-if="loading && !rows.length" class="pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 64px; margin-bottom: 10px" /></div>
      <div v-else-if="error" class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="empty"><Star :size="30" /><p>{{ search || visibility || rating || contractorId ? 'No reviews match these filters.' : 'No reviews yet. They appear here when customers rate a finished job.' }}</p></div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Rating</th><th>Review</th><th>Job</th><th>Contractor</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" :class="{ dim: r.is_hidden }">
              <td><span class="line">{{ formatDateTime(r.created_at) }}</span><small v-if="r.edited_at">Edited</small></td>
              <td><StarRating :rating="r.rating" /><small>{{ r.rating }} / 5</small></td>
              <td class="cm">
                <span v-if="r.comment" class="line txt">{{ r.comment }}</span><span v-else class="muted">No comment</span>
                <span v-if="r.is_hidden" class="pill grey hid"><EyeOff :size="12" /> Hidden</span><small v-if="r.is_hidden && r.hidden_reason">{{ r.hidden_reason }}</small>
              </td>
              <td><router-link :to="`/bookings/${r.booking_id}`" class="lnk"><strong>{{ r.service_name }}</strong></router-link><small>{{ r.reference }} · {{ r.customer_name }}</small></td>
              <td><router-link v-if="r.contractor_id" :to="`/contractors/${r.contractor_id}`" class="lnk">{{ r.contractor_name }}</router-link><template v-else>—</template></td>
              <td class="acts">
                <template v-if="canModerate">
                  <button v-if="!r.is_hidden" type="button" class="btn btn-ghost btn-sm" @click="askHide(r)"><EyeOff :size="15" /> Hide</button>
                  <button v-else type="button" class="btn btn-ghost btn-sm" @click="show(r)">Show</button>
                </template>
                <router-link :to="`/bookings/${r.booking_id}`" class="go" aria-label="Open booking"><ChevronRight :size="18" aria-hidden="true" /></router-link>
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

    <Modal :open="hide.open" title="Hide this review" :width="460" @close="hide.open = false">
      <form id="hide-form" novalidate @submit.prevent="submitHide">
        <p class="muted">Use this for abuse, personal details or spam, not because a rating is low. The review is kept, stops counting towards the average, and the customer is not told.</p>
        <div v-if="hide.row" class="quote"><StarRating :rating="hide.row.rating" /> <span>{{ hide.row.comment || 'No comment' }}</span></div>
        <label class="label" for="hide-why">Reason <span class="muted">(kept on record)</span></label>
        <textarea id="hide-why" v-model="hide.reason" class="input ta" rows="3" maxlength="300" :class="{ invalid: hide.error }" />
        <p v-if="hide.error" class="err-text">{{ hide.error }}</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="hide.open = false">Cancel</button>
        <button type="submit" form="hide-form" class="btn btn-danger" :disabled="hide.saving"><Loader2 v-if="hide.saving" :size="16" class="spin" /> Hide review</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.top { display: grid; gap: 14px; grid-template-columns: minmax(200px, 260px) 1fr; margin-bottom: 16px; }
@media (max-width: 720px) { .top { grid-template-columns: 1fr; } }
.avg { padding: 18px; display: grid; gap: 6px; justify-items: start; }
.avg .lbl { font-size: 13px; color: var(--text-mute); }
.avg strong { font-family: var(--font-display); font-size: 40px; line-height: 1; font-weight: 600; }
.avg small { color: var(--text-mute); }
.dist { padding: 12px 14px; display: grid; gap: 4px; align-content: center; }
.drow { display: grid; grid-template-columns: 38px 1fr 38px; align-items: center; gap: 10px; padding: 4px 6px; border-radius: 10px; font: inherit; text-align: left; }
.drow:hover { background: rgba(0, 102, 255, 0.05); } .drow.on { background: rgba(0, 102, 255, 0.1); }
.drow .n { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; font-size: 13px; } .drow .n svg { color: #F5A524; fill: #F5A524; }
.drow .bar { height: 8px; background: #E9EDF5; border-radius: 99px; overflow: hidden; } .drow .bar i { display: block; height: 100%; background: #F5A524; border-radius: 99px; }
.drow .c { text-align: right; font-size: 13px; color: var(--text-mute); }
.tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; } .tabs .chip { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.bar-row { display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.field { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 12px; color: var(--text-mute); }
.field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: var(--text); }
td strong { display: inline; } td small { display: block; color: var(--text-mute); } .line { display: block; }
.cm { max-width: 340px; } .txt { white-space: pre-wrap; overflow-wrap: anywhere; } .muted { color: var(--text-mute); font-size: 14px; }
.hid { margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; }
tr.dim { opacity: 0.7; }
.lnk { color: var(--blue-ink); text-decoration: none; } .lnk:hover { text-decoration: underline; }
.acts { white-space: nowrap; text-align: right; } .go { display: inline-grid; vertical-align: middle; margin-left: 6px; color: var(--text-mute); }
.quote { display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; padding: 10px 12px; background: rgba(0, 0, 0, 0.04); border-radius: 12px; font-size: 14px; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-mute); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>