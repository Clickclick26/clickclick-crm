import { ExternalLink, Plus, X } from 'lucide-react'
import {
  PERSON_ROLES,
  type ExtraPerson,
  type PersonRole,
} from '../../lib/people'
import { firstHttpUrl } from '../../lib/linkedin'

export function ExtraPeopleFields({
  people,
  onChange,
  onCommit,
}: {
  people: ExtraPerson[]
  onChange: (next: ExtraPerson[]) => void
  onCommit?: (next: ExtraPerson[]) => void
}) {
  function update(index: number, patch: Partial<ExtraPerson>, commit = false) {
    const next = people.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange(next)
    if (commit) onCommit?.(next)
  }

  function setAll(next: ExtraPerson[]) {
    onChange(next)
    onCommit?.(next)
  }

  function add(role: PersonRole) {
    // Don't save a blank row — wait until they type a name.
    onChange([...people, { name: '', role }])
  }

  return (
    <div className="new-contact-field">
      <span>Other people</span>
      <p className="muted" style={{ margin: '4px 0 8px', fontSize: '0.72rem' }}>
        Co-founders, other decision makers, anyone else at the company.
      </p>
      {people.map((person, index) => (
        <div key={index} className="person-block">
          <div className="person-row">
            <select
              className="followup-date"
              value={person.role}
              onChange={(e) => update(index, { role: e.target.value as PersonRole }, true)}
              aria-label="Role"
            >
              {PERSON_ROLES.filter((r) => r.id !== 'main').map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
            <input
              className="followup-date"
              value={person.name}
              onChange={(e) => update(index, { name: e.target.value })}
              onBlur={(e) => {
                const next = people.map((p, i) =>
                  i === index ? { ...p, name: e.target.value } : p,
                )
                onChange(next)
                onCommit?.(next)
              }}
              placeholder="Name"
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove person"
              onClick={() => setAll(people.filter((_, i) => i !== index))}
            >
              <X size={14} />
            </button>
          </div>
          <div className="person-linkedin-row">
            <input
              className="followup-date"
              value={person.linkedinUrl ?? ''}
              onChange={(e) => update(index, { linkedinUrl: e.target.value })}
              onBlur={(e) => {
                const url = firstHttpUrl(e.target.value)
                const next = people.map((p, i) => (i === index ? { ...p, linkedinUrl: url } : p))
                onChange(next)
                onCommit?.(next)
              }}
              placeholder={`${person.name || 'Their'} LinkedIn — https://linkedin.com/in/…`}
              aria-label={`LinkedIn for ${person.name || 'this person'}`}
            />
            {person.linkedinUrl ? (
              <a
                className="icon-btn"
                href={person.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${person.name || 'their'} LinkedIn`}
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      ))}
      <div className="list-picks">
        <button
          type="button"
          className="outcome-btn"
          onClick={() => add('co-founder')}
        >
          <Plus size={12} /> Co-founder
        </button>
        <button
          type="button"
          className="outcome-btn"
          onClick={() => add('decision-maker')}
        >
          <Plus size={12} /> Decision maker
        </button>
        <button
          type="button"
          className="outcome-btn"
          onClick={() => add('other')}
        >
          <Plus size={12} /> Other
        </button>
      </div>
    </div>
  )
}
