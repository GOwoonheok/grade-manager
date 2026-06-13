import { useEffect, useState } from 'react'
import { BookOpen, Check, ChevronLeft, X as XIcon } from 'lucide-react'
import {
  getMyStudyStatus,
  imageUrl,
  listCards,
  listDecks,
  requestStudy,
  setCardMark,
  type Card,
  type Deck,
  type StudyStatus,
} from '../lib/flashcards'

function Center({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-14 px-4">{children}</div>
}

export default function StudentStudy() {
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyStudyStatus().then((s) => {
      setStatus(s)
      setLoading(false)
      if (s === 'approved') listDecks().then(setDecks).catch(() => {})
    })
  }, [])

  const openDeck = async (d: Deck) => {
    setDeck(d)
    setCards(await listCards(d.id))
    setIdx(0)
    setFlipped(false)
  }
  const mark = async (s: 'known' | 'unknown') => {
    const c = cards[idx]
    if (!c) return
    setBusy(true)
    try { await setCardMark(c.id, s) } catch { /* 진도 저장 실패 무시 */ }
    setBusy(false)
    setFlipped(false)
    setIdx((i) => i + 1)
  }

  if (loading) return <p className="text-center text-gray-500 py-12">불러오는 중...</p>

  if (status === 'none')
    return (
      <Center>
        <p className="text-gray-600 mb-4">조달관리사 학습은 승인 후 이용할 수 있습니다.</p>
        <button
          onClick={async () => { await requestStudy(); setStatus('pending') }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
        >
          학습 신청
        </button>
      </Center>
    )
  if (status === 'pending')
    return <Center><p className="text-gray-600">학습 신청이 접수되었습니다. <b>관리자 승인 대기중</b>입니다.</p></Center>
  if (status === 'rejected')
    return <Center><p className="text-gray-600">학습 신청이 거부되었습니다. 관리자에게 문의하세요.</p></Center>

  // approved — 과목 선택
  if (!deck)
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">과목 선택</h2>
        {decks.length === 0 ? (
          <p className="text-gray-400 text-sm">등록된 과목이 없습니다.</p>
        ) : (
          decks.map((d) => (
            <button
              key={d.id}
              onClick={() => openDeck(d)}
              className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm text-left"
            >
              <BookOpen className="text-indigo-600" size={20} />
              <span className="font-medium text-gray-900">{d.name}</span>
            </button>
          ))
        )}
      </div>
    )

  // 카드 플레이어
  const card = cards[idx]
  if (!card)
    return (
      <Center>
        <p className="text-gray-700 font-medium mb-4">학습 완료! ({cards.length}장)</p>
        <button onClick={() => { setIdx(0); setFlipped(false) }} className="px-4 py-2 border border-gray-300 rounded-lg mr-2">다시 학습</button>
        <button onClick={() => setDeck(null)} className="px-4 py-2 border border-gray-300 rounded-lg">과목 목록</button>
      </Center>
    )
  const img = flipped ? card.back_image : card.front_image
  const txt = flipped ? card.back : card.front
  return (
    <div>
      <button onClick={() => setDeck(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3">
        <ChevronLeft size={16} />
        {deck.name}
      </button>
      <p className="text-center text-xs text-gray-400 mb-2">{idx + 1} / {cards.length}</p>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-56 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center gap-3 text-center"
      >
        <span className="text-[11px] text-gray-400">{flipped ? '정답 · 설명' : '문제'} (탭하여 뒤집기)</span>
        {img && <img src={imageUrl(img)} alt="" className="max-h-48 rounded-lg object-contain" />}
        {txt && <p className="text-lg font-medium text-gray-900 whitespace-pre-wrap">{txt}</p>}
      </button>
      <div className="flex gap-2 mt-4">
        <button onClick={() => mark('unknown')} disabled={busy} className="flex-1 py-3 rounded-xl border border-red-200 text-red-700 bg-red-50 font-medium flex items-center justify-center gap-1 disabled:opacity-50">
          <XIcon size={18} />모른다
        </button>
        <button onClick={() => mark('known')} disabled={busy} className="flex-1 py-3 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 font-medium flex items-center justify-center gap-1 disabled:opacity-50">
          <Check size={18} />안다
        </button>
      </div>
    </div>
  )
}
