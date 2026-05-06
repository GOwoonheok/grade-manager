import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Key,
  LogOut,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, type ClassStats } from '../lib/supabase'

export default function StudentPage() {
  const { profile, signOut } = useAuth()
  const [stats, setStats] = useState<ClassStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    supabase
      .rpc('get_class_stats')
      .single()
      .then(({ data }) => {
        setStats((data as ClassStats) ?? null)
        setStatsLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-indigo-600" size={22} />
            <h1 className="text-lg font-semibold text-gray-800">내 성적</h1>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 본인 정보 */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">안녕하세요</p>
          <h2 className="text-2xl font-bold text-gray-900">
            {profile?.name}
            <span className="text-base font-normal text-gray-500 ml-2">
              {profile?.student_number}
            </span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">{profile?.department}</p>
        </section>

        {/* 점수 카드 */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ScoreCard
            label="내 점수"
            value={profile?.score ?? null}
            color="indigo"
            icon={<GraduationCap size={20} />}
          />
          <ScoreCard
            label="반 평균"
            value={statsLoading ? null : stats?.avg_score ?? null}
            color="gray"
            icon={<Users size={20} />}
            sub={!statsLoading && stats ? `${stats.total_count}명 기준` : ''}
          />
          <ScoreCard
            label="반 최고점"
            value={statsLoading ? null : stats?.max_score ?? null}
            color="amber"
            icon={<Trophy size={20} />}
          />
        </section>

        {/* 비밀번호 변경 */}
        <PasswordChange />
      </main>
    </div>
  )
}

function ScoreCard({
  label,
  value,
  color,
  icon,
  sub,
}: {
  label: string
  value: number | null
  color: 'indigo' | 'gray' | 'amber'
  icon: React.ReactNode
  sub?: string
}) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-700',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`rounded-lg p-1.5 ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold tabular-nums text-gray-900">
        {value === null ? '—' : value}
        {value !== null && <span className="text-base text-gray-400 ml-1">점</span>}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function PasswordChange() {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (pwd.length < 6) {
      setMsg({ type: 'err', text: '비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (pwd !== confirm) {
      setMsg({ type: 'err', text: '비밀번호 확인이 일치하지 않습니다.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) {
      setBusy(false)
      setMsg({ type: 'err', text: '비밀번호 변경 실패: ' + error.message })
      return
    }
    setMsg({
      type: 'ok',
      text: '비밀번호가 변경되었습니다. 잠시 후 로그인 화면으로 이동합니다...',
    })
    setPwd('')
    setConfirm('')
    setTimeout(() => {
      signOut()
    }, 1500)
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <Key size={16} />
        비밀번호 변경
        <span className="text-gray-400 text-xs">({open ? '닫기' : '열기'})</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 max-w-sm">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          {msg && (
            <div
              role="alert"
              aria-live="polite"
              className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 border animate-[fadeIn_.15s_ease-out] ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {msg.type === 'ok' ? (
                <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
              )}
              <p className="flex-1 font-medium leading-snug">{msg.text}</p>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium text-sm"
          >
            {busy ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      )}
    </section>
  )
}
