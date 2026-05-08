import { Home, Upload, FolderPlus, RefreshCw, MessageSquare, FolderOpen, ShieldCheck, LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar({ bucket, onRoot, onUpload, onNewFolder, onRefresh }) {
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside className="w-[240px] min-w-[240px] bg-surface border-r border-border flex flex-col">
      {/* App header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text">🧠 AppEngg</span>
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
        {user?.role === 'admin' && (
          <FeatureLink
            to="/admin"
            icon={<ShieldCheck size={15} />}
            label="Admin"
            desc="Logs, health & config"
            active={location.pathname === '/admin'}
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="px-2 flex-1 pt-3 border-t border-border mt-2">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-1.5">Quick Actions</div>
        <NavItem icon={<Home size={15} />}       label="Root"         onClick={onRoot} />
        <NavItem icon={<Upload size={15} />}     label="Upload Files" onClick={onUpload} />
        <NavItem icon={<FolderPlus size={15} />} label="New Folder"   onClick={onNewFolder} />
        <NavItem icon={<RefreshCw size={15} />}  label="Refresh"      onClick={onRefresh} />
      </div>

      {/* User info + logout */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text truncate">{user?.username}</div>
            <div className="text-[11px] text-muted capitalize">{user?.role}</div>
          </div>
        </div>
        <NavItem icon={<LogOut size={15} />} label="Sign Out" onClick={logout} />
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
