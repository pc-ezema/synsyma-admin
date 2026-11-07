<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { BookingPolicy } from '@/types'

type PolicyKey = 'free_cancel_hours' | 'late_cancel_hours' | 'late_cancel_fee_percent' | 'free_reschedules' | 'max_extra_hours'

const auth = useAuthStore()
const canManage = computed(() => auth.can('bookings.manage'))

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const errors = reactive<Record<string, string>>({})
const form = reactive<Record<PolicyKey, string>>({
  free_cancel_hours: '', late_cancel_hours: '', late_cancel_fee_percent: '', free_reschedules: '', max_extra_hours: '',
})

function fill(p: BookingPolicy) { (Object.keys(form) as (PolicyKey)[]).forEach((k) => { form[k] = String(p[k]) }) }

async function load() {
  loading.value = true; error.value = ''
  try { fill((await api.get<{ data: BookingPolicy }>('/admin/booking-policy')).data.data) }
  catch (e) { error.value = parseError(e, "Couldn't load the policy.").message } finally { loading.value = false }
}
onMounted(load)

const n = (k: PolicyKey) => Number(form[k])

async function save() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const rules: [PolicyKey, number, number, string][] = [
    ['free_cancel_hours', 1, 720, 'Enter 1 to 720 hours.'],
    ['late_cancel_hours', 0, 720, 'Enter 0 to 720 hours.'],
    ['late_cancel_fee_percent', 0, 100, 'Enter 0 to 100.'],
    ['free_reschedules', 0, 10, 'Enter 0 to 10.'],
    ['max_extra_hours', 0, 12, 'Enter 0 to 12.'],
  ]
  for (const [k, min, max, msg] of rules) {
    const v = n(k)
    if (form[k].trim() === '' || !Number.isInteger(v) || v < min || v > max) errors[k] = msg
  }
  if (!errors.late_cancel_hours && !errors.free_cancel_hours && n('late_cancel_hours') >= n('free_cancel_hours')) errors.late_cancel_hours = 'This must be smaller than the free-cancellation window.'
  if (Object.keys(errors).length) return

  saving.value = true
  try {
    const body = Object.fromEntries((Object.keys(form) as (PolicyKey)[]).map((k) => [k, n(k)]))
    const res = await api.put<{ message: string; data: BookingPolicy }>('/admin/booking-policy', body)
    fill(res.data.data); toast.success(res.data.message)
  } catch (e) {
    const err = parseError(e)
    if (err.fields) Object.entries(err.fields).forEach(([k, v]) => { errors[k] = String(v) })
    else toast.error(err.message)
  } finally { saving.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Booking policy</h1>
        <p>Cancellation and change rules. Customers see the exact refund before they confirm.</p>
      </div>
    </div>

    <div v-if="loading" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 48px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <div v-else class="wrap">
      <form class="card box" novalidate @submit.prevent="save">
        <h2>Cancellation</h2>
        <div class="row">
          <div>
            <label class="label" for="p1">Free cancellation window (hours before the start)</label>
            <input id="p1" v-model="form.free_cancel_hours" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.free_cancel_hours }">
            <p v-if="errors.free_cancel_hours" class="err-text">{{ errors.free_cancel_hours }}</p>
          </div>
          <div>
            <label class="label" for="p2">No-refund window (hours before the start)</label>
            <input id="p2" v-model="form.late_cancel_hours" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.late_cancel_hours }">
            <p v-if="errors.late_cancel_hours" class="err-text">{{ errors.late_cancel_hours }}</p>
          </div>
          <div>
            <label class="label" for="p3">Late-cancellation fee (%)</label>
            <input id="p3" v-model="form.late_cancel_fee_percent" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.late_cancel_fee_percent }">
            <p v-if="errors.late_cancel_fee_percent" class="err-text">{{ errors.late_cancel_fee_percent }}</p>
          </div>
        </div>
        <p class="sum">
          Cancelling more than <strong>{{ form.free_cancel_hours || '…' }}h</strong> before the start is free.
          Between <strong>{{ form.late_cancel_hours || '…' }}h</strong> and <strong>{{ form.free_cancel_hours || '…' }}h</strong> a
          <strong>{{ form.late_cancel_fee_percent || '…' }}%</strong> fee applies. Under <strong>{{ form.late_cancel_hours || '…' }}h</strong> there is no refund.
          Bookings with no contractor assigned can always be cancelled for free.
        </p>

        <h2>Changes</h2>
        <div class="row">
          <div>
            <label class="label" for="p4">Free reschedules per booking</label>
            <input id="p4" v-model="form.free_reschedules" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.free_reschedules }">
            <p v-if="errors.free_reschedules" class="err-text">{{ errors.free_reschedules }}</p>
          </div>
          <div>
            <label class="label" for="p5">Most extra hours a customer can add</label>
            <input id="p5" v-model="form.max_extra_hours" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.max_extra_hours }">
            <p v-if="errors.max_extra_hours" class="err-text">{{ errors.max_extra_hours }}</p>
          </div>
        </div>

        <button v-if="canManage" type="submit" class="btn btn-primary save" :disabled="saving"><Loader2 v-if="saving" :size="16" class="spin" /> Save policy</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.wrap { max-width: 100%; }
.box { padding: 22px; }
.box h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; margin: 4px 0 14px; }
.box h2:not(:first-child) { margin-top: 26px; }
.row { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.sum { margin: 16px 0 0; padding: 12px 14px; font-size: 14px; line-height: 1.55; border-radius: 12px; background: rgba(0, 102, 255, 0.07); border: 1px solid rgba(0, 102, 255, 0.25); }
.save { margin-top: 22px; }
</style>