import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import LottieImport from 'lottie-react'
import confettiAnimation from './assets/confetti.json'

// Vite ESM interop: default export is often `{ default: Component }`.
const Lottie =
  typeof LottieImport === 'function'
    ? LottieImport
    : ((LottieImport as { default?: unknown }).default as typeof LottieImport)
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
  Play,
  VolumeX,
  Video,
  CheckCircle2,
  ImagePlus,
  LogOut,
  Paperclip,
  X,
  MessageCircle,
  Copy,
  ExternalLink,
} from 'lucide-react'
import {
  BRANDS,
  CALLS,
  EMPTY_CONTACT,
  CONTRACT_TEMPLATES,
  DEAL_STATUS_LABEL,
  DIALER_LISTS,
  INFO_KITS,
  OBJECTIONS,
  OUTCOME_LABEL,
  OUTBOUND_NUMBERS,
  PACKAGES,
  PAY_TYPES,
  REGION_LABEL,
  SCRIPT,
  SEED_CALL_FEEDBACK,
  STAGE_LABEL,
  fillScript,
  pickBestOutboundNumber,
  type Agent,
  type BrandId,
  type CallFeedback,
  type CallOutcome,
  type CallRecord,
  type Contact,
  type ContractTemplate,
  type DealStatus,
  type InfoKit,
  type PayType,
  type PipelineStage,
} from './data/mock'
import { fetchAgents } from './lib/supabase/agents'
import { parseContactCsv } from './lib/csv'
import { parseInstagramBlock } from './lib/instagram'
import {
  fetchContacts,
  importCsvContacts,
  isFollowUpDue,
  updateContactFollowUp,
  updateContactNotes,
  updateContactStage,
} from './lib/supabase/contacts'
import {
  dueFollowUpCount,
  ensureNotifyPermission,
  hasAskedNotifyPermission,
  markAskedNotifyPermission,
  remindFollowUpsIfNeeded,
} from './lib/reminders'
import {
  createReferral,
  fetchReferrals,
  redeemReferralCode,
  updateReferralStatus,
  type Referral,
  type ReferralStatus,
} from './lib/supabase/referrals'
import { uploadAvatar, updateAgentAvatar } from './lib/supabase/profile'
import {
  createInfoKit,
  deleteInfoKit,
  fetchInfoKits,
  updateInfoKit,
} from './lib/supabase/infoKits'
import { createDeal, fetchDealForContact, updateDeal } from './lib/supabase/deals'
import { createLarkVideoInvite } from './lib/supabase/lark'

type NavId =
  | 'dialer'
  | 'recents'
  | 'contacts'
  | 'pipeline'
  | 'lists'
  | 'reports'
  | 'settings'

const PIPELINE_STAGES: PipelineStage[] = ['new', 'talking', 'proposal', 'won', 'lost']

const DEFAULT_CONTRACT_EMAIL_SUBJECT = 'Your contract from {{brand}}'
const DEFAULT_CONTRACT_EMAIL_BODY = `Hi {{client_name}},

Great speaking today — your contract's attached, ready to sign.

Any questions, just reply here.

Best,
{{agent}}`

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

/** Big obvious deal checklist states from the mock deal status. */
function dealChecklist(status: DealStatus, payType: PayType) {
  const contractDone = !['draft', 'contract_sent'].includes(status)
  const contractWaiting = status === 'contract_sent'
  const payDone = ['deposit_paid', 'active', 'closed'].includes(status)
  const payWaiting = status === 'pay_sent'

  let contractTitle = 'Contract not sent'
  let contractDetail = 'Generate & send so they can sign'
  if (contractWaiting) {
    contractTitle = 'Contract sent'
    contractDetail = 'Waiting for them to sign'
  } else if (contractDone) {
    contractTitle = 'Contract signed'
    contractDetail = 'Signed and filed'
  }

  let payTitle = 'Payment not sent'
  let payDetail = 'Send Stripe / Direct Debit when ready'
  if (payWaiting) {
    payTitle = 'Pay link sent'
    payDetail = 'Waiting for them to pay'
  } else if (status === 'deposit_paid') {
    payTitle = 'Deposit paid'
    payDetail = 'Money received'
  } else if (status === 'active') {
    payTitle = payType === 'direct_debit' ? 'Direct Debit live' : 'Subscription live'
    payDetail = 'First payment confirmed'
  } else if (status === 'closed') {
    payTitle = 'Paid in full'
    payDetail = 'One-off payment confirmed'
  }

  return {
    contractDone,
    contractWaiting,
    payDone,
    payWaiting,
    contractTitle,
    contractDetail,
    payTitle,
    payDetail,
    allDone: contractDone && payDone,
  }
}

function PayConfettiBurst() {
  if (typeof Lottie !== 'function') {
    return <div className="pay-confetti pay-confetti-fallback" aria-hidden />
  }

  return (
    <div className="pay-confetti" aria-hidden>
      <Lottie
        animationData={confettiAnimation}
        loop={false}
        autoplay
        // Canvas avoids black flashes some SVG/3D Lottie files cause in the browser.
        {...({
          renderer: 'canvas',
          rendererSettings: {
            clearCanvas: true,
            preserveAspectRatio: 'xMidYMid meet',
          },
        } as object)}
        className="pay-confetti-lottie"
        style={{ background: 'transparent' }}
      />
    </div>
  )
}

