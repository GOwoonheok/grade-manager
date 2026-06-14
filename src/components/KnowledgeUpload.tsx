import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Trash2, Upload } from 'lucide-react'
import { listDecks, type Deck } from '../lib/flashcards'
import { deleteSource, ingestPdf, listSources, type DocSource } from '../lib/knowledge'
import ProgressTimer from './ProgressTimer'

// V2: 분야(deck)별 PDF 근거자료 업로드·관리. 임베딩되어 AI 생성·검색의 근거로 쓰임.
export default function KnowledgeUpload() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [sources, setSources] = useState<DocSource[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [estSec, setEstSec] = useState(30)
  const startRef = useRef(0)

  useEffect(() => { listDecks().then(setDecks).catch(() => {}) }, [])
  const load = () => {
    if (!deckId) { setSources([]); return }
    listSources(deckId).then(setSources).catch((e) => setMsg('목록 실패 — 018/019 적용 확인: ' + (e?.message ?? e)))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMsg(null); load() }, [deckId])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !deckId) return
    // 파일 크기 기반 예상 시간(초): 추출+청킹+임베딩. 카운트다운 표시용 추정치.
    setEstSec(Math.min(120, Math.max(10, Math.round(8 + (file.size / 1048576) * 6))))
    startRef.current = Date.now()
    setBusy(true)
    setMsg(null)
    try {
      const { count, chars } = await ingestPdf(deckId, file)
      const took = Math.round((Date.now() - startRef.current) / 1000)
      setMsg(`"${file.name}" 완료 — ${count}조각(${chars.toLocaleString()}자) · 총 ${took}초. 이제 AI 생성·검색 근거로 쓰입니다.`)
      load()
    } catch (err: any) {
      setMsg('실패: ' + (err?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (title: string) => {
    if (!window.confirm(`"${title}" 임베딩을 삭제할까요?`)) return
    try { await deleteSource(deckId, title); load() } catch (e: any) { setMsg('삭제 실패: ' + (e?.message ?? e)) }
  }

  return (
    <div className="space-y-3">
      <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
        <option value="">분야 선택</option>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {deckId && (
        <>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition ${busy ? 'opacity-50 pointer-events-none' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
            <Upload size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">{busy ? '처리 중…' : 'PDF 업로드 (텍스트형, 최대 ~50MB)'}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} className="hidden" />
          </label>
          <p className="text-xs text-gray-400">※ HWP는 "PDF로 내보내기" 후 업로드 · 스캔(이미지) PDF는 글자 추출이 안 됩니다.</p>
          <ProgressTimer running={busy} estSec={estSec} label="PDF 분석·임베딩 중…" />
          {msg && <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{msg}</p>}

          <div className="space-y-1.5">
            {sources.length === 0 && <p className="text-sm text-gray-400">업로드된 문서가 없습니다.</p>}
            {sources.map((s) => (
              <div key={s.title} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5 text-sm text-gray-800 min-w-0">
                  <FileText size={14} className="text-indigo-500 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400">{s.chunks}조각</span>
                  <button onClick={() => onDelete(s.title)} className="text-gray-400 hover:text-red-600" title="삭제"><Trash2 size={14} /></button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
