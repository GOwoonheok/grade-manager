#!/usr/bin/env node
// Claude Code PostToolUse 훅 — 편집 직후 가벼운 검증.
//   .mjs/.js → node --check (구문)   .json → 파싱   .sql → 비어있음
// 무거운 타입체크(tsc)는 `npm run check` + CI 가 담당. 실패 시 exit 2 → Claude에 피드백.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let raw = ''
try { raw = readFileSync(0, 'utf8') } catch {}
let fp = ''
try { fp = JSON.parse(raw)?.tool_input?.file_path || '' } catch {}
if (!fp) process.exit(0)

try {
  if (/\.(mjs|js)$/.test(fp)) {
    execFileSync(process.execPath, ['--check', fp], { stdio: 'pipe' })
  } else if (/\.json$/.test(fp)) {
    JSON.parse(readFileSync(fp, 'utf8'))
  } else if (/\.sql$/.test(fp)) {
    if (!readFileSync(fp, 'utf8').trim()) throw new Error('빈 SQL 파일')
  }
} catch (e) {
  console.error(`[hook-check] ${fp} 검증 실패: ${e?.message || e}`)
  process.exit(2)
}
process.exit(0)
