import { useEffect, useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'

// 카메라(웹캠/휴대폰) 촬영 모달. 셔터를 누르면 현재 프레임을 JPEG Blob으로 onShoot에 넘긴다.
// 여러 장 연속 촬영 가능. '완료'로 닫는다.
export default function CameraCapture({
  open,
  title,
  onClose,
  onShoot,
}: {
  open: boolean
  title: string
  onClose: () => void
  onShoot: (blob: Blob) => Promise<void>
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setReady(false)
    setCount(0)
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch (e: any) {
        setError(
          '카메라를 열 수 없습니다. 브라우저에서 카메라 권한을 허용했는지 확인하세요. ' +
            '(없으면 아래 "파일 선택"을 사용하세요) — ' +
            (e?.message ?? String(e)),
        )
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  if (!open) return null

  const shoot = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setBusy(true)
    setError(null)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 컨텍스트를 만들 수 없습니다')
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('촬영 변환 실패'))),
          'image/jpeg',
          0.9,
        ),
      )
      await onShoot(blob)
      setCount((c) => c + 1)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Camera size={18} className="text-indigo-600" />
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="bg-black aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        </div>

        {error && <p className="m-3 text-sm text-red-600">{error}</p>}

        <div className="p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">
            {count > 0 ? `${count}장 촬영됨` : '준비되면 촬영하세요'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              완료
            </button>
            <button
              onClick={shoot}
              disabled={!ready || busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              촬영
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
