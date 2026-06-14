import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

// Chrome/Android의 설치 이벤트 타입(표준 lib에 없어 최소 정의)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

// 핸드폰/데스크톱에서 "앱 설치"를 안내하는 하단 배너.
// - Android/Chrome 등: beforeinstallprompt를 잡아 [설치] 버튼으로 바로 설치
// - iOS Safari: 프로그램 설치 불가 → "홈 화면에 추가" 방법 안내
// - 이미 설치(스탠드얼론)되었거나 이번 세션에서 닫았으면 표시 안 함
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHelp, setIosHelp] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // 브라우저 기본 미니 배너 억제 → 우리 버튼으로 유도
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setDismissed(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // 이미 설치된 상태(홈화면 실행)면 숨김
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  if (standalone || dismissed) return null
  const canInstall = !!deferred
  // 설치 이벤트도 없고 iOS도 아니면(예: 데스크톱 Safari/지원 안 됨) 표시 안 함
  if (!canInstall && !isIOS) return null

  const close = () => {
    setDismissed(true)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    close()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-white border border-gray-200 shadow-lg rounded-2xl p-3 flex items-center gap-3">
        <img src="/pwa-192.png" alt="" className="h-10 w-10 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">앱으로 설치</p>
          <p className="text-xs text-gray-500 truncate">홈 화면에 추가해 앱처럼 사용하세요</p>
        </div>
        {canInstall ? (
          <button
            onClick={install}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            <Download size={16} /> 설치
          </button>
        ) : (
          <button
            onClick={() => setIosHelp((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            <Share size={16} /> 방법
          </button>
        )}
        <button onClick={close} className="shrink-0 text-gray-400 hover:text-gray-600 p-1" title="닫기">
          <X size={18} />
        </button>
      </div>

      {iosHelp && !canInstall && (
        <div className="pointer-events-auto mx-auto max-w-md mt-2 bg-white border border-gray-200 shadow-lg rounded-2xl p-3 text-sm">
          <p className="font-semibold text-gray-800 mb-1">아이폰 설치 방법 (Safari)</p>
          <ol className="list-decimal list-inside space-y-0.5 text-gray-600">
            <li>
              하단 <Share size={14} className="inline -mt-0.5" /> <b>공유</b> 버튼 탭
            </li>
            <li>
              <b>홈 화면에 추가</b> 선택
            </li>
            <li>
              우측 상단 <b>추가</b> 탭
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
