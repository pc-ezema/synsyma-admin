<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, Bell, Building2, CalendarClock, ChevronRight, CreditCard, LifeBuoy, Loader2, SlidersHorizontal, Wallet } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import type { AppSettings } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.can('settings.manage'))

type Key = keyof AppSettings
const form = reactive<Record<Key, string>>({
  business_name: '', support_email: '', support_phone: '', business_address: '',
  min_notice_hours: '', max_days_ahead: '', quote_valid_days: '7', review_edit_hours: '',
})
const errors = reactive<Record<string, string>>({})
const loading = ref(true)
const error = ref('')
const saving = ref(false)

function fill(s: AppSettings) { (Object.keys(form) as Key[]).forEach((k) => { form[k] = s[k] === null || s[k] === undefined ? '' : String(s[k]) }) }

async function load() {
  loading.value = true; error.value = ''
  try { fill((await api.get<{ data: AppSettings }>('/admin/settings')).data.data) }
  catch (e) { error.value = parseError(e, "Couldn't load settings.").message } finally { loading.value = false }
}
onMounted(load)

const num = (k: Key) => Number(form[k])
const hoursText = computed(() => {
  const h = num('review_edit_hours')
  if (form.review_edit_hours.trim() === '' || !Number.isInteger(h)) return '…'
  if (h === 0) return 'no time (reviews are final)'
  return h % 24 === 0 ? `${h / 24} ${h === 24 ? 'day' : 'days'}` : `${h} hours`
})

async function save() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const rules: [Key, number, number, string][] = [
    ['min_notice_hours', 0, 720, 'Enter 0 to 720 hours.'],
    ['max_days_ahead', 1, 365, 'Enter 1 to 365 days.'],
    ['review_edit_hours', 0, 720, 'Enter 0 to 720 hours.'],
  ]
  for (const [k, min, max, msg] of rules) {
    const v = num(k)
    if (form[k].trim() === '' || !Number.isInteger(v) || v < min || v > max) errors[k] = msg
  }
  if (form.support_email.trim() && !/^\S+@\S+\.\S+$/.test(form.support_email.trim())) errors.support_email = 'Enter a valid email address.'
  if (Object.keys(errors).length) return

  saving.value = true
  try {
    const body = {
      business_name: form.business_name.trim() || null, support_email: form.support_email.trim() || null,
      support_phone: form.support_phone.trim() || null, business_address: form.business_address.trim() || null,
      min_notice_hours: num('min_notice_hours'), max_days_ahead: num('max_days_ahead'),
      quote_valid_days: num('quote_valid_days'), review_edit_hours: num('review_edit_hours'),
    }
    const res = await api.put<{ message: string; data: AppSettings }>('/admin/settings', body)
    fill(res.data.data); toast.success(res.data.message)
  } catch (e) {
    const err = parseError(e)
    if (err.fields) Object.entries(err.fields).forEach(([k, v]) => { errors[k] = String(v) })
    else toast.error(err.message)
  } finally { saving.value = false }
}

const links = computed(() => [
  { to: '/booking-policy', title: 'Booking policy', text: 'Cancellation windows, fees, reschedules, extra hours, auto-complete.', icon: SlidersHorizontal, show: auth.can('bookings.manage') },
  { to: '/payouts', title: 'Payouts', text: 'Default commission and how long earnings are held.', icon: Wallet, show: auth.can('payouts.view') },
  { to: '/payments', title: 'Payments', text: 'Stripe and PayPal activity, and which gateways are on.', icon: CreditCard, show: auth.can('bookings.view') },
  { to: '/support', title: 'Support contacts', text: 'Phone numbers, emails and WhatsApp shown in the app.', icon: LifeBuoy, show: auth.can('support.view') },
  { to: '/profile', title: 'My notifications', text: 'Which alerts you get by push and email.', icon: Bell, show: true },
].filter((l) => l.show))
</script>

