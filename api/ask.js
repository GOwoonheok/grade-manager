// /api/ask — RAG 상담. 질문 → 임베딩 → top-k 근거(카드+PDF) → Gemini 답변(무료).
//   POST { deckId?, question } → { answer, sources:[{content,topic_id}], model, grounded }
// 로그인 사용자(승인 학습자/교수)면 사용. RLS가 자료 접근범위 통제.
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { verifyUser } from './_supa.js'
import { ensureGeminiKey, embedOne } from './_ai.js'

const GEMINI_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
]

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const auth = await verifyUser(req)
  if (!auth.ok) return res.status(auth.status).json({ error: 'unauthorized', reason: auth.reason })
  if (!ensureGeminiKey()) return res.status(500).json({ error: 'GEMINI_API_KEY 미설정' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'invalid json' }) } }
  const deckId = String(body?.deckId || '')
  const question = String(body?.question || '').trim().slice(0, 500)
  if (!question) return res.status(400).json({ error: 'question required' })

  // 질문 임베딩 → top-k 근거
  let rows = []
  try {
    const qEmb = await embedOne(question)
    const r = deckId
      ? await auth.sb.rpc('match_chunks', { query_embedding: qEmb, p_deck_id: deckId, match_count: 20 })
      : await auth.sb.rpc('match_chunks_any', { query_embedding: qEmb, match_count: 20 })
    if (r.error) return res.status(500).json({ error: '검색 실패', detail: r.error.message })
    rows = r.data || []
  } catch (e) {
    return res.status(502).json({ error: '임베딩/검색 실패', detail: String(e?.message || e) })
  }

  if (rows.length === 0) {
    return res.status(200).json({
      answer: '아직 학습된 자료가 없어 답하기 어렵습니다. 관리자가 카드/PDF를 등록·임베딩하면 답할 수 있어요.',
      sources: [], grounded: false,
    })
  }

  const context = rows.map((c, i) => `[${i + 1}] ${c.content}`).join('\n')
  const system = `당신은 "공공조달관리사" 학습 도우미입니다. 아래 [근거]만 사용해 한국어로 정확하고 친절하게 답하세요.
규칙:
1. 근거에 있는 내용으로만 답한다. 근거에 없으면 "제공된 자료에는 없습니다"라고 솔직히 말한다(추측 금지).
2. 핵심을 간결하게, 필요하면 번호·불릿으로 정리.
3. 답변 마지막 줄에 사용한 근거 번호를 "(근거: 1,3)" 형식으로 표기.`
  const prompt = `[근거]\n${context}\n\n[질문]\n${question}`

  let lastErr = null
  for (const name of GEMINI_CANDIDATES) {
    try {
      const { text } = await generateText({ model: google(name), system, prompt, temperature: 0.3 })
      return res.status(200).json({
        answer: text,
        sources: rows.slice(0, 5).map((r) => ({ content: r.content.slice(0, 180), topic_id: r.topic_id })),
        model: name,
        grounded: true,
      })
    } catch (e) { lastErr = e; continue }
  }
  return res.status(502).json({ error: 'AI 응답 실패', detail: String(lastErr?.message || lastErr) })
}
