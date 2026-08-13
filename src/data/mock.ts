import type { ExtraPerson, PersonRole } from '../lib/people'

export type CallStatus = 'missed' | 'inbound' | 'outbound'
export type PipelineStage = 'new' | 'talking' | 'proposal' | 'won' | 'lost'
export type CallOutcome =
  | 'sold'
  | 'callback'
  | 'no_answer'
  | 'not_interested'
  | 'do_not_call'
  | 'wrong_number'

export type Contact = {
  id: string
  name: string
  company: string
  phone: string
  email: string
  avatar: string
  owner: string
  stage: PipelineStage
  source: string
  timezone: string
  quietHours: string
  doNotCall: boolean
  notes: string
  tags: string[]
  nextCallback?: string
  /** Where the lead is — used to auto-pick a local from-number */
  region: PhoneRegion
  /** ClickClick sales lead vs CLocal waitlist signup — keeps the two off the same pipeline/dialer views. */
  brandId: BrandId
  /** CLocal outreach only — one of INDUSTRY_CATEGORIES, or null/unset. */
  industry: IndustryCategory | null
  /** CLocal outreach only — freeform neighbourhood/area, e.g. "Lisburn Road". */
  locality: string
  /** PECR TPS/CTPS screening result — 'unscreened' is the safe default and blocks calling. */
  tpsStatus: TpsStatus
  tpsScreenedAt?: string
  /** LinkedIn profile URL — stored in notes until a real column exists. */
  linkedinUrl: string
  /** Role of the main name — founder, co-founder, decision maker, etc. */
  personRole: PersonRole
  /** Extra people at the same company (co-founders, other decision makers). */
  extraPeople: ExtraPerson[]
}

// Deliberately the exact same list as CLocal/constants/categories.ts's
// FILTER_CATEGORIES, not a parallel taxonomy — that file's own comment says
// not to invent one, and it keeps CRM outreach data lined up with how these
// businesses actually get categorized once they're live on the app.
export const INDUSTRY_CATEGORIES = ['Dining', 'Wellness', 'Nightlife', 'Retail', 'Coffee', 'Events'] as const
export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[number]

export type TpsStatus = 'unscreened' | 'clear' | 'tps_registered' | 'ctps_registered' | 'check_failed'

export const TPS_STATUS_LABEL: Record<TpsStatus, string> = {
  unscreened: 'Not screened',
  clear: 'Clear to call',
  tps_registered: 'TPS registered — do not call',
  ctps_registered: 'CTPS registered — do not call',
  check_failed: 'Screening failed — recheck',
}

/**
 * Structural fallback only — never demo/placeholder content. Used the instant
 * before real contacts have loaded from Supabase (or if a selected contact
 * can't be found), so the UI has a blank `Contact` shape to render instead of
 * a fake person's name/notes. Replaces the old hardcoded CONTACTS[0] demo
 * fallback, which is why it existed in the first place — that array is gone.
 */
export const EMPTY_CONTACT: Contact = {
  id: '',
  name: '',
  company: '',
  phone: '',
  email: '',
  avatar: '',
  owner: '',
  stage: 'new',
  source: '',
  timezone: 'Europe/London',
  quietHours: '',
  doNotCall: false,
  notes: '',
  tags: [],
  region: 'other',
  brandId: 'clickclick',
  industry: null,
  locality: '',
  tpsStatus: 'unscreened',
  linkedinUrl: '',
  personRole: 'main',
  extraPeople: [],
}

export type PhoneRegion = 'belfast' | 'london' | 'scotland' | 'wales' | 'other'

export type CallRecord = {
  id: string
  contactId: string
  phone: string
  status: CallStatus
  extension?: string
  when: string
  durationSec?: number
  /** All calls are recorded; URL filled when call ends */
  recordingUrl?: string
  outcome?: CallOutcome
  agent: string
  agentId?: string
}

export type CallFeedback = {
  id: string
  callId: string
  agentId: string
  agentName: string
  contactName: string
  company: string
  when: string
  adminName: string
  note: string
  createdAt: string
}

export type Objection = {
  id: string
  label: string
  reply: string
}

export type ScriptBlock = {
  id: string
  title: string
  body: string
}

export type DialerList = {
  id: string
  name: string
  emoji: string
  count: number
}

export type Agent = {
  id: string
  name: string
  role: 'agent' | 'admin'
  online: boolean
  onCallWith?: string
  /** Each salesperson’s own line */
  personalNumberId: string
  avatarUrl?: string
}

