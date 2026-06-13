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
