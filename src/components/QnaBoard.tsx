import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MessagesSquare, Send, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  deleteQna,
  getMyStudyStatus,
  listAnswers,
  listQuestions,
  postQna,
  type QnaPost,
  type StudyStatus,
} from '../lib/flashcards'

export default function QnaBoard() {
  const { profile } = useAuth()
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [questions, setQuestions] = useState<QnaPost[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = async () => setQuestions(await listQuestions())
  useEffect(() => {
    getMyStudyStatus().then((s) => { setStatus(s); if (s === 'approved') load() })
  }, [])

  if (status === null) return <p className="text-center text-gray-500 py-12">불러오는 중...</p>
  if (status !== 'approved')
    return <p className="text-center text-gray-600 py-12">학습 승인 후 이용할 수 있습니다.</p>

  const ask = async () => {
    if (!body.trim()) return
    setBusy(true)
    try { await postQna(body.trim(), null); setBody(''); await load() } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessagesSquare className="text-indigo-600" size={18} />
        <h2 className="text-sm font-semibold text-gray-800">같이 공부하기 (Q&A)</h2>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="질문을 입력하세요" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        <div className="flex justify-end mt-2">
          <button onClick={ask} disabled={busy} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium flex items-center gap-1"><Send size={14} />질문 등록</button>
        </div>
      </div>
      {questions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">등록된 질문이 없습니다.</p>
      ) : (
        questions.map((q) => (
          <QuestionItem key={q.id} q={q} meId={profile?.id} open={openId === q.id} onToggle={() => setOpenId((o) => (o === q.id ? null : q.id))} onChanged={load} />
        ))
      )}
    </div>
  )
}

function QuestionItem({ q, meId, open, onToggle, onChanged }: { q: QnaPost; meId?: string; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const [answers, setAnswers] = useState<QnaPost[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) listAnswers(q.id).then(setAnswers).catch(() => {}) }, [open, q.id])

  const ans = async () => {
    if (!reply.trim()) return
    setBusy(true)
    try { await postQna(reply.trim(), q.id); setReply(''); setAnswers(await listAnswers(q.id)) } finally { setBusy(false) }
  }
  const del = async (id: string, isQuestion: boolean) => {
    await deleteQna(id)
    if (isQuestion) onChanged()
    else setAnswers(await listAnswers(q.id))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onToggle} className="text-left flex-1 min-w-0">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{q.body}</p>
          <p className="text-[11px] text-gray-400 mt-1">{q.author?.name ?? '익명'} · {new Date(q.created_at).toLocaleDateString()}</p>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {q.author_id === meId && <button onClick={() => del(q.id, true)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}
          <button onClick={onToggle} className="text-gray-400">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-2">
          {answers.length === 0 && <p className="text-xs text-gray-400">답변이 없습니다.</p>}
          {answers.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[11px] text-gray-400">{a.author?.name ?? '익명'}</p>
              </div>
              {a.author_id === meId && <button onClick={() => del(a.id, false)} className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="답변 달기" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            <button onClick={ans} disabled={busy} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-lg text-sm">등록</button>
          </div>
        </div>
      )}
    </div>
  )
}
