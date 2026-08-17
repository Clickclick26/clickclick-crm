import { supabase } from './client'
import type { BrandId } from '../../data/mock'

export type ContactLookupResult =
  | { configured: false; message: string }
  | {
      configured: true
      found: boolean
      ownerName: string | null
      phone: string | null
      email: string | null
      confidence: 'high' | 'medium' | 'low'
      source: string | null
      note: string | null
    }

/**
 * AI lookup for a business's likely owner/contact name and phone number
 * (Gemini, server-side — no live search, see the edge function's header
 * comment for why). Review-only — this never writes to the database; the
 * caller decides whether to use what comes back.
 */
export async function lookupContactInfo(opts: {
  company: string
  locality?: string
  brand: BrandId
}): Promise<ContactLookupResult> {
  const { data, error } = await supabase.functions.invoke('lookup-contact-info', {
    body: { company: opts.company, locality: opts.locality, brand: opts.brand },
  })
  if (error) throw error
  return data as ContactLookupResult
}

export type CompanyAskResult =
  | { configured: false; message: string }
  | { configured: true; answer: string }

/** Free-form "ask AI about this company" — same no-search, no-inventing deal as lookupContactInfo. */
export async function askAboutCompany(opts: {
  company: string
  locality?: string
  brand: BrandId
  question: string
}): Promise<CompanyAskResult> {
  const { data, error } = await supabase.functions.invoke('ask-about-company', {
    body: {
      company: opts.company,
      locality: opts.locality,
      brand: opts.brand,
      question: opts.question,
    },
  })
  if (error) throw error
  return data as CompanyAskResult
}
