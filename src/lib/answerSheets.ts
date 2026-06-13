import { supabase, type AnswerSheet, type ExamType } from './supabase'

const BUCKET = 'answer-sheets'

// 학생/시험별 답안지 행 목록 (RLS가 접근 범위 통제). 업로드 순.
export async function listAnswerSheets(
  courseId: string,
  studentId: string,
  examType?: ExamType,
): Promise<AnswerSheet[]> {
  if (!courseId) return []
  let q = supabase
    .from('answer_sheets')
    .select('*')
    .eq('course_id', courseId)
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

// 여러 경로의 signed URL을 한 번에 발급 (N회 호출 → 1회 배치)
export async function signedUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return []
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error || !data) throw error ?? new Error('signed URL 생성 실패')
  return data.map((d) => d.signedUrl ?? '')
}

// 업로드 전 처리: 해상도는 최대한 유지(상한 2560px)하고, 목표 용량(~500KB)까지
// JPEG 품질을 단계적으로 낮춰 압축. jpg/png/webp만 디코드 가능.
export async function resizeImage(file: Blob): Promise<Blob> {
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
  // 해상도 유지: 비정상적으로 큰 사진만 상한(2560px) 적용, 그 외는 원본 크기 유지
  const MAX = 2560
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

  const toJpeg = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))),
        'image/jpeg',
        q,
      ),
    )
  // 최대한 압축: 목표 용량(~500KB) 이하가 될 때까지 품질을 단계적으로 낮춤
  // (텍스트 가독성 위해 품질 하한 0.5)
  const TARGET = 500 * 1024
  let q = 0.82
  let blob = await toJpeg(q)
  while (blob.size > TARGET && q > 0.5) {
    q = Math.round((q - 0.08) * 100) / 100
    blob = await toJpeg(q)
  }
  return blob
}

// 업로드: 축소 → 객체 저장 → answer_sheets 행 insert → 행 반환 (교수만 RLS 통과)
export async function uploadAnswerSheet(
  courseId: string,
  studentId: string,
  examType: ExamType,
  file: Blob,
): Promise<AnswerSheet> {
  const blob = await resizeImage(file)
  const path = `${studentId}/${examType}/${crypto.randomUUID()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('answer_sheets')
    .insert({ course_id: courseId, student_id: studentId, exam_type: examType, path })
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
export async function deleteAnswerSheetsForStudent(courseId: string, studentId: string): Promise<void> {
  const sheets = await listAnswerSheets(courseId, studentId)
  if (sheets.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(sheets.map((s) => s.path))
  if (error) throw error
}

// 클립보드에서 이미지 한 장 읽기 (없으면 null). 화면 캡처(Win+Shift+S) 후 붙여넣기용.
export async function readClipboardImage(): Promise<Blob | null> {
  const clip = navigator.clipboard
  if (!clip?.read) return null
  const items = await clip.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return await item.getType(type)
  }
  return null
}

// 명단 표시용: 학생별 중간/기말 답안지 보유 여부
export async function getAnswerSheetFlags(
  courseId: string,
  studentIds: string[],
): Promise<Record<string, { midterm: boolean; final: boolean }>> {
  const map: Record<string, { midterm: boolean; final: boolean }> = {}
  if (!courseId || studentIds.length === 0) return map
  const { data, error } = await supabase
    .from('answer_sheets')
    .select('student_id, exam_type')
    .eq('course_id', courseId)
    .in('student_id', studentIds)
  if (error) throw error
  for (const r of (data as { student_id: string; exam_type: ExamType }[]) ?? []) {
    const f = map[r.student_id] ?? (map[r.student_id] = { midterm: false, final: false })
    if (r.exam_type === 'midterm') f.midterm = true
    else if (r.exam_type === 'final') f.final = true
  }
  return map
}
