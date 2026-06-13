import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, GraduationCap, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const gradesPath = profile?.role === 'professor' ? '/admin' : '/me'

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50">
      <header className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">{profile?.name}님 환영합니다</span>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white/70"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        <div className="flex flex-col items-center text-center mb-10">
          <img
            src="/kmcu-logo.avif"
            alt="공공조달학 전공"
            className="h-24 w-auto mb-4 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-gray-900">공공조달학 전공</h1>
          <p className="text-gray-500 mt-1">성적 · 학습 관리 시스템</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Tile
            icon={<GraduationCap size={28} />}
            title="성적확인"
            desc={
              profile?.role === 'professor'
                ? '과목 · 학생 성적 관리'
                : '내 과목별 성적 · 답안지'
            }
            onClick={() => navigate(gradesPath)}
          />
          <Tile
            icon={<BookOpen size={28} />}
            title="공공조달관리"
            desc="조달관리사 학습 (플래시카드)"
            onClick={() => navigate('/study')}
          />
        </div>
      </main>
    </div>
  )
}

function Tile({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 p-6 text-left transition flex flex-col gap-4"
    >
      <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <ChevronRight
            className="text-gray-300 group-hover:text-indigo-500 transition"
            size={20}
          />
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </button>
  )
}
