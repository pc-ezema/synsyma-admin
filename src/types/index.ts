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
