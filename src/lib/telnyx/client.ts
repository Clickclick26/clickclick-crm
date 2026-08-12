// Telnyx WebRTC scaffold — NOT wired into the dialer UI yet (App.tsx's
// startCall()/endCall() still simulate a call with local state, same as
// before this file existed). This exists so connecting real calling later
// is "drop in credentials," not "build the integration from scratch,"
// per Kathryn's request — she hasn't purchased Telnyx yet.
//
// Setup, once you have a Telnyx account:
//   1. Buy a number + create a "Call Control" / WebRTC Connection in the
//      Telnyx portal (Voice > Programmable Voice > Connections).
//   2. Generate a JWT login token for that connection (Telnyx portal has a
//      "Generate Credential" flow, or mint one server-side — do NOT put a
//      long-lived API key in frontend code, only a short-lived login token).
//   3. Set VITE_TELNYX_LOGIN_TOKEN in .env (see .env.example).
//   4. Wire isTelnyxConfigured() / connectTelnyx() into App.tsx's
//      startCall()/endCall() — that's the one piece deliberately left
//      undone here, since it touches the big shared call-state machine and
//      hasn't been testable against a real account.
//
// Built from Telnyx's public @telnyx/webrtc docs (TelnyxRTC class, newCall(),
// telnyx.notification events) — not verified against a live connection, since
// none exists yet. Confirm method/event names still match once you're signed
// in to https://developers.telnyx.com/docs/voice/webrtc/js-sdk.
import { TelnyxRTC } from '@telnyx/webrtc'

export type TelnyxCallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'hangup'

export function isTelnyxConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TELNYX_LOGIN_TOKEN)
}

let client: TelnyxRTC | null = null
let activeCall: ReturnType<TelnyxRTC['newCall']> | null = null

/** Opens the WebSocket connection to Telnyx. No-op (returns false) if not configured. */
export function connectTelnyx(onStateChange: (state: TelnyxCallState) => void): boolean {
  const token = import.meta.env.VITE_TELNYX_LOGIN_TOKEN as string | undefined
  if (!token) return false

  client = new TelnyxRTC({ login_token: token, debug: false })

  client.on('telnyx.ready', () => onStateChange('idle'))
  client.on('telnyx.error', (err: unknown) => {
    console.error('Telnyx connection error', err)
    onStateChange('idle')
  })
  // Real call-state transitions arrive via telnyx.notification, not a
  // dedicated per-state event — see Telnyx's docs for the full notification
  // shape before wiring this into the UI for real.
  client.on('telnyx.notification', (notification: { type: string; call?: { state?: string } }) => {
    if (notification.type !== 'callUpdate' || !notification.call) return
    const state = notification.call.state
    if (state === 'ringing') onStateChange('ringing')
    else if (state === 'active') onStateChange('active')
    else if (state === 'hangup' || state === 'destroy') onStateChange('hangup')
  })

  client.connect()
  return true
}

/** Places an outbound call. Caller must check isTelnyxConfigured() first. */
export function placeTelnyxCall(destinationNumber: string): void {
  if (!client) throw new Error('Telnyx not connected — call connectTelnyx() first.')
  activeCall = client.newCall({ destinationNumber, audio: true, video: false })
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
