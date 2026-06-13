import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, Maximize, Minus, Plus, Star } from 'lucide-react'
import { getMarks, imageUrl, setCardMark, type Card } from '../lib/flashcards'

type Mode = 'sequence' | 'random' | 'checked'
type SecKey = 'definition' | 'content' | 'keywords'

const SECTIONS: { key: SecKey; label: string }[] = [
  { key: 'definition', label: '정의' },
  { key: 'content', label: '내용' },
  { key: 'keywords', label: '기타' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// itpe식 학습 플레이어: 모드(순서/랜덤/체크만) + 섹션 점진공개(Enter/탭) + 가리기 + ★체크 + 글자크기
// preview=true (관리자 미리보기): 체크/모드'체크만' 비활성, 진도 저장 안 함.
export default function CardPlayer({ cards, preview = false }: { cards: Card[]; preview?: boolean }) {
  const [mode, setMode] = useState<Mode>('sequence')
  const [marks, setMarks] = useState<Record<string, 'known' | 'unknown'>>({})
  const [hide, setHide] = useState<Record<SecKey, boolean>>({ definition: true, content: true, keywords: true })
  const [idx, setIdx] = useState(0)
  const [reveal, setReveal] = useState(0)
  const [font, setFont] = useState(1)
  const [nonce, setNonce] = useState(0) // 랜덤 재섞기
  const playerRef = useRef<HTMLDivElement>(null)

  // 체크 상태 로드
  useEffect(() => {
    if (preview || cards.length === 0) {
      setMarks({})
      return
    }
    getMarks(cards.map((c) => c.id)).then(setMarks).catch(() => {})
  }, [cards, preview])

  // 출제 순서
  const seq = useMemo(() => {
    let list = cards
    if (mode === 'checked') list = cards.filter((c) => marks[c.id] === 'known')
    if (mode === 'random') list = shuffle(list)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, mode, marks, nonce])

  useEffect(() => {
    setIdx(0)
    setReveal(0)
  }, [mode, nonce, cards])

  const safeIdx = Math.min(idx, Math.max(0, seq.length - 1))
  const card = seq[safeIdx]

  // 현재 카드에서 '가려졌고 + 내용 있는' 섹션 (공개 순서)
  const hiddenSecs = useMemo(() => {
    if (!card) return [] as SecKey[]
    return SECTIONS.filter((s) => hide[s.key] && (card[s.key] || '').trim() !== '').map((s) => s.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, hide])

  const go = (d: number) => {
    setReveal(0)
    setIdx((i) => Math.min(Math.max(i + d, 0), seq.length - 1))
  }
  const advanceOrReveal = () => {
    if (!card) return
    if (reveal < hiddenSecs.length) setReveal((r) => r + 1)
    else if (safeIdx < seq.length - 1) go(1)
  }
  const toggleCheck = async () => {
    if (preview || !card) return
    const next = marks[card.id] === 'known' ? 'unknown' : 'known'
    setMarks((m) => ({ ...m, [card.id]: next }))
    try {
      await setCardMark(card.id, next)
    } catch {
      /* 저장 실패해도 화면은 유지 */
    }
  }
  const toggleFull = () => {
    const el = playerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        advanceOrReveal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq.length, reveal, hiddenSecs.length, safeIdx])

  if (cards.length === 0) return <p className="text-center text-gray-400 py-12">카드가 없습니다.</p>
  if (seq.length === 0)
    return (
      <div className="text-center text-gray-500 py-12 space-y-3">
        <p>체크(★)한 카드가 없습니다.</p>
        <button onClick={() => setMode('sequence')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
          전체 카드로 학습
        </button>
      </div>
    )
  if (!card) return null

  const checked = !preview && marks[card.id] === 'known'
  const allRevealed = reveal >= hiddenSecs.length

  const ModeBtn = ({ m, label }: { m: Mode; label: string }) => (
    <button
      onClick={() => {
        if (m === 'random' && mode === 'random') setNonce((n) => n + 1)
        setMode(m)
      }}
      className={mode === m ? 'text-indigo-600 font-semibold' : 'text-gray-500 hover:text-gray-800'}
    >
      {label}
    </button>
  )

  return (
    <div ref={playerRef} className="bg-white">
      {/* 상단: 진도 / 모드 / 글자 / 전체화면 */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="text-xs text-gray-400 tabular-nums">
          {safeIdx + 1} / {seq.length}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <ModeBtn m="sequence" label="순서" />
          <ModeBtn m="random" label="랜덤" />
          {!preview && <ModeBtn m="checked" label="체크만" />}
          <span className="text-gray-300">|</span>
          <button onClick={() => setFont((f) => Math.max(0.8, Math.round((f - 0.1) * 10) / 10))} className="text-gray-500 hover:text-gray-800" title="글자 작게">
            <Minus size={14} />
          </button>
          <button onClick={() => setFont((f) => Math.min(2, Math.round((f + 0.1) * 10) / 10))} className="text-gray-500 hover:text-gray-800" title="글자 크게">
            <Plus size={14} />
          </button>
          <button onClick={toggleFull} className="text-gray-500 hover:text-gray-800" title="전체화면">
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* 가리기 토글 */}
      <div className="flex items-center gap-2 mb-2 text-[11px]">
        <span className="text-gray-400">가리기:</span>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setHide((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className={`px-2 py-0.5 rounded-full border ${hide[s.key] ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-400'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 카드 */}
      <div
        onClick={advanceOrReveal}
        className="bg-gray-50 rounded-2xl border border-gray-200 p-6 min-h-64 cursor-pointer select-none"
      >
        <p className="font-bold text-gray-900 whitespace-pre-wrap text-center mb-4" style={{ fontSize: `${font * 1.4}rem` }}>
          {card.term}
        </p>
        {card.front_image && (
          <img src={imageUrl(card.front_image)} alt="" className="max-h-56 mx-auto rounded-lg object-contain mb-4" />
        )}
        <div className="space-y-3" style={{ fontSize: `${font}rem` }}>
          {SECTIONS.map((s) => {
            const val = (card[s.key] || '').trim()
            if (!val) return null
            const hpos = hiddenSecs.indexOf(s.key)
            const shown = hpos === -1 || hpos < reveal
            return (
              <div key={s.key}>
                <p className="text-[11px] font-semibold text-indigo-600">{s.label}</p>
                {shown ? (
                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{val}</p>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-400 bg-gray-100 rounded-lg py-2 px-3 text-sm">
                    <Eye size={14} /> 탭하여 {s.label} 보기
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 하단: 체크 / 이전 / 공개·다음 */}
      <div className="flex items-center gap-2 mt-4">
        {!preview && (
          <button
            onClick={toggleCheck}
            className={`px-3 py-3 rounded-xl border font-medium flex items-center gap-1 ${checked ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
            title="체크 (체크만 모드에서 모아보기)"
          >
            <Star size={18} className={checked ? 'fill-amber-400' : ''} />
          </button>
        )}
        <button onClick={() => go(-1)} disabled={safeIdx === 0} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium flex items-center justify-center gap-1 disabled:opacity-40">
          <ChevronLeft size={18} />이전
        </button>
        <button
          onClick={advanceOrReveal}
          disabled={allRevealed && safeIdx >= seq.length - 1}
          className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-1 disabled:opacity-40"
        >
          {allRevealed ? '다음' : '공개'}
          <ChevronRight size={18} />
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 mt-2">탭 / Space / Enter = 공개·다음 · ←→ 카드 이동</p>
    </div>
  )
}
