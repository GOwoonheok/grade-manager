# SECURITY.md — SmartPPS 보안 규칙

## 인증·권한 모델

- **인증**: Supabase Auth. 로그인 이메일 = `{학번}@grade.local`(가짜 메일). 초기 비밀번호 = `학번 + 전화 뒤4자리`, `must_change_password=true`로 최초 로그인 시 변경 강제.
  - Supabase **"Confirm email" 은 꺼져 있어야** 한다(가짜 메일은 확인 불가 → 켜지면 로그인 차단).
- **권한 경계 = RLS**. 클라이언트의 `role` 표시는 UI 용일 뿐 — 실제 접근통제는 **항상 DB의 Row Level Security**가 수행한다.
  - 헬퍼(SECURITY DEFINER, 재귀 방지): `is_professor()` / `owns_course(cid)` / `is_enrolled(cid)`.
  - 교수=본인 소유 과목만, 학생=본인 행/수강 과목만 접근.

## 코드 규칙 (위반 금지)

1. **클라이언트엔 anon 키만** — `VITE_SUPABASE_ANON_KEY`. `service_role` 키·GitHub PAT·AI API 키는 절대 클라이언트/repo에 두지 않는다(서버 환경변수에만). `scripts/check.mjs`가 src를 스캔한다.
2. **XSS** — React 기본 이스케이프에 의존. `dangerouslySetInnerHTML` 금지(불가피하면 정제).
3. **입력 신뢰 금지** — 점수 0~100, 파일 타입/용량 등 클라이언트+서버(RLS/제약) 양쪽 검증.
4. **PII** — 전화번호는 암호화 저장(015). 복호화는 `get_student_phones` RPC(담당 교수/본인만).

## 민감 데이터 보호

- **전화 암호화(015)**: pgcrypto + 서버 전용 키(`app_secrets`, RLS로 차단) + 자동 암호화 트리거. 평문 컬럼은 Phase 2에서 제거 예정.
- **답안지(005/016)**: 비공개 버킷 `answer-sheets`, signed URL(1h). 테이블·스토리지 RLS로 **과목 담당 교수/해당 과목 수강 본인**만. 경로는 행 단위로 분리(과목 누수 없음).
- **성적 공개**: `courses.scores_published`로 학생 노출 게이트.

## 환경변수

| 변수 | 위치 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 클라이언트(빌드 주입) | 공개 가능(anon). RLS가 보호 |
| `SUPABASE_SERVICE_ROLE_KEY` | (서버 함수 도입 시) Vercel 환경변수 | **클라이언트 금지** |
| AI 키(Gemini/Gateway 등) | (AI 기능 도입 시) Vercel 환경변수 | 서버에서만 |

## 사고 대응

- 의심 로그인/비번 유출: 해당 계정 비번 재설정(SQL) 또는 잠금. Supabase Auth → Users.
- 잘못된 데이터 변경: Supabase는 PITR/백업 정책 확인. 마이그레이션 되돌리는 역방향 SQL 작성.
- 키 유출: Supabase 키 로테이션 → 환경변수 교체 → 재배포.
