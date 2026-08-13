import { useState } from 'react'
import { Plus } from 'lucide-react'
import { BRANDS, INDUSTRY_CATEGORIES, type BrandId, type IndustryCategory } from '../../data/mock'
import { listsForBrand, type CustomList } from '../../lib/contactLists'

export function ContactViews({
  contactsBrand,
  contactFilter,
  customLists,
  dueByBrand,
  categoryFilter,
  onSelectView,
  onAddList,
  onCategoryChange,
}: {
  contactsBrand: BrandId
  contactFilter: string
  customLists: CustomList[]
  dueByBrand: Record<BrandId, number>
  categoryFilter: 'all' | IndustryCategory
  onSelectView: (brand: BrandId, filter: string) => void
  onAddList: (brand: BrandId, label: string) => void
  onCategoryChange: (value: 'all' | IndustryCategory) => void
}) {
  const [addingFor, setAddingFor] = useState<BrandId | null>(null)
  const [draft, setDraft] = useState('')

  function submitNew(brand: BrandId) {
    onAddList(brand, draft)
    setDraft('')
    setAddingFor(null)
  }

  return (
    <div className="contact-views">
      {BRANDS.map((brand) => {
        const lists = listsForBrand(brand.id, customLists)
        const due = dueByBrand[brand.id] ?? 0
        return (
          <div key={brand.id} className="contact-views-group">
            <p className="contact-views-heading">{brand.label}</p>
            <button
              type="button"
              className={`view-row ${contactsBrand === brand.id && contactFilter === 'all' ? 'active' : ''}`}
              onClick={() => onSelectView(brand.id, 'all')}
            >
              All
            </button>
            {due > 0 && (
              <button
                type="button"
                className={`view-row view-row-due ${contactsBrand === brand.id && contactFilter === 'due' ? 'active' : ''}`}
                onClick={() => onSelectView(brand.id, 'due')}
              >
                Due
                <span>{due}</span>
              </button>
            )}
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                className={`view-row ${contactsBrand === brand.id && contactFilter === list.id ? 'active' : ''}`}
                onClick={() => onSelectView(brand.id, list.id)}
              >
                {list.label}
              </button>
            ))}
            {addingFor === brand.id ? (
              <form
                className="view-add-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  submitNew(brand.id)
                }}
              >
                <input
                  className="followup-date"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="List name"
                  autoFocus
                />
                <button type="submit" className="link-btn">
                  Add
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAddingFor(null)
                    setDraft('')
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="view-add"
                onClick={() => {
                  setAddingFor(brand.id)
                  setDraft('')
                }}
              >
                <Plus size={12} />
                New list
              </button>
            )}
          </div>
        )
      })}
      {contactsBrand === 'clocal' && (
        <label className="view-category">
          Category
          <select
            className="followup-date"
            value={categoryFilter}
            onChange={(e) =>
              onCategoryChange((e.target.value || 'all') as 'all' | IndustryCategory)
            }
          >
            <option value="all">All categories</option>
            {INDUSTRY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
