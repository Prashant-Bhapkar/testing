import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ClipboardList, Plus, Pencil, Trash2, Eye, X,
  Bold, Italic, List, ListOrdered,
  FolderOpen, MessageSquare, Server, Link2, ShieldCheck, LogOut,
  CalendarDays, UserRound, Wrench, ArrowRight, KeyRound,
} from 'lucide-react'
import ChangePasswordModal from '../auth/ChangePasswordModal'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ThemeToggle } from '../../context/ThemeContext'

// ── Helpers ───────────────────────────────────────────────────

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return div.textContent || div.innerText || ''
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ratingColor(r) {
  if (!r) return 'bg-muted/20 text-muted'
  if (r <= 3) return 'bg-red-500/15 text-red-400 border border-red-500/20'
  if (r <= 6) return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
  return 'bg-green-500/15 text-green-400 border border-green-500/20'
}

const EMPTY = {
  customer_name: '', demo_start_date: '', demo_end_date: '',
  given_by: '', developer_support: '', what_showcased: '',
  customer_inputs: '', improvement_suggestions: '', other_suggestions: '',
  confidence_rating: null,
}

// ── Rich Text Editor ──────────────────────────────────────────

function RichTextEditor({ value, onChange }) {
  const ref = useRef(null)
  const skipRef = useRef(false)

  useEffect(() => {
    if (ref.current && !skipRef.current) {
      ref.current.innerHTML = value || ''
    }
  }, [value])

  function exec(cmd) {
    ref.current?.focus()
    document.execCommand(cmd, false, null)
    skipRef.current = true
    onChange(ref.current?.innerHTML || '')
    setTimeout(() => { skipRef.current = false }, 0)
  }

  const btnCls = 'p-1.5 rounded hover:bg-card text-subtle hover:text-text transition-colors'

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex gap-0.5 px-2 py-1.5 bg-surface border-b border-border">
        <button type="button" title="Bold" onClick={() => exec('bold')} className={btnCls}><Bold size={13} /></button>
        <button type="button" title="Italic" onClick={() => exec('italic')} className={btnCls}><Italic size={13} /></button>
        <div className="w-px bg-border mx-1" />
        <button type="button" title="Bullet list" onClick={() => exec('insertUnorderedList')} className={btnCls}><List size={13} /></button>
        <button type="button" title="Numbered list" onClick={() => exec('insertOrderedList')} className={btnCls}><ListOrdered size={13} /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          skipRef.current = true
          onChange(ref.current?.innerHTML || '')
          setTimeout(() => { skipRef.current = false }, 0)
        }}
        className="min-h-[120px] max-h-[240px] overflow-y-auto p-3 text-sm text-text focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  )
}

// ── Rating Picker ─────────────────────────────────────────────

function RatingPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all border ${
            value === n
              ? n <= 3 ? 'bg-red-500 text-white border-red-500'
                : n <= 6 ? 'bg-yellow-500 text-white border-yellow-500'
                : 'bg-green-500 text-white border-green-500'
              : 'bg-card text-subtle hover:bg-border border-border'
          }`}>
          {n}
        </button>
      ))}
    </div>
  )
}

// ── Form elements ─────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-danger ml-0.5">*</span>}
    </label>
  )
}
function FInput(props) {
  return <input {...props} className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-primary/60 transition-colors" />
}
function FTextarea(props) {
  return <textarea {...props} rows={3} className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-primary/60 transition-colors resize-none" />
}

// ── Add / Edit Modal ──────────────────────────────────────────

function DemoModal({ demo, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(demo ? { ...demo } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const isEdit = !!demo?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.customer_name || !form.demo_start_date || !form.demo_end_date || !form.given_by) {
      toast('Customer name, dates, and given-by are required', 'err'); return
    }
    setSaving(true)
    try {
      if (isEdit) { await api.updateDemo(demo.id, form); toast('Updated') }
      else        { await api.createDemo(form);           toast('Saved') }
      onSaved()
    } catch (e) { toast(e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-base font-semibold text-text">{isEdit ? 'Edit Demo Feedback' : 'Add Demo Feedback'}</h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={save} className="px-6 py-5 space-y-5">
          <div>
            <Label required>Customer Name</Label>
            <FInput placeholder="e.g. BMW, TCS, Infosys" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Demo Start Date</Label>
              <FInput type="date" value={form.demo_start_date} onChange={e => set('demo_start_date', e.target.value)} />
            </div>
            <div>
              <Label required>Demo End Date</Label>
              <FInput type="date" value={form.demo_end_date} onChange={e => set('demo_end_date', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Demo Given By</Label>
              <FInput placeholder="Person name" value={form.given_by} onChange={e => set('given_by', e.target.value)} />
            </div>
            <div>
              <Label>Developer / Support</Label>
              <FInput placeholder="Who prepared the demo" value={form.developer_support || ''} onChange={e => set('developer_support', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>What Was Showcased</Label>
            <RichTextEditor
              key={isEdit ? `edit-${demo.id}` : 'new'}
              value={form.what_showcased || ''}
              onChange={v => set('what_showcased', v)}
            />
          </div>

          <div>
            <Label>Customer Inputs</Label>
            <FTextarea placeholder="What the customer said, questions they asked..." value={form.customer_inputs || ''} onChange={e => set('customer_inputs', e.target.value)} />
          </div>

          <div>
            <Label>Suggestions to Improve Platform / Product</Label>
            <FTextarea placeholder="Feature requests, usability feedback..." value={form.improvement_suggestions || ''} onChange={e => set('improvement_suggestions', e.target.value)} />
          </div>

          <div>
            <Label>Other Suggestions</Label>
            <FTextarea placeholder="Any other notes..." value={form.other_suggestions || ''} onChange={e => set('other_suggestions', e.target.value)} />
          </div>

          <div>
            <Label>Confidence Rating — How Well Did the Demo Go?</Label>
            <RatingPicker value={form.confidence_rating} onChange={v => set('confidence_rating', v)} />
            {form.confidence_rating && (
              <p className="text-xs text-muted mt-1.5">
                {form.confidence_rating <= 3 ? 'Needs improvement'
                  : form.confidence_rating <= 6 ? 'Went reasonably well'
                  : 'Excellent demo!'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border text-subtle hover:text-text hover:bg-card transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Demo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── View Modal ────────────────────────────────────────────────

function ViewModal({ demo, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text">{demo.customer_name}</h2>
            {demo.confidence_rating && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ratingColor(demo.confidence_rating)}`}>
                {demo.confidence_rating}/10
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onEdit(demo) }} className="text-muted hover:text-primary transition-colors" title="Edit">
              <Pencil size={15} />
            </button>
            <button onClick={onClose} className="text-muted hover:text-text transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <VField label="Demo Period" value={`${formatDate(demo.demo_start_date)} → ${formatDate(demo.demo_end_date)}`} />
            <VField label="Given By" value={demo.given_by} />
            {demo.developer_support && <VField label="Developer / Support" value={demo.developer_support} />}
          </div>

          {demo.what_showcased && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">What Was Showcased</p>
              <div
                className="text-sm text-text bg-card border border-border rounded-lg p-4 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: demo.what_showcased }}
              />
            </div>
          )}

          {demo.customer_inputs        && <VField label="Customer Inputs" value={demo.customer_inputs} multi />}
          {demo.improvement_suggestions && <VField label="Suggestions to Improve" value={demo.improvement_suggestions} multi />}
          {demo.other_suggestions       && <VField label="Other Suggestions" value={demo.other_suggestions} multi />}
        </div>
      </div>
    </div>
  )
}

function VField({ label, value, multi }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-text ${multi ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
    </div>
  )
}

// ── Demo Card ─────────────────────────────────────────────────

