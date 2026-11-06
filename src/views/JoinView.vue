<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AlertCircle, CheckCircle2, Loader2, Paperclip } from 'lucide-vue-next'
import { bare } from '@/lib/api'
import { parseError } from '@/lib/errors'
import BrandMark from '@/components/BrandMark.vue'
import ContractorFields from '@/components/contractors/ContractorFields.vue'
import { blankContractorForm, contractorBody, validateContractorForm, type ContractorFormState } from '@/lib/contractors'
import type { JoinOptions } from '@/types'

/** Public page (no login). A QR code or advert opens it as /join?ref=CODE. */
const route = useRoute()
const ref_ = typeof route.query.ref === 'string' ? route.query.ref.slice(0, 24) : ''

const form = ref<ContractorFormState>(blankContractorForm())
const categories = ref<{ id: string; name: string }[]>([])
const loadingOptions = ref(true)
const optionsError = ref('')
const errors = ref<Record<string, string>>({})
const error = ref('')
const sending = ref(false)
const done = ref(false)
const agreed = ref(false)
const honey = ref('') // real people never see or fill this
const files = reactive<{ id: File | null; insurance: File | null; licence: File | null }>({ id: null, insurance: null, licence: null })

onMounted(async () => {
  try {
    const { data } = await bare.get<{ data: JoinOptions }>('/admin/public/join/options', { params: ref_ ? { ref: ref_ } : {} })
    categories.value = data.data.categories
  } catch (e) { optionsError.value = parseError(e, "Couldn't load the form.").message } finally { loadingOptions.value = false }
})

