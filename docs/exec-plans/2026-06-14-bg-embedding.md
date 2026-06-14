# 2026-06-14 · PDF 임베딩 색인 — 서버 백그라운드 자동 진행

## 배경 / 요구
PDF 업로드 후 임베딩 색인이 **클라이언트 while 루프**(`KnowledgeUpload.runEmbed`)로 60초마다
`/api/embed-pending`를 호출 → **탭(화면)을 닫으면 색인이 멈춤**. 큰 문서는 화면을 오래 열어둬야 했음.
요구: "클릭 1회로 시작하면 **서버 백단에서 계속(이어서) 진행**".

## 제약
- $0 운영 → 유료 기능 불가.
- **Vercel Hobby(무료) 크론 = 하루 1회 제한** → 분 단위 페이싱 색인에 크론 사용 불가(분 단위는 Pro 유료).
  (출처: Vercel docs cron usage-and-pricing / limits)
- 무료 Gemini 임베딩 = 분당 ~100 → **분당 ≤90**로 페이싱, **동시 1개 체인만** 허용 필요.

## 결정: 서버 self-chaining (waitUntil)
크론 대신 함수가 스스로 다음 배치를 호출하는 체인.
- `/api/embed-run`: 잠금 획득 → 즉시 200 응답 → `waitUntil`에서 한 배치(≤45) 임베딩 →
  ~30초 페이싱 → 잠금 해제 → **자기 자신을 재호출**(같은 교수 토큰 전달). 대기 0이면 종료.
- 전역 잠금(`embed_worker` 1행 + `embed_lease_acquire/release` RPC, 023)으로 **동시 체인 1개** 보장
  → 분당 한도 보호. 체인 중단(토큰만료 1h·일시오류) 시 lease 만료 → "이어서 진행" 클릭으로 재개.
- service_role/새 비밀키 불필요(교수 토큰 + RLS 그대로). 새 env 없음.

각 인스턴스 수명 ≈ 배치(~10s)+페이싱(30s) ≈ 40s (`maxDuration:60`). 토큰 유효 ~1h →
한 클릭으로 수천 조각 처리, 초과분은 클릭 재개.

## 변경 파일
- `supabase/023_embed_worker.sql` (신규, 수동 실행 필요)
- `api/embed-run.js` (신규, waitUntil self-chain) / `api/embed-pending.js` (삭제)
- `src/lib/knowledge.ts` (`embedPending`→`startEmbedding` 킥)
- `src/components/KnowledgeUpload.tsx` (클라 루프 제거 → 킥 1회 + 대기수 폴링)
- `package.json` (+`@vercel/functions`), `ARCHITECTURE.md`

## 적용 순서
1. `git push main` → Vercel 자동 배포
2. **Supabase SQL Editor에서 `023_embed_worker.sql` 실행** (안 하면 색인이 'lease failed'로 시작 안 됨)
3. 교수 로그인 → 근거자료(PDF) 업로드 → 자동 색인 시작 → 탭 닫아도 진행 확인

## 결과 (완료 후 추기)
- 구현·검증 완료(`npm run check`+`npm run build` 통과). 배포/마이그레이션 후 동작 확인 예정.
