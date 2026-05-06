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

export type Role = 'student' | 'professor'

export type Student = {
  id: string
  student_number: string
  name: string
  department: string
  phone: string
  score: number | null
  role: Role
  created_at: string
}

export type ClassStats = {
  avg_score: number | null
  max_score: number | null
  total_count: number
}
