import { useState, useRef, useEffect } from 'react'
import { KeyRound, LogOut, ChevronUp } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ChangePasswordModal from '../auth/ChangePasswordModal'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-card transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-xs font-semibold text-text truncate">{user?.username}</div>
          <div className="text-[11px] text-muted capitalize">{user?.role}</div>
        </div>
        <ChevronUp
          size={13}
          className={`text-muted transition-transform duration-200 shrink-0 ${open ? '' : 'rotate-180'}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-surface border border-border rounded-xl shadow-xl py-1.5 z-50">
          <div className="px-3 py-2 border-b border-border mb-1">
            <div className="text-xs font-semibold text-text">{user?.username}</div>
            <div className="text-[11px] text-muted capitalize">{user?.role}</div>
          </div>
          <button
            onClick={() => { setShowChangePwd(true); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-subtle hover:bg-card hover:text-text transition-colors"
          >
            <KeyRound size={14} /> Change Password
          </button>
          <div className="mx-2 my-1 border-t border-border" />
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-subtle hover:bg-danger/10 hover:text-danger transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  )
}
