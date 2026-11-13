<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BadgeCheck, Circle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { formatDateTime } from '@/lib/format'
import type { ContractorDetail } from '@/types'

const props = defineProps<{ contractor: ContractorDetail; canUpdate: boolean; canVerify: boolean }>()
const emit = defineEmits<{ (e: 'updated', c: ContractorDetail): void }>()

const idTypes: Record<string, string> = { passport: 'Passport', drivers_licence: "Driver's licence", national_id: 'National ID card' }
const bgLabels: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', passed: 'Passed', failed: 'Failed' }
const bgPill: Record<string, string> = { not_started: '', in_progress: 'amber', passed: 'green', failed: 'red' }
const socials: { key: string; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/...' },
  { key: 'website', label: 'Website', placeholder: 'https://...' },
]

const v = computed(() => props.contractor.verification)
const checklist = computed(() => [
  { ok: v.value.checks.id, label: 'Government-approved photo ID on file' },
  { ok: v.value.checks.tax_ack, label: 'Agreed to handle their own taxes' },
  { ok: v.value.checks.background_consent, label: 'Consented to a background check' },
  { ok: v.value.checks.background_check, label: 'Background check passed' },
])

const form = reactive({ id_type: '', social: {} as Record<string, string>, bg_status: 'not_started', bg_notes: '' })
const errors = reactive<Record<string, string>>({})
const saving = ref('')

function fill() {
  const c = props.contractor
  form.id_type = c.id_type ?? ''
  form.social = Object.fromEntries(socials.map((s) => [s.key, (c.social_links as Record<string, string> | null)?.[s.key] ?? '']))
  form.bg_status = c.background_status
  form.bg_notes = c.background_notes ?? ''
}
watch(() => props.contractor, fill, { immediate: true })

async function patch(key: string, body: Record<string, unknown>, ok: string, path = 'verification') {
  saving.value = key; Object.keys(errors).forEach((k) => delete errors[k])
  try {
    const res = await api.patch<{ data: ContractorDetail }>(`/admin/contractors/${props.contractor.id}/${path}`, body)
    emit('updated', res.data.data); toast.success(ok)
  } catch (e) {
    const err = parseError(e, "Couldn't save.")
    const fields = (err as { fields?: Record<string, string> }).fields
    if (fields && Object.keys(fields).length) Object.assign(errors, fields); else toast.error(err.message)
  } finally { saving.value = '' }
}

const saveDetails = () => patch('details', { id_type: form.id_type || null, social_links: form.social }, 'Details saved.')
const saveBackground = () => patch('bg', { background_status: form.bg_status, background_notes: form.bg_notes.trim() || null }, 'Background check saved.', 'background-check')

async function record(field: 'tax_ack' | 'background_consent', what: string) {
  const yes = await confirm({
    title: `Record ${what}?`,
    message: `Only do this if ${props.contractor.name} has agreed to it (in writing or by phone). It is logged with your name and the time as "recorded by admin".`,
    confirmText: 'Record it', tone: 'primary',
  })
  if (yes) await patch(field, { [field]: true }, 'Recorded.')
}
</script>

