-- ===================================================================
-- 017: CBT 예상문제 (4지선다 중심) + 응시 기록
-- 텍스트 기반(무지출). 실행: Supabase SQL Editor. 재실행 안전(idempotent).
-- ===================================================================

-- 1. quiz_questions — 문제 은행 (검증 상태로 풀 노출 제어)
create table if not exists quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references topics(id) on delete cascade,
  type        text not null default 'mcq' check (type in ('mcq','ox','short')),
  stem        text not null,                            -- 문제 지문
  choices     jsonb not null default '[]'::jsonb,       -- 보기 ["①","②","③","④"]
  answer      int  not null default 0,                  -- 정답 인덱스(0-base)
  explanation text default '',                          -- 해설
  difficulty  text not null default 'normal' check (difficulty in ('easy','normal','hard')),
  source      text not null default 'manual' check (source in ('manual','ai')),
  status      text not null default 'verified' check (status in ('draft','verified','rejected')),
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_quiz_questions_topic on quiz_questions(topic_id, status);

-- 2. quiz_attempts — 학생 응시 기록 (오답노트·통계용)
create table if not exists quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  topic_id    uuid references topics(id) on delete set null,
  total       int  not null,
  score       int  not null,
  detail      jsonb default '[]'::jsonb,                -- [{question_id,chosen,correct}]
  created_at  timestamptz default now()
);
create index if not exists idx_quiz_attempts_student on quiz_attempts(student_id, created_at);

-- 3. RLS — 교수=전체 CRUD / 학생=verified만 읽기(승인된 학습자) ; 응시기록=본인
alter table quiz_questions enable row level security;
drop policy if exists qq_read  on quiz_questions;
drop policy if exists qq_write on quiz_questions;
create policy qq_read on quiz_questions for select to authenticated
  using (is_professor() or (status = 'verified' and is_study_member()));
create policy qq_write on quiz_questions for all to authenticated
  using (is_professor()) with check (is_professor());

alter table quiz_attempts enable row level security;
drop policy if exists qa_self on quiz_attempts;
create policy qa_self on quiz_attempts for all to authenticated
  using (student_id = auth.uid() or is_professor())
  with check (student_id = auth.uid());
