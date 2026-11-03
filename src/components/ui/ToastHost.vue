<script setup lang="ts">
import { CheckCircle2, Info, XCircle, X } from 'lucide-vue-next'
import { dismiss, toasts } from '@/composables/useToast'
</script>

<template>
  <Teleport to="body">
    <div class="stack" role="status" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">
        <CheckCircle2 v-if="t.kind === 'success'" :size="18" />
        <XCircle v-else-if="t.kind === 'error'" :size="18" />
        <Info v-else :size="18" />
        <span>{{ t.text }}</span>
        <button type="button" aria-label="Dismiss" @click="dismiss(t.id)"><X :size="15" /></button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.stack { position: fixed; z-index: 120; right: 16px; bottom: 16px; left: 16px; display: grid; gap: 8px; justify-items: end; pointer-events: none; }
.toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 420px; padding: 12px 14px; background: var(--syn-navy); color: #fff; border-radius: 14px; box-shadow: 0 18px 40px -14px rgba(4, 20, 59, 0.6); animation: up 0.2s; }
.toast.success svg:first-child { color: var(--syn-green-text); }
.toast.error svg:first-child { color: #ff6b81; }
.toast.info svg:first-child { color: var(--syn-blue-light); }
.toast button { display: grid; place-items: center; margin-left: 4px; background: none; border: 0; color: rgba(255, 255, 255, 0.6); }
@keyframes up { from { opacity: 0; transform: translateY(8px); } }
</style>
