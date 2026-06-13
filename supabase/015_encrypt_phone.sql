-- 전화번호 암호화 (Phase 1)
-- 목표: DB에는 암호문으로 저장, 조회는 권한제어 RPC로 복호화. 키는 서버(DB)에만 보관(클라이언트 비노출).
-- Phase 1은 비파괴: 암호문 컬럼 추가 + 자동 동기화 트리거 + 복호화 RPC. 평문(phone)은 당분간 병행 유지.
-- Phase 2(추후): 검증 후 평문 phone 컬럼 제거 + 평문 기록 중단.

create extension if not exists pgcrypto with schema extensions;

-- 서버 전용 키 보관소: RLS 켜고 정책 없음 → authenticated/anon 직접 접근 불가.
-- SECURITY DEFINER 함수(소유자 postgres)만 RLS 우회로 읽음.
create table if not exists app_secrets (
  name text primary key,
  value text not null
);
alter table app_secrets enable row level security;
revoke all on table app_secrets from anon, authenticated;
insert into app_secrets (name, value)
  values ('phone_enc_key', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (name) do nothing;

-- 암호문 컬럼
alter table students add column if not exists phone_enc bytea;

-- phone 기록 시 자동 암호화 (insert / update of phone)
create or replace function _encrypt_phone()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.phone is not null and new.phone <> '' then
    new.phone_enc := extensions.pgp_sym_encrypt(new.phone, (select value from app_secrets where name = 'phone_enc_key'));
  end if;
  return new;
end $$;

drop trigger if exists trg_encrypt_phone on students;
create trigger trg_encrypt_phone
  before insert or update of phone on students
  for each row execute function _encrypt_phone();

-- 기존 평문 백필
update students
  set phone_enc = extensions.pgp_sym_encrypt(phone, (select value from app_secrets where name = 'phone_enc_key'))
  where phone is not null and phone <> '' and phone_enc is null;

-- 복호화 RPC: 담당 교수(is_professor) 또는 본인만 원문 반환, 그 외는 NULL
create or replace function get_student_phones(p_ids uuid[])
returns table(id uuid, phone text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
  select s.id,
         case when (is_professor() or s.id = auth.uid())
              then extensions.pgp_sym_decrypt(s.phone_enc, (select value from app_secrets where name = 'phone_enc_key'))
              else null end
  from students s
  where s.id = any (p_ids) and s.phone_enc is not null;
end $$;

grant execute on function get_student_phones(uuid[]) to authenticated;
