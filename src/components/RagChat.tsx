import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { listDecks, type Deck } from '../lib/flashcards'
import { askRag, countEmbedded, listSources, type DocSource, type RagSource } from '../lib/knowledge'

type Turn = { q: string; a: string; sources: RagSource[]; loading?: boolean }

// B-2: 학습자료(카드+PDF) 근거 AI 질문답변 (무료 Gemini). 분야 선택 시 임베딩된 근거 안내.
export default function RagChat() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [deckId, setDeckId] = useState('') // '' = 전체
  const [deckSources, setDeckSources] = useState<DocSource[]>([])
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listDecks()
      .then(async (ds) => {
        setDecks(ds)
        const entries = await Promise.all(ds.map(async (d) => [d.id, await countEmbedded(d.id)] as const))
        setCounts(Object.fromEntries(entries))
      })
      .catch(() => {})
  }, [])

  // 분야 선택 시 그 분야의 근거 문서(PDF) 목록 표시
  useEffect(() => {
    if (!deckId) { setDeckSources([]); return }
    listSources(deckId).then(setDeckSources).catch(() => setDeckSources([]))
  }, [deckId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns])

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setTurns((t) => [...t, { q, a: '', sources: [], loading: true }])
    try {
      const r = await askRag(deckId, q)
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { q, a: r.answer, sources: r.sources } : x)))
    } catch (e: any) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { q, a: '오류: ' + (e?.message ?? e), sources: [] } : x)))
    } finally {
      setBusy(false)
    }
  }

  const totalEmbedded = Object.values(counts).reduce((a, b) => a + b, 0)
  const selCount = deckId ? (counts[deckId] || 0) : totalEmbedded

  return (
    <div className="flex flex-col" style={{ minHeight: '60vh' }}>
      <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white mb-2 text-sm">
        <option value="">전체 분야에서 찾기{totalEmbedded ? ` (${totalEmbedded}조각)` : ''}</option>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>{d.name}{counts[d.id] ? ` (${counts[d.id]}조각)` : ' (자료없음)'}</option>
        ))}
      </select>

      {/* 선택 분야의 임베딩된 근거자료 안내 */}
      <div className="mb-3 text-[11px]">
        {selCount === 0 ? (
          <p className="text-amber-600">
            {deckId ? '이 분야는 아직 임베딩된 자료가 없습니다 (카드/PDF 임베딩 필요).' : '아직 임베딩된 자료가 없습니다 — 관리자가 카드/PDF를 임베딩하면 답할 수 있어요.'}
          </p>
        ) : (
          <p className="text-gray-500">
            📚 근거 {selCount}조각{deckId && deckSources.length > 0 ? ` · 문서: ${deckSources.map((s) => s.title).join(', ')}` : deckId ? ' · 카드 기반' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto mb-3">
        {turns.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">
            등록된 학습자료(카드·PDF)를 근거로 답해드려요.<br />질문을 입력해보세요. 예) "수의계약이 가능한 경우는?"
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">{t.q}</div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[92%]">
                {t.loading ? (
                  <span className="text-gray-400">답변 생성 중…</span>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-gray-900 leading-relaxed">{t.a}</p>
                    {t.sources.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-indigo-600 cursor-pointer">근거 {t.sources.length}개 보기</summary>
                        <div className="mt-1 space-y-1">
                          {t.sources.map((s, j) => (
                            <p key={j} className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1">{s.content}…</p>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder="질문 입력…"
          disabled={busy}
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={send} disabled={busy || !input.trim()} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium">
          <Send size={18} />
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">※ 등록된 학습자료에 근거해 답합니다(무료 AI). 자료에 없으면 "자료에 없음"으로 답할 수 있어요.</p>
    </div>
  )
}
