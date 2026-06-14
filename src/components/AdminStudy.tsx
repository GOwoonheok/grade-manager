import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { BookOpen, Bot, Check, ChevronDown, ChevronLeft, ChevronUp, ClipboardCheck, ClipboardList, ExternalLink, Eye, FileText, Image as ImageIcon, Info, MessagesSquare, Pencil, Plus, Search, Trash2, X as XIcon } from 'lucide-react'
import {
  bulkCreateCards,
  NOTEBOOKLM_URL,
  createCard,
  createDeck,
  createTopic,
  deleteCard,
  deleteDeck,
  deleteTopic,
  imageUrl,
  listCards,
  listDecks,
  listMembers,
  listTopics,
  reorderCards,
  setMemberStatus,
  updateCard,
  uploadCardImage,
  type Card,
  type Deck,
  type StudyMember,
  type Topic,
} from '../lib/flashcards'
import { readClipboardImage, resizeImage } from '../lib/answerSheets'
import CardPlayer from './CardPlayer'
import QnaBoard from './QnaBoard'
import StudyIntro from './StudyIntro'
import StudyMenuTile from './StudyMenuTile'
import CardSearch from './CardSearch'
import QuizAdmin from './QuizAdmin'
import KnowledgeUpload from './KnowledgeUpload'
import RagChat from './RagChat'

const STATUS_LABEL: Record<string, string> = { pending: '대기', approved: '승인', rejected: '거부' }
const STATUS_CLS: Record<string, string> = {
  pending: 'text-amber-600',
  approved: 'text-emerald-600',
  rejected: 'text-red-600',
}

type View = 'menu' | 'intro' | 'flash' | 'qna' | 'approve' | 'search' | 'quiz' | 'knowledge' | 'rag'

