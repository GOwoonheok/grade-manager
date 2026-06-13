# grade-manager

학생 성적 관리 웹앱. 교수가 점수·답안지를 관리하고, 학생은 본인 성적·답안지를 조회.

## 스택
React 18 + TypeScript + Vite · Tailwind v4 · Supabase(Auth + Postgres + Storage + RLS) · `xlsx` · 배포: Vercel(SPA, `vercel.json` rewrite)

## 셋업
1. `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon 키는 공개값, RLS로 보호)
2. `npm install`
3. **Supabase SQL Editor에서 마이그레이션을 순서대로 실행**: `supabase/001 → 002 → 003 → 005 → 006` (004는 예약: 레거시 score DROP, 미실행)
4. `npm run dev` (기본 5173)

## 데이터 모델 (현재)
- `students`: id(=auth uid) · student_number(=로그인ID) · name · department · phone · midterm · final · attendance · score(레거시) · role(student|professor)
- `class_settings`(id=1): midterm/final/attendance 가중치(합100)
- `answer_sheets`: id · student_id→students · exam_type(midterm|final) · path(Storage) · created_at
- Storage 비공개 버킷 `answer-sheets`, 경로 `{studentId}/{examType}/{uuid}.jpg`
- RPC `get_class_stats()`: 가중 최종점수 기준 반 평균/최고/인원

> **향후 방향(설계만, 개발 보류)**: 연도·학기·과목별(course+enrollment, 다중 교수) 재설계, 조달관리사 플래시카드 학습 서비스. → `docs/superpowers/specs/2026-06-13-multi-course-gradebook-design.md`, `…-flashcards-design.md`

## 보안(RLS) 모델
- 로그인: 학번 → `{학번}@grade.local` 가짜 이메일로 Supabase Auth. 역할로 라우팅(`/admin` 교수, `/me` 학생).
- `students`: 읽기=본인 또는 교수 / 삽입·삭제=교수 / **수정=교수 전용(006)**.
  - ⚠️ `006_lock_student_update.sql` 은 학생의 자기행 UPDATE(성적 조작·`role` 권한상승)를 차단. **반드시 실행**해야 적용됨.
- `answer_sheets` + Storage: 학생=본인 것만 읽기 / 쓰기=교수. 비공개 버킷 + 만료 서명URL.
- `class_settings`: 읽기=인증사용자 / 수정=교수.
- 학생 생성 시 교수 세션 유지 위해 `supabaseSignup`(persistSession:false) 보조 클라이언트 사용.

## 기능
- 교수(`/admin`): 학생 CRUD, 검색, 가중치 설정, 엑셀(신규 일괄 등록 / 과목별 점수 업로드 / **표준 양식 다운로드**), 답안지 업로드(**촬영·파일·클립보드붙여넣기**, 중간/기말, 학생 편집 모달).
- 학생(`/me`): 본인 4점수(중간/기말/출석/최종) + 반 통계 + **본인 답안지** + 비밀번호 변경.

## 검증
테스트 러너 없음. 검증 = `npx tsc --noEmit` + `npm run build` + 수동/E2E.
- 답안지 기능은 실제 브라우저 E2E로 검증됨(교수 업로드→저장, 학생 본인만 조회=RLS, 타학생 차단).
- 설계·구현 이력: `docs/superpowers/specs|plans/`.

## 마이그레이션
| # | 내용 |
|---|---|
| 001 | students, is_professor(), RLS, get_class_stats |
| 002 | 교수 계정 등록 가이드 |
| 003 | 점수 분리(중간/기말/출석) + class_settings 가중치 |
| 004 | (예약) 레거시 score DROP — 미실행 |
| 005 | answer_sheets + 비공개 버킷 + RLS |
| 006 | **보안: students UPDATE 교수 전용** (권한상승/성적조작 차단) |
