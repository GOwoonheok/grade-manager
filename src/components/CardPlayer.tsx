import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, Shuffle } from 'lucide-react'
import { imageUrl, type Card } from '../lib/flashcards'

function shuffleCards(arr: Card[]): Card[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 학생·관리자 공용 카드 플레이어: 플립 + 랜덤 + 자동재생(4s) + 키보드(←/→/Space) + 전체화면
export default function CardPlayer({ cards }: { cards: Card[] }) {
  const [seq, setSeq] = useState<Card[]>(cards)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [random, setRandom] = useState(false)
  const [auto, setAuto] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSeq(random ? shuffleCards(cards) : cards)
    setIdx(0)
    setFlipped(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  const go = (delta: number) => { setFlipped(false); setIdx((i) => Math.min(Math.max(i + delta, 0), seq.length - 1)) }
  const toggleRandom = () => { const nr = !random; setRandom(nr); setSeq(nr ? shuffleCards(cards) : cards); setIdx(0); setFlipped(false) }
  const toggleFull = () => { const el = playerRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.() }

  useEffect(() => {
    if (!auto || seq.length === 0) return
    const t = setInterval(() => {
      setFlipped((f) => { if (!f) return true; setIdx((i) => (i + 1) % seq.length); return false })
    }, 4000)
    return () => clearInterval(t)
  }, [auto, seq.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return // 입력 중에는 무시
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq.length])

  const card = seq[idx]
  if (seq.length === 0 || !card) return <p className="text-center text-gray-400 py-12">카드가 없습니다.</p>

  return (
    <>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-gray-400">{idx + 1} / {seq.length}</span>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={toggleRandom} className={random ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-800'}><Shuffle size={13} className="inline mr-0.5" />{random ? '랜덤' : '순서'}</button>
          <button onClick={() => setAuto((a) => !a)} className={auto ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>{auto ? <Pause size={13} className="inline mr-0.5" /> : <Play size={13} className="inline mr-0.5" />}자동</button>
          <button onClick={toggleFull} className="text-gray-500 hover:text-gray-800"><Maximize size={13} className="inline mr-0.5" />전체화면</button>
        </div>
      </div>
      <div ref={playerRef} className="bg-gray-50 rounded-2xl flex items-center justify-center p-1">
        <button onClick={() => setFlipped((f) => !f)} className="w-full max-w-2xl min-h-56 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center">
          <span className="text-[11px] text-gray-400">{flipped ? '정의 · 내용 · 기타' : '토픽명'} (탭/Space 뒤집기)</span>
          {!flipped ? (
            <p className="text-2xl font-bold text-gray-900 whitespace-pre-wrap">{card.term}</p>
          ) : (
            <div className="w-full space-y-3 text-left">
              {card.front_image && <img src={imageUrl(card.front_image)} alt="" className="max-h-52 mx-auto rounded-lg object-contain" />}
              {card.definition && (<div><p className="text-[11px] font-semibold text-indigo-600">정의</p><p className="text-gray-900 whitespace-pre-wrap">{card.definition}</p></div>)}
              {card.content && (<div><p className="text-[11px] font-semibold text-indigo-600">내용</p><p className="text-gray-800 whitespace-pre-wrap">{card.content}</p></div>)}
              {card.keywords && (<div><p className="text-[11px] font-semibold text-indigo-600">기타</p><p className="text-gray-600 text-sm whitespace-pre-wrap">{card.keywords}</p></div>)}
            </div>
          )}
        </button>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => go(-1)} disabled={idx === 0} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium flex items-center justify-center gap-1 disabled:opacity-40"><ChevronLeft size={18} />이전</button>
        <button onClick={() => go(1)} disabled={idx >= seq.length - 1} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-1 disabled:opacity-40">다음<ChevronRight size={18} /></button>
      </div>
    </>
  )
}
