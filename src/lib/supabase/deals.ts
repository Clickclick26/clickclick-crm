import { supabase } from './client'
import type { BrandId, DealStatus, PayType } from '../../data/mock'

export type Deal = {
  id: string
  contactId: string
  brandId: BrandId
  packageIds: string[]
  payType: PayType
  status: DealStatus
  clientName: string
  company: string
  startDate: string
  endDate: string
  totalPrice: string
  depositAmount: string
  monthlyAmount: string
  customNotes: string
}

export type DealInput = {
  contactId: string
  agentId: string | null
  brandId: BrandId
  packageIds: string[]
  payType: PayType
  status: DealStatus
  clientName: string
  company: string
  startDate: string
  endDate: string
  totalPrice: string
  depositAmount: string
  monthlyAmount: string
  customNotes: string
}

type DealRow = {
  id: string
  contact_id: string | null
  brand_id: BrandId
  package_ids: string[]
  pay_type: PayType
  status: DealStatus
  client_name: string
  company: string
  start_date: string | null
  end_date: string | null
  total_price: number | null
  deposit_amount: number | null
  monthly_amount: number | null
  custom_notes: string
}

const COLUMNS =
  'id, contact_id, brand_id, package_ids, pay_type, status, client_name, company, start_date, end_date, total_price, deposit_amount, monthly_amount, custom_notes'

function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    contactId: row.contact_id ?? '',
    brandId: row.brand_id,
    packageIds: row.package_ids,
    payType: row.pay_type,
    status: row.status,
    clientName: row.client_name,
    company: row.company,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    totalPrice: row.total_price != null ? String(row.total_price) : '',
    depositAmount: row.deposit_amount != null ? String(row.deposit_amount) : '',
    monthlyAmount: row.monthly_amount != null ? String(row.monthly_amount) : '',
    customNotes: row.custom_notes,
  }
}

function toRowPatch(input: Partial<DealInput>) {
  const row: Partial<{
    contact_id: string
    agent_id: string | null
    brand_id: BrandId
    package_ids: string[]
    pay_type: PayType
    status: DealStatus
    client_name: string
    company: string
    start_date: string | null
    end_date: string | null
    total_price: number | null
    deposit_amount: number | null
    monthly_amount: number | null
    custom_notes: string
  }> = {}
  if (input.contactId !== undefined) row.contact_id = input.contactId
  if (input.agentId !== undefined) row.agent_id = input.agentId
  if (input.brandId !== undefined) row.brand_id = input.brandId
  if (input.packageIds !== undefined) row.package_ids = input.packageIds
  if (input.payType !== undefined) row.pay_type = input.payType
  if (input.status !== undefined) row.status = input.status
  if (input.clientName !== undefined) row.client_name = input.clientName
  if (input.company !== undefined) row.company = input.company
  if (input.startDate !== undefined) row.start_date = input.startDate || null
  if (input.endDate !== undefined) row.end_date = input.endDate || null
  if (input.totalPrice !== undefined)
    row.total_price = input.totalPrice === '' ? null : Number(input.totalPrice)
  if (input.depositAmount !== undefined)
    row.deposit_amount = input.depositAmount === '' ? null : Number(input.depositAmount)
  if (input.monthlyAmount !== undefined)
    row.monthly_amount = input.monthlyAmount === '' ? null : Number(input.monthlyAmount)
  if (input.customNotes !== undefined) row.custom_notes = input.customNotes
  return row
}

// The CRM shows one in-progress deal per contact today, so the most recent row is "the" deal.
export async function fetchDealForContact(contactId: string): Promise<Deal | null> {
  const { data, error } = await supabase
    .from('deals')
    .select(COLUMNS)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? toDeal(data as DealRow) : null
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .insert(toRowPatch(input))
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toDeal(data as DealRow)
}

export async function updateDeal(id: string, patch: Partial<DealInput>): Promise<void> {
  const { error } = await supabase.from('deals').update(toRowPatch(patch)).eq('id', id)
  if (error) throw error
}
