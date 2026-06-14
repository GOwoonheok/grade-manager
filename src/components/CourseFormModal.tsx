import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { createCourse } from '../lib/courses'

export default function CourseFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [semester, setSemester] = useState('1')
  const [name, setName] = useState('')
  const [m, setM] = useState('30')
  const [f, setF] = useState('40')
  const [a, setA] = useState('20')
  const [x, setX] = useState('10') // 4번째 항목(토론) 가중치 기본 10%
  const [xlabel, setXlabel] = useState('토론') // 4번째 항목 표시명
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const sum = (Number(m) || 0) + (Number(f) || 0) + (Number(a) || 0) + (Number(x) || 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('과목명을 입력하세요.')
      return
    }
    if (Math.abs(sum - 100) > 0.01) {
      setError(`가중치 합이 100이어야 합니다 (현재 ${sum}).`)
      return
    }
    setBusy(true)
    try {
      const c = await createCourse({
        year: Number(year),
        semester: Number(semester),
        subject_name: name.trim(),
        midterm_weight: Number(m),
        final_weight: Number(f),
        attendance_weight: Number(a),
        extra_weight: Number(x) || 0,
        extra_label: xlabel.trim() || '토론',
      })
      onCreated(c.id)
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      setError(
        msg.includes('duplicate') || msg.includes('unique')
          ? '같은 연도·학기·과목명이 이미 있습니다.'
          : '생성 실패: ' + msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">새 과목 개설</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1">1학기</option>
                <option value="2">2학기</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">과목명</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 전자조달시스템의 이해"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              가중치 (합 100)
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <WeightInput label="중간" value={m} onChange={setM} />
              <WeightInput label="기말" value={f} onChange={setF} />
              <WeightInput label="출석" value={a} onChange={setA} />
              <WeightInput label={xlabel || '토론'} value={x} onChange={setX} />
              <span
                className={`text-sm px-2 py-2 ${
                  Math.abs(sum - 100) < 0.01 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                합 {sum}
              </span>
            </div>
            <div className="mt-2">
              <span className="block text-xs text-gray-500 mb-1">4번째 항목명 (예: 토론, 참여, 숙제)</span>
              <input
                type="text"
                value={xlabel}
                onChange={(e) => setXlabel(e.target.value)}
                className="w-40 px-2 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
            >
              {busy ? '생성 중...' : '개설'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WeightInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex-1">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm tabular-nums"
      />
    </div>
  )
}
