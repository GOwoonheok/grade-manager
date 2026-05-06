import { Pencil, Trash2 } from 'lucide-react'
import type { Student } from '../lib/supabase'

type Props = {
  students: Student[]
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
}

export default function StudentList({ students, onEdit, onDelete }: Props) {
  if (students.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        등록된 학생이 없습니다. 우측 상단 버튼으로 추가해주세요.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600 border-b">
            <th className="px-4 py-3 font-semibold">학번</th>
            <th className="px-4 py-3 font-semibold">이름</th>
            <th className="px-4 py-3 font-semibold">학과</th>
            <th className="px-4 py-3 font-semibold hidden sm:table-cell">연락처</th>
            <th className="px-4 py-3 font-semibold text-right">점수</th>
            <th className="px-4 py-3 font-semibold w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-gray-700">
                {s.student_number}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-3 text-gray-700">{s.department}</td>
              <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">
                {s.phone}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {s.score ?? '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(s)}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    title="수정"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(s)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
