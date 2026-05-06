import { useRef, useState, type ChangeEvent } from 'react'
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  supabase,
  supabaseSignup,
  studentNumberToEmail,
} from '../lib/supabase'

type Row = {
  name: string
  department: string
  student_number: string
  phone: string
  score: number | null
  _error?: string
}

type Result = { row: Row; ok: boolean; error?: string }

type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
}

const HEADER_MAP: Record<string, keyof Row> = {
  이름: 'name',
  학과: 'department',
  학번: 'student_number',
  연락처: 'phone',
  점수: 'score',
}

export default function ExcelUploadModal({ open, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<Result[]>([])

  if (!open) return null

  const reset = () => {
    setRows([])
    setFileName(null)
    setParseError(null)
    setResults([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setParseError(null)
    setResults([])
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
      })

      const parsed: Row[] = json.map((raw, idx) => {
        const r: Row = {
          name: '',
          department: '',
          student_number: '',
          phone: '',
          score: null,
        }
        for (const [key, val] of Object.entries(raw)) {
          const field = HEADER_MAP[key.trim()]
          if (!field) continue
          if (field === 'score') {
            const s = String(val).trim()
            r.score = s === '' ? null : Number(s)
            if (r.score !== null && (isNaN(r.score) || r.score < 0 || r.score > 100))
              r._error = '점수가 0~100 범위를 벗어났습니다'
          } else {
            r[field] = String(val).trim() as never
          }
        }
        if (!r.student_number) r._error = '학번이 비어있습니다'
        else if (!r.name) r._error = '이름이 비어있습니다'
        else if (!r.phone) r._error = '연락처가 비어있습니다 (초기 비밀번호로 사용)'
        if (!r._error && idx < 0) r._error = undefined
        return r
      })

      if (parsed.length === 0) {
        setParseError('엑셀에 데이터가 없습니다.')
        return
      }
      setRows(parsed)
    } catch (err: any) {
      setParseError('엑셀 읽기 실패: ' + (err?.message ?? err))
    }
  }

  const startUpload = async () => {
    setUploading(true)
    const out: Result[] = []
    for (const row of rows) {
      if (row._error) {
        out.push({ row, ok: false, error: row._error })
        setResults([...out])
        continue
      }
      try {
        const email = studentNumberToEmail(row.student_number)
        const { data, error: e1 } = await supabaseSignup.auth.signUp({
          email,
          password: row.phone,
        })
        if (e1) throw e1
        const newId = data.user?.id
        if (!newId) throw new Error('사용자 ID 없음')

        const { error: e2 } = await supabase.from('students').insert({
          id: newId,
          student_number: row.student_number,
          name: row.name,
          department: row.department,
          phone: row.phone,
          score: row.score,
          role: 'student',
        })
        if (e2) throw e2
        out.push({ row, ok: true })
      } catch (err: any) {
        const msg: string = err?.message ?? String(err)
        let nice = msg
        if (msg.includes('already') || msg.includes('duplicate'))
          nice = '이미 존재하는 학번/이메일'
        out.push({ row, ok: false, error: nice })
      }
      setResults([...out])
    }
    setUploading(false)
    onDone()
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.filter((r) => !r.ok).length
  const finished = results.length === rows.length && rows.length > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={20} />
            엑셀 일괄 업로드
          </h2>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600"
            disabled={uploading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* 파일 선택 */}
          {rows.length === 0 && (
            <div>
              <label className="block">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition">
                  <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-700">
                    엑셀 파일 선택 (.xlsx, .xls)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    헤더: 이름 / 학과 / 학번 / 연락처 / 점수
                  </p>
                </div>
              </label>
              {parseError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* 미리보기 */}
          {rows.length > 0 && results.length === 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{fileName}</span> — 총{' '}
                  <strong>{rows.length}명</strong> 등록 예정
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  파일 다시 선택
                </button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-2 py-2 text-left">학번</th>
                      <th className="px-2 py-2 text-left">이름</th>
                      <th className="px-2 py-2 text-left">학과</th>
                      <th className="px-2 py-2 text-left">연락처</th>
                      <th className="px-2 py-2 text-right">점수</th>
                      <th className="px-2 py-2 text-left">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1.5 font-mono">
                          {r.student_number}
                        </td>
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.department}</td>
                        <td className="px-2 py-1.5">{r.phone}</td>
                        <td className="px-2 py-1.5 text-right">
                          {r.score ?? '-'}
                        </td>
                        <td className="px-2 py-1.5 text-red-600">
                          {r._error ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 결과 */}
          {results.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={16} /> 성공 {okCount}
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <AlertCircle size={16} /> 실패 {failCount}
                </span>
                <span className="text-gray-500">
                  진행 {results.length}/{rows.length}
                </span>
              </div>

              <div className="overflow-x-auto border rounded-lg max-h-80">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">학번</th>
                      <th className="px-2 py-2 text-left">이름</th>
                      <th className="px-2 py-2 text-left">결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r, i) => (
                      <tr key={i} className={r.ok ? '' : 'bg-red-50'}>
                        <td className="px-2 py-1.5 font-mono">
                          {r.row.student_number}
                        </td>
                        <td className="px-2 py-1.5">{r.row.name}</td>
                        <td className="px-2 py-1.5">
                          {r.ok ? (
                            <span className="text-emerald-700">✓ 등록 완료</span>
                          ) : (
                            <span className="text-red-700">✗ {r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-2">
          <button
            onClick={close}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {finished ? '닫기' : '취소'}
          </button>
          {rows.length > 0 && results.length === 0 && (
            <button
              onClick={startUpload}
              disabled={uploading || rows.every((r) => r._error)}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
            >
              {uploading ? '등록 중...' : `${rows.length}명 일괄 등록`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
