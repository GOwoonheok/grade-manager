import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Square, Trash2, Upload } from 'lucide-react'
import { listDecks, type Deck } from '../lib/flashcards'
import { countPending, deleteSource, embedPending, ingestPdf, listSources, splitPdfBySize, type DocSource } from '../lib/knowledge'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// V2-B: PDF 근거자료 — 업로드 시 텍스트만 빠르게 저장 후, 분당 ~90개씩 자동 임베딩(무료 한도 대응).
export default function KnowledgeUpload() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [sources, setSources] = useState<DocSource[]>([])
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false) // 업로드·추출 단계
  const [embedding, setEmbedding] = useState(false) // 자동 색인 루프
  const [embTotal, setEmbTotal] = useState(0)
  const [embDone, setEmbDone] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => { listDecks().then(setDecks).catch(() => {}) }, [])
  const load = () => {
    if (!deckId) { setSources([]); return }
    listSources(deckId).then(setSources).catch((e) => setMsg('목록 실패 — 018~020 적용 확인: ' + (e?.message ?? e)))
  }
  const refreshPending = () => {
    if (!deckId) { setPending(0); return }
    countPending(deckId).then(setPending).catch(() => setPending(0))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMsg(null); load(); refreshPending() }, [deckId])

  // 분당 ~90개씩 대기 청크 임베딩 (화면 열려있는 동안). 끝나거나 중지까지 반복.
  const runEmbed = async (id: string) => {
    setEmbedding(true)
    cancelRef.current = false
    setMsg(null)
    try {
      const total = await countPending(id)
      setEmbTotal(total)
      setEmbDone(0)
      if (total === 0) { setMsg('색인할 대기 항목이 없습니다.'); return }
      while (!cancelRef.current) {
        let r
        try {
          r = await embedPending(id)
        } catch (e: any) {
          setMsg('임베딩 일시 오류 — 60초 후 자동 재시도: ' + (e?.message ?? e))
          await sleep(60000)
          continue
        }
        setEmbDone(total - r.remaining)
        if (r.remaining <= 0) { setMsg(`✅ 전체 색인 완료! (${total}조각)`); break }
        await sleep(60000) // 무료 분당 한도 → 다음 90개까지 대기
      }
      if (cancelRef.current) setMsg('색인을 멈췄습니다. "이어서 색인"으로 계속할 수 있어요.')
    } finally {
      setEmbedding(false)
      refreshPending()
      load()
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !deckId) return
    setBusy(true)
    try {
      let parts: File[] = [file]
      if (file.size > 45 * 1024 * 1024) {
        setMsg('큰 파일 — 50MB 한도에 맞춰 분할 중…')
        parts = await splitPdfBySize(file)
      }
      let totalChunks = 0
      for (let i = 0; i < parts.length; i++) {
        setMsg(parts.length > 1 ? `파트 ${i + 1}/${parts.length} 업로드·추출 중…` : 'PDF 업로드·텍스트 추출 중…')
        const r = await ingestPdf(deckId, parts[i])
        totalChunks += r.total
      }
      setMsg(`${parts.length > 1 ? `${parts.length}개 파트 · ` : ''}텍스트 ${totalChunks}조각 추출 — 자동 색인을 시작합니다.`)
      setBusy(false)
      await runEmbed(deckId)
    } catch (err: any) {
      setMsg('실패: ' + (err?.message ?? err))
      setBusy(false)
    }
  }

  const onDelete = async (title: string) => {
    if (!window.confirm(`"${title}" 임베딩을 삭제할까요?`)) return
    try { await deleteSource(deckId, title); load(); refreshPending() } catch (e: any) { setMsg('삭제 실패: ' + (e?.message ?? e)) }
  }

  const pct = embTotal ? Math.round((embDone / embTotal) * 100) : 0

  return (
    <div className="space-y-3">
      <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
        <option value="">분야 선택</option>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {deckId && (
        <>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition ${busy || embedding ? 'opacity-50 pointer-events-none' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
            <Upload size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">{busy ? '처리 중…' : 'PDF 업로드 (텍스트형 · 50MB↑ 자동 분할)'}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy || embedding} className="hidden" />
          </label>
          <p className="text-xs text-gray-400">※ 50MB↑ PDF는 자동 분할 업로드 · 큰 문서는 분당 ~90조각 자동 색인(화면 열어두세요) · HWP는 PDF로 · 스캔(이미지)본은 글자 추출 안 됨.</p>

          {embedding && (
            <div className="space-y-1 bg-indigo-50/60 border border-indigo-100 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-gray-700">
                <span>🔄 자동 색인 중… (분당 ~90 · 화면 열어두세요)</span>
                <span className="tabular-nums">{embDone}/{embTotal} ({pct}%)</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <button onClick={() => { cancelRef.current = true }} className="text-xs text-red-600 inline-flex items-center gap-1 mt-0.5"><Square size={12} />중지</button>
            </div>
          )}

          {!embedding && pending > 0 && (
            <button onClick={() => runEmbed(deckId)} className="w-full text-sm px-3 py-2 border border-indigo-500 text-indigo-700 rounded-lg font-medium">
              미완료 색인 {pending}조각 — 이어서 진행 ▶
            </button>
          )}

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
