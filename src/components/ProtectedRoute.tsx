import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/supabase'

type Props = {
  children: ReactNode
  requiredRole?: Role
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (requiredRole && profile?.role !== requiredRole) {
    const fallback = profile?.role === 'professor' ? '/admin' : '/me'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
