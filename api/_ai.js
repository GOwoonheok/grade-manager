// /api/_ai.js — 공통 AI 헬퍼. 임베딩(gemini-embedding-001, 768차원, 무료) + 키 매핑.
import { google } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

const MODEL = 'gemini-embedding-001' // 현재 GA 임베딩 모델 (text-embedding-004/embedding-001 은 이 키에서 404)
const DIM = 768                       // doc_chunks vector(768) 와 일치
const BATCH = 100                     // Gemini 임베딩 1회 최대 100개
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isTransient = (m) => /429|quota|rate|exhaust|unavailable|deadline|temporar|503|500|timeout/i.test(String(m || ''))

// GEMINI_API_KEY → @ai-sdk/google 가 읽는 GOOGLE_GENERATIVE_AI_API_KEY 로 매핑
export function ensureGeminiKey() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
  }
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

const opts = (extra) => ({
  model: google.textEmbeddingModel(MODEL),
  providerOptions: { google: { outputDimensionality: DIM } },
  ...extra,
})

// 일시 오류(레이트리밋 등)는 백오프 재시도, 그 외는 즉시 throw(진짜 원인 노출)
async function withRetry(fn) {
  let err
  for (let a = 0; a < 4; a++) {
    try { return await fn() } catch (e) {
      err = e
      if (isTransient(e?.message) && a < 3) { await sleep(1500 * (a + 1)); continue }
      throw e
    }
  }
  throw err
}

export async function embedOne(text) {
  const value = String(text || '').slice(0, 8000)
  const { embedding } = await withRetry(() => embed(opts({ value })))
  return embedding
}

export async function embedBatch(texts) {
  const values = texts.map((t) => String(t || '').slice(0, 8000))
  const all = []
  for (let i = 0; i < values.length; i += BATCH) {
    const res = await withRetry(() => embedMany(opts({ values: values.slice(i, i + BATCH) })))
    all.push(...res.embeddings)
    if (i + BATCH < values.length) await sleep(400) // 배치 간 간격(레이트리밋 완화)
  }
  return all
}
