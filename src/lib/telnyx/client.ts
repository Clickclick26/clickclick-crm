// Telnyx WebRTC — wired into the dialer UI in App.tsx (startCall/endCall/mute).
// Everything here no-ops unless VITE_TELNYX_LOGIN_TOKEN is set, so with no
// credentials the dialer falls back to the old simulated call, unchanged.
//
// Setup, once you have a Telnyx account:
//   1. Buy a number + create a "Call Control" / WebRTC Connection in the
//      Telnyx portal (Voice > Programmable Voice > Connections).
//   2. Generate a JWT login token for that connection (Telnyx portal has a
//      "Generate Credential" flow, or mint one server-side — do NOT put a
//      long-lived API key in frontend code, only a short-lived login token).
//   3. Set VITE_TELNYX_LOGIN_TOKEN in .env (see .env.example).
//   4. Put the real purchased number into OUTBOUND_NUMBERS in src/data/mock.ts —
//      the 028 9001 xxxx entries there are placeholders and are not dialable.
//
// Built from Telnyx's public @telnyx/webrtc docs (TelnyxRTC class, newCall(),
// telnyx.notification events). Still NOT verified against a live connection,
// since no account exists yet — confirm method/event names, and especially the
// callerNumber option and muteAudio()/unmuteAudio(), against
// https://developers.telnyx.com/docs/voice/webrtc/js-sdk on first real call.
import { TelnyxRTC } from '@telnyx/webrtc'

export type TelnyxCallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'hangup'

export function isTelnyxConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TELNYX_LOGIN_TOKEN)
}

/**
 * UK-first E.164 normaliser. Contacts store phone numbers in national format
 * ("028 9032 0107"), but Telnyx only dials E.164 ("+442890320107"), so
 * contact.phone cannot be handed to newCall() as-is.
 *
 * Returns null when the input can't be resolved confidently. Callers must
 * treat null as "refuse to dial" — guessing a country code risks calling a
 * stranger abroad, and on a cold-call list that is a PECR problem, not just a
 * wrong number.
 */
export function toE164(raw: string, defaultCountry = '44'): string | null {
  const cleaned = (raw ?? '').replace(/[^\d+]/g, '')
  if (!cleaned) return null

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1)
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null
  }
  // International access code, e.g. 00 44 28 ...
  if (cleaned.startsWith('00')) {
    const digits = cleaned.slice(2)
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null
  }
  // National format with trunk prefix, e.g. 028 9032 0107 -> +442890320107
  if (cleaned.startsWith('0')) {
    const digits = cleaned.slice(1)
    return /^\d{7,14}$/.test(digits) ? `+${defaultCountry}${digits}` : null
  }
  // No +, no 00, no trunk 0 — ambiguous. Refuse rather than assume a country.
  return null
}

let client: TelnyxRTC | null = null
let activeCall: ReturnType<TelnyxRTC['newCall']> | null = null

/** Opens the WebSocket connection to Telnyx. No-op (returns false) if not configured. */
export function connectTelnyx(onStateChange: (state: TelnyxCallState) => void): boolean {
  const token = import.meta.env.VITE_TELNYX_LOGIN_TOKEN as string | undefined
  if (!token) return false
  if (client) return true // idempotent — React strict mode mounts effects twice

  client = new TelnyxRTC({ login_token: token, debug: false })

  client.on('telnyx.ready', () => onStateChange('idle'))
  client.on('telnyx.error', (err: unknown) => {
    console.error('Telnyx connection error', err)
    onStateChange('idle')
  })
  // Real call-state transitions arrive via telnyx.notification, not a
  // dedicated per-state event — see Telnyx's docs for the full notification
  // shape before relying on any state beyond the four handled here.
  client.on('telnyx.notification', (notification: { type: string; call?: { state?: string } }) => {
    if (notification.type !== 'callUpdate' || !notification.call) return
    const state = notification.call.state
    if (state === 'ringing') onStateChange('ringing')
    else if (state === 'active') onStateChange('active')
    else if (state === 'hangup' || state === 'destroy') {
      activeCall = null // far end hung up — drop the handle so mute/hangup no-op
      onStateChange('hangup')
    }
  })

  client.connect()
  return true
}

/**
 * Places an outbound call. Caller must check isTelnyxConfigured() first, and
 * must have already passed the Do Not Call / TPS gates — this function does no
 * screening of its own.
 */
export function placeTelnyxCall(opts: {
  /** E.164, e.g. +442890320107 — run it through toE164() first. */
  destinationNumber: string
  /** E.164 number to present as caller ID. Must be a number Telnyx has verified for the account. */
  callerNumber?: string
  callerName?: string
}): void {
  if (!client) throw new Error('Telnyx not connected — call connectTelnyx() first.')
  activeCall = client.newCall({
    destinationNumber: opts.destinationNumber,
    callerNumber: opts.callerNumber,
    callerName: opts.callerName,
    audio: true,
    video: false,
  })
}

/** Mirrors the dialer's mute toggle onto the live call. No-op when no call is up. */
export function setTelnyxMuted(muted: boolean): void {
  if (!activeCall) return
  if (muted) activeCall.muteAudio()
  else activeCall.unmuteAudio()
}

export function hangupTelnyxCall(): void {
  activeCall?.hangup()
  activeCall = null
}

export function disconnectTelnyx(): void {
  client?.disconnect()
  client = null
  activeCall = null
}
