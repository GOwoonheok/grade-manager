// /api/ingest — Storage의 PDF(≤50MB) → 텍스트 추출(unpdf) → 청킹 → 임베딩 → doc_chunks.
//   POST { deckId, title, path }  (path = knowledge-docs 버킷 내 경로, 브라우저가 먼저 업로드)
//   처리 후 원본 PDF 삭제(텍스트만 보관). 교수 전용·무료.
import { verifyProfessor } from './_supa.js'
import { ensureGeminiKey, embedBatch } from './_ai.js'
import { extractText, getDocumentProxy } from 'unpdf'

const BUCKET = 'knowledge-docs'

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
  const title = String(body?.title || '문서').slice(0, 200)
  const path = String(body?.path || '')
  if (!deckId || !path) return res.status(400).json({ error: 'deckId/path required' })
  if (!path.startsWith(deckId + '/')) return res.status(400).json({ error: 'invalid path' })

  // Storage에서 PDF 다운로드 (교수 RLS)
  const { data: blob, error: dErr } = await auth.sb.storage.from(BUCKET).download(path)
  if (dErr || !blob) return res.status(404).json({ error: '파일을 찾을 수 없음', detail: dErr?.message })
  const buf = Buffer.from(await blob.arrayBuffer())

  let text = ''
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    const r = await extractText(pdf, { mergePages: true })
    text = Array.isArray(r.text) ? r.text.join('\n') : r.text
  } catch (e) {
    await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
    return res.status(422).json({ error: 'PDF 텍스트 추출 실패', detail: String(e?.message || e) })
  }

  const chunks = chunkText(text).slice(0, 400)
  if (chunks.length === 0) {
    await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
    return res.status(422).json({ error: '추출된 텍스트가 없습니다 (스캔본/이미지 PDF일 수 있음)' })
  }

  let embeddings
  try { embeddings = await embedBatch(chunks) } catch (e) {
    await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
    return res.status(502).json({ error: '임베딩 실패', detail: String(e?.message || e) })
  }

  const payload = chunks.map((content, i) => ({
    deck_id: deckId, source: 'pdf', source_title: title, content, embedding: embeddings[i],
  }))
  for (let i = 0; i < payload.length; i += 100) {
    const { error } = await auth.sb.from('doc_chunks').insert(payload.slice(i, i + 100))
    if (error) {
      await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
      return res.status(500).json({ error: 'doc_chunks insert failed', detail: error.message })
    }
  }

  // 원본 PDF 삭제 (텍스트만 보관 → 용량 절약)
  await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
  return res.status(200).json({ ok: true, count: payload.length, chars: text.length })
}
