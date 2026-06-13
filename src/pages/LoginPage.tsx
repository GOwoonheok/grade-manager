import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { supabase, studentNumberToEmail } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (session && profile) {
    return <Navigate to="/home" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const email = studentNumberToEmail(studentNumber.trim())
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const msg = signInError.message ?? ''
      if (msg.includes('Email not confirmed'))
        setError('이메일 확인이 안 된 계정입니다. Supabase에서 이메일 확인을 비활성화하세요.')
      else if (msg.includes('Invalid login credentials'))
        setError('학번 또는 비밀번호가 올바르지 않습니다.')
      else setError('로그인 실패: ' + msg)
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('로그인에 실패했습니다.')
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* 브랜드 */}
          <div className="text-center mb-6">
            <img
              src="/kmcu-logo.avif"
              alt="계명문화대학교"
              className="h-16 w-auto mx-auto mb-3 bg-white/95 rounded-2xl p-2 shadow-lg"
            />
            <p className="text-indigo-100 text-sm">계명문화대학교 · 공공조달학전공</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mt-1">
              Smart<span className="text-amber-300">PPS</span>
            </h1>
            <p className="text-indigo-100 text-sm mt-1">스마트 전자조달 성적 · 학습 플랫폼</p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-2xl shadow-2xl p-7">
            <h2 className="text-lg font-bold text-gray-800">로그인</h2>
            <p className="text-sm text-gray-400 mt-0.5 mb-5">학번과 비밀번호로 로그인하세요</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학번</label>
                <input
                  type="text"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="예: 2620700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="초기: 학번 + 전화 뒤 4자리"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg transition"
              >
                <LogIn size={18} />
                {submitting ? '로그인 중...' : '로그인'}
              </button>
            </form>
          </div>

          <p className="text-center text-indigo-200 text-xs mt-5">
            © 계명문화대학교 공공조달학전공 · SmartPPS
          </p>
        </div>
      </div>
    </div>
  )
}
