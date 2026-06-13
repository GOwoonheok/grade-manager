import {
  supabase,
  supabaseSignup,
  studentNumberToEmail,
  type Course,
  type Enrollment,
  type Student,
} from './supabase'

// enrollment + 학생 프로필(조인)
export type EnrollmentRow = Enrollment & {
  student: Pick<Student, 'id' | 'student_number' | 'name' | 'department' | 'phone'> | null
}

// 내가 담당하는 과목 (RLS가 owner로 제한). 최신 연도/학기 우선.
export async function listMyCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('year', { ascending: false })
    .order('semester', { ascending: false })
    .order('subject_name', { ascending: true })
  if (error) throw error
  return (data as Course[]) ?? []
}

export async function createCourse(c: {
  year: number
  semester: number
  subject_name: string
  midterm_weight: number
  final_weight: number
  attendance_weight: number
}): Promise<Course> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')
  const { data, error } = await supabase
    .from('courses')
    .insert({ ...c, owner_id: user.id })
    .select('*')
    .single()
  if (error) throw error
  return data as Course
}

export async function updateCourseWeights(
  courseId: string,
  w: { midterm_weight: number; final_weight: number; attendance_weight: number },
): Promise<void> {
  const { error } = await supabase.from('courses').update(w).eq('id', courseId)
  if (error) throw error
}

// 과목 수강생 목록(점수 포함). 학번순.
export async function listEnrollments(courseId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, student:students(id,student_number,name,department,phone)')
    .eq('course_id', courseId)
  if (error) throw error
  const rows = (data as EnrollmentRow[]) ?? []
  return rows.sort((a, b) =>
    (a.student?.student_number ?? '').localeCompare(b.student?.student_number ?? ''),
  )
}

export async function updateEnrollmentScores(
  id: string,
  s: { midterm: number | null; final: number | null; attendance: number | null },
): Promise<void> {
  const { error } = await supabase.from('enrollments').update(s).eq('id', id)
  if (error) throw error
}

export async function removeEnrollment(id: string): Promise<void> {
  const { error } = await supabase.from('enrollments').delete().eq('id', id)
  if (error) throw error
}

// 과목에 학생 추가: 기존 학번이면 그 학생을 수강등록, 없으면 계정 생성 후 등록.
export async function addStudentToCourse(
  courseId: string,
  p: {
    student_number: string
    name: string
    department: string
    phone: string
    midterm: number | null
    final: number | null
    attendance: number | null
  },
): Promise<void> {
  const sn = p.student_number.trim()
  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('student_number', sn)
    .maybeSingle()
  let studentId = (existing as { id: string } | null)?.id
  if (!studentId) {
    const { data: su, error: e1 } = await supabaseSignup.auth.signUp({
      email: studentNumberToEmail(sn),
      password: p.phone.trim(),
    })
    if (e1) throw e1
    studentId = su.user?.id
    if (!studentId) throw new Error('사용자 ID를 가져오지 못했습니다.')
    const { error: e2 } = await supabase.from('students').insert({
      id: studentId,
      student_number: sn,
      name: p.name.trim(),
      department: p.department.trim(),
      phone: p.phone.trim(),
      role: 'student',
    })
    if (e2) throw e2
  }
  const { error: e3 } = await supabase.from('enrollments').insert({
    course_id: courseId,
    student_id: studentId,
    midterm: p.midterm,
    final: p.final,
    attendance: p.attendance,
  })
  if (e3) throw e3
}

// 과목별 반 통계 (008 RPC). 008 미실행/오류 시 null.
export type CourseStats = {
  avg_score: number | null
  max_score: number | null
  total_count: number
}
export async function getCourseStats(courseId: string): Promise<CourseStats | null> {
  const { data, error } = await supabase
    .rpc('get_course_stats', { cid: courseId })
    .single()
  if (error || !data) return null
  return data as CourseStats
}

// 학생: 내 수강 과목 목록(과목 정보 조인)
export type MyEnrollment = Enrollment & { course: Course | null }
export async function listMyEnrollments(): Promise<MyEnrollment[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, course:courses(*)')
  if (error) throw error
  const rows = (data as MyEnrollment[]) ?? []
  return rows.sort((a, b) => {
    const ca = a.course, cb = b.course
    if (!ca || !cb) return 0
    return cb.year - ca.year || cb.semester - ca.semester ||
      ca.subject_name.localeCompare(cb.subject_name)
  })
}
