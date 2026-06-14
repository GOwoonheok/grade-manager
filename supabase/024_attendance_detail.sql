-- ===================================================================
-- 024: 출석 세부(출석/지각/결석 횟수) + 지각→결석 환산 기준
-- 출결 엑셀 업로드 시 횟수를 저장하고, 환산 규칙으로 출석 점수(attendance)를 자동 계산.
-- 실행: Supabase SQL Editor. 재실행 안전.
-- ===================================================================

-- 1. enrollments: 출석/지각/결석 '횟수' 컬럼 (점수는 기존 attendance 컬럼에 자동 계산 저장)
alter table enrollments add column if not exists att_present int check (att_present is null or att_present >= 0);
alter table enrollments add column if not exists att_late    int check (att_late    is null or att_late    >= 0);
alter table enrollments add column if not exists att_absent  int check (att_absent  is null or att_absent  >= 0);

-- 2. courses: 지각 몇 회를 결석 1회로 환산할지(제어 가능). 기본 3회.
alter table courses add column if not exists late_per_absent int not null default 3 check (late_per_absent >= 1);
