-- ===================================================================
-- 025: 4번째 평가항목(가변 라벨) 추가 — 가중치 4개: 중간/기말/출석/[토론]
-- 이번 학기는 '토론'(기본 10점)이지만, 다음 학기엔 '참여/숙제'로 라벨만 바꿔 재사용.
--   → 항목명을 courses.extra_label 로 두어 학기마다 마이그레이션 없이 변경.
-- - enrollments.extra        : 4번째 항목 점수(0~100). 이번 학기 기본 10점(기존 행 백필 + 신규 기본).
-- - courses.extra_weight     : 4번째 항목 가중치(0~100, 기본 0 → 가중치 화면에서 설정).
-- - courses.extra_label      : 4번째 항목 표시명(기본 '토론' → 다음 학기 '참여' 등).
-- - 가중치 합 제약을 4개 합=100 으로 교체.
-- - get_course_stats(008) RPC를 4개 가중치 기준으로 갱신.
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================

-- 1. enrollments: 4번째 항목 점수 (기본 10 → 기존 행도 10으로 백필됨)
alter table enrollments
  add column if not exists extra numeric(5,2) default 10
    check (extra is null or (extra between 0 and 100));

-- 2. courses: 4번째 항목 가중치 + 표시명
alter table courses
  add column if not exists extra_weight numeric(5,2) not null default 0
    check (extra_weight between 0 and 100);
alter table courses
  add column if not exists extra_label text not null default '토론';

-- 3. 가중치 합 제약: 4개 합 = 100 으로 교체
alter table courses drop constraint if exists courses_weight_sum;
alter table courses add constraint courses_weight_sum
  check (midterm_weight + final_weight + attendance_weight + extra_weight = 100);

-- 4. 반 통계 RPC: 4번째 항목 반영(가중치>0일 때만 점수 필수)
create or replace function get_course_stats(cid uuid)
returns table(avg_score numeric, max_score numeric, total_count bigint)
language sql security definer stable as $$
  with w as (
    select midterm_weight as mw, final_weight as fw,
           attendance_weight as aw, extra_weight as xw
    from courses where id = cid
  ),
  finals as (
    select (e.midterm * w.mw + e.final * w.fw + e.attendance * w.aw
            + coalesce(e.extra, 0) * w.xw) / 100.0 as fs
    from enrollments e cross join w
    where e.course_id = cid
      and e.midterm is not null and e.final is not null and e.attendance is not null
      and (w.xw = 0 or e.extra is not null)
  )
  select
    round(avg(fs)::numeric, 2) as avg_score,
    round(max(fs)::numeric, 2) as max_score,
    count(*)::bigint           as total_count
  from finals;
$$;
grant execute on function get_course_stats(uuid) to authenticated;
