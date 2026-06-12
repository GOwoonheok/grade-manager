import * as XLSX from 'xlsx'
import { SCORE_LABEL, type ScoreField, type Student } from './supabase'

type TemplateStudent = Pick<Student, 'student_number' | 'name'>

// 헤더 + 학생 행을 2차원 배열로 반환. 점수 칸은 빈 문자열.
// 예: [['학번','이름','기말'], ['20240001','홍길동',''], ...]
export function buildScoreTemplateRows(
  field: ScoreField,
  students: TemplateStudent[],
): string[][] {
  const header = ['학번', '이름', SCORE_LABEL[field]]
  const rows = students.map((s) => [s.student_number, s.name, ''])
  return [header, ...rows]
}

// 워크북 생성 후 브라우저 다운로드 트리거. 파일명 예: '기말_점수_양식.xlsx'
export function downloadScoreTemplate(
  field: ScoreField,
  students: TemplateStudent[],
): void {
  const rows = buildScoreTemplateRows(field, students)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SCORE_LABEL[field])
  XLSX.writeFile(wb, `${SCORE_LABEL[field]}_점수_양식.xlsx`)
}
