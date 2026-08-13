import { useState } from 'react'
import { BRANDS, type BrandId } from '../../data/mock'
import { listsForBrand, type CustomList } from '../../lib/contactLists'

export type NewContactDraft = {
  name: string
  company: string
  email: string
  phone: string
  linkedinUrl: string
  brandId: BrandId
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
  onSave: (draft: NewContactDraft, addAnother: boolean) => Promise<void>
  onCancel: () => void
}) {
  const allowed = new Set(listsForBrand(defaultBrand, customLists).map((l) => l.id))
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [brandId, setBrandId] = useState<BrandId>(defaultBrand)
  const [tags, setTags] = useState<string[]>(defaultTags.filter((t) => allowed.has(t)))
  const [notes, setNotes] = useState('')

  const lists = listsForBrand(brandId, customLists)

  function resetFields() {
    setName('')
    setCompany('')
    setEmail('')
    setPhone('')
    setLinkedinUrl('')
    setNotes('')
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
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      linkedinUrl: linkedinUrl.trim(),
      brandId,
      tags,
      notes: notes.trim(),
    }
    await onSave(draft, addAnother)
    if (addAnother) resetFields()
  }

  return (
    <div className="card new-contact-card">
      <h3 style={{ marginTop: 0 }}>New contact</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Add someone by hand — LinkedIn, a call, whoever. Phone numbers start as not
        screened, so you can’t call them until TPS/CTPS is checked.
      </p>

      <label className="new-contact-field">
        Name
        <input
          className="followup-date"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          autoFocus
        />
      </label>
      <label className="new-contact-field">
        Company
        <input
          className="followup-date"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Optional"
        />
      </label>
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
          disabled={saving}
          onClick={() => void submit(false)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={saving}
          onClick={() => void submit(true)}
        >
          Save & add another
        </button>
        <button type="button" className="btn ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
