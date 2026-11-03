import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { navGroups } from '@/lib/nav'

declare module 'vue-router' {
  interface RouteMeta { title?: string; requiresAuth?: boolean; guestOnly?: boolean; permission?: string | string[]; flush?: boolean }
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
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'My profile' } },
        { path: 'support', name: 'support', component: () => import('@/views/SupportView.vue'), meta: { title: 'Support contacts', permission: 'support.view' } },
        { path: 'deletions', name: 'deletions', component: () => import('@/views/DeletionsView.vue'), meta: { title: 'Deleted accounts', permission: 'deletions.view' } },
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
