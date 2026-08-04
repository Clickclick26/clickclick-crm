import { supabase } from './client'

export type ReferralStatus = 'pending' | 'referred' | 'won' | 'rewarded' | 'expired'
export type ReferralRewardType = 'discount_percent' | 'discount_amount' | 'cash' | 'credit'

export type Referral = {
  id: string
  code: string
  referrerContactId: string
  referredContactId: string | null
  referredDealId: string | null
  status: ReferralStatus
  rewardType: ReferralRewardType | null
  rewardValue: number | null
  notes: string
  createdAt: string
}

type ReferralRow = {
  id: string
  code: string
  referrer_contact_id: string
  referred_contact_id: string | null
  referred_deal_id: string | null
  status: ReferralStatus
  reward_type: ReferralRewardType | null
  reward_value: number | null
  notes: string
  created_at: string
}

const COLUMNS =
  'id, code, referrer_contact_id, referred_contact_id, referred_deal_id, status, reward_type, reward_value, notes, created_at'

function toReferral(row: ReferralRow): Referral {
  return {
    id: row.id,
    code: row.code,
    referrerContactId: row.referrer_contact_id,
    referredContactId: row.referred_contact_id,
    referredDealId: row.referred_deal_id,
    status: row.status,
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function fetchReferrals(): Promise<Referral[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => toReferral(row as ReferralRow))
}

export async function createReferral(referrerContactId: string): Promise<Referral> {
  const { data, error } = await supabase
    .from('referrals')
    .insert({ referrer_contact_id: referrerContactId })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toReferral(data as ReferralRow)
}

// Links an existing referral code to the new lead who came in through it.
// Fails if the code doesn't exist or has already been redeemed.
export async function redeemReferralCode(code: string, referredContactId: string): Promise<Referral> {
  const { data, error } = await supabase
    .from('referrals')
    .update({ referred_contact_id: referredContactId, status: 'referred' })
    .eq('code', code.trim().toUpperCase())
    .is('referred_contact_id', null)
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toReferral(data as ReferralRow)
}

export async function updateReferralStatus(id: string, status: ReferralStatus): Promise<void> {
  const { error } = await supabase.from('referrals').update({ status }).eq('id', id)
  if (error) throw error
}
