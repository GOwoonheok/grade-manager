import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import StudentStudy from '../components/StudentStudy'
import AdminStudy from '../components/AdminStudy'

export default function StudyPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'professor' || profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <button
            onClick={() => navigate('/home')}
            className="text-gray-500 hover:text-gray-800 p-1 -ml-1 rounded hover:bg-gray-100"
            aria-label="홈으로"
          >
            <ArrowLeft size={20} />
          </button>
          <BookOpen className="text-indigo-600" size={20} />
          <h1 className="text-lg font-semibold text-gray-800">
            공공조달관리 학습
            {isAdmin && <span className="text-sm font-normal text-gray-400 ml-2">관리</span>}
          </h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {isAdmin ? <AdminStudy /> : <StudentStudy />}
      </main>
    </div>
  )
}
