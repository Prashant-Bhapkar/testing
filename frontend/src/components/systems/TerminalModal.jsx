import { useEffect, useRef } from 'react'
import { X, Maximize2 } from 'lucide-react'

export default function TerminalModal({ sys, onClose }) {
  const containerRef = useRef(null)
  const termRef      = useRef(null)
  const fitRef       = useRef(null)
  const wsRef        = useRef(null)

  useEffect(() => {
    let term, fitAddon, ws

    async function init() {
      // Dynamically import xterm so it's only loaded when the modal opens
      const { Terminal }  = await import('@xterm/xterm')
      const { FitAddon }  = await import('@xterm/addon-fit')
      await import('@xterm/xterm/css/xterm.css')

      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#0d0d0d',
          foreground: '#e8e8e8',
          cursor:     '#f0f0f0',
          selection:  'rgba(255,255,255,0.2)',
        },
        allowTransparency: false,
        scrollback: 1000,
      })
      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()
      termRef.current  = term
      fitRef.current   = fitAddon

      // Build WebSocket URL — same host, backend port 8000
      const token    = localStorage.getItem('appeng_token') || ''
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl    = `${protocol}//${window.location.hostname}:8000/api/systems/${sys.id}/ws-terminal?token=${encodeURIComponent(token)}`

      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current  = ws

      ws.onopen = () => {
        // Send initial terminal dimensions
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data))
        }
      }

      ws.onerror = () => {
        term.write('\r\n\x1b[31mWebSocket error — could not connect to backend\x1b[0m\r\n')
      }

      ws.onclose = () => {
        term.write('\r\n\x1b[33m--- Connection closed ---\x1b[0m\r\n')
      }

      // Keyboard input → backend
      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(data))
        }
      })

      // Terminal resize → backend
      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      })

      // Resize observer to fit terminal when modal size changes
      const ro = new ResizeObserver(() => fitAddon.fit())
      ro.observe(containerRef.current)
      termRef._ro = ro
    }

    init()

    return () => {
      ws?.close()
      term?.dispose()
      termRef._ro?.disconnect()
    }
  }, [sys.id])

  function handleFitClick() {
    fitRef.current?.fit()
    termRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className="flex flex-col rounded-xl overflow-hidden shadow-2xl border border-white/10"
        style={{ width: 'min(1000px, 95vw)', height: 'min(620px, 90vh)', background: '#0d0d0d' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 shrink-0" style={{ background: '#1a1a1a' }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-white/70 text-xs font-mono flex-1 text-center">
            SSH — {sys.username}@{sys.hostname || sys.ip}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleFitClick} title="Fit terminal" className="text-white/40 hover:text-white/80 transition-colors">
              <Maximize2 size={13} />
            </button>
            <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Terminal container */}
        <div ref={containerRef} className="flex-1 overflow-hidden" style={{ padding: '6px 4px' }} />
      </div>
    </div>
  )
}
