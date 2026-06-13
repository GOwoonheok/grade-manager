# Answer-Sheet Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the professor upload per-student midterm/final answer-sheet photos (multiple per exam) and let each student view only their own alongside their grades.

**Architecture:** Photos live in a private Supabase Storage bucket `answer-sheets` at `{studentId}/{examType}/{uuid}.jpg`; an `answer_sheets` table records (student_id, exam_type, path). RLS on both the table and `storage.objects` restricts students to their own folder and gives professors full access. A single `AnswerSheetGallery` component (with a `readOnly` flag) handles both the professor's upload UI (in the edit modal) and the student's view.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + Storage + RLS), Vite. Image downscale via the browser Canvas API (no new dependency).

> **Testing note:** This project has no test runner and the approved spec
> (`docs/superpowers/specs/2026-06-13-answer-sheet-photos-design.md`) excludes
> adding one. Verification uses `npx tsc --noEmit`, `npm run build`, and a guided
> manual check. **Task 7 (live verification) requires the `005` migration to be
> run in the Supabase SQL Editor first** — the implementer cannot run it (only the
> public anon key is available locally).

---

## File Structure

- **Create** `supabase/005_answer_sheets.sql` — bucket + `answer_sheets` table + RLS (run by the project owner in Supabase).
- **Modify** `src/lib/supabase.ts` — add `ExamType` and `AnswerSheet` types.
- **Create** `src/lib/answerSheets.ts` — storage/table helpers (list, upload, delete, per-student cleanup, signed URL, resize).
- **Create** `src/components/AnswerSheetGallery.tsx` — one exam's thumbnails; `readOnly` toggles upload/delete vs view-only.
- **Modify** `src/components/StudentFormModal.tsx` — render two galleries (midterm/final) in edit mode.
- **Modify** `src/pages/StudentPage.tsx` — render the student's own galleries (read-only).
- **Modify** `src/pages/AdminPage.tsx` — remove a student's storage objects on delete.

Order matters: Task 2 (types) and Task 3 (helpers) precede the components that import them, keeping `tsc` green at every commit.

---

### Task 1: Storage + table migration

**Files:**
- Create: `supabase/005_answer_sheets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ===================================================================
-- 005: 답안지 사진 (중간·기말) — Supabase Storage + answer_sheets 테이블
-- 실행 위치: Supabase Dashboard > SQL Editor > New query
-- 재실행 안전 (idempotent)
-- ===================================================================

-- 1. answer_sheets 테이블
create table if not exists answer_sheets (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  exam_type   text not null check (exam_type in ('midterm','final')),
  path        text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_answer_sheets_student
  on answer_sheets(student_id, exam_type);

-- 2. answer_sheets RLS
alter table answer_sheets enable row level security;

drop policy if exists "as_read_self_or_prof" on answer_sheets;
create policy "as_read_self_or_prof" on answer_sheets
  for select to authenticated
  using (student_id = auth.uid() or is_professor());

drop policy if exists "as_prof_insert" on answer_sheets;
create policy "as_prof_insert" on answer_sheets
  for insert to authenticated with check (is_professor());

drop policy if exists "as_prof_update" on answer_sheets;
create policy "as_prof_update" on answer_sheets
  for update to authenticated using (is_professor()) with check (is_professor());

drop policy if exists "as_prof_delete" on answer_sheets;
create policy "as_prof_delete" on answer_sheets
  for delete to authenticated using (is_professor());

-- 3. Storage 비공개 버킷
insert into storage.buckets (id, name, public)
values ('answer-sheets', 'answer-sheets', false)
on conflict (id) do nothing;

-- 4. Storage 객체 RLS (버킷 한정)
drop policy if exists "as_obj_read_self" on storage.objects;
create policy "as_obj_read_self" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "as_obj_read_prof" on storage.objects;
create policy "as_obj_read_prof" on storage.objects
  for select to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_insert_prof" on storage.objects;
create policy "as_obj_insert_prof" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_update_prof" on storage.objects;
create policy "as_obj_update_prof" on storage.objects
  for update to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());

drop policy if exists "as_obj_delete_prof" on storage.objects;
create policy "as_obj_delete_prof" on storage.objects
  for delete to authenticated
  using (bucket_id = 'answer-sheets' and is_professor());
```

