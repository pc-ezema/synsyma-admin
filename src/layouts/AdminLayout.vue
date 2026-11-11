<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useNotificationStore } from '@/stores/notifications'
import { resumeAdminPush } from '@/lib/push'

const ui = useUiStore()
const auth = useAuthStore()
const chat = useChatStore()
const notes = useNotificationStore()
const route = useRoute()

watch(() => route.fullPath, () => ui.closeSidebar())
watch(() => chat.unread + notes.unread, (n) => { document.title = `${n ? `(${n}) ` : ''}${String(route.meta.title ?? 'Admin')} - Synsyma` })

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ui.closeSidebar()
// Pick up role/permission changes made by another admin when the tab regains focus
const onVisible = () => { if (!document.hidden) auth.refreshProfile() }

onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisible)
  auth.refreshProfile()
  if (auth.can('chat.view')) chat.startBadge()
  notes.startBadge()
  resumeAdminPush() // every admin gets the bell's browser alerts, not only chat
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisible)
  chat.stopBadge()
  notes.stopBadge()
})
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <div class="scrim" :class="{ show: ui.sidebarOpen }" @click="ui.closeSidebar()" />
    <div class="main">
      <AppTopbar />
      <main class="content" :class="{ flush: route.meta.flush }"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.shell { min-height: 100dvh; }
.main { margin-left: var(--sidebar-w); min-width: 0; }
.content { padding: 28px; max-width: 1480px; margin: 0 auto; }
.content.flush { padding: 16px; max-width: none; }
.scrim { display: none; }
@media (max-width: 1023px) {
  .main { margin-left: 0; }
  .content { padding: 20px 16px 40px; }
  .content.flush { padding: 0; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(2, 8, 24, 0.6); backdrop-filter: blur(2px); opacity: 0; pointer-events: none; transition: opacity 0.25s; }
  .scrim.show { opacity: 1; pointer-events: auto; }
}
</style>