import { X, Trash2 } from 'lucide-react'

export default function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-[360px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">🗑️ Confirm Delete</h2>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>
        <p className="text-sm text-subtle mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-danger text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}
