// 로그인 후 화면 상단 브랜드 바 (공공조달학 전공). 로그인(첫) 화면에는 쓰지 않음.
export default function BrandHeader() {
  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <img
          src="/kmcu-logo.avif"
          alt="공공조달학 전공"
          className="h-9 w-auto shrink-0"
        />
        <div className="leading-tight">
          <p className="text-sm font-bold text-indigo-700">공공조달학 전공</p>
          <p className="text-[11px] text-gray-400">성적 · 학습 관리 시스템</p>
        </div>
      </div>
    </div>
  )
}