export const CURRENT_USER: Agent = {
  id: 'u1',
  name: 'John Bravo',
  role: 'admin',
  online: true,
  personalNumberId: 'num-john',
}

export const AGENTS: Agent[] = [
  CURRENT_USER,
  {
    id: 'u2',
    name: 'Sara Quinn',
    role: 'agent',
    online: true,
    onCallWith: 'c3',
    personalNumberId: 'num-sara',
  },
  {
    id: 'u3',
    name: 'Mike Chen',
    role: 'agent',
    online: true,
    personalNumberId: 'num-mike',
  },
  {
    id: 'u4',
    name: 'Amy Walsh',
    role: 'agent',
    online: false,
    personalNumberId: 'num-amy',
  },
]

export type OutboundNumber = {
  id: string
  label: string
  e164: string
  display: string
  brandId: BrandId
  region: PhoneRegion
  kind: 'personal' | 'local' | 'main'
  agentId?: string
}

/** Shared brand lines + each agent’s own number */
export const OUTBOUND_NUMBERS: OutboundNumber[] = [
  {
    id: 'num-john',
    label: 'John’s line',
    e164: '+442890011001',
    display: '028 9001 1001',
    brandId: 'clickclick',
    region: 'belfast',
    kind: 'personal',
    agentId: 'u1',
  },
  {
    id: 'num-sara',
    label: 'Sara’s line',
    e164: '+442890011002',
    display: '028 9001 1002',
    brandId: 'clickclick',
    region: 'belfast',
    kind: 'personal',
    agentId: 'u2',
  },
  {
    id: 'num-mike',
    label: 'Mike’s line',
    e164: '+442890011003',
    display: '028 9001 1003',
    brandId: 'clickclick',
    region: 'belfast',
    kind: 'personal',
    agentId: 'u3',
  },
  {
    id: 'num-amy',
    label: 'Amy’s line',
    e164: '+442890011004',
    display: '028 9001 1004',
    brandId: 'clickclick',
    region: 'belfast',
    kind: 'personal',
    agentId: 'u4',
  },
  {
    id: 'num-cc-main',
    label: 'ClickClick main',
    e164: '+442890010000',
    display: '028 9001 0000',
    brandId: 'clickclick',
    region: 'belfast',
    kind: 'main',
  },
  {
    id: 'num-cc-london',
    label: 'ClickClick London',
    e164: '+442071234567',
    display: '020 7123 4567',
    brandId: 'clickclick',
    region: 'london',
    kind: 'local',
  },
  {
    id: 'num-cc-scotland',
    label: 'ClickClick Scotland',
    e164: '+441413456789',
    display: '0141 345 6789',
    brandId: 'clickclick',
    region: 'scotland',
    kind: 'local',
  },
  {
    id: 'num-cc-wales',
    label: 'ClickClick Wales',
    e164: '+442920123456',
    display: '029 2012 3456',
    brandId: 'clickclick',
    region: 'wales',
    kind: 'local',
  },
  {
    id: 'num-cl-main',
    label: 'CLocal main',
    e164: '+442890020000',
    display: '028 9002 0000',
    brandId: 'clocal',
    region: 'belfast',
    kind: 'main',
  },
  {
    id: 'num-cl-london',
    label: 'CLocal London',
    e164: '+442079876543',
    display: '020 7987 6543',
    brandId: 'clocal',
    region: 'london',
    kind: 'local',
  },
  {
    id: 'num-cl-scotland',
    label: 'CLocal Scotland',
    e164: '+441314567890',
    display: '0131 456 7890',
    brandId: 'clocal',
    region: 'scotland',
    kind: 'local',
  },
  {
    id: 'num-cl-wales',
    label: 'CLocal Wales',
    e164: '+442920987654',
    display: '029 2098 7654',
    brandId: 'clocal',
    region: 'wales',
    kind: 'local',
  },
]

export const REGION_LABEL: Record<PhoneRegion, string> = {
  belfast: 'Belfast / NI',
  london: 'London',
  scotland: 'Scotland',
  wales: 'Wales',
  other: 'Other',
}

export function numberById(id: string) {
  return OUTBOUND_NUMBERS.find((n) => n.id === id)
}

