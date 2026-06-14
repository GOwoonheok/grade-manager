import { useRef, useState, type ChangeEvent } from 'react'
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import { SCORE_LABEL, computeAttendanceScore, type ScoreField, type Student } from '../lib/supabase'
import { downloadScoreTemplate } from '../lib/excelTemplate'
import { addStudentToCourse, updateAttendanceByNumber, updateEnrollmentScoreByNumber } from '../lib/courses'

type RegisterRow = {
  name: string
  department: string
  student_number: string
  phone: string
  midterm: number | null
  final: number | null
  attendance: number | null
  _error?: string
}

type ScoreRow = {
  student_number: string
  score: number | null
  _error?: string
}

type AttendanceRow = {
  student_number: string
  present: number
  late: number
  absent: number
  _error?: string
}

type Result = {
  student_number: string
  name?: string
  ok: boolean
  error?: string
}

export type ExcelMode =
  | { kind: 'register' }
  | { kind: 'score'; field: ScoreField }
  | { kind: 'attendance' }

type Props = {
  open: boolean
  mode: ExcelMode
  courseId: string
  latePerAbsent?: number // 출결 모드: 지각 N회=결석 1회 환산 기준
  scoreLabel?: string // score 모드: 항목 표시명 override(4번째 항목의 과목별 라벨 등)
  onClose: () => void
  onDone: () => void
  roster: Pick<Student, 'student_number' | 'name'>[]
}

const REGISTER_HEADER_MAP: Record<string, keyof RegisterRow> = {
  이름: 'name',
  학과: 'department',
  학번: 'student_number',
  연락처: 'phone',
  중간: 'midterm',
  기말: 'final',
  출석: 'attendance',
}

const isScoreInRange = (n: number) => !isNaN(n) && n >= 0 && n <= 100

