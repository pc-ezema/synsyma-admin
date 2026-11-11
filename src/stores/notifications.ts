import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import { onAlert } from '@/lib/push'
import { toast } from '@/composables/useToast'
import type { AdminNotification } from '@/types'

/** The bell: how many alerts are unread, the latest few, and marking them read. */
export const useNotificationStore = defineStore('adminNotifications', () => {
  const unread = ref(0)
  const latest = ref<AdminNotification[]>([])
  const loading = ref(false)
  let timer: number | undefined
  let stopLive: (() => void) | undefined

  async function loadUnread() {
    try { unread.value = (await api.get<{ data: { unread: number } }>('/admin/notifications/unread-count')).data.data.unread } catch { /* silent */ }
  }

  async function loadLatest() {
    loading.value = true
    try {
      const { data } = await api.get<{ data: AdminNotification[]; unread_count: number }>('/admin/notifications', { params: { per_page: 8 } })
      latest.value = data.data; unread.value = data.unread_count
    } catch { /* keep what we had */ } finally { loading.value = false }
  }

  /** Poll the count every 30 seconds, and react at once to an alert that arrives while the tab is open. */
  function startBadge() {
    stopBadge()
    loadUnread()
    timer = window.setInterval(() => !document.hidden && loadUnread(), 30000)
    stopLive = onAlert((a) => { toast.info(a.title ? `${a.title}. ${a.body}` : a.body); loadUnread(); loadLatest() })
  }
  function stopBadge() { window.clearInterval(timer); stopLive?.(); stopLive = undefined }

  async function markRead(n: AdminNotification) {
    if (n.read) return
    n.read = true; unread.value = Math.max(0, unread.value - 1)
    try { unread.value = (await api.post<{ data: { unread: number } }>(`/admin/notifications/${n.id}/read`)).data.data.unread } catch { /* the next refresh corrects it */ }
  }

  async function markAll() {
    try { await api.post('/admin/notifications/read-all'); unread.value = 0; latest.value.forEach((n) => { n.read = true }) }
    catch (e) { toast.error(parseError(e).message) }
  }

  return { unread, latest, loading, loadUnread, loadLatest, startBadge, stopBadge, markRead, markAll }
})