/** Auto: local brand number for lead area → else agent’s own → else brand main */
export function pickBestOutboundNumber(opts: {
  contact: Contact
  brandId: BrandId
  agent: Agent
  mode: 'auto' | 'manual'
  manualNumberId?: string | null
}): { number: OutboundNumber; reason: string } {
  const { contact, brandId, agent, mode, manualNumberId } = opts

  if (mode === 'manual' && manualNumberId) {
    const manual = numberById(manualNumberId)
    if (manual) {
      return { number: manual, reason: 'Picked by you' }
    }
  }

  const brandNums = OUTBOUND_NUMBERS.filter((n) => n.brandId === brandId)
  const localMatch = brandNums.find(
    (n) => n.kind === 'local' && n.region === contact.region,
  )
  if (localMatch) {
    return {
      number: localMatch,
      reason: `Auto · matches ${REGION_LABEL[contact.region]}`,
    }
  }

  const personal = numberById(agent.personalNumberId)
  if (personal) {
    return {
      number: personal,
      reason: `Auto · your line (${agent.name.split(' ')[0]})`,
    }
  }

  const main = brandNums.find((n) => n.kind === 'main') ?? brandNums[0]
  return {
    number: main,
    reason: 'Auto · brand main',
  }
}

export const CALLS: CallRecord[] = [
  {
    id: 'call1',
    contactId: 'c1',
    phone: '020 7946 0115',
    status: 'missed',
    extension: 'ext. 316',
    when: '10 min',
    agent: 'John Bravo',
    agentId: 'u1',
  },
  {
    id: 'call2',
    contactId: 'c2',
    phone: '0141 555 0109',
    status: 'inbound',
    extension: 'ext. 316',
    when: 'Sun, May 14',
    durationSec: 214,
    recordingUrl: '#rec-call2',
    outcome: 'callback',
    agent: 'Sara Quinn',
    agentId: 'u2',
  },
  {
    id: 'call3',
    contactId: 'c3',
    phone: '029 2011 0126',
    status: 'outbound',
    extension: 'ext. 316',
    when: 'Sun, May 14',
    durationSec: 482,
    recordingUrl: '#rec-call3',
    outcome: 'sold',
    agent: 'Sara Quinn',
    agentId: 'u2',
  },
  {
    id: 'call4',
    contactId: 'c4',
    phone: '028 9032 0107',
    status: 'missed',
    extension: 'ext. 316',
    when: 'Sun, May 14',
    agent: 'Mike Chen',
    agentId: 'u3',
  },
  {
    id: 'call5',
    contactId: 'c5',
    phone: '020 7946 0104',
    status: 'inbound',
    extension: 'ext. 316',
    when: 'Sat, May 13',
    durationSec: 96,
    recordingUrl: '#rec-call5',
    outcome: 'do_not_call',
    agent: 'John Bravo',
    agentId: 'u1',
  },
  {
    id: 'call6',
    contactId: 'c6',
    phone: '028 9024 0124',
    status: 'outbound',
    extension: 'ext. 316',
    when: 'Sat, May 13',
    durationSec: 640,
    recordingUrl: '#rec-call6',
    outcome: 'sold',
    agent: 'Amy Walsh',
    agentId: 'u4',
  },
  {
    id: 'call7',
    contactId: 'c1',
    phone: '020 7946 0115',
    status: 'outbound',
    extension: 'ext. 316',
    when: 'Fri, May 12',
    durationSec: 318,
    recordingUrl: '#rec-call7',
    outcome: 'callback',
    agent: 'John Bravo',
    agentId: 'u1',
  },
]

export const SEED_CALL_FEEDBACK: CallFeedback[] = [
  {
    id: 'fb1',
    callId: 'call3',
    agentId: 'u2',
    agentName: 'Sara Quinn',
    contactName: 'Priya Desai',
    company: 'Oak & Vine',
    when: 'Sun, May 14',
    adminName: 'John Bravo',
    note: 'Strong close on price. Next time ask for the decision-maker earlier.',
    createdAt: '2026-05-14 16:40',
  },
]

export const SCRIPT: ScriptBlock = {
  id: 's1',
  title: 'Opener · Live Commerce',
  body: `Hi {{name}}, this is {{agent}} from ClickClick.

We help brands turn video into sales — live shopping, social listening, and creator campaigns.

I saw {{company}} is growing online. Got 60 seconds for why teams book a demo with us?`,
}

