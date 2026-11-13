<script setup lang="ts">
import { computed, ref } from 'vue'

interface Point { t: string; v: number }
const props = withDefaults(defineProps<{ points: Point[]; format?: 'count' | 'money'; title: string }>(), { format: 'count' })

const W = 600
const H = 190
const padL = 44
const padR = 10
const padT = 12
const padB = 26

function fmt(v: number): string {
  if (props.format === 'money') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v)
  return new Intl.NumberFormat('en-US').format(v)
}
function axis(v: number): string {
  if (props.format === 'money') return v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`
  return String(Math.round(v))
}
function label(t: string): string {
  if (t.includes(' ')) return `${t.split(' ')[1] ?? '00'}:00` // "2026-11-13 14" is an hour
  const [y = 1970, m = 1, d = 1] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const max = computed(() => {
  const m = Math.max(0, ...props.points.map((p) => p.v))
  if (m <= 0) return 4
  if (props.format === 'count') return Math.max(4, Math.ceil(m / 4) * 4) // whole numbers on every gridline
  const pow = 10 ** Math.floor(Math.log10(m))
  const n = m / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
})
const x = (i: number) => padL + (props.points.length <= 1 ? 0 : (i / (props.points.length - 1)) * (W - padL - padR))
const y = (v: number) => padT + (1 - v / max.value) * (H - padT - padB)

const line = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '))
const area = computed(() => {
  if (!props.points.length) return ''
  const last = props.points.length - 1
  return `${line.value} L${x(last).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`
})
const grid = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: y(max.value * f), label: axis(max.value * f) })))
const ticks = computed(() => {
  const n = props.points.length
  if (!n) return []
  const idx = n <= 6 ? props.points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
  return [...new Set(idx)].map((i) => ({ x: x(i), label: label(props.points[i]?.t ?? '') }))
})
const total = computed(() => props.points.reduce((s, p) => s + p.v, 0))

const hover = ref<number | null>(null)
const svg = ref<SVGSVGElement | null>(null)
function move(e: MouseEvent | TouchEvent) {
  const el = svg.value
  if (!el || props.points.length === 0) return
  const rect = el.getBoundingClientRect()
  const cx = 'touches' in e ? (e.touches[0]?.clientX ?? rect.left) : e.clientX
  const px = ((cx - rect.left) / rect.width) * W
  const i = Math.round(((px - padL) / (W - padL - padR)) * (props.points.length - 1))
  hover.value = Math.min(props.points.length - 1, Math.max(0, i))
}
const tip = computed(() => {
  if (hover.value === null) return null
  const p = props.points[hover.value]
  if (!p) return null
  return { left: `${(x(hover.value) / W) * 100}%`, text: `${label(p.t)}: ${fmt(p.v)}` }
})
</script>

<template>
  <figure class="chart">
    <svg ref="svg" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${title}. Total ${fmt(total)}.`" @mousemove="move" @touchmove.passive="move" @mouseleave="hover = null" @touchend="hover = null">
      <g class="grid">
        <g v-for="g in grid" :key="g.y"><line :x1="padL" :x2="W - padR" :y1="g.y" :y2="g.y" /><text :x="padL - 6" :y="g.y + 4" text-anchor="end">{{ g.label }}</text></g>
      </g>
      <path :d="area" class="area" />
      <path :d="line" class="line" />
      <g v-if="hover !== null"><line class="cursor" :x1="x(hover)" :x2="x(hover)" :y1="padT" :y2="H - padB" /><circle :cx="x(hover)" :cy="y(points[hover]?.v ?? 0)" r="4" class="dot" /></g>
      <g class="xl"><text v-for="t in ticks" :key="t.label + t.x" :x="t.x" :y="H - 6" text-anchor="middle">{{ t.label }}</text></g>
    </svg>
    <div v-if="tip" class="tip" :style="{ left: tip.left }">{{ tip.text }}</div>
  </figure>
</template>

<style scoped>
.chart { position: relative; margin: 0; }
svg { display: block; width: 100%; height: auto; overflow: visible; touch-action: pan-y; }
.grid line { stroke: var(--line, rgba(4, 20, 59, 0.12)); stroke-width: 1; }
.grid text, .xl text { font-size: 11px; fill: var(--text-mute, #6b7280); }
.area { fill: var(--blue, #0066ff); opacity: 0.12; }
.line { fill: none; stroke: var(--blue, #0066ff); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.cursor { stroke: var(--text-mute, #6b7280); stroke-width: 1; stroke-dasharray: 3 3; }
.dot { fill: #fff; stroke: var(--blue, #0066ff); stroke-width: 2.2; }
.tip { position: absolute; top: -6px; transform: translateX(-50%); padding: 5px 10px; font-size: 12.5px; font-weight: 600; color: #fff; background: var(--navy, #04143b); border-radius: 8px; white-space: nowrap; pointer-events: none; }
</style>