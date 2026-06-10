import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Server, Plus, Trash2, RefreshCw, CheckCircle, XCircle,
  Wifi, WifiOff, RotateCcw, X, FolderOpen, MessageSquare,
  ShieldCheck, Link2, LogOut, Loader,
} from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ThemeToggle } from '../../context/ThemeContext'

export default function SystemsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [systems, setSystems]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [statuses, setStatuses]     = useState({})   // { [id]: { ping, runner_connected, runner_running, runner_output, checking } }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.listSystems()
      setSystems(d.systems)
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function checkSystem(id) {
    setStatuses(s => ({ ...s, [id]: { ...s[id], checking: true } }))
    try {
      const d = await api.checkSystem(id)
      setStatuses(s => ({ ...s, [id]: { ...d, checking: false } }))
    } catch (e) {
      toast(e.message, 'err')
      setStatuses(s => ({ ...s, [id]: { ...s[id], checking: false } }))
    }
  }

  async function restartRunner(id) {
    setStatuses(s => ({ ...s, [id]: { ...s[id], restarting: true } }))
    try {
      const d = await api.restartRunner(id)
      toast(d.success ? 'Runner restarted successfully' : `Restart failed: ${d.output}`, d.success ? 'ok' : 'err')
      if (d.success) checkSystem(id)
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setStatuses(s => ({ ...s, [id]: { ...s[id], restarting: false } }))
    }
  }

  async function deleteSystem(id) {
    if (!confirm('Delete this system?')) return
    try {
      await api.deleteSystem(id)
      toast('System removed', 'ok')
      setSystems(s => s.filter(x => x.id !== id))
      setStatuses(s => { const n = { ...s }; delete n[id]; return n })
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <SystemsSidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border bg-surface shrink-0">
          <Server size={18} className="text-primary" />
          <span className="text-base font-bold">System Health</span>
          <div className="flex-1" />
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={14} /> Add System
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-muted">
              <div className="spinner" /><span className="text-sm">Loading…</span>
            </div>
          ) : systems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
              <Server size={36} className="opacity-30" />
              <span className="text-sm">No systems added yet</span>
              {isAdmin && (
                <button onClick={() => setShowAdd(true)} className="btn-primary text-sm mt-1 flex items-center gap-1.5">
                  <Plus size={13} /> Add your first system
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {systems.map(sys => (
                <SystemCard
                  key={sys.id}
                  sys={sys}
                  status={statuses[sys.id]}
                  isAdmin={isAdmin}
                  onCheck={() => checkSystem(sys.id)}
                  onRestart={() => restartRunner(sys.id)}
                  onDelete={() => deleteSystem(sys.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddSystemModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

// ── System Card ────────────────────────────────────────────────

function SystemCard({ sys, status, isAdmin, onCheck, onRestart, onDelete }) {
  const tags = sys.runner_tags ? sys.runner_tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={16} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-text truncate">
            {sys.hostname || sys.ip}
          </span>
        </div>
        {isAdmin && (
          <button onClick={onDelete} className="text-muted hover:text-danger transition-colors shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <InfoRow label="IP" value={sys.ip} />
        <InfoRow label="User" value={sys.username} />
        {sys.hostname && <InfoRow label="Host" value={sys.hostname} />}
      </div>

      {/* Runner tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Status indicators */}
      {status && !status.checking && (
        <div className="flex gap-3 pt-1 border-t border-border">
          <StatusDot label="Ping" ok={status.ping} />
          <StatusDot label="SSH" ok={status.runner_connected} />
          <StatusDot label="Runner" ok={status.runner_running} />
          {status.runner_output && (
            <span className="text-[10px] text-muted truncate ml-auto">{status.runner_output}</span>
          )}
        </div>
      )}
      {status?.checking && (
        <div className="flex items-center gap-2 pt-1 border-t border-border text-xs text-muted">
          <Loader size={12} className="animate-spin" /> Checking…
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onCheck}
          disabled={status?.checking}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-subtle hover:bg-card hover:text-text transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={status?.checking ? 'animate-spin' : ''} />
          Check Now
        </button>
        {isAdmin && (
          <button
            onClick={onRestart}
            disabled={status?.restarting || status?.checking}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={12} className={status?.restarting ? 'animate-spin' : ''} />
            {status?.restarting ? 'Restarting…' : 'Restart Runner'}
          </button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted uppercase tracking-wide text-[10px] shrink-0">{label}</span>
      <span className="text-subtle truncate">{value}</span>
    </div>
  )
}

function StatusDot({ label, ok }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {ok
        ? <CheckCircle size={12} className="text-success" />
        : <XCircle size={12} className="text-danger" />}
      <span className={ok ? 'text-success' : 'text-danger'}>{label}</span>
    </div>
  )
}

// ── Add System Modal ───────────────────────────────────────────

function AddSystemModal({ onClose, onSuccess, toast }) {
  const [form, setForm] = useState({ runner_tags: '', hostname: '', ip: '', username: '', password: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.ip || !form.username || !form.password || !form.runner_tags) {
      toast('Runner tags, IP, username and password are required', 'err')
      return
    }
    setSaving(true)
    try {
      await api.addSystem(form)
      toast('System added', 'ok')
      onSuccess()
    } catch (err) {
      toast(err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-2xl w-[460px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-bold text-text">Add System</span>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <Field label="Runner Tags *" placeholder="e.g. kineto, cicd-groups" value={form.runner_tags} onChange={v => set('runner_tags', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hostname" placeholder="Ph3Jxxxx" value={form.hostname} onChange={v => set('hostname', v)} />
            <Field label="IP Address *" placeholder="10.x.x.x" value={form.ip} onChange={v => set('ip', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username *" placeholder="user" value={form.username} onChange={v => set('username', v)} />
            <Field label="Password *" placeholder="••••••" type="password" value={form.password} onChange={v => set('password', v)} />
          </div>
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-subtle hover:bg-card">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary text-sm font-semibold disabled:opacity-60">
              {saving ? 'Saving…' : 'Add System'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted uppercase tracking-wide">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-primary"
      />
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────

function SystemsSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside className="w-[240px] min-w-[240px] bg-surface border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text">🧠 AppEngg</span>
        <ThemeToggle />
      </div>
      <div className="px-3 pt-3 pb-1">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-2">Features</div>
        <NavLink to="/"        icon={<FolderOpen size={15} />}    label="Docs"    desc="Browse & manage files"   active={location.pathname === '/'} />
        <NavLink to="/chat"    icon={<MessageSquare size={15} />} label="Search"  desc="Ask questions on docs"   active={location.pathname === '/chat'} />
        <NavLink to="/systems" icon={<Server size={15} />}        label="Health"  desc="Monitor GitLab runners"  active={location.pathname === '/systems'} />
        <NavLink to="/links"   icon={<Link2 size={15} />}         label="Links"   desc="Saved hyperlinks"        active={location.pathname === '/links'} />
        {user?.role === 'admin' && (
          <NavLink to="/admin" icon={<ShieldCheck size={15} />}   label="Admin"   desc="Logs, health & config"   active={location.pathname === '/admin'} />
        )}
      </div>
      <div className="mt-auto px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text truncate">{user?.username}</div>
            <div className="text-[11px] text-muted capitalize">{user?.role}</div>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

function NavLink({ to, icon, label, desc, active }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all ${
      active ? 'bg-primary/15 text-primary border border-primary/25'
             : 'text-subtle hover:bg-card hover:text-text border border-transparent'
    }`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        <div className={`text-xs leading-tight mt-0.5 ${active ? 'text-primary/70' : 'text-muted'}`}>{desc}</div>
      </div>
    </Link>
  )
}
