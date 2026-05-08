import { Home, Upload, FolderPlus, RefreshCw, MessageSquare, FolderOpen } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../../context/ThemeContext'

export default function Sidebar({ bucket, onRoot, onUpload, onNewFolder, onRefresh }) {
  const location = useLocation()

  return (
    <aside className="w-[240px] min-w-[240px] bg-surface border-r border-border flex flex-col">
      {/* App header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text">🧠 DocIQ</span>
        <ThemeToggle />
      </div>

      {/* Feature nav */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-2">Features</div>
        <FeatureLink
          to="/"
          icon={<FolderOpen size={15} />}
          label="Docs"
          desc="Browse & manage files"
          active={location.pathname === '/'}
        />
        <FeatureLink
          to="/chat"
          icon={<MessageSquare size={15} />}
          label="Search"
          desc="Ask questions on docs"
          active={location.pathname === '/chat'}
        />
      </div>

      {/* Bucket badge */}
      <div className="px-3 pt-1 pb-3 border-b border-border">
        <div className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" style={{ animation: 'pulse 2s infinite' }} />
          <span className="truncate">{bucket}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-2 flex-1 pt-2">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-1.5">Quick Actions</div>
        <NavItem icon={<Home size={15} />}       label="Root"         onClick={onRoot} />
        <NavItem icon={<Upload size={15} />}     label="Upload Files" onClick={onUpload} />
        <NavItem icon={<FolderPlus size={15} />} label="New Folder"   onClick={onNewFolder} />
        <NavItem icon={<RefreshCw size={15} />}  label="Refresh"      onClick={onRefresh} />
      </div>
    </aside>
  )
}

function FeatureLink({ to, icon, label, desc, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all ${
        active
          ? 'bg-primary/15 text-primary border border-primary/25'
          : 'text-subtle hover:bg-card hover:text-text border border-transparent'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        <div className={`text-xs leading-tight mt-0.5 ${active ? 'text-primary/70' : 'text-muted'}`}>{desc}</div>
      </div>
    </Link>
  )
}

function NavItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}
