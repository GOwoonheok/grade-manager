import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/supabase'

type Props = {
  children: ReactNode
  requiredRole?: Role
  skipForceCheck?: boolean
}

export default function ProtectedRoute({ children, requiredRole, skipForceCheck }: Props) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // 최초 로그인 강제 비밀번호 변경 (개인정보 보호)
  if (!skipForceCheck && profile?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
