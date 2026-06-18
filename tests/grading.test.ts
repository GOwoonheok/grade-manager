import { describe, it, expect } from 'vitest'
import { calcFinalScore, assignRelativeGrades, buildGradeReportRows, weightedScore } from '../src/lib/grading'

describe('calcFinalScore', () => {
  it('가중합 (30/40/30)', () => {
    expect(calcFinalScore({ midterm: 90, final: 80, attendance: 100 }, { midterm_weight: 30, final_weight: 40, attendance_weight: 30 })).toBe(89)
  })
  it('하나라도 null이면 null', () => {
    expect(calcFinalScore({ midterm: 90, final: null, attendance: 100 }, { midterm_weight: 30, final_weight: 40, attendance_weight: 30 })).toBeNull()
  })
  it('소수 둘째자리 반올림', () => {
    const v = calcFinalScore({ midterm: 77, final: 77, attendance: 77 }, { midterm_weight: 33, final_weight: 33, attendance_weight: 34 })
    expect(v).toBe(77)
  })
  it('4번째 항목(extra) 가중 반영', () => {
    // 40/40/10/10, 점수 90/80/100/50 → 36+32+10+5 = 83
    expect(
      calcFinalScore(
        { midterm: 90, final: 80, attendance: 100, extra: 50 },
        { midterm_weight: 40, final_weight: 40, attendance_weight: 10, extra_weight: 10 },
      ),
    ).toBe(83)
  })
  it('extra_weight 0이면 extra가 null이어도 최종 산출', () => {
    expect(
      calcFinalScore(
        { midterm: 90, final: 80, attendance: 100, extra: null },
        { midterm_weight: 30, final_weight: 40, attendance_weight: 30, extra_weight: 0 },
      ),
    ).toBe(89)
  })
  it('extra_weight>0인데 extra가 null이면 null', () => {
    expect(
      calcFinalScore(
        { midterm: 90, final: 80, attendance: 100, extra: null },
        { midterm_weight: 30, final_weight: 40, attendance_weight: 20, extra_weight: 10 },
      ),
    ).toBeNull()
  })
})

describe('assignRelativeGrades', () => {
  it('0001·null 제외 + 비율대로 A/C', () => {
    const items = [
      { id: 'a', studentNumber: '1', finalScore: 100 },
      { id: 'b', studentNumber: '2', finalScore: 80 },
      { id: 'c', studentNumber: '3', finalScore: 60 },
      { id: 'd', studentNumber: '4', finalScore: 40 },
      { id: 'x', studentNumber: '0001', finalScore: 99 },
      { id: 'y', studentNumber: '5', finalScore: null },
    ]
    const g = assignRelativeGrades(items, { a: 25, b: 25 })
    expect(g['x']).toBeUndefined()
    expect(g['y']).toBeUndefined()
    expect(g['a']).toBe('A')
    expect(g['d']).toBe('C')
  })
  it('경계 동점자는 올림(둘 다 상위 등급)', () => {
    const items = [
      { id: 'a', studentNumber: '1', finalScore: 90 },
      { id: 'b', studentNumber: '2', finalScore: 90 },
      { id: 'c', studentNumber: '3', finalScore: 50 },
      { id: 'd', studentNumber: '4', finalScore: 40 },
    ]
    const g = assignRelativeGrades(items, { a: 25, b: 25 })
    expect(g['a']).toBe('A')
    expect(g['b']).toBe('A')
  })
  it('대상 없으면 빈 결과', () => {
    expect(assignRelativeGrades([{ id: 'x', studentNumber: '0001', finalScore: 100 }], { a: 30, b: 40 })).toEqual({})
  })
})

describe('weightedScore', () => {
  it('원점수 × 비율 = 반영점수(소수 둘째자리)', () => {
    expect(weightedScore(88, 40)).toBe(35.2) // 88 × 40%
    expect(weightedScore(100, 10)).toBe(10)
    expect(weightedScore(83.33, 10)).toBe(8.33)
  })
  it('원점수 NULL이면 null', () => {
    expect(weightedScore(null, 40)).toBeNull()
  })
})

describe('buildGradeReportRows', () => {
  const w = { midterm_weight: 40, final_weight: 40, attendance_weight: 10, extra_weight: 10 }
  const students = [
    { id: 'b', studentNumber: '20240002', name: '이서연', midterm: 76, final: 81, attendance: 90, extra: 100 },
    { id: 'a', studentNumber: '20240001', name: '김민준', midterm: 88, final: 92, attendance: 100, extra: 100 },
    { id: 'x', studentNumber: '0001', name: '가상인물', midterm: 100, final: 100, attendance: 100, extra: 100 },
    { id: 'c', studentNumber: '20240003', name: '박도윤', midterm: null, final: 85, attendance: 100, extra: 100 },
  ]
  const grades = { a: 'A' as const, b: 'B' as const }
  const rows = buildGradeReportRows(students, w, '토론', grades)

  it('헤더: 항목별 배점 + 최종 100점', () => {
    expect(rows[0]).toEqual(['학번', '성명', '중간(40점)', '기말(40점)', '출석(10점)', '토론(10점)', '최종(100점)', '등급'])
  })
  it('0001(가상인물) 제외 + 학번 오름차순', () => {
    expect(rows.slice(1).map((r) => r[0])).toEqual(['20240001', '20240002', '20240003'])
  })
  it('각 항목 = 반영점수, 네 항목 합 = 최종', () => {
    const r = rows[1] // 김민준 88/92/100/100
    expect(r.slice(2, 6)).toEqual([35.2, 36.8, 10, 10])
    expect(r[6]).toBe(92)
    const sum = (r[2] as number) + (r[3] as number) + (r[4] as number) + (r[5] as number)
    expect(sum).toBeCloseTo(r[6] as number, 2)
    expect(r[7]).toBe('A') // 등급
  })
  it('미입력 항목·최종은 빈칸', () => {
    const r = rows[3] // 박도윤: 중간 null → 중간 빈칸, 최종 산출 불가 → 빈칸
    expect(r[2]).toBe('')
    expect(r[6]).toBe('')
    expect(r[7]).toBe('') // 등급 없음
  })
})