function DemoCard({ demo, onView, onEdit, onDelete }) {
  const preview = stripHtml(demo.what_showcased || '').slice(0, 180)
  const r = demo.confidence_rating

  const accentBorder = !r ? 'border-l-border' : r >= 7 ? 'border-l-green-500' : r >= 4 ? 'border-l-yellow-500' : 'border-l-red-500'
  const ratingBg = !r ? 'bg-card text-muted' : r >= 7 ? 'bg-green-500/15 text-green-400' : r >= 4 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'

  return (
    <div
      className={`bg-surface border border-border border-l-4 ${accentBorder} rounded-xl flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer`}
      onClick={() => onView(demo)}
    >
      {/* Header: name + rating */}
      <div className="p-4 pb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text truncate">{demo.customer_name}</div>
          <div className="flex items-center gap-1 text-xs text-muted mt-1">
            <CalendarDays size={11} className="shrink-0" />
            <span>{formatDate(demo.demo_start_date)}</span>
            <ArrowRight size={10} className="shrink-0 opacity-50" />
            <span>{formatDate(demo.demo_end_date)}</span>
          </div>
        </div>
        {r ? (
          <div className={`shrink-0 rounded-lg px-2.5 py-1.5 flex flex-col items-center ${ratingBg}`}>
            <span className="text-base font-black leading-none">{r}</span>
            <span className="text-[10px] font-medium opacity-60 leading-tight">/10</span>
          </div>
        ) : (
          <div className="shrink-0 rounded-lg px-2.5 py-1.5 bg-card border border-border flex flex-col items-center">
            <span className="text-base font-black leading-none text-muted">—</span>
            <span className="text-[10px] font-medium opacity-60 leading-tight">/10</span>
          </div>
        )}
      </div>

      {/* People */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs">
          <UserRound size={11} className="text-muted shrink-0" />
          <span className="text-muted font-medium w-12 shrink-0">By</span>
          <span className="text-text truncate">{demo.given_by}</span>
        </div>
        {demo.developer_support && (
          <div className="flex items-center gap-2 text-xs">
            <Wrench size={11} className="text-muted shrink-0" />
            <span className="text-muted font-medium w-12 shrink-0">Dev</span>
            <span className="text-subtle truncate">{demo.developer_support}</span>
          </div>
        )}
      </div>

      {/* Showcased preview */}
      {preview && (
        <div className="px-4 pb-3 flex-1">
          <div className="bg-card rounded-lg px-3 py-2.5 text-xs text-subtle leading-relaxed line-clamp-3">
            {preview}{stripHtml(demo.what_showcased || '').length > 180 ? '…' : ''}
          </div>
        </div>
      )}

      {/* Footer actions — always visible */}
      <div
        className="px-4 py-2.5 border-t border-border/60 flex items-center justify-between mt-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onView(demo)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
        >
          <Eye size={12} /> View details
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(demo)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(demo)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-danger transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────

function DemoSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [showChangePwd, setShowChangePwd] = useState(false)

  const navLinks = [
    { to: '/',        icon: <FolderOpen size={15} />,    label: 'Docs',   desc: 'Browse & manage files' },
    { to: '/chat',    icon: <MessageSquare size={15} />, label: 'Search', desc: 'Ask questions on docs' },
    ...(user?.role === 'admin' ? [{ to: '/systems', icon: <Server size={15} />, label: 'Health', desc: 'Monitor GitLab runners' }] : []),
    { to: '/links',   icon: <Link2 size={15} />,         label: 'Links',  desc: 'Saved hyperlinks' },
    { to: '/demo',    icon: <ClipboardList size={15} />, label: 'Demos',  desc: 'Demo feedback tracker' },
  ]

  return (
    <aside className="w-[240px] min-w-[240px] bg-surface border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text">🧠 AppEngg</span>
        <ThemeToggle />
      </div>
      <div className="px-3 pt-3 pb-1">
        <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-2">Features</div>
        {navLinks.map(({ to, icon, label, desc }) => {
          const active = location.pathname === to
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all ${
                active ? 'bg-primary/15 text-primary border border-primary/25' : 'text-subtle hover:bg-card hover:text-text border border-transparent'
              }`}>
              <span className="shrink-0">{icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">{label}</div>
                <div className={`text-xs leading-tight mt-0.5 ${active ? 'text-primary/70' : 'text-muted'}`}>{desc}</div>
              </div>
            </Link>
          )
        })}
        {user?.role === 'admin' && (
          <Link to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all ${
              location.pathname === '/admin' ? 'bg-primary/15 text-primary border border-primary/25' : 'text-subtle hover:bg-card hover:text-text border border-transparent'
            }`}>
            <span className="shrink-0"><ShieldCheck size={15} /></span>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Admin</div>
              <div className={`text-xs leading-tight mt-0.5 ${location.pathname === '/admin' ? 'text-primary/70' : 'text-muted'}`}>Logs, health & config</div>
            </div>
          </Link>
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

// ── Main Page ─────────────────────────────────────────────────

export default function DemoPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [demos, setDemos]           = useState([])
  const [customers, setCustomers]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [filter, setFilter]         = useState({ customer: '', month: '' })
  const [showAdd, setShowAdd]       = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([
        api.listDemos(filter.customer || undefined, filter.month || undefined),
        api.listDemoCustomers(),
      ])
      setDemos(d.demos)
      setCustomers(c.customers)
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleDelete(demo) {
    if (!confirm(`Delete demo feedback for "${demo.customer_name}"?`)) return
    try {
      await api.deleteDemo(demo.id)
      toast('Deleted')
      load()
    } catch (e) {
      toast(e.message, 'err')
    }
  }

  const clearFilter = () => setFilter({ customer: '', month: '' })
  const hasFilter = filter.customer || filter.month

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DemoSidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-text">Demo Feedback</h1>
            <p className="text-xs text-muted mt-0.5">
              {demos.length} record{demos.length !== 1 ? 's' : ''}{hasFilter ? ' (filtered)' : ''}
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowAdd(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} /> Add Demo
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border bg-surface/50 flex items-center gap-3 flex-wrap">
          <select
            value={filter.customer}
            onChange={e => setFilter(f => ({ ...f, customer: e.target.value }))}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-primary/60 min-w-[160px]"
          >
            <option value="">All Customers</option>
            {customers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <input
            type="month"
            value={filter.month}
            onChange={e => setFilter(f => ({ ...f, month: e.target.value }))}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-primary/60"
          />

          {hasFilter && (
            <button
              onClick={clearFilter}
              className="text-xs text-muted hover:text-text px-2 py-1.5 rounded border border-border hover:bg-card transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center text-muted py-16 text-sm">Loading…</div>
          ) : demos.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={40} className="text-muted mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted">
                {hasFilter ? 'No demos match this filter' : 'No demo feedback yet'}
              </p>
              {!hasFilter && (
                <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-primary hover:underline">
                  Add the first one
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {demos.map(d => (
                <DemoCard
                  key={d.id}
                  demo={d}
                  onView={setViewTarget}
                  onEdit={demo => { setEditTarget(demo); setShowAdd(false) }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {(showAdd || editTarget) && (
        <DemoModal
          demo={editTarget}
          onClose={() => { setShowAdd(false); setEditTarget(null) }}
          onSaved={() => { setShowAdd(false); setEditTarget(null); load() }}
        />
      )}
      {viewTarget && (
        <ViewModal
          demo={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={demo => { setViewTarget(null); setEditTarget(demo) }}
        />
      )}
    </div>
  )
}
