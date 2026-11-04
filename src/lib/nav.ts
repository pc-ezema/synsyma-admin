import { LayoutDashboard, LifeBuoy, MessageSquare, Settings, ShieldCheck, UserCircle, UserCog, UserMinus, Users } from 'lucide-vue-next'
import type { Component } from 'vue'

export interface NavItem { to: string; label: string; icon: Component; permission?: string | string[]; badge?: 'chat' }
export interface NavGroup { title: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }] },
  {
    title: 'Manage',
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { to: '/profile', label: 'Profile', icon: UserCircle, permission: 'profiles.view' },
      { to: '/support', label: 'Support contacts', icon: LifeBuoy, permission: 'support.view' },
      { to: '/deletions', label: 'Deleted accounts', icon: UserMinus, permission: 'deletions.view' },
      { to: '/chat', label: 'Chat', icon: MessageSquare, permission: 'chat.view', badge: 'chat' },
    ],
  },
  {
    title: 'Access control',
    items: [
      { to: '/access/roles', label: 'Roles & permissions', icon: ShieldCheck, permission: ['roles.index', 'permission.view'] },
      { to: '/access/admins', label: 'Administrators', icon: UserCog, permission: 'admins.view' },
    ],
  },
  { title: 'System', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]
