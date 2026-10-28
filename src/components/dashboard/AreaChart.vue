<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface Series {
  name: string
  data: number[]
  color: string
}
const props = defineProps<{ labels: string[]; series: Series[] }>()

const wrap = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)
const W = ref(640)
const H = 280
const pad = { t: 12, r: 12, b: 30, l: 42 }
const hover = ref<number | null>(null)
const uid = `ac-${Math.random().toString(36).slice(2, 7)}`

let ro: ResizeObserver | undefined
onMounted(() => {
  if (!wrap.value) return
  W.value = wrap.value.clientWidth || 640
  ro = new ResizeObserver(([e]) => (W.value = Math.max(280, Math.floor(e.contentRect.width))))
  ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const n = computed(() => props.labels.length)
const scale = computed(() => {
  const m = Math.max(...props.series.flatMap((s) => s.data))
  const raw = m / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const k = raw / pow
  const step = (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * pow
  return { step, max: step * 4 }
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => i * scale.value.step))

const innerW = computed(() => W.value - pad.l - pad.r)
const x = (i: number) => pad.l + (i * innerW.value) / (n.value - 1)
const y = (v: number) => pad.t + (1 - v / scale.value.max) * (H - pad.t - pad.b)

function linePath(d: number[]) {
  return d
    .map((v, i) => {
      if (!i) return `M${x(i)} ${y(v)}`
      const cx = (x(i) + x(i - 1)) / 2
      return `C${cx} ${y(d[i - 1])} ${cx} ${y(v)} ${x(i)} ${y(v)}`
    })
    .join(' ')
}
const paths = computed(() =>
  props.series.map((s) => {
    const line = linePath(s.data)
    return { ...s, line, area: `${line} L${x(n.value - 1)} ${H - pad.b} L${x(0)} ${H - pad.b} Z` }
  }),
)

const xLabels = computed(() => {
  const count = W.value < 480 ? 4 : 6
  return Array.from({ length: count }, (_, i) => Math.round((i * (n.value - 1)) / (count - 1)))
})

function onMove(e: PointerEvent) {
  if (!svg.value) return
  const px = e.clientX - svg.value.getBoundingClientRect().left
  const idx = Math.round(((px - pad.l) / innerW.value) * (n.value - 1))
  hover.value = Math.min(n.value - 1, Math.max(0, idx))
}
const fmt = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))
</script>

<template>
  <div ref="wrap" class="chart">
    <svg
      ref="svg"
      :width="W"
      :height="H"
      role="img"
      aria-label="Line chart of new and returning users over time"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <defs>
        <linearGradient v-for="s in series" :id="`${uid}-${s.color.slice(1)}`" :key="s.name" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" :stop-color="s.color" stop-opacity="0.28" />
          <stop offset="1" :stop-color="s.color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g class="grid">
        <g v-for="t in ticks" :key="t">
          <line :x1="pad.l" :x2="W - pad.r" :y1="y(t)" :y2="y(t)" />
          <text :x="pad.l - 10" :y="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
        </g>
        <text v-for="i in xLabels" :key="i" :x="x(i)" :y="H - 8" text-anchor="middle">{{ labels[i] }}</text>
      </g>

      <g v-for="p in paths" :key="p.name">
        <path :d="p.area" :fill="`url(#${uid}-${p.color.slice(1)})`" />
        <path :d="p.line" fill="none" :stroke="p.color" stroke-width="2.5" stroke-linecap="round" />
      </g>

      <g v-if="hover !== null">
        <line class="cursor" :x1="x(hover)" :x2="x(hover)" :y1="pad.t" :y2="H - pad.b" />
        <circle v-for="p in paths" :key="p.name" :cx="x(hover)" :cy="y(p.data[hover])" r="5" :fill="p.color" stroke="#fff" stroke-width="2" />
      </g>
    </svg>

    <div v-if="hover !== null" class="tip" :style="{ left: `${x(hover)}px` }">
      <strong>{{ labels[hover] }}</strong>
      <span v-for="p in paths" :key="p.name"><i :style="{ background: p.color }" />{{ p.name }} {{ p.data[hover].toLocaleString() }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart { position: relative; width: 100%; }
svg { display: block; touch-action: pan-y; }
.grid line { stroke: rgba(4, 20, 59, 0.09); stroke-dasharray: 3 5; }
.grid text { fill: rgba(4, 20, 59, 0.6); font-size: 11px; font-family: var(--font-body); }
.cursor { stroke: rgba(4, 20, 59, 0.25); stroke-width: 1; }
.tip {
  position: absolute; top: 4px; transform: translateX(-50%); pointer-events: none;
  display: grid; gap: 2px; padding: 8px 12px; font-size: 12px; white-space: nowrap; color: #fff;
  background: rgba(4, 20, 59, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px;
  backdrop-filter: blur(8px);
}
.tip span { display: flex; align-items: center; gap: 6px; color: rgba(255, 255, 255, 0.8); }
.tip i { width: 8px; height: 8px; border-radius: 50%; }
</style>
