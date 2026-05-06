import { useEffect, useMemo, useState } from 'react'
import { LogOut, Plus, Search, Upload, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, type Student } from '../lib/supabase'
import StudentList from '../components/StudentList'
import StudentFormModal from '../components/StudentFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ExcelUploadModal from '../components/ExcelUploadModal'

export default function AdminPage() {
  const { profile, signOut } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [excelOpen, setExcelOpen] = useState(false)

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

  useEffect(() => {
    loadStudents()
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
    // students 테이블 행 삭제 (auth.users는 admin API가 필요해서 우선 students만)
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

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b">
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
              onClick={() => setExcelOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium"
            >
              <Upload size={18} />
              엑셀 업로드
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              <Plus size={18} />
              학생 추가
            </button>
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

      <ExcelUploadModal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        onDone={loadStudents}
      />
    </div>
  )
}
