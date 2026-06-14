// /api/quiz-gen — 4지선다 AI 생성 (교수 전용, Gemini 무료).
// RAG: 분야(deck) 임베딩이 있으면 top-k 근거조각을 검색해 그 내용만으로 생성(환각↓).
//      임베딩이 없으면 클라이언트가 보낸 카드로 폴백.
//   POST { deckId, topicId, topicName, cards[], count }
//   응답 { items[], model, grounded, used }
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { verifyProfessor } from './_supa.js'
import { ensureGeminiKey, embedOne } from './_ai.js'

const GEMINI_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
]

const Schema = z.object({
  questions: z.array(
    z.object({
      stem: z.string().describe('문제 지문'),
      choices: z.array(z.string()).length(4).describe('4지선다 보기 4개'),
      answer: z.number().int().min(0).max(3).describe('정답 보기 인덱스(0~3)'),
      explanation: z.string().describe('정답 해설'),
      difficulty: z.enum(['easy', 'normal', 'hard']),
    }),
  ),
})

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } }

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
  const topicName = String(body?.topicName || '').slice(0, 200)
  const deckId = String(body?.deckId || '')
  const count = Math.min(Math.max(parseInt(body?.count, 10) || 5, 1), 20)
  const clientCards = Array.isArray(body?.cards) ? body.cards.slice(0, 80) : []

  // 1) 근거 조각: 임베딩 검색(top-k) 우선 → 없으면 클라이언트 카드 폴백
  let contextItems = []
  let grounded = false
  if (deckId) {
    try {
      const qEmb = await embedOne(`${topicName} 핵심 개념 시험 예상문제`)
      const { data: chunks } = await auth.sb.rpc('match_chunks', {
        query_embedding: qEmb,
        p_deck_id: deckId,
        match_count: 40,
      })
      if (Array.isArray(chunks) && chunks.length) {
        contextItems = chunks.map((c) => c.content)
        grounded = true
      }
    } catch {
      /* 검색 실패 시 폴백 */
    }
  }
  if (contextItems.length === 0) {
    contextItems = clientCards
      .map((c) => [c.term, c.definition, c.content, c.keywords].filter(Boolean).join('\n'))
      .filter(Boolean)
  }
  if (contextItems.length === 0) {
    return res.status(400).json({ error: 'no-context', hint: '이 토픽/분야에 카드를 등록하거나 "임베딩 생성"을 먼저 하세요.' })
  }

  const context = contextItems.slice(0, 60).map((t, i) => `${i + 1}. ${t}`).join('\n')
  const system = `당신은 대한민국 공공조달관리사 자격 학습용 4지선다 문제 출제 전문가입니다.
아래 [근거자료] 내용만 사용해 시험형 4지선다 문제를 ${count}개 만드세요.
규칙:
1. 각 문제 = 지문 + 보기 4개 + 정답 인덱스(0~3) + 해설 + 난이도(easy/normal/hard).
2. 보기는 그럴듯한 오답을 포함하되 정답은 정확히 1개.
3. **근거자료에 없는 사실은 절대 지어내지 말 것.** (근거 기반)
4. 한국어, 군더더기 없이.`
  const prompt = `토픽: ${topicName}\n\n[근거자료]\n${context}`

  let lastErr = null
  for (const name of GEMINI_CANDIDATES) {
    try {
      const { object } = await generateObject({ model: google(name), schema: Schema, system, prompt, temperature: 0.4 })
      const items = (object?.questions || [])
        .filter((q) => q && Array.isArray(q.choices) && q.choices.length === 4 && q.answer >= 0 && q.answer <= 3)
        .slice(0, count)
      return res.status(200).json({ items, model: name, grounded, used: contextItems.length })
    } catch (e) {
      lastErr = e
      continue
    }
  }
  return res.status(502).json({ error: 'AI 생성 실패', detail: String(lastErr?.message || lastErr) })
}
