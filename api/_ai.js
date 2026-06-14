// /api/_ai.js — 공통 AI 헬퍼. 임베딩(무료 text-embedding-004, 768차원) + 키 매핑.
import { google } from '@ai-sdk/google'
import { embed, embedMany } from 'ai'

const EMBED_MODEL = 'text-embedding-004' // 무료 · 768차원

// GEMINI_API_KEY → @ai-sdk/google 가 읽는 GOOGLE_GENERATIVE_AI_API_KEY 로 매핑
export function ensureGeminiKey() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
  }
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

export async function embedOne(text) {
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBED_MODEL),
    value: String(text || '').slice(0, 8000),
  })
  return embedding
}

export async function embedBatch(texts) {
  const values = texts.map((t) => String(t || '').slice(0, 8000))
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBED_MODEL),
    values,
  })
  return embeddings
}
