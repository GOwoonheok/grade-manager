import { useEffect, useState, type ChangeEvent } from 'react'
import { Check, Image as ImageIcon, Plus, Trash2, X as XIcon } from 'lucide-react'
import {
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  listCards,
  listDecks,
  listMembers,
  setMemberStatus,
  uploadCardImage,
  type Card,
  type Deck,
  type StudyMember,
} from '../lib/flashcards'
import { resizeImage } from '../lib/answerSheets'

const STATUS_LABEL: Record<string, string> = { pending: '대기', approved: '승인', rejected: '거부' }
const STATUS_CLS: Record<string, string> = {
  pending: 'text-amber-600',
  approved: 'text-emerald-600',
  rejected: 'text-red-600',
}

export default function AdminStudy() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<StudyMember[]>([])
  const [newDeck, setNewDeck] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const loadDecks = async () => setDecks(await listDecks())
  const loadCards = async (d: Deck) => { setDeck(d); setCards(await listCards(d.id)) }
  const reloadCards = async () => { if (deck) setCards(await listCards(deck.id)) }
  const loadMembers = async () => setMembers(await listMembers())

  useEffect(() => {
    loadDecks().catch((e) => setErr(e.message))
    loadMembers().catch(() => {})
  }, [])

  const addDeck = async () => {
    if (!newDeck.trim()) return
    try { await createDeck(newDeck.trim()); setNewDeck(''); await loadDecks() } catch (e: any) { setErr(e.message) }
  }
  const removeDeck = async (id: string) => {
    if (!window.confirm('이 과목과 카드 전체를 삭제할까요?')) return
    await deleteDeck(id)
    if (deck?.id === id) setDeck(null)
    await loadDecks()
  }
  const decide = async (m: StudyMember, s: 'approved' | 'rejected') => {
    await setMemberStatus(m.id, s)
    await loadMembers()
  }

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-red-600">{err}</p>}

      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">과목 · 카드 관리</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={newDeck}
            onChange={(e) => setNewDeck(e.target.value)}
            placeholder="새 과목명 (예: 조달관리 일반)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={addDeck} className="px-4 py-2 border border-indigo-600 text-indigo-700 rounded-lg font-medium flex items-center gap-1">
            <Plus size={16} />과목 추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {decks.length === 0 && <span className="text-sm text-gray-400">과목을 추가하세요.</span>}
          {decks.map((d) => (
            <span
              key={d.id}
              onClick={() => loadCards(d)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                deck?.id === d.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-700'
              }`}
            >
              {d.name}
              <button onClick={(e) => { e.stopPropagation(); removeDeck(d.id) }} className="text-gray-400 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </span>
          ))}
        </div>
        {deck && <DeckCards deck={deck} cards={cards} reload={reloadCards} />}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">학습 신청 승인</h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">신청 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <span className="text-gray-700">
                  {m.student?.name} <span className="text-gray-400">({m.student?.student_number})</span> —{' '}
                  <span className={STATUS_CLS[m.status]}>{STATUS_LABEL[m.status]}</span>
                </span>
                {m.status === 'pending' && (
                  <span className="flex gap-1">
                    <button onClick={() => decide(m, 'approved')} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Check size={14} />승인
                    </button>
                    <button onClick={() => decide(m, 'rejected')} className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                      <XIcon size={14} />거부
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DeckCards({ deck, cards, reload }: { deck: Deck; cards: Card[]; reload: () => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [frontImg, setFrontImg] = useState<string | null>(null)
  const [backImg, setBackImg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pick = async (e: ChangeEvent<HTMLInputElement>, set: (p: string | null) => void) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setErr(null)
    try {
      const blob = await resizeImage(f)
      set(await uploadCardImage(blob))
    } catch (er: any) {
      setErr('이미지 업로드 실패: ' + (er?.message ?? er))
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }
  const add = async () => {
    if (!front.trim() && !frontImg) { setErr('앞면(문제)을 입력하세요.'); return }
    setBusy(true)
    setErr(null)
    try {
      await createCard(deck.id, { front: front.trim(), back: back.trim(), front_image: frontImg, back_image: backImg })
      setFront(''); setBack(''); setFrontImg(null); setBackImg(null)
      reload()
    } catch (er: any) {
      setErr('카드 추가 실패: ' + (er?.message ?? er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">{deck.name} — 카드 {cards.length}장</p>
      <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
        {cards.length === 0 && <p className="text-sm text-gray-400">카드가 없습니다.</p>}
        {cards.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 text-sm border border-gray-200 rounded-lg p-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{c.front || '(이미지)'}</p>
              <p className="text-gray-500 truncate">{c.back || (c.back_image ? '(이미지)' : '')}</p>
            </div>
            <button onClick={async () => { await deleteCard(c.id); reload() }} className="text-gray-400 hover:text-red-600 shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="앞면 (문제/개념)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="뒤면 (정답/설명)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <div className="flex flex-wrap gap-2 text-xs">
          <ImgPick label={frontImg ? '앞면 이미지 ✓' : '앞면 이미지'} onChange={(e) => pick(e, setFrontImg)} />
          <ImgPick label={backImg ? '뒤면 이미지 ✓' : '뒤면 이미지'} onChange={(e) => pick(e, setBackImg)} />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button onClick={add} disabled={busy} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium flex items-center gap-1">
          <Plus size={16} />{busy ? '처리 중...' : '카드 추가'}
        </button>
      </div>
    </div>
  )
}

function ImgPick({ label, onChange }: { label: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100">
      <ImageIcon size={14} />
      {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="hidden" />
    </label>
  )
}
