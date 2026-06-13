-- ===================================================================
-- 013: 같이 공부하기 (Q&A) — 질문/답변 게시판 (parent_id로 스레드)
-- 읽기·쓰기=승인 학습자 또는 관리자. 삭제=본인 또는 관리자.
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================
create table if not exists study_qna (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references students(id) on delete cascade,
  parent_id uuid references study_qna(id) on delete cascade, -- null=질문, 값=답변
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_qna_parent on study_qna(parent_id, created_at);

alter table study_qna enable row level security;
drop policy if exists qna_read on study_qna;
drop policy if exists qna_insert on study_qna;
drop policy if exists qna_delete on study_qna;
create policy qna_read on study_qna for select to authenticated using (is_admin() or is_study_member());
create policy qna_insert on study_qna for insert to authenticated with check (author_id = auth.uid() and (is_admin() or is_study_member()));
create policy qna_delete on study_qna for delete to authenticated using (author_id = auth.uid() or is_admin());
