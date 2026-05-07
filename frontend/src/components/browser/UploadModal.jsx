import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { api } from '../../api'

const ICONS = { pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', txt: '📃', md: '📃', csv: '📃', docx: '📝', zip: '🗜️' }

function fmtSize(b) {
  if (!b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function UploadModal({ prefix, onClose, onSuccess, toast }) {
  const [files, setFiles]         = useState([])
  const [statuses, setStatuses]   = useState({}) // index → 'pending'|'uploading'|'ok'|'ok-queued'|'err'
  const [progresses, setProgresses] = useState({}) // index → 0-100
  const [uploading, setUploading] = useState(false)
  const [over, setOver]           = useState(false)
  const inputRef = useRef()

  function addFiles(newFiles) {
    setFiles(prev => [...prev, ...newFiles])
  }

  function onDrop(e) {
    e.preventDefault()
    setOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function doUpload() {
    setUploading(true)
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      setStatuses(s => ({ ...s, [i]: 'uploading' }))
      setProgresses(p => ({ ...p, [i]: 0 }))
      try {
        const data = await api.upload(prefix, files[i], (pct) => {
          setProgresses(p => ({ ...p, [i]: pct }))
        })
        const emb = data.embedding
        const status = emb?.status === 'queued'
          ? 'ok-queued'
          : emb?.status === 'embedded'
            ? 'ok-queued'
            : 'ok'
        setStatuses(s => ({ ...s, [i]: status }))
        setProgresses(p => ({ ...p, [i]: 100 }))
        ok++
      } catch {
        setStatuses(s => ({ ...s, [i]: 'err' }))
      }
    }
    toast(`Uploaded ${ok}/${files.length} files`, ok === files.length ? 'ok' : 'err')
    setTimeout(() => { onClose(); onSuccess() }, 800)
  }

  const statusIcon = {
    pending: '⏳', uploading: null, ok: '✅',
    'ok-queued': '✅ 🔄', err: '❌',
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-[440px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Upload Files</h2>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer mb-3 transition-colors
            ${over ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'}`}
        >
          <div className="text-3xl mb-2">📂</div>
          <div className="text-sm text-subtle">Click or drag & drop files here</div>
          <div className="text-xs text-muted mt-1">PDF, TXT, MD, CSV, DOCX and more</div>
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => addFiles(Array.from(e.target.files))} />

        <div className="text-xs text-muted mb-2">Upload to: <span className="text-subtle">{prefix || '(root)'}</span></div>

        {/* File list */}
        {files.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1.5 mb-4">
            {files.map((f, i) => {
              const ext     = f.name.split('.').pop().toLowerCase()
              const status  = statuses[i] || 'pending'
              const pct     = progresses[i] ?? 0
              return (
                <div key={i} className="flex flex-col gap-1 px-2.5 py-1.5 bg-card rounded-md text-xs">
                  <div className="flex items-center gap-2">
                    <span>{ICONS[ext] || '📄'}</span>
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted">{fmtSize(f.size)}</span>
                    <span>{statusIcon[status] ?? `${pct}%`}</span>
                  </div>
                  {status === 'uploading' && (
                    <div className="w-full bg-border rounded-full h-1">
                      <div
                        className="bg-primary h-1 rounded-full transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="text-xs text-muted mb-3">
          🔄 = Embedding queued in background (PDF, TXT, MD, CSV, DOCX)
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={doUpload}
            disabled={files.length === 0 || uploading}
            className="btn-primary disabled:opacity-40"
          >
            <Upload size={13} className="inline mr-1" />
            {uploading ? 'Uploading…' : 'Upload All'}
          </button>
        </div>
      </div>
    </div>
  )
}
