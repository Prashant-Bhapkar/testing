import { useState } from 'react'
import { X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { api } from '../../api'
import { useToast } from '../../context/ToastContext'

export default function ChangePasswordModal({ onClose }) {
  const toast = useToast()
  const [form, setForm]     = useState({ old_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [show, setShow]     = useState({ old: false, new: false, confirm: false })

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleShow = (k)    => setShow(s => ({ ...s, [k]: !s[k] }))

  async function submit(e) {
    e.preventDefault()
    if (!form.old_password || !form.new_password || !form.confirm) {
      toast('All fields are required', 'err'); return
    }
    if (form.new_password !== form.confirm) {
      toast('New passwords do not match', 'err'); return
    }
    if (form.new_password.length < 6) {
      toast('Password must be at least 6 characters', 'err'); return
    }
    setSaving(true)
    try {
      await api.changePassword(form.old_password, form.new_password)
      toast('Password changed successfully', 'ok')
      onClose()
    } catch (err) {
      toast(err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { label: 'Current Password',     key: 'old_password', showKey: 'old' },
    { label: 'New Password',         key: 'new_password', showKey: 'new' },
    { label: 'Confirm New Password', key: 'confirm',      showKey: 'confirm' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-primary" />
            <span className="text-sm font-semibold text-text">Change Password</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-4">
          {fields.map(({ label, key, showKey }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="relative">
                <input
                  type={show[showKey] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text pr-9 focus:outline-none focus:border-primary/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => toggleShow(showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                >
                  {show[showKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-subtle hover:text-text hover:bg-card transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
