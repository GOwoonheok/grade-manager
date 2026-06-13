-- ===================================================================
-- 007: 다과목·연도 성적관리 — P1 스키마 (Expand 단계)
-- 사람+수강등록 분리 / 다중 교수(과목별 소유) / 공용 디렉터리 없음(각 교수 자기 과목).
-- 새 테이블만 추가하고 기존 students/class_settings/앱은 그대로 둠(무중단).
-- 기존 단일 과목(2026·2학기·전자조달시스템의 이해) 데이터를 새 모델로 1회 이전.
-- 실행: Supabase Dashboard > SQL Editor. 재실행 안전(idempotent).
-- 사람(person) = 기존 students 행을 그대로 재사용(별도 profiles 테이블 안 만듦).
-- ===================================================================

-- 1. courses (과목 개설: 연도·학기·과목명·가중치, 담당 교수 소유)
create table if not exists courses (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references students(id) on delete cascade,  -- 담당 교수
  year              int  not null,
  semester          int  not null check (semester in (1, 2)),
  subject_name      text not null,
  midterm_weight    numeric(5,2) not null default 30 check (midterm_weight    between 0 and 100),
  final_weight      numeric(5,2) not null default 40 check (final_weight      between 0 and 100),
  attendance_weight numeric(5,2) not null default 30 check (attendance_weight between 0 and 100),
  created_at        timestamptz default now(),
  constraint courses_weight_sum check (midterm_weight + final_weight + attendance_weight = 100),
  unique (owner_id, year, semester, subject_name)
);
create index if not exists idx_courses_owner on courses(owner_id);

-- 2. enrollments (수강등록: 과목×학생, 점수는 여기)
create table if not exists enrollments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id)  on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  midterm     numeric(5,2) check (midterm    is null or midterm    between 0 and 100),
  final       numeric(5,2) check (final      is null or final      between 0 and 100),
  attendance  numeric(5,2) check (attendance is null or attendance between 0 and 100),
  created_at  timestamptz default now(),
  unique (course_id, student_id)
);
create index if not exists idx_enrollments_course  on enrollments(course_id);
create index if not exists idx_enrollments_student on enrollments(student_id);

-- 3. RLS 헬퍼 (SECURITY DEFINER로 RLS 우회 → 정책 간 재귀 방지)
create or replace function owns_course(cid uuid) returns boolean
  language sql security definer stable as $$
  select exists (select 1 from courses where id = cid and owner_id = auth.uid());
$$;
create or replace function is_enrolled(cid uuid) returns boolean
  language sql security definer stable as $$
  select exists (select 1 from enrollments where course_id = cid and student_id = auth.uid());
$$;
grant execute on function owns_course(uuid)  to authenticated;
grant execute on function is_enrolled(uuid)  to authenticated;

-- 4. courses RLS: 담당 교수 또는 수강생 읽기 / 담당 교수만 쓰기
alter table courses enable row level security;
drop policy if exists courses_read   on courses;
drop policy if exists courses_insert on courses;
drop policy if exists courses_update on courses;
drop policy if exists courses_delete on courses;
create policy courses_read   on courses for select to authenticated
  using (owner_id = auth.uid() or is_enrolled(id));
create policy courses_insert on courses for insert to authenticated
  with check (is_professor() and owner_id = auth.uid());
create policy courses_update on courses for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy courses_delete on courses for delete to authenticated
  using (owner_id = auth.uid());

-- 5. enrollments RLS: 본인(학생) 또는 담당 교수 읽기 / 담당 교수만 쓰기
alter table enrollments enable row level security;
drop policy if exists enr_read   on enrollments;
drop policy if exists enr_insert on enrollments;
drop policy if exists enr_update on enrollments;
drop policy if exists enr_delete on enrollments;
create policy enr_read   on enrollments for select to authenticated
  using (student_id = auth.uid() or owns_course(course_id));
create policy enr_insert on enrollments for insert to authenticated
  with check (owns_course(course_id));
create policy enr_update on enrollments for update to authenticated
  using (owns_course(course_id)) with check (owns_course(course_id));
create policy enr_delete on enrollments for delete to authenticated
  using (owns_course(course_id));

-- 6. 기존 데이터 1회 이전 (재실행 안전)
--    교수 1명(prof) 소유로 "2026·2학기·전자조달시스템의 이해" 과목 생성 후,
--    현재 role='student' 들의 점수를 그 과목 수강등록으로 복사.
do $$
declare
  prof uuid;
  cid  uuid;
  mw numeric; fw numeric; aw numeric;
begin
  select id into prof from students where role = 'professor' order by created_at limit 1;
  if prof is null then
    raise notice '교수 계정 없음 — 이전 건너뜀';
    return;
  end if;
  select midterm_weight, final_weight, attendance_weight into mw, fw, aw
    from class_settings where id = 1;
  insert into courses (owner_id, year, semester, subject_name,
                       midterm_weight, final_weight, attendance_weight)
    values (prof, 2026, 2, '전자조달시스템의 이해',
            coalesce(mw, 30), coalesce(fw, 40), coalesce(aw, 30))
    on conflict (owner_id, year, semester, subject_name) do nothing;
  select id into cid from courses
    where owner_id = prof and year = 2026 and semester = 2
      and subject_name = '전자조달시스템의 이해';
  insert into enrollments (course_id, student_id, midterm, final, attendance)
    select cid, s.id, s.midterm, s.final, s.attendance
      from students s where s.role = 'student'
    on conflict (course_id, student_id) do nothing;
  raise notice '이전 완료: course=%, 수강생 backfill', cid;
end $$;
