<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, MessageSquare } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/lib/format'
import { localWhen, money, statusLabel, statusPill } from '@/lib/bookings'
import Modal from '@/components/ui/Modal.vue'
import StarRating from '@/components/reviews/StarRating.vue'
import type { Conversation, UserDetail, UserEmailChange } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canManage = computed(() => auth.can('users.manage'))
const canChat = computed(() => auth.can('chat.view'))
const canEmail = computed(() => auth.can('users.change_email'))
const id = String(route.params.id)

const u = ref<UserDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load() {
  loading.value = true; error.value = ''
  try { u.value = (await api.get<{ data: UserDetail }>(`/admin/users/${id}`)).data.data }
  catch (e) { error.value = parseError(e, "Couldn't load this customer.").message } finally { loading.value = false }
}
onMounted(load)

// ---- chat: open their conversation if they have one ----
async function openChat() {
  if (!u.value) return
  busy.value = true
  try {
    for (const q of [u.value.email, u.value.full_name]) {
      if (!q) continue
      const { data } = await api.get<{ data: Conversation[] }>('/admin/chat/conversations', { params: { search: q, per_page: 25 } })
      const hit = data.data.find((c) => c.user.id === u.value!.id)
      if (hit) { router.push({ name: 'chat', params: { id: hit.id } }); return }
    }
    toast.info('No chat with this customer yet. They start one from the app.')
  } catch (e) { toast.error(parseError(e, "Couldn't look up their chat.").message) } finally { busy.value = false }
}

// ---- change email: starts a request; the email only changes when the new address confirms ----
const pending = computed(() => u.value?.email_changes.find((c) => c.status === 'pending') ?? null)
const changeLabel: Record<UserEmailChange['status'], string> = { pending: 'Waiting for confirmation', confirmed: 'Changed', cancelled: 'Cancelled', expired: 'Expired' }
const ec = reactive({ open: false, saving: false, email: '', reason: '', password: '', show: false, errors: {} as Record<string, string>, error: '' })
function askEmail() { Object.assign(ec, { open: true, saving: false, email: '', reason: '', password: '', show: false, errors: {}, error: '' }) }
async function submitEmail() {
  ec.errors = {}; ec.error = ''
  if (!/^\S+@\S+\.\S+$/.test(ec.email.trim())) { ec.errors.new_email = 'Enter a valid email address.'; return }
  if (ec.reason.trim().length < 5) { ec.errors.reason = 'Give a short reason.'; return }
  if (!ec.password) { ec.errors.password = 'Enter your password to confirm.'; return }
  ec.saving = true
  try {
    const res = await api.post<{ message: string; data: { email_changes: UserEmailChange[] } }>(`/admin/users/${id}/email`, { new_email: ec.email.trim(), reason: ec.reason.trim(), password: ec.password })
    if (u.value) u.value.email_changes = res.data.data.email_changes
    toast.success(res.data.message); ec.open = false
  } catch (e) { const pe = parseError(e); ec.errors = pe.fields; if (!Object.keys(pe.fields).length) ec.error = pe.message } finally { ec.saving = false; ec.password = '' }
}
async function cancelEmail() {
  const yes = await confirm({ title: 'Cancel this email change?', message: 'The link sent to the new address stops working. Their email stays as it is.', confirmText: 'Cancel change', tone: 'danger' })
  if (!yes) return
  busy.value = true
  try { const res = await api.delete<{ message: string; data: { email_changes: UserEmailChange[] } }>(`/admin/users/${id}/email`); if (u.value) u.value.email_changes = res.data.data.email_changes; toast.success(res.data.message) }
  catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}

