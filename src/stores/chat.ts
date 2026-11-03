import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { parseError } from '@/lib/errors'
import type { ChatMessage, Conversation, PageMeta } from '@/types'

export type InboxFilter = 'all' | 'open' | 'unread' | 'mine' | 'closed'

const sortAsc = (m: ChatMessage[]) => [...m].sort((a, b) => a.created_at.localeCompare(b.created_at))

export const useChatStore = defineStore('chat', () => {
  // ---- unread badge ----
  const unread = ref(0)
  let badgeTimer: number | undefined
  async function loadUnread() {
    try {
      const { data } = await api.get<{ data: { messages: number; conversations: number } }>('/admin/chat/unread-count')
      unread.value = data.data.conversations
    } catch { /* silent */ }
  }
  function startBadge() { stopBadge(); loadUnread(); badgeTimer = window.setInterval(() => !document.hidden && loadUnread(), 30000) }
  function stopBadge() { window.clearInterval(badgeTimer) }

  // ---- inbox ----
  const inbox = ref<Conversation[]>([])
  const meta = ref<PageMeta | null>(null)
  const filter = ref<InboxFilter>('all')
  const search = ref('')
  const inboxLoading = ref(false)
  const inboxError = ref('')
  let inboxTimer: number | undefined
  let inboxSeq = 0

  function params(page: number) {
    const p: Record<string, string | number> = { page, per_page: 25 }
    if (filter.value === 'open' || filter.value === 'closed') p.status = filter.value
    if (filter.value === 'unread') p.unread = 1
    if (filter.value === 'mine') p.mine = 1
    if (search.value.trim()) p.search = search.value.trim()
    return p
  }

  async function loadInbox(opts: { silent?: boolean } = {}) {
    const seq = ++inboxSeq
    if (!opts.silent) inboxLoading.value = true
    try {
      const { data } = await api.get<{ data: Conversation[]; meta: PageMeta }>('/admin/chat/conversations', { params: params(1) })
      if (seq !== inboxSeq) return
      // keep extra pages the user already scrolled to
      const extra = inbox.value.slice(data.data.length).filter((c) => !data.data.some((d) => d.id === c.id))
      inbox.value = opts.silent && (meta.value?.current_page ?? 1) > 1 ? [...data.data, ...extra] : data.data
      if (!(opts.silent && (meta.value?.current_page ?? 1) > 1)) meta.value = data.meta
      inboxError.value = ''
    } catch (e) {
      if (!opts.silent) inboxError.value = parseError(e, "Couldn't load conversations.").message
    } finally {
      if (seq === inboxSeq) inboxLoading.value = false
    }
  }

  async function loadMoreInbox() {
    if (!meta.value || meta.value.current_page >= meta.value.last_page) return
    try {
      const { data } = await api.get<{ data: Conversation[]; meta: PageMeta }>('/admin/chat/conversations', { params: params(meta.value.current_page + 1) })
      const seen = new Set(inbox.value.map((c) => c.id))
      inbox.value = [...inbox.value, ...data.data.filter((c) => !seen.has(c.id))]
      meta.value = data.meta
    } catch { /* silent */ }
  }

  function setFilter(f: InboxFilter) { filter.value = f; loadInbox() }
  let searchTimer: number | undefined
  function setSearch(q: string) { search.value = q; window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => loadInbox(), 300) }

  function startInbox() { stopInbox(); loadInbox(); inboxTimer = window.setInterval(() => !document.hidden && loadInbox({ silent: true }), 8000) }
  function stopInbox() { window.clearInterval(inboxTimer) }

  // ---- thread ----
  const activeId = ref<string | null>(null)
  const conversation = ref<Conversation | null>(null)
  const messages = ref<ChatMessage[]>([])
  const hasMore = ref(false)
  const threadLoading = ref(false)
  const threadError = ref('')
  const loadingOlder = ref(false)
  let threadTimer: number | undefined
  const pendingFiles = new Map<string, File>()

  const lastServerId = () => [...messages.value].reverse().find((m) => !m.status)?.id

  async function openThread(id: string) {
    stopThread()
    activeId.value = id
    conversation.value = inbox.value.find((c) => c.id === id) ?? null
    messages.value = []
    hasMore.value = false
    threadError.value = ''
    threadLoading.value = true
    try {
      const [c, m] = await Promise.all([
        api.get<{ data: Conversation }>(`/admin/chat/conversations/${id}`),
        api.get<{ data: ChatMessage[]; meta: { has_more: boolean } }>(`/admin/chat/conversations/${id}/messages`, { params: { limit: 30 } }),
      ])
      if (activeId.value !== id) return
      conversation.value = c.data.data
      messages.value = sortAsc(m.data.data)
      hasMore.value = m.data.meta.has_more
      markRead()
      threadTimer = window.setInterval(() => !document.hidden && pollThread(), 4000)
    } catch (e) {
      if (activeId.value === id) threadError.value = parseError(e, "Couldn't load this conversation.").message
    } finally {
      if (activeId.value === id) threadLoading.value = false
    }
  }

  function stopThread() { window.clearInterval(threadTimer) }
  function closeThread() { stopThread(); activeId.value = null; conversation.value = null; messages.value = [] }

  async function pollThread() {
    const id = activeId.value
    if (!id) return
    const after = lastServerId()
    try {
      const { data } = await api.get<{ data: ChatMessage[] }>(`/admin/chat/conversations/${id}/messages`, { params: after ? { after } : {} })
      if (activeId.value !== id || !data.data.length) return
      const known = new Set(messages.value.map((m) => m.id))
      const fresh = data.data.filter((m) => !known.has(m.id))
      // Replace optimistic copies that the server now returns
      const byClient = new Map(fresh.filter((m) => m.client_id).map((m) => [m.client_id!, m]))
      messages.value = sortAsc([
        ...messages.value.filter((m) => !(m.status && m.client_id && byClient.has(m.client_id))),
        ...fresh,
      ])
      if (fresh.some((m) => m.sender.role === 'user')) markRead()
      refreshConversation()
    } catch { /* next tick */ }
  }

  async function refreshConversation() {
    const id = activeId.value
    if (!id) return
    try {
      const { data } = await api.get<{ data: Conversation }>(`/admin/chat/conversations/${id}`)
      if (activeId.value === id) conversation.value = data.data
    } catch { /* silent */ }
  }

  async function loadOlder() {
    const id = activeId.value
    const first = messages.value.find((m) => !m.status)
    if (!id || !first || !hasMore.value || loadingOlder.value) return
    loadingOlder.value = true
    try {
      const { data } = await api.get<{ data: ChatMessage[]; meta: { has_more: boolean } }>(`/admin/chat/conversations/${id}/messages`, { params: { before: first.id, limit: 30 } })
      if (activeId.value !== id) return
      const known = new Set(messages.value.map((m) => m.id))
      messages.value = sortAsc([...data.data.filter((m) => !known.has(m.id)), ...messages.value])
      hasMore.value = data.meta.has_more
    } finally { loadingOlder.value = false }
  }

  async function markRead() {
    const id = activeId.value
    if (!id) return
    try {
      await api.post(`/admin/chat/conversations/${id}/read`)
      const row = inbox.value.find((c) => c.id === id)
      if (row) row.unread_count = 0
      if (conversation.value) conversation.value.unread_count = 0
      loadUnread()
    } catch { /* silent */ }
  }

  // ---- sending ----
  async function transmit(m: ChatMessage, file?: File) {
    const id = activeId.value
    if (!id) return
    const form = new FormData()
    if (m.body) form.append('body', m.body)
    if (file) form.append('attachment', file)
    form.append('client_id', m.client_id!)
    try {
      const { data } = await api.post<{ data: ChatMessage }>(`/admin/chat/conversations/${id}/messages`, form)
      const i = messages.value.findIndex((x) => x.client_id === m.client_id)
      if (m.localUrl) URL.revokeObjectURL(m.localUrl)
      pendingFiles.delete(m.client_id!)
      const sent = data.data
      if (i >= 0) messages.value.splice(i, 1, sent)
      else messages.value.push(sent)
      messages.value = sortAsc(messages.value)
      refreshConversation()
      loadInbox({ silent: true })
    } catch (e) {
      const i = messages.value.findIndex((x) => x.client_id === m.client_id)
      const row = messages.value[i]
      if (i >= 0 && row) { row.status = 'failed'; row.error = parseError(e, "Couldn't send.").message }
    }
  }

  function send(body: string, file?: File, me?: { id: string; name: string }) {
    const clientId = crypto.randomUUID()
    const m: ChatMessage = {
      id: `local-${clientId}`, conversation_id: activeId.value!, client_id: clientId,
      type: file ? 'image' : 'text', body: body || null, attachment: null,
      sender: { role: 'admin', id: me?.id ?? '', name: me?.name ?? 'You' }, is_mine: true,
      read_at: null, created_at: new Date().toISOString(), status: 'sending',
      localUrl: file ? URL.createObjectURL(file) : undefined,
    }
    if (file) pendingFiles.set(clientId, file)
    messages.value.push(m)
    return transmit(m, file)
  }

  function retry(clientId: string) {
    const m = messages.value.find((x) => x.client_id === clientId)
    if (!m) return
    m.status = 'sending'; m.error = undefined
    return transmit(m, pendingFiles.get(clientId))
  }

  function discard(clientId: string) {
    const m = messages.value.find((x) => x.client_id === clientId)
    if (m?.localUrl) URL.revokeObjectURL(m.localUrl)
    pendingFiles.delete(clientId)
    messages.value = messages.value.filter((x) => x.client_id !== clientId)
  }

  // ---- moderation ----
  async function updateConversation(patch: { status?: 'open' | 'closed'; assigned_admin_id?: string | null }) {
    const id = activeId.value
    if (!id) return
    const { data } = await api.patch<{ data: Conversation }>(`/admin/chat/conversations/${id}`, patch)
    conversation.value = data.data
    const i = inbox.value.findIndex((c) => c.id === id)
    if (i >= 0) inbox.value[i] = { ...inbox.value[i], ...data.data }
  }

  async function deleteMessage(id: string) {
    await api.delete(`/admin/chat/messages/${id}`)
    messages.value = messages.value.filter((m) => m.id !== id)
    refreshConversation()
    loadInbox({ silent: true })
  }

  const hasFailed = computed(() => messages.value.some((m) => m.status === 'failed'))

  return {
    unread, startBadge, stopBadge, loadUnread,
    inbox, meta, filter, search, inboxLoading, inboxError, loadInbox, loadMoreInbox, setFilter, setSearch, startInbox, stopInbox,
    activeId, conversation, messages, hasMore, threadLoading, threadError, loadingOlder, hasFailed,
    openThread, closeThread, stopThread, loadOlder, markRead, send, retry, discard, updateConversation, deleteMessage,
  }
})
