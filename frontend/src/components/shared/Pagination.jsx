import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i)
  }

  const items = []
  let prev = null
  for (const p of pages) {
    if (prev !== null && p - prev > 1) items.push('gap')
    items.push(p)
    prev = p
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-6 pb-2">
      <PageBtn onClick={() => onChange(page - 1)} disabled={page === 1}>
        <ChevronLeft size={14} />
      </PageBtn>
      {items.map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="px-1.5 text-sm text-muted select-none">…</span>
        ) : (
          <PageBtn key={item} active={item === page} onClick={() => onChange(item)}>
            {item}
          </PageBtn>
        )
      )}
      <PageBtn onClick={() => onChange(page + 1)} disabled={page === totalPages}>
        <ChevronRight size={14} />
      </PageBtn>
      <span className="ml-3 text-xs text-muted">Page {page} of {totalPages}</span>
    </div>
  )
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : disabled
            ? 'text-muted/40 cursor-not-allowed'
            : 'text-subtle hover:bg-card hover:text-text border border-border'
      }`}
    >
      {children}
    </button>
  )
}
