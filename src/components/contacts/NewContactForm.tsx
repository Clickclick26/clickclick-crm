import { useEffect, useState } from 'react'
import {
  BRANDS,
  INDUSTRY_CATEGORIES,
  REGION_LABEL,
  type BrandId,
  type IndustryCategory,
  type PhoneRegion,
} from '../../data/mock'
import {
  loadNewContactDraft,
  saveNewContactDraft,
  clearNewContactDraft,
} from '../../lib/sessionPlace'
import { listsForBrand, type CustomList } from '../../lib/contactLists'
import { PERSON_ROLES, type ExtraPerson, type PersonRole } from '../../lib/people'
import { ExtraPeopleFields } from './ExtraPeopleFields'
import { firstHttpUrl } from '../../lib/linkedin'
import { lookupContactInfo, type ContactLookupResult } from '../../lib/supabase/lookup'

export type NewContactDraft = {
  name: string
  personRole: PersonRole
  extraPeople: ExtraPerson[]
  company: string
  email: string
  phone: string
  linkedinUrl: string
  location: string
  region: PhoneRegion
  brandId: BrandId
  industry: IndustryCategory | null
  nextCallback: string
  tags: string[]
  notes: string
}

export function NewContactForm({
  defaultBrand,
  defaultTags,
  customLists,
  saving,
  onSave,
  onCancel,
}: {
  defaultBrand: BrandId
  defaultTags: string[]
  customLists: CustomList[]
  saving: boolean
  onSave: (draft: NewContactDraft, addAnother: boolean) => Promise<boolean>
  onCancel: () => void
}) {
  const saved = loadNewContactDraft<NewContactDraft>()
  const allowed = new Set(listsForBrand(saved?.brandId ?? defaultBrand, customLists).map((l) => l.id))
  const [name, setName] = useState(saved?.name ?? '')
  const [personRole, setPersonRole] = useState<PersonRole>(saved?.personRole ?? 'main')
  const [extraPeople, setExtraPeople] = useState<ExtraPerson[]>(saved?.extraPeople ?? [])
  const [company, setCompany] = useState(saved?.company ?? '')
  const [email, setEmail] = useState(saved?.email ?? '')
  const [phone, setPhone] = useState(saved?.phone ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(saved?.linkedinUrl ?? '')
  const [location, setLocation] = useState(saved?.location ?? '')
  const [region, setRegion] = useState<PhoneRegion>(saved?.region ?? 'other')
  const [brandId, setBrandId] = useState<BrandId>(saved?.brandId ?? defaultBrand)
  const [industry, setIndustry] = useState<IndustryCategory | null>(saved?.industry ?? null)
  const [nextCallback, setNextCallback] = useState(saved?.nextCallback ?? '')
  const [tags, setTags] = useState<string[]>(
    saved?.tags?.filter((t) => allowed.has(t)) ?? defaultTags.filter((t) => allowed.has(t)),
  )
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [looking, setLooking] = useState(false)
  const [lookupResult, setLookupResult] = useState<ContactLookupResult | null>(null)
  const [lookupErr, setLookupErr] = useState('')

  const lists = listsForBrand(brandId, customLists)

  async function runLookup() {
    if (!company.trim() || looking) return
    setLooking(true)
    setLookupErr('')
    setLookupResult(null)
    try {
      const result = await lookupContactInfo({
        company: company.trim(),
        locality: location.trim(),
        brand: brandId,
      })
      setLookupResult(result)
    } catch (err) {
      console.error('AI lookup failed', err)
      setLookupErr(err instanceof Error ? err.message : 'Lookup failed — try again.')
    } finally {
      setLooking(false)
    }
  }

  function useLookupResult() {
    if (!lookupResult || !lookupResult.configured) return
    if (!name.trim() && lookupResult.ownerName) setName(lookupResult.ownerName)
    if (!phone.trim() && lookupResult.phone) setPhone(lookupResult.phone)
    if (!email.trim() && lookupResult.email) setEmail(lookupResult.email)
    setLookupResult(null)
  }

  const liveDraft: NewContactDraft = {
    name,
    personRole,
    extraPeople,
    company,
    email,
    phone,
    linkedinUrl,
    location,
    region,
    brandId,
    industry,
    nextCallback,
    tags,
    notes,
  }

  useEffect(() => {
    saveNewContactDraft(liveDraft)
  }, [liveDraft])

  function resetFields() {
    setName('')
    setPersonRole('main')
    setExtraPeople([])
    setCompany('')
    setEmail('')
    setPhone('')
    setLinkedinUrl('')
    setLocation('')
    setRegion('other')
    setIndustry(null)
    setNextCallback('')
    setNotes('')
    clearNewContactDraft()
  }

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      if (id === 'replied') return next.filter((t) => t !== 'warmed')
      if (id === 'warmed') return next.filter((t) => t !== 'replied')
      return next
    })
  }

  async function submit(addAnother: boolean) {
    const draft: NewContactDraft = {
      name: name.trim(),
      personRole,
      extraPeople,
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      linkedinUrl: firstHttpUrl(linkedinUrl),
      location: location.trim(),
      region,
      brandId,
      industry,
      nextCallback,
      tags,
      notes: notes.trim(),
    }
    const ok = await onSave(draft, addAnother)
    if (!ok) return
    if (addAnother) resetFields()
    else clearNewContactDraft()
  }

  return (
    <div className="card new-contact-card">
      <h3 style={{ marginTop: 0 }}>New contact</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Add someone by hand — LinkedIn, a call, whoever. Phone numbers start as not
        screened, so you can’t call them until TPS/CTPS is checked.
      </p>

      <div className="new-contact-row">
        <label className="new-contact-field">
          Name
          <input
            className="followup-date"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The person's name"
            autoFocus
          />
        </label>
        <label className="new-contact-field">
          Role
          <select
            className="followup-date"
            value={personRole}
            onChange={(e) => setPersonRole(e.target.value as PersonRole)}
          >
            {PERSON_ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ExtraPeopleFields people={extraPeople} onChange={setExtraPeople} />
      <label className="new-contact-field">
        Company
        <input
          className="followup-date"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value)
            setLookupResult(null)
          }}
          placeholder="Optional"
        />
      </label>

      <div className="new-contact-field">
        <button
          type="button"
          className="btn ghost"
          disabled={!company.trim() || looking}
          onClick={() => void runLookup()}
        >
          {looking ? 'Guessing…' : 'AI guess: owner & phone'}
        </button>
        <span className="help" style={{ display: 'block', fontSize: '0.76rem', marginTop: 2 }}>
          Not a live search — it's Gemini's memory, so it can be wrong or blank. Always double-check.
        </span>
        {lookupErr && (
          <p className="muted" style={{ color: 'var(--pink)', marginBottom: 0 }}>
            {lookupErr}
          </p>
        )}
        {lookupResult && !lookupResult.configured && (
          <p className="muted" style={{ marginBottom: 0 }}>{lookupResult.message}</p>
        )}
        {lookupResult && lookupResult.configured && !lookupResult.found && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Didn’t recognise this business — nothing to go on.
            {lookupResult.note ? ` ${lookupResult.note}` : ''}
          </p>
        )}
        {lookupResult && lookupResult.configured && lookupResult.found && (
          <div className="lookup-result">
            <p className="muted" style={{ marginTop: 0, marginBottom: 6 }}>
              Unverified AI guess, not searched — check before saving. Confidence:{' '}
              {lookupResult.confidence}
              {lookupResult.source ? ` · recalled from: ${lookupResult.source}` : ''}
            </p>
            <p style={{ margin: '0 0 4px' }}>
              {lookupResult.ownerName ?? '—'}
              {lookupResult.phone ? ` · ${lookupResult.phone}` : ''}
              {lookupResult.email ? ` · ${lookupResult.email}` : ''}
            </p>
            {lookupResult.note && (
              <p className="muted" style={{ marginTop: 0 }}>{lookupResult.note}</p>
            )}
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={useLookupResult}>
                Use this
              </button>
              <button type="button" className="btn ghost" onClick={() => setLookupResult(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="new-contact-row">
        <label className="new-contact-field">
          Location
          <input
            className="followup-date"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Lisburn Road, Belfast"
          />
        </label>
        <label className="new-contact-field">
          Area
          <span className="help" style={{ display: 'block', fontSize: '0.76rem' }}>
            Matches a local caller ID on the dialer
          </span>
          <select
            className="followup-date"
            value={region}
            onChange={(e) => setRegion(e.target.value as PhoneRegion)}
          >
            {(Object.keys(REGION_LABEL) as PhoneRegion[]).map((r) => (
              <option key={r} value={r}>
                {REGION_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="new-contact-row">
        <label className="new-contact-field">
          Email
          <input
            className="followup-date"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="new-contact-field">
          Phone
          <input
            className="followup-date"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      <label className="new-contact-field">
        LinkedIn
        <input
          className="followup-date"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/…"
        />
      </label>

      <div className="new-contact-field">
        <span>Brand</span>
        <div className="tabs" style={{ marginTop: 6 }}>
          {BRANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`tab ${brandId === b.id ? 'active' : ''}`}
              onClick={() => {
                setBrandId(b.id)
                const keep = new Set(listsForBrand(b.id, customLists).map((l) => l.id))
                setTags((prev) => prev.filter((t) => keep.has(t)))
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {brandId === 'clocal' && (
        <label className="new-contact-field">
          Category
          <select
            className="followup-date"
            value={industry ?? ''}
            onChange={(e) => setIndustry((e.target.value || null) as IndustryCategory | null)}
          >
            <option value="">— Uncategorised —</option>
            {INDUSTRY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="new-contact-field">
        Follow-up
        <input
          type="date"
          className="followup-date"
          value={nextCallback}
          onChange={(e) => setNextCallback(e.target.value)}
        />
      </label>

      <div className="new-contact-field">
        <span>Lists</span>
        <div className="list-picks">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              className={`outcome-btn ${tags.includes(list.id) ? 'active' : ''}`}
              onClick={() => toggleTag(list.id)}
            >
              {list.label}
            </button>
          ))}
        </div>
      </div>

      <label className="new-contact-field">
        Notes
        <textarea
          className="notes-box"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why you’re adding them, what you saw on LinkedIn…"
        />
      </label>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn primary"
          disabled={saving || !name.trim()}
          onClick={() => {
            if (!name.trim()) return
            void submit(false)
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={saving || !name.trim()}
          onClick={() => {
            if (!name.trim()) return
            void submit(true)
          }}
        >
          Save & add another
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={saving}
          onClick={() => {
            clearNewContactDraft()
            onCancel()
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
