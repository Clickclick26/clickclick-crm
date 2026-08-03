import { useCurrentAgent, signOut } from '../lib/supabase/auth'
import Login from './Login'
import App from '../App'

export default function AuthGate() {
  const { agent, loading, error } = useCurrentAgent()

  if (loading) {
    return <div className="auth-screen">Loading…</div>
  }

  if (error) {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <h3>Couldn't sign you in</h3>
          <p className="auth-hint">{error}</p>
          <button className="btn primary" onClick={() => signOut()}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (!agent) {
    return <Login />
  }

  return <App currentAgent={agent} onSignOut={signOut} />
}
