// /api/ingest — PDF 업로드(raw) → 텍스트 추출(unpdf) → 청킹 → 임베딩 → doc_chunks (교수 전용, 무료).
//   POST /api/ingest?deckId=..&title=..   body: PDF 원본 바이트 (application/pdf)
//   응답 { ok, count, chars }
import { verifyProfessor } from './_supa.js'
import { ensureGeminiKey, embedBatch } from './_ai.js'
import { extractText, getDocumentProxy } from 'unpdf'

export const config = { api: { bodyParser: false } } // raw 바이트 직접 수신

function chunkText(text, size = 800, overlap = 100) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  const out = []
  if (!clean) return out
  for (let i = 0; i < clean.length; i += (size - overlap)) {
    out.push(clean.slice(i, i + size))
    if (i + size >= clean.length) break
  }
  return out
}
async function readRaw(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const auth = await verifyProfessor(req)
  if (!auth.ok) return res.status(auth.status).json({ error: 'unauthorized', reason: auth.reason })
  if (!ensureGeminiKey()) return res.status(500).json({ error: 'GEMINI_API_KEY 미설정' })

  const deckId = String(req.query?.deckId || '')
  const title = String(req.query?.title || '문서').slice(0, 200)
  if (!deckId) return res.status(400).json({ error: 'deckId required' })

  let buf
  try { buf = await readRaw(req) } catch { return res.status(400).json({ error: 'read failed' }) }
  if (!buf || buf.length === 0) return res.status(400).json({ error: 'empty file' })

  let text = ''
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    const r = await extractText(pdf, { mergePages: true })
    text = Array.isArray(r.text) ? r.text.join('\n') : r.text
  } catch (e) {
    return res.status(422).json({ error: 'PDF 텍스트 추출 실패', detail: String(e?.message || e) })
  }

  const chunks = chunkText(text).slice(0, 300)
  if (chunks.length === 0) {
    return res.status(422).json({ error: '추출된 텍스트가 없습니다 (스캔본/이미지 PDF일 수 있음)' })
  }

  let embeddings
  try { embeddings = await embedBatch(chunks) } catch (e) {
    return res.status(502).json({ error: '임베딩 실패', detail: String(e?.message || e) })
  }

  const payload = chunks.map((content, i) => ({
    deck_id: deckId, source: 'pdf', source_title: title, content, embedding: embeddings[i],
  }))
  for (let i = 0; i < payload.length; i += 100) {
    const { error } = await auth.sb.from('doc_chunks').insert(payload.slice(i, i + 100))
    if (error) return res.status(500).json({ error: 'doc_chunks insert failed', detail: error.message })
  }
  return res.status(200).json({ ok: true, count: payload.length, chars: text.length })
}
