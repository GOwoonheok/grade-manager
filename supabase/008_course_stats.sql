-- ===================================================================
-- 008: 과목별 반 통계 RPC (P3) — 과목 가중치 기준 최종점수 평균/최고/인원
-- 학생도 호출 가능(SECURITY DEFINER)하되 집계값만 반환(개인 점수 비노출).
-- 실행: Supabase Dashboard > SQL Editor. 재실행 안전.
-- ===================================================================
create or replace function get_course_stats(cid uuid)
returns table(avg_score numeric, max_score numeric, total_count bigint)
language sql security definer stable as $$
  with w as (
    select midterm_weight as mw, final_weight as fw, attendance_weight as aw
    from courses where id = cid
  ),
  finals as (
    select (e.midterm * w.mw + e.final * w.fw + e.attendance * w.aw) / 100.0 as fs
    from enrollments e cross join w
    where e.course_id = cid
      and e.midterm is not null and e.final is not null and e.attendance is not null
  )
  select
    round(avg(fs)::numeric, 2) as avg_score,
    round(max(fs)::numeric, 2) as max_score,
    count(*)::bigint           as total_count
  from finals;
$$;
grant execute on function get_course_stats(uuid) to authenticated;
