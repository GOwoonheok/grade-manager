// 전체 성적표 엑셀 다운로드 — 비율(가중치) 반영 점수 + 합계(최종 100점).
// 순수 행 생성은 ./grading 의 buildGradeReportRows(단위 테스트 대상). 여기선 xlsx 변환·파일 저장만.
import { buildGradeReportRows, type ReportStudentRow } from './grading'
import type { Course } from './supabase'
import type { EnrollmentRow } from './courses'

function toReportRows(rows: EnrollmentRow[]): ReportStudentRow[] {
  return rows.map((r) => ({
    id: r.id,
    studentNumber: r.student?.student_number ?? '',
    name: r.student?.name ?? '',
    midterm: r.midterm,
    final: r.final,
    attendance: r.attendance,
    extra: r.extra,
  }))
}

// 엑셀 시트명 제약: 31자 이내, \ / ? * [ ] : 사용 불가 → 공백 치환.
function sanitizeSheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
}

// 워크북 생성 후 브라우저 다운로드. 파일명 예: '2026-1학기_공공조달법_성적표_20260618.xlsx'
export async function downloadGradeReport(
  rows: EnrollmentRow[],
  course: Course,
  grades: Record<string, 'A' | 'B' | 'C'>,
): Promise<void> {
  const XLSX = await import('xlsx') // 동적 import: 초기 번들 분리(엑셀 업로드와 동일 패턴)
  const w = {
    midterm_weight: course.midterm_weight,
    final_weight: course.final_weight,
    attendance_weight: course.attendance_weight,
    extra_weight: course.extra_weight ?? 0,
  }
  const aoa = buildGradeReportRows(toReportRows(rows), w, course.extra_label || '토론', grades)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 6 }]
  const wb = XLSX.utils.book_new()
  const label = `${course.year}-${course.semester}학기 ${course.subject_name}`
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(`${label} 성적표`))
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  XLSX.writeFile(wb, `${label}_성적표_${ymd}.xlsx`)
}
