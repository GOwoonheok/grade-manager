import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  FileImage,
  GraduationCap,
  Key,
  LogOut,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { calcFinalScore, supabase } from '../lib/supabase'
import {
  getCourseStats,
  listMyEnrollments,
  type CourseStats,
  type MyEnrollment,
} from '../lib/courses'
import AnswerSheetGallery from '../components/AnswerSheetGallery'
import BrandHeader from '../components/BrandHeader'

export default function StudentPage() {
  const { profile, signOut } = useAuth()
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMyEnrollments()
      .then((e) => setEnrollments(e))
      .catch(() => setEnrollments([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandHeader />
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

        {loading ? (
          <div className="text-center text-gray-500 py-8">불러오는 중...</div>
        ) : enrollments.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
            수강 중인 과목이 없습니다.
          </section>
        ) : (
          enrollments.map((en) => (
            <CourseBlock key={en.id} en={en} studentId={profile?.id ?? ''} />
          ))
        )}

        <PasswordChange />
      </main>
    </div>
  )
}

function CourseBlock({ en, studentId }: { en: MyEnrollment; studentId: string }) {
  const c = en.course
  const [stats, setStats] = useState<CourseStats | null>(null)

  useEffect(() => {
    if (c) getCourseStats(c.id).then(setStats)
  }, [c?.id])

  const finalScore = useMemo(() => {
    if (!c) return null
    return calcFinalScore(en, {
      midterm_weight: c.midterm_weight,
      final_weight: c.final_weight,
      attendance_weight: c.attendance_weight,
    })
  }, [en, c])

  const published = c?.scores_published ?? false

  // 출석 세부 횟수(출석/지각/결석) — 입력된 경우만 표시. 지각 N회=결석 1회 환산 기준 안내.
  const attDetail =
    en.att_present != null || en.att_late != null || en.att_absent != null
      ? `출석 ${en.att_present ?? 0} · 지각 ${en.att_late ?? 0} · 결석 ${en.att_absent ?? 0}` +
        (c?.late_per_absent ? ` (지각 ${c.late_per_absent}회=결석 1회)` : '')
      : ''

  return (
    <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="text-indigo-600" size={18} />
        <h3 className="font-semibold text-gray-800">
          {c ? `${c.year}-${c.semester}학기 · ${c.subject_name}` : '과목'}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ScoreCard label="중간" value={en.midterm} color="gray" icon={<GraduationCap size={18} />} />
        <ScoreCard label="기말" value={en.final} color="gray" icon={<GraduationCap size={18} />} />
        <ScoreCard label="출석" value={en.attendance} color="gray" icon={<CalendarCheck size={18} />} sub={attDetail} />
      </div>

      {/* 최종: 항상 환산식 안내, 값은 공개 전이면 '공개전' */}
      <div className="grid grid-cols-1 gap-3">
        <ScoreCard
          label="최종"
          value={published ? finalScore : '공개전'}
          color="indigo"
          icon={<Sparkles size={18} />}
          sub={c ? `중간(${c.midterm_weight}%) + 기말(${c.final_weight}%) + 출석/토론(${c.attendance_weight}%)` : ''}
        />
      </div>
      {published && (
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard
            label="반 평균 (최종)"
            value={stats?.avg_score ?? null}
            color="gray"
            icon={<Users size={18} />}
            sub={stats?.total_count ? `${stats.total_count}명 기준` : ''}
          />
          <ScoreCard
            label="반 최고점 (최종)"
            value={stats?.max_score ?? null}
            color="amber"
            icon={<Trophy size={18} />}
          />
        </div>
      )}

      <div className="space-y-3 pt-1 border-t">
        <div className="flex items-center gap-2">
          <FileImage className="text-indigo-600" size={16} />
          <span className="text-sm font-semibold text-gray-800">답안지</span>
        </div>
        <AnswerSheetGallery courseId={c?.id ?? ''} studentId={studentId} examType="midterm" readOnly />
        <AnswerSheetGallery courseId={c?.id ?? ''} studentId={studentId} examType="final" readOnly />
      </div>
    </section>
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
  value: number | string | null
  color: 'indigo' | 'gray' | 'amber'
  icon: React.ReactNode
  sub?: string
}) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-700',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  const valueColor = color === 'indigo' ? 'text-indigo-700' : 'text-gray-900'
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`rounded-lg p-1 ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>
        {value === null ? '—' : typeof value === 'number' ? value : <span className="text-lg">{value}</span>}
        {typeof value === 'number' && <span className="text-sm text-gray-400 ml-1">점</span>}
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
    setTimeout(() => signOut(), 1500)
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
              className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2.5 border ${
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
