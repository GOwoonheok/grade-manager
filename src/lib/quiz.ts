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
