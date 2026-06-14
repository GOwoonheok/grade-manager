import { describe, it, expect } from 'vitest'
import { calcFinalScore, assignRelativeGrades } from '../src/lib/grading'

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
