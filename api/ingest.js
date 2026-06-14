// /api/ingest — Storage의 PDF → 텍스트 추출(unpdf) → 청킹 → doc_chunks에 '대기(embedding NULL)'로 저장.
// 임베딩은 /api/embed-pending 가 분당 ~90개씩 처리(무료 한도 대응). 교수 전용.
//   POST { deckId, title, path } → { ok, total, chars, truncated }
import { verifyProfessor } from './_supa.js'
import { extractText, getDocumentProxy } from 'unpdf'

const BUCKET = 'knowledge-docs'
const MAX_CHUNKS = 1500 // 한 문서 상한(DB·시간 보호)

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

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'invalid json' }) } }
  const deckId = String(body?.deckId || '')
  const title = String(body?.title || '문서').slice(0, 200)
  const path = String(body?.path || '')
  if (!deckId || !path) return res.status(400).json({ error: 'deckId/path required' })
  if (!path.startsWith(deckId + '/')) return res.status(400).json({ error: 'invalid path' })

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

  const allChunks = chunkText(text)
  const chunks = allChunks.slice(0, MAX_CHUNKS)
  if (chunks.length === 0) {
    await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
    return res.status(422).json({ error: '추출된 텍스트가 없습니다 (스캔본/이미지 PDF일 수 있음)' })
  }

  // 임베딩 없이 '대기'로 저장 (빠름·쿼터 0). 임베딩은 embed-pending이 분당 처리.
  const payload = chunks.map((content) => ({ deck_id: deckId, source: 'pdf', source_title: title, content, embedding: null }))
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await auth.sb.from('doc_chunks').insert(payload.slice(i, i + 200))
    if (error) {
      await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
      return res.status(500).json({ error: 'doc_chunks insert failed', detail: error.message })
    }
  }

  await auth.sb.storage.from(BUCKET).remove([path]).catch(() => {})
  return res.status(200).json({
    ok: true, total: chunks.length, chars: text.length, truncated: allChunks.length > chunks.length,
  })
}
