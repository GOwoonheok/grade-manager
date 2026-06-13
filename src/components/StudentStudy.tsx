import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Maximize } from 'lucide-react'
import {
  getMyStudyStatus,
  imageUrl,
  listCards,
  listDecks,
  listTopics,
  requestStudy,
  type Card,
  type Deck,
  type StudyStatus,
  type Topic,
} from '../lib/flashcards'

function Center({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-14 px-4">{children}</div>
}

export default function StudentStudy() {
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMyStudyStatus().then((s) => {
      setStatus(s)
      setLoading(false)
      if (s === 'approved') listDecks().then(setDecks).catch(() => {})
    })
  }, [])

  const openDeck = async (d: Deck) => { setDeck(d); setTopic(null); setTopics(await listTopics(d.id)) }
  const openTopic = async (t: Topic) => { setTopic(t); setCards(await listCards(t.id)); setIdx(0); setFlipped(false) }
  const go = (delta: number) => { setFlipped(false); setIdx((i) => Math.min(Math.max(i + delta, 0), cards.length - 1)) }
  const toggleFull = () => {
    const el = playerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  if (loading) return <p className="text-center text-gray-500 py-12">불러오는 중...</p>
  if (status === 'none')
    return (
      <Center>
        <p className="text-gray-600 mb-4">조달관리사 학습은 승인 후 이용할 수 있습니다.</p>
        <button onClick={async () => { await requestStudy(); setStatus('pending') }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">학습 신청</button>
      </Center>
    )
  if (status === 'pending') return <Center><p className="text-gray-600">학습 신청이 접수되었습니다. <b>관리자 승인 대기중</b>입니다.</p></Center>
  if (status === 'rejected') return <Center><p className="text-gray-600">학습 신청이 거부되었습니다. 관리자에게 문의하세요.</p></Center>

  // 과목 선택
  if (!deck)
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">과목 선택</h2>
        {decks.length === 0 ? <p className="text-gray-400 text-sm">등록된 과목이 없습니다.</p> : decks.map((d) => (
          <button key={d.id} onClick={() => openDeck(d)} className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm text-left">
            <BookOpen className="text-indigo-600" size={20} />
            <span className="font-medium text-gray-900">{d.name}</span>
            <ChevronRight className="ml-auto text-gray-300" size={18} />
          </button>
        ))}
      </div>
    )

  // 토픽 목록 (시트 목록)
  if (!topic)
    return (
      <div>
        <button onClick={() => setDeck(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"><ChevronLeft size={16} />과목</button>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{deck.name} · 토픽</h2>
        {topics.length === 0 ? <p className="text-gray-400 text-sm">등록된 토픽이 없습니다.</p> : (
          <div className="space-y-2">
            {topics.map((t, i) => (
              <button key={t.id} onClick={() => openTopic(t)} className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-sm text-left">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-medium shrink-0">{i + 1}</span>
                <span className="font-medium text-gray-900">{t.name}</span>
                <ChevronRight className="ml-auto text-gray-300" size={18} />
              </button>
            ))}
          </div>
        )}
      </div>
    )

  // 카드 플레이어
  const card = cards[idx]
  return (
    <div>
      <button onClick={() => setTopic(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"><ChevronLeft size={16} />{topic.name}</button>
      {cards.length === 0 ? (
        <Center><p className="text-gray-400">카드가 없습니다.</p></Center>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">{idx + 1} / {cards.length}</span>
            <button onClick={toggleFull} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><Maximize size={14} />전체화면</button>
          </div>
          <div ref={playerRef} className="bg-gray-50 rounded-2xl flex items-center justify-center p-1">
            <button onClick={() => setFlipped((f) => !f)} className="w-full max-w-2xl min-h-56 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center">
              <span className="text-[11px] text-gray-400">{flipped ? '정답 · 설명' : '문제'} (탭하여 뒤집기)</span>
              {(flipped ? card.back_image : card.front_image) && (
                <img src={imageUrl((flipped ? card.back_image : card.front_image) as string)} alt="" className="max-h-60 rounded-lg object-contain" />
              )}
              {(flipped ? card.back : card.front) && (
                <p className="text-lg font-medium text-gray-900 whitespace-pre-wrap">{flipped ? card.back : card.front}</p>
              )}
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => go(-1)} disabled={idx === 0} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium flex items-center justify-center gap-1 disabled:opacity-40"><ChevronLeft size={18} />이전</button>
            <button onClick={() => go(1)} disabled={idx >= cards.length - 1} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-1 disabled:opacity-40">다음<ChevronRight size={18} /></button>
          </div>
        </>
      )}
    </div>
  )
}
