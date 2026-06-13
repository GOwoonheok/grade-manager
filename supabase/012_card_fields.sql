-- ===================================================================
-- 012: 카드 구조 — 토픽명/정의/주요내용/키워드 필드 추가
-- 앞면=토픽명(term), 뒤면=정의+주요내용+키워드. (기존 front/back/이미지 컬럼은 보존)
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================
alter table cards add column if not exists term       text not null default '';
alter table cards add column if not exists definition text not null default '';
alter table cards add column if not exists content    text not null default '';
alter table cards add column if not exists keywords   text not null default '';
