import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Supabase 환경변수가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 입력하세요.',
  )
}

// 일반 클라이언트: 로그인 세션 유지
export const supabase = createClient(url, anonKey)

// 학생 등록용 보조 클라이언트: 세션을 저장하지 않음
// 새 학생 signUp 시 우리 교수 세션이 바뀌지 않도록 분리
export const supabaseSignup = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

// 학번을 Supabase Auth용 가짜 이메일로 변환
export const studentNumberToEmail = (studentNumber: string) =>
  `${studentNumber.toLowerCase()}@grade.local`

export type Role = 'student' | 'professor' | 'admin'

export type Student = {
  id: string
  student_number: string
  name: string
  department: string
  phone: string
  midterm: number | null
  final: number | null
  attendance: number | null
  // 003 마이그레이션 이후 사용 안 함. score 컬럼은 호환을 위해 일정 기간 유지.
  score?: number | null
  role: Role
  must_change_password?: boolean
  created_at: string
}

export type ClassSettings = {
  id: number
  midterm_weight: number
  final_weight: number
  attendance_weight: number
  updated_at?: string
}

export type ClassStats = {
  avg_score: number | null
  max_score: number | null
  total_count: number
}

export type ScoreField = 'midterm' | 'final' | 'attendance'

export const SCORE_LABEL: Record<ScoreField, string> = {
  midterm: '중간',
  final: '기말',
  attendance: '출석',
}

// 가중치 적용 최종점수. 셋 중 하나라도 NULL이면 null 반환.
export function calcFinalScore(
  s: Pick<Student, 'midterm' | 'final' | 'attendance'>,
  w: Pick<ClassSettings, 'midterm_weight' | 'final_weight' | 'attendance_weight'>,
): number | null {
  if (s.midterm == null || s.final == null || s.attendance == null) return null
  const total =
    s.midterm * w.midterm_weight +
    s.final * w.final_weight +
    s.attendance * w.attendance_weight
  return Math.round((total / 100) * 100) / 100 // 소수 둘째자리
}

// 상대평가 등급: 학번 0001(가상인물)은 제외. 최종점수 내림차순 순위로
// A=상위 a%, B=다음 b%, 나머지=C. 최종점수 미산정(NULL)은 최하위로 간주.
export function assignRelativeGrades(
  items: { id: string; studentNumber: string; finalScore: number | null }[],
  ratios: { a: number; b: number },
): Record<string, 'A' | 'B' | 'C'> {
  const eligible = items.filter((it) => it.studentNumber !== '0001')
  const sorted = [...eligible].sort((x, y) => (y.finalScore ?? -1) - (x.finalScore ?? -1))
  const n = sorted.length
  const aCut = Math.round((n * ratios.a) / 100)
  const bCut = aCut + Math.round((n * ratios.b) / 100)
  const out: Record<string, 'A' | 'B' | 'C'> = {}
  sorted.forEach((it, i) => {
    out[it.id] = i < aCut ? 'A' : i < bCut ? 'B' : 'C'
  })
  return out
}

export type ExamType = 'midterm' | 'final'

export type AnswerSheet = {
  id: string
  student_id: string
  exam_type: ExamType
  path: string
  created_at: string
}

// 다과목(P2): 과목 개설 + 수강등록
export type Course = {
  id: string
  owner_id: string
  year: number
  semester: number
  subject_name: string
  midterm_weight: number
  final_weight: number
  attendance_weight: number
  grade_a_ratio: number
  grade_b_ratio: number
  grade_c_ratio: number
  created_at: string
}

export type Enrollment = {
  id: string
  course_id: string
  student_id: string
  midterm: number | null
  final: number | null
  attendance: number | null
  created_at: string
}
