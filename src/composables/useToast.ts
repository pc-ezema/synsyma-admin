import { reactive } from 'vue'

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }
export const toasts = reactive<Toast[]>([])
let n = 0

function push(kind: Toast['kind'], text: string, ms = 4000) {
  const id = ++n
  toasts.push({ id, kind, text })
  setTimeout(() => dismiss(id), ms)
}
export function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}
export const toast = {
  success: (t: string) => push('success', t),
  error: (t: string) => push('error', t, 6000),
  info: (t: string) => push('info', t),
}
export const useToast = () => toast
