-- 상대평가 등급 비율 (과목별). A/B/C 퍼센트.
-- C는 화면에서 "나머지"로 계산되지만, 입력값도 함께 보관한다.
alter table courses
  add column if not exists grade_a_ratio numeric not null default 30,
  add column if not exists grade_b_ratio numeric not null default 40,
  add column if not exists grade_c_ratio numeric not null default 30;

alter table courses
  add column if not exists scores_published boolean not null default false;
