import { Image as ImageIcon, Pencil, Trash2 } from 'lucide-react'
import { calcFinalScore, type Course } from '../lib/supabase'
import type { EnrollmentRow } from '../lib/courses'

type Props = {
  rows: EnrollmentRow[]
  course: Course | null
  flags: Record<string, { midterm: boolean; final: boolean }>
  onEdit: (r: EnrollmentRow) => void
  onDelete: (r: EnrollmentRow) => void
}

export default function StudentList({ rows, course, flags, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        이 과목에 등록된 학생이 없습니다. "학생 추가"로 등록하세요.
      </div>
    )
  }

  const w = course
    ? {
        midterm_weight: course.midterm_weight,
        final_weight: course.final_weight,
        attendance_weight: course.attendance_weight,
      }
    : null

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600 border-b">
            <th className="px-4 py-3 font-semibold">학번</th>
            <th className="px-4 py-3 font-semibold">이름</th>
            <th className="px-4 py-3 font-semibold hidden md:table-cell">학과</th>
            <th className="px-4 py-3 font-semibold hidden lg:table-cell">연락처</th>
            <th className="px-4 py-3 font-semibold text-right">중간</th>
            <th className="px-4 py-3 font-semibold text-right">기말</th>
            <th className="px-4 py-3 font-semibold text-right">출석</th>
            <th className="px-4 py-3 font-semibold text-right">최종</th>
            <th className="px-4 py-3 font-semibold w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const finalScore = w ? calcFinalScore(r, w) : null
            const s = r.student
            const f = s ? flags[s.id] : undefined
            return (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-700">{s?.student_number}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-gray-900">{s?.name}</span>
                    <button
                      onClick={() => onEdit(r)}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="수정"
                    >
                      <Pencil size={14} />
                    </button>
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{s?.department}</td>
                <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">{s?.phone}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  <span className="inline-flex items-center justify-end gap-1">
                    {r.midterm ?? '-'}
                    {f?.midterm && <ImageIcon size={15} className="text-indigo-500" aria-label="답안지 이미지 있음" />}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  <span className="inline-flex items-center justify-end gap-1">
                    {r.final ?? '-'}
                    {f?.final && <ImageIcon size={15} className="text-indigo-500" aria-label="답안지 이미지 있음" />}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.attendance ?? '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-indigo-700">{finalScore ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => onDelete(r)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
