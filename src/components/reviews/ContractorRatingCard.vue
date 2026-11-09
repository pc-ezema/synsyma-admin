<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import StarRating from '@/components/reviews/StarRating.vue'
import type { ReviewRow, ReviewSummary } from '@/types'

const props = defineProps<{ contractorId: string }>()
const summary = ref<ReviewSummary | null>(null)
const recent = ref<ReviewRow[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get<{ data: ReviewRow[]; summary: ReviewSummary }>('/admin/reviews', { params: { contractor_id: props.contractorId, visibility: 'visible', per_page: 3 } })
    summary.value = data.summary; recent.value = data.data
  } catch (e) { error.value = parseError(e, "Couldn't load ratings.").message } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="card rc">
    <div class="head">
      <h2>Ratings</h2>
      <router-link v-if="summary && (summary.count || summary.hidden)" :to="{ path: '/reviews', query: { contractor: contractorId } }" class="btn btn-ghost btn-sm">See all reviews</router-link>
    </div>
    <div v-if="loading" class="skeleton" style="height: 70px" />
    <p v-else-if="error" class="bad"><AlertCircle :size="16" /> {{ error }} <button type="button" class="link" @click="load">Try again</button></p>
    <p v-else-if="!summary || !summary.count" class="muted">No ratings yet. They appear after customers rate a finished job.</p>
    <template v-else>
      <div class="avg"><strong>{{ summary.average?.toFixed(1) }}</strong><div><StarRating :rating="summary.average ?? 0" :size="18" /><small>{{ summary.count }} {{ summary.count === 1 ? 'review' : 'reviews' }}</small></div></div>
      <ul class="list">
        <li v-for="r in recent" :key="r.id"><StarRating :rating="r.rating" :size="14" /> <small>{{ formatDateTime(r.created_at) }}</small><p v-if="r.comment">{{ r.comment }}</p></li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.rc { padding: 20px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.muted { color: var(--text-mute); font-size: 14px; } .bad { display: flex; align-items: center; gap: 8px; color: var(--danger); }
.link { font-weight: 600; color: var(--blue-ink); text-decoration: underline; }
.avg { display: flex; align-items: center; gap: 14px; } .avg strong { font-family: var(--font-display); font-size: 36px; line-height: 1; font-weight: 600; }
.avg small { display: block; color: var(--text-mute); }
.list { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 12px; }
.list li { padding-top: 12px; border-top: 1px solid var(--line); } .list small { color: var(--text-mute); margin-left: 6px; }
.list p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--text-dim); white-space: pre-wrap; overflow-wrap: anywhere; }
</style>