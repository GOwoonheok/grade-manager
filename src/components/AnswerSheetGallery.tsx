import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Trash2, Plus, Camera, Loader2 } from 'lucide-react'
import {
  listAnswerSheets,
  signedUrl,
  uploadAnswerSheet,
  deleteAnswerSheet,
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
    </div>
  )
}
