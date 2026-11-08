export interface AdminUser {
  id: string
  name: string
  email: string
  role: string | null
  roles: string[]
  permissions: string[]
  phone?: string | null
  photo_url?: string | null
}

export interface PermissionItem { id: string; name: string; group: string; description?: string | null }
export interface Role {
  id: string
  name: string
  label: string
  is_system: boolean
  admins_count: number | null
  permissions_count: number
  permissions?: string[]
}
export interface AdminRow {
  id: string
  name: string
  email: string
  is_active: boolean
  roles: string[]
  direct_permissions?: string[]
  permissions: string[]
  last_login_at?: string | null
  created_at?: string
}
export interface PageMeta { current_page: number; last_page: number; per_page: number; total: number }

export interface ChatUser {
  id: string; first_name: string; last_name: string; full_name?: string
  email: string; phone?: string | null; photo_url?: string | null
}
export interface Conversation {
  id: string
  status: 'open' | 'closed'
  last_message_at: string | null
  last_message_preview: string | null
  last_message_sender: 'user' | 'admin' | null
  unread_count: number
  user: ChatUser
  assigned_admin: { id: string; name: string } | null
}
export interface ChatAttachment { name: string; mime: string; size: number; url: string }
export interface ChatMessage {
  id: string
  conversation_id: string
  client_id: string | null
  type: 'text' | 'image'
  body: string | null
  attachment: ChatAttachment | null
  sender: { role: 'user' | 'admin'; id: string; name: string }
  is_mine: boolean
  read_at: string | null
  created_at: string
  status?: 'sending' | 'failed'
  error?: string
  localUrl?: string
}

export type ContactType = 'phone' | 'email' | 'whatsapp'
export interface SupportContact { id: string; type: ContactType; label: string | null; value: string; is_active: boolean; sort_order: number; updated_at?: string }
export interface AccountDeletion {
  id: string; user_id: string | null; name: string; email: string | null; phone: string | null
  reason: string | null; reason_label: string | null; comment: string | null
  platform: string | null; ip_address: string | null; account_created_at: string | null; deleted_at: string
}
export interface DeletionSummary { total: number; last_30_days: number; last_7_days: number }

export interface ServiceCategory { id: string; name: string; slug: string; icon: string | null; description: string | null; is_active: boolean; sort_order: number; services_count: number | null }
export type PriceType = 'hourly' | 'fixed' | 'quote'
export type ServiceTier = 'premium' | 'regular'
export interface ServiceItem {
  id: string; category_id: string; category_name: string | null; category_slug: string | null
  name: string; slug: string; tier: ServiceTier | null; description: string | null; image_url: string | null
  price_type: PriceType; currency: string; base_price: number | null; included_hours: number | null; additional_hour_price: number | null
  price_label: string; additional_label: string | null; parts_note: string | null; parts_tbd: boolean
  team_size: number | null; home_protection: boolean; is_active: boolean; sort_order: number
}

// ---- contractors ----
export type ContractorType = 'company' | 'individual'
export type ContractorStatus = 'pending' | 'approved' | 'suspended' | 'rejected'
export type CountryCode = 'CA' | 'US' | 'GB'
export type DocKind = 'id' | 'insurance' | 'licence' | 'other'
export interface ContractorRow {
  id: string; type: ContractorType; name: string; contact_name: string; email: string; phone: string
  country: CountryCode; city: string; region: string; status: ContractorStatus
  campaign_name: string | null; source: 'self' | 'admin'; categories_count: number | null; created_at: string
}
export interface ContractorDoc { id: string; kind: DocKind; original_name: string; mime: string; size: number; verified: boolean; created_at: string }
export interface ContractorDetail extends ContractorRow {
  address_line1: string; postal_code: string; tax_number: string | null; about: string | null
  status_reason: string | null; commission_percent: number | null; admin_notes: string | null; approved_at: string | null
  categories: { id: string; name: string }[]
  areas: { id: string; country: CountryCode; region: string; city: string | null }[]
  documents: ContractorDoc[]
}
export interface ContractorSummary { pending: number; approved: number; suspended: number; rejected: number; total: number }
export interface ContractorCampaign { id: string; name: string; code: string; scans: number; signups: number; is_active: boolean; created_at: string }
export interface JoinOptions { categories: { id: string; name: string }[]; countries: { code: CountryCode; name: string }[]; ref_valid: boolean }

