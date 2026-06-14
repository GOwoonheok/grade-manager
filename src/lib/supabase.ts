import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Supabase 환경변수가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 입력하세요.',
  )
}

// 일반 클라이언트: 로그인 세션 유지
// 세션 지속/자동갱신을 명시적으로 보장(교수 권한이 갱신 시점에 풀리지 않도록).
// storageKey는 기본값 유지 → 기존 로그인 세션 그대로 사용(강제 로그아웃 없음).
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // URL 기반 인증 미사용(경로 라우팅) → 불필요한 세션 파싱 방지
  },
})

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

// 채점 로직은 ./grading 으로 분리(단위 테스트 가능). 호환 위해 재노출.
export { calcFinalScore, assignRelativeGrades } from './grading'

export type ExamType = 'midterm' | 'final'

export type AnswerSheet = {
  id: string
  course_id: string | null
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
