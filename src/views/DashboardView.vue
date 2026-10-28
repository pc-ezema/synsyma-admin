<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, MessageSquare, UserCheck, UserPlus, Users } from 'lucide-vue-next'
import AreaChart from '@/components/dashboard/AreaChart.vue'
import StatCard from '@/components/dashboard/StatCard.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${auth.user?.name?.split(' ')[0] ?? 'there'}`
})

/* ---- Demo data: replace with calls to your Admin module endpoints ---- */
const stats = [
  { label: 'Total users', value: '12,480', delta: 12.4, icon: Users, tone: 'blue', spark: [20, 24, 23, 30, 34, 33, 41, 48] },
  { label: 'Active today', value: '3,206', delta: 5.1, icon: UserCheck, tone: 'green', spark: [30, 28, 36, 33, 40, 38, 44, 47] },
  { label: 'Messages sent', value: '48.2k', delta: 9.8, icon: MessageSquare, tone: 'blue', spark: [14, 22, 19, 27, 31, 29, 38, 42] },
  { label: 'New signups', value: '2,846', delta: -2.3, icon: UserPlus, tone: 'green', spark: [44, 40, 46, 38, 41, 35, 37, 33] },
] as const

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
function series(days: number, base: number, vol: number, seed: number) {
  const r = seeded(seed)
  let v = base
  return Array.from({ length: days }, () => (v = Math.max(20, v + (r() - 0.44) * vol + base * 0.004)) && Math.round(v))
}
const ranges = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
]
const range = ref(30)
const labels = computed(() =>
  Array.from({ length: range.value }, (_, i) =>
    new Date(Date.now() - (range.value - 1 - i) * 864e5).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  ),
)
const chartSeries = computed(() => [
  { name: 'Returning', data: series(range.value, 480, 70, 11), color: '#00B32C' },
  { name: 'New', data: series(range.value, 260, 50, 7), color: '#0066FF' },
])

const platforms = [
  { name: 'Android', pct: 58, color: '#0066FF' },
  { name: 'iOS', pct: 34, color: '#00C2FF' },
  { name: 'Web', pct: 8, color: '#8EF500' },
]

const users = [
  { name: 'Amara Okafor', email: 'amara@mail.com', status: 'Active', joined: 'Today', platform: 'Android' },
  { name: 'Daniel Mensah', email: 'd.mensah@mail.com', status: 'Pending', joined: 'Today', platform: 'iOS' },
  { name: 'Lina Haddad', email: 'lina.h@mail.com', status: 'Active', joined: 'Yesterday', platform: 'iOS' },
  { name: 'Tunde Bakare', email: 'tunde@mail.com', status: 'Suspended', joined: '2 days ago', platform: 'Android' },
  { name: 'Grace Wanjiru', email: 'grace.w@mail.com', status: 'Active', joined: '3 days ago', platform: 'Android' },
]
const activity = [
  { text: 'Amara Okafor created an account', time: '2 min ago', tone: 'green' },
  { text: 'A chat report was flagged for review', time: '14 min ago', tone: 'red' },
  { text: 'Daniel Mensah is waiting for verification', time: '38 min ago', tone: 'blue' },
  { text: 'Tunde Bakare was suspended by an admin', time: '2 hours ago', tone: 'red' },
  { text: 'Profile photo updated by Lina Haddad', time: '3 hours ago', tone: 'blue' },
]

const hue = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 2
const initials = (n: string) => n.split(' ').map((w) => w[0]).join('')
</script>

