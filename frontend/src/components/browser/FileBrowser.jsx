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
import { ChevronLeft, FolderPlus, Upload, LayoutGrid, List, Search } from 'lucide-react'

export default function FileBrowser() {
  const toast = useToast()

  const [prefix, setPrefix]       = useState('')
  const [history, setHistory]     = useState([])
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [bucketInfo, setBucketInfo] = useState({ bucket: '…', root_items: '—' })
  const [selected, setSelected]   = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [viewMode, setViewMode]       = useState('grid')
  const [showUpload, setShowUpload]   = useState(false)
  const [showFolder, setShowFolder]   = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [previewState, setPreviewState] = useState(null)

  const loadContent = useCallback(async (p = prefix) => {
    setLoading(true)
    try {
      const data = await api.browse(p)
      setItems(data.items)
      setSearchQuery('')
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

  // Both files AND folders open detail panel on click
  function handleItemClick(item) {
    setSelected(item)
    setDetailOpen(true)
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
            toast(`Folder deleted — ${r.files_deleted} file(s) removed`, 'ok')
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

  const pathParts = prefix ? prefix.split('/').filter(Boolean) : []

  // Client-side filter
  const visibleItems = searchQuery.trim()
    ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items

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
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border bg-surface shrink-0">
          <button
            onClick={goBack}
            disabled={history.length === 0}
            className="w-9 h-9 rounded-lg bg-card border border-border text-subtle flex items-center justify-center disabled:opacity-30 hover:text-text transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-subtle flex items-center gap-1 min-w-0">
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
          <div className="flex bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-2.5 py-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-muted hover:text-text'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted hover:text-text'}`}
            >
              <List size={14} />
            </button>
          </div>

          <button onClick={() => setShowFolder(true)} className="btn-ghost flex items-center gap-1.5 text-sm">
            <FolderPlus size={15} /> New Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Upload size={15} /> Upload
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-2.5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Search size={14} className="text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files and folders in this directory…"
              className="flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-muted hover:text-text px-1">✕</button>
            )}
          </div>
          {searchQuery && (
            <div className="text-xs text-muted mt-1.5 px-1">
              {visibleItems.length} of {items.length} items match
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted">
              <div className="spinner" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted">
              <span className="text-4xl opacity-40">{searchQuery ? '🔍' : '📭'}</span>
              <span className="text-sm">{searchQuery ? 'No matches found' : 'This folder is empty'}</span>
            </div>
          ) : (
            <FileGrid
              items={visibleItems}
              onItemClick={handleItemClick}
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
        onNavigate={(item) => { setDetailOpen(false); navigateTo(item.path) }}
        onPreview={(item) => setPreviewState({ path: item.path, name: item.name })}
        toast={toast}
      />

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
