-- ===================================================================
-- 018: RAG V1 — pgvector 벡터DB + 청크(카드/문서) + top-k 검색 RPC
-- 임베딩 모델 text-embedding-004 = 768차원. 무료(Supabase Free + Gemini 무료).
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================

create extension if not exists vector;

create table if not exists doc_chunks (
  id         uuid primary key default gen_random_uuid(),
  deck_id    uuid references decks(id)  on delete cascade,
  topic_id   uuid references topics(id) on delete set null,
  card_id    uuid references cards(id)  on delete cascade,
  source     text not null default 'card' check (source in ('card','pdf','hwp','text')),
  content    text not null,
  embedding  vector(768),
  created_at timestamptz default now()
);
create index if not exists idx_doc_chunks_deck on doc_chunks(deck_id, source);
create index if not exists idx_doc_chunks_embedding on doc_chunks using hnsw (embedding vector_cosine_ops);

-- RLS: 교수 전체 CRUD / 승인 학습자 읽기 (RAG 상담 대비)
alter table doc_chunks enable row level security;
drop policy if exists dc_read  on doc_chunks;
drop policy if exists dc_write on doc_chunks;
create policy dc_read  on doc_chunks for select to authenticated
  using (is_professor() or is_study_member());
create policy dc_write on doc_chunks for all to authenticated
  using (is_professor()) with check (is_professor());

-- top-k 유사 검색 (코사인). SECURITY INVOKER → RLS 적용.
create or replace function match_chunks(query_embedding vector(768), p_deck_id uuid, match_count int default 40)
returns table(id uuid, content text, topic_id uuid, similarity float)
language sql stable
as $$
  select dc.id, dc.content, dc.topic_id, 1 - (dc.embedding <=> query_embedding) as similarity
  from doc_chunks dc
  where dc.deck_id = p_deck_id and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1)
$$;
grant execute on function match_chunks(vector, uuid, int) to authenticated;
