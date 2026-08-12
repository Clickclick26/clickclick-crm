import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BRANDS, PIPELINE_STAGES, STAGE_LABEL, type BrandId, type Contact, type PipelineStage } from '../../data/mock'

type PipelineColumn = { stage: PipelineStage; label: string; items: Contact[] }

/**
 * Extracted verbatim from App.tsx's `nav === 'pipeline'` block — same
 * markup/classNames, no behavior change. `pipelineColumns` is still computed
 * in App.tsx (it depends on `contacts` + `contactsBrand`, both owned there)
 * and passed in already-grouped, same as before extraction.
 */
export function PipelineScreen({
  contactsBrand,
  onBrandChange,
  pipelineColumns,
  onOpenContact,
  onShiftStage,
  onMoveStage,
}: {
  contactsBrand: BrandId
  onBrandChange: (id: BrandId) => void
  pipelineColumns: PipelineColumn[]
  onOpenContact: (person: Contact) => void
  onShiftStage: (id: string, direction: -1 | 1) => void
  onMoveStage: (id: string, stage: PipelineStage) => void
}) {
  return (
    <div className="lists-view pipeline-view">
      <div className="pipeline-head">
        <h2>Pipeline</h2>
        <p className="muted" style={{ margin: 0 }}>
          Move leads with the arrows or stage pills. Opens dialer on click.
        </p>
      </div>
      <div
        className="tabs contact-filter-tabs"
        title="Sales leads vs CLocal contacts — kept apart on purpose"
      >
        {BRANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`tab ${contactsBrand === b.id ? 'active' : ''}`}
            onClick={() => onBrandChange(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="pipeline-board">
        {pipelineColumns.map((col) => (
          <section key={col.stage} className={`pipeline-col stage-${col.stage}`}>
            <header className="pipeline-col-head">
              <h3>{col.label}</h3>
              <span>{col.items.length}</span>
            </header>
            <div className="pipeline-col-body">
              {col.items.map((person) => (
                <article key={person.id} className="pipeline-card">
                  <button className="pipeline-card-main" onClick={() => onOpenContact(person)}>
                    <img src={person.avatar} alt="" />
                    <div>
                      <strong>{person.name}</strong>
                      <span>{person.company}</span>
                      <em>{person.phone}</em>
                    </div>
                  </button>
                  <div className="pipeline-card-actions">
                    <button
                      className="icon-btn"
                      title="Move back"
                      disabled={col.stage === 'new'}
                      onClick={() => onShiftStage(person.id, -1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Move forward"
                      disabled={col.stage === 'lost'}
                      onClick={() => onShiftStage(person.id, 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="pipeline-stage-pills">
                    {PIPELINE_STAGES.map((stage) => (
                      <button
                        key={stage}
                        className={`mini-stage ${person.stage === stage ? 'active' : ''}`}
                        onClick={() => onMoveStage(person.id, stage)}
                      >
                        {STAGE_LABEL[stage]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {col.items.length === 0 && <p className="pipeline-empty">No one here</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