export default function ExcelUploadModal({ open, mode, courseId, latePerAbsent = 3, scoreLabel, onClose, onDone, roster }: Props) {
  // score 모드의 항목 표시명(4번째 항목은 과목별 라벨). 그 외엔 SCORE_LABEL 폴백.
  const effScoreLabel = mode.kind === 'score' ? scoreLabel ?? SCORE_LABEL[mode.field] : ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([])
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([])
  const [attRows, setAttRows] = useState<AttendanceRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<Result[]>([])

  if (!open) return null

  const totalRows =
    mode.kind === 'register'
      ? registerRows.length
      : mode.kind === 'attendance'
      ? attRows.length
      : scoreRows.length

  const reset = () => {
    setRegisterRows([])
    setScoreRows([])
    setAttRows([])
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
      const XLSX = await import('xlsx') // 동적 import: 초기 번들에서 분리
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]

      // 출결 모드: 배열(header:1)로 읽어 아이디/출석/지각/결석 컬럼 위치를 탐색(주차별 칸은 무시)
      if (mode.kind === 'attendance') {
        const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })
        let hi = aoa.findIndex((r) =>
          (r as any[]).some((c) => {
            const s = String(c).trim()
            return s.includes('아이디') || s.includes('학번')
          }),
        )
        if (hi < 0) hi = 0
        const head = (aoa[hi] || []).map((c: any) => String(c).trim())
        const idIdx = head.findIndex((h) => h.includes('아이디') || h.includes('학번'))
        let pIdx = -1, lIdx = -1, aIdx = -1
        const triIdx = head.findIndex((h) => h.replace(/\s/g, '') === '출석/지각/결석')
        if (triIdx >= 0) {
          pIdx = triIdx; lIdx = triIdx + 1; aIdx = triIdx + 2
        } else {
          pIdx = head.indexOf('출석'); lIdx = head.indexOf('지각'); aIdx = head.indexOf('결석')
        }
        if (idIdx < 0 || pIdx < 0 || lIdx < 0 || aIdx < 0) {
          setParseError('헤더를 찾을 수 없습니다 (아이디/학번 + 출석/지각/결석 필요).')
          return
        }
        const num = (v: any) => {
          const n = Number(String(v).trim())
          return isNaN(n) ? 0 : Math.max(0, Math.floor(n))
        }
        const parsed: AttendanceRow[] = (aoa.slice(hi + 1) as any[][])
          .filter((r) => String(r[idIdx] ?? '').trim() !== '')
          .map((r) => {
            const row: AttendanceRow = {
              student_number: String(r[idIdx]).trim(),
              present: num(r[pIdx]),
              late: num(r[lIdx]),
              absent: num(r[aIdx]),
            }
            if (!row.student_number) row._error = '학번이 비어있습니다'
            else if (row.present + row.late + row.absent <= 0) row._error = '출석/지각/결석 합이 0'
            return row
          })
        if (parsed.length === 0) {
          setParseError('유효한 출결 데이터가 없습니다.')
          return
        }
        setAttRows(parsed)
        return
      }

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
      })
      if (json.length === 0) {
        setParseError('엑셀에 데이터가 없습니다.')
        return
      }

      if (mode.kind === 'register') {
        const parsed: RegisterRow[] = json.map((raw) => {
          const r: RegisterRow = {
            name: '',
            department: '',
            student_number: '',
            phone: '',
            midterm: null,
            final: null,
            attendance: null,
          }
          for (const [key, val] of Object.entries(raw)) {
            const field = REGISTER_HEADER_MAP[String(key).trim()]
            if (!field) continue
            if (field === 'midterm' || field === 'final' || field === 'attendance') {
              const s = String(val).trim()
              if (s === '') continue
              const n = Number(s)
              if (!isScoreInRange(n)) {
                r._error = `${SCORE_LABEL[field]} 점수가 0~100 범위를 벗어났습니다`
              } else {
                r[field] = n
              }
            } else {
              r[field] = String(val).trim() as never
            }
          }
          if (!r._error) {
            if (!r.student_number) r._error = '학번이 비어있습니다'
            else if (!r.name) r._error = '이름이 비어있습니다'
            else if (!r.phone)
              r._error = '연락처가 비어있습니다 (초기 비밀번호로 사용)'
          }
          return r
        })
        setRegisterRows(parsed)
      } else {
        // 점수 갱신 모드: 학번 + 점수만 필요
        const parsed: ScoreRow[] = json.map((raw) => {
          const r: ScoreRow = { student_number: '', score: null }
          for (const [key, val] of Object.entries(raw)) {
            const k = String(key).trim()
            if (k === '학번') r.student_number = String(val).trim()
            else if (k === '점수' || k === effScoreLabel) {
              const s = String(val).trim()
              if (s === '') continue
              const n = Number(s)
              if (!isScoreInRange(n))
                r._error = '점수가 0~100 범위를 벗어났습니다'
              else r.score = n
            }
          }
          if (!r._error) {
            if (!r.student_number) r._error = '학번이 비어있습니다'
            else if (r.score === null) r._error = '점수가 비어있습니다'
          }
          return r
        })
        setScoreRows(parsed)
      }
    } catch (err: any) {
      setParseError('엑셀 읽기 실패: ' + (err?.message ?? err))
    }
  }

  const startUpload = async () => {
    setUploading(true)
    const out: Result[] = []

    if (mode.kind === 'register') {
      for (const row of registerRows) {
        if (row._error) {
          out.push({
            student_number: row.student_number,
            name: row.name,
            ok: false,
            error: row._error,
          })
          setResults([...out])
          continue
        }
        try {
          await addStudentToCourse(courseId, {
            student_number: row.student_number,
            name: row.name,
            department: row.department,
            phone: row.phone,
            midterm: row.midterm,
            final: row.final,
            attendance: row.attendance,
          })
          out.push({
            student_number: row.student_number,
            name: row.name,
            ok: true,
          })
        } catch (err: any) {
          const msg: string = err?.message ?? String(err)
          let nice = msg
          if (msg.includes('already') || msg.includes('duplicate'))
            nice = '이미 이 과목에 등록됨'
          out.push({
            student_number: row.student_number,
            name: row.name,
            ok: false,
            error: nice,
          })
        }
        setResults([...out])
      }
    } else if (mode.kind === 'attendance') {
      // 출결: 학번으로 찾아 출석/지각/결석 횟수 저장 + 출석 점수 자동 계산
      for (const row of attRows) {
        if (row._error) {
          out.push({ student_number: row.student_number, ok: false, error: row._error })
          setResults([...out])
          continue
        }
        try {
          const res = await updateAttendanceByNumber(
            courseId,
            row.student_number,
            { present: row.present, late: row.late, absent: row.absent },
            latePerAbsent,
          )
          out.push(
            res === 'ok'
              ? { student_number: row.student_number, ok: true }
              : { student_number: row.student_number, ok: false, error: '이 과목에 등록되지 않은 학번' },
          )
        } catch (err: any) {
          out.push({ student_number: row.student_number, ok: false, error: err?.message ?? String(err) })
        }
        setResults([...out])
      }
    } else {
      // 점수 갱신: 학번으로 찾아 해당 컬럼만 update
      const field = mode.field
      for (const row of scoreRows) {
        if (row._error) {
          out.push({
            student_number: row.student_number,
            ok: false,
            error: row._error,
          })
          setResults([...out])
          continue
        }
        try {
          const res = await updateEnrollmentScoreByNumber(
            courseId,
            row.student_number,
            field,
            row.score as number,
          )
          out.push(
            res === 'ok'
              ? { student_number: row.student_number, ok: true }
              : {
                  student_number: row.student_number,
                  ok: false,
                  error: '이 과목에 등록되지 않은 학번',
                },
          )
        } catch (err: any) {
          out.push({
            student_number: row.student_number,
            ok: false,
            error: err?.message ?? String(err),
          })
        }
        setResults([...out])
      }
    }

    setUploading(false)
    onDone()
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.filter((r) => !r.ok).length
  const finished = results.length === totalRows && totalRows > 0

  const title =
    mode.kind === 'register'
      ? '엑셀 일괄 등록 (신규 학생)'
      : mode.kind === 'attendance'
      ? '출결 일괄 업로드 (출석/지각/결석)'
      : `${effScoreLabel} 점수 일괄 업로드`

  const headerHint =
    mode.kind === 'register'
      ? '헤더: 이름 / 학과 / 학번 / 연락처 / 중간 / 기말 / 출석'
      : mode.kind === 'attendance'
      ? '헤더: 아이디(학번) / 출석 / 지각 / 결석 — 주차별 칸은 무시'
      : `헤더: 학번 / 점수 (또는 ${effScoreLabel})`

  const allRowsErrored =
    mode.kind === 'register'
      ? registerRows.every((r) => r._error)
      : mode.kind === 'attendance'
      ? attRows.every((r) => r._error)
      : scoreRows.every((r) => r._error)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-600" size={20} />
            {title}
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
          {totalRows === 0 && (
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
                  <p className="text-xs text-gray-500 mt-1">{headerHint}</p>
                </div>
              </label>
              {mode.kind === 'score' && (
                <button
                  type="button"
                  onClick={() => downloadScoreTemplate(mode.field, roster, effScoreLabel)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Download size={16} />
                  표준 양식 다운로드 (.xlsx) — 수강생 {roster.length}명 자동 채움
                </button>
              )}
              {parseError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* 미리보기 */}
          {totalRows > 0 && results.length === 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{fileName}</span> — 총{' '}
                  <strong>{totalRows}건</strong>{' '}
                  {mode.kind === 'register' ? '등록 예정' : '갱신 예정'}
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  파일 다시 선택
                </button>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                {mode.kind === 'register' ? (
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left">학번</th>
                        <th className="px-2 py-2 text-left">이름</th>
                        <th className="px-2 py-2 text-left">학과</th>
                        <th className="px-2 py-2 text-left">연락처</th>
                        <th className="px-2 py-2 text-right">중간</th>
                        <th className="px-2 py-2 text-right">기말</th>
                        <th className="px-2 py-2 text-right">출석</th>
                        <th className="px-2 py-2 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {registerRows.map((r, i) => (
                        <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1.5 font-mono">
                            {r.student_number}
                          </td>
                          <td className="px-2 py-1.5">{r.name}</td>
                          <td className="px-2 py-1.5">{r.department}</td>
                          <td className="px-2 py-1.5">{r.phone}</td>
                          <td className="px-2 py-1.5 text-right">
                            {r.midterm ?? '-'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {r.final ?? '-'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {r.attendance ?? '-'}
                          </td>
                          <td className="px-2 py-1.5 text-red-600">
                            {r._error ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : mode.kind === 'attendance' ? (
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left">학번</th>
                        <th className="px-2 py-2 text-right">출석</th>
                        <th className="px-2 py-2 text-right">지각</th>
                        <th className="px-2 py-2 text-right">결석</th>
                        <th className="px-2 py-2 text-right">출석점수</th>
                        <th className="px-2 py-2 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attRows.map((r, i) => (
                        <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1.5 font-mono">
                            {r.student_number}
                          </td>
                          <td className="px-2 py-1.5 text-right">{r.present}</td>
                          <td className="px-2 py-1.5 text-right">{r.late}</td>
                          <td className="px-2 py-1.5 text-right">{r.absent}</td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {r._error
                              ? '-'
                              : computeAttendanceScore(r.present, r.late, r.absent, latePerAbsent) ?? '-'}
                          </td>
                          <td className="px-2 py-1.5 text-red-600">
                            {r._error ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left">학번</th>
                        <th className="px-2 py-2 text-right">
                          {effScoreLabel} 점수
                        </th>
                        <th className="px-2 py-2 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scoreRows.map((r, i) => (
                        <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1.5 font-mono">
                            {r.student_number}
                          </td>
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
                )}
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
                  진행 {results.length}/{totalRows}
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
                          {r.student_number}
                        </td>
                        <td className="px-2 py-1.5">{r.name ?? '-'}</td>
                        <td className="px-2 py-1.5">
                          {r.ok ? (
                            <span className="text-emerald-700">
                              ✓ {mode.kind === 'register' ? '등록 완료' : '갱신 완료'}
                            </span>
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
          {totalRows > 0 && results.length === 0 && (
            <button
              onClick={startUpload}
              disabled={uploading || allRowsErrored}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
            >
              {uploading
                ? '처리 중...'
                : mode.kind === 'register'
                ? `${totalRows}명 일괄 등록`
                : mode.kind === 'attendance'
                ? `${totalRows}건 출결 반영`
                : `${totalRows}건 점수 갱신`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
