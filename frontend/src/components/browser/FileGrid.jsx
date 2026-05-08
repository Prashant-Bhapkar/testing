const ICONS = {
  folder: '📁', pdf: '📄', doc: '📝', docx: '📝',
  xls: '📊', xlsx: '📊', ppt: '📋', pptx: '📋',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
  mp4: '🎥', mp3: '🎵', zip: '🗜️', tar: '🗜️', gz: '🗜️',
  txt: '📃', csv: '📃', json: '📃', xml: '📃', md: '📃',
  py: '🐍', js: '📜', html: '🌐',
}

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

export default function FileGrid({ items, onItemClick, onContextMenu, viewMode = 'grid' }) {
  function handleRightClick(e, item) {
    e.preventDefault()
    onContextMenu?.({ item, x: e.clientX, y: e.clientY })
  }

  if (viewMode === 'list') {
    return <ListView items={items} onItemClick={onItemClick} onRightClick={handleRightClick} />
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {items.map((item) => (
        <GridItem
          key={item.path}
          item={item}
          onClick={() => onItemClick(item)}
          onRightClick={(e) => handleRightClick(e, item)}
        />
      ))}
    </div>
  )
}

// ── Grid view ──────────────────────────────────────────────────

function GridItem({ item, onClick, onRightClick }) {
  const badgeClass = item.type === 'folder'
    ? 'bg-purple/20 text-purple'
    : item.ext === 'pdf'
      ? 'bg-danger/20 text-danger'
      : 'bg-success/20 text-success'

  return (
    <div
      onClick={onClick}
      onContextMenu={onRightClick}
      className="relative bg-surface border border-border rounded-xl p-4 cursor-pointer flex flex-col items-center gap-2 text-center hover:border-primary hover:-translate-y-0.5 transition-all"
    >
      <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${badgeClass}`}>
        {item.type === 'folder' ? 'folder' : (item.ext || 'file')}
      </span>
      <div className="text-4xl mt-1">{getIcon(item)}</div>
      <div className="text-xs font-semibold break-all leading-snug line-clamp-2 mt-1">{item.name}</div>
      {item.type === 'file' && <div className="text-xs text-muted">{fmtSize(item.size)}</div>}
      {item.uploaded_by && (
        <div className="text-[10px] text-muted truncate w-full text-center">by {item.uploaded_by}</div>
      )}
    </div>
  )
}

// ── List view ──────────────────────────────────────────────────

function ListView({ items, onItemClick, onRightClick }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div
        className="grid text-xs uppercase tracking-widest text-muted bg-card px-4 py-2.5 border-b border-border font-semibold"
        style={{ gridTemplateColumns: '2.5rem 1fr 5.5rem 5.5rem 7.5rem 6rem' }}
      >
        <span />
        <span>Name</span>
        <span>Type</span>
        <span className="text-right">Size</span>
        <span className="text-right">Modified</span>
        <span className="text-right">Uploaded By</span>
      </div>

      {items.map((item, idx) => (
        <ListRow
          key={item.path}
          item={item}
          isLast={idx === items.length - 1}
          onClick={() => onItemClick(item)}
          onRightClick={(e) => onRightClick(e, item)}
        />
      ))}
    </div>
  )
}

function ListRow({ item, isLast, onClick, onRightClick }) {
  const badgeClass = item.type === 'folder'
    ? 'bg-purple/20 text-purple'
    : item.ext === 'pdf'
      ? 'bg-danger/20 text-danger'
      : 'bg-success/20 text-success'

  return (
    <div
      onClick={onClick}
      onContextMenu={onRightClick}
      className={`grid items-center px-4 py-3 cursor-pointer hover:bg-card transition-colors ${!isLast ? 'border-b border-border' : ''}`}
      style={{ gridTemplateColumns: '2.5rem 1fr 5.5rem 5.5rem 7.5rem 6rem' }}
    >
      <span className="text-xl">{getIcon(item)}</span>
      <span className="text-sm font-medium truncate pr-3">{item.name}</span>
      <span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded uppercase font-semibold ${badgeClass}`}>
          {item.type === 'folder' ? 'folder' : (item.ext || 'file')}
        </span>
      </span>
      <span className="text-sm text-muted text-right">{item.type === 'file' ? fmtSize(item.size) : '—'}</span>
      <span className="text-sm text-muted text-right">{fmtDate(item.modified)}</span>
      <span className="text-xs text-muted text-right truncate">{item.uploaded_by || '—'}</span>
    </div>
  )
}
