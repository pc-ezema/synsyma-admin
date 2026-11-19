<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Loader2, MapPin, Search } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { countryName } from '@/lib/regions'
import type { AddressSuggestion } from '@/lib/address'
import type { CountryCode } from '@/types'

/** Type a street address, pick a suggestion, and the fields below fill in. Searches inside the chosen country. */
const props = defineProps<{ country: CountryCode; idp: string }>()
const emit = defineEmits<{ (e: 'pick', a: AddressSuggestion): void }>()

const text = ref('')
const items = ref<AddressSuggestion[]>([])
const open = ref(false)
const loading = ref(false)
const searched = ref(false)
const unavailable = ref(false)
const active = ref(-1)
const filled = ref('')
let timer: number | undefined
let ctrl: AbortController | null = null

const listId = computed(() => `${props.idp}-addr-list`)

function onInput() {
  window.clearTimeout(timer)
  ctrl?.abort()
  const q = text.value.trim()
  unavailable.value = false; searched.value = false; filled.value = ''
  if (q.length < 3) { items.value = []; open.value = false; loading.value = false; return }
  loading.value = true; open.value = true
  timer = window.setTimeout(() => run(q), 350)
}

async function run(q: string) {
  const mine = new AbortController()
  ctrl = mine
  try {
    const res = await api.get<{ data: AddressSuggestion[] }>('/admin/address-search', { params: { q, country: props.country }, signal: mine.signal })
    items.value = res.data.data; active.value = -1; searched.value = true
  } catch {
    if (mine.signal.aborted) return
    items.value = []; unavailable.value = true
  } finally {
    if (!mine.signal.aborted) loading.value = false
  }
}

function pick(a: AddressSuggestion) {
  emit('pick', a)
  filled.value = a.label
  text.value = ''; items.value = []; open.value = false; searched.value = false; active.value = -1
}

function onFocus() { if (text.value.trim().length >= 3) open.value = true }

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault() // never submit the contractor form from here
    const a = items.value[active.value]
    if (open.value && a) pick(a)
    return
  }
  if (e.key === 'Escape') { open.value = false; return }
  if (!open.value || !items.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = (active.value + 1) % items.value.length }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = (active.value - 1 + items.value.length) % items.value.length }
}

onBeforeUnmount(() => { window.clearTimeout(timer); ctrl?.abort() })
</script>

<template>
  <div class="as">
    <label class="label" :for="`${idp}-search`">Find the address <span class="opt">(optional)</span></label>
    <div class="box">
      <Search :size="16" class="ic" aria-hidden="true" />
      <input
        :id="`${idp}-search`" v-model="text" type="text" class="input pl" role="combobox" autocomplete="off" maxlength="120"
        aria-autocomplete="list" :aria-expanded="open" :aria-controls="listId" :aria-activedescendant="active >= 0 ? `${idp}-opt-${active}` : undefined"
        :placeholder="`Start typing a street address in ${countryName(country)}`"
        @input="onInput" @keydown="onKey" @focus="onFocus" @blur="open = false"
      />
      <Loader2 v-if="loading" :size="16" class="spin" aria-hidden="true" />
    </div>

    <ul v-if="open && (items.length || searched || unavailable)" :id="listId" class="list" role="listbox" aria-label="Address suggestions">
      <li
        v-for="(a, i) in items" :id="`${idp}-opt-${i}`" :key="a.label" role="option" :aria-selected="i === active" :class="{ on: i === active }"
        @mousedown.prevent @click="pick(a)" @mouseenter="active = i"
      ><MapPin :size="15" aria-hidden="true" /><span>{{ a.label }}</span></li>
      <li v-if="unavailable" class="note" role="presentation">Address search isn't available right now. Fill the fields below by hand.</li>
      <li v-else-if="searched && !items.length" class="note" role="presentation">No matches. Check the spelling, or fill the fields below by hand.</li>
    </ul>

    <p v-if="filled" class="hint ok" role="status">Filled from: {{ filled }}. Check the details below, and add the unit or suite if there is one.</p>
    <p v-else class="hint">Pick a result to fill the street, city, province or state and postal code. Suggestions by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>.</p>
  </div>
</template>

<style scoped>
.as { display: block; }
.opt { font-weight: 500; color: var(--text-mute); }
.box { position: relative; }
.ic { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-mute); pointer-events: none; }
.pl { padding-left: 38px; padding-right: 38px; }
.spin { position: absolute; right: 13px; top: 50%; margin-top: -8px; color: var(--text-mute); animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.list { list-style: none; margin: 6px 0 0; padding: 4px; border: 1.5px solid var(--line); border-radius: 12px; background: #fff; max-height: 260px; overflow-y: auto; }
.list li { display: flex; align-items: flex-start; gap: 8px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; line-height: 1.4; }
.list li svg { flex: none; margin-top: 2px; color: var(--blue); }
.list li.on { background: rgba(0, 102, 255, 0.08); }
.list li.note { cursor: default; color: var(--text-mute); }
.hint { margin: 6px 0 0; font-size: 13px; color: var(--text-mute); }
.hint.ok { color: var(--text-dim); }
.hint a { color: var(--blue-ink); }
</style>