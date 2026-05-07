-- ===================================================================
-- 003: 점수를 중간(midterm) / 기말(final) / 출석(attendance) 으로 분리
-- 가중치(class_settings) 테이블 추가
--
-- 무중단 마이그레이션 (Expand 단계):
--  - 새 컬럼/테이블은 추가만 한다
--  - 기존 score 컬럼은 그대로 유지하여 현재 배포된 코드와의 호환성 보장
--  - 신규 코드 배포 + 안정화 확인 후, 별도 마이그레이션(004)으로 score DROP 예정
--
-- 실행 위치: Supabase Dashboard > SQL Editor > New query
-- 재실행 안전 (idempotent)
-- ===================================================================

-- 1. students 테이블에 점수 컬럼 추가 (NULL 허용)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS midterm    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS final      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS attendance NUMERIC(5,2);

-- 0~100 범위 체크 (이미 존재하면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_midterm_range') THEN
    ALTER TABLE students ADD CONSTRAINT students_midterm_range
      CHECK (midterm IS NULL OR (midterm BETWEEN 0 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_final_range') THEN
    ALTER TABLE students ADD CONSTRAINT students_final_range
      CHECK (final IS NULL OR (final BETWEEN 0 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_attendance_range') THEN
    ALTER TABLE students ADD CONSTRAINT students_attendance_range
      CHECK (attendance IS NULL OR (attendance BETWEEN 0 AND 100));
  END IF;
END $$;

-- 2. 기존 score 데이터를 midterm으로 1회 백필 (이미 채워진 행은 건드리지 않음)
UPDATE students
SET midterm = score
WHERE score IS NOT NULL AND midterm IS NULL;

-- 3. 가중치 설정 테이블 (단일 row 강제)
CREATE TABLE IF NOT EXISTS class_settings (
  id                  INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  midterm_weight      NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (midterm_weight    BETWEEN 0 AND 100),
  final_weight        NUMERIC(5,2) NOT NULL DEFAULT 40 CHECK (final_weight      BETWEEN 0 AND 100),
  attendance_weight   NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (attendance_weight BETWEEN 0 AND 100),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT class_settings_sum_100
    CHECK (midterm_weight + final_weight + attendance_weight = 100)
);

-- 기본 row 보장
INSERT INTO class_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 4. RLS: 모든 인증 사용자 읽기, 교수만 UPDATE
ALTER TABLE class_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_settings" ON class_settings;
CREATE POLICY "anyone_read_settings"
  ON class_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "professor_update_settings" ON class_settings;
CREATE POLICY "professor_update_settings"
  ON class_settings FOR UPDATE
  TO authenticated
  USING (is_professor())
  WITH CHECK (is_professor());

-- 5. 반 통계 함수 갱신 — 최종점수 기준으로 평균/최고점 산출
-- 최종점수 = (midterm*mw + final*fw + attendance*aw) / 100
-- 셋 다 입력된 학생만 집계 (부분 입력 학생은 통계에서 제외)
CREATE OR REPLACE FUNCTION get_class_stats()
RETURNS TABLE(avg_score NUMERIC, max_score NUMERIC, total_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  WITH w AS (
    SELECT midterm_weight AS mw, final_weight AS fw, attendance_weight AS aw
    FROM class_settings WHERE id = 1
  ),
  finals AS (
    SELECT
      (s.midterm * w.mw + s.final * w.fw + s.attendance * w.aw) / 100.0 AS final_score
    FROM students s CROSS JOIN w
    WHERE s.role = 'student'
      AND s.midterm    IS NOT NULL
      AND s.final      IS NOT NULL
      AND s.attendance IS NOT NULL
  )
  SELECT
    ROUND(AVG(final_score)::NUMERIC, 2) AS avg_score,
    ROUND(MAX(final_score)::NUMERIC, 2) AS max_score,
    COUNT(*)::BIGINT                    AS total_count
  FROM finals;
$$;

GRANT EXECUTE ON FUNCTION get_class_stats() TO authenticated;

-- ===================================================================
-- 다음 단계 안내 (지금 실행하지 말 것):
-- 신규 코드 배포 후 1~2주 안정화 확인되면 별도 파일(004_drop_legacy_score.sql)로:
--   ALTER TABLE students DROP COLUMN score;
-- 를 수행한다. 지금은 score 컬럼을 남겨 무중단 운영을 보장한다.
-- ===================================================================