<template>
  <section class="card box">
    <div class="head">
      <h2>Verification</h2>
      <span class="pill" :class="v.ready ? 'green' : 'amber'">{{ v.ready ? 'Ready to approve' : `${v.missing.length} still needed` }}</span>
    </div>

    <ul class="check">
      <li v-for="c in checklist" :key="c.label" :class="{ ok: c.ok }">
        <CheckCircle2 v-if="c.ok" :size="18" aria-hidden="true" /><Circle v-else :size="18" aria-hidden="true" />{{ c.label }}
      </li>
    </ul>

    <h3>Agreements</h3>
    <dl>
      <dt>Taxes</dt>
      <dd>
        <template v-if="contractor.tax_ack_at">Agreed {{ formatDateTime(contractor.tax_ack_at) }} <small>({{ contractor.consent_source === 'admin' ? 'recorded by admin' : 'by the contractor' }})</small></template>
        <template v-else>Not recorded <button v-if="canUpdate" type="button" class="btn btn-ghost btn-sm" :disabled="!!saving" @click="record('tax_ack', 'the tax agreement')">Record it</button></template>
      </dd>
      <dt>Background check</dt>
      <dd>
        <template v-if="contractor.background_consent_at">Agreed {{ formatDateTime(contractor.background_consent_at) }} <small>({{ contractor.consent_source === 'admin' ? 'recorded by admin' : 'by the contractor' }})</small></template>
        <template v-else>Not recorded <button v-if="canUpdate" type="button" class="btn btn-ghost btn-sm" :disabled="!!saving" @click="record('background_consent', 'consent to a background check')">Record it</button></template>
      </dd>
    </dl>

    <template v-if="canUpdate">
      <h3>ID and social links</h3>
      <label class="label" for="idt">ID type</label>
      <select id="idt" v-model="form.id_type" class="select">
        <option value="">Not given</option>
        <option v-for="(l, k) in idTypes" :key="k" :value="k">{{ l }}</option>
      </select>
      <p class="hint">The ID file itself is under Documents below{{ canVerify ? '' : '. Only admins with ID access can open it' }}.</p>

      <div v-for="s in socials" :key="s.key" class="sl">
        <label class="label" :for="`soc-${s.key}`">{{ s.label }}</label>
        <input :id="`soc-${s.key}`" v-model="form.social[s.key]" type="url" class="input" :class="{ invalid: errors[`social_links.${s.key}`] }" :placeholder="s.placeholder" maxlength="190" />
        <p v-if="errors[`social_links.${s.key}`]" class="err-text">{{ errors[`social_links.${s.key}`] }}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="!!saving" @click="saveDetails"><Loader2 v-if="saving === 'details'" :size="15" class="spin" /> Save details</button>
    </template>
    <template v-else-if="contractor.social_links && Object.keys(contractor.social_links).length">
      <h3>Social links</h3>
      <ul class="links"><li v-for="(url, k) in contractor.social_links" :key="k"><a :href="url" target="_blank" rel="noopener noreferrer">{{ k }} <ExternalLink :size="12" /></a></li></ul>
    </template>

    <h3>Background check</h3>
    <p class="cur">
      <span class="pill" :class="bgPill[contractor.background_status]">{{ bgLabels[contractor.background_status] }}</span>
      <small v-if="contractor.background_checked_at"> on {{ formatDateTime(contractor.background_checked_at) }}</small>
    </p>
    <p v-if="contractor.background_notes && !canVerify" class="muted">Notes are visible to admins with verification access.</p>
    <template v-if="canVerify">
      <label class="label" for="bgs">Result</label>
      <select id="bgs" v-model="form.bg_status" class="select" :class="{ invalid: errors.background_status }">
        <option v-for="(l, k) in bgLabels" :key="k" :value="k">{{ l }}</option>
      </select>
      <p v-if="errors.background_status" class="err-text">{{ errors.background_status }}</p>
      <label class="label" for="bgn">Notes <span class="muted">(private)</span></label>
      <textarea id="bgn" v-model="form.bg_notes" class="input ta" rows="3" maxlength="1000" />
      <button type="button" class="btn btn-primary btn-sm" :disabled="!!saving" @click="saveBackground"><Loader2 v-if="saving === 'bg'" :size="15" class="spin" /><BadgeCheck v-else :size="15" /> Save result</button>
    </template>
  </section>
</template>

<style scoped>
.box { padding: 20px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.head h2 { margin: 0; font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.box h3 { margin: 18px 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-mute); }
.check { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.check li { display: flex; align-items: center; gap: 8px; color: var(--text-mute); }
.check li.ok { color: var(--text); } .check li.ok svg { color: var(--emerald, #00b32c); }
dl { display: grid; grid-template-columns: 130px 1fr; gap: 10px 14px; margin: 0; }
dt { color: var(--text-mute); font-size: 14px; } dd { margin: 0; } dd small { color: var(--text-mute); }
.sl { margin-top: 10px; }
.hint, .muted { margin-top: 6px; font-size: 13.5px; color: var(--text-mute); }
.links { list-style: none; margin: 8px 0 0; padding: 0; display: flex; gap: 12px; flex-wrap: wrap; }
.links a { color: var(--blue-ink); text-transform: capitalize; text-decoration: none; } .links a:hover { text-decoration: underline; }
.cur { margin: 0 0 10px; }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; margin-bottom: 10px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.btn-sm { margin-top: 12px; }
</style>