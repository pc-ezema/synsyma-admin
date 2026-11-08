<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellRing, ChevronDown, LogOut, Menu, Search, Settings, UserRound } from 'lucide-vue-next'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { enableAdminPush, pushState, pushSupported } from '@/lib/push'
import { parseError } from '@/lib/errors'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const chat = useChatStore()
const pushOn = computed(() => pushState.registered)
const signingOut = ref(false)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const initials = computed(() =>
  (auth.user?.name ?? 'Admin').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

async function signOut() {
  open.value = false
  const yes = await confirm({
    title: 'Sign out?',
    message: 'You will need your email and password to get back in.',
    confirmText: 'Sign out',
    tone: 'danger',
  })
  if (!yes) return
  signingOut.value = true
  await auth.logout()
  router.replace({ name: 'login' })
}

async function bell() {
  if (!pushSupported()) { toast.info('Browser alerts are not set up for this dashboard.'); return }
  if (pushOn.value) { router.push('/chat'); return }
  try {
    const r = await enableAdminPush()
    if (r === 'enabled') toast.success('Browser alerts are on for new messages.')
    else if (r === 'denied') toast.error('Alerts are blocked. Allow notifications for this site in your browser settings.')
  } catch (e) {
    console.error('Push setup failed:', e)
    // API errors get the friendly message; Firebase/service-worker errors show what actually went wrong
    toast.error(e instanceof Error && !('isAxiosError' in e) ? `Alerts could not be turned on: ${e.message}` : parseError(e).message)
  }
}
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu" type="button" aria-label="Open menu" aria-controls="sidebar" :aria-expanded="ui.sidebarOpen" @click="ui.toggleSidebar()">
      <Menu :size="20" />
    </button>

    <label class="search field">
      <Search :size="18" />
      <input type="search" placeholder="Search..." aria-label="Search" />
    </label>

    <div class="actions">
      <button class="icon-btn bell" type="button" :aria-label="pushOn ? `Messages, ${chat.unread} unread` : 'Turn on message alerts'" :title="pushOn ? 'Messages' : 'Turn on message alerts'" @click="bell">
        <BellRing v-if="pushOn" :size="19" /><Bell v-else :size="19" />
        <span v-if="chat.unread" class="pip" />
      </button>

      <div ref="root" class="user">
        <button class="user-btn" type="button" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
          <UserAvatar :name="auth.user?.name" :src="auth.user?.photo_url" :size="36" />
          <span class="who">
            <strong>{{ auth.user?.name ?? 'Admin' }}</strong>
            <small>{{ (auth.user?.role ?? 'Administrator').replace(/_/g, ' ') }}</small>
          </span>
          <ChevronDown :size="16" class="chev" :class="{ flip: open }" />
        </button>

        <div v-if="open" class="menu-pop" role="menu">
          <div class="me">
            <strong>{{ auth.user?.name }}</strong>
            <small>{{ auth.user?.email }}</small>
          </div>
          <RouterLink to="/profile" role="menuitem" @click="open = false"><UserRound :size="16" /> My profile</RouterLink>
          <RouterLink to="/settings" role="menuitem" @click="open = false"><Settings :size="16" /> Settings</RouterLink>
          <button type="button" role="menuitem" class="out" @click="signOut"><LogOut :size="16" /> {{ signingOut ? 'Signing out' : 'Sign out' }}</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 30; height: var(--topbar-h);
  display: flex; align-items: center; gap: 12px; padding: 0 28px;
  background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.menu { display: none; flex: none; }
.search { flex: 1; min-width: 0; max-width: 420px; height: 42px; }
.search input { min-width: 0; width: 100%; }
.actions { margin-left: auto; flex: none; display: flex; align-items: center; gap: 10px; }
.bell { position: relative; }
.pip { position: absolute; top: 10px; right: 11px; width: 8px; height: 8px; border-radius: 50%; background: var(--syn-green-text); box-shadow: 0 0 0 2px #fff; }

.user { position: relative; }
.user-btn {
  display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 10px 0 5px;
  background: #fff; border: 1px solid var(--line); border-radius: 999px;
}
.user-btn:hover { background: rgba(4, 20, 59, 0.04); }
.avatar {
  display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%;
  background: var(--grad-blue); color: #fff; font-size: 13px; font-weight: 700;
}
.who { display: grid; text-align: left; line-height: 1.2; }
.who strong { font-size: 14px; }
.who small { color: var(--text-mute); font-size: 12px; text-transform: capitalize; }
.chev { color: var(--text-mute); transition: transform 0.2s; }
.chev.flip { transform: rotate(180deg); }

.menu-pop {
  position: absolute; right: 0; top: calc(100% + 10px); width: 230px; padding: 8px;
  background: #fff; border: 1px solid var(--line); border-radius: 16px;
  box-shadow: 0 24px 48px -16px rgba(4, 20, 59, 0.28);
}
.me { display: grid; padding: 10px 12px 12px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
.me small { color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; }
.menu-pop a, .menu-pop button {
  display: flex; align-items: center; gap: 10px; width: 100%; height: 40px; padding: 0 12px;
  background: none; border: 0; border-radius: 10px; font-weight: 600; text-align: left;
}
.menu-pop a:hover, .menu-pop button:hover { background: rgba(4, 20, 59, 0.06); }
.menu-pop .out { color: var(--danger); }

@media (max-width: 1023px) {
  .menu { display: inline-grid; }
  .topbar { padding: 0 16px; }
}
@media (max-width: 640px) {
  .who, .chev { display: none; }
  .user-btn { padding: 0 5px; }
  .topbar { gap: 8px; padding: 0 12px; }
}
</style>