import { X, Trash2 } from 'lucide-react'

export default function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-[340px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">🗑️ Confirm Delete</h2>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-subtle mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-danger text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}
