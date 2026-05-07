import { Eye, Download, Trash2 } from 'lucide-react'

const ICONS = {
  folder: '📁', pdf: '📄', doc: '📝', docx: '📝',
  xls: '📊', xlsx: '📊', ppt: '📋', pptx: '📋',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
  mp4: '🎥', mp3: '🎵', zip: '🗜️', tar: '🗜️', gz: '🗜️',
  txt: '📃', csv: '📃', json: '📃', xml: '📃', md: '📃',
  py: '🐍', js: '📜', html: '🌐',
}

const PREVIEW_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'txt', 'csv', 'md']

export function getIcon(item) {
  if (item.type === 'folder') return '📁'
  return ICONS[item.ext] || '📄'
}

export function fmtSize(b) {
  if (!b && b !== 0) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FileGrid({ items, onItemClick, onDelete, onPreview, viewMode = 'grid' }) {
  if (viewMode === 'list') {
    return <ListView items={items} onItemClick={onItemClick} onDelete={onDelete} onPreview={onPreview} />
  }
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {items.map((item) => (
        <GridItem
          key={item.path}
          item={item}
          onClick={() => onItemClick(item)}
          onDelete={() => onDelete(item)}
          onPreview={() => onPreview(item)}
        />
      ))}
    </div>
  )
}

// ── Grid view ──────────────────────────────────────────────────

function GridItem({ item, onClick, onDelete, onPreview }) {
  const canPreview = item.type === 'file' && PREVIEW_EXTS.includes(item.ext)
  const badgeClass = item.type === 'folder'
    ? 'bg-purple/20 text-purple'
    : item.ext === 'pdf'
      ? 'bg-danger/20 text-danger'
      : 'bg-success/20 text-success'

  return (
    <div
      onClick={onClick}
      className="relative bg-surface border border-border rounded-xl p-3 cursor-pointer flex flex-col items-center gap-2 text-center hover:border-primary hover:-translate-y-0.5 transition-all group"
    >
      <span className={`absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${badgeClass}`}>
        {item.type === 'folder' ? 'folder' : (item.ext || 'file')}
      </span>
      <div className="text-3xl">{getIcon(item)}</div>
      <div className="text-[11px] font-semibold break-all leading-tight line-clamp-2">{item.name}</div>
      {item.type === 'file' && <div className="text-[10px] text-muted">{fmtSize(item.size)}</div>}
      <div className="absolute inset-0 rounded-xl bg-bg/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 gap-1">
        {canPreview && (
          <ActionBtn icon={<Eye size={12} />} title="Preview" onClick={(e) => { e.stopPropagation(); onPreview() }} />
        )}
        {item.type === 'file' && (
          <ActionBtn icon={<Download size={12} />} title="Download" onClick={(e) => { e.stopPropagation(); window.location.href = `/api/download?path=${encodeURIComponent(item.path)}` }} />
        )}
        <ActionBtn icon={<Trash2 size={12} />} title="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete() }} />
      </div>
    </div>
  )
}

function ActionBtn({ icon, title, onClick, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs transition-colors
        ${danger
          ? 'bg-card border-border text-subtle hover:bg-danger hover:border-danger hover:text-white'
          : 'bg-card border-border text-subtle hover:bg-primary hover:border-primary hover:text-white'}`}
    >
      {icon}
    </button>
  )
}

// ── List view ──────────────────────────────────────────────────

function ListView({ items, onItemClick, onDelete, onPreview }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="grid text-[10px] uppercase tracking-widest text-muted bg-card px-3 py-2 border-b border-border"
        style={{ gridTemplateColumns: '2rem 1fr 5rem 6rem 7rem 5.5rem' }}>
        <span />
        <span>Name</span>
        <span>Type</span>
        <span className="text-right">Size</span>
        <span className="text-right">Modified</span>
        <span className="text-right">Actions</span>
      </div>

      {items.map((item, idx) => (
        <ListRow
          key={item.path}
          item={item}
          isLast={idx === items.length - 1}
          onClick={() => onItemClick(item)}
          onDelete={() => onDelete(item)}
          onPreview={() => onPreview(item)}
        />
      ))}
    </div>
  )
}

function ListRow({ item, isLast, onClick, onDelete, onPreview }) {
  const canPreview = item.type === 'file' && PREVIEW_EXTS.includes(item.ext)
  const badgeClass = item.type === 'folder'
    ? 'bg-purple/20 text-purple'
    : item.ext === 'pdf'
      ? 'bg-danger/20 text-danger'
      : 'bg-success/20 text-success'

  return (
    <div
      onClick={onClick}
      className={`grid items-center px-3 py-2 cursor-pointer hover:bg-card transition-colors group
        ${!isLast ? 'border-b border-border' : ''}`}
      style={{ gridTemplateColumns: '2rem 1fr 5rem 6rem 7rem 5.5rem' }}
    >
      <span className="text-base">{getIcon(item)}</span>

      <span className="text-[12px] font-medium truncate pr-2">{item.name}</span>

      <span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${badgeClass}`}>
          {item.type === 'folder' ? 'folder' : (item.ext || 'file')}
        </span>
      </span>

      <span className="text-[11px] text-muted text-right">
        {item.type === 'file' ? fmtSize(item.size) : '—'}
      </span>

      <span className="text-[11px] text-muted text-right">{fmtDate(item.modified)}</span>

      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canPreview && (
          <ActionBtn icon={<Eye size={11} />} title="Preview" onClick={(e) => { e.stopPropagation(); onPreview() }} />
        )}
        {item.type === 'file' && (
          <ActionBtn icon={<Download size={11} />} title="Download" onClick={(e) => { e.stopPropagation(); window.location.href = `/api/download?path=${encodeURIComponent(item.path)}` }} />
        )}
        <ActionBtn icon={<Trash2 size={11} />} title="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete() }} />
      </div>
    </div>
  )
}
