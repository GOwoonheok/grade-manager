# backend — /api (Vercel Functions) 환경

우리 앱은 Vite 정적 SPA + **Vercel Serverless Functions(`/api/*.js`)** 혼합. `/api`는 프레임워크 무관하게 Vercel이 자동 함수로 배포(별도 빌드). 프론트 `npm run build`(tsc+vite)는 `/api`를 건드리지 않음. **무료(Hobby) 범위에서 운영.**

## 엔드포인트 (예정/현재)
| 경로 | 용도 | 상태 |
|---|---|---|
| `/api/health` | 동작·env 확인 | ✅ |
| `/api/quiz-gen` | C2 — 토픽 카드로 4지선다 AI 생성(draft) | 예정 |
| `/api/ask` | B-2 — RAG 질의응답 | 예정 |
| `/api/flash-ai` | P4 — 카드 자동 생성 | 예정 |
| `/api/report` | R1 — 성적 리포트(python-docx) | 예정 |

## Vercel 환경변수 (Project → Settings → Environment Variables)
| 변수 | 필수 | 값 |
|---|---|---|
| `SUPABASE_URL` | ✅ | VITE_SUPABASE_URL 과 동일 값 (함수가 토큰 검증에 사용) |
| `SUPABASE_ANON_KEY` | ✅ | VITE_SUPABASE_ANON_KEY 와 동일 값 |
| `GEMINI_API_KEY` | ✅(AI) | Google AI Studio 무료 키 |
| `AI_GATEWAY_API_KEY` 또는 `ANTHROPIC_API_KEY` | 선택 | **Claude 옵트인(유료)** — 미설정이면 Gemini만(=$0) |

> Production/Preview/Development 모두 체크. 변경 후 Redeploy.

## Gemini 무료 키 발급
1. https://aistudio.google.com/app/apikey 접속(구글 로그인)
2. **Create API key** → 키 복사
3. Vercel 환경변수 `GEMINI_API_KEY`에 붙여넣기 (무료 한도: 일 1,500건 수준)

## 인증/권한 (함수 공통 — 예정 `_supa.js`)
- 클라이언트가 `Authorization: Bearer <Supabase 액세스 토큰>` 전송 → 함수가 anon 클라이언트로 `getUser` + `is_professor` RPC 검증.
- **service_role 키는 함수에도 안 씀**(필요 최소권한, RLS 그대로 활용).
- **Claude 비용 가드**: Claude 경로는 교수 권한 + 명시적 선택일 때만. 학생 경로는 항상 Gemini.
