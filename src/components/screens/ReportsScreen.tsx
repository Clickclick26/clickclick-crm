import type { Agent } from '../../data/mock'

/**
 * Extracted verbatim from App.tsx's `nav === 'reports'` block. The stats
 * shown here are still hardcoded placeholders (42 calls, 6.2h talk time,
 * etc.) except the "Agents online" count — that was already true before
 * this extraction, not something this change introduced. Real numbers need
 * a call-log backend, which doesn't exist yet (see the Recents/CALLS gap
 * flagged separately).
 */
export function ReportsScreen({ agents }: { agents: Agent[] }) {
  return (
    <div className="lists-view">
      <h2>Today’s numbers</h2>
      <div className="reports-grid">
        <div className="stat">
          <div className="label">Calls</div>
          <div className="value">42</div>
        </div>
        <div className="stat">
          <div className="label">Talk time</div>
          <div className="value">6.2h</div>
        </div>
        <div className="stat">
          <div className="label">Close rate</div>
          <div className="value">18%</div>
        </div>
        <div className="stat">
          <div className="label">Callbacks due</div>
          <div className="value">9</div>
        </div>
        <div className="stat">
          <div className="label">DNC list</div>
          <div className="value">11</div>
        </div>
        <div className="stat">
          <div className="label">Agents online</div>
          <div className="value">{agents.filter((a) => a.online).length}</div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Real stats will come from call logs once Twilio + Supabase are plugged in.
      </p>
    </div>
  )
}
