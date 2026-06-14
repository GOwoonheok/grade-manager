import {
  supabase,
  supabaseSignup,
  studentNumberToEmail,
  computeAttendanceScore,
  type Course,
  type Enrollment,
  type ScoreField,
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
  extra_weight: number
  extra_label: string
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
  w: {
    midterm_weight: number
    final_weight: number
    attendance_weight: number
    extra_weight: number
    extra_label: string
  },
): Promise<void> {
  const { error } = await supabase.from('courses').update(w).eq('id', courseId)
  if (error) throw error
}

// 지각 → 결석 환산 기준(지각 N회 = 결석 1회) 저장. 024.
export async function updateCourseLateRule(courseId: string, latePerAbsent: number): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ late_per_absent: Math.max(1, Math.floor(latePerAbsent)) })
    .eq('id', courseId)
  if (error) throw error
}

export async function updateCourseGrades(
  courseId: string,
  g: { grade_a_ratio: number; grade_b_ratio: number; grade_c_ratio: number },
): Promise<void> {
  const { error } = await supabase.from('courses').update(g).eq('id', courseId)
  if (error) throw error
}

// 전화번호 복호화 RPC (담당 교수/본인만). 015 미적용 시 호출 실패 → 호출부에서 평문 폴백.
export async function getStudentPhones(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase.rpc('get_student_phones', { p_ids: ids })
  if (error) throw error
  const m: Record<string, string> = {}
  for (const r of (data as { id: string; phone: string | null }[]) ?? []) {
    if (r.phone) m[r.id] = r.phone
  }
  return m
}

// 과목 수강생 목록(점수 포함). 학번순. 전화번호는 복호화 값으로 표시.
export async function listEnrollments(courseId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, student:students(id,student_number,name,department,phone)')
    .eq('course_id', courseId)
  if (error) throw error
  const rows = (data as EnrollmentRow[]) ?? []
  const ids = rows.map((r) => r.student?.id).filter((x): x is string => !!x)
  try {
    const phones = await getStudentPhones(ids)
    for (const r of rows) if (r.student && phones[r.student.id] != null) r.student.phone = phones[r.student.id]
  } catch {
    /* 015 적용 전: 평문(조인 값) 그대로 사용 */
  }
  return rows.sort((a, b) =>
    (a.student?.student_number ?? '').localeCompare(b.student?.student_number ?? ''),
  )
}

export async function updateEnrollmentScores(
  id: string,
  s: { midterm: number | null; final: number | null; attendance: number | null; extra: number | null },
): Promise<void> {
  const { error } = await supabase.from('enrollments').update(s).eq('id', id)
  if (error) throw error
}

export async function removeEnrollment(id: string): Promise<void> {
  const { error } = await supabase.from('enrollments').delete().eq('id', id)
  if (error) throw error
}

// 엑셀 점수 일괄: 과목 내 학번으로 해당 enrollment 점수 1건 갱신.
export async function updateEnrollmentScoreByNumber(
  courseId: string,
  studentNumber: string,
  field: ScoreField,
  value: number,
): Promise<'ok' | 'not_found'> {
  const { data: st } = await supabase
    .from('students')
    .select('id')
    .eq('student_number', studentNumber)
    .maybeSingle()
  const sid = (st as { id: string } | null)?.id
  if (!sid) return 'not_found'
  const { data, error } = await supabase
    .from('enrollments')
    .update({ [field]: value })
    .eq('course_id', courseId)
    .eq('student_id', sid)
    .select('id')
  if (error) throw error
  return data && data.length > 0 ? 'ok' : 'not_found'
}

// 출결 엑셀 업로드: 과목 내 학번으로 출석/지각/결석 '횟수' 저장 + 출석 점수 자동 계산(attendance).
export async function updateAttendanceByNumber(
  courseId: string,
  studentNumber: string,
  counts: { present: number; late: number; absent: number },
  latePerAbsent: number,
): Promise<'ok' | 'not_found'> {
  const { data: st } = await supabase
    .from('students')
    .select('id')
    .eq('student_number', studentNumber)
    .maybeSingle()
  const sid = (st as { id: string } | null)?.id
  if (!sid) return 'not_found'
  const attendance = computeAttendanceScore(counts.present, counts.late, counts.absent, latePerAbsent)
  const { data, error } = await supabase
    .from('enrollments')
    .update({
      att_present: counts.present,
      att_late: counts.late,
      att_absent: counts.absent,
      attendance,
    })
    .eq('course_id', courseId)
    .eq('student_id', sid)
    .select('id')
  if (error) throw error
  return data && data.length > 0 ? 'ok' : 'not_found'
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
    extra?: number | null // 미지정 시 DB 기본값(100, 만점) 적용
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
    // 초기 비밀번호 = 학번 + 전화 뒤 4자리 (로그인 화면 안내와 동일, 009 규칙과 일치)
    const last4 = p.phone.replace(/\D/g, '').slice(-4)
    const { data: su, error: e1 } = await supabaseSignup.auth.signUp({
      email: studentNumberToEmail(sn),
      password: sn + last4,
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
      must_change_password: true, // 최초 로그인 시 비밀번호 변경 강제
    })
    if (e2) throw e2
  }
  const enrollRow: {
    course_id: string
    student_id: string
    midterm: number | null
    final: number | null
    attendance: number | null
    extra?: number | null
  } = {
    course_id: courseId,
    student_id: studentId,
    midterm: p.midterm,
    final: p.final,
    attendance: p.attendance,
  }
  if (p.extra !== undefined) enrollRow.extra = p.extra // 미지정이면 컬럼 생략 → DB 기본값 100(만점)
  const { error: e3 } = await supabase.from('enrollments').insert(enrollRow)
  if (e3) throw e3
}

export async function updateCoursePublished(courseId: string, published: boolean): Promise<void> {
  const { error } = await supabase.from('courses').update({ scores_published: published }).eq('id', courseId)
  if (error) throw error
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
