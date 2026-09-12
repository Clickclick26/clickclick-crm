// The guided call script, laid out the way call centres do it.
//
// The point of this file: on a live call you should never have to think, read a
// wall of text, or remember what comes next. You are always on exactly ONE step.
// The step tells you the one line to say. You press what they said. It moves you
// on. That is the whole thing.
//
// Two registers, and they must never blur:
//   `say` — the words out loud. Adult, polished, repeatable word for word.
//   `do`  — the note to yourself. Blunt and plain. Never said out loud.
//
// Content comes from clickclick-live/docs/sell-this-week.md. Change it there and
// here together, or they drift apart.
import type { CallOutcome } from './mock'

/** Colours the button so the shape of the call is readable at a glance. */
export type FlowTone = 'go' | 'soft' | 'stop'

export type FlowChoice = {
  /** What they said, in their words, not yours. */
  label: string
  to: string
  tone?: FlowTone
}

export type FlowStep = {
  id: string
  /** Short name for the breadcrumb trail. */
  stage: string
  /** Instruction to yourself. Never spoken. */
  do?: string
  /** The line, word for word. Supports {{name}}, {{company}}, {{agent}}. */
  say?: string
  /**
   * Use the editable opener from Settings > Scripts instead of `say`, so the
   * opener stays editable per agent and there is only one copy of it.
   */
  useScript?: boolean
  /** Small note under the line. What to do the second you stop talking. */
  then?: string
  /** Empty means the call is over. */
  choices: FlowChoice[]
  /** Reaching this step disposes the call automatically. */
  outcome?: CallOutcome
}

/** Always on screen, so you never have to hunt for a number mid-call. */
export const CALL_FACTS = [
  { label: 'List price', value: '£1,450 a month' },
  { label: 'Founding, first 5 brands', value: '£725 a month, locked 1 year' },
  { label: 'Black Friday', value: 'Fri 27 Nov 2026' },
  { label: 'Must start by', value: 'Fri 16 Oct 2026' },
]

export const FLOW_START = 'open'

