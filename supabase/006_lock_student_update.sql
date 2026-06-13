-- ===================================================================
-- 006: 보안 수정 — 학생의 students 행 자기수정 차단 (권한상승/성적조작 방지)
-- 문제: 001 "professor_update_all_or_self" 가 USING 에 (id = auth.uid()) 를 허용하고
--       WITH CHECK 가 없어, 학생이 자기 행을 UPDATE 가능했음:
--         - midterm/final/attendance 자기 성적 조작
--         - role='professor' 로 권한 상승 → is_professor()=true → 전체 데이터 접근
-- 조치: UPDATE 를 교수 전용으로 제한. 학생은 students 행을 쓸 일이 없음
--       (비밀번호 변경은 auth.updateUser → auth.users 에서 처리).
-- 실행: Supabase Dashboard > SQL Editor. 재실행 안전.
-- ===================================================================

drop policy if exists "professor_update_all_or_self" on students;
drop policy if exists "professor_update_only" on students;
create policy "professor_update_only" on students
  for update to authenticated
  using (is_professor())
  with check (is_professor());
