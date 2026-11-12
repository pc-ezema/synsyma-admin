<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, ChevronRight, Wallet } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { money } from '@/lib/bookings'
import type { LedgerEntry, PayoutContractor } from '@/types'

const props = defineProps<{ contractorId: string }>()
const router = useRouter()

const d = ref<PayoutContractor | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true; error.value = ''
  try { d.value = (await api.get<{ data: PayoutContractor }>(`/admin/payouts/contractors/${props.contractorId}`)).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load earnings.").message } finally { loading.value = false }
}
onMounted(load)

const cur = (v: number) => money(v, 'USD')
const recent = computed(() => (d.value?.entries ?? []).slice(0, 5))
const stateLabel: Record<LedgerEntry['state'], string> = { paid: 'Paid', payable: 'Ready to pay', hold: 'On hold' }
const statePill: Record<LedgerEntry['state'], string> = { paid: 'grey', payable: 'green', hold: '' }
</script>

<template>
  <section class="card pe">
    <div class="head">
      <h2><Wallet :size="18" /> Earnings and payouts</h2>
      <button type="button" class="btn btn-ghost btn-sm" @click="router.push(`/payouts/${contractorId}`)">Open payouts <ChevronRight :size="15" /></button>
    </div>

    <div v-if="loading" class="skeleton" style="height: 90px" />
    <p v-else-if="error" class="bad"><AlertCircle :size="16" /> {{ error }} <button type="button" class="link" @click="load">Try again</button></p>
    <template v-else-if="d">
      <div class="tiles">
        <div><span>Ready to pay</span><strong :class="{ owe: d.payable < 0, ready: d.payable > 0 }">{{ cur(d.payable) }}</strong></div>
        <div><span>On hold</span><strong>{{ cur(d.on_hold) }}</strong></div>
        <div><span>Paid out</span><strong>{{ cur(d.paid) }}</strong></div>
      </div>

      <p v-if="!recent.length" class="none">No earnings yet. They appear here when a job this contractor did is completed.</p>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Job</th><th>Contractor share</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="e in recent" :key="e.id">
              <td>
                <a v-if="e.booking_id" class="job" :href="`/bookings/${e.booking_id}`" @click.prevent="router.push(`/bookings/${e.booking_id}`)">{{ e.reference || 'Booking' }}</a>
                <span v-else>—</span>
                <small>{{ e.type === 'adjustment' ? 'Adjustment' : e.service_name }}</small>
              </td>
              <td><strong>{{ cur(e.amount) }}</strong></td>
              <td><span class="pill" :class="statePill[e.state]">{{ stateLabel[e.state] }}</span><small v-if="e.state === 'hold'">Ready {{ formatDateTime(e.payable_at) }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="d.entries.length > recent.length" class="more">Showing the latest {{ recent.length }} of {{ d.entries.length }}.</p>
    </template>
  </section>
</template>

<style scoped>
.pe { padding: 16px 18px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
.tiles div { padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; }
.tiles span { display: block; font-size: 12px; font-weight: 600; color: var(--text-mute); }
.tiles strong { font-size: 20px; font-family: var(--font-display); }
.ready { color: #0a7a3a; } .owe { color: var(--danger); }
.none { color: var(--text-mute); } .bad { display: flex; align-items: center; gap: 8px; color: var(--danger); }
.link { font-weight: 600; color: var(--blue-ink); text-decoration: underline; }
td small { display: block; color: var(--text-mute); }
.job { font-weight: 600; color: var(--blue-ink); }
.more { margin-top: 10px; font-size: 13px; color: var(--text-mute); }
@media (max-width: 520px) { .tiles { grid-template-columns: 1fr; } }
</style>