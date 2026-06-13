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

// 상대평가 등급: 학번 0001(가상인물) 및 최종점수 미산정(NULL) 학생은 제외.
// 최종점수(중간·기말·출석 가중합) 내림차순으로 상위 a%=A, 다음 b%=B, 나머지=C.
// 동점 처리: 경계에 걸친 동점자는 '올림'으로 상위 등급에 포함(같은 점수 → 같은 등급).
export function assignRelativeGrades(
  items: { id: string; studentNumber: string; finalScore: number | null }[],
  ratios: { a: number; b: number },
): Record<string, 'A' | 'B' | 'C'> {
  const eligible = items.filter((it) => it.studentNumber !== '0001' && it.finalScore != null)
  const sorted = [...eligible].sort((x, y) => (y.finalScore as number) - (x.finalScore as number))
  const n = sorted.length
  const out: Record<string, 'A' | 'B' | 'C'> = {}
  if (n === 0) return out
  const aTarget = Math.round((n * ratios.a) / 100)
  const bTarget = aTarget + Math.round((n * ratios.b) / 100)
  // 경계 컷 점수: 이 점수 이상이면 상위 등급(동점 올림)
  const aThreshold = aTarget > 0 ? (sorted[Math.min(aTarget, n) - 1].finalScore as number) : Infinity
  const bThreshold = bTarget > 0 ? (sorted[Math.min(bTarget, n) - 1].finalScore as number) : Infinity
  for (const it of sorted) {
    const s = it.finalScore as number
    if (s >= aThreshold) out[it.id] = 'A'
    else if (s >= bThreshold) out[it.id] = 'B'
    else out[it.id] = 'C'
  }
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
  scores_published: boolean
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
