import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Info, Maximize, MessagesSquare, Pause, Play, Shuffle } from 'lucide-react'
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
import QnaBoard from './QnaBoard'

type View = 'menu' | 'intro' | 'flash' | 'qna'

export default function StudentStudy() {
  const [view, setView] = useState<View>('menu')

  if (view === 'menu')
    return (
      <div className="space-y-3">
        <MenuTile icon={<Info size={26} />} title="공공조달관리사 소개" desc="자격 개요와 과목 안내" onClick={() => setView('intro')} />
        <MenuTile icon={<BookOpen size={26} />} title="플래시카드 학습" desc="과목 · 토픽별 카드로 암기 학습" onClick={() => setView('flash')} />
        <MenuTile icon={<MessagesSquare size={26} />} title="같이 공부하기 (Q&A)" desc="질문하고 함께 답하기" onClick={() => setView('qna')} />
      </div>
    )

  return (
    <div>
      <button onClick={() => setView('menu')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ChevronLeft size={16} />메뉴
      </button>
      {view === 'intro' && <Intro />}
      {view === 'flash' && <FlashStudy />}
      {view === 'qna' && <QnaBoard />}
    </div>
  )
}

function MenuTile({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition text-left">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1">
        <h2 className="font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="text-gray-300" size={20} />
    </button>
  )
}

function Intro() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">공공조달관리사</h2>
      <p className="text-sm text-gray-600 leading-relaxed">
        공공조달관리사는 국가·공공기관의 조달 업무(계획·계약·관리)에 필요한 전문 역량을 검증하는 자격입니다.
        본 학습 메뉴에서는 과목별 핵심 개념을 <b>플래시카드</b>로 익히고, <b>Q&A</b>로 함께 학습할 수 있습니다.
      </p>
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">학습 과목(예시)</p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>공공조달의 이해</li>
          <li>공공조달 계획분석</li>
          <li>공공계약관리</li>
          <li>공공조달 관리실무</li>
        </ul>
        <p className="text-xs text-gray-400 mt-2">※ 실제 과목·토픽·카드는 관리자가 등록한 내용으로 제공됩니다.</p>
      </div>
    </div>
  )
}

// ---------- 플래시카드 학습 ----------
function shuffleCards(arr: Card[]): Card[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function FlashStudy() {
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [seq, setSeq] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [random, setRandom] = useState(false)
  const [auto, setAuto] = useState(false)
  const [loading, setLoading] = useState(true)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMyStudyStatus().then((s) => { setStatus(s); setLoading(false); if (s === 'approved') listDecks().then(setDecks).catch(() => {}) })
  }, [])

  const openDeck = async (d: Deck) => { setDeck(d); setTopic(null); setTopics(await listTopics(d.id)) }
  const openTopic = async (t: Topic) => {
    setTopic(t)
    const cs = await listCards(t.id)
    setCards(cs); setSeq(random ? shuffleCards(cs) : cs); setIdx(0); setFlipped(false)
  }
  const go = (delta: number) => { setFlipped(false); setIdx((i) => Math.min(Math.max(i + delta, 0), seq.length - 1)) }
  const toggleRandom = () => { const nr = !random; setRandom(nr); setSeq(nr ? shuffleCards(cards) : cards); setIdx(0); setFlipped(false) }
  const toggleFull = () => { const el = playerRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.() }

  // 자동재생: 4초마다 앞→뒤→다음 순환
  useEffect(() => {
    if (!auto || !topic || seq.length === 0) return
    const t = setInterval(() => {
      setFlipped((f) => {
        if (!f) return true
        setIdx((i) => (i + 1) % seq.length)
        return false
      })
    }, 4000)
    return () => clearInterval(t)
  }, [auto, topic, seq.length])

  // 키보드: ←/→ 이동, Space 뒤집기
  useEffect(() => {
    if (!topic) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, seq.length])

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

  const card = seq[idx]
  return (
    <div>
      <button onClick={() => setTopic(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"><ChevronLeft size={16} />{topic.name}</button>
      {seq.length === 0 || !card ? (
        <p className="text-center text-gray-400 py-12">카드가 없습니다.</p>
      ) : (
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
      )}
    </div>
  )
}
