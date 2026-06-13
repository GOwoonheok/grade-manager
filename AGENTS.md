# AGENTS.md — SmartPPS(grade-manager) 에이전트 작업 규칙

계명문화대학교 공공조달학전공 **성적 · 학습(플래시카드) 플랫폼**.
Vite + React 18 + TypeScript + Tailwind v4 + Supabase(Auth/Postgres+RLS/Storage), PWA.
배포: https://smartpps.vercel.app (main 푸시 자동 배포).
구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 보안은 [SECURITY.md](SECURITY.md), 품질기준은 [docs/QUALITY.md](docs/QUALITY.md).

## 절대 규칙

1. **동작 임의 변경 금지** — 사용자가 요청하지 않은 동작 변경·기능 제거를 하지 않는다. 개선은 동작 동일성 확인 후.
2. **커밋 전 검증 필수** — `npm run check`(tsc 타입체크 + 데이터 무결성) **그리고** `npm run build` 통과 후 커밋. "고쳤다"는 주장 대신 **빌드 출력 등 증거**를 제시한다.
3. **배포 = `main` 푸시** — Vercel이 main을 자동 배포한다. 별도 deploy 명령 없음(Vercel CLI 미설치).
4. **Supabase 마이그레이션은 수동** — `supabase/NNN_*.sql`로 작성하고, **사용자가 Supabase SQL Editor에서 직접 실행**한다(코드가 자동 실행하지 않음). 새 마이그레이션은 다음 일련번호.
5. **참고 복사본 커밋 금지** — `itpe/`, `data_files/`는 리서치용 복사본(.gitignore). 절대 커밋하지 않는다.
6. **비밀키 금지** — 클라이언트엔 `VITE_SUPABASE_ANON_KEY`만. `service_role` 키·GitHub PAT·AI 키는 클라이언트/repo에 두지 않는다(서버 환경변수에만).
7. **권한 경계는 RLS** — UI의 role 표시는 표시용일 뿐. 실제 접근통제는 항상 DB의 RLS(`is_professor()`/`owns_course()`/`is_enrolled()`).

## 명령어

| 명령 | 용도 |
|---|---|
| `npm run dev` | 로컬 개발 (Vite, PWA devOptions 활성) |
| `npm run check` | **타입체크(tsc) + 데이터 무결성** (커밋 전 필수, 수 초) |
| `npm run build` | `tsc && vite build` — 배포 산출물 + PWA 생성 |
| `npm run preview` | 빌드 결과 미리보기 |

## 함정 (반복 실수 방지)

- **한글 파일은 Read 도구로 읽는다** — PowerShell/콘솔은 CP949로 깨진다(파일은 정상 UTF-8). PowerShell 파일쓰기 기본은 UTF-16 → 파일은 Write 도구 사용.
- **마이그레이션은 자동 실행 안 됨** — SQL 작성 후 "Supabase SQL Editor에서 실행하세요"로 사용자에게 단계 안내. 기능이 RPC/컬럼에 의존하면 해당 마이그레이션 적용 여부를 먼저 확인.
- **학생 로그인 이메일** = `{학번}@grade.local`(가짜 메일). 초기 비번 = `학번 + 전화 뒤4자리`, `must_change_password=true`. Supabase의 "Confirm email"은 꺼져 있어야 함(가짜 메일은 확인 불가).
- **과목이 두 종류** — 성적 `courses`(수강·점수·답안지 cascade) vs 플래시카드 `decks`. 삭제 영향 다름.
- **푸시 전** working tree에 의도치 않은 변경이 섞였는지 `git status`로 확인하고 **관련 파일만** add.

## 커밋 컨벤션

`feat|fix|style|refactor|chore(범위): 한국어 요약 — 상세는 — 뒤에`
커밋 메시지 끝에:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## 문서 체계

| 위치 | 내용 |
|---|---|
| `docs/product-specs/` | 기능 명세(기능별 1문서) |
| `docs/exec-plans/` | 작업 계획서(작업 전 계획 → 완료 후 결과 추기) |
| `docs/references/` | 외부 서비스·환경변수·대시보드 참조 |
| `docs/reports/` | 평가·회고 보고서 |
| `docs/QUALITY.md` | 품질 기준(Definition of Done) + 평가 기록 |

## 검증 하네스 (오케스트레이션)

- **PostToolUse 훅**(`.claude/settings.json` → `scripts/hook-check.mjs`): 편집 직후 `.mjs/.js`는 `node --check`, `.json`은 파싱, `.sql`은 비어있음 검사. (무거운 타입체크는 `npm run check`가 담당)
- **`npm run check`**: `tsc --noEmit` + `scripts/check.mjs`(마이그레이션 번호 연속성·중복, src 시크릿 스캔).
- **CI**(`.github/workflows/ci.yml`): main 푸시·PR마다 `npm run check` + `npm run build`.
- 규모 있는 작업은 시작 전 `docs/exec-plans/YYYY-MM-DD-주제.md`에 계획을 쓰고 완료 후 결과 추기.
