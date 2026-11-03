<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AlertCircle, ArrowDown, ArrowLeft, CheckCheck, Check, ChevronUp, Loader2, Lock, LockOpen, RotateCcw, Trash2, UserCheck, UserMinus, X } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { parseError } from '@/lib/errors'
import { clockTime, dayLabel, sameDay } from '@/lib/format'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import AuthImage from '@/components/ui/AuthImage.vue'
import ChatComposer from './ChatComposer.vue'
import type { ChatMessage } from '@/types'

const chat = useChatStore()
const auth = useAuthStore()
defineEmits<{ back: [] }>()

const scroller = ref<HTMLElement | null>(null)
const pill = ref(0)
const lightbox = ref<ChatMessage | null>(null)
const busy = ref(false)

const canReply = computed(() => auth.can('chat.reply'))
const canModerate = computed(() => auth.can('chat.moderate'))
const c = computed(() => chat.conversation)
const mine = computed(() => c.value?.assigned_admin?.id === auth.user?.id)
const name = computed(() => c.value?.user.full_name || `${c.value?.user.first_name ?? ''} ${c.value?.user.last_name ?? ''}`.trim())

// Day chips + grouping of consecutive messages from the same sender
type Item = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; m: ChatMessage; first: boolean; last: boolean }
const items = computed<Item[]>(() => {
  const out: Item[] = []
  const list = chat.messages
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1]
    if (!prev || !sameDay(prev.created_at, m.created_at)) out.push({ kind: 'day', key: 'd' + m.created_at, label: dayLabel(m.created_at) })
    const sameGroup = (a?: ChatMessage) => a && a.sender.role === m.sender.role && a.sender.id === m.sender.id && sameDay(a.created_at, m.created_at) && Math.abs(+new Date(a.created_at) - +new Date(m.created_at)) < 5 * 60000
    out.push({ kind: 'msg', key: m.client_id || m.id, m, first: !sameGroup(prev), last: !sameGroup(next) })
  })
  return out
})

const lastSeenId = computed(() => [...chat.messages].reverse().find((m) => m.is_mine && m.read_at)?.id)

const nearBottom = () => {
  const el = scroller.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
}
const toBottom = (smooth = false) => nextTick(() => { scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); pill.value = 0 })

watch(() => chat.activeId, () => { pill.value = 0; toBottom() })
watch(() => chat.threadLoading, (l) => { if (!l) toBottom() })
watch(() => chat.messages.length, (n, o) => {
  if (n <= o) return
  const last = chat.messages[n - 1]
  if (!last) return 
  if (last.is_mine || nearBottom()) toBottom(true)
  else pill.value += n - o
})

let busyScroll = false
async function onScroll() {
  const el = scroller.value
  if (!el) return
  if (nearBottom()) pill.value = 0
  if (el.scrollTop < 80 && chat.hasMore && !busyScroll) {
    busyScroll = true
    const before = el.scrollHeight
    await chat.loadOlder()
    await nextTick()
    el.scrollTop = el.scrollHeight - before + el.scrollTop // keep the viewport anchored
    busyScroll = false
  }
}

async function run(fn: () => Promise<void>, ok: string) {
  busy.value = true
  try { await fn(); toast.success(ok) } catch (e) { toast.error(parseError(e).message) } finally { busy.value = false }
}

async function toggleClosed() {
  const closing = c.value?.status === 'open'
  const yes = await confirm({
    title: closing ? 'Close this conversation?' : 'Reopen this conversation?',
    message: closing ? `${name.value} can still message you, and it will reopen automatically if they do.` : `${name.value} will see the conversation as open again.`,
    confirmText: closing ? 'Close conversation' : 'Reopen', tone: closing ? 'danger' : 'primary',
  })
  if (yes) run(() => chat.updateConversation({ status: closing ? 'closed' : 'open' }), closing ? 'Conversation closed.' : 'Conversation reopened.')
}

async function assignToMe() {
  const other = c.value?.assigned_admin && !mine.value
  if (other) {
    const yes = await confirm({ title: 'Take over this conversation?', message: `It is currently assigned to ${c.value!.assigned_admin!.name}. They will no longer be the owner.`, confirmText: 'Take over' })
    if (!yes) return
  }
  run(() => chat.updateConversation({ assigned_admin_id: auth.user!.id }), 'Assigned to you.')
}

async function unassign() {
  const yes = await confirm({ title: 'Unassign this conversation?', message: 'Anyone with chat access will be able to pick it up.', confirmText: 'Unassign' })
  if (yes) run(() => chat.updateConversation({ assigned_admin_id: null }), 'Conversation unassigned.')
}

async function remove(m: ChatMessage) {
  const yes = await confirm({
    title: 'Delete this message?',
    message: 'It will be removed for you and the customer. This cannot be undone.',
    confirmText: 'Delete message', tone: 'danger',
  })
  if (yes) run(() => chat.deleteMessage(m.id), 'Message deleted.')
}

