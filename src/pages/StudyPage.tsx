import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'

// 공공조달관리(조달관리사 플래시카드) 학습 — 다음 단계에서 기능 구현 예정.
export default function StudyPage() {
  const navigate = useNavigate()
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
          <h1 className="text-lg font-semibold text-gray-800">공공조달관리 학습</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 items-center justify-center mb-4">
          <BookOpen size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">조달관리사 학습 (플래시카드)</h2>
        <p className="text-gray-500 mt-2">
          과목별 플래시카드 학습 기능을 준비 중입니다. 곧 제공됩니다.
        </p>
      </main>
    </div>
  )
}
