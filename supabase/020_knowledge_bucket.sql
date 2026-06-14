-- ===================================================================
-- 020: 근거자료 PDF 임시 업로드 버킷 (Storage 경유 → 함수 4.5MB 한도 우회, ~50MB 무료)
-- PDF는 업로드 → 함수가 추출·임베딩 후 즉시 삭제(텍스트만 doc_chunks에 보관) → 용량 거의 안 씀.
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledge-docs', 'knowledge-docs', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 이 버킷은 교수만 (업로드·다운로드·삭제)
drop policy if exists kd_prof_all on storage.objects;
create policy kd_prof_all on storage.objects
  for all to authenticated
  using (bucket_id = 'knowledge-docs' and is_professor())
  with check (bucket_id = 'knowledge-docs' and is_professor());
