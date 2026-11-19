import type { CountryCode } from '@/types'
import { regionsFor } from './regions'

/** One suggestion from the server's address search. */
export interface AddressSuggestion {
  label: string
  address_line1: string
  city: string
  region: string
  postal_code: string
  country: CountryCode
  lat: number | null
  lon: number | null
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** The province, state or nation from the form's own list that matches what the search returned, or ''. */
export function matchRegion(country: CountryCode, name: string | null | undefined): string {
  if (!name) return ''
  const n = plain(name)
  return regionsFor(country).find((r) => plain(r) === n) ?? ''
}