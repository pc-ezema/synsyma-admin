import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const toggleSidebar = () => (sidebarOpen.value = !sidebarOpen.value)
  const closeSidebar = () => (sidebarOpen.value = false)
  return { sidebarOpen, toggleSidebar, closeSidebar }
})