- [ ] **Step 2: Commit** (SQL only; the owner runs it in Supabase later — Task 7)

```bash
git add supabase/005_answer_sheets.sql
git commit -m "feat(db): answer_sheets table + storage bucket and RLS (005)"
```

---

### Task 2: Add types

**Files:**
- Modify: `src/lib/supabase.ts` (append at end)

- [ ] **Step 1: Append the types**

After the `calcFinalScore` function (file end), add:
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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add ExamType and AnswerSheet types"
```

---

### Task 3: Answer-sheet helpers

**Files:**
- Create: `src/lib/answerSheets.ts`

- [ ] **Step 1: Write the module**

```ts
import { supabase, type AnswerSheet, type ExamType } from './supabase'

const BUCKET = 'answer-sheets'

// 학생/시험별 답안지 행 목록 (RLS가 접근 범위 통제). 업로드 순.
export async function listAnswerSheets(
  studentId: string,
  examType?: ExamType,
): Promise<AnswerSheet[]> {
  let q = supabase
    .from('answer_sheets')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
  if (examType) q = q.eq('exam_type', examType)
  const { data, error } = await q
  if (error) throw error
  return (data as AnswerSheet[]) ?? []
}

// 보기용 signed URL (수명 3600초)
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (error || !data) throw error ?? new Error('signed URL 생성 실패')
  return data.signedUrl
}

// 업로드 전 클라이언트 축소 (최대 변 1600px, JPEG 0.85). jpg/png/webp만 디코드 가능.
export async function resizeImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () =>
      reject(new Error('이미지를 읽을 수 없습니다 (지원 형식: jpg/png/webp)'))
    i.src = dataUrl
  })
  const MAX = 1600
  let { width, height } = img
  if (width > MAX || height > MAX) {
    const scale = Math.min(MAX / width, MAX / height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 컨텍스트를 만들 수 없습니다')
  ctx.drawImage(img, 0, 0, width, height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환 실패'))),
      'image/jpeg',
      0.85,
    )
  })
}

