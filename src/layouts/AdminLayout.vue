<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const route = useRoute()

watch(() => route.fullPath, () => ui.closeSidebar())

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ui.closeSidebar()
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <div class="scrim" :class="{ show: ui.sidebarOpen }" @click="ui.closeSidebar()" />
    <div class="main">
      <AppTopbar />
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell { min-height: 100dvh; }
.main { margin-left: var(--sidebar-w); min-width: 0; }
.content { padding: 28px; max-width: 1480px; margin: 0 auto; }
.scrim { display: none; }

@media (max-width: 1023px) {
  .main { margin-left: 0; }
  .content { padding: 20px 16px 40px; }
  .scrim {
    display: block; position: fixed; inset: 0; z-index: 35; background: rgba(2, 8, 24, 0.6);
    backdrop-filter: blur(2px); opacity: 0; pointer-events: none; transition: opacity 0.25s;
  }
  .scrim.show { opacity: 1; pointer-events: auto; }
}
</style>
