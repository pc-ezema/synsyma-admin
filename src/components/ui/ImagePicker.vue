<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, Trash2 } from 'lucide-vue-next'

/** Choose a photo. `current` is the saved photo URL. The parent uploads the chosen file when it saves. */
const props = defineProps<{ current: string | null; file: File | null; removed: boolean; error?: string }>()
const emit = defineEmits<{ (e: 'pick', f: File): void; (e: 'clear'): void; (e: 'invalid', msg: string): void }>()

const input = ref<HTMLInputElement | null>(null)
const preview = ref<string | null>(null)

watch(() => props.file, (f) => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = f ? URL.createObjectURL(f) : null
}, { immediate: true })
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value) })

const shown = computed(() => preview.value ?? (props.removed ? null : props.current))

function onChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return emit('invalid', 'Use a JPG, PNG or WebP photo.')
  if (f.size > 4 * 1024 * 1024) return emit('invalid', 'The photo must be 4 MB or smaller.')
  emit('pick', f)
}
</script>

<template>
  <div class="picker">
    <div class="thumb" :class="{ empty: !shown }">
      <img v-if="shown" :src="shown" alt="Selected photo" />
      <ImagePlus v-else :size="26" aria-hidden="true" />
    </div>
    <div class="side">
      <div class="btns">
        <button type="button" class="btn btn-ghost btn-sm" @click="input?.click()">{{ shown ? 'Change photo' : 'Choose photo' }}</button>
        <button v-if="shown" type="button" class="btn btn-ghost btn-sm remove" @click="emit('clear')"><Trash2 :size="14" /> Remove</button>
      </div>
      <p v-if="error" class="err-text">{{ error }}</p>
      <p v-else class="hint">JPG, PNG or WebP, up to 4 MB.</p>
    </div>
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" @change="onChange" />
  </div>
</template>

<style scoped>
.picker { display: flex; align-items: center; gap: 14px; }
.thumb { width: 84px; height: 84px; flex: none; border-radius: 14px; overflow: hidden; background: var(--surface-2, #eef2f9); display: grid; place-items: center; color: var(--text-mute); border: 1px solid var(--border, #dfe5f0); }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; }
.remove { color: var(--danger); }
.side p { margin-top: 6px; }
</style>
