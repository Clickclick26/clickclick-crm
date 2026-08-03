import { useCurrentAgent, signOut } from '../lib/supabase/auth'
import Login from './Login'
import App from '../App'

export default function AuthGate() {
  const { agent, loading } = useCurrentAgent()

  if (loading) {
    return <div className="auth-screen">Loading…</div>
  }

  if (!agent) {
    return <Login />
  }

  return <App currentAgent={agent} onSignOut={signOut} />
}
