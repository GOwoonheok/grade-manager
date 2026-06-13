import { ChevronRight } from 'lucide-react'

// 학습 메뉴 타일 (학생/교수 공용 — 동일한 모양)
export default function StudyMenuTile({
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
      className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition text-left"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h2 className="font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="text-gray-300" size={20} />
    </button>
  )
}
