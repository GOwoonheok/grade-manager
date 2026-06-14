-- ===================================================================
-- 023: 백그라운드 임베딩 작업자 — 전역 단일 실행 잠금(lease)
-- /api/embed-run 이 클릭 1회로 시작 → waitUntil 로 배치를 스스로 이어서 처리(self-chain).
-- 무료 임베딩 분당 한도 보호를 위해 "동시에 1개 체인만" 돌도록 전역 잠금을 둔다.
-- 체인이 중단되면 lease 가 만료되어 '이어서 진행' 클릭으로 재개 가능.
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================

create table if not exists embed_worker (
  id          int primary key default 1,
  lease_until timestamptz not null default now(),
  constraint embed_worker_singleton check (id = 1)
);
insert into embed_worker (id) values (1) on conflict (id) do nothing;

-- 직접 접근 차단(아래 SECURITY DEFINER RPC 로만 조작)
alter table embed_worker enable row level security;

-- 잠금 획득: 현재 lease 가 만료(<= now())된 경우에만 p_seconds 동안 점유하고 true 반환.
create or replace function embed_lease_acquire(p_seconds int)
  returns boolean
  language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update embed_worker
     set lease_until = now() + make_interval(secs => greatest(p_seconds, 1))
   where id = 1 and lease_until <= now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 잠금 해제: 즉시 만료시켜 다음 체인이 획득 가능하게 함.
create or replace function embed_lease_release()
  returns void
  language sql security definer set search_path = public as $$
  update embed_worker set lease_until = now() where id = 1;
$$;

grant execute on function embed_lease_acquire(int) to authenticated;
grant execute on function embed_lease_release() to authenticated;