// 업로드: 축소 → 객체 저장 → answer_sheets 행 insert → 행 반환 (교수만 RLS 통과)
export async function uploadAnswerSheet(
  studentId: string,
  examType: ExamType,
  file: File,
): Promise<AnswerSheet> {
  const blob = await resizeImage(file)
  const path = `${studentId}/${examType}/${crypto.randomUUID()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('answer_sheets')
    .insert({ student_id: studentId, exam_type: examType, path })
    .select('*')
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]) // 행 실패 시 객체 정리
    throw error
  }
  return data as AnswerSheet
}

// 삭제: storage 객체 remove → answer_sheets 행 delete
export async function deleteAnswerSheet(sheet: AnswerSheet): Promise<void> {
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([sheet.path])
  if (rmErr) throw rmErr
  const { error } = await supabase.from('answer_sheets').delete().eq('id', sheet.id)
  if (error) throw error
}

// 학생 삭제 시 정리: 해당 학생의 모든 답안지 객체 remove.
// 행은 학생 삭제 시 FK cascade로 지워지므로, 이 함수는 학생 행 삭제 "전"에 호출한다.
export async function deleteAnswerSheetsForStudent(studentId: string): Promise<void> {
  const sheets = await listAnswerSheets(studentId)
  if (sheets.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(sheets.map((s) => s.path))
  if (error) throw error
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/answerSheets.ts
git commit -m "feat: answer-sheet storage helpers (upload/list/delete/resize)"
```

---

### Task 4: AnswerSheetGallery + wire into the edit modal

**Files:**
- Create: `src/components/AnswerSheetGallery.tsx`
- Modify: `src/components/StudentFormModal.tsx`

- [ ] **Step 1: Create `AnswerSheetGallery.tsx`**

```tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import {
  listAnswerSheets,
  signedUrl,
  uploadAnswerSheet,
  deleteAnswerSheet,
} from '../lib/answerSheets'
import { SCORE_LABEL, type AnswerSheet, type ExamType } from '../lib/supabase'

type Thumb = { sheet: AnswerSheet; url: string }

export default function AnswerSheetGallery({
  studentId,
  examType,
  readOnly = false,
}: {
  studentId: string
  examType: ExamType
  readOnly?: boolean
}) {
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const sheets = await listAnswerSheets(studentId, examType)
      const withUrls = await Promise.all(
        sheets.map(async (s) => ({ sheet: s, url: await signedUrl(s.path) })),
      )
      setThumbs(withUrls)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, examType])

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const f of files) await uploadAnswerSheet(studentId, examType, f)
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDelete = async (t: Thumb) => {
    setBusy(true)
    setError(null)
    try {
      await deleteAnswerSheet(t.sheet)
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {SCORE_LABEL[examType]} 답안지
        </span>
        {!readOnly && (
          <label className="cursor-pointer inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            <Plus size={16} />
            사진 추가
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onPick}
              disabled={busy}
              className="hidden"
            />
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">불러오는 중...</p>
      ) : thumbs.length === 0 ? (
        <p className="text-xs text-gray-400">등록된 답안지가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {thumbs.map((t) =>
            readOnly ? (
              <a
                key={t.sheet.id}
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={t.url}
                  alt="답안지"
                  className="w-24 h-24 object-cover rounded-lg border hover:opacity-90"
                />
              </a>
            ) : (
              <div key={t.sheet.id} className="relative">
                <img
                  src={t.url}
                  alt="답안지"
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => onDelete(t)}
                  disabled={busy}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 shadow disabled:opacity-50"
                  title="삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {busy && (
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" /> 처리 중...
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Import the gallery in `StudentFormModal.tsx`**

After the `'../lib/supabase'` import block, add:
```ts
import AnswerSheetGallery from './AnswerSheetGallery'
```

- [ ] **Step 3: Render the galleries in edit mode**

Find the end of the score grid (the 출석 field) and insert the answer-sheet block right after the grid's closing `</div>`:

Locate:
```tsx
                value={form.attendance}
                onChange={(e) => upd('attendance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
          </div>
```
Replace with (same block, plus the inserted section):
```tsx
                value={form.attendance}
                onChange={(e) => upd('attendance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="-"
              />
            </Field>
          </div>

          {isEdit && initial && (
            <div className="space-y-4 pt-2 border-t">
              <AnswerSheetGallery studentId={initial.id} examType="midterm" />
              <AnswerSheetGallery studentId={initial.id} examType="final" />
            </div>
          )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components/AnswerSheetGallery.tsx src/components/StudentFormModal.tsx
git commit -m "feat: professor answer-sheet upload UI in student edit modal"
```

---

### Task 5: Show the student their own answer sheets

**Files:**
- Modify: `src/pages/StudentPage.tsx`

- [ ] **Step 1: Add imports**

Add `FileImage` to the lucide-react import (append to the existing named list), and add the gallery import after the `'../lib/supabase'` import:
```ts
import AnswerSheetGallery from '../components/AnswerSheetGallery'
```

- [ ] **Step 2: Render the read-only galleries**

Locate (end of the 반 통계 section, just before the password block):
```tsx
            icon={<Trophy size={18} />}
          />
        </section>

        {/* 비밀번호 변경 */}
        <PasswordChange />
```
Replace with:
```tsx
            icon={<Trophy size={18} />}
          />
        </section>

        {/* 답안지 */}
        {profile && (
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileImage className="text-indigo-600" size={18} />
              <h2 className="text-sm font-semibold text-gray-800">답안지</h2>
            </div>
            <AnswerSheetGallery studentId={profile.id} examType="midterm" readOnly />
            <AnswerSheetGallery studentId={profile.id} examType="final" readOnly />
          </section>
        )}

        {/* 비밀번호 변경 */}
        <PasswordChange />
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/StudentPage.tsx
git commit -m "feat: student views own answer sheets with grades"
```

---

### Task 6: Clean up storage objects on student delete

**Files:**
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Add the import**

After the `'../lib/supabase'` import block, add:
```ts
import { deleteAnswerSheetsForStudent } from '../lib/answerSheets'
```

- [ ] **Step 2: Remove the student's objects before deleting the row**

Locate:
```tsx
  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    const { error: e } = await supabase
```
Replace with:
```tsx
  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteAnswerSheetsForStudent(deleting.id)
    } catch (err) {
      // 답안지 객체 정리 실패는 치명적이지 않음 — 로그만 남기고 학생 삭제 진행
      console.error('답안지 정리 실패:', err)
    }
    const { error: e } = await supabase
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: remove student's answer-sheet objects on delete"
```

---

### Task 7: Run migration + manual verification

Requires the project owner to run the migration; the implementer guides this.

- [ ] **Step 1: Run the migration in Supabase**

Open `https://supabase.com/dashboard/project/rkyhdnqklkdcjxlbayyu/sql/new`, paste the entire contents of `supabase/005_answer_sheets.sql`, and Run. Expected: "Success". Confirm under Storage that a private bucket `answer-sheets` exists, and under Table Editor that `answer_sheets` exists.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (note the Local URL).

- [ ] **Step 3: Professor upload**

Log in as professor → 학생 추가/수정 → open an existing student's edit modal → under "중간 답안지"/"기말 답안지" click "사진 추가", pick 1–2 jpg/png images. Expected: thumbnails appear; the trash button removes one.

- [ ] **Step 4: Student view**

Log in as that student → bottom "답안지" section shows the uploaded midterm/final thumbnails; clicking opens the full image in a new tab.

- [ ] **Step 5: Isolation check (security)**

While logged in as a student, confirm only their own sheets load (the page calls `listAnswerSheets(profile.id)`; RLS blocks others). Optionally, as a second student with no uploads, confirm the section shows "등록된 답안지가 없습니다."

---

## Self-Review

**Spec coverage:**
- Private bucket + path convention → Task 1 (bucket), Task 3 (`uploadAnswerSheet` path). ✓
- `answer_sheets` table (multiple per exam) → Task 1. ✓
- Table RLS + storage RLS (student own / professor all) → Task 1. ✓
- Helpers (list/upload/delete/per-student cleanup/signedUrl/resize) → Task 3. ✓
- Professor upload UI in edit modal, multiple photos, thumbnail+delete → Task 4. ✓
- Edit-mode-only (new student needs id first) → Task 4 Step 3 (`isEdit && initial`). ✓
- Student display, own only, click-to-open → Task 5. ✓
- jpg/png/webp + client downscale; HEIC excluded → Task 3 `resizeImage`, Task 4 `accept`. ✓
- Orphan cleanup on student delete → Task 6. ✓
- Verification via migration + manual → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:**
- `ExamType`/`AnswerSheet` defined in Task 2, used identically in Task 3/4/5. ✓
- Helper names match call sites: `listAnswerSheets`, `signedUrl`, `uploadAnswerSheet`, `deleteAnswerSheet` (Task 3 → Task 4), `deleteAnswerSheetsForStudent` (Task 3 → Task 6). ✓
- `SCORE_LABEL[examType]` valid: `ExamType` ('midterm'|'final') ⊂ `ScoreField` keys. ✓
- `initial.id` is `string` (from `Student`); passed as `studentId`. ✓
- `profile.id` (StudentPage) is `Student.id` string; guarded by `profile &&`. ✓
