import { useEffect, useMemo, useState } from 'react'
import {
  Phone,
  Clock3,
  Users,
  ListChecks,
  BarChart3,
  Settings,
  Search,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Mail,
  Headphones,
  CircleDot,
  Shield,
  Ban,
  CalendarClock,
  FileSignature,
  CreditCard,
  Landmark,
  Columns3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  AGENTS,
  BRANDS,
  CALLS,
  CONTACTS,
  CONTRACT_TEMPLATES,
  CURRENT_USER,
  DEAL_STATUS_LABEL,
  DIALER_LISTS,
  OBJECTIONS,
  OUTCOME_LABEL,
  OUTBOUND_NUMBERS,
  PACKAGES,
  PAY_TYPES,
  REGION_LABEL,
  SCRIPT,
  STAGE_LABEL,
  contactById as contactByIdStatic,
  fillScript,
  pickBestOutboundNumber,
  type BrandId,
  type CallOutcome,
  type CallRecord,
  type Contact,
  type ContractTemplate,
  type DealStatus,
  type PayType,
  type PipelineStage,
} from './data/mock'

type NavId =
  | 'dialer'
  | 'recents'
  | 'contacts'
  | 'pipeline'
  | 'lists'
  | 'reports'
  | 'settings'

const PIPELINE_STAGES: PipelineStage[] = ['new', 'talking', 'proposal', 'won', 'lost']

const WAVE = [28, 55, 40, 72, 35, 80, 48, 62, 30, 70, 45, 85, 38, 60, 50, 75, 42, 68, 33, 58]

