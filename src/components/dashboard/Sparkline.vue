<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data: number[]; tone: 'blue' | 'green' }>()
const id = `sp-${Math.random().toString(36).slice(2, 8)}`
const color = computed(() => (props.tone === 'green' ? '#00B32C' : '#0066FF'))

const geo = computed(() => {
  const d = props.data
  const min = Math.min(...d)
  const range = Math.max(...d) - min || 1
  const pts = d.map((v, i) => [(i / (d.length - 1)) * 100, 4 + (1 - (v - min) / range) * 24])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  return { line, area: `${line} L100 32 L0 32 Z` }
})
</script>

<template>
  <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient :id="id" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity="0.35" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geo.area" :fill="`url(#${id})`" />
    <path
      :d="geo.line"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
