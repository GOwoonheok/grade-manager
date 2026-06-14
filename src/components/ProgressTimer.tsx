import { useEffect, useRef, useState } from 'react'

// 처리 중 경과/예상 남은 시간(카운트다운) + 진행바. running=true 동안만 표시.
// 서버 단일 요청이라 정확한 진척이 아닌 estSec 기반 '예상'. 끝나면 부모가 실제 소요시간 표시.
export default function ProgressTimer({
  running,
  estSec = 30,
  label = '처리 중…',
}: {
  running: boolean
  estSec?: number
  label?: string
}) {
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(0)

  useEffect(() => {
    if (!running) return
    start.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed((Date.now() - start.current) / 1000), 250)
    return () => clearInterval(id)
  }, [running])

  if (!running) return null
  const e = Math.floor(elapsed)
  const remain = Math.max(0, estSec - e)
  const pct = Math.min(96, (elapsed / estSec) * 100)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="tabular-nums">경과 {e}초 · 예상 남은 {remain}초</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-2 bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      {e >= estSec && <p className="text-[11px] text-gray-400">거의 다 됐어요… 마무리 중</p>}
    </div>
  )
}
