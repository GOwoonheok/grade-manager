-- ===================================================================
-- 학생 성적 관리 시스템: 테이블 생성 및 보안 정책
-- 실행 위치: Supabase Dashboard > SQL Editor > New query
-- ===================================================================

-- 1. students 테이블
-- id 컬럼이 auth.users와 1:1로 연결됨 (Supabase Auth 사용자가 곧 학생/교수)
CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_number  TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  department      TEXT NOT NULL,
  phone           TEXT NOT NULL,
  score           NUMERIC(5,2),
  role            TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','professor')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);

-- 2. 헬퍼 함수: 현재 로그인 사용자가 교수인지 확인
-- SECURITY DEFINER로 RLS를 우회하여 자기 자신을 조회 (재귀 방지)
CREATE OR REPLACE FUNCTION is_professor()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
    WHERE id = auth.uid() AND role = 'professor'
  );
$$;

GRANT EXECUTE ON FUNCTION is_professor() TO authenticated;

-- 3. RLS(행 단위 보안) 활성화
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 4. 정책: 본인 행은 누구나 읽기, 교수는 모두 읽기
DROP POLICY IF EXISTS "read_self_or_professor_all" ON students;
CREATE POLICY "read_self_or_professor_all"
  ON students FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_professor());

-- 5. 정책: 교수만 INSERT 가능
DROP POLICY IF EXISTS "professor_insert" ON students;
CREATE POLICY "professor_insert"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (is_professor());

-- 6. 정책: 교수는 모두 UPDATE, 학생은 본인만 UPDATE (비밀번호 변경 등)
DROP POLICY IF EXISTS "professor_update_all_or_self" ON students;
CREATE POLICY "professor_update_all_or_self"
  ON students FOR UPDATE
  TO authenticated
  USING (is_professor() OR id = auth.uid());

-- 7. 정책: 교수만 DELETE 가능
DROP POLICY IF EXISTS "professor_delete" ON students;
CREATE POLICY "professor_delete"
  ON students FOR DELETE
  TO authenticated
  USING (is_professor());

-- 8. 반 통계 함수 (학생 화면에서 평균/최고점 표시용)
-- 개별 점수 노출 없이 집계값만 반환
CREATE OR REPLACE FUNCTION get_class_stats()
RETURNS TABLE(avg_score NUMERIC, max_score NUMERIC, total_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ROUND(AVG(score)::NUMERIC, 2) AS avg_score,
    MAX(score) AS max_score,
    COUNT(*)::BIGINT AS total_count
  FROM students
  WHERE role = 'student' AND score IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_class_stats() TO authenticated;
