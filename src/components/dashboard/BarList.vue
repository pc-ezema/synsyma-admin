<script setup lang="ts">
import { computed } from 'vue'

interface Item { name: string; count: number }
const props = defineProps<{ items: Item[]; empty?: string }>()
const max = computed(() => Math.max(1, ...props.items.map((i) => i.count)))
</script>

<template>
  <p v-if="!items.length" class="none">{{ empty ?? 'Nothing in this period.' }}</p>
  <ul v-else class="bars">
    <li v-for="i in items" :key="i.name">
      <div class="row"><span class="name">{{ i.name }}</span><strong>{{ i.count }}</strong></div>
      <div class="track" aria-hidden="true"><span :style="{ width: `${Math.max(3, (i.count / max) * 100)}%` }" /></div>
    </li>
  </ul>
</template>

<style scoped>
.none { margin: 0; color: var(--text-mute, #6b7280); font-size: 14px; }
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.row { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-dim, #4a4e5a); }
.track { height: 8px; margin-top: 5px; background: rgba(4, 20, 59, 0.07); border-radius: 6px; overflow: hidden; }
.track span { display: block; height: 100%; background: linear-gradient(90deg, var(--blue, #0066ff), var(--cyan, #00c2ff)); border-radius: 6px; }
</style>