// /api/embed-pending — 대기(embedding NULL) 청크를 분당 ~90개씩 임베딩 (무료 한도 대응).
// 클라이언트가 60초 간격으로 반복 호출 → 큰 문서도 자동 전체 색인. 교수 전용.
//   POST { deckId } → { embedded, remaining, done }
import { verifyProfessor } from './_supa.js'
import { ensureGeminiKey, embedBatch } from './_ai.js'

const LIMIT = 90 // 무료 임베딩 분당 100 미만

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const auth = await verifyProfessor(req)
  if (!auth.ok) return res.status(auth.status).json({ error: 'unauthorized', reason: auth.reason })
  if (!ensureGeminiKey()) return res.status(500).json({ error: 'GEMINI_API_KEY 미설정' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'invalid json' }) } }
  const deckId = String(body?.deckId || '')
  if (!deckId) return res.status(400).json({ error: 'deckId required' })

  const sb = auth.sb
  const { data: rows, error } = await sb
    .from('doc_chunks')
    .select('id,content')
    .eq('deck_id', deckId)
    .is('embedding', null)
    .limit(LIMIT)
  if (error) return res.status(500).json({ error: 'read failed', detail: error.message })
  if (!rows || rows.length === 0) return res.status(200).json({ embedded: 0, remaining: 0, done: true })

  let embeddings
  try { embeddings = await embedBatch(rows.map((r) => r.content)) } catch (e) {
    return res.status(502).json({ error: '임베딩 실패', detail: String(e?.message || e) })
  }

  // 행별 embedding 업데이트 (동시성 30)
  for (let i = 0; i < rows.length; i += 30) {
    const grp = rows.slice(i, i + 30)
    const results = await Promise.all(
      grp.map((r, j) => sb.from('doc_chunks').update({ embedding: embeddings[i + j] }).eq('id', r.id)),
    )
    const failed = results.find((x) => x.error)
    if (failed) return res.status(500).json({ error: 'update failed', detail: failed.error.message })
  }

  const { count } = await sb
    .from('doc_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId)
    .is('embedding', null)
  const remaining = count ?? 0
  return res.status(200).json({ embedded: rows.length, remaining, done: remaining === 0 })
}
