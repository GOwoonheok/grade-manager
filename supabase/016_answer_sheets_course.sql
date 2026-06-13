-- ===================================================================
-- 016: 답안지(answer_sheets) 과목 단위로 전환
-- 005에서 answer_sheets는 (student_id, exam_type)만 있어, 한 사람이 여러 과목을
-- 수강하면 한 과목에 올린 이미지가 다른 과목 명단·수정창에도 표시됨.
-- → course_id 추가 + 조회/RLS를 과목 단위로 변경. 재실행 안전(idempotent).
-- 실행: Supabase Dashboard > SQL Editor.
-- ===================================================================

-- 1. course_id 컬럼 (과목 삭제 시 답안지도 함께 삭제)
alter table answer_sheets
  add column if not exists course_id uuid references courses(id) on delete cascade;

create index if not exists idx_answer_sheets_course
  on answer_sheets(course_id, student_id, exam_type);

-- 2. 기존 행 backfill: 수강 과목이 '정확히 1개'인 학생은 그 과목으로 자동 지정.
--    여러 과목 수강자(예: 0001)는 어느 과목인지 알 수 없어 NULL로 남김(→ 3번 수동 지정).
update answer_sheets a
set course_id = e.course_id
from enrollments e
where a.course_id is null
  and e.student_id = a.student_id
  and (select count(*) from enrollments e2 where e2.student_id = a.student_id) = 1;

-- 3. (수동) 여러 과목 수강자의 기존 답안지를 올바른 과목으로 지정.
--    먼저 과목 id 확인:  select id, year, semester, subject_name from courses;
--    예) 학번 0001의 기존 답안지를 '테스트 강의' 과목으로 (실제 과목명으로 수정):
-- update answer_sheets
--   set course_id = (select id from courses where subject_name = '테스트 강의' limit 1)
--   where course_id is null
--     and student_id = (select id from students where student_number = '0001');

-- 4. RLS 교체: 과목 단위(담당 교수 / 해당 과목 수강 본인). owns_course·is_enrolled는 007에서 정의.
drop policy if exists "as_read_self_or_prof" on answer_sheets;
drop policy if exists "as_prof_insert"       on answer_sheets;
drop policy if exists "as_prof_update"       on answer_sheets;
drop policy if exists "as_prof_delete"       on answer_sheets;

drop policy if exists "as_read_course"   on answer_sheets;
drop policy if exists "as_insert_course" on answer_sheets;
drop policy if exists "as_update_course" on answer_sheets;
drop policy if exists "as_delete_course" on answer_sheets;

create policy "as_read_course" on answer_sheets
  for select to authenticated
  using ((student_id = auth.uid() and is_enrolled(course_id)) or owns_course(course_id));

create policy "as_insert_course" on answer_sheets
  for insert to authenticated
  with check (owns_course(course_id));

create policy "as_update_course" on answer_sheets
  for update to authenticated
  using (owns_course(course_id)) with check (owns_course(course_id));

create policy "as_delete_course" on answer_sheets
  for delete to authenticated
  using (owns_course(course_id));
