import {
  createContext,
  useContext,
  useEffect,
  useRef,
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

// 프로필 조회 결과를 "성공(행 유무 포함)" vs "실패"로 구분.
// 실패 시 기존 프로필을 유지해야 하므로(교수 권한이 순단으로 풀리는 것 방지) 명확히 나눈다.
type FetchResult = { ok: true; profile: Student | null } | { ok: false }

const fetchProfile = async (userId: string): Promise<FetchResult> => {
  // 모바일 네트워크 순단 내성: 타임아웃 8s + 최대 3회 재시도(점증 backoff)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await withTimeout(
        Promise.resolve(
          supabase.from('students').select('*').eq('id', userId).maybeSingle(),
        ),
        8000,
        'fetchProfile',
      )
      if (!error) return { ok: true, profile: (data as Student) ?? null }
      console.error('[Auth] fetchProfile error:', error.message)
    } catch (err) {
      console.error('[Auth] fetchProfile threw:', err)
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
  }
  return { ok: false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  // 프로필을 성공적으로 불러온 사용자 id. 같은 사용자의 토큰 갱신 이벤트에선 재조회를 건너뛴다.
  const loadedForId = useRef<string | null>(null)
  // 이벤트 리스너에서 최신 세션을 읽기 위한 ref(클로저 stale 방지).
  const sessionRef = useRef<Session | null>(null)

  const applySession = (s: Session | null) => {
    sessionRef.current = s
    setSession(s)
  }

  const loadProfile = async (userId: string) => {
    const res = await fetchProfile(userId)
    if (res.ok) {
      setProfile(res.profile)
      // 행이 있을 때만 "로드 완료"로 표시 → 없거나 실패면 이후(이벤트·탭복귀)에 재시도 여지를 남김
      loadedForId.current = res.profile ? userId : null
    }
    // res.ok === false(조회 실패): 기존 profile 유지 — 교수 권한을 절대 떨어뜨리지 않음
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'getSession',
        )
        if (error) console.error('[Auth] getSession error:', error.message)
        if (cancelled) return
        applySession(data?.session ?? null)
        if (data?.session) await loadProfile(data.session.user.id)
      } catch (err) {
        console.error('[Auth] init threw:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return
      applySession(s)
      if (!s) {
        // 실제 로그아웃에서만 프로필 초기화
        loadedForId.current = null
        setProfile(null)
        return
      }
      // 이미 이 사용자의 프로필을 보유 중이면(토큰 갱신 등) 재조회 생략 → 순단으로 인한 강등 방지
      if (loadedForId.current !== s.user.id) {
        await loadProfile(s.user.id)
      }
    })

    // 자가복구: 탭 복귀(focus/가시성) 시 세션은 있는데 프로필이 비어 있으면(최초 로드 실패) 재조회.
    const recover = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      const s = sessionRef.current
      if (s && loadedForId.current === null) void loadProfile(s.user.id)
    }
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('focus', recover)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('focus', recover)
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session) {
      loadedForId.current = null // 강제 재조회(예: 비밀번호 변경 후 must_change_password 갱신)
      await loadProfile(session.user.id)
    }
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
