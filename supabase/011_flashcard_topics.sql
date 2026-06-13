-- ===================================================================
-- 011: 플래시카드 토픽 계층 — 과목(decks) → 토픽(topics) → 카드(cards)
-- 실행: Supabase SQL Editor. 재실행 안전. (기존 카드 없다는 가정; deck_id는 보존)
-- ===================================================================
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_topics_deck on topics(deck_id, sort_order);

-- 카드를 토픽 소속으로 (deck_id는 남기되 nullable, 신규는 topic_id 사용)
alter table cards alter column deck_id drop not null;
alter table cards add column if not exists topic_id uuid references topics(id) on delete cascade;
create index if not exists idx_cards_topic on cards(topic_id, sort_order);

alter table topics enable row level security;
drop policy if exists topics_read on topics;
drop policy if exists topics_write on topics;
create policy topics_read on topics for select to authenticated using (is_admin() or is_study_member());
create policy topics_write on topics for all to authenticated using (is_admin()) with check (is_admin());
