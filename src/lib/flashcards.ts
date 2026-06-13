import { supabase } from './supabase'

export type Deck = { id: string; name: string; sort_order: number; created_at: string }
export type Topic = { id: string; deck_id: string; name: string; sort_order: number; created_at: string }
export type Card = {
  id: string
  topic_id: string
  term: string
  definition: string
  content: string
  keywords: string
  front: string
  back: string
  front_image: string | null
  back_image: string | null
  sort_order: number
  created_at: string
}
export type StudyStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type StudyMember = {
  id: string
  student_id: string
  status: StudyStatus
  requested_at: string
  student: { student_number: string; name: string } | null
}

const BUCKET = 'flashcard-images'

// 학습 외부 링크 — NotebookLM(공공조달관리사 노트북). 질의응답은 NotebookLM에서 수행.
export const NOTEBOOKLM_URL =
  'https://notebooklm.google.com/notebook/625f3da7-5752-49fa-96fd-7b85553fa641'

// ---------- 학생 접근(승인) ----------
export async function getMyStudyStatus(): Promise<StudyStatus> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'none'
  const { data } = await supabase
    .from('study_members')
    .select('status')
    .eq('student_id', user.id)
    .maybeSingle()
  return ((data as { status: StudyStatus } | null)?.status) ?? 'none'
}

export async function requestStudy(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')
  const { error } = await supabase
    .from('study_members')
    .insert({ student_id: user.id, status: 'pending' })
  if (error) throw error
}

// ---------- decks / cards (읽기) ----------
export async function listDecks(): Promise<Deck[]> {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data as Deck[]) ?? []
}

export async function listTopics(deckId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('deck_id', deckId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data as Topic[]) ?? []
}

export async function listCards(topicId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('topic_id', topicId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Card[]) ?? []
}

export function imageUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// 카드 조회/검색 (B-1) — 키워드로 term/definition/content/keywords 검색. RLS가 접근범위 통제.
export type CardHit = Card & {
  topic: { name: string; deck: { name: string } | null } | null
}
export async function searchCards(query: string): Promise<CardHit[]> {
  const s = query.trim().replace(/[,.()%*]/g, ' ').trim()
  if (s.length < 1) return []
  const like = `%${s}%`
  const { data, error } = await supabase
    .from('cards')
    .select('*, topic:topics(name, deck:decks(name))')
    .or(`term.ilike.${like},definition.ilike.${like},content.ilike.${like},keywords.ilike.${like}`)
    .limit(50)
  if (error) throw error
  return (data as CardHit[]) ?? []
}

// ---------- 진도 ----------
export async function setCardMark(cardId: string, status: 'known' | 'unknown'): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('card_marks')
    .upsert({ student_id: user.id, card_id: cardId, status, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function getMarks(cardIds: string[]): Promise<Record<string, 'known' | 'unknown'>> {
  if (cardIds.length === 0) return {}
  const { data } = await supabase.from('card_marks').select('card_id,status').in('card_id', cardIds)
  const m: Record<string, 'known' | 'unknown'> = {}
  for (const r of (data as { card_id: string; status: 'known' | 'unknown' }[]) ?? []) m[r.card_id] = r.status
  return m
}

// ---------- admin ----------
export async function createDeck(name: string): Promise<Deck> {
  const { data, error } = await supabase.from('decks').insert({ name }).select('*').single()
  if (error) throw error
  return data as Deck
}
export async function deleteDeck(id: string): Promise<void> {
  const { error } = await supabase.from('decks').delete().eq('id', id)
  if (error) throw error
}
export async function createTopic(deckId: string, name: string): Promise<Topic> {
  const { data, error } = await supabase.from('topics').insert({ deck_id: deckId, name }).select('*').single()
  if (error) throw error
  return data as Topic
}
export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase.from('topics').delete().eq('id', id)
  if (error) throw error
}
export async function uploadCardImage(file: Blob): Promise<string> {
  const path = `cards/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}
export async function createCard(
  topicId: string,
  c: { term: string; definition: string; content: string; keywords: string; image: string | null },
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      topic_id: topicId,
      term: c.term,
      definition: c.definition,
      content: c.content,
      keywords: c.keywords,
      front_image: c.image,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Card
}

// 카드 수정 (image 키를 넘기면 front_image 교체, 생략하면 이미지 유지)
export async function updateCard(
  cardId: string,
  c: { term: string; definition: string; content: string; keywords: string; image?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {
    term: c.term,
    definition: c.definition,
    content: c.content,
    keywords: c.keywords,
  }
  if (c.image !== undefined) patch.front_image = c.image
  const { error } = await supabase.from('cards').update(patch).eq('id', cardId)
  if (error) throw error
}

// 엑셀 일괄: 토픽명/정의/내용/기타 행을 카드로 일괄 생성 (keywords 컬럼이 "기타" 보관)
export async function bulkCreateCards(
  topicId: string,
  rows: { term: string; definition: string; content: string; keywords: string }[],
): Promise<number> {
  if (rows.length === 0) return 0
  const payload = rows.map((r) => ({
    topic_id: topicId,
    term: r.term,
    definition: r.definition,
    content: r.content,
    keywords: r.keywords,
  }))
  const { error } = await supabase.from('cards').insert(payload)
  if (error) throw error
  return rows.length
}
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}
// 카드 순서 변경: 주어진 순서대로 sort_order를 0..n으로 재기록
export async function reorderCards(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => supabase.from('cards').update({ sort_order: i }).eq('id', id)),
  )
}
export async function listMembers(): Promise<StudyMember[]> {
  const { data, error } = await supabase
    .from('study_members')
    .select('*, student:students(student_number,name)')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data as StudyMember[]) ?? []
}
export async function setMemberStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabase
    .from('study_members')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---------- 같이 공부하기 (Q&A) ----------
export type QnaPost = {
  id: string
  author_id: string
  parent_id: string | null
  body: string
  created_at: string
  author: { name: string; student_number: string } | null
}
export async function listQuestions(): Promise<QnaPost[]> {
  const { data, error } = await supabase
    .from('study_qna')
    .select('*, author:students(name,student_number)')
    .is('parent_id', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as QnaPost[]) ?? []
}
export async function listAnswers(questionId: string): Promise<QnaPost[]> {
  const { data, error } = await supabase
    .from('study_qna')
    .select('*, author:students(name,student_number)')
    .eq('parent_id', questionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as QnaPost[]) ?? []
}
export async function postQna(body: string, parentId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다')
  const { error } = await supabase.from('study_qna').insert({ author_id: user.id, parent_id: parentId, body })
  if (error) throw error
}
export async function deleteQna(id: string): Promise<void> {
  const { error } = await supabase.from('study_qna').delete().eq('id', id)
  if (error) throw error
}
