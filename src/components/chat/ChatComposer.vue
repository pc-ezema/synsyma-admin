<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ImagePlus, Lock, SendHorizontal, X } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'

defineProps<{ canReply: boolean; closed?: boolean }>()
const emit = defineEmits<{ send: [body: string, file?: File] }>()

const text = ref('')
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)
const area = ref<HTMLTextAreaElement | null>(null)
const ok = ['image/jpeg', 'image/png', 'image/webp']

const ready = computed(() => text.value.trim().length > 0 || !!file.value)

function pick(f?: File | null) {
  if (!f) return
  if (!ok.includes(f.type)) return toast.error('Use a JPG, PNG or WebP photo.')
  if (f.size > 5 * 1024 * 1024) return toast.error('The photo must be 5MB or smaller.')
  clear()
  file.value = f
  preview.value = URL.createObjectURL(f)
}
function clear() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  file.value = null; preview.value = null
  if (input.value) input.value.value = ''
}
function grow() {
  const el = area.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
}
function submit() {
  if (!ready.value) return
  emit('send', text.value.trim(), file.value ?? undefined)
  text.value = ''
  if (preview.value) preview.value = null // ownership moves to the message
  file.value = null
  if (input.value) input.value.value = ''
  requestAnimationFrame(grow)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit() }
}
function onPaste(e: ClipboardEvent) {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
  if (f) { e.preventDefault(); pick(f) }
}
onBeforeUnmount(clear)
</script>

<template>
  <div v-if="!canReply" class="view-only"><Lock :size="16" /> You have view-only access to chat.</div>
  <form v-else class="composer" @submit.prevent="submit">
    <p v-if="closed" class="closed-note">This conversation is closed. Sending a reply will not reopen it.</p>
    <div v-if="preview" class="prev">
      <img :src="preview" alt="Selected photo" />
      <button type="button" aria-label="Remove photo" @click="clear"><X :size="14" /></button>
    </div>
    <div class="bar">
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="pick(($event.target as HTMLInputElement).files?.[0])" />
      <button type="button" class="icon-btn" aria-label="Attach photo" @click="input?.click()"><ImagePlus :size="19" /></button>
      <textarea ref="area" v-model="text" rows="1" placeholder="Write a reply" aria-label="Message" maxlength="4000" @input="grow" @keydown="onKey" @paste="onPaste" />
      <button type="submit" class="send" :disabled="!ready" aria-label="Send"><SendHorizontal :size="19" /></button>
    </div>
  </form>
</template>

<style scoped>
.composer { padding: 12px 16px 16px; background: #fff; border-top: 1px solid var(--line); display: grid; gap: 8px; }
.view-only { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; background: #fff; border-top: 1px solid var(--line); color: var(--text-mute); font-size: 14px; }
.closed-note { font-size: 13px; color: var(--text-mute); }
.bar { display: flex; align-items: flex-end; gap: 8px; }
textarea { flex: 1; min-height: 42px; max-height: 140px; resize: none; padding: 10px 14px; line-height: 1.4; background: #fff; border: 1px solid rgba(4, 20, 59, 0.16); border-radius: 21px; outline: none; }
textarea:focus { border-color: var(--teal); box-shadow: 0 0 0 4px rgba(22, 129, 115, 0.14); }
.send { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border: 0; border-radius: 50%; color: #fff; background: var(--teal); }
.send:disabled { opacity: 0.4; cursor: not-allowed; }
.prev { position: relative; width: 96px; }
.prev img { display: block; width: 96px; height: 96px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); }
.prev button { position: absolute; top: -6px; right: -6px; display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 50%; color: #fff; background: var(--syn-navy); }
</style>
