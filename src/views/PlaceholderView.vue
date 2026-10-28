<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <section class="empty card">
    <h1>{{ route.meta.title }}</h1>
    <p>Nothing to show yet. This page will connect to the {{ String(route.meta.title).toLowerCase() }} module once its API endpoints are ready.</p>
    <RouterLink to="/dashboard" class="btn btn-ghost">Back to dashboard</RouterLink>
  </section>
</template>

<style scoped>
.empty { display: grid; justify-items: start; gap: 12px; padding: 36px; max-width: 560px; }
h1 { font-family: var(--font-display); font-size: 26px; }
p { color: var(--text-dim); }
</style>
