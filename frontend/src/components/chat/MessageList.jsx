function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatAnswer(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-card px-1 py-0.5 rounded text-[12px]">$1</code>')
    .replace(/\n/g, '<br />')
}

function fmtPages(pages) {
  if (!pages || pages.length === 0) return null
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.length === 1
    ? `p.${sorted[0]}`
    : `p.${sorted.join(', ')}`
}

export default function MessageList({ messages, loading }) {
  return (
    <>
      {messages.map((msg, i) => (
        msg.role === 'user'
          ? <UserBubble key={i} message={msg} />
          : <AssistantBubble key={i} message={msg} />
      ))}
      {loading && <ThinkingBubble />}
    </>
  )
}

function UserBubble({ message }) {
  return (
    <div className="flex gap-3 flex-row-reverse self-end max-w-[820px] w-full">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm shrink-0">👤</div>
      <div>
        <div className="px-4 py-3 bg-primary text-white rounded-xl rounded-br-sm text-sm leading-relaxed">
          {message.content}
        </div>
        {message.time && <div className="text-[10px] text-muted mt-1 text-right">{message.time}</div>}
      </div>
    </div>
  )
}

function AssistantBubble({ message }) {
  return (
    <div className="flex gap-3 self-start max-w-[820px] w-full">
      <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-sm shrink-0">🧠</div>
      <div>
        <div className="px-4 py-3 bg-card border border-border rounded-xl rounded-bl-sm text-sm leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: formatAnswer(message.content) }} />
          {message.sources?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-border/60">
              {message.sources.map((s, i) => {
                const pages = fmtPages(s.pages)
                return (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-surface border border-border rounded-full text-[11px] text-subtle">
                    📄 <span className="font-medium">{s.file}</span>
                    {pages && <span className="text-muted">· {pages}</span>}
                    <span className="text-success text-[10px] ml-0.5">{s.score}</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {message.time && <div className="text-[10px] text-muted mt-1">{message.time}</div>}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3 self-start max-w-[820px] w-full">
      <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-sm shrink-0">🧠</div>
      <div className="px-4 py-3 bg-card border border-border rounded-xl rounded-bl-sm text-sm text-muted flex items-center gap-2">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 bg-primary rounded-full"
              style={{ animation: `bounce 0.8s infinite`, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        Searching documents and generating answer…
      </div>
    </div>
  )
}
