# ARCHITECTURE.md — SmartPPS 구조

## 전체 그림

```
[브라우저 PWA]                      [Vercel]                      [Supabase]
Vite SPA(React+TS) ──auth/REST──►   정적호스팅 + /api 함수  ──►   Auth · Postgres+RLS
@supabase/supabase-js               (Node · AI SDK)               Storage · pgvector
sw.js 오프라인 캐시                  main 푸시 자동배포             [Gemini 무료] 임베딩·생성
```

- 읽기/쓰기 대부분은 **브라우저 → Supabase 직접**(RLS가 권한 경계). **AI(생성·임베딩·RAG)·PDF 추출만 `/api` 함수** 경유(키 보호 + 무료 Gemini).

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
| `grading.ts` | 순수 채점(`calcFinalScore`·`assignRelativeGrades`) — 단위테스트 대상 |
| `quiz.ts` | CBT 문제 CRUD·검수·AI생성 호출·응시 저장 |
| `knowledge.ts` | RAG 근거자료(PDF 분할·업로드·임베딩 큐·검색·`askRag`) |
| `excelTemplate.ts` | 엑셀 양식 |

## 데이터 모델 (Supabase)

**성적:** `students`(=auth.users, 학번·이름·학과·phone(암호화)·role·must_change_password) · `courses`(owner_id·연도·학기·과목명·가중치·등급비율·scores_published) · `enrollments`(course_id·student_id·중간/기말/출석) · `answer_sheets`(course_id·student_id·exam_type·path) · `class_settings`(레거시 단일과목, pre-007)

**학습:** `decks` · `topics` · `cards`(term·definition·content·keywords·front_image…) · `card_marks`(student_id·card_id·known/unknown) · `study_members`(승인) · `study_qna`(Q&A)

**CBT/AI:** `quiz_questions`(stem·choices·answer·해설·source·**status** draft/verified/rejected) · `quiz_attempts`(student·score·detail jsonb) · `doc_chunks`(**pgvector(768)**: 카드/PDF 청크·embedding·source·source_title)

**RLS 헬퍼(SECURITY DEFINER):** `is_professor()` · `owns_course(cid)` · `is_enrolled(cid)` · `is_study_member()`
**RPC:** `get_class_stats` · `get_course_stats` · `get_student_phones`(복호화) · `clear_must_change` · `match_chunks`/`match_chunks_any`(top-k 검색) · `pdf_sources`(문서 집계)
**Storage:** `answer-sheets`(비공개) · `flashcard-images`(공개) · `knowledge-docs`(비공개·PDF 임시→처리 후 삭제)

## 백엔드 함수 (`/api/*.js` — Vercel Node, 무료 Gemini)

| 엔드포인트 | 역할 | 인증 |
|---|---|---|
| `health` | 동작·env 확인 | 공개 |
| `quiz-gen` | 토픽 카드 근거로 4지선다 생성(draft) | 교수 |
| `embed-cards` | 카드 임베딩(분당 ≤90, 무료한도) | 교수 |
| `embed-run` | 대기청크 **서버 백그라운드 자동색인**(클릭1회→`waitUntil` self-chain, 전역잠금 023) | 교수 |
| `ingest` | PDF(Storage)→텍스트추출(unpdf)·청킹·대기저장 | 교수 |
| `ask` | 질문 임베딩→top-k 근거→Gemini 답변(RAG) | 로그인 |

공통 모듈: `_supa.js`(토큰 검증 `verifyProfessor`/`verifyUser`, **service_role 미사용**) · `_ai.js`(임베딩 `gemini-embedding-001` 768차원·100개 배치). **AI 키는 서버 env(`GEMINI_API_KEY`)에만**, Supabase 자격은 `VITE_*` 재사용. 상세 [docs/references/backend.md](docs/references/backend.md).

## 마이그레이션 (`supabase/NNN_*.sql` — 수동 실행)

001 students+RLS · 002 교수등록 · 003 점수분리 · 005 답안지 · 006 잠금 · 007 **다과목(사람↔수강 분리)** · 008 과목통계 · 009 비번재설정+강제변경 · 010~013 플래시카드/Q&A · 014 등급비율+공개 · 015 전화암호화 · 016 답안지 과목단위 · **017 CBT(quiz)** · **018 pgvector+doc_chunks** · 019 문서제목 · 020 knowledge 버킷 · 021 전체검색 RPC · 022 PDF목록 RPC · **023 백그라운드 임베딩 전역잠금(embed_lease)**.
→ 새 기능이 특정 마이그레이션에 의존하면 적용 여부 확인. 적용은 Supabase SQL Editor에서 사용자가 직접.

## 배포

`git push origin main` → Vercel 자동 빌드(`npm run build`)·배포. PWA(`vite-plugin-pwa`, autoUpdate)로 매니페스트·서비스워커 자동 생성.
