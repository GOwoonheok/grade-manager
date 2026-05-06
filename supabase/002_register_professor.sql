-- ===================================================================
-- 교수 계정 등록 (1단계: Supabase Dashboard > Authentication > Users 에서
-- "Add user" 클릭하여 email/password로 사용자 생성 후, 여기서 그 UUID를 사용)
--
-- 이메일 규칙: {학번}@grade.local  (예: PROF001@grade.local)
-- 학번에는 영문도 가능 - 교수는 PROF001 같은 식별자를 추천
-- ===================================================================

-- 아래 값들을 본인 정보로 수정한 뒤 실행하세요:
INSERT INTO students (id, student_number, name, department, phone, role)
VALUES (
  '여기에_AUTH_사용자_UUID_붙여넣기',  -- Authentication > Users에서 복사
  'PROF001',                          -- 교수의 학번/식별자
  '교수님 이름',
  '컴퓨터공학과',
  '010-0000-0000',
  'professor'
);
