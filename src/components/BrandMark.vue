<script setup lang="ts">
import logoLight from '@/assets/images/logo-dark.png'
import logoDark from '@/assets/images/logo-dark.png'

withDefaults(defineProps<{ size?: number; on?: 'dark' | 'light' }>(), {
  size: 36,
  on: 'dark', // 'dark' = shown on a navy background
})
</script>

<template>
  <img :src="on === 'dark' ? logoLight : logoDark" :height="size" alt="Synsyma" />
</template>