<template>
  <div>
    <div class="page-head"><div><h1>Settings</h1><p>Platform-wide rules and details. Other settings live on their own pages, linked below.</p></div></div>

    <div v-if="loading" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 52px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <template v-else>
      <div class="links">
        <button v-for="l in links" :key="l.to" type="button" class="card link" @click="router.push(l.to)">
          <component :is="l.icon" :size="20" aria-hidden="true" />
          <span class="t"><strong>{{ l.title }}</strong><small>{{ l.text }}</small></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>

      <form class="stack" novalidate @submit.prevent="save">
        <section class="card box">
          <h2><Building2 :size="18" /> Business details</h2>
          <p class="hint">The name and contact details of your business.</p>
          <div class="row">
            <div><label class="label" for="s1">Business name</label><input id="s1" v-model="form.business_name" class="input" :readonly="!canManage" maxlength="120"></div>
            <div><label class="label" for="s2">Support phone</label><input id="s2" v-model="form.support_phone" class="input" :readonly="!canManage" maxlength="40"></div>
            <div>
              <label class="label" for="s3">Support email</label>
              <input id="s3" v-model="form.support_email" type="email" class="input" :readonly="!canManage" :class="{ invalid: errors.support_email }">
              <p v-if="errors.support_email" class="err-text">{{ errors.support_email }}</p>
            </div>
            <div class="wide"><label class="label" for="s4">Address</label><input id="s4" v-model="form.business_address" class="input" :readonly="!canManage" maxlength="300"></div>
          </div>
        </section>

        <section class="card box">
          <h2><CalendarClock :size="18" /> Booking times</h2>
          <p class="hint">When customers can book. The app and the server both use these.</p>
          <div class="row">
            <div>
              <label class="label" for="s5">Minimum notice (hours)</label>
              <input id="s5" v-model="form.min_notice_hours" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.min_notice_hours }">
              <p v-if="errors.min_notice_hours" class="err-text">{{ errors.min_notice_hours }}</p>
            </div>
            <div>
              <label class="label" for="s6">Book up to (days ahead)</label>
              <input id="s6" v-model="form.max_days_ahead" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.max_days_ahead }">
              <p v-if="errors.max_days_ahead" class="err-text">{{ errors.max_days_ahead }}</p>
            </div>
          </div>
          <p class="sum">Customers must book at least <strong>{{ form.min_notice_hours || '…' }}h</strong> ahead and no more than <strong>{{ form.max_days_ahead || '…' }} days</strong> ahead. Start times stay between 8:00 and 18:00.</p>
        </section>

        <section class="card box">
          <h2><SlidersHorizontal :size="18" /> Defaults</h2>
          <div class="row">
            <div>
              <label class="label" for="s7">Quote stays open for</label>
              <select id="s7" v-model="form.quote_valid_days" class="select" :disabled="!canManage"><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select>
              <p class="hint">The starting choice when you send a quote. You can still change it per quote.</p>
            </div>
            <div>
              <label class="label" for="s8">Customers can edit a review for (hours)</label>
              <input id="s8" v-model="form.review_edit_hours" class="input" inputmode="numeric" :readonly="!canManage" :class="{ invalid: errors.review_edit_hours }">
              <p v-if="errors.review_edit_hours" class="err-text">{{ errors.review_edit_hours }}</p>
              <p v-else class="hint">That is {{ hoursText }}. Enter 0 to make reviews final.</p>
            </div>
          </div>
        </section>

        <div v-if="canManage" class="bar"><button type="submit" class="btn btn-primary" :disabled="saving"><Loader2 v-if="saving" :size="16" class="spin" />{{ saving ? 'Saving…' : 'Save settings' }}</button></div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.links { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); margin-bottom: 18px; }
.link { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-align: left; cursor: pointer; color: var(--text-dim); }
.link:hover { background: rgba(0, 102, 255, 0.04); color: var(--blue-ink); }
.link .t { flex: 1; min-width: 0; } .link strong { display: block; color: var(--text); } .link small { display: block; color: var(--text-mute); font-size: 13px; }
.stack { display: grid; gap: 16px; max-width: 100%; }
.box { padding: 20px; }
h2 { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.hint { margin: 4px 0 12px; font-size: 13px; color: var(--text-mute); }
.row { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; margin-top: 10px; }
.row .wide { grid-column: 1 / -1; }
.sum { margin-top: 14px; font-size: 14px; color: var(--text-dim); line-height: 1.5; }
.bar { display: flex; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
</style>