// /api/_ai.js — 공통 AI 헬퍼. 임베딩(무료, 768차원 통일) + 키 매핑.
import { google } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

// GEMINI_API_KEY → @ai-sdk/google 가 읽는 GOOGLE_GENERATIVE_AI_API_KEY 로 매핑
export function ensureGeminiKey() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
  }
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

// 가용 임베딩 모델 폴백 (모두 768차원 = doc_chunks vector(768)). 무료.
// gemini-embedding-001 은 outputDimensionality 로 768 지정, 나머지는 기본 768.
const EMBED_CANDIDATES = [
  { id: 'gemini-embedding-001', dim: 768 },
  { id: 'text-embedding-004', dim: null },
  { id: 'embedding-001', dim: null },
]
function buildOpts(c, extra) {
  const o = { model: google.textEmbeddingModel(c.id), ...extra }
  if (c.dim) o.providerOptions = { google: { outputDimensionality: c.dim } }
  return o
}

export async function embedOne(text) {
  const value = String(text || '').slice(0, 8000)
  let lastErr = null
  for (const c of EMBED_CANDIDATES) {
    try {
      const { embedding } = await embed(buildOpts(c, { value }))
      return embedding
    } catch (e) { lastErr = e; continue }
  }
  throw lastErr || new Error('임베딩 모델 없음')
}

export async function embedBatch(texts) {
  const values = texts.map((t) => String(t || '').slice(0, 8000))
  const BATCH = 100 // Gemini 임베딩 1회 최대 100개
  let lastErr = null
  for (const c of EMBED_CANDIDATES) {
    try {
      const all = []
      for (let i = 0; i < values.length; i += BATCH) {
        const { embeddings } = await embedMany(buildOpts(c, { values: values.slice(i, i + BATCH) }))
        all.push(...embeddings)
      }
      return all
    } catch (e) { lastErr = e; continue }
  }
  throw lastErr || new Error('임베딩 모델 없음')
}
