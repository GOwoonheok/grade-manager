-- ===================================================================
-- 009: 개인정보 보호 — 학생 비밀번호 일괄 재설정(학번+전화 뒤4자리) + 최초 로그인 강제 변경
-- ⚠️ 학생 전원의 비밀번호가 재설정됩니다. 실행: Supabase SQL Editor.
-- (crypt/gen_salt 오류 시 extensions. 접두사: extensions.crypt / extensions.gen_salt)
-- ===================================================================

-- 1. 강제 변경 플래그 컬럼
alter table students add column if not exists must_change_password boolean not null default false;

-- 2. 학생 비밀번호 일괄 = 학번 + 전화번호 뒤 4자리 (숫자만 추출 후 뒤 4)
update auth.users u
set encrypted_password = crypt(
      s.student_number || right(regexp_replace(s.phone, '\D', '', 'g'), 4),
      gen_salt('bf')
    ),
    updated_at = now()
from students s
where u.id = s.id and s.role = 'student';

-- 3. 최초 로그인 시 강제 변경 ON
update students set must_change_password = true where role = 'student';

-- 4. 본인 플래그 해제 RPC (students UPDATE는 교수전용(006)이라 SECURITY DEFINER로)
create or replace function clear_must_change() returns void
  language sql security definer as $$
  update students set must_change_password = false where id = auth.uid();
$$;
grant execute on function clear_must_change() to authenticated;
