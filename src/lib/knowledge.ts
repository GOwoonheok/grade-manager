import { supabase } from './supabase'

// V2: PDF 근거자료 업로드/관리. 추출·청킹·임베딩은 서버(/api/ingest, unpdf)에서.
export async function ingestPdf(deckId: string, file: File): Promise<{ count: number; chars: number }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  const url = `/api/ingest?deckId=${encodeURIComponent(deckId)}&title=${encodeURIComponent(file.name)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', Authorization: `Bearer ${token}` },
    body: file,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((j?.error || '업로드 실패') + (j?.detail ? `: ${j.detail}` : ''))
  return { count: j.count ?? 0, chars: j.chars ?? 0 }
}

export type DocSource = { title: string; chunks: number }
export async function listSources(deckId: string): Promise<DocSource[]> {
  const { data, error } = await supabase
    .from('doc_chunks')
    .select('source_title')
    .eq('deck_id', deckId)
    .eq('source', 'pdf')
  if (error) throw error
  const m: Record<string, number> = {}
  for (const r of (data as { source_title: string }[]) ?? []) {
    const t = r.source_title || '(제목없음)'
    m[t] = (m[t] || 0) + 1
  }
  return Object.entries(m).map(([title, chunks]) => ({ title, chunks }))
}

export async function deleteSource(deckId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('doc_chunks')
    .delete()
    .eq('deck_id', deckId)
    .eq('source', 'pdf')
    .eq('source_title', title)
  if (error) throw error
}
