import { supabase } from './supabase'

// CBT 예상문제 (C1). 4지선다 중심. 무지출(Supabase 텍스트).
export type QuizStatus = 'draft' | 'verified' | 'rejected'
export type QuizQuestion = {
  id: string
  topic_id: string
  type: 'mcq' | 'ox' | 'short'
  stem: string
  choices: string[]
  answer: number
  explanation: string
  difficulty: 'easy' | 'normal' | 'hard'
  source: 'manual' | 'ai'
  status: QuizStatus
  sort_order: number
  created_at: string
}

export type QuestionInput = {
  stem: string
  choices: string[]
  answer: number
  explanation: string
  difficulty: QuizQuestion['difficulty']
}

// 토픽의 문제 목록. RLS가 범위 통제(학생=verified만, 교수=전체).
export async function listQuestions(topicId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('topic_id', topicId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as QuizQuestion[]) ?? []
}

export async function createQuestion(topicId: string, q: QuestionInput): Promise<void> {
  const { error } = await supabase.from('quiz_questions').insert({
    topic_id: topicId,
    type: 'mcq',
    stem: q.stem.trim(),
    choices: q.choices,
    answer: q.answer,
    explanation: q.explanation.trim(),
    difficulty: q.difficulty,
    source: 'manual',
    status: 'verified', // 교수 직접 등록 = 검증본
  })
  if (error) throw error
}

export async function updateQuestion(id: string, q: QuestionInput): Promise<void> {
  const { error } = await supabase
    .from('quiz_questions')
    .update({
      stem: q.stem.trim(),
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation.trim(),
      difficulty: q.difficulty,
    })
    .eq('id', id)
  if (error) throw error
}

export async function setQuestionStatus(id: string, status: QuizStatus): Promise<void> {
  const { error } = await supabase.from('quiz_questions').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
  if (error) throw error
}

// 학생 CBT 세트: verified만 → 섞어서 count개 (count<=0 이면 전체)
export async function getQuizSet(topicId: string, count: number): Promise<QuizQuestion[]> {
  const all = (await listQuestions(topicId)).filter((q) => q.status === 'verified')
  const a = [...all]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return count > 0 ? a.slice(0, count) : a
}

export type AttemptDetail = { question_id: string; chosen: number; correct: number }
export async function saveAttempt(
  topicId: string,
  total: number,
  score: number,
  detail: AttemptDetail[],
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('quiz_attempts')
    .insert({ student_id: user.id, topic_id: topicId, total, score, detail })
  if (error) throw error
}

// C2/V1: AI 문제 생성 (교수 전용 /api/quiz-gen). 분야 임베딩 있으면 top-k 근거로(환각↓), 없으면 카드 폴백.
export async function generateQuestions(p: {
  deckId: string
  topicId: string
  topicName: string
  cards: { term: string; definition: string; content: string; keywords: string }[]
  count: number
}): Promise<QuestionInput[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  const res = await fetch('/api/quiz-gen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(p),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = j?.error || 'AI 생성 실패'
    throw new Error(msg + (j?.reason ? ` (${j.reason})` : '') + (j?.hint ? ` — ${j.hint}` : ''))
  }
  return (j.items as QuestionInput[]) ?? []
}

// V1: 분야(deck) 카드 임베딩 생성/갱신 (검색·근거 생성용)
export async function embedDeck(deckId: string): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  const res = await fetch('/api/embed-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deckId }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((j?.error || '임베딩 실패') + (j?.detail ? `: ${j.detail}` : ''))
  return (j.count as number) ?? 0
}

export async function createAiQuestions(topicId: string, items: QuestionInput[]): Promise<number> {
  if (items.length === 0) return 0
  const payload = items.map((q) => ({
    topic_id: topicId,
    type: 'mcq',
    stem: q.stem,
    choices: q.choices,
    answer: q.answer,
    explanation: q.explanation || '',
    difficulty: q.difficulty || 'normal',
    source: 'ai',
    status: 'draft', // 생성본은 검토대기 → 교수 검증 후 학생 노출
  }))
  const { error } = await supabase.from('quiz_questions').insert(payload)
  if (error) throw error
  return items.length
}
