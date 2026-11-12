import type { BookingStatus } from '@/types'

export const statusLabel: Record<BookingStatus, string> = {
  pending_payment: 'Awaiting payment', confirmed: 'Needs contractor', assigned: 'Assigned', en_route: 'On the way', in_progress: 'In progress', completed: 'Completed',
  cancelled: 'Cancelled', refunded: 'Refunded', quote_requested: 'Quote requested', quote_sent: 'Quote sent',
}
export const statusPill: Record<BookingStatus, string> = {
  pending_payment: 'grey', confirmed: '', assigned: '', en_route: '', in_progress: '', completed: 'green',
  cancelled: 'red', refunded: 'grey', quote_requested: 'grey', quote_sent: 'grey',
}
export const eventActor: Record<string, string> = { customer: 'Customer', admin: 'Admin', system: 'System' }

/** "2026-11-10T09:00" is already the customer's local time, so show those exact numbers whatever this browser's timezone is. */
export function localWhen(local: string, withDate = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return local
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return withDate
    ? d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const money = (value: string | number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value))