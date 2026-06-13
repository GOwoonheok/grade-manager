#!/usr/bin/env node
// 데이터·구조 무결성 검사 (커밋 전). 타입체크(tsc)는 package.json "check"가 함께 실행.
//   - Supabase 마이그레이션 번호 연속성·중복·빈 파일
//   - src 에 service_role 키/시크릿 패턴 유입 스캔
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let problems = 0
const fail = (m) => { console.error('  ✗ ' + m); problems++ }
const pass = (m) => console.log('  ✓ ' + m)

// 1) 마이그레이션 번호
const MIG = 'supabase'
if (existsSync(MIG)) {
  const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()
  const nums = []
  for (const f of files) {
    const m = /^(\d{3})_/.exec(f)
    if (!m) { fail(`마이그레이션 파일명 형식 오류(NNN_*.sql): ${f}`); continue }
    nums.push(Number(m[1]))
    if (!readFileSync(join(MIG, f), 'utf8').trim()) fail(`빈 마이그레이션: ${f}`)
  }
  const dups = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))]
  if (dups.length) fail(`중복 마이그레이션 번호: ${dups.join(', ')}`)
  if (nums.length) pass(`마이그레이션 ${files.length}개 (최신 ${String(Math.max(...nums)).padStart(3, '0')})`)
} else {
  fail('supabase/ 폴더 없음')
}

// 2) 클라이언트 시크릿 스캔
const SECRET = /(service_role|SUPABASE_SERVICE_ROLE|sk-[A-Za-z0-9]{20}|github_pat_|AIza[0-9A-Za-z_\-]{30})/
let scanned = 0
function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) scan(p)
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      scanned++
      if (SECRET.test(readFileSync(p, 'utf8'))) fail(`의심 시크릿/서버키 패턴: ${p}`)
    }
  }
}
if (existsSync('src')) scan('src')
if (problems === 0) pass(`src 시크릿 스캔 OK (${scanned}개 파일)`)

console.log(problems === 0 ? '\n✅ check 통과' : `\n❌ ${problems}건 문제`)
process.exit(problems === 0 ? 0 : 1)
