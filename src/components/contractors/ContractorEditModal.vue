<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { toast } from '@/composables/useToast'
import Modal from '@/components/ui/Modal.vue'
import ContractorFields from './ContractorFields.vue'
import { blankContractorForm, formFromContractor, contractorBody, validateContractorForm, type ContractorFormState } from '@/lib/contractors'
import type { ContractorDetail } from '@/types'

const props = defineProps<{ open: boolean; contractor: ContractorDetail | null; categories: { id: string; name: string }[] }>()
const emit = defineEmits<{ close: []; saved: [p: ContractorDetail] }>()

const form = ref<ContractorFormState>(blankContractorForm())
const extra = reactive({ commission: '', notes: '' })
const errors = ref<Record<string, string>>({})
const error = ref('')
const saving = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  errors.value = {}; error.value = ''
  form.value = props.contractor ? formFromContractor(props.contractor) : blankContractorForm()
  extra.commission = props.contractor?.commission_percent != null ? String(props.contractor.commission_percent) : ''
  extra.notes = props.contractor?.admin_notes ?? ''
})

async function save() {
  errors.value = validateContractorForm(form.value); error.value = ''
  if (extra.commission.trim() && !/^\d{1,3}(\.\d{1,2})?$/.test(extra.commission.trim())) errors.value.commission = 'Use a number from 0 to 100.'
  else if (extra.commission.trim() && Number(extra.commission) > 100) errors.value.commission = 'Use a number from 0 to 100.'
  if (Object.keys(errors.value).length) return

  const body = { ...contractorBody(form.value), commission_percent: extra.commission.trim() ? Number(extra.commission) : null, admin_notes: extra.notes.trim() || null }
  saving.value = true
  try {
    const res = props.contractor
      ? await api.patch<{ data: ContractorDetail }>(`/admin/contractors/${props.contractor.id}`, body)
      : await api.post<{ data: ContractorDetail }>('/admin/contractors', body)
    toast.success(props.contractor ? 'Contractor updated.' : 'Contractor added.')
    emit('saved', res.data.data)
  } catch (e) {
    const err = parseError(e)
    errors.value = err.fields
    if (!Object.keys(err.fields).length) error.value = err.message
  } finally { saving.value = false }
}
</script>

<template>
  <Modal :open="open" :title="contractor ? 'Edit contractor' : 'New contractor'" :width="680" @close="emit('close')">
    <form id="contractor-form" novalidate class="form" @submit.prevent="save">
      <p v-if="error" class="alert" role="alert"><AlertCircle :size="16" /> {{ error }}</p>
      <ContractorFields v-model="form" :errors="errors" :categories="categories" idp="pe" />
      <div class="two">
        <div>
          <label class="label" for="pe-commission">Commission % <span class="opt">(optional)</span></label>
          <input id="pe-commission" v-model="extra.commission" class="input" :class="{ invalid: errors.commission || errors.commission_percent }" inputmode="decimal" placeholder="Platform default" />
          <p v-if="errors.commission || errors.commission_percent" class="err-text">{{ errors.commission || errors.commission_percent }}</p>
          <p v-else class="hint">Leave empty to use the platform default.</p>
        </div>
      </div>
      <div>
        <label class="label" for="pe-notes">Private notes <span class="opt">(only admins see this)</span></label>
        <textarea id="pe-notes" v-model="extra.notes" class="input ta" rows="3" maxlength="2000" />
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Cancel</button>
      <button type="submit" form="contractor-form" class="btn btn-primary" :disabled="saving"><Loader2 v-if="saving" :size="16" class="spin" /> {{ contractor ? 'Save changes' : 'Add contractor' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.form { display: grid; gap: 16px; }
.two { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
.opt { font-weight: 500; color: var(--text-mute); }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
.alert { display: flex; gap: 8px; padding: 10px 12px; font-size: 14px; color: #9f1239; background: rgba(217, 45, 74, 0.08); border: 1px solid rgba(217, 45, 74, 0.3); border-radius: 12px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
