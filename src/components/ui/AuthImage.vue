<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { fetchBlob } from '@/lib/api'
import { cached, remember } from '@/lib/imageCache'

const props = defineProps<{ src: string; alt?: string; fallback?: string }>()
const url = ref<string | null>(null)
const failed = ref(false)

async function load() {
  failed.value = false
  const hit = cached(props.src)
  if (hit) { url.value = hit; return }
  // Public image URLs (profile photos) load directly; API-hosted ones need the token
  if (!props.src.includes('/admin/chat/')) { url.value = props.src; return }
  try {
    const blob = await fetchBlob(props.src)
    const u = URL.createObjectURL(blob)
    remember(props.src, u)
    url.value = u
  } catch { failed.value = true }
}
onMounted(load)
watch(() => props.src, load)
</script>

<template>
  <img v-if="url && !failed" :src="url" :alt="alt ?? ''" @error="failed = true" />
  <span v-else-if="fallback" class="fb">{{ fallback }}</span>
  <span v-else class="ph" />
</template>

<style scoped>
.fb { display: grid; place-items: center; width: 100%; height: 100%; }
.ph { display: block; width: 100%; height: 100%; min-height: 80px; background: rgba(4, 20, 59, 0.06); }
</style>
