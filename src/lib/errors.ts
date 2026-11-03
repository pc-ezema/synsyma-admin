import axios from 'axios'

export interface ParsedError {
  message: string
  fields: Record<string, string>
  status: number | null
  code: string | null
  retryAfter: number | null
}

export function parseError(e: unknown, fallback = 'Something went wrong. Try again.'): ParsedError {
  if (!axios.isAxiosError(e)) return { message: fallback, fields: {}, status: null, code: null, retryAfter: null }
  const status = e.response?.status ?? null
  const data = e.response?.data as { message?: string; errors?: Record<string, string[]>; code?: string } | undefined
  const fields: Record<string, string> = {}
  for (const [k, v] of Object.entries(data?.errors ?? {})) fields[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v)
  const retry = Number(e.response?.headers?.['retry-after'])
  let message = data?.message || fallback
  if (!e.response) message = "Can't reach the server. Check your connection and try again."
  else if (status === 429) message = data?.message && data.message !== 'Too Many Attempts.' ? data.message : 'Too many attempts. Wait a moment and try again.'
  else if (status === 403) message = data?.message || "You don't have permission to do that."
  else if (status === 422) message = Object.values(fields)[0] || data?.message || 'Check your details and try again.'
  else if (status && status >= 500) message = 'The server had a problem. Try again shortly.'
  return { message, fields, status, code: data?.code ?? null, retryAfter: Number.isFinite(retry) ? retry : null }
}