/* ---------- bookings ---------- */
export type BookingStatus = 'pending_payment' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'refunded' | 'quote_requested' | 'quote_sent'
export interface BookingRow {
  id: string; reference: string; status: BookingStatus
  service_name: string; category_name: string | null; tier: string | null; price_type: 'hourly' | 'fixed' | 'quote'
  currency: string; total: string; total_label: string | null
  starts_at: string; starts_at_local: string; timezone: string
  country: CountryCode; city: string; region: string
  customer_name: string; customer_email: string | null; contractor_id: string | null; contractor_name: string | null
  created_at: string
}
export interface BookingEventRow { id: string; type: string; from_status: BookingStatus | null; to_status: BookingStatus | null; actor: 'customer' | 'admin' | 'system'; note: string | null; created_at: string }
export interface CancelQuote { allowed: boolean; tier: 'free' | 'partial' | 'none'; fee_percent: number; currency: string; paid: number; fee: number; refund: number; message: string }
export interface BookingPolicy { free_cancel_hours: number; late_cancel_hours: number; late_cancel_fee_percent: number; free_reschedules: number; max_extra_hours: number }
export interface BookingPaymentRow {
  id: string; provider: 'stripe' | 'paypal'; purpose: 'booking' | 'extra_hours'; hours: number | null; status: 'requires_payment' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
  amount: string; currency: string; card_brand: string | null; card_last4: string | null
  refunded_total: string; failure_message: string | null; paid_at: string | null; stripe_payment_intent_id: string | null
}
export interface BookingDetail extends BookingRow {
  address_line1: string; address_line2: string | null; postal_code: string; instructions: string | null; notes: string | null
  customer_phone: string | null; admin_notes: string | null
  subtotal: string; discount_total: string; tax_total: string; base_price: string | null; included_hours: number | null; additional_hour_price: string | null
  promo_code: string | null; assigned_at: string | null; completed_at: string | null; cancelled_at: string | null
  payment: BookingPaymentRow | null; payments: BookingPaymentRow[]
  extra_hours: number; reschedule_count: number
  cancel_quote: CancelQuote | null; refundable: number
  events: BookingEventRow[]
}
export type BookingSummary = Record<'all' | BookingStatus, number>
export interface ContractorOption { id: string; name: string; type: ContractorType; phone: string; email: string; covers_area: boolean }

export type PaymentFilter = '' | 'paid' | 'refunded' | 'failed' | 'unpaid'
export interface PaymentRow {
  id: string; booking_id: string; reference: string | null; customer_name: string; customer_email: string | null; service_name: string | null
  provider: 'stripe' | 'paypal'; purpose: 'booking' | 'extra_hours'; hours: number | null
  state: 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'unpaid'; currency: string
  amount: number; refunded_total: number; net: number; card: string; stripe_payment_intent_id: string | null; failure_message: string | null
  date: string | null; paid_at: string | null; created_at: string
}
export interface PaymentGateway { id: string; label: string; on: boolean; mode: 'live' | 'test' }
export interface PaymentTotals { collected: number; refunded: number; net: number; paid_count: number; count: number }

/* ---------- promo codes and banners ---------- */
export type PromoState = 'active' | 'scheduled' | 'expired' | 'off'
export interface PromoCode {
  id: string; code: string; description: string | null; type: 'percent' | 'fixed'; value: string | number; value_label: string
  max_discount: string | number | null; min_subtotal: string | number | null; starts_on: string | null; expires_on: string | null
  max_uses: number | null; max_uses_per_user: number; first_booking_only: boolean; is_active: boolean
  state: PromoState; used: number; saved: number; created_at: string
}
export type BannerLink = 'none' | 'service' | 'category'
export interface PromoBanner {
  id: string; title: string; subtitle: string | null; image_url: string | null; link_type: BannerLink; link_value: string | null
  promo_code: string | null; starts_on: string | null; ends_on: string | null; sort_order: number; is_active: boolean
}

export type PayoutMethod = 'bank_transfer' | 'etransfer' | 'paypal' | 'other'
export interface PayoutDetails {
  method: PayoutMethod; method_label: string; country: 'CA' | 'US' | 'GB' | null
  holder_name: string; bank_name: string | null; details: Record<string, string>
  summary: string; revealed: boolean; updated_at: string | null
}