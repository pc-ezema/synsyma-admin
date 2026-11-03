<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AlertTriangle, HelpCircle } from 'lucide-vue-next'
import { confirmState as s, settleConfirm } from '@/composables/useConfirm'

const cancelBtn = ref<HTMLButtonElement | null>(null)
const okBtn = ref<HTMLButtonElement | null>(null)

watch(() => s.open, async (o) => {
  if (!o) return
  await nextTick()
  // Destructive actions focus Cancel so Enter can't delete by accident
  ;(s.tone === 'danger' ? cancelBtn : okBtn).value?.focus()
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') settleConfirm(false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="s.open" class="overlay" @keydown="onKey" @mousedown.self="settleConfirm(false)">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-msg">
        <span class="ico" :class="s.tone"><AlertTriangle v-if="s.tone === 'danger'" :size="22" /><HelpCircle v-else :size="22" /></span>
        <h2 id="cf-title">{{ s.title }}</h2>
        <p v-if="s.message" id="cf-msg">{{ s.message }}</p>
        <div class="actions">
          <button ref="cancelBtn" type="button" class="btn btn-ghost" @click="settleConfirm(false)">{{ s.cancelText }}</button>
          <button ref="okBtn" type="button" class="btn" :class="s.tone === 'danger' ? 'btn-danger' : 'btn-primary'" @click="settleConfirm(true)">{{ s.confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(2, 8, 24, 0.55); backdrop-filter: blur(3px); animation: fade 0.15s; }
.dialog { width: min(100%, 420px); padding: 26px; text-align: center; background: #fff; border-radius: 22px; box-shadow: 0 40px 80px -24px rgba(4, 20, 59, 0.5); animation: pop 0.18s; }
.ico { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; margin-bottom: 14px; }
.ico.danger { color: var(--danger); background: rgba(217, 45, 74, 0.1); }
.ico.primary { color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
h2 { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
p { margin-top: 8px; color: var(--text-dim); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: scale(0.96) translateY(6px); } }
</style>
