// /api/embed-cards — 분야(deck)의 카드를 임베딩해 doc_chunks 에 저장 (교수 전용, 무료).
//   POST { deckId } → { ok, count }
import { verifyProfessor } from './_supa.js'
import { ensureGeminiKey, embedBatch } from './_ai.js'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

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
  const { data: topics } = await sb.from('topics').select('id').eq('deck_id', deckId)
  const topicIds = (topics || []).map((t) => t.id)
  if (topicIds.length === 0) return res.status(200).json({ ok: true, count: 0, note: '토픽 없음' })

  const { data: cards, error: ce } = await sb
    .from('cards')
    .select('id,topic_id,term,definition,content,keywords')
    .in('topic_id', topicIds)
  if (ce) return res.status(500).json({ error: 'cards read failed', detail: ce.message })

  const rows = (cards || []).filter((c) => c.term || c.definition || c.content || c.keywords)
  if (rows.length === 0) return res.status(200).json({ ok: true, count: 0, note: '카드 없음' })

  const texts = rows.map((c) => [c.term, c.definition, c.content, c.keywords].filter(Boolean).join('\n'))
  let embeddings
  try { embeddings = await embedBatch(texts) } catch (e) {
    return res.status(502).json({ error: '임베딩 실패', detail: String(e?.message || e) })
  }

  // 이 덱의 기존 카드 청크 교체
  await sb.from('doc_chunks').delete().eq('deck_id', deckId).eq('source', 'card')
  const payload = rows.map((c, i) => ({
    deck_id: deckId, topic_id: c.topic_id, card_id: c.id, source: 'card',
    content: texts[i], embedding: embeddings[i],
  }))
  for (let i = 0; i < payload.length; i += 100) {
    const { error } = await sb.from('doc_chunks').insert(payload.slice(i, i + 100))
    if (error) return res.status(500).json({ error: 'doc_chunks insert failed', detail: error.message })
  }
  return res.status(200).json({ ok: true, count: payload.length })
}
