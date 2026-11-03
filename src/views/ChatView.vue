<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare } from 'lucide-vue-next'
import ChatList from '@/components/chat/ChatList.vue'
import ChatThread from '@/components/chat/ChatThread.vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (route.params.id as string | undefined) || null)

watch(id, (v) => { if (v) chat.openThread(v); else chat.closeThread() }, { immediate: true })
onMounted(() => chat.startInbox())
onBeforeUnmount(() => { chat.stopInbox(); chat.closeThread() })

const select = (cid: string) => router.push({ name: 'chat', params: { id: cid } })
const back = () => router.push({ name: 'chat' })
</script>

<template>
  <div class="chat" :class="{ 'has-thread': !!id }">
    <aside class="pane list"><ChatList @select="select" /></aside>
    <div class="pane main">
      <ChatThread v-if="id" :key="id" @back="back" />
      <div v-else class="idle"><span><MessageSquare :size="30" /></span><h2>Select a conversation</h2><p>Pick a customer on the left to read and reply.</p></div>
    </div>
  </div>
</template>

<style scoped>
.chat { display: grid; grid-template-columns: 360px minmax(0, 1fr); height: calc(100dvh - var(--topbar-h) - 32px); overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
.pane { min-width: 0; min-height: 0; }
.list { border-right: 1px solid var(--line); }
.idle { height: 100%; display: grid; place-content: center; justify-items: center; gap: 8px; padding: 24px; text-align: center; color: var(--text-mute); background: #f1f6f8; }
.idle span { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; color: var(--teal); background: rgba(22, 129, 115, 0.12); }
.idle h2 { font-family: var(--font-display); font-size: 20px; color: var(--text); }
@media (max-width: 899px) {
  .chat { grid-template-columns: 1fr; height: calc(100dvh - var(--topbar-h)); border: 0; border-radius: 0; box-shadow: none; }
  .list { border-right: 0; }
  .chat.has-thread .list { display: none; }
  .chat:not(.has-thread) .main { display: none; }
}
</style>