function statusLabel(status: CallRecord['status']) {
  if (status === 'missed') return 'Missed Call'
  if (status === 'inbound') return 'Inbound Call'
  return 'Outbound Call'
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const [nav, setNav] = useState<NavId>('recents')
  const [filter, setFilter] = useState<'all' | 'missed'>('all')
  const [query, setQuery] = useState('')
  const [selectedCallId, setSelectedCallId] = useState(CALLS[0].id)
  const [selectedContactId, setSelectedContactId] = useState(CALLS[0].contactId)
  const [notes, setNotes] = useState(() => CONTACTS[0].notes)
  const [activeObjection, setActiveObjection] = useState<string | null>(null)
  const [onCall, setOnCall] = useState(false)
  const [muted, setMuted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [listeningIn, setListeningIn] = useState(false)
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [emailSubject, setEmailSubject] = useState('Quick follow-up from ClickClick')
  const [emailBody, setEmailBody] = useState('')
  const [activeList, setActiveList] = useState(DIALER_LISTS[0].id)
  const [dealBrand, setDealBrand] = useState<BrandId>('clickclick')
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['cc-starter'])
  const [payType, setPayType] = useState<PayType>('monthly')
  const [dealStatus, setDealStatus] = useState<DealStatus>('draft')
  const [clientName, setClientName] = useState(CONTACTS[0].name)
  const [companyName, setCompanyName] = useState(CONTACTS[0].company)
  const [startDate, setStartDate] = useState('2026-08-10')
  const [endDate, setEndDate] = useState('2027-08-09')
  const [totalPrice, setTotalPrice] = useState('1500')
  const [depositAmount, setDepositAmount] = useState('500')
  const [monthlyAmount, setMonthlyAmount] = useState('299')
  const [customNotes, setCustomNotes] = useState('')
  const [scriptScope, setScriptScope] = useState<'everyone' | string>('everyone')
  const [defaultScriptTitle, setDefaultScriptTitle] = useState(SCRIPT.title)
  const [defaultScriptBody, setDefaultScriptBody] = useState(SCRIPT.body)
  const [agentScripts, setAgentScripts] = useState<Record<string, { title: string; body: string }>>(
    {},
  )
  const [editScriptTitle, setEditScriptTitle] = useState(SCRIPT.title)
  const [editScriptBody, setEditScriptBody] = useState(SCRIPT.body)
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>(CONTRACT_TEMPLATES)
  const [selectedTemplateId, setSelectedTemplateId] = useState(CONTRACT_TEMPLATES[0].id)
  const [editTemplateBody, setEditTemplateBody] = useState(CONTRACT_TEMPLATES[0].body)
  const [editTemplateName, setEditTemplateName] = useState(CONTRACT_TEMPLATES[0].name)
  const [settingsTab, setSettingsTab] = useState<'scripts' | 'contracts' | 'connect'>('scripts')
  const [fromMode, setFromMode] = useState<'auto' | 'manual'>('auto')
  const [manualFromId, setManualFromId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>(CONTACTS)

  function contactById(id: string) {
    return contacts.find((c) => c.id === id) ?? contactByIdStatic(id)
  }

  const selectedCall = CALLS.find((c) => c.id === selectedCallId) ?? CALLS[0]
  const contact =
    contactById(selectedContactId) ?? contactById(selectedCall.contactId) ?? CONTACTS[0]

  const liveAgent = AGENTS.find((a) => a.onCallWith)

  const brandPackages = useMemo(
    () => PACKAGES.filter((p) => p.brandId === dealBrand),
    [dealBrand],
  )

  const fromPick = useMemo(
    () =>
      pickBestOutboundNumber({
        contact,
        brandId: dealBrand,
        agent: CURRENT_USER,
        mode: fromMode,
        manualNumberId: manualFromId,
      }),
    [contact, dealBrand, fromMode, manualFromId],
  )

  const selectableFromNumbers = useMemo(() => {
    const mine = OUTBOUND_NUMBERS.filter((n) => n.agentId === CURRENT_USER.id)
    const brandLines = OUTBOUND_NUMBERS.filter(
      (n) => n.brandId === dealBrand && n.kind !== 'personal',
    )
    return [...mine, ...brandLines]
  }, [dealBrand])

  useEffect(() => {
    // When lead or brand changes in Auto, clear a stale manual pick
    if (fromMode === 'auto') setManualFromId(null)
  }, [contact.id, dealBrand, fromMode])

  useEffect(() => {
    setClientName(contact.name)
    setCompanyName(contact.company)
  }, [contact.id, contact.name, contact.company])

  useEffect(() => {
    const first = PACKAGES.find((p) => p.brandId === dealBrand)
    if (!first) return
    setSelectedPackages([first.id])
    setTotalPrice(String(first.defaultPrice))
    setMonthlyAmount(String(first.defaultMonthly ?? Math.round(first.defaultPrice / 5)))
    setDepositAmount(String(Math.round(first.defaultPrice * 0.3)))
    setDealStatus('draft')
  }, [dealBrand])

  function togglePackage(id: string) {
    setSelectedPackages((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      const picked = PACKAGES.filter((p) => next.includes(p.id))
      if (picked.length) {
        const total = picked.reduce((sum, p) => sum + p.defaultPrice, 0)
        const monthly = picked.reduce((sum, p) => sum + (p.defaultMonthly ?? 0), 0)
        setTotalPrice(String(total))
        setMonthlyAmount(String(monthly || Math.round(total / 5)))
        setDepositAmount(String(Math.round(total * 0.3)))
      }
      return next
    })
  }

  function sendContract() {
    if (!selectedPackages.length) {
      showToast('Pick at least one package.')
      return
    }
    setDealStatus('contract_sent')
    showToast('Contract emailed via Lark · sign link included (mock).')
    window.setTimeout(() => {
      setDealStatus('signed')
      showToast('Signed! PDF saved to secure storage (mock).')
    }, 1600)
  }

  function sendPayLink() {
    if (dealStatus === 'draft' || dealStatus === 'contract_sent') {
      showToast('Get the contract signed first (or send both).')
    }
    if (payType === 'direct_debit') {
      setDealStatus('pay_sent')
      showToast('GoCardless Direct Debit link sent by Lark (mock).')
      return
    }
    if (payType === 'deposit') {
      setDealStatus('pay_sent')
      showToast(`Stripe deposit link £${depositAmount} sent (mock).`)
      window.setTimeout(() => setDealStatus('deposit_paid'), 1400)
      return
    }
    if (payType === 'monthly') {
      setDealStatus('pay_sent')
      showToast(`Stripe monthly £${monthlyAmount}/mo link sent (mock).`)
      window.setTimeout(() => setDealStatus('active'), 1400)
      return
    }
    setDealStatus('pay_sent')
    showToast(`Stripe one-off £${totalPrice} link sent (mock).`)
    window.setTimeout(() => setDealStatus('closed'), 1400)
  }

  function markCommissionReady() {
    setDealStatus('closed')
    setOutcome('sold')
    showToast(`Sale logged for ${CURRENT_USER.name} · commission record saved (mock).`)
  }

  const filteredCalls = useMemo(() => {
    return CALLS.filter((c) => {
      if (filter === 'missed' && c.status !== 'missed') return false
      const person = contactById(c.contactId)
      const hay = `${c.phone} ${person?.name ?? ''} ${person?.company ?? ''}`.toLowerCase()
      return hay.includes(query.toLowerCase())
    })
  }, [filter, query])

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const hay = `${c.name} ${c.company} ${c.phone} ${c.email}`.toLowerCase()
      return hay.includes(query.toLowerCase())
    })
  }, [contacts, query])

  const pipelineColumns = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      label: STAGE_LABEL[stage],
      items: contacts.filter((c) => c.stage === stage),
    }))
  }, [contacts])

  const activeScript = useMemo(() => {
    const override = agentScripts[CURRENT_USER.id]
    if (override) return override
    return { title: defaultScriptTitle, body: defaultScriptBody }
  }, [agentScripts, defaultScriptBody, defaultScriptTitle])

  const scriptText = useMemo(() => {
    if (activeObjection) {
      const obj = OBJECTIONS.find((o) => o.id === activeObjection)
      return obj?.reply ?? ''
    }
    return fillScript(activeScript.body, contact, CURRENT_USER.name)
  }, [activeObjection, activeScript.body, contact])

  const selectedTemplate =
    contractTemplates.find((t) => t.id === selectedTemplateId) ?? contractTemplates[0]

  function loadScriptScope(scope: 'everyone' | string) {
    setScriptScope(scope)
    if (scope === 'everyone') {
      setEditScriptTitle(defaultScriptTitle)
      setEditScriptBody(defaultScriptBody)
      return
    }
    const custom = agentScripts[scope]
    setEditScriptTitle(custom?.title ?? defaultScriptTitle)
    setEditScriptBody(custom?.body ?? defaultScriptBody)
  }

  function saveScript() {
    if (scriptScope === 'everyone') {
      setDefaultScriptTitle(editScriptTitle)
      setDefaultScriptBody(editScriptBody)
      showToast('Default script saved for everyone.')
      return
    }
    setAgentScripts((prev) => ({
      ...prev,
      [scriptScope]: { title: editScriptTitle, body: editScriptBody },
    }))
    const agent = AGENTS.find((a) => a.id === scriptScope)
    showToast(`Script saved for ${agent?.name ?? 'agent'} only.`)
  }

  function applyScriptToAllAgents() {
    setDefaultScriptTitle(editScriptTitle)
    setDefaultScriptBody(editScriptBody)
    setAgentScripts({})
    setScriptScope('everyone')
    showToast('Bulk applied — all agents use this script now.')
  }

  function selectContractTemplate(id: string) {
    const t = contractTemplates.find((x) => x.id === id)
    if (!t) return
    setSelectedTemplateId(id)
    setEditTemplateName(t.name)
    setEditTemplateBody(t.body)
  }

  function saveContractTemplate() {
    setContractTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId
          ? { ...t, name: editTemplateName, body: editTemplateBody }
          : t,
      ),
    )
    showToast('Contract template saved (mock).')
  }

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  function selectCall(call: CallRecord) {
    setSelectedCallId(call.id)
    setSelectedContactId(call.contactId)
    const person = contactById(call.contactId)
    if (person) {
      setNotes(person.notes)
      setEmailBody(
        `Hi ${person.name.split(' ')[0]},\n\nGreat speaking — here’s a short follow-up from ClickClick.\n\nBest,\n${CURRENT_USER.name}`,
      )
    }
    setActiveObjection(null)
    setOutcome(call.outcome ?? null)
    setNav('recents')
  }

  function selectContact(person: Contact) {
    setSelectedContactId(person.id)
    setNotes(person.notes)
    setEmailBody(
      `Hi ${person.name.split(' ')[0]},\n\nGreat speaking — here’s a short follow-up from ClickClick.\n\nBest,\n${CURRENT_USER.name}`,
    )
    setActiveObjection(null)
    const related = CALLS.find((c) => c.contactId === person.id)
    if (related) {
      setSelectedCallId(related.id)
      setOutcome(related.outcome ?? null)
    }
    setNav('contacts')
  }

  function startCall() {
    if (contact.doNotCall) {
      showToast('This number is on Do Not Call. Call blocked.')
      return
    }
    setOnCall(true)
    setRecording(true)
    setActiveObjection(null)
    showToast(
      `Calling from ${fromPick.number.display} · ${fromPick.reason}`,
    )
  }

  function endCall() {
    setOnCall(false)
    setMuted(false)
    showToast(outcome ? `Call ended · marked ${OUTCOME_LABEL[outcome]}` : 'Call ended')
  }

  function sendLarkEmail() {
    showToast('Email queued via Lark Mail API (connect keys later).')
  }

  function moveContactStage(id: string, stage: PipelineStage) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)))
    const person = contacts.find((c) => c.id === id)
    showToast(
      `${person?.name ?? 'Lead'} → ${STAGE_LABEL[stage]}`,
    )
  }

  function shiftContactStage(id: string, direction: -1 | 1) {
    const person = contacts.find((c) => c.id === id)
    if (!person) return
    const idx = PIPELINE_STAGES.indexOf(person.stage)
    const next = PIPELINE_STAGES[idx + direction]
    if (!next) return
    moveContactStage(id, next)
  }

  const navItems: { id: NavId; icon: typeof Phone; label: string }[] = [
    { id: 'dialer', icon: Phone, label: 'Dialer' },
    { id: 'recents', icon: Clock3, label: 'Recents' },
    { id: 'contacts', icon: Users, label: 'Contacts' },
    { id: 'pipeline', icon: Columns3, label: 'Pipeline' },
    { id: 'lists', icon: ListChecks, label: 'Lists' },
    { id: 'reports', icon: BarChart3, label: 'Reports' },
  ]

  const showPanel = nav === 'recents' || nav === 'contacts' || nav === 'dialer'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            className="brand-logo-stacked"
            src="/brand/clickclick-logo-stacked-black.png"
            alt="ClickClick"
          />
          <span className="brand-chip">CRM</span>
        </div>
        <div className="topbar-right">
          <div className="pill">
            <span className="dot" />
            Ready
          </div>
          <div className="user-chip">
            <img
              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop"
              alt=""
            />
            <span>
              {CURRENT_USER.name}
              {CURRENT_USER.role === 'admin' ? ' · Admin' : ''}
            </span>
          </div>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar" aria-label="Main">
          <div className="sidebar-logo">
            <img
              src="/brand/clickclick-logo-full-horizontal.png"
              alt=""
            />
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-btn ${nav === item.id ? 'active' : ''}`}
                title={item.label}
                aria-label={item.label}
                onClick={() => setNav(item.id)}
              >
                <Icon size={20} strokeWidth={1.8} />
              </button>
            )
          })}
          <div className="sidebar-spacer" />
          <button
            className={`nav-btn accent ${nav === 'settings' ? 'active' : ''}`}
            title="Settings"
            aria-label="Settings"
            onClick={() => setNav('settings')}
          >
            <Settings size={20} strokeWidth={1.8} />
          </button>
        </aside>

        {showPanel && (
          <section className="panel">
            <div className="panel-head">
              {nav === 'contacts' ? (
                <h2>Contacts</h2>
              ) : (
                <div className="tabs">
                  <button
                    className={`tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`tab ${filter === 'missed' ? 'active' : ''}`}
                    onClick={() => setFilter('missed')}
                  >
                    Missed
                  </button>
                </div>
              )}
            </div>
            <div className="search-wrap">
              <Search size={14} />
              <input
                className="search"
                placeholder={nav === 'contacts' ? 'Search people…' : 'Search calls…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="list">
              {nav === 'contacts'
                ? filteredContacts.map((person) => (
                    <button
                      key={person.id}
                      className={`list-row ${selectedContactId === person.id ? 'active' : ''}`}
                      onClick={() => selectContact(person)}
                    >
                      <div>
                        <div className="call-phone">{person.name}</div>
                        <div className="call-meta">
                          {person.company} · {person.phone}
                        </div>
                      </div>
                      <div className="call-when">{STAGE_LABEL[person.stage]}</div>
                    </button>
                  ))
                : filteredCalls.map((call) => {
                    const person = contactById(call.contactId)
                    return (
                      <button
                        key={call.id}
                        className={`call-row ${selectedCallId === call.id ? 'active' : ''}`}
                        onClick={() => selectCall(call)}
                      >
                        <div className="call-phone">{call.phone}</div>
                        <div className="call-when">{call.when}</div>
                        <div className={`call-status ${call.status}`}>
                          {statusLabel(call.status)}
                          {call.extension ? ` · ${call.extension}` : ''}
                          {person ? ` · ${person.name}` : ''}
                        </div>
                      </button>
                    )
                  })}
              {((nav === 'contacts' && filteredContacts.length === 0) ||
                (nav !== 'contacts' && filteredCalls.length === 0)) && (
                <div className="empty">Nothing matches.</div>
              )}
            </div>
          </section>
        )}

        <main className={`main ${showPanel ? '' : 'wide'}`.trim()}>
          {nav === 'pipeline' && (
            <div className="lists-view pipeline-view">
              <div className="pipeline-head">
                <h2>Pipeline</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Move leads with the arrows or stage pills. Opens dialer on click.
                </p>
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
                          <button
                            className="pipeline-card-main"
                            onClick={() => {
                              selectContact(person)
                              setNav('recents')
                            }}
                          >
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
                              onClick={() => shiftContactStage(person.id, -1)}
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Move forward"
                              disabled={col.stage === 'lost'}
                              onClick={() => shiftContactStage(person.id, 1)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                          <div className="pipeline-stage-pills">
                            {PIPELINE_STAGES.map((stage) => (
                              <button
                                key={stage}
                                className={`mini-stage ${person.stage === stage ? 'active' : ''}`}
                                onClick={() => moveContactStage(person.id, stage)}
                              >
                                {STAGE_LABEL[stage]}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                      {col.items.length === 0 && (
                        <p className="pipeline-empty">No one here</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {nav === 'lists' && (
            <div className="lists-view">
              <h2>Dialer lists</h2>
              <div className="dialer-list">
                {DIALER_LISTS.map((list) => (
                  <button
                    key={list.id}
                    className={`dialer-list-item ${activeList === list.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveList(list.id)
                      showToast(`Opened list: ${list.name}`)
                    }}
                  >
                    <span aria-hidden>{list.emoji}</span>
                    {list.name}
                    <span>({list.count})</span>
                  </button>
                ))}
                <button
                  className="create-list"
                  onClick={() => showToast('Create list — wire to database next.')}
                >
                  + Create new list
                </button>
              </div>
            </div>
          )}

          {nav === 'reports' && (
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
                  <div className="value">{AGENTS.filter((a) => a.online).length}</div>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 16 }}>
                Real stats will come from call logs once Twilio + Supabase are plugged in.
              </p>
            </div>
          )}

          {nav === 'settings' && (
            <div className="lists-view admin-settings">
              <div className="main-head" style={{ padding: '0 0 12px', border: 'none' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Admin</h1>
                </div>
                <div className="tabs">
                  <button
                    className={`tab ${settingsTab === 'scripts' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('scripts')}
                  >
                    Scripts
                  </button>
                  <button
                    className={`tab ${settingsTab === 'contracts' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('contracts')}
                  >
                    Contracts
                  </button>
                  <button
                    className={`tab ${settingsTab === 'connect' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('connect')}
                  >
                    Connect
                  </button>
                </div>
              </div>

              {settingsTab === 'scripts' && (
                <div className="card" style={{ maxWidth: 820 }}>
                  <h3>Call scripts</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Edit for everyone (bulk) or one salesperson. Tags:{' '}
                    <code>{'{{name}}'}</code> <code>{'{{agent}}'}</code>{' '}
                    <code>{'{{company}}'}</code>
                  </p>

                  <div className="deal-section">
                    <p className="deal-label">Who is this for?</p>
                    <div className="outcomes">
                      <button
                        className={`outcome-btn ${scriptScope === 'everyone' ? 'active' : ''}`}
                        onClick={() => loadScriptScope('everyone')}
                      >
                        Everyone
                      </button>
                      {AGENTS.map((a) => (
                        <button
                          key={a.id}
                          className={`outcome-btn ${scriptScope === a.id ? 'active' : ''}`}
                          onClick={() => loadScriptScope(a.id)}
                        >
                          {a.name}
                          {agentScripts[a.id] ? ' · custom' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="deal-fields" style={{ gridTemplateColumns: '1fr' }}>
                    <label>
                      Script title
                      <input
                        value={editScriptTitle}
                        onChange={(e) => setEditScriptTitle(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="deal-notes">
                    Script text
                    <textarea
                      className="notes-box"
                      style={{ minHeight: 180 }}
                      value={editScriptBody}
                      onChange={(e) => setEditScriptBody(e.target.value)}
                    />
                  </label>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn primary" onClick={saveScript}>
                      Save script
                    </button>
                    <button className="btn ghost" onClick={applyScriptToAllAgents}>
                      Apply to all agents
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'contracts' && (
                <div className="card" style={{ maxWidth: 820 }}>
                  <h3>Contract templates</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Edit when needed. Use tags like{' '}
                    <code>{'{{client_name}}'}</code> <code>{'{{total_price}}'}</code>{' '}
                    <code>{'{{monthly_amount}}'}</code> <code>{'{{packages}}'}</code>
                  </p>

                  <div className="deal-section">
                    <p className="deal-label">Template</p>
                    <div className="outcomes">
                      {contractTemplates.map((t) => (
                        <button
                          key={t.id}
                          className={`outcome-btn ${selectedTemplateId === t.id ? 'active' : ''}`}
                          onClick={() => selectContractTemplate(t.id)}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="deal-fields" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <label>
                      Name
                      <input
                        value={editTemplateName}
                        onChange={(e) => setEditTemplateName(e.target.value)}
                      />
                    </label>
                    <label>
                      Brand
                      <input value={selectedTemplate.brandId} readOnly />
                    </label>
                    <label>
                      Pay type
                      <input value={selectedTemplate.payType.replace('_', ' ')} readOnly />
                    </label>
                  </div>

                  <label className="deal-notes">
                    Template body
                    <textarea
                      className="notes-box"
                      style={{ minHeight: 220 }}
                      value={editTemplateBody}
                      onChange={(e) => setEditTemplateBody(e.target.value)}
                    />
                  </label>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn primary" onClick={saveContractTemplate}>
                      Save template
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        const original = CONTRACT_TEMPLATES.find(
                          (t) => t.id === selectedTemplateId,
                        )
                        if (!original) return
                        setEditTemplateName(original.name)
                        setEditTemplateBody(original.body)
                        showToast('Reverted to original text (not saved yet).')
                      }}
                    >
                      Revert text
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'connect' && (
                <div className="card" style={{ maxWidth: 520 }}>
                  <h3>Connect later</h3>
                  <ul className="muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
                    <li>Telnyx — numbers, dial, record, listen-in</li>
                    <li>Lark Suite — Mail send + chat notes</li>
                    <li>Stripe — one-off, deposit, monthly links</li>
                    <li>GoCardless — UK Direct Debit</li>
                    <li>E-sign + secure storage — signed contracts</li>
                    <li>Supabase — people, notes, deals, commission</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {(nav === 'recents' || nav === 'contacts' || nav === 'dialer') && (
            <>
              <div className="main-head">
                <div>
                  <h1>{nav === 'dialer' ? 'Dialer' : 'Recents'}</h1>
                </div>
                <div className="pill">
                  <Shield size={14} />
                  {CURRENT_USER.role === 'admin' ? 'Admin' : 'Agent'}
                </div>
              </div>

              <div className="main-scroll">
                {CURRENT_USER.role === 'admin' && liveAgent?.onCallWith && (
                  <div className="card admin-bar">
                    <div className="admin-live">
                      <span className="live-dot" />
                      <div>
                        <strong>{liveAgent.name}</strong> is live with{' '}
                        {contactById(liveAgent.onCallWith)?.name ?? 'a lead'}
                      </div>
                    </div>
                    <div className="btn-row">
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setListeningIn((v) => !v)
                          showToast(
                            listeningIn
                              ? 'Stopped listen-in'
                              : 'Listening in (whisper/barge later with Twilio)',
                          )
                        }}
                      >
                        <Headphones size={16} />
                        {listeningIn ? 'Stop listen-in' : 'Listen live'}
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          showToast('Admin recording flagged for this live call.')
                        }
                      >
                        <CircleDot size={16} />
                        Force record
                      </button>
                    </div>
                  </div>
                )}

                <div className="hero-card">
                  <img className="hero-avatar" src={contact.avatar} alt="" />
                  <div>
                    <p className="hero-phone">{contact.phone}</p>
                    <p className="hero-line">
                      Call to {contact.name} · {contact.company}
                      {selectedCall.extension ? ` · ${selectedCall.extension}` : ''}
                    </p>
                    <div className="badges">
                      <span className={`badge stage-${contact.stage}`}>
                        {STAGE_LABEL[contact.stage]}
                      </span>
                      <span className="badge">Owner: {contact.owner}</span>
                      <span className="badge">Source: {contact.source}</span>
                      <span className="badge">Area: {REGION_LABEL[contact.region]}</span>
                      {contact.doNotCall && (
                        <span className="badge dnc">
                          <Ban size={10} style={{ marginRight: 4 }} />
                          Do not call
                        </span>
                      )}
                      {contact.nextCallback && (
                        <span className="badge">
                          <CalendarClock size={10} style={{ marginRight: 4 }} />
                          Callback {contact.nextCallback}
                        </span>
                      )}
                    </div>
                    <div className="pipeline-inline">
                      <span className="deal-label" style={{ marginBottom: 0 }}>
                        Pipeline
                      </span>
                      <div className="outcomes">
                        {PIPELINE_STAGES.map((stage) => (
                          <button
                            key={stage}
                            className={`outcome-btn ${contact.stage === stage ? 'active' : ''}`}
                            onClick={() => moveContactStage(contact.id, stage)}
                          >
                            {STAGE_LABEL[stage]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hero-actions">
                    <button
                      className={`round-btn ${muted ? 'danger' : ''}`}
                      title={muted ? 'Unmute' : 'Mute'}
                      onClick={() => setMuted((m) => !m)}
                      disabled={!onCall}
                    >
                      {muted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      className="round-btn"
                      title={recording ? 'Recording on' : 'Start recording'}
                      onClick={() => {
                        setRecording((r) => !r)
                        showToast(recording ? 'Recording stopped' : 'Recording started')
                      }}
                    >
                      <CircleDot size={18} color={recording ? '#e83e8c' : undefined} />
                    </button>
                    {onCall ? (
                      <button className="call-btn hangup" onClick={endCall}>
                        <PhoneOff size={18} />
                        End
                      </button>
                    ) : (
                      <button
                        className="call-btn"
                        onClick={startCall}
                        disabled={contact.doNotCall}
                      >
                        <PhoneCall size={18} />
                        Call
                      </button>
                    )}
                  </div>
                </div>

                <div className="card from-number-card">
                  <div className="script-title">
                    <h3 style={{ margin: 0 }}>Calling from</h3>
                    <span>{fromPick.reason}</span>
                  </div>
                  <p className="from-active">
                    <strong>{fromPick.number.display}</strong>
                    <span>
                      {fromPick.number.label} · {REGION_LABEL[fromPick.number.region]}
                    </span>
                  </p>
                  <div className="outcomes" style={{ marginBottom: 10 }}>
                    <button
                      className={`outcome-btn ${fromMode === 'auto' ? 'active' : ''}`}
                      onClick={() => {
                        setFromMode('auto')
                        setManualFromId(null)
                        showToast('Auto: best local number for this lead.')
                      }}
                    >
                      Auto · best local
                    </button>
                    <button
                      className={`outcome-btn ${fromMode === 'manual' ? 'active' : ''}`}
                      onClick={() => setFromMode('manual')}
                    >
                      Pick number
                    </button>
                  </div>
                  <div className="from-number-list">
                    {selectableFromNumbers.map((n) => {
                      const active = fromPick.number.id === n.id
                      return (
                        <button
                          key={n.id}
                          className={`from-number-chip ${active ? 'active' : ''}`}
                          onClick={() => {
                            setFromMode('manual')
                            setManualFromId(n.id)
                            showToast(`From ${n.display} · ${n.label}`)
                          }}
                        >
                          <strong>{n.display}</strong>
                          <span>
                            {n.label}
                            {n.kind === 'personal' ? ' · yours' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {onCall && (
                  <div className="on-call-banner">
                    <div>
                      On call with <strong>{contact.name}</strong>
                      {muted ? ' · muted' : ''}
                      {recording ? ' · recording' : ''}
                      {' · from '}
                      <strong>{fromPick.number.display}</strong>
                    </div>
                    <div className="muted">Quiet hours: {contact.quietHours}</div>
                  </div>
                )}

                <div className="grid-2">
                  <div className="card">
                    <div className="script-title">
                      <h3 style={{ margin: 0 }}>
                        {activeObjection ? 'Objection reply' : 'Script'}
                      </h3>
                      <span>{activeObjection ? 'Pop-up' : activeScript.title}</span>
                    </div>
                    <div className="script-box">{scriptText}</div>
                    <div className="objection-row">
                      {OBJECTIONS.map((obj) => (
                        <button
                          key={obj.id}
                          className={`obj-btn ${activeObjection === obj.id ? 'active' : ''}`}
                          onClick={() =>
                            setActiveObjection((id) => (id === obj.id ? null : obj.id))
                          }
                        >
                          {obj.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h3>About them</h3>
                    <dl className="meta-grid">
                      <div>
                        <dt>Email</dt>
                        <dd>{contact.email}</dd>
                      </div>
                      <div>
                        <dt>Timezone</dt>
                        <dd>{contact.timezone}</dd>
                      </div>
                      <div>
                        <dt>Owner</dt>
                        <dd>{contact.owner}</dd>
                      </div>
                      <div>
                        <dt>Tags</dt>
                        <dd>{contact.tags.join(', ')}</dd>
                      </div>
                    </dl>
                    <h3 style={{ marginTop: 16 }}>Notes</h3>
                    <textarea
                      className="notes-box"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={() => showToast('Notes saved (local mock).')}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="card">
                    <h3>Call outcome</h3>
                    <div className="outcomes">
                      {(Object.keys(OUTCOME_LABEL) as CallOutcome[]).map((key) => (
                        <button
                          key={key}
                          className={`outcome-btn ${outcome === key ? 'active' : ''}`}
                          onClick={() => {
                            setOutcome(key)
                            if (key === 'do_not_call') {
                              showToast('Marked Do Not Call — dialer will block.')
                            }
                          }}
                        >
                          {OUTCOME_LABEL[key]}
                        </button>
                      ))}
                    </div>

                    <h3 style={{ marginTop: 18 }}>Last recording</h3>
                    {selectedCall.recordingUrl && selectedCall.durationSec ? (
                      <div className="recording">
                        <button
                          className="round-btn"
                          onClick={() => showToast('Playback mock — real audio via Twilio.')}
                        >
                          <PhoneCall size={16} />
                        </button>
                        <div className="wave" aria-hidden>
                          {WAVE.map((h, i) => (
                            <i key={i} style={{ ['--h' as string]: `${h}%` }} />
                          ))}
                        </div>
                        <span className="muted">
                          {formatDuration(selectedCall.durationSec)}
                        </span>
                      </div>
                    ) : (
                      <p className="muted">No recording on this call yet.</p>
                    )}
                  </div>

                  <div className="card">
                    <h3>Email via Lark</h3>
                    <div className="email-form">
                      <input value={contact.email} readOnly />
                      <input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                      />
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                      />
                      <div className="btn-row">
                        <button className="btn lark" onClick={sendLarkEmail}>
                          <Mail size={16} />
                          Send with Lark
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() =>
                            showToast('Draft posted to Lark chat (stub).')
                          }
                        >
                          Share to Lark chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card close-deal">
                  <div className="script-title">
                    <h3 style={{ margin: 0 }}>Close deal</h3>
                    <span>{DEAL_STATUS_LABEL[dealStatus]}</span>
                  </div>

                  <div className="deal-section">
                    <p className="deal-label">Brand</p>
                    <div className="outcomes">
                      {BRANDS.map((b) => (
                        <button
                          key={b.id}
                          className={`outcome-btn ${dealBrand === b.id ? 'active' : ''}`}
                          onClick={() => setDealBrand(b.id)}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="deal-section">
                    <p className="deal-label">Packages</p>
                    <div className="package-grid">
                      {brandPackages.map((pkg) => {
                        const on = selectedPackages.includes(pkg.id)
                        return (
                          <button
                            key={pkg.id}
                            className={`package-tile ${on ? 'active' : ''}`}
                            onClick={() => togglePackage(pkg.id)}
                          >
                            <strong>{pkg.name}</strong>
                            <span>{pkg.blurb}</span>
                            <em>
                              £{pkg.defaultPrice}
                              {pkg.defaultMonthly ? ` · £${pkg.defaultMonthly}/mo` : ''}
                            </em>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="deal-section">
                    <p className="deal-label">Pay type</p>
                    <div className="outcomes">
                      {PAY_TYPES.map((p) => (
                        <button
                          key={p.id}
                          className={`outcome-btn ${payType === p.id ? 'active' : ''}`}
                          onClick={() => setPayType(p.id)}
                          title={p.hint}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="muted deal-hint">
                      {PAY_TYPES.find((p) => p.id === payType)?.hint}
                    </p>
                  </div>

                  <div className="deal-fields">
                    <label>
                      Client name
                      <input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </label>
                    <label>
                      Company
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </label>
                    <label>
                      Start date
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </label>
                    <label>
                      End date
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Total £
                      <input
                        value={totalPrice}
                        onChange={(e) => setTotalPrice(e.target.value)}
                      />
                    </label>
                    {(payType === 'deposit' || payType === 'one_off') && (
                      <label>
                        {payType === 'deposit' ? 'Deposit £' : 'Pay now £'}
                        <input
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </label>
                    )}
                    {(payType === 'monthly' || payType === 'direct_debit') && (
                      <label>
                        Monthly £
                        <input
                          value={monthlyAmount}
                          onChange={(e) => setMonthlyAmount(e.target.value)}
                        />
                      </label>
                    )}
                  </div>

                  <label className="deal-notes">
                    Extra contract text
                    <textarea
                      className="notes-box"
                      placeholder="Custom lines for this deal…"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                    />
                  </label>

                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn lark" onClick={sendContract}>
                      <FileSignature size={16} />
                      Generate & send contract
                    </button>
                    <button className="btn primary" onClick={sendPayLink}>
                      {payType === 'direct_debit' ? (
                        <Landmark size={16} />
                      ) : (
                        <CreditCard size={16} />
                      )}
                      {payType === 'direct_debit'
                        ? 'Send Direct Debit link'
                        : 'Send Stripe pay link'}
                    </button>
                    <button className="btn ghost" onClick={markCommissionReady}>
                      Log sale for commission
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
