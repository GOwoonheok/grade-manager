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

// 엑셀 일괄: 토픽명/정의/주요내용/키워드 행을 카드로 일괄 생성
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
