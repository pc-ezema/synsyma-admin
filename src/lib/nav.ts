import { Building2, Layers, LayoutDashboard, LifeBuoy, Image, Star, Tag, CalendarCheck, MessageSquare, QrCode, Receipt, Settings, ShieldCheck, SlidersHorizontal, UserCircle, UserCog, UserMinus, Users, Wallet, Wrench } from 'lucide-vue-next'
import type { Component } from 'vue'

export interface NavItem { to: string; label: string; icon: Component; permission?: string | string[]; badge?: 'chat' }
export interface NavGroup { title: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }] },
  {
    title: 'Manage',
    items: [
      { to: '/contractors', label: 'Contractors', icon: Building2, permission: 'contractors.view' },
      { to: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { to: '/campaigns', label: 'QR codes', icon: QrCode, permission: 'campaigns.view' },
      { to: '/profile', label: 'Profiles', icon: UserCircle, permission: 'profiles.view' },
      { to: '/services', label: 'Services', icon: Wrench, permission: 'services.view' },
      { to: '/categories', label: 'Categories', icon: Layers, permission: 'categories.view' },
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, permission: 'bookings.view' },
      { to: '/payments', label: 'Payments', icon: Receipt, permission: 'bookings.view' },
      { to: '/payouts', label: 'Payouts', icon: Wallet, permission: 'payouts.view' },
      { to: '/reviews', label: 'Reviews', icon: Star, permission: 'reviews.view' },
      { to: '/promo-codes', label: 'Promo codes', icon: Tag, permission: 'promos.view' },
      { to: '/banners', label: 'Banners', icon: Image, permission: 'banners.view' },
      { to: '/booking-policy', label: 'Booking policy', icon: SlidersHorizontal, permission: 'bookings.manage' },
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