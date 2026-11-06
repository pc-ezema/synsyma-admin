<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { COUNTRIES, postalLabel, regionLabel, regionsFor } from '@/lib/regions'
import { resetRegions, type ContractorFormState } from '@/lib/contractors'

/** The fields both the admin form and the public sign-up form share. */
const form = defineModel<ContractorFormState>({ required: true })
defineProps<{ errors: Record<string, string>; categories: { id: string; name: string }[]; idp: string }>()

function toggleCategory(id: string) {
  const i = form.value.category_ids.indexOf(id)
  if (i >= 0) form.value.category_ids.splice(i, 1)
  else form.value.category_ids.push(id)
}
</script>

<template>
  <div class="fields">
    <div>
      <span class="label">I am signing up as</span>
      <div class="seg" role="radiogroup" aria-label="Contractor type">
        <button type="button" role="radio" :aria-checked="form.type === 'company'" :class="{ on: form.type === 'company' }" @click="form.type = 'company'">A company</button>
        <button type="button" role="radio" :aria-checked="form.type === 'individual'" :class="{ on: form.type === 'individual' }" @click="form.type = 'individual'">An individual</button>
      </div>
    </div>

    <div class="two">
      <div>
        <label class="label" :for="`${idp}-name`">{{ form.type === 'company' ? 'Business name' : 'Full name' }}</label>
        <input :id="`${idp}-name`" v-model="form.name" class="input" :class="{ invalid: errors.name }" maxlength="160" autocomplete="organization" />
        <p v-if="errors.name" class="err-text">{{ errors.name }}</p>
      </div>
      <div v-if="form.type === 'company'">
        <label class="label" :for="`${idp}-contact`">Contact person</label>
        <input :id="`${idp}-contact`" v-model="form.contact_name" class="input" :class="{ invalid: errors.contact_name }" maxlength="120" autocomplete="name" />
        <p v-if="errors.contact_name" class="err-text">{{ errors.contact_name }}</p>
      </div>
    </div>

    <div class="two">
      <div>
        <label class="label" :for="`${idp}-email`">Email</label>
        <input :id="`${idp}-email`" v-model="form.email" type="email" class="input" :class="{ invalid: errors.email }" maxlength="190" autocomplete="email" />
        <p v-if="errors.email" class="err-text">{{ errors.email }}</p>
      </div>
      <div>
        <label class="label" :for="`${idp}-phone`">Phone</label>
        <input :id="`${idp}-phone`" v-model="form.phone" type="tel" class="input" :class="{ invalid: errors.phone }" maxlength="20" autocomplete="tel" />
        <p v-if="errors.phone" class="err-text">{{ errors.phone }}</p>
      </div>
    </div>

    <div>
      <label class="label" :for="`${idp}-country`">Country</label>
      <select :id="`${idp}-country`" v-model="form.country" class="select" @change="resetRegions(form)">
        <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.name }}</option>
      </select>
    </div>

    <div>
      <label class="label" :for="`${idp}-addr`">Street address</label>
      <input :id="`${idp}-addr`" v-model="form.address_line1" class="input" :class="{ invalid: errors.address_line1 }" maxlength="160" autocomplete="address-line1" />
      <p v-if="errors.address_line1" class="err-text">{{ errors.address_line1 }}</p>
    </div>

    <div class="three">
      <div>
        <label class="label" :for="`${idp}-city`">City</label>
        <input :id="`${idp}-city`" v-model="form.city" class="input" :class="{ invalid: errors.city }" maxlength="80" autocomplete="address-level2" />
        <p v-if="errors.city" class="err-text">{{ errors.city }}</p>
      </div>
      <div>
        <label class="label" :for="`${idp}-region`">{{ regionLabel(form.country) }}</label>
        <select :id="`${idp}-region`" v-model="form.region" class="select" :class="{ invalid: errors.region }">
          <option value="" disabled>Choose</option>
          <option v-for="r in regionsFor(form.country)" :key="r" :value="r">{{ r }}</option>
        </select>
        <p v-if="errors.region" class="err-text">{{ errors.region }}</p>
      </div>
      <div>
        <label class="label" :for="`${idp}-postal`">{{ postalLabel(form.country) }}</label>
        <input :id="`${idp}-postal`" v-model="form.postal_code" class="input" :class="{ invalid: errors.postal_code }" maxlength="12" autocomplete="postal-code" />
        <p v-if="errors.postal_code" class="err-text">{{ errors.postal_code }}</p>
      </div>
    </div>

    <div>
      <label class="label" :for="`${idp}-tax`">Business / tax number <span class="opt">(optional)</span></label>
      <input :id="`${idp}-tax`" v-model="form.tax_number" class="input" maxlength="60" autocomplete="off" />
    </div>

    <fieldset>
      <legend class="label">Services you offer</legend>
      <div class="chips">
        <button v-for="c in categories" :key="c.id" type="button" class="chip" :class="{ on: form.category_ids.includes(c.id) }" :aria-pressed="form.category_ids.includes(c.id)" @click="toggleCategory(c.id)">{{ c.name }}</button>
      </div>
      <p v-if="!categories.length" class="hint">No service categories are available yet.</p>
      <p v-if="errors.category_ids" class="err-text">{{ errors.category_ids }}</p>
    </fieldset>

    <fieldset>
      <legend class="label">Where you work <span class="opt">(optional)</span></legend>
      <div v-for="(a, i) in form.areas" :key="i" class="area">
        <select v-model="a.region" class="select" :aria-label="`${regionLabel(form.country)} for area ${i + 1}`">
          <option value="" disabled>{{ regionLabel(form.country) }}</option>
          <option v-for="r in regionsFor(form.country)" :key="r" :value="r">{{ r }}</option>
        </select>
        <input v-model="a.city" class="input" maxlength="80" placeholder="City (empty = whole area)" :aria-label="`City for area ${i + 1}`" />
        <button type="button" class="icon-btn" :aria-label="`Remove area ${i + 1}`" @click="form.areas.splice(i, 1)"><X :size="16" /></button>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="form.areas.length >= 30" @click="form.areas.push({ region: form.region, city: '' })"><Plus :size="15" /> Add an area</button>
      <p v-if="errors.areas" class="err-text">{{ errors.areas }}</p>
      <p v-else class="hint">Leave the city empty to cover the whole province or state.</p>
    </fieldset>

    <div>
      <label class="label" :for="`${idp}-about`">About <span class="opt">(optional)</span></label>
      <textarea :id="`${idp}-about`" v-model="form.about" class="input ta" rows="3" maxlength="1000" />
    </div>
  </div>
</template>

<style scoped>
.fields { display: grid; gap: 16px; }
.two { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
.three { display: grid; gap: 14px; grid-template-columns: 1.1fr 1.2fr 0.9fr; }
@media (max-width: 560px) { .two, .three { grid-template-columns: 1fr; } }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { padding: 0; }
.opt { font-weight: 500; color: var(--text-mute); }
.seg { display: inline-flex; padding: 4px; gap: 4px; background: rgba(4, 20, 59, 0.06); border-radius: 12px; }
.seg button { height: 38px; padding: 0 18px; font-weight: 600; color: var(--text-dim); border-radius: 9px; }
.seg button.on { background: #fff; color: var(--text); box-shadow: 0 1px 3px rgba(4, 20, 59, 0.14); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.area { display: grid; grid-template-columns: 1fr 1.2fr auto; gap: 8px; align-items: center; margin-bottom: 8px; }
@media (max-width: 560px) { .area { grid-template-columns: 1fr auto; } .area .input { grid-column: 1; } }
.ta { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }
</style>
