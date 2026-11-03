<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ConfirmHost from '@/components/ui/ConfirmHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// Any time the session ends (expired refresh token, other tab logged out), leave protected pages
watch(() => auth.isAuthenticated, (ok) => {
  if (ok || route.meta.guestOnly) return
  const expired = auth.endReason === 'expired'
  router.replace({ name: 'login', query: { ...(expired ? { reason: 'expired' } : {}), ...(route.fullPath !== '/' ? { redirect: route.fullPath } : {}) } })
})
</script>

<template>
  <RouterView />
  <ConfirmHost />
  <ToastHost />
</template>
