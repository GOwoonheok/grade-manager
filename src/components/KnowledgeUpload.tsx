import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Play, Trash2, Upload } from 'lucide-react'
import { listDecks, type Deck } from '../lib/flashcards'
import { countPending, deleteSource, ingestPdf, listSources, splitPdfBySize, startEmbedding, type DocSource } from '../lib/knowledge'

// V2-B: PDF 근거자료 — 업로드 시 텍스트만 빠르게 저장 후, 서버 백그라운드에서 분당 ~90조각 자동 색인.
// 클릭 1회로 시작하면 서버가 스스로 이어서(self-chain) 끝까지 처리 → 화면(탭)을 닫아도 계속 진행됨.
export default function KnowledgeUpload() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState('')
  const [sources, setSources] = useState<DocSource[]>([])
  const [pending, setPending] = useState(0)
  const [embTotal, setEmbTotal] = useState(0) // 진행률 분모(색인 시작 시점의 대기 수)
  const [busy, setBusy] = useState(false)      // 업로드·추출 단계
  const [kicking, setKicking] = useState(false) // 색인 시작 요청 중
  const [msg, setMsg] = useState<string | null>(null)
  const prevPending = useRef(0)

  useEffect(() => { listDecks().then(setDecks).catch(() => {}) }, [])

  const load = () => {
    if (!deckId) { setSources([]); return }
    listSources(deckId).then(setSources).catch((e) => setMsg('목록 실패 — 018~020 적용 확인: ' + (e?.message ?? e)))
  }

  // 분야 변경/마운트: 목록 로드 + 대기 수 폴링(서버 진행상황 반영). 화면을 닫아도 서버는 계속 진행.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMsg(null); setEmbTotal(0); setPending(0); prevPending.current = 0
    if (!deckId) { setSources([]); return }
    load()
    let alive = true
    const tick = async () => {
      try {
        const p = await countPending(deckId)
        if (!alive) return
        setPending(p)
        if (p > 0) setEmbTotal((t) => Math.max(t, p))
        if (prevPending.current > 0 && p === 0) { setMsg('✅ 전체 색인 완료!'); setEmbTotal(0); load() }
        prevPending.current = p
      } catch { /* 폴링 실패는 무시 */ }
    }
    tick()
    const iv = setInterval(tick, 12000)
    return () => { alive = false; clearInterval(iv) }
  }, [deckId])

  // 서버 백그라운드 색인 시작(또는 이어서 진행). 클릭 1회면 서버가 끝까지 처리.
  const kick = async () => {
    if (!deckId) return
    setKicking(true); setMsg(null)
    try {
      const r = await startEmbedding()
      setMsg(r.started
        ? '서버에서 자동 색인을 시작했습니다 — 화면을 닫아도 계속 진행됩니다.'
        : '이미 서버에서 색인이 진행 중입니다 — 화면을 닫아도 됩니다.')
      const p = await countPending(deckId)
      setPending(p); if (p > 0) setEmbTotal((t) => Math.max(t, p)); prevPending.current = p
    } catch (e: any) {
      setMsg('색인 시작 실패: ' + (e?.message ?? e))
    } finally {
      setKicking(false)
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
      setBusy(false)
      setMsg(`${parts.length > 1 ? `${parts.length}개 파트 · ` : ''}텍스트 ${totalChunks}조각 추출 — 서버 자동 색인을 시작합니다.`)
      await kick()
    } catch (err: any) {
      setMsg('실패: ' + (err?.message ?? err))
      setBusy(false)
    }
  }

  const onDelete = async (title: string) => {
    if (!window.confirm(`"${title}" 임베딩을 삭제할까요?`)) return
    try { await deleteSource(deckId, title); load() } catch (e: any) { setMsg('삭제 실패: ' + (e?.message ?? e)) }
  }

  const pct = embTotal ? Math.round(((embTotal - pending) / embTotal) * 100) : 0

  return (
    <div className="space-y-3">
      <select value={deckId} onChange={(e) => setDeckId(e.target.value)} disabled={busy} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100">
        <option value="">분야 선택</option>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {deckId && (
        <>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition ${busy ? 'opacity-50 pointer-events-none' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
            <Upload size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">{busy ? '처리 중…' : 'PDF 업로드 (텍스트형 · 50MB↑ 자동 분할)'}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} className="hidden" />
          </label>
          <p className="text-xs text-gray-400">※ 색인은 서버 백그라운드에서 분당 ~90조각씩 자동 진행 — <b>화면(탭)을 닫아도 계속</b>됩니다. · 50MB↑ PDF 자동 분할 · HWP는 PDF로 · 스캔(이미지)본은 글자 추출 안 됨.</p>

          {pending > 0 && (
            <div className="space-y-1.5 bg-indigo-50/60 border border-indigo-100 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-gray-700">
                <span>🔄 서버에서 자동 색인 중 — 화면을 닫아도 계속됩니다</span>
                <span className="tabular-nums">{embTotal ? `${embTotal - pending}/${embTotal} (${pct}%)` : `남은 ${pending}조각`}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <button onClick={kick} disabled={kicking} className="text-xs text-indigo-700 inline-flex items-center gap-1 mt-0.5 disabled:opacity-50">
                <Play size={12} />{kicking ? '요청 중…' : '이어서 진행 / 재시도'}
              </button>
            </div>
          )}

          {msg && <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{msg}</p>}

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 pt-1 border-t border-gray-100">
            <FileText size={13} className="text-gray-400" />
            {decks.find((d) => d.id === deckId)?.name ?? ''} · 업로드 문서 {sources.length}개
          </div>
          <div className="space-y-1.5">
            {sources.length === 0 && <p className="text-sm text-gray-400">이 분야에 업로드된 문서가 없습니다.</p>}
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
