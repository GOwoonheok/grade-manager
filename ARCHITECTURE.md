# ARCHITECTURE.md — SmartPPS 구조

## 전체 그림

```
[브라우저 PWA]                         [Supabase]                      [Vercel]
Vite SPA (React+TS)  ──auth/REST──►   Auth (이메일=학번@grade.local)   정적 호스팅
@supabase/supabase-js                 Postgres + RLS (권한 경계)        main 푸시 자동배포
sw.js 오프라인 캐시                    Storage (answer-sheets/flashcard) (서버 함수 현재 없음 *)
```

\* 백엔드 함수(`/api/*`)는 아직 없음. **리포트 생성(python-docx)·플래시카드 AI 생성**을 추가할 때 Vercel Function으로 도입 예정.

## 페이지 ↔ 라우트 (`src/App.tsx`)

| 라우트 | 페이지 | 접근 |
|---|---|---|
| `/login` | LoginPage | 공개 |
| `/home` | HomePage (성적확인 / 공공조달관리 타일) | 인증 |
| `/me` | StudentPage (내 과목별 성적·답안지) | student |
| `/admin` | AdminPage (교수 대시보드: 과목·명단·점수·등급·공개·엑셀) | professor |
| `/study` | StudyPage → StudentStudy / AdminStudy | 인증 |
| `/change-password` | ForcePasswordPage (최초 로그인 강제변경) | 인증 |

`ProtectedRoute`가 세션·역할·`must_change_password`를 게이트.

## 주요 모듈 (`src/lib`)

| 파일 | 역할 |
|---|---|
| `supabase.ts` | 클라이언트 2개(세션용/가입용), 타입, `calcFinalScore`, `assignRelativeGrades`(상대평가) |
| `courses.ts` | 과목·수강등록·점수·등급·공개·전화복호화 RPC·학생추가 |
| `answerSheets.ts` | 답안지(과목단위, 016) 업로드/조회/삭제/플래그, 이미지 리사이즈 |
| `flashcards.ts` | decks/topics/cards, 진도(card_marks), 승인(study_members), Q&A(study_qna) |
| `excelTemplate.ts` | 엑셀 양식 |

## 데이터 모델 (Supabase)

**성적:** `students`(=auth.users, 학번·이름·학과·phone(암호화)·role·must_change_password) · `courses`(owner_id·연도·학기·과목명·가중치·등급비율·scores_published) · `enrollments`(course_id·student_id·중간/기말/출석) · `answer_sheets`(course_id·student_id·exam_type·path) · `class_settings`(레거시 단일과목, pre-007)

**학습:** `decks` · `topics` · `cards`(term·definition·content·keywords·front_image…) · `card_marks`(student_id·card_id·known/unknown) · `study_members`(승인) · `study_qna`(Q&A)

**RLS 헬퍼(SECURITY DEFINER):** `is_professor()` · `owns_course(cid)` · `is_enrolled(cid)`
**RPC:** `get_class_stats` · `get_course_stats` · `get_student_phones`(전화 복호화) · `clear_must_change`
**Storage:** `answer-sheets`(비공개, 과목단위 RLS) · `flashcard-images`(공개)

## 마이그레이션 (`supabase/NNN_*.sql` — 수동 실행)

001 students+RLS · 002 교수등록 · 003 점수분리 · 005 답안지 · 006 잠금 · 007 **다과목(사람↔수강 분리)** · 008 과목통계 · 009 비번재설정+강제변경 · 010~013 플래시카드/Q&A · 014 등급비율+공개 · 015 전화암호화(pgcrypto) · 016 답안지 과목단위.
→ 새 기능이 특정 마이그레이션에 의존하면 적용 여부 확인. 적용은 Supabase SQL Editor에서 사용자가 직접.

## 배포

`git push origin main` → Vercel 자동 빌드(`npm run build`)·배포. PWA(`vite-plugin-pwa`, autoUpdate)로 매니페스트·서비스워커 자동 생성.
