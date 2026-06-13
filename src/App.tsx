import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const StudentPage = lazy(() => import('./pages/StudentPage'))
const StudyPage = lazy(() => import('./pages/StudyPage'))
const ForcePasswordPage = lazy(() => import('./pages/ForcePasswordPage'))

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
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/study"
              element={
                <ProtectedRoute>
                  <StudyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute skipForceCheck>
                  <ForcePasswordPage />
                </ProtectedRoute>
              }
            />
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
