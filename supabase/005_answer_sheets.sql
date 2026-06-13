-- ===================================================================
-- 005: 답안지 사진 (중간·기말) — Supabase Storage + answer_sheets 테이블
-- 실행 위치: Supabase Dashboard > SQL Editor > New query
-- 재실행 안전 (idempotent)
-- ===================================================================

-- 1. answer_sheets 테이블
create table if not exists answer_sheets (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  exam_type   text not null check (exam_type in ('midterm','final')),
  path        text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_answer_sheets_student
  on answer_sheets(student_id, exam_type);

-- 2. answer_sheets RLS
alter table answer_sheets enable row level security;

drop policy if exists "as_read_self_or_prof" on answer_sheets;
create policy "as_read_self_or_prof" on answer_sheets
  for select to authenticated
  using (student_id = auth.uid() or is_professor());

drop policy if exists "as_prof_insert" on answer_sheets;
create policy "as_prof_insert" on answer_sheets
  for insert to authenticated with check (is_professor());

drop policy if exists "as_prof_update" on answer_sheets;
create policy "as_prof_update" on answer_sheets
  for update to authenticated using (is_professor()) with check (is_professor());

drop policy if exists "as_prof_delete" on answer_sheets;
create policy "as_prof_delete" on answer_sheets
  for delete to authenticated using (is_professor());

-- 3. Storage 비공개 버킷
insert into storage.buckets (id, name, public)
values ('answer-sheets', 'answer-sheets', false)
on conflict (id) do nothing;

-- 4. Storage 객체 RLS (버킷 한정)
drop policy if exists "as_obj_read_self" on storage.objects;
create policy "as_obj_read_self" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "as_obj_read_prof" on storage.objects;
create policy "as_obj_read_prof" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_insert_prof" on storage.objects;
create policy "as_obj_insert_prof" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_update_prof" on storage.objects;
create policy "as_obj_update_prof" on storage.objects
  for update to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_delete_prof" on storage.objects;
create policy "as_obj_delete_prof" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());
