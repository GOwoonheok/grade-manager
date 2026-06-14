import { SCORE_LABEL, type ScoreField, type Student } from './supabase'

type TemplateStudent = Pick<Student, 'student_number' | 'name'>

// 헤더 + 학생 행을 2차원 배열로 반환. 점수 칸은 빈 문자열.
// label: 4번째 항목처럼 과목별 표시명이 다른 경우 override(미지정 시 SCORE_LABEL).
// 예: [['학번','이름','기말'], ['20240001','홍길동',''], ...]
export function buildScoreTemplateRows(
  field: ScoreField,
  students: TemplateStudent[],
  label?: string,
): string[][] {
  const header = ['학번', '이름', label ?? SCORE_LABEL[field]]
  const rows = students.map((s) => [s.student_number, s.name, ''])
  return [header, ...rows]
}

// 워크북 생성 후 브라우저 다운로드 트리거. 파일명 예: '기말_점수_양식.xlsx'
export async function downloadScoreTemplate(
  field: ScoreField,
  students: TemplateStudent[],
  label?: string,
): Promise<void> {
  const XLSX = await import('xlsx') // 동적 import: 초기 번들에서 분리
  const eff = label ?? SCORE_LABEL[field]
  const rows = buildScoreTemplateRows(field, students, eff)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, eff)
  XLSX.writeFile(wb, `${eff}_점수_양식.xlsx`)
}
