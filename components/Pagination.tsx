'use client'

import {
  HiChevronRight, HiChevronLeft,
  HiChevronDoubleRight, HiChevronDoubleLeft,
} from 'react-icons/hi2'

interface PaginationProps {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (p: number) => void
  isRtl?: boolean
}

export default function Pagination({ page, pages, total, limit, onPage, isRtl = true }: PaginationProps) {
  if (pages <= 1) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  // Build visible page numbers: always show first, last, and ±2 around current
  function getRange(): (number | '...')[] {
    const delta = 2
    const range: number[] = []
    for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) range.push(i)

    const result: (number | '...')[] = [1]
    if (range[0] > 2) result.push('...')
    result.push(...range)
    if (range[range.length - 1] < pages - 1) result.push('...')
    if (pages > 1) result.push(pages)
    return result
  }

  const Prev = isRtl ? HiChevronRight : HiChevronLeft
  const Next = isRtl ? HiChevronLeft  : HiChevronRight
  const First = isRtl ? HiChevronDoubleRight : HiChevronDoubleLeft
  const Last  = isRtl ? HiChevronDoubleLeft  : HiChevronDoubleRight

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-1">
      {/* Count label */}
      <p className="text-xs text-slate-400">
        {from}–{to} {isRtl ? 'من' : 'of'} {total}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPage(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={isRtl ? 'الأول' : 'First'}
        >
          <First size={15} />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={isRtl ? 'السابق' : 'Previous'}
        >
          <Prev size={15} />
        </button>

        {/* Page numbers */}
        {getRange().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-slate-300 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-all ${
                p === page
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={isRtl ? 'التالي' : 'Next'}
        >
          <Next size={15} />
        </button>

        {/* Last */}
        <button
          onClick={() => onPage(pages)}
          disabled={page === pages}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title={isRtl ? 'الأخير' : 'Last'}
        >
          <Last size={15} />
        </button>
      </div>
    </div>
  )
}
