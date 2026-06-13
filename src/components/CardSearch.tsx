import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { searchCards, type CardHit } from '../lib/flashcards'

// B-1: 카드 조회/검색 — 키워드 입력 → 매칭 카드(분야·토픽 표기), 클릭 시 정의·내용·기타 펼침.
export default function CardSearch() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<CardHit[]>([])
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const s = q.trim()
    if (s.length < 1) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      searchCards(s)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="키워드로 카드 검색 (토픽·정의·내용·키워드)"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8 text-sm">검색 중…</p>
      ) : q.trim() === '' ? (
        <p className="text-center text-gray-400 py-8 text-sm">검색어를 입력하세요.</p>
      ) : hits.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">결과가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{hits.length}개</p>
          {hits.map((c) => {
            const open = openId === c.id
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(open ? null : c.id)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">{c.term}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {c.topic?.deck?.name ?? ''} · {c.topic?.name ?? ''}
                  </span>
                </div>
                {open && (
                  <div className="mt-2 space-y-1.5 text-sm">
                    {c.definition && (
                      <p>
                        <span className="text-indigo-600 text-[11px] font-semibold">정의 </span>
                        <span className="whitespace-pre-wrap">{c.definition}</span>
                      </p>
                    )}
                    {c.content && (
                      <p>
                        <span className="text-indigo-600 text-[11px] font-semibold">내용 </span>
                        <span className="whitespace-pre-wrap">{c.content}</span>
                      </p>
                    )}
                    {c.keywords && (
                      <p className="text-gray-500">
                        <span className="text-indigo-600 text-[11px] font-semibold">기타 </span>
                        {c.keywords}
                      </p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
