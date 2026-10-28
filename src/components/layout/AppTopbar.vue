<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ChevronDown, LogOut, Menu, Search, Settings } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

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
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu" type="button" aria-label="Open menu" aria-controls="sidebar" :aria-expanded="ui.sidebarOpen" @click="ui.toggleSidebar()">
      <Menu :size="20" />
    </button>

    <label class="search field">
      <Search :size="18" />
      <input type="search" placeholder="Search users, messages..." aria-label="Search" />
    </label>

    <div class="actions">
      <button class="icon-btn bell" type="button" aria-label="Notifications, 3 unread">
        <Bell :size="19" />
        <span class="pip" />
      </button>

      <div ref="root" class="user">
        <button class="user-btn" type="button" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
          <span class="avatar">{{ initials }}</span>
          <span class="who">
            <strong>{{ auth.user?.name ?? 'Admin' }}</strong>
            <small>{{ auth.user?.role ?? 'Administrator' }}</small>
          </span>
          <ChevronDown :size="16" class="chev" :class="{ flip: open }" />
        </button>

        <div v-if="open" class="menu-pop" role="menu">
          <div class="me">
            <strong>{{ auth.user?.name }}</strong>
            <small>{{ auth.user?.email }}</small>
          </div>
          <RouterLink to="/settings" role="menuitem" @click="open = false"><Settings :size="16" /> Settings</RouterLink>
          <button type="button" role="menuitem" class="out" @click="signOut"><LogOut :size="16" /> Sign out</button>
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
.menu { display: none; }
.search { flex: 1; max-width: 420px; height: 42px; }
.actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
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
.who small { color: var(--text-mute); font-size: 12px; }
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
}
</style>
