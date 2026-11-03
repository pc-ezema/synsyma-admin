<script setup lang="ts">
import { X } from 'lucide-vue-next'
defineProps<{ open: boolean; title: string; width?: number }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @mousedown.self="emit('close')" @keydown.esc="emit('close')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ maxWidth: (width ?? 560) + 'px' }">
        <header>
          <h2>{{ title }}</h2>
          <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')"><X :size="18" /></button>
        </header>
        <div class="body"><slot /></div>
        <footer v-if="$slots.footer"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px; background: rgba(2, 8, 24, 0.55); backdrop-filter: blur(3px); }
.modal { width: 100%; max-height: min(90dvh, 760px); display: flex; flex-direction: column; background: #fff; border-radius: 22px; box-shadow: 0 40px 80px -24px rgba(4, 20, 59, 0.5); }
header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--line); }
h2 { font-family: var(--font-display); font-size: 18px; font-weight: 600; }
.body { padding: 20px; overflow-y: auto; }
footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--line); }
</style>