function send(body: string, file?: File) { chat.send(body, file, auth.user ? { id: auth.user.id, name: auth.user.name } : undefined) }

function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') lightbox.value = null }
watch(lightbox, (v) => (v ? document.addEventListener('keydown', onEsc) : document.removeEventListener('keydown', onEsc)))
onBeforeUnmount(() => document.removeEventListener('keydown', onEsc))
</script>

<template>
  <section class="thread">
    <header v-if="c" class="head">
      <button type="button" class="icon-btn back" aria-label="Back to conversations" @click="$emit('back')"><ArrowLeft :size="19" /></button>
      <UserAvatar :name="name" :src="c.user.photo_url" :size="42" />
      <div class="who">
        <strong>{{ name }}</strong>
        <small>{{ c.user.email }}<template v-if="c.user.phone"> &middot; {{ c.user.phone }}</template></small>
      </div>
      <span v-if="c.status === 'closed'" class="tag closed">Closed</span>
      <span v-else-if="c.assigned_admin" class="tag">{{ mine ? 'Assigned to you' : c.assigned_admin.name }}</span>
      <div v-if="canModerate" class="tools">
        <button v-if="!mine" type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="assignToMe"><UserCheck :size="16" /><span>{{ c.assigned_admin ? 'Take over' : 'Assign to me' }}</span></button>
        <button v-if="c.assigned_admin" type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="unassign"><UserMinus :size="16" /><span>Unassign</span></button>
        <button type="button" class="btn btn-sm" :class="c.status === 'open' ? 'btn-ghost' : 'btn-primary'" :disabled="busy" @click="toggleClosed">
          <Lock v-if="c.status === 'open'" :size="16" /><LockOpen v-else :size="16" /><span>{{ c.status === 'open' ? 'Close' : 'Reopen' }}</span>
        </button>
      </div>
    </header>
    <header v-else class="head"><button type="button" class="icon-btn back" aria-label="Back" @click="$emit('back')"><ArrowLeft :size="19" /></button><span class="skeleton" style="width: 160px; height: 16px" /></header>

    <div ref="scroller" class="scroll" @scroll.passive="onScroll">
      <p v-if="chat.threadError" class="state err"><AlertCircle :size="18" /> {{ chat.threadError }} <button class="link" type="button" @click="chat.openThread(chat.activeId!)">Retry</button></p>
      <div v-else-if="chat.threadLoading" class="state"><Loader2 :size="22" class="spin" /></div>
      <template v-else>
        <div v-if="chat.hasMore" class="older"><button type="button" class="link" @click="chat.loadOlder()"><ChevronUp :size="15" /> {{ chat.loadingOlder ? 'Loading' : 'Load earlier messages' }}</button></div>
        <p v-else-if="!chat.messages.length" class="state">No messages yet.</p>

        <template v-for="it in items" :key="it.key">
          <div v-if="it.kind === 'day'" class="day"><span>{{ it.label }}</span></div>
          <div v-else class="msg" :class="{ mine: it.m.is_mine, first: it.first, last: it.last }">
            <div class="bubble" :class="{ failed: it.m.status === 'failed', pending: it.m.status === 'sending' }">
              <small v-if="it.first && !it.m.is_mine" class="sender">{{ it.m.sender.name }}<i v-if="it.m.sender.role === 'admin'"> &middot; Support</i></small>
              <button v-if="it.m.attachment || it.m.localUrl" type="button" class="photo" aria-label="Open photo" @click="lightbox = it.m">
                <img v-if="it.m.localUrl" :src="it.m.localUrl" alt="Photo" />
                <AuthImage v-else :src="it.m.attachment!.url" alt="Photo" />
              </button>
              <p v-if="it.m.body">{{ it.m.body }}</p>
              <span class="meta">
                <time>{{ clockTime(it.m.created_at) }}</time>
                <Loader2 v-if="it.m.status === 'sending'" :size="13" class="spin" />
                <template v-else-if="it.m.is_mine && !it.m.status"><CheckCheck v-if="it.m.read_at" :size="14" class="seen" /><Check v-else :size="14" /></template>
              </span>
            </div>
            <button v-if="canModerate && !it.m.status" type="button" class="del" aria-label="Delete message" @click="remove(it.m)"><Trash2 :size="15" /></button>
            <div v-if="it.m.status === 'failed'" class="fail">
              <span>{{ it.m.error || "Didn't send" }}</span>
              <button type="button" class="link" @click="chat.retry(it.m.client_id!)"><RotateCcw :size="13" /> Retry</button>
              <button type="button" class="link" @click="chat.discard(it.m.client_id!)">Discard</button>
            </div>
            <small v-if="it.m.id === lastSeenId" class="seen-label">Seen</small>
          </div>
        </template>
      </template>
      <button v-if="pill" type="button" class="newpill" @click="toBottom(true)"><ArrowDown :size="15" /> {{ pill }} new message{{ pill > 1 ? 's' : '' }}</button>
    </div>

    <ChatComposer :can-reply="canReply" :closed="c?.status === 'closed'" @send="send" />

    <Teleport to="body">
      <div v-if="lightbox" class="lb" role="dialog" aria-modal="true" aria-label="Photo" @click="lightbox = null">
        <button type="button" class="lb-x" aria-label="Close"><X :size="22" /></button>
        <img v-if="lightbox.localUrl" :src="lightbox.localUrl" alt="Photo" @click.stop />
        <AuthImage v-else-if="lightbox.attachment" :src="lightbox.attachment.url" alt="Photo" class="lb-img" @click.stop />
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.thread { position: relative; display: flex; flex-direction: column; min-height: 0; height: 100%; background: #f1f6f8; }
.head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.back { display: none; }
.who { min-width: 0; flex: 1 1 160px; display: grid; }
.who strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who small { color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.tag.closed { color: var(--text-dim); background: rgba(4, 20, 59, 0.08); }
.tools { display: flex; gap: 8px; flex-wrap: wrap; }

.scroll { position: relative; flex: 1; overflow-y: auto; min-height: 0; padding: 16px 16px 8px; display: flex; flex-direction: column; }
.state { margin: auto; display: flex; align-items: center; gap: 8px; color: var(--text-mute); }
.state.err { color: #9f1239; }
.older { display: flex; justify-content: center; padding-bottom: 10px; }
.link { display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; padding: 0; color: var(--blue-ink); font-weight: 600; font-size: 13.5px; }
.day { display: flex; justify-content: center; margin: 14px 0 10px; }
.day span { padding: 4px 12px; font-size: 12px; font-weight: 600; color: var(--text-dim); background: rgba(255, 255, 255, 0.9); border-radius: 999px; box-shadow: 0 1px 2px rgba(4, 20, 59, 0.08); }

.msg { position: relative; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px; max-width: 100%; margin-top: 2px; }
.msg.first { margin-top: 10px; }
.msg.mine { justify-content: flex-end; }
.bubble { max-width: min(76%, 560px); padding: 8px 12px 6px; background: #fff; border-radius: 6px 16px 16px 6px; box-shadow: 0 1px 1.5px rgba(4, 20, 59, 0.1); overflow-wrap: anywhere; }
.msg.first .bubble { border-top-left-radius: 16px; }
.msg.last .bubble { border-bottom-left-radius: 16px; }
.msg.mine .bubble { color: #fff; background: var(--teal); border-radius: 16px 6px 6px 16px; }
.msg.mine.first .bubble { border-top-right-radius: 16px; }
.msg.mine.last .bubble { border-bottom-right-radius: 16px; }
.bubble.pending { opacity: 0.7; }
.bubble.failed { background: #fde8ec; color: var(--text); outline: 1px solid rgba(217, 45, 74, 0.4); }
.sender { display: block; margin-bottom: 2px; font-weight: 700; font-size: 12.5px; color: var(--blue-ink); }
.sender i { font-style: normal; font-weight: 500; color: var(--text-mute); }
.bubble p { white-space: pre-wrap; }
.photo { display: block; padding: 0; margin: 2px 0 4px; background: none; border: 0; border-radius: 10px; overflow: hidden; }
.photo :deep(img), .photo img { display: block; max-width: min(260px, 100%); max-height: 300px; object-fit: cover; border-radius: 10px; }
.meta { display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-top: 2px; font-size: 11px; opacity: 0.7; }
.seen { color: #8ef5e0; opacity: 1; }
.del { display: grid; place-items: center; width: 28px; height: 28px; opacity: 0; background: #fff; border: 1px solid var(--line); border-radius: 50%; color: var(--danger); order: -1; }
.msg.mine .del { order: -1; }
.msg:not(.mine) .del { order: 2; }
.msg:hover .del, .del:focus-visible { opacity: 1; }
@media (hover: none) { .del { opacity: 0.75; } }
.fail { flex-basis: 100%; display: flex; justify-content: flex-end; gap: 10px; font-size: 12.5px; color: #9f1239; }
.seen-label { flex-basis: 100%; text-align: right; font-size: 11.5px; color: var(--text-mute); margin-top: -2px; }
.newpill { position: sticky; bottom: 8px; align-self: center; display: inline-flex; align-items: center; gap: 6px; margin-top: auto; padding: 8px 14px; border: 0; border-radius: 999px; color: #fff; font-weight: 600; font-size: 13px; background: var(--syn-navy); box-shadow: 0 10px 24px -8px rgba(4, 20, 59, 0.6); }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.lb { position: fixed; inset: 0; z-index: 110; display: grid; place-items: center; padding: 20px; background: rgba(2, 8, 24, 0.88); }
.lb img, .lb :deep(img) { max-width: 100%; max-height: 90dvh; border-radius: 12px; }
.lb-x { position: absolute; top: 16px; right: 16px; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%; color: #fff; background: rgba(255, 255, 255, 0.14); }

@media (max-width: 899px) { .back { display: inline-grid; } .btn span { display: none; } .bubble { max-width: 86%; } }
</style>
