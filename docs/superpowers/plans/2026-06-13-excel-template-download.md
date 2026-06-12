# Score-Upload Excel Template Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "표준 양식 다운로드 (.xlsx)" button to the score-upload modal (중간·기말·출석) that downloads an Excel template pre-filled with every enrolled student's 학번 and 이름, score column blank.

**Architecture:** A new pure helper builds the row matrix; a thin sibling triggers the browser download via SheetJS. `AdminPage` passes its already-loaded `students` array into `ExcelUploadModal`, which renders the button only in score mode.

**Tech Stack:** React 18 + TypeScript, `xlsx` (SheetJS, already a dependency), Vite.

> **Testing note:** This project has no test runner and the approved spec
> (`docs/superpowers/specs/2026-06-13-excel-template-download-design.md`)
> deliberately excludes adding one. Verification steps therefore use
> `npx tsc --noEmit`, `npm run build`, and a manual round-trip check instead of
> automated test runs. Keep the row-builder pure so a unit test can be added
> later if desired.

---

## File Structure

- **Create** `src/lib/excelTemplate.ts` — `buildScoreTemplateRows` (pure) + `downloadScoreTemplate` (side effect).
- **Modify** `src/components/ExcelUploadModal.tsx` — add required `students` prop; render the download button in score mode.
- **Modify** `src/pages/AdminPage.tsx` — pass `students={students}` to `<ExcelUploadModal>`.

Tasks 1 then 2 must land in order: the `students` prop is required, so the modal edit and the AdminPage edit ship together in Task 2 to keep `tsc` green at the commit boundary.

---

### Task 1: Create the Excel template module

**Files:**
- Create: `src/lib/excelTemplate.ts`

- [ ] **Step 1: Write the module**

```ts
import * as XLSX from 'xlsx'
import { SCORE_LABEL, type ScoreField, type Student } from './supabase'

type TemplateStudent = Pick<Student, 'student_number' | 'name'>

// 헤더 + 학생 행을 2차원 배열로 반환. 점수 칸은 빈 문자열.
// 예: [['학번','이름','기말'], ['20240001','홍길동',''], ...]
export function buildScoreTemplateRows(
  field: ScoreField,
  students: TemplateStudent[],
): string[][] {
  const header = ['학번', '이름', SCORE_LABEL[field]]
  const rows = students.map((s) => [s.student_number, s.name, ''])
  return [header, ...rows]
}

// 워크북 생성 후 브라우저 다운로드 트리거. 파일명 예: '기말_점수_양식.xlsx'
export function downloadScoreTemplate(
  field: ScoreField,
  students: TemplateStudent[],
): void {
  const rows = buildScoreTemplateRows(field, students)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SCORE_LABEL[field])
  XLSX.writeFile(wb, `${SCORE_LABEL[field]}_점수_양식.xlsx`)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/excelTemplate.ts
git commit -m "feat: add score-upload Excel template builder"
```

---

### Task 2: Render the download button and wire the students prop

**Files:**
- Modify: `src/components/ExcelUploadModal.tsx`
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Import `Download` icon and the template helper in `ExcelUploadModal.tsx`**

Change the lucide-react import line (currently):
```ts
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
```
to:
```ts
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react'
```

Add the helper + `Student` type to the existing `../lib/supabase` import. The import block becomes:
```ts
import {
  supabase,
  supabaseSignup,
  studentNumberToEmail,
  SCORE_LABEL,
  type ScoreField,
  type Student,
} from '../lib/supabase'
import { downloadScoreTemplate } from '../lib/excelTemplate'
```

- [ ] **Step 2: Add the `students` prop to `Props` and the component signature**

Change the `type Props` block to add `students`:
```ts
type Props = {
  open: boolean
  mode: ExcelMode
  onClose: () => void
  onDone: () => void
  students: Pick<Student, 'student_number' | 'name'>[]
}
```

Change the component signature:
```ts
export default function ExcelUploadModal({ open, mode, onClose, onDone, students }: Props) {
```

- [ ] **Step 3: Render the download button (score mode only) under the dropzone**

In the `{totalRows === 0 && (` block, immediately after the closing `</label>` of the file dropzone and before `{parseError && (`, insert:
```tsx
              {mode.kind === 'score' && (
                <button
                  type="button"
                  onClick={() => downloadScoreTemplate(mode.field, students)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Download size={16} />
                  표준 양식 다운로드 (.xlsx) — 재학생 {students.length}명 자동 채움
                </button>
              )}
```

- [ ] **Step 4: Pass `students` from `AdminPage.tsx`**

In the `{excelMode && (` block, add the `students` prop:
```tsx
        <ExcelUploadModal
          open={!!excelMode}
          mode={excelMode}
          onClose={() => setExcelMode(null)}
          onDone={loadStudents}
          students={students}
        />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (exit 0). If it reports `students` missing on `<ExcelUploadModal>`, Step 4 was skipped.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds (tsc + vite build, exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/components/ExcelUploadModal.tsx src/pages/AdminPage.tsx
git commit -m "feat: download pre-filled Excel template in score upload modal"
```

---

### Task 3: Manual end-to-end verification

No code changes — confirm real behavior. Requires a professor login (e.g., `prof001`) and at least one enrolled student.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the printed Local URL, e.g. `http://localhost:5173`).

- [ ] **Step 2: Open the score-upload modal**

Log in as professor → 교수 대시보드 → click "중간 점수 업로드". Confirm the
"표준 양식 다운로드 (.xlsx) — 재학생 N명 자동 채움" button appears under the dropzone.
Repeat for 기말 and 출석. Confirm the button does NOT appear in "신규 일괄 등록".

- [ ] **Step 3: Download and inspect**

Click the button in the 기말 modal. Open `기말_점수_양식.xlsx`. Expected:
header row `학번 | 이름 | 기말`; one row per enrolled student with 학번 and 이름
filled and the 기말 cell empty.

- [ ] **Step 4: Round-trip**

Enter a score in the 기말 column for one student, save, and re-upload via the same
modal. Expected: that student's 기말 updates; the `이름` column is ignored; rows
left blank report "점수가 비어있습니다" and are skipped (existing scores untouched).

---

## Self-Review

**Spec coverage:**
- Pre-filled (학번+이름, blank score) template → Task 1 `buildScoreTemplateRows`. ✓
- All three score types, not register → Task 2 Step 3 (`mode.kind === 'score'`). ✓
- Reuse AdminPage's loaded students → Task 2 Step 4. ✓
- Round-trip / parser ignores 이름 → Task 3 Step 4. ✓
- Edge case: 0 students → header-only sheet (builder returns just the header row). ✓
- Verification via tsc/build/manual (no test framework) → testing note + Task 3. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. ✓

**Type consistency:** `buildScoreTemplateRows(field, students)` / `downloadScoreTemplate(field, students)` signatures match between Task 1 and the call site in Task 2 Step 3. `students` prop type `Pick<Student,'student_number'|'name'>[]` is satisfied by AdminPage's `Student[]`. `ScoreField`/`SCORE_LABEL`/`Student` all already exist in `src/lib/supabase.ts`. ✓
