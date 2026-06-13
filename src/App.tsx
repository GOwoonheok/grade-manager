import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// 라우트 단위 코드분할: 역할별로 자기 페이지 청크만 로드
const LoginPage = lazy(() => import('./pages/LoginPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const StudentPage = lazy(() => import('./pages/StudentPage'))

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-500">
    불러오는 중...
  </div>
)

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="professor">
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/me"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
