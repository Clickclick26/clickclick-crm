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
 * (Gemini + Google Search grounding, server-side). Review-only — this
 * never writes to the database; the caller decides whether to use what
 * comes back.
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
