import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { listCards, listDecks, listTopics, type Deck, type Topic } from '../lib/flashcards'
import {
  createAiQuestions,
  createQuestion,
  deleteQuestion,
  generateQuestions,
  listQuestions,
  setQuestionStatus,
  updateQuestion,
  type QuestionInput,
  type QuizQuestion,
} from '../lib/quiz'

const ST_CLS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
const ST_LABEL: Record<string, string> = { draft: '검토대기', verified: '검증', rejected: '거부' }

// C1: 교수 CBT 문제 관리 (4지선다 등록·검수)
export default function QuizAdmin() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicId, setTopicId] = useState('')
  const [list, setList] = useState<QuizQuestion[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<QuizQuestion | null>(null)
  const [adding, setAdding] = useState(false)
  const [aiCount, setAiCount] = useState(5)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)

  useEffect(() => { listDecks().then(setDecks).catch((e) => setErr(e.message)) }, [])
  useEffect(() => {
    setTopicId(''); setTopics([]); setList([])
    if (deckId) listTopics(deckId).then(setTopics).catch(() => {})
  }, [deckId])
  const load = () => {
    if (!topicId) { setList([]); return }
    listQuestions(topicId)
      .then(setList)
      .catch((e) => setErr('문제 로드 실패 — 017 마이그레이션 적용 확인: ' + (e?.message ?? e)))
  }
  useEffect(() => { setErr(null); setEditing(null); setAdding(false); load() }, [topicId])

  const onSaved = () => { setEditing(null); setAdding(false); load() }

  const onAiGen = async () => {
    setAiBusy(true); setAiMsg(null)
    try {
      const cards = await listCards(topicId)
      if (cards.length === 0) { setAiMsg('이 토픽에 카드가 없습니다 — 먼저 플래시카드를 등록하세요.'); return }
      const topicName = topics.find((t) => t.id === topicId)?.name ?? ''
      const items = await generateQuestions(
        topicName,
        cards.map((c) => ({ term: c.term, definition: c.definition, content: c.content, keywords: c.keywords })),
        aiCount,
      )
      const n = await createAiQuestions(topicId, items)
      setAiMsg(`AI가 ${n}개 생성(검토대기). 아래에서 "검증"하면 학생에게 노출됩니다.`)
      load()
    } catch (e: any) {
      setAiMsg('생성 실패: ' + (e?.message ?? e))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <option value="">분야 선택</option>
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!deckId} className="px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100">
          <option value="">토픽 선택</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {topicId && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-gray-600">문제 {list.length}개</p>
            {!adding && !editing && (
              <div className="flex items-center gap-2">
                <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white" title="AI 생성 개수">
                  {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}개</option>)}
                </select>
                <button onClick={onAiGen} disabled={aiBusy} className="inline-flex items-center gap-1 px-3 py-1.5 border border-emerald-600 text-emerald-700 rounded-lg text-sm font-medium disabled:opacity-50"><Sparkles size={16} />{aiBusy ? '생성 중...' : 'AI 생성'}</button>
                <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium"><Plus size={16} />문제 추가</button>
              </div>
            )}
          </div>
          {aiMsg && <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{aiMsg}</p>}

          {(adding || editing) && (
            <QuizForm topicId={topicId} initial={editing} onSaved={onSaved} onCancel={() => { setAdding(false); setEditing(null) }} />
          )}

          <div className="space-y-2">
            {list.length === 0 && <p className="text-sm text-gray-400">등록된 문제가 없습니다.</p>}
            {list.map((q, i) => (
              <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900"><span className="text-gray-400">{i + 1}.</span> {q.stem}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${ST_CLS[q.status]}`}>{ST_LABEL[q.status]}</span>
                </div>
                <ol className="mt-1.5 text-xs text-gray-600 space-y-0.5 pl-1">
                  {q.choices.map((c, ci) => (
                    <li key={ci} className={ci === q.answer ? 'text-emerald-700 font-semibold' : ''}>{ci + 1}) {c}{ci === q.answer ? ' ✓' : ''}</li>
                  ))}
                </ol>
                {q.explanation && <p className="mt-1 text-[11px] text-gray-500">해설: {q.explanation}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => { setEditing(q); setAdding(false) }} className="text-xs text-gray-500 hover:text-indigo-600 inline-flex items-center gap-0.5"><Pencil size={13} />수정</button>
                  {q.status !== 'verified' && <button onClick={async () => { await setQuestionStatus(q.id, 'verified'); load() }} className="text-xs text-emerald-700 inline-flex items-center gap-0.5"><Check size={13} />검증</button>}
                  {q.status !== 'rejected' && <button onClick={async () => { await setQuestionStatus(q.id, 'rejected'); load() }} className="text-xs text-amber-700 inline-flex items-center gap-0.5"><X size={13} />거부</button>}
                  <button onClick={async () => { if (window.confirm('삭제할까요?')) { await deleteQuestion(q.id); load() } }} className="text-xs text-red-600 inline-flex items-center gap-0.5 ml-auto"><Trash2 size={13} />삭제</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QuizForm({ topicId, initial, onSaved, onCancel }: { topicId: string; initial: QuizQuestion | null; onSaved: () => void; onCancel: () => void }) {
  const [stem, setStem] = useState(initial?.stem ?? '')
  const [choices, setChoices] = useState<string[]>(
    initial?.choices?.length ? [...initial.choices, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
  )
  const [answer, setAnswer] = useState(initial?.answer ?? 0)
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [difficulty, setDifficulty] = useState<QuizQuestion['difficulty']>(initial?.difficulty ?? 'normal')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const setChoice = (i: number, v: string) => setChoices((p) => p.map((c, ci) => (ci === i ? v : c)))

  const submit = async () => {
    const cs = choices.map((c) => c.trim())
    if (!stem.trim()) { setMsg('문제를 입력하세요.'); return }
    if (cs.filter(Boolean).length < 2) { setMsg('보기를 2개 이상 입력하세요.'); return }
    if (!cs[answer]) { setMsg('정답으로 표시한 보기가 비어있습니다.'); return }
    setBusy(true); setMsg(null)
    const payload: QuestionInput = { stem, choices: cs, answer, explanation, difficulty }
    try {
      if (initial) await updateQuestion(initial.id, payload)
      else await createQuestion(topicId, payload)
      onSaved()
    } catch (e: any) {
      setMsg('저장 실패: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-600">{initial ? '문제 수정' : '문제 추가'} (4지선다 · ◉=정답)</p>
      <textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={2} placeholder="문제 지문" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      {choices.map((c, i) => (
        <label key={i} className="flex items-center gap-2">
          <input type="radio" name="quiz-answer" checked={answer === i} onChange={() => setAnswer(i)} title="정답으로 지정" />
          <input value={c} onChange={(e) => setChoice(i, e.target.value)} placeholder={`보기 ${i + 1}`} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </label>
      ))}
      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="해설(선택)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <div className="flex items-center gap-2">
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuizQuestion['difficulty'])} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="easy">쉬움</option>
          <option value="normal">보통</option>
          <option value="hard">어려움</option>
        </select>
        {msg && <span className="text-xs text-red-600">{msg}</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">취소</button>
          <button onClick={submit} disabled={busy} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:bg-indigo-300">{busy ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}
