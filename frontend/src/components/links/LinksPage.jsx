import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Link2, ExternalLink, Plus, Trash2, X,
  FolderOpen, MessageSquare, ShieldCheck, Server, LogOut, ClipboardList, KeyRound,
} from 'lucide-react'
import ChangePasswordModal from '../auth/ChangePasswordModal'
import Pagination from '../shared/Pagination'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ThemeToggle } from '../../context/ThemeContext'

const ENV_COLORS = {
  prod:       'bg-danger/15 text-danger',
  production: 'bg-danger/15 text-danger',
  staging:    'bg-yellow-500/15 text-yellow-500',
  stage:      'bg-yellow-500/15 text-yellow-500',
  dev:        'bg-success/15 text-success',
  development:'bg-success/15 text-success',
  qa:         'bg-purple/15 text-purple',
  test:       'bg-purple/15 text-purple',
}

function envColor(env) {
  return ENV_COLORS[(env || '').toLowerCase()] || 'bg-primary/10 text-primary'
}

const PAGE_SIZE = 20

export default function LinksPage() {
  const toast = useToast()
  const { user } = useAuth()

  const [links, setLinks]     = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter]   = useState({ env: '', tag: '' })
  const [page, setPage]       = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.listLinks()
      setLinks(d.links)
      setPage(1)
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter])

  async function deleteLink(id) {
    try {
      await api.deleteLink(id)
      toast('Link removed', 'ok')
      setLinks(l => l.filter(x => x.id !== id))
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  // Collect unique filter values
  const allEnvs = [...new Set(links.map(l => l.env).filter(Boolean))]
  const allTags = [...new Set(links.map(l => l.tag).filter(Boolean))]

  const visible = links.filter(l => {
    if (filter.env && l.env !== filter.env) return false
    if (filter.tag && l.tag !== filter.tag) return false
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <LinksSidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border bg-surface shrink-0">
          <Link2 size={18} className="text-primary" />
          <span className="text-base font-bold">Hyperlinks</span>
          <div className="flex-1" />
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={14} /> Add Link
          </button>
        </div>

        {/* Filters */}
        {(allEnvs.length > 0 || allTags.length > 0) && (
          <div className="px-5 py-2.5 border-b border-border bg-surface shrink-0 flex items-center gap-3 flex-wrap">
            {allEnvs.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>Env:</span>
                <button onClick={() => setFilter(f => ({ ...f, env: '' }))} className={`px-2 py-0.5 rounded-full border ${!filter.env ? 'border-primary text-primary' : 'border-border text-muted hover:text-text'}`}>All</button>
                {allEnvs.map(e => (
                  <button key={e} onClick={() => setFilter(f => ({ ...f, env: f.env === e ? '' : e }))}
                    className={`px-2 py-0.5 rounded-full border ${filter.env === e ? 'border-primary text-primary' : 'border-border text-muted hover:text-text'}`}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>Tag:</span>
                <button onClick={() => setFilter(f => ({ ...f, tag: '' }))} className={`px-2 py-0.5 rounded-full border ${!filter.tag ? 'border-primary text-primary' : 'border-border text-muted hover:text-text'}`}>All</button>
                {allTags.map(t => (
                  <button key={t} onClick={() => setFilter(f => ({ ...f, tag: f.tag === t ? '' : t }))}
                    className={`px-2 py-0.5 rounded-full border ${filter.tag === t ? 'border-primary text-primary' : 'border-border text-muted hover:text-text'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-muted">
              <div className="spinner" /><span className="text-sm">Loading…</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
              <Link2 size={36} className="opacity-30" />
              <span className="text-sm">{links.length === 0 ? 'No links added yet' : 'No links match the current filter'}</span>
              {links.length === 0 && (
                <button onClick={() => setShowAdd(true)} className="btn-primary text-sm mt-1 flex items-center gap-1.5">
                  <Plus size={13} /> Add your first link
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(link => (
                  <LinkCard key={link.id} link={link} onDelete={() => deleteLink(link.id)} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={Math.ceil(visible.length / PAGE_SIZE)}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <AddLinkModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

// ── Link Card ──────────────────────────────────────────────────

function LinkCard({ link, onDelete }) {
  function openLink() {
    let url = link.url
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-primary transition-colors group">
      {/* Name + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={14} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-text truncate">{link.name}</span>
        </div>
        <button onClick={onDelete} className="text-muted hover:text-danger transition-colors shrink-0 opacity-0 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>

      {/* URL */}
      <div className="text-xs text-muted truncate" title={link.url}>{link.url}</div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {link.env && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase ${envColor(link.env)}`}>
            {link.env}
          </span>
        )}
        {link.tag && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-card text-muted border border-border font-medium">
            {link.tag}
          </span>
        )}
      </div>

      {/* Open button */}
      <button
        onClick={openLink}
        className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
      >
        <ExternalLink size={12} /> Open Link
      </button>
    </div>
  )
}

// ── Add Link Modal ─────────────────────────────────────────────

function AddLinkModal({ onClose, onSuccess, toast }) {
  const [form, setForm] = useState({ name: '', url: '', env: '', tag: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name || !form.url) { toast('Name and URL are required', 'err'); return }
    setSaving(true)
    try {
      await api.addLink(form)
      toast('Link added', 'ok')
      onSuccess()
    } catch (err) {
      toast(err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-2xl w-[420px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-bold text-text">Add Hyperlink</span>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <Field label="Name *" placeholder="CI Dashboard" value={form.name} onChange={v => set('name', v)} />
          <Field label="URL *" placeholder="https://..." value={form.url} onChange={v => set('url', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Environment" placeholder="prod / staging / dev" value={form.env} onChange={v => set('env', v)} />
            <Field label="Tag" placeholder="ci / monitoring" value={form.tag} onChange={v => set('tag', v)} />
          </div>
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-subtle hover:bg-card">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary text-sm font-semibold disabled:opacity-60">
              {saving ? 'Saving…' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, placeholder, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted uppercase tracking-wide">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted outline-none focus:border-primary"
      />
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────

function LinksSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [showChangePwd, setShowChangePwd] = useState(false)

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
        {user?.role === 'admin' && (
          <NavLink to="/systems" icon={<Server size={15} />} label="Health" desc="Monitor GitLab runners" active={location.pathname === '/systems'} />
        )}
        <NavLink to="/links"   icon={<Link2 size={15} />}         label="Links"   desc="Saved hyperlinks"        active={location.pathname === '/links'} />
        <NavLink to="/demo"    icon={<ClipboardList size={15} />} label="Demos"   desc="Demo feedback tracker"   active={location.pathname === '/demo'} />
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
        <button onClick={() => setShowChangePwd(true)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors">
          <KeyRound size={15} /> Change Password
        </button>
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors">
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
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
