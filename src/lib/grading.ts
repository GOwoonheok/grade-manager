// 순수 채점 로직 (Supabase 비의존 → 단위 테스트 가능). supabase.ts 가 재노출.

// 가중치 적용 최종점수. 셋 중 하나라도 NULL이면 null.
export function calcFinalScore(
  s: { midterm: number | null; final: number | null; attendance: number | null },
  w: { midterm_weight: number; final_weight: number; attendance_weight: number },
): number | null {
  if (s.midterm == null || s.final == null || s.attendance == null) return null
  const total =
    s.midterm * w.midterm_weight +
    s.final * w.final_weight +
    s.attendance * w.attendance_weight
  return Math.round((total / 100) * 100) / 100 // 소수 둘째자리
}

// 상대평가 등급: 학번 0001(가상인물)·최종점수 미산정(NULL) 제외.
// 최종점수 내림차순 상위 a%=A, 다음 b%=B, 나머지=C. 경계 동점자는 올림(상위 등급).
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