export default function AdminStudy() {
  const [view, setView] = useState<View>('menu')
  const [decks, setDecks] = useState<Deck[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<StudyMember[]>([])
  const [newDeck, setNewDeck] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const loadDecks = async () => setDecks(await listDecks())
  const loadMembers = async () => setMembers(await listMembers())
  useEffect(() => {
    loadDecks().catch((e) => setErr(e.message))
    loadMembers().catch(() => {})
  }, [])

  const openDeck = async (d: Deck) => { setDeck(d); setTopic(null); setCards([]); setTopics(await listTopics(d.id)) }
  const openTopic = async (t: Topic) => { setTopic(t); setCards(await listCards(t.id)) }
  const reloadTopics = async () => { if (deck) setTopics(await listTopics(deck.id)) }
  const reloadCards = async () => { if (topic) setCards(await listCards(topic.id)) }

  const addDeck = async () => { if (!newDeck.trim()) return; try { await createDeck(newDeck.trim()); setNewDeck(''); await loadDecks() } catch (e: any) { setErr(e.message) } }
  const removeDeck = async (id: string) => { if (!window.confirm('과목과 하위 토픽·카드를 모두 삭제할까요?')) return; await deleteDeck(id); if (deck?.id === id) { setDeck(null); setTopic(null) } await loadDecks() }
  const addTopic = async () => { if (!newTopic.trim() || !deck) return; try { await createTopic(deck.id, newTopic.trim()); setNewTopic(''); await reloadTopics() } catch (e: any) { setErr(e.message) } }
  const removeTopic = async (id: string) => { if (!window.confirm('토픽과 카드를 삭제할까요?')) return; await deleteTopic(id); if (topic?.id === id) setTopic(null); await reloadTopics() }
  const decide = async (m: StudyMember, s: 'approved' | 'rejected') => { await setMemberStatus(m.id, s); await loadMembers() }

  const pending = members.filter((m) => m.status === 'pending').length

  if (view === 'menu')
    return (
      <div className="space-y-3">
        {err && <p className="text-sm text-red-600">{err}</p>}
        <StudyMenuTile icon={<Info size={26} />} title="공공조달관리사 소개" desc="자격 개요와 과목 안내" onClick={() => setView('intro')} />
        <StudyMenuTile icon={<BookOpen size={26} />} title="플래시카드 관리" desc="과목 · 토픽 · 카드 등록/수정" onClick={() => setView('flash')} />
        <StudyMenuTile icon={<Search size={26} />} title="카드 조회 / 검색" desc="키워드로 카드 찾아보기" onClick={() => setView('search')} />
        <StudyMenuTile icon={<ClipboardList size={26} />} title="CBT 문제 관리" desc="예상문제 등록·검수 (4지선다)" onClick={() => setView('quiz')} />
        <StudyMenuTile icon={<FileText size={26} />} title="근거자료(PDF)" desc="PDF 업로드 → AI 생성·검색 근거" onClick={() => setView('knowledge')} />
        <StudyMenuTile icon={<Bot size={26} />} title="AI 상담 (질문답변)" desc="학습자료 근거 질문답변" onClick={() => setView('rag')} />
        <StudyMenuTile icon={<MessagesSquare size={26} />} title="같이 공부하기 (Q&A)" desc="질문 확인 · 답변" onClick={() => setView('qna')} />
        <StudyMenuTile icon={<ExternalLink size={26} />} title="NotebookLM 질문하기" desc="공공조달관리사 노트북 (새 탭)" onClick={() => { window.open(NOTEBOOKLM_URL, '_blank', 'noopener,noreferrer') }} />
        <StudyMenuTile icon={<ClipboardCheck size={26} />} title="학습 신청 승인" desc={pending > 0 ? `${pending}건 대기중` : '신청 내역 관리'} onClick={() => setView('approve')} />
      </div>
    )

  return (
    <div>
      <button onClick={() => setView('menu')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ChevronLeft size={16} />메뉴
      </button>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

      {view === 'intro' && <StudyIntro />}
      {view === 'search' && <CardSearch />}
      {view === 'quiz' && <QuizAdmin />}
      {view === 'knowledge' && <KnowledgeUpload />}
      {view === 'rag' && <RagChat />}
      {view === 'qna' && <QnaBoard />}

      {view === 'flash' && (
      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">과목 · 토픽 · 카드 관리</h2>

        <div className="flex gap-2 mb-2">
          <input value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder="새 과목명 (예: 조달법규)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={addDeck} className="px-3 py-2 border border-indigo-600 text-indigo-700 rounded-lg font-medium flex items-center gap-1"><Plus size={16} />과목</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {decks.length === 0 && <span className="text-sm text-gray-400">과목을 추가하세요.</span>}
          {decks.map((d) => (
            <span key={d.id} onClick={() => openDeck(d)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${deck?.id === d.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-700'}`}>
              {d.name}
              <button onClick={(e) => { e.stopPropagation(); removeDeck(d.id) }} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
            </span>
          ))}
        </div>

        {deck && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">{deck.name} · 토픽</p>
            <div className="flex gap-2 mb-2">
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="새 토픽명 (예: 1단원)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button onClick={addTopic} className="px-3 py-2 border border-indigo-400 text-indigo-700 rounded-lg text-sm font-medium flex items-center gap-1"><Plus size={14} />토픽</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {topics.length === 0 && <span className="text-sm text-gray-400">토픽을 추가하세요.</span>}
              {topics.map((t) => (
                <span key={t.id} onClick={() => openTopic(t)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${topic?.id === t.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300 text-gray-700'}`}>
                  {t.name}
                  <button onClick={(e) => { e.stopPropagation(); removeTopic(t.id) }} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        {topic && <TopicCards topic={topic} cards={cards} reload={reloadCards} />}
      </section>
      )}

      {view === 'approve' && (
      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">학습 신청 승인</h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">신청 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <span className="text-gray-700">
                  {m.student?.name} <span className="text-gray-400">({m.student?.student_number})</span> —{' '}
                  <span className={STATUS_CLS[m.status]}>{STATUS_LABEL[m.status]}</span>
                </span>
                {m.status === 'pending' && (
                  <span className="flex gap-1">
                    <button onClick={() => decide(m, 'approved')} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><Check size={14} />승인</button>
                    <button onClick={() => decide(m, 'rejected')} className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><XIcon size={14} />거부</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  )
}

function TopicCards({ topic, cards, reload }: { topic: Topic; cards: Card[]; reload: () => void }) {
  const [term, setTerm] = useState('')
  const [def, setDef] = useState('')
  const [content, setContent] = useState('')
  const [kw, setKw] = useState('')
  const [img, setImg] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const xlsxRef = useRef<HTMLInputElement>(null)

  const pickImg = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true); setMsg(null)
    try { setImg(await uploadCardImage(await resizeImage(f))) } catch (er: any) { setMsg('이미지 업로드 실패: ' + (er?.message ?? er)) } finally { setBusy(false); e.target.value = '' }
  }
  const resetForm = () => { setTerm(''); setDef(''); setContent(''); setKw(''); setImg(null); setEditId(null) }
  const startEdit = (c: Card) => { setEditId(c.id); setTerm(c.term); setDef(c.definition); setContent(c.content); setKw(c.keywords); setImg(c.front_image); setMsg(null) }
  const submit = async () => {
    if (!term.trim()) { setMsg('토픽명을 입력하세요.'); return }
    setBusy(true); setMsg(null)
    try {
      const p = { term: term.trim(), definition: def.trim(), content: content.trim(), keywords: kw.trim() }
      if (editId) await updateCard(editId, { ...p, image: img })
      else await createCard(topic.id, { ...p, image: img })
      resetForm(); reload()
    } catch (er: any) { setMsg('저장 실패: ' + (er?.message ?? er)) } finally { setBusy(false) }
  }
  const onExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true); setMsg(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer())
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const rows = json
        .map((r) => ({
          term: String(r['토픽명'] ?? '').trim(),
          definition: String(r['정의'] ?? '').trim(),
          content: String(r['내용'] ?? r['주요내용'] ?? '').trim(),
          keywords: String(r['기타'] ?? r['키워드'] ?? '').trim(),
        }))
        .filter((r) => r.term)
      if (rows.length === 0) { setMsg('유효한 행이 없습니다 (헤더: 토픽명/정의/내용/기타).'); return }
      const n = await bulkCreateCards(topic.id, rows)
      reload()
      setMsg(`${n}개 카드 업로드 완료`)
    } catch (er: any) { setMsg('엑셀 업로드 실패: ' + (er?.message ?? er)) } finally { setBusy(false); e.target.value = '' }
  }
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([['토픽명', '정의', '내용', '기타']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '카드')
    XLSX.writeFile(wb, `${topic.name}_카드양식.xlsx`)
  }
  const exportCards = async () => {
    const XLSX = await import('xlsx')
    const data = cards.map((c) => ({ 토픽명: c.term, 정의: c.definition, 내용: c.content, 기타: c.keywords }))
    const ws = XLSX.utils.json_to_sheet(data, { header: ['토픽명', '정의', '내용', '기타'] })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '카드')
    XLSX.writeFile(wb, `${topic.name}_카드.xlsx`)
  }
  const pasteImg = async () => {
    setBusy(true); setMsg(null)
    try {
      const blob = await readClipboardImage()
      if (!blob) { setMsg('클립보드에 이미지가 없습니다. (Win+Shift+S 캡처 후 다시)'); return }
      setImg(await uploadCardImage(await resizeImage(blob)))
    } catch (er: any) { setMsg('붙여넣기 실패: ' + (er?.message ?? er)) } finally { setBusy(false) }
  }
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= cards.length) return
    const ids = cards.map((c) => c.id)
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    setBusy(true); setMsg(null)
    try { await reorderCards(ids); reload() } catch (er: any) { setMsg('순서 변경 실패: ' + (er?.message ?? er)) } finally { setBusy(false) }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-semibold text-gray-600">{topic.name} · 카드 {cards.length}장</p>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setPreview((p) => !p)} className={preview ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}><Eye size={13} className="inline mr-0.5" />미리보기</button>
          <button onClick={downloadTemplate} className="text-indigo-600 hover:text-indigo-700">양식 다운로드</button>
          {cards.length > 0 && <button onClick={exportCards} className="text-indigo-600 hover:text-indigo-700">내보내기</button>}
          <label className="cursor-pointer text-emerald-700 hover:text-emerald-800">
            엑셀 업로드
            <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={onExcel} disabled={busy} className="hidden" />
          </label>
        </div>
      </div>
      {preview && (
        <div className="mb-3 border border-gray-200 rounded-xl p-3">
          <CardPlayer cards={cards} preview />
        </div>
      )}
      <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
        {cards.length === 0 && <p className="text-sm text-gray-400">카드가 없습니다.</p>}
        {cards.map((c, i) => (
          <div key={c.id} className={`flex items-center justify-between gap-2 text-sm border rounded-lg p-2 ${editId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 min-w-0">
              {c.front_image ? (
                <img src={imageUrl(c.front_image)} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center text-gray-300 shrink-0"><ImageIcon size={14} /></div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{c.term || '(제목없음)'}</p>
                <p className="text-gray-500 truncate">{c.definition}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="text-gray-400 hover:text-gray-700 p-1 disabled:opacity-30" title="위로"><ChevronUp size={15} /></button>
              <button onClick={() => move(i, 1)} disabled={i === cards.length - 1 || busy} className="text-gray-400 hover:text-gray-700 p-1 disabled:opacity-30" title="아래로"><ChevronDown size={15} /></button>
              <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-indigo-600 p-1" title="수정"><Pencil size={15} /></button>
              <button onClick={async () => { await deleteCard(c.id); if (editId === c.id) resetForm(); reload() }} className="text-gray-400 hover:text-red-600 p-1" title="삭제"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600">{editId ? '카드 수정' : '카드 추가'}</p>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="토픽명 (앞면)" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
        <textarea value={def} onChange={(e) => setDef(e.target.value)} placeholder="정의" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <textarea value={kw} onChange={(e) => setKw(e.target.value)} placeholder="기타 (키워드·참고 등)" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <div className="flex items-center gap-2 flex-wrap">
          <ImgPick label={img ? '이미지 ✓' : '이미지(선택)'} onChange={pickImg} />
          <button type="button" onClick={pasteImg} disabled={busy} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 text-xs">붙여넣기</button>
          {img && <button type="button" onClick={() => setImg(null)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-red-600 hover:bg-red-50 text-xs">이미지 제거</button>}
        </div>
        {msg && <p className="text-xs text-gray-600">{msg}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium flex items-center gap-1">{editId ? <Check size={16} /> : <Plus size={16} />}{busy ? '처리 중...' : editId ? '수정 저장' : '카드 추가'}</button>
          {editId && <button onClick={resetForm} disabled={busy} className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">취소</button>}
        </div>
      </div>
    </div>
  )
}

function ImgPick({ label, onChange }: { label: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100">
      <ImageIcon size={14} />
      {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="hidden" />
    </label>
  )
}
