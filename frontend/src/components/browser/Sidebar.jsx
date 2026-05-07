import { Home, Upload, FolderPlus, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Sidebar({ bucket, rootItems, currentItems, onRoot, onUpload, onNewFolder, onRefresh }) {
  return (
    <aside className="w-[220px] min-w-[220px] bg-surface border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="text-base font-bold">🗄️ RAG Docs</div>
        <div className="text-[11px] text-muted mt-0.5">MinIO File Browser</div>
        <div className="mt-2.5 px-2.5 py-1.5 bg-card border border-border rounded-md text-[11px] text-primary flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success" style={{ animation: 'pulse 2s infinite' }} />
          {bucket}
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2.5 border-b border-border flex gap-2">
        <StatCard value={rootItems} label="Root" />
        <StatCard value={currentItems} label="Here" />
      </div>

      {/* Nav */}
      <div className="p-2 flex-1">
        <div className="text-[9px] uppercase tracking-widest text-muted px-1.5 mb-1.5">Quick Actions</div>
        <NavItem icon={<Home size={14} />} label="Root" onClick={onRoot} />
        <NavItem icon={<Upload size={14} />} label="Upload Files" onClick={onUpload} />
        <NavItem icon={<FolderPlus size={14} />} label="New Folder" onClick={onNewFolder} />
        <NavItem icon={<RefreshCw size={14} />} label="Refresh" onClick={onRefresh} />
      </div>

      {/* Bottom nav */}
      <div className="p-2 border-t border-border">
        <Link
          to="/chat"
          className="flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-subtle hover:bg-card hover:text-text transition-colors"
        >
          🧠 RAG Search
        </Link>
      </div>
    </aside>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="flex-1 bg-card rounded-md p-2 text-center">
      <div className="text-[15px] font-bold text-primary">{value ?? '—'}</div>
      <div className="text-[9px] text-muted uppercase">{label}</div>
    </div>
  )
}

function NavItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-subtle hover:bg-card hover:text-text transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}
