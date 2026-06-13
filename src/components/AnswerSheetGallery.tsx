import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react'
import { Trash2, Plus, Camera, ClipboardPaste, Loader2, X } from 'lucide-react'
import {
  listAnswerSheets,
  signedUrls,
  uploadAnswerSheet,
  deleteAnswerSheet,
  readClipboardImage,
} from '../lib/answerSheets'
import { SCORE_LABEL, type AnswerSheet, type ExamType } from '../lib/supabase'
import CameraCapture from './CameraCapture'

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
  const [cameraOpen, setCameraOpen] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const sheets = await listAnswerSheets(studentId, examType)
      const urls = await signedUrls(sheets.map((s) => s.path)) // 1회 배치
      setThumbs(sheets.map((s, i) => ({ sheet: s, url: urls[i] })))
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

  const pushBlob = async (blob: Blob) => {
    setBusy(true)
    setError(null)
    try {
      await uploadAnswerSheet(studentId, examType, blob)
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  // 클립보드 '붙여넣기' 버튼 (Clipboard API)
  const onPasteClick = async () => {
    try {
      const blob = await readClipboardImage()
      if (!blob) {
        setError('클립보드에 이미지가 없습니다. (Win+Shift+S로 캡처한 뒤 다시 누르세요)')
        return
      }
      await pushBlob(blob)
    } catch (e: any) {
      setError('붙여넣기 실패: ' + (e?.message ?? String(e)))
    }
  }

  // 이 영역이 포커스된 상태에서 Ctrl+V
  const onPasteEvent = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) {
          e.preventDefault()
          void pushBlob(f)
          return
        }
      }
    }
  }

  return (
    <div
      className="outline-none"
      tabIndex={readOnly ? undefined : 0}
      onPaste={readOnly ? undefined : onPasteEvent}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {SCORE_LABEL[examType]} 답안지
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              <Camera size={16} />
              촬영
            </button>
            <span className="text-gray-300">|</span>
            <label className="cursor-pointer inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
              <Plus size={16} />
              파일 선택
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
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={onPasteClick}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              <ClipboardPaste size={16} />
              붙여넣기
            </button>
          </div>
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
              <button
                key={t.sheet.id}
                type="button"
                onClick={() => setZoom(t.url)}
                className="block cursor-pointer"
              >
                <img
                  src={t.url}
                  alt="답안지"
                  loading="lazy"
                  className="w-24 h-24 object-cover rounded-lg border hover:opacity-90"
                />
              </button>
            ) : (
              <div key={t.sheet.id} className="relative">
                <img
                  src={t.url}
                  alt="답안지"
                  loading="lazy"
                  onClick={() => setZoom(t.url)}
                  className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-90"
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

      {!readOnly && (
        <CameraCapture
          open={cameraOpen}
          title={`${SCORE_LABEL[examType]} 답안지 촬영`}
          onClose={() => {
            setCameraOpen(false)
            load()
          }}
          onShoot={async (blob) => {
            await uploadAnswerSheet(studentId, examType, blob)
          }}
        />
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/80"
            title="닫기"
          >
            <X size={20} />
          </button>
          <img
            src={zoom}
            alt="답안지 전체보기"
            className="max-w-full max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
