import { useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Info, MessagesSquare } from 'lucide-react'
import {
  getMyStudyStatus,
  listCards,
  listDecks,
  listTopics,
  requestStudy,
  type Card,
  type Deck,
  type StudyStatus,
  type Topic,
} from '../lib/flashcards'
import QnaBoard from './QnaBoard'
import CardPlayer from './CardPlayer'
import StudyIntro from './StudyIntro'
import StudyMenuTile from './StudyMenuTile'

type View = 'menu' | 'intro' | 'flash' | 'qna'

export default function StudentStudy() {
  const [view, setView] = useState<View>('menu')

  if (view === 'menu')
    return (
      <div className="space-y-3">
        <StudyMenuTile icon={<Info size={26} />} title="공공조달관리사 소개" desc="자격 개요와 과목 안내" onClick={() => setView('intro')} />
        <StudyMenuTile icon={<BookOpen size={26} />} title="플래시카드 학습" desc="과목 · 토픽별 카드로 암기 학습" onClick={() => setView('flash')} />
        <StudyMenuTile icon={<MessagesSquare size={26} />} title="같이 공부하기 (Q&A)" desc="질문하고 함께 답하기" onClick={() => setView('qna')} />
      </div>
    )

  return (
    <div>
      <button onClick={() => setView('menu')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ChevronLeft size={16} />메뉴
      </button>
      {view === 'intro' && <StudyIntro />}
      {view === 'flash' && <FlashStudy />}
      {view === 'qna' && <QnaBoard />}
    </div>
  )
}

// ---------- 플래시카드 학습 ----------
function FlashStudy() {
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyStudyStatus().then((s) => { setStatus(s); setLoading(false); if (s === 'approved') listDecks().then(setDecks).catch(() => {}) })
  }, [])

  const openDeck = async (d: Deck) => { setDeck(d); setTopic(null); setTopics(await listTopics(d.id)) }
  const openTopic = async (t: Topic) => { setTopic(t); setCards(await listCards(t.id)) }

  if (loading) return <p className="text-center text-gray-500 py-12">불러오는 중...</p>
  if (status === 'none')
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">플래시카드 학습은 승인 후 이용할 수 있습니다.</p>
        <button onClick={async () => { await requestStudy(); setStatus('pending') }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">학습 신청</button>
      </div>
    )
  if (status === 'pending') return <p className="text-center text-gray-600 py-12">학습 신청이 접수되었습니다. <b>관리자 승인 대기중</b>입니다.</p>
  if (status === 'rejected') return <p className="text-center text-gray-600 py-12">학습 신청이 거부되었습니다. 관리자에게 문의하세요.</p>

  if (!deck)
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">과목 선택</h2>
        {decks.length === 0 ? <p className="text-gray-400 text-sm">등록된 과목이 없습니다.</p> : decks.map((d) => (
          <button key={d.id} onClick={() => openDeck(d)} className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm text-left">
            <BookOpen className="text-indigo-600" size={20} /><span className="font-medium text-gray-900">{d.name}</span>
            <ChevronRight className="ml-auto text-gray-300" size={18} />
          </button>
        ))}
      </div>
    )

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

  return (
    <div>
      <button onClick={() => setTopic(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"><ChevronLeft size={16} />{topic.name}</button>
      <CardPlayer cards={cards} />
    </div>
  )
}
