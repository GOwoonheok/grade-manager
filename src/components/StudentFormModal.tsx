import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import {
  supabase,
  supabaseSignup,
  studentNumberToEmail,
  type Student,
} from '../lib/supabase'

type Props = {
  open: boolean
  initial: Student | null
  onClose: () => void
  onSaved: () => void
}

const empty = {
  student_number: '',
  name: '',
  department: '',
  phone: '',
  score: '',
}

export default function StudentFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initial
  const [form, setForm] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        student_number: initial.student_number,
        name: initial.name,
        department: initial.department,
        phone: initial.phone,
        score: initial.score?.toString() ?? '',
      })
    } else {
      setForm(empty)
    }
    setError(null)
  }, [initial, open])

  if (!open) return null

  const upd = (k: keyof typeof empty, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const scoreNum = form.score === '' ? null : Number(form.score)
    if (scoreNum !== null && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100)) {
      setError('점수는 0~100 사이 숫자여야 합니다.')
      setSubmitting(false)
      return
    }

    try {
      if (isEdit && initial) {
        const { error: updErr } = await supabase
          .from('students')
          .update({
            student_number: form.student_number.trim(),
            name: form.name.trim(),
            department: form.department.trim(),
            phone: form.phone.trim(),
            score: scoreNum,
          })
          .eq('id', initial.id)
        if (updErr) throw updErr
      } else {
        const studentNumber = form.student_number.trim()
        const phone = form.phone.trim()
        const email = studentNumberToEmail(studentNumber)

        // 1. Auth 사용자 생성 (보조 클라이언트로 — 우리 세션 안 바뀜)
        const { data: signUpData, error: signUpErr } =
          await supabaseSignup.auth.signUp({
            email,
            password: phone,
          })
        if (signUpErr) throw signUpErr
        const newUserId = signUpData.user?.id
        if (!newUserId) throw new Error('사용자 ID를 가져오지 못했습니다.')

        // 2. students 테이블에 등록 (교수 세션으로 — RLS 통과)
        const { error: insErr } = await supabase.from('students').insert({
          id: newUserId,
          student_number: studentNumber,
          name: form.name.trim(),
          department: form.department.trim(),
          phone,
          score: scoreNum,
          role: 'student',
        })
        if (insErr) throw insErr
      }
      onSaved()
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('already'))
        setError('이미 등록된 학번이거나 이메일입니다.')
      else setError('저장 실패: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? '학생 정보 수정' : '학생 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="학번" required>
            <input
              type="text"
              value={form.student_number}
              onChange={(e) => upd('student_number', e.target.value)}
              required
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="20240001"
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

          <Field label="연락처" required hint={!isEdit ? '초기 비밀번호로 사용됩니다' : undefined}>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => upd('phone', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="010-1234-5678"
            />
          </Field>

          <Field label="점수" hint="비워두면 미입력 처리">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.score}
              onChange={(e) => upd('score', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="0~100"
            />
          </Field>

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
