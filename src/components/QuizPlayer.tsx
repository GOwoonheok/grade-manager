import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { listDecks, listTopics, type Deck, type Topic } from '../lib/flashcards'
import { getQuizSet, saveAttempt, type AttemptDetail, type QuizQuestion } from '../lib/quiz'

type Phase = 'setup' | 'quiz' | 'result'

// C1: 학생 CBT 풀이 (검증된 4지선다 → 채점 · 해설 리뷰)
export default function QuizPlayer() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicId, setTopicId] = useState('')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<Phase>('setup')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [score, setScore] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { listDecks().then(setDecks).catch(() => {}) }, [])
  useEffect(() => {
    setTopicId(''); setTopics([])
    if (deckId) listTopics(deckId).then(setTopics).catch(() => {})
  }, [deckId])

  const start = async () => {
    setErr(null); setBusy(true)
    try {
      const qs = await getQuizSet(topicId, count)
      if (qs.length === 0) { setErr('이 토픽에 검증된 문제가 없습니다.'); return }
      setQuestions(qs); setAnswers({}); setPhase('quiz')
    } catch (e: any) {
      setErr('문제 로드 실패 — 017 적용 확인: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    let s = 0
    const detail: AttemptDetail[] = questions.map((q) => {
      const chosen = answers[q.id] ?? -1
      if (chosen === q.answer) s++
      return { question_id: q.id, chosen, correct: q.answer }
    })
    setScore(s); setPhase('result')
    try { await saveAttempt(topicId, questions.length, s, detail) } catch { /* 기록 실패해도 결과는 표시 */ }
  }

  if (phase === 'setup') {
    return (
      <div className="space-y-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">문항 수</span>
          {[10, 20, 50, 0].map((n) => (
            <button key={n} onClick={() => setCount(n)} className={`px-3 py-1.5 rounded-lg border text-sm ${count === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}>{n === 0 ? '전체' : n}</button>
          ))}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={start} disabled={!topicId || busy} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium disabled:bg-indigo-300">{busy ? '준비 중...' : '시작'}</button>
      </div>
    )
  }

  if (phase === 'quiz') {
    const answered = Object.keys(answers).length
    return (
      <div className="space-y-3">
        <button onClick={() => setPhase('setup')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft size={16} />설정</button>
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-medium text-gray-900 mb-2"><span className="text-gray-400">{i + 1}.</span> {q.stem}</p>
            <div className="space-y-1.5">
              {q.choices.map((c, ci) => (
                <label key={ci} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${answers[q.id] === ci ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name={q.id} checked={answers[q.id] === ci} onChange={() => setAnswers((p) => ({ ...p, [q.id]: ci }))} />
                  <span>{ci + 1}) {c}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <button onClick={submit} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium">제출 ({answered}/{questions.length})</button>
      </div>
    )
  }

  // result
  return (
    <div className="space-y-3">
      <div className="bg-indigo-50 rounded-2xl p-5 text-center">
        <p className="text-sm text-indigo-700">점수</p>
        <p className="text-3xl font-bold text-indigo-700 tabular-nums">{score} / {questions.length}</p>
        <p className="text-sm text-gray-500 mt-1">{questions.length ? Math.round((score / questions.length) * 100) : 0}점</p>
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => {
          const chosen = answers[q.id] ?? -1
          const ok = chosen === q.answer
          return (
            <div key={q.id} className={`bg-white border rounded-xl p-3 ${ok ? 'border-emerald-200' : 'border-red-200'}`}>
              <p className="text-sm font-medium text-gray-900 mb-1"><span className={ok ? 'text-emerald-600' : 'text-red-600'}>{ok ? '○' : '✗'}</span> {i + 1}. {q.stem}</p>
              <p className="text-xs text-gray-600">내 답: {chosen >= 0 ? `${chosen + 1}) ${q.choices[chosen]}` : '무응답'}</p>
              {!ok && <p className="text-xs text-emerald-700">정답: {q.answer + 1}) {q.choices[q.answer]}</p>}
              {q.explanation && <p className="text-[11px] text-gray-500 mt-1">해설: {q.explanation}</p>}
            </div>
          )
        })}
      </div>
      <button onClick={() => setPhase('setup')} className="w-full py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50">다시 풀기</button>
    </div>
  )
}