export default function App({
  currentAgent,
  onSignOut,
  onAvatarChange,
}: {
  currentAgent: Agent
  onSignOut: () => void
  onAvatarChange: (avatarUrl: string) => void
}) {
  const [agents, setAgents] = useState<Agent[]>([currentAgent])
  const [nav, setNav] = useState<NavId>('recents')
  const [filter, setFilter] = useState<'all' | 'missed'>('all')
  // ClickClick tabs are cold-call statuses; CLocal tabs are list membership
  // (a contact can be on more than one CLocal list at once — e.g. waitlist
  // AND newsletter — so these are non-exclusive tag filters, not stages).
  const [contactFilter, setContactFilter] = useState<
    'all' | 'replied' | 'warmed' | 'due' | 'waitlist' | 'newsletter' | 'cold-outreach'
  >('all')
  // Which brand's contacts the Contacts list / Pipeline board show. Defaults to
  // ClickClick (the actual sales desk) so CLocal waitlist signups never show up
  // in the dialer queue or sales pipeline unless someone deliberately switches.
  const [contactsBrand, setContactsBrand] = useState<BrandId>('clickclick')
  const [csvImporting, setCsvImporting] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedCallId, setSelectedCallId] = useState(CALLS[0].id)
  const [selectedContactId, setSelectedContactId] = useState(CALLS[0].contactId)
  const [notes, setNotes] = useState('')
  const [activeObjection, setActiveObjection] = useState<string | null>(null)
  const [onCall, setOnCall] = useState(false)
  const [muted, setMuted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [listeningIn, setListeningIn] = useState(false)
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [emailSubject, setEmailSubject] = useState('Quick follow-up from ClickClick')
  const [emailBody, setEmailBody] = useState('')
  const [emailAttachments, setEmailAttachments] = useState<File[]>([])
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [activeList, setActiveList] = useState(DIALER_LISTS[0].id)
  const [dealBrand, setDealBrand] = useState<BrandId>('clickclick')
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['cc-starter'])
  const [payType, setPayType] = useState<PayType>('monthly')
  const [dealStatus, setDealStatus] = useState<DealStatus>('draft')
  const [clientName, setClientName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [startDate, setStartDate] = useState('2026-08-10')
  const [endDate, setEndDate] = useState('2027-08-09')
  const [totalPrice, setTotalPrice] = useState('1500')
  const [depositAmount, setDepositAmount] = useState('500')
  const [monthlyAmount, setMonthlyAmount] = useState('299')
  const [customNotes, setCustomNotes] = useState('')
  const [currentDealId, setCurrentDealId] = useState<string | null>(null)
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
  const [editTemplateEmailSubject, setEditTemplateEmailSubject] = useState(
    CONTRACT_TEMPLATES[0].emailSubject ?? DEFAULT_CONTRACT_EMAIL_SUBJECT,
  )
  const [editTemplateEmailBody, setEditTemplateEmailBody] = useState(
    CONTRACT_TEMPLATES[0].emailBody ?? DEFAULT_CONTRACT_EMAIL_BODY,
  )
  const [settingsTab, setSettingsTab] = useState<
    'scripts' | 'contracts' | 'kits' | 'coaching' | 'connect'
  >('scripts')
  const [infoKits, setInfoKits] = useState<InfoKit[]>(INFO_KITS)
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null)
  const [editKitBrand, setEditKitBrand] = useState<BrandId>('clickclick')
  const [editKitPackageId, setEditKitPackageId] = useState<string | null>(null)
  const [editKitName, setEditKitName] = useState('')
  const [editKitBlurb, setEditKitBlurb] = useState('')
  const [editKitSubject, setEditKitSubject] = useState('')
  const [fromMode, setFromMode] = useState<'auto' | 'manual'>('auto')
  const [manualFromId, setManualFromId] = useState<string | null>(null)
  // Starts empty — real contacts arrive via fetchContacts() once auth is
  // ready (see the effect below). No demo/placeholder fallback data here
  // on purpose: if the fetch fails, the UI should show empty/an error, not
  // a fake person, which is exactly the bug this replaced.
  const [contacts, setContacts] = useState<Contact[]>([])
  const [payConfetti, setPayConfetti] = useState(false)
  const [callFeedback, setCallFeedback] = useState<CallFeedback[]>(SEED_CALL_FEEDBACK)
  const [feedbackDraft, setFeedbackDraft] = useState('')
  const [playingCallId, setPlayingCallId] = useState<string | null>(null)
  const [coachingAgentFilter, setCoachingAgentFilter] = useState<string>('all')
  const [callChannel, setCallChannel] = useState<'phone' | 'lark_video'>('phone')
  const [larkMeetingUrl, setLarkMeetingUrl] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [redeemCodeDraft, setRedeemCodeDraft] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((err) => console.error('Failed to load agents', err))
  }, [])

  useEffect(() => {
    fetchContacts(agents)
      .then((list) => {
        setContacts(list)
        // Skip the due-followup ping on the very first run, before agents
        // have loaded — owner names wouldn't resolve yet, and this effect
        // re-runs again anyway the moment agents.length changes.
        if (agents.length === 0) return
        const due = dueFollowUpCount(list, isFollowUpDue)
        remindFollowUpsIfNeeded({
          dueCount: due,
          onToast: (msg) => {
            setToast(msg)
            window.setTimeout(() => setToast(null), 4200)
          },
          openDueList: () => {
            setNav('contacts')
            setContactFilter('due')
          },
        })
      })
      .catch((err) => {
        console.error('Failed to load contacts', err)
        // Contacts previously failed silently here — the screen just stayed
        // empty with nothing telling you it was a failed fetch rather than
        // "no contacts exist."
        showToast('Could not load contacts. Check your connection and reload.')
      })
    // Re-fetch once the real team list lands so contact.owner names resolve correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length])

  const dueCount = useMemo(
    () => dueFollowUpCount(contacts, isFollowUpDue),
    [contacts],
  )

  useEffect(() => {
    fetchReferrals()
      .then(setReferrals)
      .catch((err) => console.error('Failed to load referrals', err))
  }, [])

  useEffect(() => {
    fetchInfoKits()
      .then(setInfoKits)
      .catch((err) => console.error('Failed to load info kits', err))
  }, [])

  function contactById(id: string) {
    return contacts.find((c) => c.id === id)
  }

  const selectedCall = CALLS.find((c) => c.id === selectedCallId) ?? CALLS[0]
  // EMPTY_CONTACT here (not a demo person) covers the moment before real
  // contacts have loaded, or a call/contact id that no longer matches a
  // real row — see EMPTY_CONTACT's doc comment in data/mock.ts.
  const contact =
    contactById(selectedContactId) ?? contactById(selectedCall.contactId) ?? EMPTY_CONTACT

  const liveAgent = agents.find((a) => a.onCallWith)

  // Referral this contact can hand out to someone else.
  const outgoingReferral = referrals.find((r) => r.referrerContactId === contact.id)
  // Referral that brought this contact in, if any.
  const incomingReferral = referrals.find((r) => r.referredContactId === contact.id)

  const brandPackages = useMemo(
    () => PACKAGES.filter((p) => p.brandId === dealBrand),
    [dealBrand],
  )

  const fromPick = useMemo(
    () =>
      pickBestOutboundNumber({
        contact,
        brandId: dealBrand,
        agent: currentAgent,
        mode: fromMode,
        manualNumberId: manualFromId,
      }),
    [contact, dealBrand, fromMode, manualFromId],
  )

  const selectableFromNumbers = useMemo(() => {
    const mine = OUTBOUND_NUMBERS.filter((n) => n.agentId === currentAgent.id)
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

  // Load (or start) this contact's deal from Supabase whenever the selected contact changes.
  useEffect(() => {
    // contact.id === '' means EMPTY_CONTACT (no real contact selected yet —
    // e.g. contacts haven't loaded from Supabase on first mount). Calling
    // fetchDealForContact('') sends `contact_id = ''` to Postgres, which
    // isn't a valid uuid and throws — that's what was producing "Could not
    // load this deal" on a page that hadn't even loaded a real contact yet.
    if (!contact.id) return
    let cancelled = false
    setCurrentDealId(null) // pause autosave while (re)loading, avoids saving to the wrong deal
    fetchDealForContact(contact.id)
      .then((deal) => {
        if (cancelled) return
        if (deal) {
          setDealBrand(deal.brandId)
          setSelectedPackages(deal.packageIds)
          setPayType(deal.payType)
          setDealStatus(deal.status)
          setClientName(deal.clientName)
          setCompanyName(deal.company)
          setStartDate(deal.startDate)
          setEndDate(deal.endDate)
          setTotalPrice(deal.totalPrice)
          setDepositAmount(deal.depositAmount)
          setMonthlyAmount(deal.monthlyAmount)
          setCustomNotes(deal.customNotes)
          setCurrentDealId(deal.id)
          return
        }
        return createDeal({
          contactId: contact.id,
          agentId: currentAgent.id,
          brandId: dealBrand,
          packageIds: selectedPackages,
          payType,
          status: 'draft',
          clientName: contact.name,
          company: contact.company,
          startDate,
          endDate,
          totalPrice,
          depositAmount,
          monthlyAmount,
          customNotes: '',
        }).then((created) => {
          if (cancelled) return
          setCurrentDealId(created.id)
        })
      })
      .catch((err) => {
        console.error('Failed to load/create deal', err)
        if (!cancelled) showToast('Could not load this deal — try reopening the contact.')
      })
    return () => {
      cancelled = true
    }
    // Only the contact switch should trigger a (re)load — everything else is autosaved below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id])

  // Debounced autosave: any deal field change writes back to the loaded/created row.
  useEffect(() => {
    if (!currentDealId) return
    const handle = window.setTimeout(() => {
      updateDeal(currentDealId, {
        brandId: dealBrand,
        packageIds: selectedPackages,
        payType,
        status: dealStatus,
        clientName,
        company: companyName,
        startDate,
        endDate,
        totalPrice,
        depositAmount,
        monthlyAmount,
        customNotes,
      }).catch((err) => {
        console.error('Failed to save deal', err)
        showToast(err instanceof Error ? `Deal not saved: ${err.message}` : 'Deal not saved.')
      })
    }, 500)
    return () => window.clearTimeout(handle)
  }, [
    currentDealId,
    dealBrand,
    selectedPackages,
    payType,
    dealStatus,
    clientName,
    companyName,
    startDate,
    endDate,
    totalPrice,
    depositAmount,
    monthlyAmount,
    customNotes,
  ])

  // User-initiated brand switch: starts a fresh deal for that brand.
  // (Loading a persisted deal sets dealBrand directly and must NOT go through this reset.)
  function pickDealBrand(brandId: BrandId) {
    setDealBrand(brandId)
    const first = PACKAGES.find((p) => p.brandId === brandId)
    if (!first) return
    setSelectedPackages([first.id])
    setTotalPrice(String(first.defaultPrice))
    setMonthlyAmount(String(first.defaultMonthly ?? Math.round(first.defaultPrice / 5)))
    setDepositAmount(String(Math.round(first.defaultPrice * 0.3)))
    setDealStatus('draft')
    setPayConfetti(false)
  }

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

  function burstPayConfetti() {
    setPayConfetti(false)
    window.setTimeout(() => {
      setPayConfetti(true)
      window.setTimeout(() => setPayConfetti(false), 4200)
    }, 0)
  }

  function celebrateSale(kind: 'deposit' | 'monthly' | 'one_off' | 'direct_debit') {
    setOutcome('sold')
    if (contact) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, stage: 'won' as const } : c)),
      )
    }
    const first = currentAgent.name.split(' ')[0]
    const lines: Record<typeof kind, string> = {
      deposit: `Nice one, ${first} — deposit’s on your board.`,
      monthly: `Nice one, ${first} — monthly deal’s on your board.`,
      one_off: `Nice one, ${first} — paid in full, on your board.`,
      direct_debit: `Nice one, ${first} — Direct Debit live, on your board.`,
    }
    showToast(lines[kind])
  }

  function sendContract() {
    if (!selectedPackages.length) {
      showToast('Pick at least one package.')
      return
    }
    setDealStatus('contract_sent')
    if (contact && (contact.stage === 'new' || contact.stage === 'talking')) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, stage: 'proposal' } : c)),
      )
    }

    // Fill the shared Email via Lark composer so the cover email is reviewable/editable
    // and can carry extra attachments, instead of firing off silently.
    const brandLabel = BRANDS.find((b) => b.id === dealBrand)?.label ?? dealBrand
    const template = contractTemplates.find(
      (t) => t.brandId === dealBrand && t.payType === payType,
    )
    const subjectTemplate = template?.emailSubject ?? DEFAULT_CONTRACT_EMAIL_SUBJECT
    const bodyTemplate = template?.emailBody ?? DEFAULT_CONTRACT_EMAIL_BODY
    setEmailSubject(subjectTemplate.replaceAll('{{brand}}', brandLabel))
    setEmailBody(
      bodyTemplate
        .replaceAll('{{client_name}}', contact.name.split(' ')[0])
        .replaceAll('{{brand}}', brandLabel)
        .replaceAll('{{agent}}', currentAgent.name),
    )
    setEmailAttachments((prev) => [
      ...prev,
      new File([`Contract for ${contact.name}`], 'contract.pdf', { type: 'application/pdf' }),
    ])

    showToast('Contract drafted below — review and send with Lark (attach anything extra first).')
    window.setTimeout(() => {
      setDealStatus('signed')
      showToast('Signed and filed. Send pay when you’re ready.')
    }, 1600)
  }

  function sendPayLink() {
    if (dealStatus === 'draft' || dealStatus === 'contract_sent') {
      showToast('Get the contract signed first (or send both).')
    }
    burstPayConfetti()

    // Placeholder link — swap for a real Stripe/GoCardless URL once the secret
    // key is wired server-side (Supabase Edge Function). Not a real charge.
    const payLinkUrl = `https://pay.clickclick.video/mock/${contact.id}-${Date.now()}`
    const hasContractAttached = emailAttachments.some((f) => f.name === 'contract.pdf')
    const payLinkLabel =
      payType === 'direct_debit'
        ? 'set up your Direct Debit'
        : payType === 'deposit'
          ? `pay your deposit (£${depositAmount})`
          : payType === 'monthly'
            ? `set up your monthly payment (£${monthlyAmount}/mo)`
            : `pay your invoice (£${totalPrice})`
    setEmailSubject((prev) => prev || `Your contract & payment link`)
    setEmailBody(
      `Hi ${contact.name.split(' ')[0]},\n\n` +
        (hasContractAttached
          ? `Thanks for signing — contract’s attached above for your records.\n\n`
          : '') +
        `Here’s your secure link to ${payLinkLabel}: ${payLinkUrl}\n\n` +
        `Any questions, just reply here.\n\nBest,\n${currentAgent.name}`,
    )

    if (payType === 'direct_debit') {
      setDealStatus('pay_sent')
      showToast('Direct Debit link drafted below — review and send with Lark.')
      window.setTimeout(() => {
        setDealStatus('active')
        celebrateSale('direct_debit')
      }, 1400)
      return
    }
    if (payType === 'deposit') {
      setDealStatus('pay_sent')
      showToast(`Deposit link (£${depositAmount}) drafted below — review and send with Lark.`)
      window.setTimeout(() => {
        setDealStatus('deposit_paid')
        celebrateSale('deposit')
      }, 1400)
      return
    }
    if (payType === 'monthly') {
      setDealStatus('pay_sent')
      showToast(`Monthly link (£${monthlyAmount}/mo) drafted below — review and send with Lark.`)
      window.setTimeout(() => {
        setDealStatus('active')
        celebrateSale('monthly')
      }, 1400)
      return
    }
    setDealStatus('pay_sent')
    showToast(`Pay link (£${totalPrice}) drafted below — review and send with Lark.`)
    window.setTimeout(() => {
      setDealStatus('closed')
      celebrateSale('one_off')
    }, 1400)
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
    const q = query.toLowerCase()
    return contacts.filter((c) => {
      if (c.brandId !== contactsBrand) return false
      if (contactFilter === 'replied' && !c.tags.includes('replied')) return false
      if (contactFilter === 'warmed' && !c.tags.includes('warmed')) return false
      if (contactFilter === 'due' && !isFollowUpDue(c.nextCallback)) return false
      // CLocal list membership — tag-based, not mutually exclusive. A contact
      // can be on the waitlist AND newsletter-opted-in at the same time.
      if (contactFilter === 'waitlist' && !c.tags.includes('waitlist')) return false
      if (contactFilter === 'newsletter' && !c.tags.includes('newsletter')) return false
      if (contactFilter === 'cold-outreach' && !c.tags.includes('cold-outreach')) return false
      if (!q) return true
      const hay = `${c.name} ${c.company} ${c.phone} ${c.email} ${c.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [contacts, query, contactFilter, contactsBrand])

  async function handleCsvFile(file: File) {
    setCsvImporting(true)
    try {
      const text = await file.text()
      const { rows, errors } = parseContactCsv(text)
      if (rows.length === 0) {
        showToast(errors[0] ?? 'No people found in that CSV.')
        return
      }
      // Imports land in whichever brand's tab is currently selected — the
      // toggle above the upload button is the explicit choice, never a
      // silent default, so a CLocal list can never land as ClickClick or
      // vice versa.
      const { inserted, updated } = await importCsvContacts(rows, currentAgent.id, contactsBrand)
      const fresh = await fetchContacts(agents)
      setContacts(fresh)
      const brandLabel = BRANDS.find((b) => b.id === contactsBrand)?.label ?? contactsBrand
      const warn = errors.length ? ` · ${errors.length} row warning(s)` : ''
      showToast(`CSV done: ${inserted} new, ${updated} updated to ${brandLabel}${warn}`)
      setNav('contacts')
    } catch (err) {
      console.error(err)
      showToast('CSV upload failed. Check the file and try again.')
    } finally {
      setCsvImporting(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  const pipelineColumns = useMemo(() => {
    const brandContacts = contacts.filter((c) => c.brandId === contactsBrand)
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      label: STAGE_LABEL[stage],
      items: brandContacts.filter((c) => c.stage === stage),
    }))
  }, [contacts, contactsBrand])

  const activeScript = useMemo(() => {
    const override = agentScripts[currentAgent.id]
    if (override) return override
    return { title: defaultScriptTitle, body: defaultScriptBody }
  }, [agentScripts, defaultScriptBody, defaultScriptTitle])

  const dealTrack = dealChecklist(dealStatus, payType)

  const scriptText = useMemo(() => {
    if (activeObjection) {
      const obj = OBJECTIONS.find((o) => o.id === activeObjection)
      return obj?.reply ?? ''
    }
    return fillScript(activeScript.body, contact, currentAgent.name)
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
    const agent = agents.find((a) => a.id === scriptScope)
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
    setEditTemplateEmailSubject(t.emailSubject ?? DEFAULT_CONTRACT_EMAIL_SUBJECT)
    setEditTemplateEmailBody(t.emailBody ?? DEFAULT_CONTRACT_EMAIL_BODY)
  }

  function saveContractTemplate() {
    setContractTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId
          ? {
              ...t,
              name: editTemplateName,
              body: editTemplateBody,
              emailSubject: editTemplateEmailSubject,
              emailBody: editTemplateEmailBody,
            }
          : t,
      ),
    )
    showToast('Contract template saved (mock).')
  }

  function selectInfoKit(id: string | null) {
    setSelectedKitId(id)
    if (!id) {
      setEditKitPackageId(null)
      setEditKitName('')
      setEditKitBlurb('')
      setEditKitSubject('')
      return
    }
    const kit = infoKits.find((k) => k.id === id)
    if (!kit) return
    setEditKitBrand(kit.brandId)
    setEditKitPackageId(kit.packageId ?? null)
    setEditKitName(kit.name)
    setEditKitBlurb(kit.blurb)
    setEditKitSubject(kit.subject)
  }

  async function saveInfoKit() {
    if (!editKitName.trim()) {
      showToast('Give the kit a name first.')
      return
    }
    const patch = {
      brandId: editKitBrand,
      packageId: editKitPackageId,
      name: editKitName.trim(),
      blurb: editKitBlurb,
      subject: editKitSubject,
    }
    try {
      if (selectedKitId) {
        await updateInfoKit(selectedKitId, patch)
        setInfoKits((prev) =>
          prev.map((k) => (k.id === selectedKitId ? { ...k, ...patch, packageId: patch.packageId ?? undefined } : k)),
        )
        showToast('Kit saved.')
      } else {
        const created = await createInfoKit(patch)
        setInfoKits((prev) => [...prev, created])
        setSelectedKitId(created.id)
        showToast('Kit created.')
      }
    } catch (err) {
      console.error('Failed to save info kit', err)
      showToast('Could not save that kit.')
    }
  }

  async function deleteSelectedInfoKit() {
    if (!selectedKitId) return
    try {
      await deleteInfoKit(selectedKitId)
      setInfoKits((prev) => prev.filter((k) => k.id !== selectedKitId))
      selectInfoKit(null)
      showToast('Kit deleted.')
    } catch (err) {
      console.error('Failed to delete info kit', err)
      showToast('Could not delete that kit.')
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  /** Single save path for contact notes — used by the notes box's onBlur AND
   * by the "switching contact" flush below, so both stay in sync instead of
   * duplicating (and risking drifting) the same two lines of save logic. */
  function saveContactNotes(contactId: string, text: string) {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, notes: text } : c)))
    return updateContactNotes(contactId, text)
  }

  /** Switching contact/call overwrites the notes box with the new person's
   * notes — if there's an unsaved edit for whoever was open, save it first
   * so it isn't silently discarded. */
  function flushPendingNotes() {
    if (contact.id && notes !== contact.notes) {
      saveContactNotes(contact.id, notes).catch((err) =>
        console.error('Failed to save notes before switching contact', err),
      )
    }
  }

  function selectCall(call: CallRecord) {
    flushPendingNotes()
    setSelectedCallId(call.id)
    setSelectedContactId(call.contactId)
    const person = contactById(call.contactId)
    if (person) {
      setNotes(person.notes)
      setEmailBody(
        `Hi ${person.name.split(' ')[0]},\n\nGreat speaking — here’s a short follow-up from ClickClick.\n\nBest,\n${currentAgent.name}`,
      )
    }
    setActiveObjection(null)
    setOutcome(call.outcome ?? null)
    setFeedbackDraft('')
    setPlayingCallId(null)
    setNav('recents')
  }

  function selectContact(person: Contact) {
    flushPendingNotes()
    setSelectedContactId(person.id)
    setNotes(person.notes)
    setEmailBody(
      `Hi ${person.name.split(' ')[0]},\n\nGreat speaking — here’s a short follow-up from ClickClick.\n\nBest,\n${currentAgent.name}`,
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
    if (callChannel === 'lark_video') {
      startLarkVideo()
      return
    }
    setOnCall(true)
    setRecording(true) // always on — every call is recorded
    setMuted(false)
    setActiveObjection(null)
    showToast(
      `Calling from ${fromPick.number.display} · recording on · ${fromPick.reason}`,
    )
  }

  async function startLarkVideo() {
    setOnCall(true)
    setRecording(true)
    setActiveObjection(null)
    showToast('Setting up Lark video…')
    try {
      const joinUrl = await createLarkVideoInvite({
        contactName: contact.name,
        contactEmail: contact.email,
        agentName: currentAgent.name,
        brand: dealBrand === 'clocal' ? 'CLocal' : 'ClickClick',
      })
      setLarkMeetingUrl(joinUrl)
      showToast(`Lark video ready · invite emailed to ${contact.name}`)
    } catch (err) {
      setOnCall(false)
      setRecording(false)
      showToast(
        err instanceof Error ? `Couldn't start Lark video: ${err.message}` : 'Couldn’t start Lark video',
      )
    }
  }

  function endCall() {
    setOnCall(false)
    setMuted(false)
    setRecording(false)
    setLarkMeetingUrl(null)
    showToast(
      outcome
        ? `Call ended · recorded · marked ${OUTCOME_LABEL[outcome]}`
        : callChannel === 'lark_video'
          ? 'Lark video ended · recording saved if enabled'
          : 'Call ended · recording saved',
    )
  }

  function saveCallFeedback() {
    if (!feedbackDraft.trim()) {
      showToast('Add a note before saving feedback.')
      return
    }
    const agent =
      agents.find((a) => a.name === selectedCall.agent) ??
      agents.find((a) => a.id === selectedCall.agentId)
    const entry: CallFeedback = {
      id: `fb-${Date.now()}`,
      callId: selectedCall.id,
      agentId: selectedCall.agentId ?? agent?.id ?? 'u1',
      agentName: selectedCall.agent,
      contactName: contact.name,
      company: contact.company,
      when: selectedCall.when,
      adminName: currentAgent.name,
      note: feedbackDraft.trim(),
      createdAt: new Date().toLocaleString('en-GB'),
    }
    setCallFeedback((prev) => [entry, ...prev])
    setFeedbackDraft('')
    showToast(`Saved to ${entry.agentName}’s coaching file.`)
  }

  function toggleSilentListen() {
    setListeningIn((v) => {
      const next = !v
      showToast(
        next
          ? 'Silent listen on — you hear them; they can’t hear you.'
          : 'Stopped silent listen',
      )
      return next
    })
  }

  function sendLarkEmail() {
    const attachmentNote = emailAttachments.length
      ? ` with ${emailAttachments.length} attachment${emailAttachments.length > 1 ? 's' : ''}`
      : ''
    showToast(`Email queued via Lark Mail API${attachmentNote} (connect keys later).`)
    setEmailAttachments([])
  }

  function handleAttachmentsChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setEmailAttachments((prev) => [...prev, ...files])
  }

  function removeAttachment(index: number) {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  function sendInfoKit(kitId: string) {
    const kit = infoKits.find((k) => k.id === kitId)
    if (!kit) return
    const brand = BRANDS.find((b) => b.id === kit.brandId)?.label ?? 'ClickClick'
    setEmailSubject(kit.subject)
    setEmailBody(
      `Hi ${contact.name.split(' ')[0]},\n\nGreat chatting — here’s our ${kit.name.toLowerCase()} from ${brand}.\n\nHappy to walk through it on a quick call or Lark video whenever suits.\n\nBest,\n${currentAgent.name}`,
    )
    showToast(`${kit.name} sent to ${contact.email} via Lark (mock)`)
  }

  async function handleGenerateReferralCode() {
    try {
      const referral = await createReferral(contact.id)
      setReferrals((prev) => [referral, ...prev])
      showToast(`Referral code ${referral.code} ready to hand out.`)
    } catch (err) {
      console.error('Failed to create referral', err)
      showToast('Could not generate a referral code.')
    }
  }

  async function handleRedeemReferralCode() {
    const code = redeemCodeDraft.trim()
    if (!code) return
    try {
      const referral = await redeemReferralCode(code, contact.id)
      setReferrals((prev) => [referral, ...prev.filter((r) => r.id !== referral.id)])
      setRedeemCodeDraft('')
      showToast(`Linked to referral ${referral.code}.`)
    } catch (err) {
      console.error('Failed to redeem referral code', err)
      showToast('Code not found or already used.')
    }
  }

  async function handleSetReferralStatus(id: string, status: ReferralStatus) {
    try {
      await updateReferralStatus(id, status)
      setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    } catch (err) {
      console.error('Failed to update referral status', err)
      showToast('Could not update referral status.')
    }
  }

  async function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const avatarUrl = await uploadAvatar(currentAgent.id, file)
      await updateAgentAvatar(currentAgent.id, avatarUrl)
      onAvatarChange(avatarUrl)
      setProfileMenuOpen(false)
      showToast('Profile photo updated.')
    } catch (err) {
      console.error('Failed to update avatar', err)
      showToast('Could not update your photo.')
    }
  }

  function moveContactStage(id: string, stage: PipelineStage) {
    const prevStage = contacts.find((c) => c.id === id)?.stage
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)))
    const person = contacts.find((c) => c.id === id)
    updateContactStage(id, stage)
      .then(() => showToast(`${person?.name ?? 'Lead'} → ${STAGE_LABEL[stage]}`))
      .catch((err) => {
        console.error('Failed to save stage', err)
        // Roll back the optimistic move — the toast above never fires on
        // failure now, so don't leave the board showing a stage that was
        // never actually saved.
        if (prevStage) {
          setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage: prevStage } : c)))
        }
        showToast('Could not move that lead — try again.')
      })
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
            src={`${import.meta.env.BASE_URL}brand/clickclick-logo-stacked-black.png`}
            alt="ClickClick"
          />
          <span className="brand-chip">CRM</span>
        </div>
        <div className="topbar-right">
          <div className="pill">
            <span className="dot" />
            Ready
          </div>
          <div
            className="user-menu"
            tabIndex={-1}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setProfileMenuOpen(false)
            }}
          >
            <button
              className="user-chip"
              onClick={() => setProfileMenuOpen((v) => !v)}
              title="Profile"
            >
              <img
                src={
                  currentAgent.avatarUrl ||
                  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop'
                }
                alt=""
              />
              <span>
                {currentAgent.name}
                {currentAgent.role === 'admin' ? ' · Admin' : ''}
              </span>
            </button>
            {profileMenuOpen && (
              <div className="user-menu-dropdown profile-panel">
                <div className="profile-panel-head">
                  <img
                    className="profile-avatar-lg"
                    src={
                      currentAgent.avatarUrl ||
                      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop'
                    }
                    alt=""
                  />
                  <div>
                    <strong>{currentAgent.name}</strong>
                    <span className="badge" style={{ marginTop: 4 }}>
                      {currentAgent.role === 'admin' ? 'Admin' : 'Agent'}
                    </span>
                  </div>
                </div>
                <button
                  className="user-menu-item"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus size={14} />
                  Change photo
                </button>
                <button className="user-menu-item danger" onClick={onSignOut}>
                  <LogOut size={14} />
                  Sign out
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarFileChange}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar" aria-label="Main">
          <div className="sidebar-logo">
            <img
              src={`${import.meta.env.BASE_URL}brand/clickclick-logo-full-horizontal.png`}
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
                <>
                  <h2>Contacts</h2>
                  <button
                    type="button"
                    className="btn ghost csv-upload-btn"
                    disabled={csvImporting}
                    onClick={() => csvInputRef.current?.click()}
                    title={`Imports into the ${BRANDS.find((b) => b.id === contactsBrand)?.label ?? contactsBrand} list — switch the tab above to change that first`}
                  >
                    {csvImporting
                      ? 'Uploading…'
                      : `Upload CSV to ${BRANDS.find((b) => b.id === contactsBrand)?.label ?? contactsBrand}`}
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleCsvFile(file)
                    }}
                  />
                </>
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
            {nav === 'contacts' && (
              <div className="tabs contact-filter-tabs" title="Sales leads vs CLocal contacts — kept apart on purpose">
                {BRANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`tab ${contactsBrand === b.id ? 'active' : ''}`}
                    onClick={() => {
                      setContactsBrand(b.id)
                      // Last brand's filter tab (e.g. "Warmed") isn't valid on
                      // the other brand's tab set — don't carry it over.
                      setContactFilter('all')
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {nav === 'contacts' && (
              <div className="tabs contact-filter-tabs">
                {(
                  contactsBrand === 'clocal'
                    ? ([
                        ['all', 'All'],
                        ['waitlist', 'Waitlist'],
                        ['newsletter', 'Newsletter'],
                        ['cold-outreach', 'Cold outreach'],
                      ] as const)
                    : ([
                        ['all', 'All'],
                        ['replied', 'Replied'],
                        ['warmed', 'Warmed'],
                        ['due', dueCount > 0 ? `Due (${dueCount})` : 'Due'],
                      ] as const)
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`tab ${contactFilter === id ? 'active' : ''} ${id === 'due' && dueCount > 0 ? 'tab-due' : ''}`}
                    onClick={() => setContactFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {nav === 'contacts' && dueCount > 0 && (
              <button
                type="button"
                className="followup-banner"
                onClick={() => {
                  setContactFilter('due')
                  if (!hasAskedNotifyPermission()) {
                    markAskedNotifyPermission()
                    void ensureNotifyPermission().then((p) => {
                      if (p === 'granted') showToast('Browser reminders on.')
                      else if (p === 'denied') showToast('Browser reminders blocked — use the Due tab.')
                    })
                  }
                }}
              >
                {dueCount === 1
                  ? '1 follow-up due — tap to view'
                  : `${dueCount} follow-ups due — tap to view`}
              </button>
            )}
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
                          {person.company
                            ? `${person.company} · `
                            : ''}
                          {person.phone || person.email}
                          {person.tags.includes('replied')
                            ? ' · replied'
                            : person.tags.includes('warmed')
                              ? ' · warmed'
                              : ''}
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
              <div className="tabs contact-filter-tabs" title="Sales leads vs CLocal contacts — kept apart on purpose">
                {BRANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`tab ${contactsBrand === b.id ? 'active' : ''}`}
                    onClick={() => {
                      setContactsBrand(b.id)
                      setContactFilter('all')
                    }}
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
                  <div className="value">{agents.filter((a) => a.online).length}</div>
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
                    className={`tab ${settingsTab === 'kits' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('kits')}
                  >
                    Info kits
                  </button>
                  <button
                    className={`tab ${settingsTab === 'coaching' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('coaching')}
                  >
                    Coaching
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
                      {agents.map((a) => (
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

                  <h3 style={{ marginTop: 18 }}>Cover email</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    The message sent alongside the contract — separate from the document itself.
                    Tags: <code>{'{{client_name}}'}</code> <code>{'{{brand}}'}</code>{' '}
                    <code>{'{{agent}}'}</code>
                  </p>
                  <div className="deal-fields" style={{ gridTemplateColumns: '1fr' }}>
                    <label>
                      Email subject
                      <input
                        value={editTemplateEmailSubject}
                        onChange={(e) => setEditTemplateEmailSubject(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="deal-notes">
                    Email body
                    <textarea
                      className="notes-box"
                      style={{ minHeight: 140 }}
                      value={editTemplateEmailBody}
                      onChange={(e) => setEditTemplateEmailBody(e.target.value)}
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
                        setEditTemplateEmailSubject(
                          original.emailSubject ?? DEFAULT_CONTRACT_EMAIL_SUBJECT,
                        )
                        setEditTemplateEmailBody(original.emailBody ?? DEFAULT_CONTRACT_EMAIL_BODY)
                        showToast('Reverted to original text (not saved yet).')
                      }}
                    >
                      Revert text
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'kits' && (
                <div className="card" style={{ maxWidth: 820 }}>
                  <h3>Info kits</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Brochures/info kits agents send from the Warm-up pack. Leave package as
                    General to show it for every package under a brand.
                  </p>

                  <div className="deal-section">
                    <p className="deal-label">Brand</p>
                    <div className="outcomes">
                      {BRANDS.map((b) => (
                        <button
                          key={b.id}
                          className={`outcome-btn ${editKitBrand === b.id ? 'active' : ''}`}
                          onClick={() => {
                            setEditKitBrand(b.id)
                            setEditKitPackageId(null)
                          }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="deal-section">
                    <p className="deal-label">
                      Existing kits for {BRANDS.find((b) => b.id === editKitBrand)?.label}
                    </p>
                    <div className="outcomes">
                      <button
                        className={`outcome-btn ${selectedKitId === null ? 'active' : ''}`}
                        onClick={() => selectInfoKit(null)}
                      >
                        + New kit
                      </button>
                      {infoKits
                        .filter((k) => k.brandId === editKitBrand)
                        .map((k) => (
                          <button
                            key={k.id}
                            className={`outcome-btn ${selectedKitId === k.id ? 'active' : ''}`}
                            onClick={() => selectInfoKit(k.id)}
                          >
                            {k.name}
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="deal-section">
                    <p className="deal-label">Package (optional)</p>
                    <div className="outcomes">
                      <button
                        className={`outcome-btn ${editKitPackageId === null ? 'active' : ''}`}
                        onClick={() => setEditKitPackageId(null)}
                      >
                        General
                      </button>
                      {PACKAGES.filter((p) => p.brandId === editKitBrand).map((p) => (
                        <button
                          key={p.id}
                          className={`outcome-btn ${editKitPackageId === p.id ? 'active' : ''}`}
                          onClick={() => setEditKitPackageId(p.id)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="deal-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <label>
                      Kit name
                      <input
                        value={editKitName}
                        onChange={(e) => setEditKitName(e.target.value)}
                      />
                    </label>
                    <label>
                      Email subject
                      <input
                        value={editKitSubject}
                        onChange={(e) => setEditKitSubject(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="deal-notes">
                    Blurb (shown on the tile)
                    <textarea
                      className="notes-box"
                      value={editKitBlurb}
                      onChange={(e) => setEditKitBlurb(e.target.value)}
                    />
                  </label>

                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn primary" onClick={saveInfoKit}>
                      {selectedKitId ? 'Save kit' : 'Create kit'}
                    </button>
                    {selectedKitId && (
                      <button className="btn ghost" onClick={deleteSelectedInfoKit}>
                        Delete kit
                      </button>
                    )}
                  </div>
                </div>
              )}

              {settingsTab === 'coaching' && (
                <div className="card" style={{ maxWidth: 820 }}>
                  <h3>Coaching files</h3>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Feedback is saved per salesperson with the customer name on each note.
                    Replay calls from Recents.
                  </p>
                  <div className="outcomes" style={{ marginBottom: 14 }}>
                    <button
                      className={`outcome-btn ${coachingAgentFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setCoachingAgentFilter('all')}
                    >
                      Everyone
                    </button>
                    {agents.map((a) => (
                      <button
                        key={a.id}
                        className={`outcome-btn ${coachingAgentFilter === a.id ? 'active' : ''}`}
                        onClick={() => setCoachingAgentFilter(a.id)}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                  <div className="coaching-file-list">
                    {callFeedback
                      .filter(
                        (f) =>
                          coachingAgentFilter === 'all' ||
                          f.agentId === coachingAgentFilter,
                      )
                      .map((f) => (
                        <article key={f.id} className="feedback-chip">
                          <strong>
                            {f.agentName} · call with {f.contactName}
                          </strong>
                          <span>
                            {f.company} · {f.when} · by {f.adminName} · {f.createdAt}
                          </span>
                          <p>{f.note}</p>
                        </article>
                      ))}
                    {callFeedback.filter(
                      (f) =>
                        coachingAgentFilter === 'all' ||
                        f.agentId === coachingAgentFilter,
                    ).length === 0 && (
                      <p className="muted">No coaching notes in this file yet.</p>
                    )}
                  </div>
                </div>
              )}

              {settingsTab === 'connect' && (
                <div className="card" style={{ maxWidth: 520 }}>
                  <h3>Connect later</h3>
                  <ul className="muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
                    <li>Telnyx — phone dial, always-record, silent listen-in</li>
                    <li>Lark Suite — Mail, chat, <strong>video meetings (VC)</strong></li>
                    <li>Stripe — one-off, deposit, monthly links</li>
                    <li>GoCardless — UK Direct Debit</li>
                    <li>E-sign + secure storage — signed contracts</li>
                    <li>Supabase — people, notes, deals, coaching files, recordings</li>
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
                  {currentAgent.role === 'admin' ? 'Admin' : 'Agent'}
                </div>
              </div>

              <div className="main-scroll">
                {currentAgent.role === 'admin' && liveAgent?.onCallWith && (
                  <div className="card admin-bar">
                    <div className="admin-live">
                      <span className="live-dot" />
                      <div>
                        <strong>{liveAgent.name}</strong> is live with{' '}
                        {contactById(liveAgent.onCallWith)?.name ?? 'a lead'}
                        {listeningIn && (
                          <span className="silent-tag"> · silent listen</span>
                        )}
                      </div>
                    </div>
                    <div className="btn-row">
                      <button
                        className={`btn ${listeningIn ? 'primary' : 'ghost'}`}
                        onClick={toggleSilentListen}
                      >
                        {listeningIn ? <VolumeX size={16} /> : <Headphones size={16} />}
                        {listeningIn ? 'Stop silent listen' : 'Listen live (silent)'}
                      </button>
                    </div>
                    <p className="muted" style={{ margin: '8px 0 0', width: '100%' }}>
                      You’re muted to them — they won’t hear you join. Call is already recording.
                    </p>
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
                      {dealTrack.contractDone ? (
                        <span className="badge deal-ok">
                          <CheckCircle2 size={10} style={{ marginRight: 4 }} />
                          Contract signed
                        </span>
                      ) : dealTrack.contractWaiting ? (
                        <span className="badge deal-wait">
                          <Clock3 size={10} style={{ marginRight: 4 }} />
                          Awaiting signature
                        </span>
                      ) : null}
                      {dealTrack.payDone ? (
                        <span className="badge deal-ok">
                          <CheckCircle2 size={10} style={{ marginRight: 4 }} />
                          {dealTrack.payTitle}
                        </span>
                      ) : dealTrack.payWaiting ? (
                        <span className="badge deal-wait">
                          <Clock3 size={10} style={{ marginRight: 4 }} />
                          Awaiting payment
                        </span>
                      ) : null}
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
                      title="Every call is recorded"
                      onClick={() =>
                        showToast('Recording is always on for every call.')
                      }
                    >
                      <CircleDot size={18} color={onCall || recording ? '#e83e8c' : undefined} />
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
                        {callChannel === 'lark_video' ? (
                          <Video size={18} />
                        ) : (
                          <PhoneCall size={18} />
                        )}
                        {callChannel === 'lark_video' ? 'Video' : 'Call'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="card channel-card">
                  <div className="script-title">
                    <h3 style={{ margin: 0 }}>How to reach them</h3>
                    <span>{callChannel === 'lark_video' ? 'Lark video' : 'Phone'}</span>
                  </div>
                  <div className="outcomes">
                    <button
                      className={`outcome-btn ${callChannel === 'phone' ? 'active' : ''}`}
                      onClick={() => {
                        setCallChannel('phone')
                        setLarkMeetingUrl(null)
                      }}
                    >
                      <Phone size={14} style={{ marginRight: 6 }} />
                      Phone dialer
                    </button>
                    <button
                      className={`outcome-btn ${callChannel === 'lark_video' ? 'active' : ''}`}
                      onClick={() => setCallChannel('lark_video')}
                    >
                      <Video size={14} style={{ marginRight: 6 }} />
                      Lark video
                    </button>
                  </div>
                  <p className="muted deal-hint">
                    {callChannel === 'lark_video'
                      ? 'Uses Lark’s live meeting — easy when they want face-to-face. Link can go by Lark email.'
                      : 'Uses your Telnyx numbers · auto local caller ID.'}
                  </p>
                  {larkMeetingUrl && onCall && callChannel === 'lark_video' && (
                    <div className="lark-meet-row">
                      <strong>Meeting link</strong>
                      <code>{larkMeetingUrl}</code>
                      <div className="btn-row">
                        <button
                          className="btn lark"
                          onClick={async () => {
                            showToast('Re-sending meeting link…')
                            try {
                              await createLarkVideoInvite({
                                contactName: contact.name,
                                contactEmail: contact.email,
                                agentName: currentAgent.name,
                                existingJoinUrl: larkMeetingUrl,
                              })
                              showToast(`Meeting link emailed to ${contact.name}`)
                            } catch (err) {
                              showToast(
                                err instanceof Error
                                  ? `Couldn't email link: ${err.message}`
                                  : "Couldn't email link",
                              )
                            }
                          }}
                        >
                          <Mail size={16} />
                          Email link again
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => {
                            void navigator.clipboard?.writeText(larkMeetingUrl)
                            showToast('Link copied.')
                          }}
                        >
                          Copy link
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {callChannel === 'phone' && (
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
                )}

                {onCall && (
                  <div className="on-call-banner">
                    <div>
                      {callChannel === 'lark_video' ? 'On Lark video with' : 'On call with'}{' '}
                      <strong>{contact.name}</strong>
                      {muted ? ' · muted' : ''}
                      {recording ? ' · recording' : ''}
                      {callChannel === 'phone' && (
                        <>
                          {' · from '}
                          <strong>{fromPick.number.display}</strong>
                        </>
                      )}
                      {callChannel === 'lark_video' && ' · Lark live meeting'}
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
                        <dd>{contact.tags.join(', ') || '—'}</dd>
                      </div>
                      <div>
                        <dt>Follow-up</dt>
                        <dd>
                          <input
                            type="date"
                            className="followup-date"
                            value={
                              contact.nextCallback &&
                              /^\d{4}-\d{2}-\d{2}/.test(contact.nextCallback)
                                ? contact.nextCallback.slice(0, 10)
                                : ''
                            }
                            onChange={(e) => {
                              const value = e.target.value || null
                              setContacts((prev) =>
                                prev.map((c) =>
                                  c.id === contact.id
                                    ? { ...c, nextCallback: value ?? undefined }
                                    : c,
                                ),
                              )
                              updateContactFollowUp(contact.id, value).catch((err) =>
                                console.error('Failed to save follow-up', err),
                              )
                              showToast(
                                value
                                  ? `Follow-up set for ${value}`
                                  : 'Follow-up cleared',
                              )
                            }}
                          />
                        </dd>
                      </div>
                    </dl>
                    {(() => {
                      const ig = parseInstagramBlock(notes)
                      if (!ig) return null
                      const isFb = /facebook\.com/i.test(ig.url)
                      const channel = isFb ? 'Facebook' : 'Instagram'
                      return (
                        <div className="ig-outreach">
                          <h3 style={{ marginTop: 16 }}>
                            <MessageCircle size={16} aria-hidden /> {channel} message
                          </h3>
                          <pre className="ig-message">{ig.message || '—'}</pre>
                          <div className="btn-row ig-actions">
                            <button
                              type="button"
                              className="btn primary"
                              disabled={!ig.message}
                              onClick={() => {
                                void navigator.clipboard.writeText(ig.message).then(
                                  () =>
                                    showToast(`Message copied — paste into ${channel}`),
                                  () => showToast('Could not copy — select the text instead'),
                                )
                              }}
                            >
                              <Copy size={14} aria-hidden /> Copy message
                            </button>
                            {ig.url ? (
                              <a
                                className="btn"
                                href={ig.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink size={14} aria-hidden /> Open {channel}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      )
                    })()}
                    <h3 style={{ marginTop: 16 }}>Notes</h3>
                    <textarea
                      className="notes-box"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={() => {
                        if (!contact.id) return
                        saveContactNotes(contact.id, notes)
                          .then(() => showToast('Notes saved.'))
                          .catch((err) => {
                            console.error('Failed to save notes', err)
                            showToast('Notes not saved — try again.')
                          })
                      }}
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

                    <h3 style={{ marginTop: 18 }}>Call recording</h3>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Every call is recorded. Admins can replay and coach later.
                    </p>
                    {selectedCall.recordingUrl && selectedCall.durationSec ? (
                      <div className="coaching-block">
                        <div className="coaching-meta">
                          <div>
                            <span className="deal-label">Salesperson</span>
                            <strong>{selectedCall.agent}</strong>
                          </div>
                          <div>
                            <span className="deal-label">Customer</span>
                            <strong>
                              {contact.name} · {contact.company}
                            </strong>
                          </div>
                          <div>
                            <span className="deal-label">When</span>
                            <strong>{selectedCall.when}</strong>
                          </div>
                        </div>
                        <div className="recording">
                          <button
                            className={`round-btn ${playingCallId === selectedCall.id ? 'danger' : ''}`}
                            onClick={() => {
                              setPlayingCallId((id) =>
                                id === selectedCall.id ? null : selectedCall.id,
                              )
                              showToast(
                                playingCallId === selectedCall.id
                                  ? 'Paused'
                                  : `Playing ${contact.name} · ${selectedCall.agent}`,
                              )
                            }}
                          >
                            <Play size={16} />
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
                        {currentAgent.role === 'admin' && (
                          <div className="feedback-box">
                            <label className="deal-notes">
                              Feedback for {selectedCall.agent}
                              <textarea
                                className="notes-box"
                                placeholder={`Notes for ${selectedCall.agent} about the call with ${contact.name}…`}
                                value={feedbackDraft}
                                onChange={(e) => setFeedbackDraft(e.target.value)}
                              />
                            </label>
                            <button className="btn primary" onClick={saveCallFeedback}>
                              Save to their coaching file
                            </button>
                          </div>
                        )}
                        {callFeedback
                          .filter((f) => f.callId === selectedCall.id)
                          .map((f) => (
                            <div key={f.id} className="feedback-chip">
                              <strong>
                                {f.adminName} → {f.agentName}
                              </strong>
                              <span>
                                {f.contactName} · {f.createdAt}
                              </span>
                              <p>{f.note}</p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No recording yet (missed / not connected). Connected calls always save audio.
                      </p>
                    )}
                  </div>

                  <div className="card">
                    <h3>Warm-up pack</h3>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Generic intro call? Send a brochure or info kit in one tap (Lark email).
                    </p>
                    <div className="deal-section">
                      <p className="deal-label">Brand for pack</p>
                      <div className="outcomes">
                        {BRANDS.map((b) => (
                          <button
                            key={b.id}
                            className={`outcome-btn ${dealBrand === b.id ? 'active' : ''}`}
                            onClick={() => pickDealBrand(b.id)}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="package-grid kit-grid">
                      {infoKits
                        .filter((k) => k.brandId === dealBrand)
                        .map((kit) => (
                          <button
                            key={kit.id}
                            className="package-tile"
                            onClick={() => sendInfoKit(kit.id)}
                          >
                            <strong>{kit.name}</strong>
                            <span>{kit.blurb}</span>
                            <em>
                              {kit.packageId
                                ? `For ${PACKAGES.find((p) => p.id === kit.packageId)?.name ?? 'a package'} · Send via Lark`
                                : 'Send via Lark'}
                            </em>
                          </button>
                        ))}
                    </div>
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
                      <div className="attachment-row">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => attachmentInputRef.current?.click()}
                        >
                          <Paperclip size={14} />
                          Attach files
                        </button>
                        {emailAttachments.map((file, i) => (
                          <span key={`${file.name}-${i}`} className="attachment-chip">
                            {file.name}
                            <button
                              type="button"
                              onClick={() => removeAttachment(i)}
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <input
                          ref={attachmentInputRef}
                          type="file"
                          multiple
                          style={{ display: 'none' }}
                          onChange={handleAttachmentsChange}
                        />
                      </div>
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

                  <div className="card">
                    <h3>Referral program</h3>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Give {contact.name} a code to pass on, or link the code that brought them in.
                    </p>

                    <div className="deal-section">
                      <p className="deal-label">Their code to hand out</p>
                      {outgoingReferral ? (
                        <div className="btn-row">
                          <span className="badge">{outgoingReferral.code}</span>
                          <button
                            className="btn ghost"
                            onClick={() => {
                              navigator.clipboard?.writeText(outgoingReferral.code)
                              showToast('Code copied.')
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      ) : (
                        <button className="btn" onClick={handleGenerateReferralCode}>
                          Generate code
                        </button>
                      )}
                    </div>

                    <div className="deal-section">
                      <p className="deal-label">Redeem a code they were referred with</p>
                      <div className="deal-fields" style={{ gridTemplateColumns: '2fr 1fr' }}>
                        <label>
                          Referral code
                          <input
                            value={redeemCodeDraft}
                            onChange={(e) => setRedeemCodeDraft(e.target.value)}
                            placeholder="REF-XXXXXX"
                            disabled={!!incomingReferral}
                          />
                        </label>
                        <button
                          className="btn primary"
                          style={{ alignSelf: 'end' }}
                          onClick={handleRedeemReferralCode}
                          disabled={!!incomingReferral}
                        >
                          Link
                        </button>
                      </div>
                      {incomingReferral && (
                        <p className="muted" style={{ marginBottom: 0 }}>
                          Referred via {incomingReferral.code} · status: {incomingReferral.status}
                        </p>
                      )}
                    </div>

                    {currentAgent.role === 'admin' && incomingReferral && (
                      <div className="deal-section">
                        <p className="deal-label">Reward status</p>
                        <div className="outcomes">
                          {(['pending', 'referred', 'won', 'rewarded', 'expired'] as ReferralStatus[]).map(
                            (s) => (
                              <button
                                key={s}
                                className={`outcome-btn ${incomingReferral.status === s ? 'active' : ''}`}
                                onClick={() => handleSetReferralStatus(incomingReferral.id, s)}
                              >
                                {s}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card close-deal">
                  <div className="script-title">
                    <h3 style={{ margin: 0 }}>Close deal</h3>
                    <span className="deal-status-chip">{DEAL_STATUS_LABEL[dealStatus]}</span>
                  </div>

                  <div className={`deal-track ${dealTrack.allDone ? 'all-done' : ''}`}>
                    <div
                      className={`deal-track-card ${
                        dealTrack.contractDone
                          ? 'done'
                          : dealTrack.contractWaiting
                            ? 'waiting'
                            : 'todo'
                      }`}
                    >
                      <div className="deal-track-icon">
                        {dealTrack.contractDone ? (
                          <CheckCircle2 size={22} />
                        ) : dealTrack.contractWaiting ? (
                          <Clock3 size={22} />
                        ) : (
                          <FileSignature size={22} />
                        )}
                      </div>
                      <div>
                        <p className="deal-track-kicker">Contract</p>
                        <strong>{dealTrack.contractTitle}</strong>
                        <span>{dealTrack.contractDetail}</span>
                      </div>
                    </div>

                    <div
                      className={`deal-track-card ${
                        dealTrack.payDone
                          ? 'done'
                          : dealTrack.payWaiting
                            ? 'waiting'
                            : 'todo'
                      }`}
                    >
                      <div className="deal-track-icon">
                        {dealTrack.payDone ? (
                          <CheckCircle2 size={22} />
                        ) : dealTrack.payWaiting ? (
                          <Clock3 size={22} />
                        ) : payType === 'direct_debit' ? (
                          <Landmark size={22} />
                        ) : (
                          <CreditCard size={22} />
                        )}
                      </div>
                      <div>
                        <p className="deal-track-kicker">
                          {payType === 'direct_debit' ? 'Direct Debit' : 'Stripe pay'}
                        </p>
                        <strong>
                          {dealTrack.payDone && payType === 'deposit'
                            ? `Deposit paid (£${depositAmount})`
                            : dealTrack.payTitle}
                        </strong>
                        <span>
                          {dealTrack.payDone && payType === 'monthly'
                            ? `£${monthlyAmount}/mo confirmed`
                            : dealTrack.payDone && payType === 'one_off'
                              ? `£${totalPrice} received`
                              : dealTrack.payDetail}
                        </span>
                      </div>
                    </div>
                  </div>

                  {dealTrack.allDone && (
                    <div className="deal-complete-banner">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>Deal complete</strong>
                        <span>Contract signed · payment confirmed</span>
                      </div>
                    </div>
                  )}

                  <div className="deal-section">
                    <p className="deal-label">Brand</p>
                    <div className="outcomes">
                      {BRANDS.map((b) => (
                        <button
                          key={b.id}
                          className={`outcome-btn ${dealBrand === b.id ? 'active' : ''}`}
                          onClick={() => pickDealBrand(b.id)}
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
                      {dealTrack.contractDone
                        ? 'Signed — resend contract'
                        : dealTrack.contractWaiting
                          ? 'Waiting for signature…'
                          : 'Generate & send contract'}
                    </button>
                    <button className="btn primary" onClick={sendPayLink}>
                      {payType === 'direct_debit' ? (
                        <Landmark size={16} />
                      ) : (
                        <CreditCard size={16} />
                      )}
                      {dealTrack.payDone
                        ? payType === 'direct_debit'
                          ? 'Paid — resend DD link'
                          : 'Paid — resend Stripe link'
                        : dealTrack.payWaiting
                          ? 'Waiting for payment…'
                          : payType === 'direct_debit'
                            ? 'Send Direct Debit link'
                            : 'Send Stripe pay link'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {payConfetti && <PayConfettiBurst />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
