-- 019: doc_chunks 에 문서 제목(업로드 자료 관리·삭제용). 재실행 안전.
alter table doc_chunks add column if not exists source_title text default '';
