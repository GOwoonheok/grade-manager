# 답안지 사진 (중간·기말) 기능 — 설계

- 날짜: 2026-06-13
- 대상: 교수가 학생별로 중간·기말 답안지 사진을 등록 → 학생이 본인 성적과 함께 본인 답안지만 조회
- 상태: 설계 승인 진행 중 (데이터 모델 = 시험당 여러 장 / answer_sheets 테이블로 확정)

## 1. 배경 / 목적

학생이 자기 점수만 보는 현재 화면에, 교수가 찍어 올린 **본인의 중간·기말 답안지
사진**을 함께 보여준다. 답안지는 여러 페이지일 수 있으므로 시험당 여러 장을
지원한다. 답안지는 민감 정보이므로 **학생은 자기 것만** 접근 가능해야 한다.

## 2. 확정된 요구사항

- 교수가 **학생별로** 중간/기말 답안지 사진을 업로드 (시험당 여러 장).
- 학생 로그인 시 본인 점수 화면에서 **본인 답안지만** 조회.
- 학생은 다른 학생의 답안지에 접근 불가 (DB·스토리지 양쪽 RLS로 차단).

## 3. 저장 방식 — Supabase Storage 비공개 버킷

- 버킷 `answer-sheets` (`public = false`).
- 객체 경로: `{학생ID}/{exam_type}/{uuid}.{ext}` (예: `a1b2.../midterm/9f3c.jpg`).
  - 최상위 폴더 = 학생 ID(= `auth.uid()`) → 폴더 단위로 권한을 잠근다.
- 화면 표시는 **signed URL**(수명 약 3600초)로 `<img>`에 노출.

## 4. 데이터 모델 — `answer_sheets` 테이블 (신규)

```sql
create table if not exists answer_sheets (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  exam_type   text not null check (exam_type in ('midterm','final')),
  path        text not null,            -- storage 객체 경로
  created_at  timestamptz default now()
);
create index if not exists idx_answer_sheets_student
  on answer_sheets(student_id, exam_type);
```

- 시험당 여러 행(= 여러 장). 학생 삭제 시 행은 FK로 cascade 삭제.
- ⚠️ FK cascade는 **DB 행만** 지운다. Storage 객체는 자동 삭제되지 않음 → 5절·8절 참고.

## 5. 보안 (핵심) — RLS

### 5.1 `answer_sheets` 테이블
```sql
alter table answer_sheets enable row level security;

create policy "as_read_self_or_prof" on answer_sheets
  for select to authenticated
  using (student_id = auth.uid() or is_professor());

create policy "as_prof_insert" on answer_sheets
  for insert to authenticated with check (is_professor());
create policy "as_prof_update" on answer_sheets
  for update to authenticated using (is_professor()) with check (is_professor());
create policy "as_prof_delete" on answer_sheets
  for delete to authenticated using (is_professor());
```

### 5.2 Storage 객체 (`storage.objects`, 버킷 한정)
```sql
insert into storage.buckets (id, name, public)
values ('answer-sheets', 'answer-sheets', false)
on conflict (id) do nothing;

-- 학생: 자기 폴더(첫 경로 세그먼트 = 본인 uid) 읽기
create policy "as_obj_read_self" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- 교수: 전체 읽기
create policy "as_obj_read_prof" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());

-- 교수만 쓰기/수정/삭제
create policy "as_obj_insert_prof" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-sheets' and is_professor());
create policy "as_obj_update_prof" on storage.objects
  for update to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());
create policy "as_obj_delete_prof" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());
```

→ 학생은 `answer_sheets`에서 본인 행만 읽고, signed URL도 본인 폴더 객체에만
발급된다. 교수는 전체 읽기/쓰기.

## 6. 컴포넌트 / 인터페이스

