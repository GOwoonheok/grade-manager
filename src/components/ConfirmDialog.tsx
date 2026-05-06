import { AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '확인',
  onConfirm,
  onCancel,
  loading,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-red-100 text-red-600 rounded-full p-2 flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium"
            >
              {loading ? '처리 중...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
