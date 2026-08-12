import { useState } from 'react'
import { signInWithPassword, signUpWithPassword } from '../lib/supabase/auth'

export default function Login() {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'sign_in') {
        await signInWithPassword(email, password)
      } else {
        const { signedIn } = await signUpWithPassword(email, password, name)
        // If no confirmation is required, Supabase returns a session immediately;
        // AuthGate's auth-state listener picks it up and swaps to the app itself.
        if (!signedIn) setCheckEmail(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <img
          className="brand-logo-stacked"
          src={`${import.meta.env.BASE_URL}brand/clickclick-logo-stacked-black.png`}
          alt="ClickClick"
        />
        <h3 style={{ marginTop: 16 }}>
          {mode === 'sign_in' ? 'Sign in to CRM' : 'Create your account'}
        </h3>

        {checkEmail ? (
          <p className="auth-hint">
            Check <strong>{email}</strong> for a confirmation link, then sign in below.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'sign_up' && (
              <input
                className="auth-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            {error && <div className="auth-error">{error}</div>}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Sign up'}
            </button>
          </form>
        )}

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode((m) => (m === 'sign_in' ? 'sign_up' : 'sign_in'))
            setError(null)
            setCheckEmail(false)
          }}
        >
          {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
