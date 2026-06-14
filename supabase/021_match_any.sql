-- 021: 전체 분야 대상 top-k 검색 (RAG 상담 — 분야 미지정 시). 재실행 안전.
create or replace function match_chunks_any(query_embedding vector(768), match_count int default 30)
returns table(id uuid, content text, deck_id uuid, topic_id uuid, similarity float)
language sql stable
as $$
  select dc.id, dc.content, dc.deck_id, dc.topic_id, 1 - (dc.embedding <=> query_embedding) as similarity
  from doc_chunks dc
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1)
$$;
grant execute on function match_chunks_any(vector, int) to authenticated;
