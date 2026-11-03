<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next'
import { landingPath } from '@/router'
</script>

<template>
  <div class="card box">
    <span class="ico"><ShieldAlert :size="28" /></span>
    <h1>You don't have access to this page</h1>
    <p>Ask a super admin to give your role the permission it needs. If it was changed just now, reload to pick it up.</p>
    <RouterLink v-if="landingPath() !== '/forbidden'" :to="landingPath()" class="btn btn-primary">Go to my dashboard</RouterLink>
  </div>
</template>

<style scoped>
.box { display: grid; justify-items: center; gap: 12px; max-width: 520px; margin: 8vh auto; padding: 40px 28px; text-align: center; }
.ico { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; color: var(--danger); background: rgba(217, 45, 74, 0.1); }
h1 { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
p { color: var(--text-dim); }
</style>
