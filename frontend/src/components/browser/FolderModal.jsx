import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../../api'

export default function FolderModal({ prefix, onClose, onSuccess, toast }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function create() {
    if (!name.trim()) { toast('Enter a folder name', 'err'); return }
    setLoading(true)
    try {
      await api.createFolder(prefix, name.trim())
      toast(`Folder "${name}" created!`, 'ok')
      onClose()
      onSuccess()
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-[360px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">📁 Create New Folder</h2>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>

        <label className="block text-[11px] text-subtle mb-1">Folder name</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="e.g. reports-2025"
          className="modal-input"
        />

        <label className="block text-[11px] text-subtle mb-1">Inside path</label>
        <input value={prefix || '(root)'} readOnly className="modal-input opacity-60" />

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button onClick={create} disabled={loading} className="btn-primary text-xs">
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