export const FLOW: FlowStep[] = [
  {
    id: 'open',
    stage: 'Open',
    do: 'They picked up. Say this, then stop talking and wait for an answer.',
    useScript: true,
    then: 'Do not fill the silence. Let them answer.',
    choices: [
      { label: 'Yes, go on', to: 'thirty', tone: 'go' },
      { label: 'Someone else answered', to: 'gatekeeper', tone: 'soft' },
      { label: 'Bad time', to: 'badtime', tone: 'soft' },
      { label: 'Voicemail', to: 'voicemail', tone: 'soft' },
      { label: 'Wrong number', to: 'wrongnumber', tone: 'stop' },
      { label: 'Told me to get lost', to: 'hardno', tone: 'stop' },
    ],
  },
  {
    id: 'gatekeeper',
    stage: 'Gatekeeper',
    do: 'Wrong person. Do not pitch them, they cannot buy. Be warm, be quick, get a name.',
    say: 'Sorry, I should have asked first. Who looks after live video and social selling at {{company}}? I would rather bother the right person than waste yours.',
    choices: [
      { label: 'Putting me through', to: 'open', tone: 'go' },
      { label: 'Gave me a name and a time', to: 'bookcallback', tone: 'go' },
      { label: 'Will not help', to: 'endnoanswer', tone: 'stop' },
    ],
  },
  {
    id: 'badtime',
    stage: 'Bad time',
    do: 'Do not push. You want a time, not a pitch.',
    say: 'No problem, I will not hold you up. Are mornings or afternoons better for you? I will ring back then.',
    choices: [
      { label: 'Gave me a time', to: 'bookcallback', tone: 'go' },
      { label: 'Just no', to: 'referral', tone: 'stop' },
    ],
  },
  {
    id: 'voicemail',
    stage: 'Voicemail',
    do: 'Short. No pitch on a voicemail. You are only buying a call back.',
    say: 'Hi {{name}}, it is {{agent}} from ClickClick. Nothing urgent. I ran live shopping shows for retail brands and I have built the software that stops them falling over. I will try you again on Thursday, or ring me back on this number if that is easier.',
    outcome: 'no_answer',
    choices: [],
  },
  {
    id: 'thirty',
    stage: 'The 30 seconds',
    do: 'This is the whole pitch. Say it once, at normal speed. Do not speed up.',
    say: 'I ran live shopping shows for retail brands for years, and I have built the software that stops them falling over. I am ringing brands like {{company}} because Christmas gets decided this month. Two questions. Have you tried any live selling yet, and is it on the list for Q4?',
    then: 'Now stop talking and listen. Whatever they say next is the sale.',
    choices: [{ label: 'They are answering', to: 'listen', tone: 'go' }],
  },
  {
    id: 'listen',
    stage: 'Listen',
    do: 'Let them finish. Then press what they actually said. If they pushed back on price, TikTok, timing or anything else, use the grey buttons at the bottom instead.',
    choices: [
      { label: 'Interested', to: 'book', tone: 'go' },
      { label: 'Not this year', to: 'notthisyear', tone: 'soft' },
      { label: 'Flat no', to: 'referral', tone: 'stop' },
    ],
  },
  {
    id: 'book',
    stage: 'Book it',
    do: 'Never say you will send information. Offer two times only. Two, not a menu.',
    say: 'Let us put twenty minutes in the diary. Thursday at 10, or Friday at 2?',
    then: 'First call is questions only. Do not pitch on it. People buy on the second call.',
    choices: [
      { label: 'They picked one', to: 'booked', tone: 'go' },
      { label: 'Wobbling', to: 'askforno', tone: 'soft' },
      { label: 'No', to: 'referral', tone: 'stop' },
    ],
  },
  {
    id: 'askforno',
    stage: 'Ask for a no',
    do: 'Say it and mean it. About half the time this turns back into a yes.',
    say: '{{name}}, I am guessing this is a no for Christmas. That is fair enough, just tell me and I will stop.',
    choices: [
      { label: 'They came back', to: 'book', tone: 'go' },
      { label: 'Confirmed no', to: 'referral', tone: 'stop' },
    ],
  },
  {
    id: 'booked',
    stage: 'Booked',
    do: 'Write the date down now. Send the invite before your next call, not later.',
    say: 'Brilliant. I will send the invite in the next five minutes so it is in your diary. Talk on Thursday.',
    outcome: 'meeting_booked',
    choices: [],
  },
  {
    id: 'bookcallback',
    stage: 'Callback',
    do: 'Put it in the diary now, with their name on it.',
    say: 'Perfect, I will ring you then. Thanks {{name}}.',
    outcome: 'callback',
    choices: [],
  },
  {
    id: 'notthisyear',
    stage: 'Not this year',
    do: 'Do not argue with a timing no. Get January, then get names.',
    say: 'Fine. Can I come back to you in January? And who else should I be talking to in the meantime?',
    choices: [{ label: 'Move on', to: 'referral', tone: 'soft' }],
  },
  {
    id: 'referral',
    stage: 'Referral',
    do: 'Every single no gets this. It costs nothing and it is where your next list comes from.',
    say: 'No problem at all. Before I go, who else should I be talking to? Two names and I will get out of your hair.',
    choices: [
      { label: 'Gave me names', to: 'gotnames', tone: 'go' },
      { label: 'Nothing', to: 'endnot', tone: 'stop' },
    ],
  },
  {
    id: 'gotnames',
    stage: 'Names',
    do: 'Type the names into the notes box now, before you ring anyone else. You will forget them.',
    say: 'That is really helpful, thank you. Can I say you passed my name on?',
    outcome: 'not_interested',
    choices: [],
  },
  {
    id: 'endnot',
    stage: 'Done',
    do: 'Nothing else to do here. Mark it and move on to the next name.',
    say: 'No bother at all. Thanks for your time, {{name}}.',
    outcome: 'not_interested',
    choices: [],
  },
  {
    id: 'hardno',
    stage: 'Do not call',
    do: 'Do not argue, do not ask why. Thank them and get off the phone.',
    say: 'Understood, I will take you off the list. Thanks for your time.',
    outcome: 'do_not_call',
    choices: [],
  },
  {
    id: 'wrongnumber',
    stage: 'Wrong number',
    do: 'Check the number on the record before you mark it, in case it is a typo.',
    say: 'Sorry, my mistake. Thanks anyway.',
    outcome: 'wrong_number',
    choices: [],
  },
  {
    id: 'endnoanswer',
    stage: 'No answer',
    do: 'Front desk would not help. Try LinkedIn, or ring back at 8:30am before the gatekeeper is in.',
    say: 'No problem, thanks for your help.',
    outcome: 'no_answer',
    choices: [],
  },
]

const BY_ID = new Map(FLOW.map((step) => [step.id, step]))

export function flowStep(id: string): FlowStep {
  return BY_ID.get(id) ?? BY_ID.get(FLOW_START)!
}

/**
 * Fails loudly in dev if the flow has a dead end or an unreachable step, so a
 * broken script is caught at the desk and never mid-call. Cycles are allowed on
 * purpose (the gatekeeper hands you back to the opener); nothing advances on its
 * own, so a cycle only ever happens because a button was pressed.
 */
if (import.meta.env.DEV) {
  const problems: string[] = []
  for (const step of FLOW) {
    if (!step.say && !step.useScript && step.choices.length === 0) {
      problems.push(`"${step.id}" has nothing to say and nowhere to go`)
    }
    if (step.choices.length === 0 && !step.outcome) {
      problems.push(`"${step.id}" is a dead end with no outcome`)
    }
    for (const choice of step.choices) {
      if (!BY_ID.has(choice.to)) {
        problems.push(`"${step.id}" points at "${choice.to}", which does not exist`)
      }
    }
  }
  const seen = new Set<string>([FLOW_START])
  const queue = [FLOW_START]
  while (queue.length) {
    for (const choice of flowStep(queue.pop()!).choices) {
      if (!seen.has(choice.to)) {
        seen.add(choice.to)
        queue.push(choice.to)
      }
    }
  }
  for (const step of FLOW) {
    if (!seen.has(step.id)) problems.push(`"${step.id}" cannot be reached from the opener`)
  }
  if (problems.length) {
    console.error(`Call flow is broken:\n  ${problems.join('\n  ')}`)
  }
}