export type ContractTemplate = {
  id: string
  brandId: BrandId
  payType: PayType
  name: string
  body: string
  /** The email that goes out with the contract — separate from the contract document body. */
  emailSubject?: string
  emailBody?: string
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'cc-monthly',
    brandId: 'clickclick',
    payType: 'monthly',
    name: 'ClickClick · Monthly',
    body: `SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Start: {{start_date}}
End: {{end_date}}
Packages: {{packages}}
Monthly fee: £{{monthly_amount}}

Payment: card subscription via Stripe.
This agreement is signed electronically.`,
  },
  {
    id: 'cc-oneoff',
    brandId: 'clickclick',
    payType: 'one_off',
    name: 'ClickClick · One-off',
    body: `SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}

Payment: one-off via Stripe.
This agreement is signed electronically.`,
  },
  {
    id: 'cc-deposit',
    brandId: 'clickclick',
    payType: 'deposit',
    name: 'ClickClick · Deposit',
    body: `SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}
Deposit due now: £{{deposit_amount}}

Balance terms as agreed. Signed electronically.`,
  },
  {
    id: 'cc-dd',
    brandId: 'clickclick',
    payType: 'direct_debit',
    name: 'ClickClick · Direct Debit',
    body: `SERVICE AGREEMENT — {{brand}}

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly Direct Debit: £{{monthly_amount}}

Collected via GoCardless. Signed electronically.`,
  },
  {
    id: 'cl-monthly',
    brandId: 'clocal',
    payType: 'monthly',
    name: 'CLocal · Monthly',
    body: `CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly: £{{monthly_amount}}
Start: {{start_date}}

Signed electronically.`,
  },
  {
    id: 'cl-oneoff',
    brandId: 'clocal',
    payType: 'one_off',
    name: 'CLocal · One-off',
    body: `CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}

Signed electronically.`,
  },
  {
    id: 'cl-deposit',
    brandId: 'clocal',
    payType: 'deposit',
    name: 'CLocal · Deposit',
    body: `CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Total: £{{total_price}}
Deposit: £{{deposit_amount}}

Signed electronically.`,
  },
  {
    id: 'cl-dd',
    brandId: 'clocal',
    payType: 'direct_debit',
    name: 'CLocal · Direct Debit',
    body: `CLOCAL AGREEMENT

Client: {{client_name}} ({{company}})
Packages: {{packages}}
Monthly Direct Debit: £{{monthly_amount}}

Signed electronically.`,
  },
]

export const OBJECTIONS: Objection[] = [
  {
    id: 'o1',
    label: 'Too expensive',
    reply:
      'Totally fair. Most clients start on a smaller plan and expand once they see one live that pays for itself. Want me to walk through a starter option vs the full stack?',
  },
  {
    id: 'o2',
    label: 'Already have agency',
    reply:
      'Great — we often sit beside agencies. We supply the software + playbooks; they keep creative. Happy to show a split that doesn’t replace them.',
  },
  {
    id: 'o3',
    label: 'No time / later',
    reply:
      'Understood. When is a better slot this week — morning or afternoon? I’ll send a calendar hold and a 2-min Loom so it’s easy to prep.',
  },
  {
    id: 'o4',
    label: 'Send info first',
    reply:
      'Happy to. I’ll email a one-pager + short case study now via Lark. While I have you — what’s the one metric you care about most: views, conversion, or ROAS?',
  },
  {
    id: 'o5',
    label: 'Competitor quote',
    reply:
      'Makes sense to compare. Where we usually win is human-level video context + live commerce in one place — not just keyword dumps. Want a side-by-side on that?',
  },
]

export const DIALER_LISTS: DialerList[] = [
  { id: 'l1', name: 'Warm demos', emoji: '🔥', count: 48 },
  { id: 'l2', name: 'Follow-up callbacks', emoji: '📞', count: 65 },
  { id: 'l3', name: 'Retail UK', emoji: '🛍️', count: 22 },
  { id: 'l4', name: 'Partner intros', emoji: '🤝', count: 92 },
  { id: 'l5', name: 'Do not call', emoji: '🚫', count: 11 },
]

export type BrandId = 'clickclick' | 'clocal'
export type PayType = 'one_off' | 'deposit' | 'monthly' | 'direct_debit'
export type DealStatus =
  | 'draft'
  | 'contract_sent'
  | 'signed'
  | 'pay_sent'
  | 'deposit_paid'
  | 'active'
  | 'closed'

export type PackageOption = {
  id: string
  brandId: BrandId
  name: string
  blurb: string
  defaultPrice: number
  defaultMonthly?: number
}

export const BRANDS: { id: BrandId; label: string }[] = [
  { id: 'clickclick', label: 'ClickClick' },
  { id: 'clocal', label: 'CLocal' },
]

