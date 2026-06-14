// /api/embed-run — 대기(embedding NULL) 청크를 서버 백그라운드에서 자동 색인.
// 클릭 1회로 시작 → waitUntil 로 한 배치(≤45) 임베딩 후 ~30초 페이싱하고 자기 자신을 재호출(self-chain).
// 브라우저를 닫아도 서버에서 전체 색인이 끝날 때까지 계속 진행된다. 교수 전용.
// 전역 잠금(023 embed_lease_*)으로 동시 체인 1개만 허용 → 무료 임베딩 분당 한도 보호.
//   POST {} → { running, started, remaining }
import { verifyProfessor, getBearer } from './_supa.js'
import { ensureGeminiKey, embedBatch } from './_ai.js'
import { waitUntil } from '@vercel/functions'

const BATCH = 45        // 1회 임베딩 개수 (무료 분당 100 미만 유지)
const PACE_MS = 30000   // 다음 배치까지 대기(≈90/분)
const LEASE_S = 90      // 잠금 점유 시간(체인 1회 수명보다 길게 → 중단 시 자동 만료)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const config = { maxDuration: 60 }

async function countPending(sb) {
  const { count } = await sb
    .from('doc_chunks')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)
  return count ?? 0
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

  const sb = auth.sb
  const token = getBearer(req)

  // 전역 단일 작업자 잠금 — 이미 다른 체인이 돌고 있으면 그대로 진행 중임을 알리고 종료.
  const { data: got, error: leErr } = await sb.rpc('embed_lease_acquire', { p_seconds: LEASE_S })
  if (leErr) return res.status(500).json({ error: 'lease failed', detail: leErr.message })
  if (!got) {
    return res.status(200).json({ running: true, started: false, remaining: await countPending(sb) })
  }

  // 잠금 획득 → 즉시 응답하고 백그라운드(waitUntil)에서 한 배치 처리 후 self-chain.
  res.status(200).json({ running: true, started: true })

  const host = req.headers['x-forwarded-host'] || req.headers.host
  const selfUrl = `https://${host}/api/embed-run`

  waitUntil((async () => {
    try {
      const { data: rows, error } = await sb
        .from('doc_chunks')
        .select('id,content')
        .is('embedding', null)
        .order('created_at', { ascending: true })
        .limit(BATCH)
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) {
        await sb.rpc('embed_lease_release')
        return
      }

      const embeddings = await embedBatch(rows.map((r) => r.content))
      for (let i = 0; i < rows.length; i += 30) {
        const grp = rows.slice(i, i + 30)
        const results = await Promise.all(
          grp.map((r, j) => sb.from('doc_chunks').update({ embedding: embeddings[i + j] }).eq('id', r.id)),
        )
        const failed = results.find((x) => x.error)
        if (failed) throw new Error(failed.error.message)
      }

      const remaining = await countPending(sb)
      if (remaining > 0) {
        // 페이싱 후 잠금 해제 → 다음 인스턴스가 즉시 잠금을 획득해 이어서 처리
        await sleep(PACE_MS)
        await sb.rpc('embed_lease_release')
        await fetch(selfUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chain: true }),
        }).catch(() => {})
      } else {
        await sb.rpc('embed_lease_release')
      }
    } catch (e) {
      // 체인 중단 — 잠금 해제로 '이어서 진행' 재개 가능(폴이즌 배치/토큰만료/일시오류 등)
      await sb.rpc('embed_lease_release').catch(() => {})
      console.error('[embed-run] chain stopped:', e?.message || e)
    }
  })())
}
