import { supabase } from './client'
import type { BrandId, InfoKit } from '../../data/mock'

type InfoKitRow = {
  id: string
  brand_id: BrandId
  package_id: string | null
  name: string
  blurb: string
  subject: string
}

const COLUMNS = 'id, brand_id, package_id, name, blurb, subject'

function toInfoKit(row: InfoKitRow): InfoKit {
  return {
    id: row.id,
    brandId: row.brand_id,
    packageId: row.package_id ?? undefined,
    name: row.name,
    blurb: row.blurb,
    subject: row.subject,
  }
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${base || 'kit'}-${Math.random().toString(36).slice(2, 7)}`
}

export async function fetchInfoKits(): Promise<InfoKit[]> {
  const { data, error } = await supabase.from('info_kits').select(COLUMNS).order('name')
  if (error) throw error
  return (data ?? []).map((row) => toInfoKit(row as InfoKitRow))
}

export async function createInfoKit(kit: {
  brandId: BrandId
  packageId: string | null
  name: string
  blurb: string
  subject: string
}): Promise<InfoKit> {
  const { data, error } = await supabase
    .from('info_kits')
    .insert({
      id: slugify(kit.name),
      brand_id: kit.brandId,
      package_id: kit.packageId,
      name: kit.name,
      blurb: kit.blurb,
      subject: kit.subject,
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toInfoKit(data as InfoKitRow)
}

export async function updateInfoKit(
  id: string,
  patch: { brandId: BrandId; packageId: string | null; name: string; blurb: string; subject: string },
): Promise<void> {
  const { error } = await supabase
    .from('info_kits')
    .update({
      brand_id: patch.brandId,
      package_id: patch.packageId,
      name: patch.name,
      blurb: patch.blurb,
      subject: patch.subject,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteInfoKit(id: string): Promise<void> {
  const { error } = await supabase.from('info_kits').delete().eq('id', id)
  if (error) throw error
}
