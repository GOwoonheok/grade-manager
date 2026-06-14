// 순수 채점 로직 (Supabase 비의존 → 단위 테스트 가능). supabase.ts 가 재노출.

// 출석 점수: 출석/지각/결석 '횟수' → 0~100 점수.
// 규칙: 지각 latePerAbsent회 = 결석 1회로 환산 후, (총회차 - 환산결석)/총회차 × 100.
// 총회차 = 출석+지각+결석. 모두 0(미입력)이면 null.
export function computeAttendanceScore(
  present: number | null,
  late: number | null,
  absent: number | null,
  latePerAbsent = 3,
): number | null {
  const p = Number(present) || 0
  const l = Number(late) || 0
  const ab = Number(absent) || 0
  const total = p + l + ab
  if (total <= 0) return null
  const per = Math.max(1, Math.floor(Number(latePerAbsent) || 3))
  const convertedAbsent = ab + Math.floor(l / per) // 지각 per회마다 결석 1회
  const score = ((total - convertedAbsent) / total) * 100
  return Math.max(0, Math.round(score * 100) / 100) // 0 미만 방지, 소수 둘째자리
}

// 가중치 적용 최종점수. 중간/기말/출석 중 하나라도 NULL이면 null.
// 4번째 항목(extra)은 가중치(extra_weight)>0 일 때만 필수(없으면 0 기여) — 하위호환 위해 선택적.
export function calcFinalScore(
  s: { midterm: number | null; final: number | null; attendance: number | null; extra?: number | null },
  w: { midterm_weight: number; final_weight: number; attendance_weight: number; extra_weight?: number },
): number | null {
  if (s.midterm == null || s.final == null || s.attendance == null) return null
  const xw = w.extra_weight ?? 0
  if (xw > 0 && s.extra == null) return null
  const total =
    s.midterm * w.midterm_weight +
    s.final * w.final_weight +
    s.attendance * w.attendance_weight +
    (s.extra ?? 0) * xw
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
