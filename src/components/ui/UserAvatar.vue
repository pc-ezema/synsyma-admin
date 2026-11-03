<script setup lang="ts">
import { computed } from 'vue'
import { initials } from '@/lib/format'
import AuthImage from './AuthImage.vue'

const props = withDefaults(defineProps<{ name?: string; src?: string | null; size?: number; tone?: 'blue' | 'green' }>(), { size: 40, tone: 'blue' })
const text = computed(() => initials(props.name))
</script>

<template>
  <span class="av" :class="tone" :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.36 + 'px' }">
    <AuthImage v-if="src" :src="src" :alt="name" class="img" :fallback="text" />
    <template v-else>{{ text }}</template>
  </span>
</template>

<style scoped>
.av { display: inline-grid; place-items: center; flex: none; border-radius: 50%; overflow: hidden; color: #fff; font-weight: 700; background: var(--grad-blue); }
.av.green { background: var(--grad-green); color: var(--syn-navy); }
.img { width: 100%; height: 100%; object-fit: cover; }
</style>
