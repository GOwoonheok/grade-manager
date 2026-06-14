import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  addStudentToCourse,
  updateEnrollmentScores,
  type EnrollmentRow,
} from '../lib/courses'
import AnswerSheetGallery from './AnswerSheetGallery'
import { getAnswerSheetFlags } from '../lib/answerSheets'

type Props = {
  open: boolean
  courseId: string | null
  initial: EnrollmentRow | null
  extraLabel?: string // 4번째 항목 표시명(토론/참여 등)
  onClose: () => void
  onSaved: () => void
}

const empty = {
  student_number: '',
  name: '',
  department: '',
  phone: '',
  midterm: '',
  final: '',
  attendance: '',
  extra: '100', // 토론 만점(100) 기본 — 가중치 10%면 최종 10점 기여
}
type FormState = typeof empty

export default function StudentFormModal({
  open,
  courseId,
  initial,
  extraLabel = '토론',
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initial
  const [form, setForm] = useState<FormState>(empty)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [imgFlags, setImgFlags] = useState<{ midterm: boolean; final: boolean }>({ midterm: false, final: false })

  useEffect(() => {
    if (initial) {
      const s = initial.student
      setForm({
        student_number: s?.student_number ?? '',
        name: s?.name ?? '',
        department: s?.department ?? '',
        phone: s?.phone ?? '',
        midterm: initial.midterm?.toString() ?? '',
        final: initial.final?.toString() ?? '',
        attendance: initial.attendance?.toString() ?? '',
        extra: initial.extra?.toString() ?? '',
      })
    } else {
      setForm(empty)
    }
    setError(null)
  }, [initial, open])

  useEffect(() => {
    if (open && initial?.student_id && courseId) {
      getAnswerSheetFlags(courseId, [initial.student_id])
        .then((m) => setImgFlags(m[initial.student_id] ?? { midterm: false, final: false }))
        .catch(() => {})
    } else {
      setImgFlags({ midterm: false, final: false })
    }
  }, [open, initial, courseId])

  if (!open) return null

  const upd = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const parseScore = (
    raw: string,
    label: string,
  ): { value: number | null; error: string | null } => {
    const s = raw.trim()
    if (s === '') return { value: null, error: null }
    const n = Number(s)
    if (isNaN(n) || n < 0 || n > 100)
      return { value: null, error: `${label} 점수는 0~100 사이 숫자여야 합니다.` }
    return { value: n, error: null }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const m = parseScore(form.midterm, '중간')
    const f = parseScore(form.final, '기말')
    const a = parseScore(form.attendance, '출석')
    const x = parseScore(form.extra, extraLabel)
    const firstErr = m.error || f.error || a.error || x.error
    if (firstErr) {
      setError(firstErr)
      setSubmitting(false)
      return
    }
    try {
      if (isEdit && initial) {
        const { error: pErr } = await supabase
          .from('students')
          .update({
            name: form.name.trim(),
            department: form.department.trim(),
            phone: form.phone.trim(),
          })
          .eq('id', initial.student_id)
        if (pErr) throw pErr
        await updateEnrollmentScores(initial.id, {
          midterm: m.value,
          final: f.value,
          attendance: a.value,
          extra: x.value,
        })
      } else {
        if (!courseId) throw new Error('과목이 선택되지 않았습니다.')
        await addStudentToCourse(courseId, {
          student_number: form.student_number,
          name: form.name,
          department: form.department,
          phone: form.phone,
          midterm: m.value,
          final: f.value,
          attendance: a.value,
          extra: x.value,
        })
      }
      onSaved()
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('already'))
        setError('이미 이 과목에 등록된 학번입니다.')
      else setError('저장 실패: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? '학생 정보 수정' : '학생 추가 (이 과목)'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <Field label="학번" required>
            <input
              type="text"
              value={form.student_number}
              onChange={(e) => upd('student_number', e.target.value)}
              required
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="2620700"
            />
          </Field>

          <Field label="이름" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => upd('name', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="홍길동"
            />
          </Field>

          <Field label="학과" required>
            <input
              type="text"
              value={form.department}
              onChange={(e) => upd('department', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="컴퓨터공학과"
            />
          </Field>

          <Field
            label="연락처"
            required
            hint={!isEdit ? '신규 학생의 초기 비밀번호로 사용됩니다' : undefined}
          >
            <input
              type="text"
              value={form.phone}
              onChange={(e) => upd('phone', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="010-1234-5678"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={imgFlags.midterm ? '중간 (이미지)' : '중간'} hint="0~100">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.midterm}
                onChange={(e) => upd('midterm', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
            <Field label={imgFlags.final ? '기말 (이미지)' : '기말'} hint="0~100">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.final}
                onChange={(e) => upd('final', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
            <Field label="출석" hint="0~100">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.attendance}
                onChange={(e) => upd('attendance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
            <Field label={extraLabel} hint="0~100">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.extra}
                onChange={(e) => upd('extra', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
          </div>

          {isEdit && initial?.student && courseId && (
            <div className="space-y-4 pt-2 border-t">
              <AnswerSheetGallery courseId={courseId} studentId={initial.student.id} examType="midterm" />
              <AnswerSheetGallery courseId={courseId} studentId={initial.student.id} examType="final" />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}