const docSlots = computed(() => [
  { key: 'id' as const, label: form.value.type === 'individual' ? 'Photo ID (required)' : 'Photo ID of the owner (optional)' },
  { key: 'insurance' as const, label: 'Insurance certificate (optional)' },
  { key: 'licence' as const, label: 'Business licence (optional)' },
])
function pick(key: 'id' | 'insurance' | 'licence', e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  errors.value = { ...errors.value, documents: '' }
  if (f && f.size > 5 * 1024 * 1024) { errors.value = { ...errors.value, documents: 'Each file must be 5 MB or smaller.' }; return }
  if (f && !['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) { errors.value = { ...errors.value, documents: 'Use JPG, PNG or PDF files.' }; return }
  files[key] = f
}

async function submit() {
  if (sending.value) return
  const e = validateContractorForm(form.value)
  if (form.value.type === 'individual' && !files.id) e.documents = 'Upload a photo ID.'
  if (!agreed.value) e.agreed = 'Please confirm the details are correct.'
  errors.value = e; error.value = ''
  if (Object.keys(e).some((k) => e[k])) { document.querySelector('.err-text')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }

  const body = contractorBody(form.value) as Record<string, unknown>
  const fd = new FormData()
  for (const [k, v] of Object.entries(body)) {
    if (k === 'category_ids') (v as string[]).forEach((id) => fd.append('category_ids[]', id))
    else if (k === 'areas') (v as { region: string; city: string | null }[]).forEach((a, i) => { fd.append(`areas[${i}][region]`, a.region); fd.append(`areas[${i}][city]`, a.city ?? '') })
    else if (v !== null && v !== undefined) fd.append(k, String(v))
  }
  let n = 0
  for (const [kind, file] of Object.entries(files)) if (file) { fd.append(`documents[${n}][kind]`, kind); fd.append(`documents[${n}][file]`, file); n++ }
  if (ref_) fd.append('ref', ref_)
  fd.append('agreed', '1'); fd.append('website', honey.value)

  sending.value = true
  try { await bare.post('/admin/public/join/apply', fd, { timeout: 60000 }); done.value = true; window.scrollTo({ top: 0 }) }
  catch (err) {
    const pe = parseError(err)
    const f: Record<string, string> = {}
    for (const [k, v] of Object.entries(pe.fields)) f[k.startsWith('documents') ? 'documents' : k.startsWith('areas') ? 'areas' : k] = v
    errors.value = f
    if (!Object.keys(f).length) error.value = pe.message
  } finally { sending.value = false }
}
</script>

<template>
  <div class="join">
    <header class="top"><BrandMark :size="34" /><span>Synsyma</span></header>

    <main class="wrap">
      <div v-if="done" class="card done" role="status">
        <CheckCircle2 :size="44" class="ok" aria-hidden="true" />
        <h1>Application received</h1>
        <p>Thank you. Our team will review your details and contact you by email or phone. You do not need to do anything else.</p>
      </div>

      <template v-else>
        <div class="intro">
          <h1>Work with Synsyma</h1>
          <p>Tell us about your company or yourself. We review every application, then match you with customer bookings in your area.</p>
        </div>

        <div v-if="loadingOptions" class="card pad"><span v-for="i in 5" :key="i" class="skeleton" style="height: 46px; margin-bottom: 12px" /></div>
        <div v-else-if="optionsError" class="card"><div class="empty"><AlertCircle :size="28" /><p>{{ optionsError }}</p><button type="button" class="btn btn-ghost" @click="$router.go(0)">Try again</button></div></div>

        <form v-else class="card pad form" novalidate @submit.prevent="submit">
          <p v-if="error" class="alert" role="alert"><AlertCircle :size="16" /> {{ error }}</p>
          <ContractorFields v-model="form" :errors="errors" :categories="categories" idp="jn" />

          <fieldset>
            <legend class="label">Documents</legend>
            <ul class="docs">
              <li v-for="s in docSlots" :key="s.key">
                <span class="dl">{{ s.label }}</span>
                <label class="btn btn-ghost btn-sm pick"><Paperclip :size="15" /> {{ files[s.key] ? 'Change' : 'Choose file' }}<input type="file" accept="image/jpeg,image/png,application/pdf" class="sr-only" @change="pick(s.key, $event)" /></label>
                <small v-if="files[s.key]" class="fn">{{ files[s.key]?.name }}</small>
              </li>
            </ul>
            <p v-if="errors.documents" class="err-text">{{ errors.documents }}</p>
            <p v-else class="hint">JPG, PNG or PDF, up to 5 MB each. Only our review team can see these.</p>
          </fieldset>

          <div class="hp" aria-hidden="true"><label>Website<input v-model="honey" type="text" tabindex="-1" autocomplete="off" /></label></div>

          <div>
            <label class="agree"><input v-model="agreed" type="checkbox" /> <span>I confirm the details above are correct.</span></label>
            <p v-if="errors.agreed" class="err-text">{{ errors.agreed }}</p>
          </div>

          <button type="submit" class="btn btn-primary send" :disabled="sending"><Loader2 v-if="sending" :size="18" class="spin" /> Send application</button>
        </form>
      </template>
    </main>
  </div>
</template>

<style scoped>
.join { min-height: 100dvh; background: var(--page); }
.top { display: flex; align-items: center; gap: 10px; padding: 16px max(16px, calc((100% - 720px) / 2)); font-family: var(--font-display); font-weight: 600; font-size: 18px; }
.wrap { max-width: 720px; margin: 0 auto; padding: 8px 16px 48px; }
.intro { margin: 10px 0 20px; } .intro h1 { font-family: var(--font-display); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; } .intro p { margin-top: 6px; color: var(--text-dim); line-height: 1.55; }
.pad { padding: 22px; }
.form { display: grid; gap: 20px; }
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; } legend { padding: 0; }
.docs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.docs li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dl { flex: 1 1 220px; font-size: 14px; }
.pick { cursor: pointer; } .fn { flex-basis: 100%; color: var(--text-mute); overflow-wrap: anywhere; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.agree { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 14px; } .agree input { margin-top: 3px; width: 18px; height: 18px; }
.send { height: 50px; font-size: 16px; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.done { padding: 40px 24px; text-align: center; display: grid; gap: 10px; justify-items: center; } .done h1 { font-family: var(--font-display); font-size: 24px; } .done p { color: var(--text-dim); max-width: 440px; line-height: 1.55; } .ok { color: var(--green-ink); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
