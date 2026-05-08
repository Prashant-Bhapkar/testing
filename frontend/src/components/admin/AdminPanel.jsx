import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggle } from '../../context/ThemeContext'
import {
  Activity, FileText, Settings, Users, RefreshCw, Trash2,
  ChevronDown, ChevronUp, FolderOpen, MessageSquare, ShieldCheck,
  LogOut, PlusCircle, Edit2, Check, X, RotateCcw,
} from 'lucide-react'

const LEVEL_COLORS = {
  ERROR:   'text-danger bg-danger/10',
  WARNING: 'text-yellow-500 bg-yellow-500/10',
  INFO:    'text-primary bg-primary/10',
  DEBUG:   'text-muted bg-card',
}

export default function AdminPanel() {
  const [tab, setTab] = useState('health')

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <AdminSidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="h-14 flex items-center gap-4 px-5 border-b border-border bg-surface shrink-0">
          <ShieldCheck size={18} className="text-primary" />
          <span className="text-base font-bold">Admin Panel</span>
          <div className="flex-1" />
          <div className="flex gap-1 bg-card border border-border rounded-lg overflow-hidden">
            {[
              { id: 'health', icon: <Activity size={13} />, label: 'Health' },
              { id: 'logs',   icon: <FileText size={13} />, label: 'Logs' },
              { id: 'config', icon: <Settings size={13} />, label: 'Config' },
              { id: 'users',  icon: <Users size={13} />,    label: 'Users' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-primary text-white' : 'text-muted hover:text-text'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'health' && <HealthTab />}
          {tab === 'logs'   && <LogsTab />}
          {tab === 'config' && <ConfigTab />}
          {tab === 'users'  && <UsersTab />}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────

function AdminSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside className="w-[220px] min-w-[220px] bg-surface border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text">🧠 DocIQ</span>
        <ThemeToggle />
      </div>

      <div className="px-3 pt-3 pb-1">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-2">Features</div>
        <SideLink to="/"      icon={<FolderOpen size={14} />}   label="Docs"   active={location.pathname === '/'} />
        <SideLink to="/chat"  icon={<MessageSquare size={14} />} label="Search" active={location.pathname === '/chat'} />
        <SideLink to="/admin" icon={<ShieldCheck size={14} />}   label="Admin"  active={location.pathname === '/admin'} />
      </div>

      <div className="mt-auto px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text truncate">{user?.username}</div>
            <div className="text-[11px] text-muted capitalize">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-subtle hover:bg-card hover:text-danger transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

function SideLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 transition-all ${
        active
          ? 'bg-primary/15 text-primary border border-primary/25'
          : 'text-subtle hover:bg-card hover:text-text border border-transparent'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

// ── Health Tab ─────────────────────────────────────────────────

function HealthTab() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.adminHealth())
    } catch (e) {
      setData({ error: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const services = data
    ? [
        { name: 'API Server',  status: data.api,    icon: '🖥️' },
        { name: 'MinIO',       status: data.minio,  icon: '🪣' },
        { name: 'Qdrant',      status: data.qdrant, icon: '🔍' },
        { name: 'AI / LLM',   status: data.ai,     icon: '🤖' },
      ]
    : []

  return (
    <div>
      <SectionHeader title="Service Health" onRefresh={load} loading={loading} />
      {data?.error ? (
        <div className="text-sm text-danger">{data.error}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {services.map(s => (
            <div key={s.name} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="text-sm font-semibold text-text">{s.name}</div>
                <div className={`text-xs mt-0.5 ${s.status === 'ok' ? 'text-success' : 'text-danger'}`}>
                  {s.status === 'ok' ? '● Online' : `● ${s.status || 'Unknown'}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Logs Tab ───────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs]     = useState([])
  const [level, setLevel]   = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await api.adminLogs(300, level))
    } catch (e) {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => { load() }, [load])

  async function clearAll() {
    await api.clearLogs()
    setLogs([])
  }

  return (
    <div>
      <SectionHeader title="Application Logs" onRefresh={load} loading={loading}>
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none"
        >
          <option value="">All levels</option>
          <option value="ERROR">ERROR</option>
          <option value="WARNING">WARNING</option>
          <option value="INFO">INFO</option>
          <option value="DEBUG">DEBUG</option>
        </select>
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/40 text-danger text-xs hover:bg-danger/10 transition-colors"
        >
          <Trash2 size={12} /> Clear
        </button>
      </SectionHeader>

      <div className="mt-4 rounded-xl border border-border overflow-hidden">
        <div className="grid text-[11px] uppercase tracking-widest text-muted bg-card px-4 py-2 border-b border-border font-semibold"
          style={{ gridTemplateColumns: '10rem 5rem 12rem 1fr' }}>
          <span>Time</span>
          <span>Level</span>
          <span>Logger</span>
          <span>Message</span>
        </div>
        {logs.length === 0 ? (
          <div className="text-sm text-muted px-4 py-6 text-center">{loading ? 'Loading…' : 'No logs found'}</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              onClick={() => setExpanded(expanded === i ? null : i)}
              className={`grid items-start px-4 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-card transition-colors text-xs`}
              style={{ gridTemplateColumns: '10rem 5rem 12rem 1fr' }}
            >
              <span className="text-muted font-mono shrink-0">{log.ts?.slice(0, 19)}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${LEVEL_COLORS[log.level] || 'text-muted'}`}>
                {log.level}
              </span>
              <span className="text-muted truncate pr-2">{log.logger}</span>
              <span className={`text-subtle break-words ${expanded === i ? '' : 'truncate'}`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Config Tab ─────────────────────────────────────────────────

function ConfigTab() {
  const [configs, setConfigs]   = useState([])
  const [editing, setEditing]   = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setConfigs(await api.adminConfig()) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(key) {
    setSaving(true)
    try {
      await api.setConfig(key, editVal)
      setEditing(null)
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function reset(key) {
    await api.resetConfig(key)
    load()
  }

  return (
    <div>
      <SectionHeader title="Application Config" onRefresh={load} loading={loading}>
        <div className="text-xs text-muted bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 px-2.5 py-1 rounded-lg">
          ⚠️ Restart server to apply changes
        </div>
      </SectionHeader>

      <div className="mt-4 rounded-xl border border-border overflow-hidden">
        <div className="grid text-[11px] uppercase tracking-widest text-muted bg-card px-4 py-2 border-b border-border font-semibold"
          style={{ gridTemplateColumns: '14rem 1fr 14rem 6rem' }}>
          <span>Key</span>
          <span>Description</span>
          <span>Value</span>
          <span className="text-right">Actions</span>
        </div>

        {configs.map(cfg => (
          <div
            key={cfg.key}
            className="grid items-center px-4 py-2.5 border-b border-border last:border-0 text-xs"
            style={{ gridTemplateColumns: '14rem 1fr 14rem 6rem' }}
          >
            <span className="font-mono text-subtle font-semibold">{cfg.key}</span>
            <span className="text-muted pr-3 truncate">{cfg.description}</span>

            <div className="pr-3">
              {editing === cfg.key ? (
                <input
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  className="w-full bg-bg border border-primary rounded px-2 py-1 text-xs outline-none font-mono"
                  placeholder={cfg.sensitive ? '(hidden)' : cfg.effective_value || '—'}
                />
              ) : (
                <span className={`font-mono truncate block ${cfg.has_db_override ? 'text-primary font-semibold' : 'text-subtle'}`}>
                  {cfg.effective_value || <span className="text-muted italic">not set</span>}
                  {cfg.has_db_override && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">DB</span>}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-1">
              {editing === cfg.key ? (
                <>
                  <IconBtn icon={<Check size={13} />} onClick={() => save(cfg.key)} disabled={saving} title="Save" success />
                  <IconBtn icon={<X size={13} />} onClick={() => setEditing(null)} title="Cancel" />
                </>
              ) : (
                <>
                  <IconBtn
                    icon={<Edit2 size={12} />}
                    onClick={() => { setEditing(cfg.key); setEditVal('') }}
                    title="Edit"
                  />
                  {cfg.has_db_override && (
                    <IconBtn icon={<RotateCcw size={12} />} onClick={() => reset(cfg.key)} title="Reset to .env" />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Users Tab ──────────────────────────────────────────────────

function UsersTab() {
  const { user: me } = useAuth()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newUser, setNewUser]   = useState({ username: '', password: '', role: 'user' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setUsers(await api.listUsers()) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function createUser(e) {
    e.preventDefault()
    if (!newUser.username.trim() || !newUser.password) return
    setCreating(true)
    try {
      await api.createUser(newUser.username.trim(), newUser.password, newUser.role)
      setNewUser({ username: '', password: '', role: 'user' })
      setShowForm(false)
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function deleteUser(username) {
    if (!confirm(`Delete user "${username}"?`)) return
    await api.deleteUser(username)
    load()
  }

  return (
    <div>
      <SectionHeader title="User Management" onRefresh={load} loading={loading}>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:opacity-90 transition-opacity"
        >
          <PlusCircle size={13} /> Add User
        </button>
      </SectionHeader>

      {showForm && (
        <form onSubmit={createUser} className="mt-4 bg-surface border border-border rounded-xl p-4 flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted uppercase tracking-wide">Username</label>
            <input
              value={newUser.username}
              onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))}
              placeholder="username"
              className="bg-card border border-border rounded px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={newUser.password}
              onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
              placeholder="password"
              className="bg-card border border-border rounded px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted uppercase tracking-wide">Role</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}
              className="bg-card border border-border rounded px-2.5 py-2 text-sm outline-none"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted hover:text-text">
            Cancel
          </button>
        </form>
      )}

      <div className="mt-4 rounded-xl border border-border overflow-hidden">
        <div className="grid text-[11px] uppercase tracking-widest text-muted bg-card px-4 py-2 border-b border-border font-semibold"
          style={{ gridTemplateColumns: '1fr 6rem 12rem 5rem' }}>
          <span>Username</span>
          <span>Role</span>
          <span>Created</span>
          <span className="text-right">Actions</span>
        </div>
        {users.map(u => (
          <div
            key={u.username}
            className="grid items-center px-4 py-3 border-b border-border last:border-0 text-sm"
            style={{ gridTemplateColumns: '1fr 6rem 12rem 5rem' }}
          >
            <span className="font-medium text-text flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {u.username[0]?.toUpperCase()}
              </div>
              {u.username}
              {u.username === me?.username && <span className="text-[10px] text-muted">(you)</span>}
            </span>
            <span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                u.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success'
              }`}>
                {u.role}
              </span>
            </span>
            <span className="text-muted text-xs">{u.created_at?.slice(0, 10)}</span>
            <div className="flex justify-end">
              {u.username !== me?.username && (
                <button
                  onClick={() => deleteUser(u.username)}
                  className="text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors"
                  title="Delete user"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────

function SectionHeader({ title, onRefresh, loading, children }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h2 className="text-base font-bold text-text">{title}</h2>
      <div className="flex-1" />
      {children}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted text-xs hover:text-text hover:bg-card transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
      </button>
    </div>
  )
}

function IconBtn({ icon, onClick, title, disabled, success }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        success
          ? 'text-success hover:bg-success/10'
          : 'text-muted hover:bg-card hover:text-text'
      }`}
    >
      {icon}
    </button>
  )
}
