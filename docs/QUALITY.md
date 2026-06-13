# QUALITY.md — 품질 기준 + 평가 기록

## 품질 기준 (Definition of Done)

모든 코드 변경은 아래를 만족해야 "완료"로 선언한다.

| # | 기준 | 확인 방법 |
|---|---|---|
| 1 | 기존 동작 보존 — 요청되지 않은 변경 없음 | diff 리뷰, 영향 범위 명시 |
| 2 | `npm run check` 통과 (tsc + 데이터 무결성) | 출력 제시 |
| 3 | `npm run build` 통과 (배포 산출물 생성) | 출력 제시 |
| 4 | UI 변경 시 화면 증거 | 스크린샷 또는 동작 설명 |
| 5 | 커밋 컨벤션 + 관련 파일만 커밋 | `git show --stat` |
| 6 | 보안 규칙 위반 없음(anon키·RLS·시크릿) | [SECURITY.md](SECURITY.md) |
| 7 | DB 변경은 마이그레이션 번호로, 적용 안내 | `supabase/NNN_*.sql` |
| 8 | 규모 있는 작업은 exec-plan 기록 | `docs/exec-plans/` |

## 평가 기록

### 2026-06-14 — 기준선(Baseline)

| 영역 | 점수(5) | 근거 |
|---|---|---|
| 기능 완성도 | 4 | 다과목 성적·상대평가·공개토글·답안지·전화암호화·플래시카드 학습/관리·Q&A 배포됨 |
| 보안 | 4 | RLS 경계·전화 암호화·비공개 버킷. service_role 미사용(anon only) |
| 테스트 | 2 | 자동 테스트 없음 — tsc + build + check.mjs(무결성)로 1차 방어. E2E 미도입 |
| 문서화 | 1→4 | 없음 → AGENTS/ARCHITECTURE/SECURITY/QUALITY + docs 체계 구축(이 커밋) |
| 자동화 | 1→4 | 없음 → PostToolUse 훅 + npm run check + CI 도입 |
| 구조 | 3 | lib 모듈화 양호. AdminPage 비대(향후 분할 여지) |

차기 목표: 테스트(핵심 흐름 E2E), 플래시카드 고도화(itpe식), 리포트 생성(python-docx 백엔드).