// ---- deactivate (needs a reason) / reactivate ----
const off = reactive({ open: false, reason: '', error: '', saving: false })
function askDeactivate() { Object.assign(off, { open: true, reason: '', error: '', saving: false }) }
async function submitDeactivate() {
  if (off.reason.trim().length < 3) { off.error = 'Give a short reason.'; return }
  off.saving = true; off.error = ''
  try {
    const res = await api.patch<{ message: string; data: UserDetail }>(`/admin/users/${id}/status`, { active: false, reason: off.reason.trim() })
    u.value = res.data.data; toast.success(res.data.message); off.open = false
  } catch (e) { off.error = parseError(e).message } finally { off.saving = false }
}
async function reactivate() {
  const yes = await confirm({ title: 'Reactivate this account?', message: 'They can sign in again straight away.', confirmText: 'Reactivate', tone: 'primary' })
  if (!yes) return
  busy.value = true
  try { const res = await api.patch<{ message: string; data: UserDetail }>(`/admin/users/${id}/status`, { active: true }); u.value = res.data.data; toast.success(res.data.message) }
  catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}
</script>

<template>
  <div>
    <button type="button" class="back" @click="router.push('/users')"><ArrowLeft :size="16" /> Users</button>

    <div v-if="loading && !u" class="card pad"><span v-for="i in 4" :key="i" class="skeleton" style="height: 48px; margin-bottom: 10px" /></div>
    <div v-else-if="error" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ error }}</p><button type="button" class="btn btn-ghost" @click="load">Try again</button></div></div>

    <template v-else-if="u">
      <div class="page-head">
        <div>
          <h1>{{ u.full_name || u.email }} <span class="pill" :class="u.is_active ? 'green' : 'grey'">{{ u.is_active ? 'Active' : 'Inactive' }}</span></h1>
          <p>Customer since {{ formatDateTime(u.created_at) }}</p>
        </div>
        <div class="acts">
          <button v-if="canChat" type="button" class="btn btn-primary" :disabled="busy" @click="openChat"><Loader2 v-if="busy" :size="16" class="spin" /><MessageSquare v-else :size="16" /> Chat with customer</button>
          <button v-if="canEmail" type="button" class="btn btn-ghost" :disabled="busy" @click="askEmail">Change email</button>
          <template v-if="canManage">
            <button v-if="u.is_active" type="button" class="btn btn-ghost danger" :disabled="busy" @click="askDeactivate">Deactivate account</button>
            <button v-else type="button" class="btn btn-ghost" :disabled="busy" @click="reactivate">Reactivate account</button>
          </template>
        </div>
      </div>

      <p v-if="!u.is_active" class="note" role="status">
        This account is deactivated<template v-if="u.deactivated_at"> since {{ formatDateTime(u.deactivated_at) }}</template>. They cannot sign in.
        <template v-if="u.deactivation_reason"><br />Reason: {{ u.deactivation_reason }}</template>
      </p>

      <p v-if="pending" class="note info" role="status">
        Waiting for the customer to confirm <strong>{{ pending.new_email }}</strong>. The link expires {{ formatDateTime(pending.expires_at) }}. Their email stays <strong>{{ u.email }}</strong> until then.
        <button v-if="canEmail" type="button" class="lnkbtn" :disabled="busy" @click="cancelEmail">Cancel this change</button>
      </p>

      <div class="grid">
        <section class="card box">
          <h2>Profile</h2>
          <dl>
            <dt>Name</dt><dd>{{ u.full_name || '—' }}</dd>
            <dt>Email</dt><dd><a :href="`mailto:${u.email}`">{{ u.email }}</a><small>{{ u.email_verified ? 'Verified' : 'Not verified yet' }}</small></dd>
            <dt>Phone</dt><dd><a v-if="u.phone" :href="`tel:${u.phone}`">{{ u.phone }}</a><template v-else>—</template></dd>
            <dt>Address</dt><dd>{{ u.address || '—' }}</dd>
            <dt>Last login</dt><dd>{{ u.last_login_at ? formatDateTime(u.last_login_at) : 'Never' }}</dd>
            <dt>Terms</dt><dd><template v-if="u.terms_accepted_at">Accepted {{ formatDateTime(u.terms_accepted_at) }}<small v-if="u.terms_version">Version {{ u.terms_version }}</small></template><template v-else>—</template></dd>
          </dl>
        </section>

        <section class="card box">
          <h2>Activity</h2>
          <div class="nums">
            <div><strong>{{ u.stats.bookings }}</strong><span>Bookings</span></div>
            <div><strong>{{ u.stats.completed }}</strong><span>Completed</span></div>
            <div><strong>{{ u.stats.cancelled }}</strong><span>Cancelled</span></div>
            <div><strong>{{ u.paid_total ? money(u.paid_total, 'USD') : '—' }}</strong><span>Total paid</span></div>
          </div>
          <p class="muted"><template v-if="u.stats.reviews">{{ u.stats.reviews }} {{ u.stats.reviews === 1 ? 'review' : 'reviews' }} given, average <strong>{{ u.stats.average_rating }}</strong> / 5.</template><template v-else>No reviews given yet.</template></p>
        </section>

        <section v-if="u.email_changes.length" class="card box wide">
          <h2>Email changes</h2>
          <ul class="ech">
            <li v-for="c in u.email_changes" :key="c.id">
              <div><strong>{{ c.old_email }}</strong> to <strong>{{ c.new_email }}</strong> <span class="pill" :class="{ green: c.status === 'confirmed', grey: c.status === 'cancelled' || c.status === 'expired' }">{{ changeLabel[c.status] }}</span></div>
              <p class="muted">{{ c.reason }}</p>
              <small class="muted">Started {{ formatDateTime(c.created_at) }}<template v-if="c.requested_by"> by {{ c.requested_by }}</template><template v-if="c.confirmed_at"> · confirmed {{ formatDateTime(c.confirmed_at) }}</template></small>
            </li>
          </ul>
        </section>

        <section class="card box wide">
          <h2>Bookings <small class="muted">{{ u.bookings.length < u.stats.bookings ? `latest ${u.bookings.length} of ${u.stats.bookings}` : '' }}</small></h2>
          <p v-if="!u.bookings.length" class="muted">No bookings yet.</p>
          <div v-else class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Reference</th><th>Service</th><th>When</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="b in u.bookings" :key="b.id" class="click" tabindex="0" @click="router.push(`/bookings/${b.id}`)" @keydown.enter="router.push(`/bookings/${b.id}`)">
                  <td>{{ b.reference }}</td><td>{{ b.service_name }}</td><td>{{ localWhen(b.starts_at_local) }}</td><td>{{ b.total_label || '—' }}</td>
                  <td><span class="pill" :class="statusPill[b.status]">{{ statusLabel[b.status] }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="u.reviews.length" class="card box wide">
          <h2>Reviews they gave</h2>
          <ul class="rv">
            <li v-for="r in u.reviews" :key="r.id">
              <div><StarRating :rating="r.rating" /> <router-link :to="`/bookings/${r.booking_id}`" class="lnk">{{ r.service_name }} · {{ r.reference }}</router-link> <span v-if="r.is_hidden" class="pill grey">Hidden</span></div>
              <p v-if="r.comment" class="pre">{{ r.comment }}</p>
              <small class="muted">{{ formatDateTime(r.created_at) }}</small>
            </li>
          </ul>
        </section>
      </div>

      <Modal :open="ec.open" title="Change email" :width="480" @close="ec.open = false">
        <form id="email-form" novalidate @submit.prevent="submitEmail">
          <p v-if="ec.error" class="err-text">{{ ec.error }}</p>
          <p class="muted">Nothing changes yet. We email a confirmation link to the new address and a notice to <strong>{{ u.email }}</strong>. The email changes when the new address is confirmed, and the customer is signed out.</p>
          <label class="label" for="ec-email">New email</label>
          <input id="ec-email" v-model="ec.email" type="email" class="input" :class="{ invalid: ec.errors.new_email }" autocomplete="off" inputmode="email">
          <p v-if="ec.errors.new_email" class="err-text">{{ ec.errors.new_email }}</p>
          <label class="label" for="ec-why">Reason <span class="muted">(kept on record)</span></label>
          <textarea id="ec-why" v-model="ec.reason" class="input ta" rows="3" maxlength="300" placeholder="For example: customer wrote from the new address and confirmed their last booking" :class="{ invalid: ec.errors.reason }" />
          <p v-if="ec.errors.reason" class="err-text">{{ ec.errors.reason }}</p>
          <label class="label" for="ec-pw">Your password</label>
          <div class="pwrow"><input id="ec-pw" v-model="ec.password" :type="ec.show ? 'text' : 'password'" class="input" :class="{ invalid: ec.errors.password }" autocomplete="current-password"><button type="button" class="eye" :aria-label="ec.show ? 'Hide password' : 'Show password'" @click="ec.show = !ec.show"><EyeOff v-if="ec.show" :size="17" /><Eye v-else :size="17" /></button></div>
          <p v-if="ec.errors.password" class="err-text">{{ ec.errors.password }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="ec.open = false">Cancel</button>
          <button type="submit" form="email-form" class="btn btn-primary" :disabled="ec.saving"><Loader2 v-if="ec.saving" :size="16" class="spin" /> Send confirmation</button>
        </template>
      </Modal>

      <Modal :open="off.open" title="Deactivate this account" :width="460" @close="off.open = false">
        <form id="off-form" novalidate @submit.prevent="submitDeactivate">
          <p class="muted">They are signed out now and cannot sign in again until you reactivate them. Their bookings stay as they are, so cancel or finish any open ones separately.</p>
          <label class="label" for="off-why">Reason <span class="muted">(kept on record)</span></label>
          <textarea id="off-why" v-model="off.reason" class="input ta" rows="3" maxlength="300" :class="{ invalid: off.error }" />
          <p v-if="off.error" class="err-text">{{ off.error }}</p>
        </form>
        <template #footer>
          <button type="button" class="btn btn-ghost" @click="off.open = false">Keep active</button>
          <button type="submit" form="off-form" class="btn btn-danger" :disabled="off.saving"><Loader2 v-if="off.saving" :size="16" class="spin" /> Deactivate</button>
        </template>
      </Modal>
    </template>
  </div>
</template>

<style scoped>
.pad { padding: 16px; }
.back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; font-weight: 600; color: var(--text-dim); }
.back:hover { color: var(--blue-ink); }
.page-head h1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.danger { color: var(--danger); }
.note { margin-bottom: 16px; padding: 12px 14px; font-size: 14px; border-radius: 12px; background: rgba(214, 69, 69, 0.07); border: 1px solid rgba(214, 69, 69, 0.28); }
.note.info { background: rgba(0, 102, 255, 0.07); border-color: rgba(0, 102, 255, 0.25); }
.lnkbtn { margin-left: 8px; background: none; border: 0; padding: 0; color: var(--blue-ink); font: inherit; font-weight: 600; cursor: pointer; } .lnkbtn:hover { text-decoration: underline; } .lnkbtn:disabled { opacity: 0.55; }
.ech { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.ech li { padding-bottom: 14px; border-bottom: 1px solid var(--line); } .ech li:last-child { border-bottom: 0; padding-bottom: 0; }
.ech p { margin: 4px 0 2px; }
.pwrow { position: relative; } .pwrow .input { padding-right: 44px; }
.eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 38px; height: 38px; background: none; border: 0; color: var(--text-mute); cursor: pointer; }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; align-items: start; }
.wide { grid-column: 1 / -1; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
.box { padding: 20px; }
.box h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 12px; }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 10px 14px; margin: 0; }
dt { color: var(--text-mute); font-size: 14px; } dd { margin: 0; overflow-wrap: anywhere; }
dd small { display: block; color: var(--text-mute); }
dd a, .lnk { color: var(--blue-ink); text-decoration: none; } dd a:hover, .lnk:hover { text-decoration: underline; }
.nums { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.nums div { padding: 12px 14px; background: rgba(0, 0, 0, 0.03); border-radius: 12px; }
.nums strong { display: block; font-family: var(--font-display); font-size: 22px; font-weight: 600; } .nums span { font-size: 13px; color: var(--text-mute); }
.muted { color: var(--text-mute); font-size: 14px; }
tr.click { cursor: pointer; } tr.click:hover { background: rgba(0, 102, 255, 0.04); }
.rv { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.rv li { padding-bottom: 14px; border-bottom: 1px solid var(--line); } .rv li:last-child { border-bottom: 0; padding-bottom: 0; }
.pre { white-space: pre-wrap; line-height: 1.5; margin: 6px 0 4px; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>