<template>
  <div class="dash">
    <header class="head">
      <div>
        <h1>{{ greeting }}</h1>
        <p>Here is how Synsyma is doing today.</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" type="button"><Download :size="17" /> Export report</button>
        <button class="btn btn-primary" type="button"><UserPlus :size="17" /> Add user</button>
      </div>
    </header>

    <section class="stats" aria-label="Key numbers">
      <StatCard v-for="s in stats" :key="s.label" v-bind="s" />
    </section>

    <section class="row">
      <article class="card panel chart-card">
        <header class="panel-head">
          <div>
            <h2>User growth</h2>
            <div class="legend">
              <span><i style="background: #0066FF" />New users</span>
              <span><i style="background: #00B32C" />Returning users</span>
            </div>
          </div>
          <div class="seg" role="tablist" aria-label="Date range">
            <button v-for="r in ranges" :key="r.key" role="tab" :aria-selected="range === r.key" :class="{ on: range === r.key }" type="button" @click="range = r.key">
              {{ r.label }}
            </button>
          </div>
        </header>
        <AreaChart :labels="labels" :series="chartSeries" />
      </article>

      <article class="card panel">
        <h2>Where users sign in</h2>
        <p class="muted">Share of active users by platform</p>
        <div class="bar" role="img" :aria-label="platforms.map((p) => `${p.name} ${p.pct}%`).join(', ')">
          <span v-for="p in platforms" :key="p.name" :style="{ width: p.pct + '%', background: p.color }" />
        </div>
        <ul class="plat">
          <li v-for="p in platforms" :key="p.name">
            <i :style="{ background: p.color }" />
            <span>{{ p.name }}</span>
            <b>{{ p.pct }}%</b>
          </li>
        </ul>
        <p class="note">Most of your users are on the Flutter mobile app. Prioritise Android fixes first.</p>
      </article>
    </section>

    <section class="row">
      <article class="card panel">
        <header class="panel-head">
          <h2>Recent users</h2>
          <RouterLink to="/users" class="see">View all users</RouterLink>
        </header>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Status</th><th class="hide-sm">Joined</th><th class="hide-sm">Platform</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.email">
                <td>
                  <div class="person">
                    <span class="av" :class="hue(u.name) ? 'g' : 'b'">{{ initials(u.name) }}</span>
                    <div><strong>{{ u.name }}</strong><small>{{ u.email }}</small></div>
                  </div>
                </td>
                <td><span class="chip" :class="u.status.toLowerCase()">{{ u.status }}</span></td>
                <td class="hide-sm dim">{{ u.joined }}</td>
                <td class="hide-sm dim">{{ u.platform }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card panel">
        <h2>Latest activity</h2>
        <ul class="feed">
          <li v-for="a in activity" :key="a.text">
            <i :class="a.tone" />
            <div><p>{{ a.text }}</p><small>{{ a.time }}</small></div>
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<style scoped>
.dash { display: grid; gap: 20px; }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
h1 { font-family: var(--font-display); font-size: clamp(24px, 3vw, 32px); font-weight: 600; letter-spacing: -0.02em; }
.head p { margin-top: 4px; color: var(--text-dim); }
.head-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 20px; }

.panel { padding: 22px; min-width: 0; }
.chart-card { border-radius: 24px; background: linear-gradient(180deg, rgba(0, 102, 255, 0.05), #fff 55%); }
.panel-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
h2 { font-family: var(--font-display); font-size: 18px; font-weight: 600; }
.muted { margin-top: 2px; color: var(--text-mute); font-size: 14px; }
.legend { display: flex; gap: 16px; margin-top: 6px; font-size: 13px; color: var(--text-dim); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 9px; height: 9px; border-radius: 50%; }

.seg { display: inline-flex; padding: 3px; background: rgba(4, 20, 59, 0.05); border: 1px solid var(--line); border-radius: 12px; }
.seg button { height: 34px; padding: 0 14px; background: none; border: 0; border-radius: 9px; color: var(--text-dim); font-size: 13px; font-weight: 600; }
.seg button.on { background: var(--grad-blue); color: #fff; }

.bar { display: flex; gap: 3px; height: 14px; margin: 22px 0 18px; }
.bar span { border-radius: 99px; }
.plat { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.plat li { display: flex; align-items: center; gap: 10px; }
.plat i { width: 10px; height: 10px; border-radius: 3px; }
.plat span { flex: 1; color: var(--text-dim); }
.note { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--text-dim); }

.see { color: var(--blue-ink); font-weight: 600; font-size: 14px; }
.see:hover { text-decoration: underline; }
.table-wrap { overflow-x: auto; margin: 0 -22px; padding: 0 22px; }
table { width: 100%; border-collapse: collapse; min-width: 320px; }
th { padding: 8px 12px 10px 0; text-align: left; font-size: 13px; font-weight: 600; color: var(--text-mute); border-bottom: 1px solid var(--line); }
td { padding: 12px 12px 12px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
.dim { color: var(--text-dim); font-size: 14px; }
.person { display: flex; align-items: center; gap: 12px; }
.person strong { display: block; font-size: 14px; }
.person small { display: block; color: var(--text-mute); font-size: 13px; }
.av { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 50%; font-size: 13px; font-weight: 700; }
.av.b { background: var(--grad-blue-full); }
.av.g { background: var(--grad-green); color: var(--syn-navy); }
.chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.chip.active { color: var(--green-ink); background: rgba(0, 179, 44, 0.12); }
.chip.pending { color: var(--blue-ink); background: rgba(0, 102, 255, 0.1); }
.chip.suspended { color: var(--danger); background: rgba(217, 45, 74, 0.1); }

.feed { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 18px; }
.feed li { display: flex; gap: 12px; }
.feed i { flex: none; width: 10px; height: 10px; margin-top: 7px; border-radius: 50%; }
.feed i.green { background: var(--syn-green-emerald); }
.feed i.blue { background: var(--syn-blue-dark); }
.feed i.red { background: var(--danger); }
.feed p { font-size: 14px; }
.feed small { color: var(--text-mute); font-size: 13px; }

@media (max-width: 1180px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .row { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .stats { grid-template-columns: 1fr; }
  .panel { padding: 18px; }
  .table-wrap { margin: 0 -18px; padding: 0 18px; }
  .hide-sm { display: none; }
  .head-actions { width: 100%; }
  .head-actions .btn { flex: 1; }
  .seg { width: 100%; }
  .seg button { flex: 1; padding: 0; }
}
</style>
