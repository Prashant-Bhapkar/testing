import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import { useToast } from '../../context/ToastContext'
import Sidebar from './Sidebar'
import FileGrid from './FileGrid'
import DetailPanel from './DetailPanel'
import UploadModal from './UploadModal'
import FolderModal from './FolderModal'
import ConfirmModal from './ConfirmModal'
import PreviewModal from './PreviewModal'
import { ChevronLeft, FolderPlus, Upload, LayoutGrid, List } from 'lucide-react'

export default function FileBrowser() {
  const toast = useToast()

  const [prefix, setPrefix]       = useState('')
  const [history, setHistory]     = useState([])
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [bucketInfo, setBucketInfo] = useState({ bucket: '…', root_items: '—' })
  const [selected, setSelected]   = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [viewMode, setViewMode]       = useState('grid') // 'grid' | 'list'
  const [showUpload, setShowUpload]   = useState(false)
  const [showFolder, setShowFolder]   = useState(false)
  const [confirmState, setConfirmState] = useState(null) // { message, onConfirm }
  const [previewState, setPreviewState] = useState(null) // { path, name }

  const loadContent = useCallback(async (p = prefix) => {
    setLoading(true)
    try {
      const data = await api.browse(p)
      setItems(data.items)
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [prefix, toast])

  const loadBucketInfo = useCallback(async () => {
    try {
      const d = await api.bucketInfo()
      setBucketInfo(d)
    } catch {}
  }, [])

  useEffect(() => {
    loadContent('')
    loadBucketInfo()
  }, [])

  function navigateTo(p) {
    setHistory(h => [...h, prefix])
    setPrefix(p)
    setDetailOpen(false)
    loadContent(p)
  }

  function goBack() {
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setPrefix(prev)
    setDetailOpen(false)
    loadContent(prev)
  }

  function refresh() {
    loadContent(prefix)
    loadBucketInfo()
    toast('Refreshed', 'info')
  }

  function handleItemClick(item) {
    if (item.type === 'folder') {
      navigateTo(item.path)
    } else {
      setSelected(item)
      setDetailOpen(true)
    }
  }

  function confirmDelete(item) {
    const isFolder = item.type === 'folder'
    setConfirmState({
      message: isFolder
        ? `Delete folder "${item.name}" and ALL its contents? This cannot be undone.`
        : `Delete "${item.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          if (isFolder) {
            const r = await api.deleteFolder(item.path)
            toast(`Folder deleted — ${r.files_deleted} files removed`, 'ok')
          } else {
            await api.deleteFile(item.path)
            toast('Deleted!', 'ok')
          }
          setDetailOpen(false)
          loadContent(prefix)
        } catch (e) {
          toast(e.message, 'err')
        }
      },
    })
  }

  // Path breadcrumb parts
  const pathParts = prefix ? prefix.split('/').filter(Boolean) : []

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        bucket={bucketInfo.bucket}
        rootItems={bucketInfo.root_items}
        currentItems={items.length}
        onRoot={() => navigateTo('')}
        onUpload={() => setShowUpload(true)}
        onNewFolder={() => setShowFolder(true)}
        onRefresh={refresh}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <div className="h-13 flex items-center gap-2 px-3.5 border-b border-border bg-surface shrink-0">
          <button
            onClick={goBack}
            disabled={history.length === 0}
            className="w-8 h-8 rounded-md bg-card border border-border text-subtle flex items-center justify-center disabled:opacity-30 hover:text-text transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 bg-card border border-border rounded-md px-3 py-1.5 text-xs text-subtle flex items-center gap-1 min-w-0">
            <span>🪣</span>
            <button onClick={() => navigateTo('')} className="text-primary hover:underline shrink-0">root</button>
            {pathParts.map((part, i) => {
              const path = pathParts.slice(0, i + 1).join('/') + '/'
              return (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-muted">/</span>
                  {i === pathParts.length - 1
                    ? <span className="text-text truncate">{part}</span>
                    : <button onClick={() => navigateTo(path)} className="text-primary hover:underline">{part}</button>
                  }
                </span>
              )
            })}
          </div>

          {/* View toggle */}
          <div className="flex bg-card border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-2 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-muted hover:text-text'}`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted hover:text-text'}`}
            >
              <List size={13} />
            </button>
          </div>

          <button onClick={() => setShowFolder(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
            <FolderPlus size={14} /> New Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Upload size={14} /> Upload
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted">
              <div className="spinner" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
              <span className="text-4xl opacity-40">📭</span>
              <span className="text-sm">This folder is empty</span>
            </div>
          ) : (
            <FileGrid
              items={items}
              onItemClick={handleItemClick}
              onDelete={confirmDelete}
              onPreview={(item) => setPreviewState({ path: item.path, name: item.name })}
              viewMode={viewMode}
            />
          )}
        </div>
      </div>

      {/* Detail panel */}
      <DetailPanel
        item={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onDelete={confirmDelete}
        onPreview={(item) => setPreviewState({ path: item.path, name: item.name })}
        toast={toast}
      />

      {/* Modals */}
      {showUpload && (
        <UploadModal
          prefix={prefix}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { loadContent(prefix); loadBucketInfo() }}
          toast={toast}
        />
      )}
      {showFolder && (
        <FolderModal
          prefix={prefix}
          onClose={() => setShowFolder(false)}
          onSuccess={() => loadContent(prefix)}
          toast={toast}
        />
      )}
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
          onClose={() => setConfirmState(null)}
        />
      )}
      {previewState && (
        <PreviewModal
          path={previewState.path}
          name={previewState.name}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  )
}
