import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GraduationCap, LogIn } from 'lucide-react'
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
    return <Navigate to={profile.role === 'professor' ? '/admin' : '/me'} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const email = studentNumberToEmail(studentNumber.trim())
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      const msg = signInError.message ?? ''
      console.error('[Login] signIn error:', signInError)
      if (msg.includes('Email not confirmed'))
        setError(
          '이메일 확인이 안 된 계정입니다. Supabase에서 이메일 확인을 비활성화하세요.',
        )
      else if (msg.includes('Invalid login credentials'))
        setError('학번 또는 비밀번호가 올바르지 않습니다.')
      else setError('로그인 실패: ' + msg)
      setSubmitting(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('로그인에 실패했습니다.')
      setSubmitting(false)
      return
    }

    const { data: prof } = await supabase
      .from('students')
      .select('role')
      .eq('id', user.id)
      .single()

    setSubmitting(false)
    navigate(prof?.role === 'professor' ? '/admin' : '/me', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-100 text-indigo-600 rounded-full p-3 mb-3">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">학생 성적 관리</h1>
          <p className="text-sm text-gray-500 mt-1">학번과 비밀번호로 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              학번
            </label>
            <input
              type="text"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="예: 20240001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="초기 비밀번호: 전화번호"
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
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            <LogIn size={18} />
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
