import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'primary'
}

export const confirmState = reactive<ConfirmOptions & { open: boolean; busy: boolean; resolve: ((v: boolean) => void) | null }>({
  open: false, busy: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', tone: 'primary', resolve: null,
})

/** Promise-based dialog: `if (!(await confirm({...}))) return` */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  confirmState.resolve?.(false)
  Object.assign(confirmState, { confirmText: 'Confirm', cancelText: 'Cancel', tone: 'primary', message: '' }, opts, { open: true, busy: false })
  return new Promise((resolve) => { confirmState.resolve = resolve })
}

export function settleConfirm(value: boolean) {
  confirmState.open = false
  confirmState.resolve?.(value)
  confirmState.resolve = null
}

export const useConfirm = () => ({ confirm })
