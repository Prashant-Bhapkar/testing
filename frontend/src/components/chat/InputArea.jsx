import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

export default function InputArea({ onSend, loading }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef()

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    if (!value.trim() || loading) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="px-5 py-4 border-t border-border bg-bg shrink-0">
      <div className="max-w-[820px] mx-auto">
        <div className="bg-surface border border-border rounded-xl flex items-end gap-2.5 px-3.5 py-2.5 focus-within:border-primary transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => { setValue(e.target.value); autoResize(e) }}
            onKeyDown={handleKey}
            placeholder="Ask a question about your documents…"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder-muted resize-none max-h-[120px] min-h-6 leading-6 font-[inherit]"
          />
          <button
            onClick={submit}
            disabled={!value.trim() || loading}
            className="w-[34px] h-[34px] bg-primary rounded-lg flex items-center justify-center text-white disabled:bg-border disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
        <div className="text-center text-xs text-muted mt-2">
          Enter to send · Shift+Enter for new line · Answers are based only on uploaded documents
        </div>
      </div>
    </div>
  )
}
