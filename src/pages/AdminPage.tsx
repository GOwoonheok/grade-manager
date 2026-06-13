import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, Calculator, ChevronLeft, ChevronRight, LogOut, Plus, Search, Upload, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { assignRelativeGrades, calcFinalScore, type Course, type ExamType } from '../lib/supabase'
import {
  listMyCourses,
  listEnrollments,
  removeEnrollment,
  updateCourseGrades,
  updateCourseWeights,
  type EnrollmentRow,
} from '../lib/courses'
import { getAnswerSheetFlags } from '../lib/answerSheets'
import StudentList from '../components/StudentList'
import StudentFormModal from '../components/StudentFormModal'
import AnswerSheetViewer from '../components/AnswerSheetViewer'
import CourseFormModal from '../components/CourseFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import BrandHeader from '../components/BrandHeader'
import ExcelUploadModal, { type ExcelMode } from '../components/ExcelUploadModal'

const courseLabel = (c: Course) => `${c.year}-${c.semester}학기 · ${c.subject_name}`

export default function AdminPage() {
  const { profile, signOut } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState<string | null>(null)
  const [rows, setRows] = useState<EnrollmentRow[]>([])
  const [sheetFlags, setSheetFlags] = useState<Record<string, { midterm: boolean; final: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EnrollmentRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState<EnrollmentRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [courseModalOpen, setCourseModalOpen] = useState(false)
  const [excelMode, setExcelMode] = useState<ExcelMode | null>(null)
  const [viewer, setViewer] = useState<{ studentId: string; examType: ExamType; name: string } | null>(null)

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId],
  )

  const loadCourses = async () => {
    try {
      const cs = await listMyCourses()
      setCourses(cs)
      setCourseId((cur) => (cur && cs.some((c) => c.id === cur) ? cur : cs[0]?.id ?? null))
    } catch (e: any) {
      setError(e?.message ?? String(e))
    }
  }

  const loadRoster = async (cid: string) => {
    setLoading(true)
    setError(null)
    try {
      const rs = await listEnrollments(cid)
      setRows(rs)
      const ids = rs.map((r) => r.student?.id).filter((x): x is string => !!x)
      setSheetFlags(await getAnswerSheetFlags(ids))
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (courseId) loadRoster(courseId)
    else {
      setRows([])
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const s = r.student
      return (
        (s?.name ?? '').toLowerCase().includes(q) ||
        (s?.student_number ?? '').toLowerCase().includes(q) ||
        (s?.department ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  // 검색/과목/페이지크기 변경 시 첫 페이지로
  useEffect(() => {
    setPage(1)
  }, [search, courseId, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  // 상대평가 등급 (0001 제외, 전체 명단 기준으로 산정 — 페이지와 무관)
  const eligibleCount = useMemo(
    () => rows.filter((r) => r.student?.student_number !== '0001').length,
    [rows],
  )
  const grades = useMemo<Record<string, 'A' | 'B' | 'C'>>(() => {
    if (!selectedCourse) return {}
    const w = {
      midterm_weight: selectedCourse.midterm_weight,
      final_weight: selectedCourse.final_weight,
      attendance_weight: selectedCourse.attendance_weight,
    }
    const items = rows.map((r) => ({
      id: r.id,
      studentNumber: r.student?.student_number ?? '',
      finalScore: calcFinalScore(r, w),
    }))
    return assignRelativeGrades(items, { a: selectedCourse.grade_a_ratio ?? 30, b: selectedCourse.grade_b_ratio ?? 40 })
  }, [rows, selectedCourse])

  const handleAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const handleEdit = (r: EnrollmentRow) => {
    setEditing(r)
    setFormOpen(true)
  }
  const handleDelete = (r: EnrollmentRow) => {
    setDeleting(r)
    setConfirmOpen(true)
  }
  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await removeEnrollment(deleting.id)
    } catch (e: any) {
      alert('삭제 실패: ' + (e?.message ?? e))
      setDeleteLoading(false)
      return
    }
    setDeleteLoading(false)
    setConfirmOpen(false)
    setDeleting(null)
    if (courseId) loadRoster(courseId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandHeader />
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-600" size={22} />
            <h1 className="text-lg font-semibold text-gray-800">교수 대시보드</h1>
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
        {/* 과목 선택 바 */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700">
              <BookOpen className="text-indigo-600" size={18} />
              <span className="text-sm font-semibold">과목</span>
            </div>
            <select
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value || null)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {courses.length === 0 && <option value="">개설된 과목 없음</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCourseModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium"
            >
              <Plus size={18} />새 과목
            </button>
          </div>
        </section>

        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-500">
            먼저 <span className="font-medium text-gray-700">새 과목</span>을 개설하세요.
          </div>
        ) : (
          <>
            {/* 가중치 (선택 과목) */}
            {selectedCourse && (
              <WeightSettings
                course={selectedCourse}
                eligibleCount={eligibleCount}
                onSaved={() => loadCourses()}
              />
            )}

            {/* 학생 명단 카드 */}
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
                    disabled={!courseId}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
                  >
                    <Plus size={18} />
                    학생 추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ExcelButton onClick={() => setExcelMode({ kind: 'register' })} label="신규 일괄 등록" emphasis />
                  <ExcelButton onClick={() => setExcelMode({ kind: 'score', field: 'midterm' })} label="중간 점수 업로드" />
                  <ExcelButton onClick={() => setExcelMode({ kind: 'score', field: 'final' })} label="기말 점수 업로드" />
                  <ExcelButton onClick={() => setExcelMode({ kind: 'score', field: 'attendance' })} label="출석 점수 업로드" />
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
                  rows={paged}
                  course={selectedCourse}
                  flags={sheetFlags}
                  grades={grades}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={(studentId, examType, name) => setViewer({ studentId, examType, name })}
                />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-sm text-gray-500 border-t">
                <div className="flex items-center gap-2">
                  <span>총 {filtered.length}명{search && ` (전체 ${rows.length}명 중)`}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value={10}>10건</option>
                    <option value={20}>20건</option>
                    <option value={50}>50건</option>
                  </select>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pageSafe <= 1}
                      className="px-2 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                      title="이전 페이지"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 tabular-nums">{pageSafe} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={pageSafe >= totalPages}
                      className="px-2 py-1 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                      title="다음 페이지"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <StudentFormModal
        open={formOpen}
        courseId={courseId}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          if (courseId) loadRoster(courseId) // 이미지 업로드 반영 위해 닫을 때 명단 새로고침
        }}
        onSaved={() => courseId && loadRoster(courseId)}
      />

      <AnswerSheetViewer
        open={!!viewer}
        studentId={viewer?.studentId ?? null}
        studentName={viewer?.name}
        examType={viewer?.examType ?? 'midterm'}
        onClose={() => setViewer(null)}
      />

      <CourseFormModal
        open={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onCreated={async (id) => {
          await loadCourses()
          setCourseId(id)
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="수강 삭제"
        message={
          deleting
            ? `${deleting.student?.name}(${deleting.student?.student_number}) 학생을 이 과목에서 삭제하시겠습니까?`
            : ''
        }
        confirmText="삭제"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleteLoading}
      />

      {excelMode && courseId && (
        <ExcelUploadModal
          open={!!excelMode}
          mode={excelMode}
          courseId={courseId}
          roster={rows.flatMap((r) => (r.student ? [r.student] : []))}
          onClose={() => setExcelMode(null)}
          onDone={() => courseId && loadRoster(courseId)}
        />
      )}
    </div>
  )
}

function WeightSettings({ course, eligibleCount, onSaved }: { course: Course; eligibleCount: number; onSaved: () => void }) {
  const [m, setM] = useState('')
  const [f, setF] = useState('')
  const [a, setA] = useState('')
  const [ga, setGa] = useState('')
  const [gb, setGb] = useState('')
  const [gc, setGc] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setM(course.midterm_weight.toString())
    setF(course.final_weight.toString())
    setA(course.attendance_weight.toString())
    setGa((course.grade_a_ratio ?? 30).toString())
    setGb((course.grade_b_ratio ?? 40).toString())
    setGc((course.grade_c_ratio ?? 30).toString())
    setMsg(null)
  }, [course])

  const sum = (Number(m) || 0) + (Number(f) || 0) + (Number(a) || 0)
  const sumOk = Math.abs(sum - 100) < 0.01
  const cnt = (ratio: string) => Math.round((eligibleCount * (Number(ratio) || 0)) / 100)
  const aN = cnt(ga)
  const bN = cnt(gb)
  const cN = Math.max(0, eligibleCount - aN - bN)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!sumOk) {
      setMsg({ type: 'err', text: `가중치 합계가 100이어야 합니다 (현재: ${sum}).` })
      return
    }
    setSaving(true)
    try {
      await updateCourseWeights(course.id, {
        midterm_weight: Number(m),
        final_weight: Number(f),
        attendance_weight: Number(a),
      })
      await updateCourseGrades(course.id, {
        grade_a_ratio: Number(ga) || 0,
        grade_b_ratio: Number(gb) || 0,
        grade_c_ratio: Number(gc) || 0,
      })
      setMsg({ type: 'ok', text: '저장되었습니다.' })
      onSaved()
    } catch (err: any) {
      setMsg({ type: 'err', text: '저장 실패: ' + (err?.message ?? err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 mr-1">
            <Calculator className="text-indigo-600" size={18} />
            <h2 className="text-sm font-semibold text-gray-800">가중치 (합계 100)</h2>
          </div>
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
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mr-1">
            <h2 className="text-sm font-semibold text-gray-800">상대평가 등급비율</h2>
            <span className="text-xs text-gray-400">0001 제외 {eligibleCount}명</span>
          </div>
          <GradeField label="A" value={ga} onChange={setGa} hint={`${aN}명`} />
          <GradeField label="B" value={gb} onChange={setGb} hint={`${bN}명`} />
          <GradeField label="C" value={gc} onChange={setGc} hint={`나머지 ${cN}명`} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !sumOk}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          {msg && (
            <span className={`text-sm ${msg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}

function GradeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} <span className="text-gray-400">({hint})</span>
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
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
    </div>
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
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
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
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
      </div>
    </div>
  )
}

function ExcelButton({
  onClick,
  label,
  emphasis,
}: {
  onClick: () => void
  label: string
  emphasis?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium border ${
        emphasis
          ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Upload size={16} />
      {label}
    </button>
  )
}
