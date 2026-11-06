import type { CountryCode, DocKind, ContractorDetail, ContractorStatus, ContractorType } from '@/types'
import { postalOk, regionsFor } from './regions'

export interface ContractorFormState {
  type: ContractorType; name: string; contact_name: string; email: string; phone: string
  country: CountryCode; address_line1: string; city: string; region: string; postal_code: string
  tax_number: string; about: string; category_ids: string[]; areas: { region: string; city: string }[]
}

export const blankContractorForm = (): ContractorFormState => ({
  type: 'company', name: '', contact_name: '', email: '', phone: '', country: 'CA', address_line1: '', city: '', region: '',
  postal_code: '', tax_number: '', about: '', category_ids: [], areas: [],
})

export const formFromContractor = (p: ContractorDetail): ContractorFormState => ({
  type: p.type, name: p.name, contact_name: p.contact_name, email: p.email, phone: p.phone, country: p.country,
  address_line1: p.address_line1, city: p.city, region: p.region, postal_code: p.postal_code, tax_number: p.tax_number ?? '',
  about: p.about ?? '', category_ids: p.categories.map((c) => c.id), areas: p.areas.map((a) => ({ region: a.region, city: a.city ?? '' })),
})

export function validateContractorForm(f: ContractorFormState): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.name.trim().length < 2) e.name = f.type === 'company' ? 'Enter the business name.' : 'Enter the full name.'
  if (f.type === 'company' && f.contact_name.trim().length < 2) e.contact_name = 'Enter the contact person.'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (!/^[+0-9 ()-]{7,20}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number.'
  if (f.address_line1.trim().length < 3) e.address_line1 = 'Enter the street address.'
  if (f.city.trim().length < 2) e.city = 'Enter the city.'
  if (!f.region) e.region = 'Choose one.'
  if (!postalOk(f.country, f.postal_code)) e.postal_code = 'Enter a valid code for this country.'
  if (!f.category_ids.length) e.category_ids = 'Choose at least one service category.'
  if (f.areas.some((a) => a.city.trim() && !a.region)) e.areas = 'Choose the province or state for each area.'
  return e
}

export function contractorBody(f: ContractorFormState): Record<string, unknown> {
  return {
    type: f.type, name: f.name.trim(), contact_name: (f.type === 'individual' ? f.name : f.contact_name).trim(),
    email: f.email.trim(), phone: f.phone.trim(), country: f.country, address_line1: f.address_line1.trim(),
    city: f.city.trim(), region: f.region, postal_code: f.postal_code.trim().toUpperCase(),
    tax_number: f.tax_number.trim() || null, about: f.about.trim() || null, category_ids: f.category_ids,
    areas: f.areas.filter((a) => a.region).map((a) => ({ region: a.region, city: a.city.trim() || null })),
  }
}

/** If the country changes, drop provinces/states that no longer belong. */
export function resetRegions(f: ContractorFormState) {
  const ok = regionsFor(f.country)
  if (!ok.includes(f.region)) f.region = ''
  f.areas = f.areas.filter((a) => ok.includes(a.region))
}

export const statusLabel: Record<ContractorStatus, string> = { pending: 'Pending', approved: 'Approved', suspended: 'Suspended', rejected: 'Rejected' }
export const statusPill: Record<ContractorStatus, string> = { pending: '', approved: 'green', suspended: 'grey', rejected: 'red' }
export const kindLabel: Record<DocKind, string> = { id: 'Photo ID', insurance: 'Insurance', licence: 'Licence', other: 'Other' }
export const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
