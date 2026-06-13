-- ===================================================================
-- 010: 조달관리사 플래시카드 학습 — decks/cards/진도/승인 + admin 역할 + 이미지 버킷
-- 실행: Supabase SQL Editor. 재실행 안전.
-- is_admin = role 'admin' 또는 'professor'(현재 단일 운영자 편의). 전용 admin 계정도 지원.
-- ===================================================================

-- role에 'admin' 허용
alter table students drop constraint if exists students_role_check;
alter table students add constraint students_role_check
  check (role in ('student','professor','admin'));

create or replace function is_admin() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from students where id = auth.uid() and role in ('admin','professor'));
$$;
grant execute on function is_admin() to authenticated;

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  front text not null default '',
  back text not null default '',
  front_image text,
  back_image text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_cards_deck on cards(deck_id, sort_order);

create table if not exists study_members (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz default now(),
  decided_at timestamptz,
  unique (student_id)
);

create table if not exists card_marks (
  student_id uuid not null references students(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  status text not null check (status in ('known','unknown')),
  updated_at timestamptz default now(),
  primary key (student_id, card_id)
);

create or replace function is_study_member() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from study_members where student_id = auth.uid() and status = 'approved');
$$;
grant execute on function is_study_member() to authenticated;

-- RLS: decks/cards 읽기=승인학생 또는 admin / 쓰기=admin
alter table decks enable row level security;
drop policy if exists decks_read on decks;
drop policy if exists decks_write on decks;
create policy decks_read on decks for select to authenticated using (is_admin() or is_study_member());
create policy decks_write on decks for all to authenticated using (is_admin()) with check (is_admin());

alter table cards enable row level security;
drop policy if exists cards_read on cards;
drop policy if exists cards_write on cards;
create policy cards_read on cards for select to authenticated using (is_admin() or is_study_member());
create policy cards_write on cards for all to authenticated using (is_admin()) with check (is_admin());

-- study_members: 본인 읽기/신청, admin 전체 관리
alter table study_members enable row level security;
drop policy if exists sm_read on study_members;
drop policy if exists sm_self_req on study_members;
drop policy if exists sm_admin_write on study_members;
create policy sm_read on study_members for select to authenticated using (student_id = auth.uid() or is_admin());
create policy sm_self_req on study_members for insert to authenticated with check (student_id = auth.uid() and status = 'pending');
create policy sm_admin_write on study_members for all to authenticated using (is_admin()) with check (is_admin());

-- card_marks: 본인만
alter table card_marks enable row level security;
drop policy if exists cm_own on card_marks;
create policy cm_own on card_marks for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- 카드 이미지 공개 버킷 + admin 쓰기
insert into storage.buckets (id, name, public)
values ('flashcard-images', 'flashcard-images', true) on conflict (id) do nothing;
drop policy if exists fc_admin_insert on storage.objects;
drop policy if exists fc_admin_update on storage.objects;
drop policy if exists fc_admin_delete on storage.objects;
create policy fc_admin_insert on storage.objects for insert to authenticated with check (bucket_id='flashcard-images' and is_admin());
create policy fc_admin_update on storage.objects for update to authenticated using (bucket_id='flashcard-images' and is_admin());
create policy fc_admin_delete on storage.objects for delete to authenticated using (bucket_id='flashcard-images' and is_admin());