export type InfoKit = {
  id: string
  brandId: BrandId
  /** Scopes the kit to one specific package/product; leave unset for a brand-wide kit. */
  packageId?: string
  name: string
  blurb: string
  subject: string
}

/** Quick sendables for warm-up / intro calls */
export const INFO_KITS: InfoKit[] = [
  {
    id: 'cc-brochure',
    brandId: 'clickclick',
    name: 'Brochure',
    blurb: 'One-pager overview of ClickClick',
    subject: 'ClickClick — quick overview for you',
  },
  {
    id: 'cc-info',
    brandId: 'clickclick',
    name: 'Info kit',
    blurb: 'Deck + case studies + how we work',
    subject: 'ClickClick info kit',
  },
  {
    id: 'cc-live',
    brandId: 'clickclick',
    name: 'Live commerce pack',
    blurb: 'Warm-up pack for live shopping chats',
    subject: 'Live commerce — short pack from ClickClick',
  },
  {
    id: 'cl-brochure',
    brandId: 'clocal',
    name: 'Brochure',
    blurb: 'CLocal for local businesses',
    subject: 'CLocal — overview for you',
  },
  {
    id: 'cl-info',
    brandId: 'clocal',
    name: 'Info kit',
    blurb: 'Pulses, rewards, and getting started',
    subject: 'CLocal info kit',
  },
]

export const PAY_TYPES: { id: PayType; label: string; hint: string }[] = [
  { id: 'one_off', label: 'One-off', hint: 'Full pay once' },
  { id: 'deposit', label: 'Deposit', hint: 'Part now, rest later' },
  { id: 'monthly', label: 'Monthly', hint: 'Card subscription' },
  { id: 'direct_debit', label: 'Direct debit', hint: 'UK bank pull' },
]

export const PACKAGES: PackageOption[] = [
  {
    id: 'cc-starter',
    brandId: 'clickclick',
    name: 'Starter',
    blurb: 'Live commerce setup + playbooks',
    defaultPrice: 1500,
    defaultMonthly: 299,
  },
  {
    id: 'cc-growth',
    brandId: 'clickclick',
    name: 'Growth',
    blurb: 'Starter + social listening',
    defaultPrice: 3200,
    defaultMonthly: 599,
  },
  {
    id: 'cc-partner',
    brandId: 'clickclick',
    name: 'Partner stack',
    blurb: 'Full stack + creator support',
    defaultPrice: 6500,
    defaultMonthly: 999,
  },
  {
    id: 'cl-basic',
    brandId: 'clocal',
    name: 'Local Basic',
    blurb: 'Business page + pulses',
    defaultPrice: 49,
    defaultMonthly: 29,
  },
  {
    id: 'cl-pro',
    brandId: 'clocal',
    name: 'Local Pro',
    blurb: 'Basic + rewards + analytics',
    defaultPrice: 149,
    defaultMonthly: 79,
  },
  {
    id: 'cl-city',
    brandId: 'clocal',
    name: 'City launch',
    blurb: 'Multi-location deposit pack',
    defaultPrice: 900,
    defaultMonthly: 199,
  },
]

export const PAY_TYPE_LABEL: Record<PayType, string> = {
  one_off: 'One-off',
  deposit: 'Deposit',
  monthly: 'Monthly',
  direct_debit: 'Direct debit',
}

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  draft: 'Draft',
  contract_sent: 'Contract sent',
  signed: 'Signed',
  pay_sent: 'Pay link sent',
  deposit_paid: 'Deposit paid',
  active: 'Active',
  closed: 'Closed',
}

// Was a local const duplicated inside App.tsx; moved here alongside
// STAGE_LABEL/PipelineStage so PipelineScreen.tsx can use it too without
// App.tsx needing to export internal constants.
export const PIPELINE_STAGES: PipelineStage[] = ['new', 'talking', 'proposal', 'won', 'lost']

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new: 'New',
  talking: 'Talking',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  sold: 'Sold',
  callback: 'Callback',
  no_answer: 'No answer',
  not_interested: 'Not interested',
  do_not_call: 'Do not call',
  wrong_number: 'Wrong number',
}

export function fillScript(
  template: string,
  contact: Contact,
  agentName: string,
) {
  return template
    .replaceAll('{{name}}', contact.name.split(' ')[0])
    .replaceAll('{{agent}}', agentName)
    .replaceAll('{{company}}', contact.company)
}
