import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { listAnswerSheets, signedUrls } from '../lib/answerSheets'
import type { ExamType } from '../lib/supabase'

type Props = {
  open: boolean
  courseId: string | null
  studentId: string | null
  studentName?: string
  examType: ExamType
  onClose: () => void
}

const EXAM_LABEL: Record<ExamType, string> = { midterm: '중간', final: '기말' }

// 명단에서 답안지 아이콘 클릭 시, 해당 학생/시험의 답안지 이미지를 크게 보여주는 팝업.
export default function AnswerSheetViewer({ open, courseId, studentId, studentName, examType, onClose }: Props) {
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !studentId || !courseId) return
    setLoading(true)
    setUrls([])
    ;(async () => {
      try {
        const sheets = await listAnswerSheets(courseId, studentId, examType)
        setUrls(await signedUrls(sheets.map((s) => s.path)))
      } catch {
        setUrls([])
      } finally {
        setLoading(false)
      }
    })()
  }, [open, courseId, studentId, examType])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {studentName} · {EXAM_LABEL[examType]} 답안지
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3 bg-gray-50">
          {loading ? (
            <p className="text-center text-gray-500 py-10">불러오는 중...</p>
          ) : urls.length === 0 ? (
            <p className="text-center text-gray-400 py-10">등록된 답안지가 없습니다.</p>
          ) : (
            urls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" title="새 탭에서 원본 보기">
                <img src={u} alt={`답안지 ${i + 1}`} className="w-full rounded-lg border border-gray-200 bg-white" />
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