### 6.1 신규 `src/lib/answerSheets.ts`
```ts
import { supabase, type ExamType, type AnswerSheet } from './supabase'

const BUCKET = 'answer-sheets'

// 학생/시험별 답안지 행 목록 (RLS가 접근 범위 통제)
export function listAnswerSheets(
  studentId: string, examType?: ExamType,
): Promise<AnswerSheet[]>

// 업로드: 객체 저장 → answer_sheets 행 insert → 행 반환 (교수만 RLS 통과)
export function uploadAnswerSheet(
  studentId: string, examType: ExamType, file: File,
): Promise<AnswerSheet>

// 삭제: storage 객체 remove → answer_sheets 행 delete
export function deleteAnswerSheet(sheet: AnswerSheet): Promise<void>

// 학생 삭제 시 정리: 해당 학생의 모든 답안지 객체 remove (행은 FK cascade로 삭제됨)
// 학생 행 삭제 "전"에 호출하여 경로를 확보한다.
export function deleteAnswerSheetsForStudent(studentId: string): Promise<void>

// 보기용 signed URL (수명 3600초)
export function signedUrl(path: string): Promise<string>

// 업로드 전 클라이언트 축소(최대 변 ~1600px, JPEG). jpg/png/webp만 디코드 가능.
export function resizeImage(file: File): Promise<Blob>
```
- 경로 생성: `${studentId}/${examType}/${crypto.randomUUID()}.jpg`.

### 6.2 `src/lib/supabase.ts` (타입 추가)
```ts
export type ExamType = 'midterm' | 'final'
export type AnswerSheet = {
  id: string
  student_id: string
  exam_type: ExamType
  path: string
  created_at: string
}
```

### 6.3 `src/components/StudentFormModal.tsx` (교수 업로드 UI)
- **편집 모드에서만** "중간 답안지", "기말 답안지" 섹션 표시 (신규 학생은 ID가
  생성된 뒤라야 폴더 경로를 만들 수 있으므로 저장 후 편집에서 업로드).
- 각 섹션: 기존 사진 썸네일 목록(+삭제 버튼) + 사진 추가(여러 장) 업로드.
- 업로드 시 `resizeImage` → `uploadAnswerSheet`. 썸네일은 `signedUrl`로 표시.

### 6.4 `src/pages/StudentPage.tsx` (학생 표시)
- 점수 카드 아래 **"답안지"** 섹션: 중간/기말별 썸네일(여러 장) → 클릭 시 원본
  (signed URL 새 탭). 없으면 "등록된 답안지가 없습니다".

## 7. 데이터 흐름

1. (교수) 학생 편집 모달 → 답안지 추가 → `resizeImage` → `uploadAnswerSheet`
   (객체 업로드 + 행 insert).
2. (학생) 로그인 → StudentPage가 `listAnswerSheets(본인id)` (RLS로 본인만) →
   각 행 `signedUrl(path)` → 썸네일 표시.

## 8. 엣지 케이스 / 한계

- 신규 학생: 저장 전에는 업로드 불가(편집 모드 안내).
- 허용 형식: jpg/png/webp. **HEIC(아이폰 기본)는 v1 미지원** — 카메라를
  'JPEG/호환성 우선'으로 권장. 추후 변환(heic2any 등) 추가 가능.
- 학생 삭제 시 `answer_sheets` 행은 cascade로 지워지지만 **Storage 객체는 남는다**.
  v1에서는 학생 삭제 시 해당 폴더 객체도 함께 제거(목록 후 remove)하여 고아 객체를
  방지한다. (AdminPage 삭제 흐름에 정리 로직 포함.)
- signed URL 만료: 페이지 로드/열람 시점에 발급(3600초).

## 9. 검증

테스트 러너 없음 → tsc + build + 수동:
- 교수로 한 학생에 중간/기말 사진 여러 장 업로드 → 썸네일·삭제 확인.
- 그 학생으로 로그인 → 본인 답안지만 보임.
- **다른 학생 계정/직접 경로로 타인 답안지 접근 차단(RLS) 확인.**

## 10. 범위 외 (YAGNI)

- HEIC 자동 변환.
- 답안지 코멘트/주석, 정답(모범답안) 공유 기능.
- 사진 순서 수동 정렬(업로드 시각순으로 충분).
