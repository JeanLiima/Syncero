import { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginModal } from './components/LoginModal'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Footer } from './components/Footer'
import { Products } from './components/Products'
import { Comparison } from './components/Comparison'
import { CTA } from './components/CTA'
import { Pillars } from './components/Pillars'

const FLOW_URL  = import.meta.env.VITE_FLOW_URL;
const BOOKS_URL = import.meta.env.VITE_BOOKS_URL;

type UserType = 'company_user' | 'accountant'

// Cross-domain session transfer via hash — unavoidable when landing is the OAuth hub.
// The destination app's Supabase client (detectSessionInUrl: true) reads the hash
// and stores the session in its own localStorage automatically.
function redirectWithSession(session: Session, type: UserType) {
  const base = type === 'accountant' ? BOOKS_URL : FLOW_URL;
  console.log({books: BOOKS_URL, flow: FLOW_URL, base });

  const hash = new URLSearchParams({
    access_token:  session.access_token,
    refresh_token: session.refresh_token ?? '',
    token_type:    'bearer',
    expires_in:    String(session.expires_in ?? 3600),
    type:          'login',
  })
  window.location.replace(`${base}#${hash.toString()}`)
}

async function getProfileType(session: Session): Promise<UserType | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', session.user.id)
    .single()
  return data ? (data.user_type as UserType) : null
}

export default function App() {
  const [modalOpen, setModalOpen]           = useState(false)
  const [modalInitialMode, setModalInitialMode] = useState<'login' | 'register'>('login')
  const [callbackSession, setCallbackSession]   = useState<Session | null>(null)

  const openModal = (mode: 'login' | 'register' = 'login') => {
    setModalInitialMode(mode)
    setModalOpen(true)
  }

  // ── Auth hub ──────────────────────────────────────────────────
  // Landing is the OAuth hub for the whole monorepo:
  //   1. Google OAuth redirects back here with #access_token=... in the URL
  //   2. Supabase (detectSessionInUrl: true) reads the hash, stores the session
  //      in landing's localStorage, cleans the URL (→ shows /#), then fires
  //      INITIAL_SESSION and SIGNED_IN in quick succession.
  //   3. We look up the user's profile to determine the destination app.
  //   4. redirectWithSession() builds the same hash tokens and sets
  //      window.location to `{flowUrl}#access_token=...` or `{booksUrl}#...`.
  //   5. The destination app's Supabase client also has detectSessionInUrl: true,
  //      so it reads the hash, stores the session in its OWN localStorage, and
  //      the user is authenticated — without any cross-domain localStorage write.
  //
  // Why a single onAuthStateChange (no getSession() effect)?
  //   - onAuthStateChange always fires INITIAL_SESSION on mount, which covers the
  //     "existing session" case just as well as getSession().
  //   - Using both creates a triple-call race: getSession (1×) + INITIAL_SESSION
  //     (1×) + SIGNED_IN (1×) = 3 concurrent getProfileType + redirectWithSession
  //     calls for the same session.
  //   - sessionHandled ref prevents the INITIAL_SESSION + SIGNED_IN double-fire.
  const sessionHandled = useRef(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle events that carry a session
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return
      if (!session) return
      // Guard: INITIAL_SESSION + SIGNED_IN both fire for an OAuth callback;
      // process only the first one.
      if (sessionHandled.current) return
      sessionHandled.current = true

      try {
        const type = await getProfileType(session)
        if (!type) { setCallbackSession(session); setModalOpen(true); return }
        redirectWithSession(session, type)
      } catch {
        // Allow a retry on transient DB/network errors
        sessionHandled.current = false
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar   onLogin={() => openModal('login')} />
      <Hero     onLogin={() => openModal('login')} />
      <Products onLogin={() => openModal('login')} />
      <Pillars />
      <Comparison />
      <CTA      onRegister={() => openModal('register')} />
      <Footer />
      {modalOpen && (
        <LoginModal
          onClose={() => { setModalOpen(false); setCallbackSession(null) }}
          callbackSession={callbackSession}
          initialMode={modalInitialMode}
        />
      )}
    </div>
  )
}
