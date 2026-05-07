import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Calculator,
  LogOut,
  Plus,
  Search,
  Upload,
  Users,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  supabase,
  type ClassSettings,
  type ScoreField,
  type Student,
} from '../lib/supabase'
import StudentList from '../components/StudentList'
import StudentFormModal from '../components/StudentFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ExcelUploadModal, {
  type ExcelMode,
} from '../components/ExcelUploadModal'

export default function AdminPage() {
  const { profile, signOut } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [settings, setSettings] = useState<ClassSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [excelMode, setExcelMode] = useState<ExcelMode | null>(null)

  const loadStudents = async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('students')
      .select('*')
      .eq('role', 'student')
      .order('student_number', { ascending: true })
    if (e) setError(e.message)
    setStudents((data as Student[]) ?? [])
    setLoading(false)
  }

  const loadSettings = async () => {
    const { data } = await supabase
      .from('class_settings')
      .select('*')
      .eq('id', 1)
      .single()
    if (data) setSettings(data as ClassSettings)
  }

  useEffect(() => {
    loadStudents()
    loadSettings()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q),
    )
  }, [students, search])

  const handleAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleEdit = (s: Student) => {
    setEditing(s)
    setFormOpen(true)
  }

  const handleDelete = (s: Student) => {
    setDeleting(s)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    const { error: e } = await supabase
      .from('students')
      .delete()
      .eq('id', deleting.id)
    setDeleteLoading(false)
    if (e) {
      alert('삭제 실패: ' + e.message)
      return
    }
    setConfirmOpen(false)
    setDeleting(null)
    await loadStudents()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-600" size={22} />
            <h1 className="text-lg font-semibold text-gray-800">
              교수 대시보드
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {profile?.name} ({profile?.student_number})
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* 가중치 설정 */}
        <WeightSettings settings={settings} onSaved={loadSettings} />

        {/* 학생 목록 카드 */}
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="flex flex-col gap-3 p-4 border-b">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름·학번·학과로 검색"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
              >
                <Plus size={18} />
                학생 추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setExcelMode({ kind: 'register' })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium"
              >
                <Upload size={16} />
                신규 일괄 등록
              </button>
              <ScoreUploadButton field="midterm" onClick={setExcelMode} />
              <ScoreUploadButton field="final" onClick={setExcelMode} />
              <ScoreUploadButton field="attendance" onClick={setExcelMode} />
            </div>
          </div>

          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-500 py-12">불러오는 중...</div>
          ) : (
            <StudentList
              students={filtered}
              settings={settings}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          <div className="p-4 text-sm text-gray-500 border-t">
            총 {filtered.length}명{' '}
            {search && `(전체 ${students.length}명 중)`}
          </div>
        </div>
      </main>

      <StudentFormModal
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={loadStudents}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="학생 삭제"
        message={
          deleting
            ? `${deleting.name}(${deleting.student_number}) 학생을 삭제하시겠습니까? 되돌릴 수 없습니다.`
            : ''
        }
        confirmText="삭제"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleteLoading}
      />

      {excelMode && (
        <ExcelUploadModal
          open={!!excelMode}
          mode={excelMode}
          onClose={() => setExcelMode(null)}
          onDone={loadStudents}
        />
      )}
    </div>
  )
}

const SCORE_BUTTON_LABEL: Record<ScoreField, string> = {
  midterm: '중간 점수 업로드',
  final: '기말 점수 업로드',
  attendance: '출석 점수 업로드',
}

function ScoreUploadButton({
  field,
  onClick,
}: {
  field: ScoreField
  onClick: (m: ExcelMode) => void
}) {
  return (
    <button
      onClick={() => onClick({ kind: 'score', field })}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
    >
      <Upload size={16} />
      {SCORE_BUTTON_LABEL[field]}
    </button>
  )
}

function WeightSettings({
  settings,
  onSaved,
}: {
  settings: ClassSettings | null
  onSaved: () => void
}) {
  const [m, setM] = useState('')
  const [f, setF] = useState('')
  const [a, setA] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  useEffect(() => {
    if (settings) {
      setM(settings.midterm_weight.toString())
      setF(settings.final_weight.toString())
      setA(settings.attendance_weight.toString())
    }
  }, [settings])

  const sum = (Number(m) || 0) + (Number(f) || 0) + (Number(a) || 0)
  const sumOk = Math.abs(sum - 100) < 0.01

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!sumOk) {
      setMsg({ type: 'err', text: `합계가 100이어야 합니다 (현재: ${sum}).` })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('class_settings')
      .update({
        midterm_weight: Number(m),
        final_weight: Number(f),
        attendance_weight: Number(a),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setSaving(false)
    if (error) {
      setMsg({ type: 'err', text: '저장 실패: ' + error.message })
      return
    }
    setMsg({ type: 'ok', text: '가중치가 저장되었습니다.' })
    onSaved()
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="text-indigo-600" size={18} />
        <h2 className="text-sm font-semibold text-gray-800">
          최종점수 가중치 (합계 100)
        </h2>
      </div>
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3"
      >
        <WeightField label="중간" value={m} onChange={setM} />
        <WeightField label="기말" value={f} onChange={setF} />
        <WeightField label="출석" value={a} onChange={setA} />
        <div
          className={`text-sm tabular-nums px-3 py-2 rounded-lg border ${
            sumOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          합계 {sum}
        </div>
        <button
          type="submit"
          disabled={saving || !sumOk}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {msg && (
          <span
            className={`text-sm ${
              msg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {msg.text}
          </span>
        )}
      </form>
    </section>
  )
}

function WeightField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 pl-3 pr-7 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm tabular-nums"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          %
        </span>
      </div>
    </div>
  )
}
