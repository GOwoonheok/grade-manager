import { supabase } from './supabase'

// 큰 PDF(>~45MB)를 브라우저에서 페이지 단위로 분할 (각 파트 ~42MB 목표). pdf-lib 동적 로드.
export async function splitPdfBySize(file: File, targetBytes = 42 * 1024 * 1024): Promise<File[]> {
  const { PDFDocument } = await import('pdf-lib')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  if (n <= 1) return [file]
  const avg = file.size / n
  let per = Math.max(1, Math.floor(targetBytes / Math.max(avg, 1)))
  per = Math.min(per, n, 120)
  if (per >= n) return [file]
  const base = file.name.replace(/\.pdf$/i, '')
  const parts: File[] = []
  let idx = 1
  for (let start = 0; start < n; start += per) {
    const doc = await PDFDocument.create()
    const end = Math.min(start + per, n)
    const pages = await doc.copyPages(src, Array.from({ length: end - start }, (_, k) => start + k))
    pages.forEach((p) => doc.addPage(p))
    const out = await doc.save()
    parts.push(new File([out], `${base}_part${idx}.pdf`, { type: 'application/pdf' }))
    idx++
  }
  return parts
}

// V2: PDF 근거자료 업로드/관리. 추출·청킹·임베딩은 서버(/api/ingest, unpdf)에서.
export async function ingestPdf(
  deckId: string,
  file: File,
): Promise<{ total: number; chars: number; truncated: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  // 1) Storage에 업로드 (≤50MB — Vercel 함수 4.5MB 한도 우회)
  const path = `${deckId}/${crypto.randomUUID()}.pdf`
  const { error: upErr } = await supabase.storage
    .from('knowledge-docs')
    .upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (upErr) throw new Error('업로드 실패: ' + upErr.message)
  // 2) 함수가 Storage에서 받아 추출·임베딩 후 원본 삭제
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deckId, title: file.name, path }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    await supabase.storage.from('knowledge-docs').remove([path]).catch(() => {})
    throw new Error((j?.error || '처리 실패') + (j?.detail ? `: ${j.detail}` : ''))
  }
  return { total: j.total ?? 0, chars: j.chars ?? 0, truncated: !!j.truncated }
}

// 대기(미임베딩) 청크 수
export async function countPending(deckId: string): Promise<number> {
  const { count } = await supabase
    .from('doc_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId)
    .is('embedding', null)
  return count ?? 0
}

// 분야별 임베딩 완료 청크 수 (AI 상담에서 '근거 보유 분야' 표시용)
export async function countEmbedded(deckId: string): Promise<number> {
  const { count } = await supabase
    .from('doc_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId)
    .not('embedding', 'is', null)
  return count ?? 0
}

// 대기 청크 ~90개 임베딩 (분당 호출). { embedded, remaining, done }
export async function embedPending(deckId: string): Promise<{ embedded: number; remaining: number; done: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  const res = await fetch('/api/embed-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deckId }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((j?.error || '임베딩 실패') + (j?.detail ? `: ${j.detail}` : ''))
  return { embedded: j.embedded ?? 0, remaining: j.remaining ?? 0, done: !!j.done }
}

export type DocSource = { title: string; chunks: number }
export async function listSources(deckId: string): Promise<DocSource[]> {
  // 서버 집계(전 행 fetch 방지). 022 미적용 시 클라 집계로 폴백.
  const rpc = await supabase.rpc('pdf_sources', { p_deck_id: deckId })
  if (!rpc.error) {
    return ((rpc.data as { source_title: string; chunks: number }[]) ?? []).map((r) => ({
      title: r.source_title,
      chunks: Number(r.chunks),
    }))
  }
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

// B-2: RAG 상담 — 질문 → 근거 기반 답변. deckId='' 면 전체 분야.
export type RagSource = { content: string; topic_id: string | null }
export async function askRag(
  deckId: string,
  question: string,
): Promise<{ answer: string; sources: RagSource[]; grounded: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('로그인이 필요합니다')
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deckId: deckId || undefined, question }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((j?.error || '응답 실패') + (j?.detail ? `: ${j.detail}` : ''))
  return { answer: j.answer ?? '', sources: j.sources ?? [], grounded: !!j.grounded }
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
