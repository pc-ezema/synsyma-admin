<script setup lang="ts">
import { computed, type Component } from 'vue'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import Sparkline from './Sparkline.vue'

const props = defineProps<{
  label: string
  value: string
  delta: number
  spark: number[]
  icon: Component
  tone: 'blue' | 'green'
}>()
const up = computed(() => props.delta >= 0)
</script>

<template>
  <article class="stat" :class="tone">
    <header>
      <span class="ico"><component :is="icon" :size="18" /></span>
      <span class="label">{{ label }}</span>
    </header>
    <p class="value">{{ value }}</p>
    <footer>
      <span class="delta" :class="up ? 'up' : 'down'">
        <TrendingUp v-if="up" :size="14" />
        <TrendingDown v-else :size="14" />
        {{ Math.abs(delta) }}%
      </span>
      <span class="vs">vs last week</span>
    </footer>
    <Sparkline class="spark" :data="spark" :tone="tone" />
  </article>
</template>

<style scoped>
.stat {
  position: relative; overflow: hidden; padding: 18px 18px 16px;
  background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-card);
}
header { display: flex; align-items: center; gap: 10px; }
.ico { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; }
.blue .ico { background: rgba(0, 102, 255, 0.1); color: var(--blue-ink); }
.green .ico { background: rgba(0, 179, 44, 0.12); color: var(--green-ink); }
.label { color: var(--text-dim); font-size: 14px; font-weight: 500; }
.value { margin: 14px 0 8px; font-family: var(--font-display); font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
footer { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.delta { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
.delta.up { color: var(--green-ink); }
.delta.down { color: var(--danger); }
.vs { color: var(--text-mute); }
.spark { position: absolute; right: 16px; top: 58px; width: 36%; height: 40px; }
</style>
