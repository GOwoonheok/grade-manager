import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ForcePasswordPage() {
  const { signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pwd.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (pwd !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setBusy(true)
    const { error: e1 } = await supabase.auth.updateUser({ password: pwd })
    if (e1) {
      setBusy(false)
      setError('변경 실패: ' + e1.message)
      return
    }
    const { error: e2 } = await supabase.rpc('clear_must_change')
    if (e2) {
      setBusy(false)
      setError('상태 갱신 실패: ' + e2.message)
      return
    }
    await refreshProfile()
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="bg-amber-100 text-amber-600 rounded-full p-3 mb-3">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">비밀번호 변경이 필요합니다</h1>
          <p className="text-sm text-gray-500 mt-1">
            개인정보 보호를 위해 최초 로그인 시 비밀번호를 변경해 주세요.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            autoFocus
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-2.5 rounded-lg"
          >
            <Key size={18} />
            {busy ? '변경 중...' : '비밀번호 변경'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  )
}
