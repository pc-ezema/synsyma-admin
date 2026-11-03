<script setup lang="ts">
import { Inbox, Loader2, Search } from 'lucide-vue-next'
import { useChatStore, type InboxFilter } from '@/stores/chat'
import { timeAgo } from '@/lib/format'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const chat = useChatStore()
const filters: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Open' }, { id: 'unread', label: 'Unread' },
  { id: 'mine', label: 'Mine' }, { id: 'closed', label: 'Closed' },
]
const emit = defineEmits<{ select: [id: string] }>()

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight > el.scrollHeight - 160) chat.loadMoreInbox()
}
</script>

<template>
  <section class="list" aria-label="Conversations">
    <header>
      <h2>Messages</h2>
      <label class="field search">
        <Search :size="17" />
        <input type="search" placeholder="Search name or email" :value="chat.search" aria-label="Search conversations" @input="chat.setSearch(($event.target as HTMLInputElement).value)" />
      </label>
      <div class="chips" role="tablist">
        <button v-for="f in filters" :key="f.id" type="button" role="tab" class="chip" :class="{ on: chat.filter === f.id }" :aria-selected="chat.filter === f.id" @click="chat.setFilter(f.id)">{{ f.label }}</button>
      </div>
    </header>

    <div class="rows" @scroll.passive="onScroll">
      <template v-if="chat.inboxLoading && !chat.inbox.length">
        <div v-for="i in 6" :key="i" class="sk-row"><span class="skeleton av" /><span class="skeleton l1" /><span class="skeleton l2" /></div>
      </template>
      <p v-else-if="chat.inboxError" class="state err">{{ chat.inboxError }} <button class="link" type="button" @click="chat.loadInbox()">Retry</button></p>
      <div v-else-if="!chat.inbox.length" class="state"><Inbox :size="30" /><p>No conversations here yet.</p></div>

      <button v-for="c in chat.inbox" :key="c.id" type="button" class="row" :class="{ active: c.id === chat.activeId, unread: c.unread_count > 0 }" @click="emit('select', c.id)">
        <UserAvatar :name="c.user.full_name || c.user.first_name" :src="null" :size="44" />
        <span class="mid">
          <strong>{{ c.user.full_name || `${c.user.first_name} ${c.user.last_name}` }}</strong>
          <small>
            <em v-if="c.last_message_sender === 'admin'">You: </em>{{ c.last_message_preview || 'No messages' }}
          </small>
          <span v-if="c.status === 'closed' || c.assigned_admin" class="tags">
            <i v-if="c.status === 'closed'" class="tag closed">Closed</i>
            <i v-if="c.assigned_admin" class="tag">{{ c.assigned_admin.name.split(' ')[0] }}</i>
          </span>
        </span>
        <span class="end">
          <time>{{ timeAgo(c.last_message_at) }}</time>
          <b v-if="c.unread_count" class="count">{{ c.unread_count > 99 ? '99+' : c.unread_count }}</b>
        </span>
      </button>
      <p v-if="chat.meta && chat.meta.current_page < chat.meta.last_page" class="more"><Loader2 :size="16" class="spin" /> Loading more</p>
    </div>
  </section>
</template>

<style scoped>
.list { display: flex; flex-direction: column; min-height: 0; height: 100%; background: #fff; }
header { display: grid; gap: 12px; padding: 18px 16px 12px; border-bottom: 1px solid var(--line); }
h2 { font-family: var(--font-display); font-size: 20px; font-weight: 600; }
.search { height: 42px; }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.rows { flex: 1; overflow-y: auto; min-height: 0; }
.row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; text-align: left; background: none; border: 0; border-bottom: 1px solid rgba(4, 20, 59, 0.05); }
.row:hover { background: rgba(4, 20, 59, 0.03); }
.row.active { background: rgba(0, 102, 255, 0.08); box-shadow: inset 3px 0 var(--syn-blue-dark); }
.mid { flex: 1; min-width: 0; display: grid; gap: 1px; }
.mid strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mid small { color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.mid small em { font-style: normal; color: var(--text-dim); }
.row.unread strong, .row.unread small { font-weight: 700; color: var(--text); }
.tags { display: flex; gap: 4px; margin-top: 3px; }
.tag { font-style: normal; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.tag.closed { color: var(--text-dim); background: rgba(4, 20, 59, 0.08); }
.end { display: grid; justify-items: end; gap: 6px; align-self: flex-start; padding-top: 2px; }
.end time { font-size: 12px; color: var(--text-mute); }
.count { min-width: 22px; padding: 1px 7px; border-radius: 999px; text-align: center; font-size: 12px; color: #fff; background: var(--teal); }
.state { display: grid; justify-items: center; gap: 8px; padding: 48px 24px; text-align: center; color: var(--text-mute); }
.state.err { color: #9f1239; }
.link { background: none; border: 0; color: var(--blue-ink); font-weight: 600; }
.sk-row { display: grid; grid-template-columns: 44px 1fr; gap: 6px 12px; padding: 14px 16px; }
.sk-row .av { grid-row: span 2; width: 44px; height: 44px; border-radius: 50%; }
.sk-row .l1 { height: 12px; width: 50%; } .sk-row .l2 { height: 10px; width: 80%; }
.more { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 14px; color: var(--text-mute); font-size: 13px; }
.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
