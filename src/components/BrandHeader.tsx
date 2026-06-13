import { useNavigate } from 'react-router-dom'

// 로그인 후 화면 상단 브랜드 바 (공공조달학 전공). 클릭 시 홈(/home)으로 이동.
export default function BrandHeader() {
  const navigate = useNavigate()
  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-2.5">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-3 hover:opacity-80 transition"
          title="홈으로"
        >
          <img src="/kmcu-logo.avif" alt="공공조달학 전공" className="h-9 w-auto shrink-0" />
          <div className="leading-tight text-left">
            <p className="text-sm font-bold text-indigo-700">공공조달학 전공</p>
            <p className="text-[11px] text-gray-400">성적 · 학습 관리 시스템</p>
          </div>
        </button>
      </div>
    </div>
  )
}
