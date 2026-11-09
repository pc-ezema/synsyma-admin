<script setup lang="ts">
import { Star } from 'lucide-vue-next'

withDefaults(defineProps<{ rating: number; size?: number }>(), { size: 16 })
</script>

<template>
  <span class="stars" role="img" :aria-label="`${rating} out of 5 stars`">
    <Star v-for="i in 5" :key="i" :size="size" :class="{ on: i <= Math.round(rating) }" aria-hidden="true" />
  </span>
</template>

<style scoped>
.stars { display: inline-flex; gap: 2px; vertical-align: middle; color: #C9CFDB; }
.stars svg { fill: transparent; }
.stars svg.on { color: #F5A524; fill: #F5A524; }
</style>