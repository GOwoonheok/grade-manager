// /api/_supa.js — 함수 공통 인증. Supabase 액세스 토큰 검증 + 교수 권한 확인.
// service_role 키 미사용(필요 최소권한 — 사용자 토큰 + RLS/RPC 그대로 활용).
import { createClient } from '@supabase/supabase-js'

export function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || ''
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : ''
}

// 토큰 → { ok, user, sb } | { ok:false, status, reason }
export async function verifyProfessor(req) {
  const token = getBearer(req)
  if (!token) return { ok: false, status: 401, reason: 'no-token' }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) return { ok: false, status: 500, reason: 'supabase-env-missing' }
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) return { ok: false, status: 401, reason: 'invalid-token' }
  const { data: isProf, error: e2 } = await sb.rpc('is_professor')
  if (e2) return { ok: false, status: 500, reason: 'rpc-failed' }
  if (!isProf) return { ok: false, status: 403, reason: 'not-professor' }
  return { ok: true, user, sb }
}
