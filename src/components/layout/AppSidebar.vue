<script setup lang="ts">
import { LayoutDashboard, MessageSquare, Settings, UserCircle, Users, X } from 'lucide-vue-next'
import BrandMark from '@/components/BrandMark.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const groups = [
  { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Manage',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/profiles', label: 'Profiles', icon: UserCircle },
      { to: '/chat', label: 'Chat', icon: MessageSquare, badge: 4 },
    ],
  },
  { title: 'System', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]
</script>

<template>
  <aside id="sidebar" class="sidebar" :class="{ open: ui.sidebarOpen }" aria-label="Main navigation">
    <div class="top">
      <RouterLink to="/dashboard" class="brand">
        <BrandMark :size="34" />
        <span>Synsyma</span>
      </RouterLink>
      <button class="icon-btn close" type="button" aria-label="Close menu" @click="ui.closeSidebar()">
        <X :size="18" />
      </button>
    </div>

    <nav>
      <div v-for="g in groups" :key="g.title" class="group">
        <p class="group-title">{{ g.title }}</p>
        <RouterLink v-for="i in g.items" :key="i.to" :to="i.to" class="link" active-class="active">
          <component :is="i.icon" :size="19" />
          <span>{{ i.label }}</span>
          <b v-if="i.badge" class="badge">{{ i.badge }}</b>
        </RouterLink>
      </div>
    </nav>

    <div class="status">
      <span class="dot" />
      <div>
        <strong>API operational</strong>
        <small>All services responding</small>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  --text: #fff; --text-dim: rgba(255, 255, 255, 0.72); --text-mute: rgba(255, 255, 255, 0.56); --line: rgba(255, 255, 255, 0.08);
  color: #fff;
  position: fixed; inset: 0 auto 0 0; z-index: 40; width: var(--sidebar-w);
  display: flex; flex-direction: column; gap: 8px; padding: 18px 14px;
  background: linear-gradient(180deg, #071d52, #04143B);
  border-right: 1px solid var(--line);
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.top { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 18px; }
.brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 700; font-size: 20px; letter-spacing: -0.01em; }
.close { display: none; background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.12); color: #fff; }
nav { flex: 1; overflow-y: auto; display: grid; align-content: start; gap: 18px; }
.group { display: grid; gap: 4px; }
.group-title { padding: 0 14px 4px; font-size: 13px; font-weight: 600; color: var(--text-mute); }
.link {
  position: relative; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 14px;
  border-radius: var(--radius-md); color: var(--text-dim); font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.link:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.link.active { background: rgba(0, 102, 255, 0.18); color: #fff; }
.link.active svg { color: var(--syn-blue-light); }
.link.active::before {
  content: ''; position: absolute; left: -14px; top: 10px; bottom: 10px; width: 4px;
  border-radius: 0 4px 4px 0; background: var(--grad-blue-full);
}
.badge {
  margin-left: auto; min-width: 22px; padding: 1px 7px; border-radius: 999px; text-align: center;
  font-size: 12px; font-weight: 700; color: var(--syn-navy); background: var(--grad-green);
}
.status {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line); border-radius: var(--radius-md);
}
.status strong { display: block; font-size: 13px; }
.status small { color: var(--text-mute); font-size: 12px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--syn-green-text); box-shadow: 0 0 0 4px rgba(85, 212, 0, 0.18); }

@media (max-width: 1023px) {
  .sidebar { transform: translateX(-100%); width: min(86vw, 300px); box-shadow: 30px 0 60px -20px rgba(0, 0, 0, 0.6); }
  .sidebar.open { transform: none; }
  .close { display: inline-grid; }
}
</style>
