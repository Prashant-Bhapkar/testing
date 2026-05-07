import { X, Download } from 'lucide-react'
import { api } from '../../api'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg']

export default function PreviewModal({ path, name, onClose }) {
  const ext = name.split('.').pop().toLowerCase()
  const url = api.previewUrl(path)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border rounded-xl w-[82vw] max-w-[880px] max-h-[86vh] flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-[13px] font-bold truncate">{name}</span>
          <div className="flex items-center gap-2">
            <a
              href={api.download(path)}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <Download size={13} /> Download
            </a>
            <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {IMAGE_EXTS.includes(ext) ? (
            <img src={url} alt={name} className="max-w-full max-h-[75vh] block mx-auto p-4" />
          ) : (
            <iframe src={url} title={name} className="w-full h-full min-h-[480px] border-none" />
          )}
        </div>
      </div>
    </div>
  )
}
