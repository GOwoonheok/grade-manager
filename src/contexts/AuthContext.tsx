import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Student } from '../lib/supabase'

type AuthState = {
  session: Session | null
  profile: Student | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Auth] timeout: ${label} (${ms}ms)`)), ms),
    ),
  ])

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase.from('students').select('*').eq('id', userId).maybeSingle(),
        ),
        5000,
        'fetchProfile',
      )
      if (error) console.error('[Auth] fetchProfile error:', error.message)
      setProfile((data as Student) ?? null)
    } catch (err) {
      console.error('[Auth] fetchProfile threw:', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          'getSession',
        )
        if (error) console.error('[Auth] getSession error:', error.message)
        if (cancelled) return
        setSession(data?.session ?? null)
        if (data?.session) await fetchProfile(data.session.user.id)
      } catch (err) {
        console.error('[Auth] init threw:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return
      setSession(s)
      if (s) await fetchProfile(s.user.id)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session) await fetchProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
