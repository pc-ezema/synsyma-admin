import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { navGroups } from '@/lib/nav'

declare module 'vue-router' {
  interface RouteMeta { title?: string; requiresAuth?: boolean; public?: boolean; guestOnly?: boolean; permission?: string | string[]; flush?: boolean }
}

const placeholder = (path: string, title: string, permission?: string): RouteRecordRaw => ({
  path, name: path, component: () => import('@/views/PlaceholderView.vue'), meta: { title, permission },
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, title: 'Sign in' } },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeRedirect.vue') },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard', permission: 'dashboard.view' } },
        { path: 'chat/:id?', name: 'chat', component: () => import('@/views/ChatView.vue'), meta: { title: 'Chat', permission: 'chat.view', flush: true } },
        { path: 'access/roles', name: 'roles', component: () => import('@/views/RolesView.vue'), meta: { title: 'Roles & permissions', permission: ['roles.index', 'permission.view'] } },
        { path: 'access/admins', name: 'admins', component: () => import('@/views/AdminsView.vue'), meta: { title: 'Administrators', permission: 'admins.view' } },
        { path: 'support', name: 'support', component: () => import('@/views/SupportView.vue'), meta: { title: 'Support contacts', permission: 'support.view' } },
        { path: 'deletions', name: 'deletions', component: () => import('@/views/DeletionsView.vue'), meta: { title: 'Deleted accounts', permission: 'deletions.view' } },
        { path: 'services', name: 'services', component: () => import('@/views/ServicesView.vue'), meta: { title: 'Services', permission: 'services.view' } },
        { path: 'bookings', name: 'bookings', component: () => import('@/views/BookingsView.vue'), meta: { title: 'Bookings', permission: 'bookings.view' } },
        { path: 'booking-policy', name: 'booking-policy', component: () => import('@/views/BookingPolicyView.vue'), meta: { title: 'Booking policy', permission: 'bookings.manage' } },
        { path: 'promo-codes', name: 'promo-codes', component: () => import('@/views/PromoCodesView.vue'), meta: { title: 'Promo codes', permission: 'promos.view' } },
        { path: 'banners', name: 'banners', component: () => import('@/views/BannersView.vue'), meta: { title: 'Banners', permission: 'banners.view' } },
        { path: 'payments', name: 'payments', component: () => import('@/views/PaymentsView.vue'), meta: { title: 'Payments', permission: 'bookings.view' } },
        { path: 'bookings/:id', name: 'booking', component: () => import('@/views/BookingDetailView.vue'), meta: { title: 'Booking', permission: 'bookings.view' } },
        { path: 'contractors', name: 'contractors', component: () => import('@/views/ContractorsView.vue'), meta: { title: 'Contractors', permission: 'contractors.view' } },
        { path: 'contractors/:id', name: 'contractor', component: () => import('@/views/ContractorDetailView.vue'), meta: { title: 'Contractor', permission: 'contractors.view' } },
        { path: 'campaigns', name: 'campaigns', component: () => import('@/views/CampaignsView.vue'), meta: { title: 'QR codes', permission: 'campaigns.view' } },
        { path: 'categories', name: 'categories', component: () => import('@/views/CategoriesView.vue'), meta: { title: 'Categories', permission: 'categories.view' } },
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'My profile' } },
        placeholder('users', 'Users', 'users.view'),
        placeholder('profiles', 'Profiles', 'profiles.view'),
        placeholder('settings', 'Settings'),
        { path: 'forbidden', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue'), meta: { title: 'No access' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/** First page this admin is allowed to see. */
export function landingPath(): string {
  const auth = useAuthStore()
  for (const g of navGroups) for (const i of g.items) if (auth.can(i.permission)) return i.to
  return '/forbidden'
}

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && auth.isAuthenticated) return landingPath()
  if (to.meta.permission && !auth.can(to.meta.permission)) return { name: 'forbidden', query: { from: to.fullPath } }
})

router.afterEach((to) => { document.title = `${String(to.meta.title ?? 'Admin')} - Synsyma` })

export default router