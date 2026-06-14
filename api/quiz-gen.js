// /api/quiz-gen — 토픽 학습카드(컨텍스트)로 4지선다 AI 생성 (교수 전용, Gemini 무료 기본).
//   POST { topicName, cards:[{term,definition,content,keywords}], count }
//   응답 { items:[{stem,choices[4],answer,explanation,difficulty}], model, count }
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { verifyProfessor } from './_supa.js'

// Gemini 모델 폴백 체인 (가용성 변동 대응)
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

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'invalid json' }) }
  }
  const topicName = String(body?.topicName || '').slice(0, 200)
  const count = Math.min(Math.max(parseInt(body?.count, 10) || 5, 1), 20)
  const cards = Array.isArray(body?.cards) ? body.cards.slice(0, 60) : []
  if (cards.length === 0) {
    return res.status(400).json({ error: 'no-cards', hint: '이 토픽에 카드를 먼저 등록하세요 (카드 기반 생성).' })
  }

  // GEMINI_API_KEY → @ai-sdk/google 가 읽는 GOOGLE_GENERATIVE_AI_API_KEY 로 매핑
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 미설정' })
  }

  const context = cards
    .map((c, i) => `${i + 1}. ${c.term}\n   정의: ${c.definition || ''}\n   내용: ${c.content || ''}\n   키워드: ${c.keywords || ''}`)
    .join('\n')
  const system = `당신은 대한민국 공공조달관리사 자격 학습용 4지선다 문제 출제 전문가입니다.
아래 학습카드 내용만 근거로 시험형 4지선다 문제를 ${count}개 만드세요.
규칙:
1. 각 문제 = 지문 + 보기 4개 + 정답 인덱스(0~3) + 해설 + 난이도(easy/normal/hard).
2. 보기는 그럴듯한 오답을 포함하되 정답은 정확히 1개.
3. 카드에 없는 사실을 지어내지 말 것.
4. 한국어, 군더더기 없이.`
  const prompt = `토픽: ${topicName}\n\n[학습카드]\n${context}`

  let lastErr = null
  for (const name of GEMINI_CANDIDATES) {
    try {
      const { object } = await generateObject({
        model: google(name),
        schema: Schema,
        system,
        prompt,
        temperature: 0.4,
      })
      const items = (object?.questions || [])
        .filter((q) => q && Array.isArray(q.choices) && q.choices.length === 4 && q.answer >= 0 && q.answer <= 3)
        .slice(0, count)
      return res.status(200).json({ items, model: name, count: items.length })
    } catch (e) {
      lastErr = e
      continue
    }
  }
  return res.status(502).json({ error: 'AI 생성 실패', detail: String(lastErr?.message || lastErr) })
}
