import { X, Download, Eye, Copy, Trash2, Brain, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api'
import { getIcon, fmtSize, fmtDate } from './FileGrid'

const PREVIEW_EXTS    = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'txt', 'csv', 'md']
const EMBEDDABLE_EXTS = ['pdf', 'txt', 'md', 'csv', 'docx']

export default function DetailPanel({ item, open, onClose, onDelete, onPreview, toast }) {
  const [embStatus, setEmbStatus]   = useState(null)
  const [checking, setChecking]     = useState(false)
  const [reEmbedding, setReEmbedding] = useState(false)

  async function checkEmbedding() {
    setChecking(true)
    try {
      const d = await api.embeddingStatus(item.name)
      setEmbStatus(d)
      toast(
        d.is_embedded
          ? `🧠 ${item.name}: ${d.chunks_embedded} chunks in Qdrant`
          : `⚠️ ${item.name}: Not embedded yet`,
        d.is_embedded ? 'ok' : 'info',
      )
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setChecking(false)
    }
  }

  async function doReEmbed() {
    setReEmbedding(true)
    setEmbStatus(null)
    try {
      const d = await api.reEmbed(item.path)
      toast(
        d.status === 'embedded'
          ? `🧠 Re-embedded: ${d.chunks} chunks`
          : `⚠️ ${d.reason || d.status}`,
        d.status === 'embedded' ? 'ok' : 'info',
      )
      if (d.status === 'embedded') {
        setEmbStatus({ is_embedded: true, chunks_embedded: d.chunks })
      }
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setReEmbedding(false)
    }
  }

  function copyPath() {
    navigator.clipboard.writeText(item.path)
    toast('Path copied!', 'ok')
  }

  if (!item) return null
  const isEmbeddable = item.type === 'file' && EMBEDDABLE_EXTS.includes(item.ext)

  return (
    <div className={`w-[260px] min-w-[260px] bg-surface border-l border-border flex flex-col transition-transform duration-250 ${open ? 'translate-x-0' : 'translate-x-full'} absolute right-0 top-0 h-full z-10`}>
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <span className="text-[11px] font-bold text-subtle uppercase tracking-wide">Details</span>
        <button onClick={onClose} className="text-muted hover:text-text transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="text-4xl text-center mb-3.5">{getIcon(item)}</div>
        <div className="text-[13px] font-bold text-center break-all mb-4">{item.name}</div>

        <Prop label="Type"     value={item.ext ? item.ext.toUpperCase() : 'FILE'} />
        <Prop label="Size"     value={fmtSize(item.size)} />
        <Prop label="Modified" value={fmtDate(item.modified)} />
        <Prop label="Path"     value={item.path} />

        {embStatus && (
          <div className={`mt-3 px-3 py-2 rounded-md text-[11px] ${embStatus.is_embedded ? 'bg-success/10 text-success border border-success/30' : 'bg-muted/10 text-subtle border border-border'}`}>
            {embStatus.is_embedded ? `🧠 ${embStatus.chunks_embedded} chunks embedded` : '⚠️ Not embedded'}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex flex-col gap-2">
        {item.type === 'folder' ? (
          <>
            <DetBtn icon={<Copy size={13} />}   label="Copy Path"     onClick={copyPath} />
            <DetBtn icon={<Trash2 size={13} />} label="Delete Folder" danger onClick={() => onDelete(item)} />
          </>
        ) : (
          <>
            {PREVIEW_EXTS.includes(item.ext) && (
              <DetBtn icon={<Eye size={13} />} label="Preview" onClick={() => onPreview(item)} />
            )}
            <DetBtn icon={<Download size={13} />} label="Download" primary
              onClick={() => { window.location.href = api.download(item.path) }} />
            <DetBtn icon={<Copy size={13} />} label="Copy Path" onClick={copyPath} />
            {isEmbeddable && (
              <>
                <DetBtn
                  icon={<Brain size={13} />}
                  label={checking ? 'Checking…' : 'Embedding Status'}
                  onClick={checkEmbedding}
                />
                <DetBtn
                  icon={<RefreshCw size={13} className={reEmbedding ? 'animate-spin' : ''} />}
                  label={reEmbedding ? 'Re-embedding…' : 'Re-embed Document'}
                  onClick={doReEmbed}
                />
              </>
            )}
            <DetBtn icon={<Trash2 size={13} />} label="Delete" danger onClick={() => onDelete(item)} />
          </>
        )}
      </div>
    </div>
  )
}

function Prop({ label, value }) {
  return (
    <div className="flex justify-between gap-2 mb-2.5">
      <span className="text-[10px] text-muted uppercase shrink-0">{label}</span>
      <span className="text-[11px] text-subtle text-right break-all">{value}</span>
    </div>
  )
}

function DetBtn({ icon, label, onClick, primary, danger }) {
  const cls = primary
    ? 'bg-primary text-white hover:bg-primary/90'
    : danger
      ? 'border border-danger text-danger hover:bg-danger/10'
      : 'border border-border text-subtle hover:bg-card hover:text-text'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${cls}`}
    >
      {icon} {label}
    </button>
  )
}
