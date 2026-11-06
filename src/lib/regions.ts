import type { CountryCode } from '@/types'

export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
]

const CA = ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon']
const US = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']
const GB = ['England', 'Scotland', 'Wales', 'Northern Ireland']

export const regionsFor = (country: CountryCode): string[] => (country === 'CA' ? CA : country === 'US' ? US : GB)
export const regionLabel = (country: CountryCode) => (country === 'CA' ? 'Province' : country === 'US' ? 'State' : 'Nation')
export const postalLabel = (country: CountryCode) => (country === 'US' ? 'ZIP code' : country === 'GB' ? 'Postcode' : 'Postal code')
export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code

/** Same shapes the server checks. */
export function postalOk(country: CountryCode, value: string): boolean {
  const v = value.trim().toUpperCase()
  if (country === 'CA') return /^[ABCEGHJ-NPRSTVXY]\d[A-Z] ?\d[A-Z]\d$/.test(v)
  if (country === 'US') return /^\d{5}(-\d{4})?$/.test(v)
  return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(v)
}
