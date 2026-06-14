-- 022: 분야별 PDF 문서 목록·조각수 집계 RPC (목록을 서버에서 집계 → 전 행 fetch 방지, 성능)
create or replace function pdf_sources(p_deck_id uuid)
returns table(source_title text, chunks bigint)
language sql stable
as $$
  select coalesce(nullif(dc.source_title, ''), '(제목없음)') as source_title, count(*)::bigint as chunks
  from doc_chunks dc
  where dc.deck_id = p_deck_id and dc.source = 'pdf'
  group by coalesce(nullif(dc.source_title, ''), '(제목없음)')
  order by source_title
$$;
grant execute on function pdf_sources(uuid) to authenticated;
