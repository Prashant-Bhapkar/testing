import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useToast } from '../../context/ToastContext'
import MessageList from './MessageList'
import InputArea from './InputArea'
import { PlusCircle, Trash2, FolderOpen } from 'lucide-react'

export default function ChatPage() {
  const toast = useToast()
  const [messages, setMessages]   = useState([])   // { role, content, sources?, time }
  const [history, setHistory]     = useState([])   // API history (role + content only)
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(false)
  const messagesEndRef = useRef(null)

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function newChat() {
    if (history.length > 0) {
      const firstQ = history.find(m => m.role === 'user')
      setSessions(prev => {
        const entry = { id: Date.now(), title: firstQ?.content?.slice(0, 44) + '…' || 'Chat', messages }
        return [entry, ...prev].slice(0, 10)
      })
    }
    setMessages([])
    setHistory([])
  }

  function loadSession(session) {
    setMessages(session.messages)
    setHistory(session.messages.map(m => ({ role: m.role, content: m.content })))
  }

  function clearAll() {
    setSessions([])
    setMessages([])
    setHistory([])
  }

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || loading) return

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: question, time }
    setMessages(prev => [...prev, userMsg])

    const newHistory = [...history, { role: 'user', content: question }]
    setHistory(newHistory)
    setLoading(true)
    setTimeout(scrollToBottom, 50)

    try {
      const data = await api.chat(question, history)
      const ansTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const assistantMsg = { role: 'assistant', content: data.answer, sources: data.sources, time: ansTime }
      setMessages(prev => [...prev, assistantMsg])
      setHistory(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (e) {
      const errMsg = { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}`, sources: [], time: '' }
      setMessages(prev => [...prev, errMsg])
      toast(e.message, 'err')
    } finally {
      setLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }, [history, loading, toast])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-[260px] min-w-[260px] bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-base font-bold flex items-center gap-2">🧠 RAG Search</div>
          <div className="text-[11px] text-muted mt-0.5">Ask questions about your documents</div>
          <button
            onClick={newChat}
            className="mt-3.5 w-full py-2 bg-primary text-white text-[13px] font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            + New Chat
          </button>
        </div>

        <div className="px-4 pt-3 pb-1">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">Recent Chats</div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <div className="text-[11px] text-muted px-2">No previous chats</div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => loadSession(s)}
                className="w-full text-left px-2.5 py-2 rounded-md text-[12px] text-subtle hover:bg-card hover:text-text transition-colors truncate"
              >
                💬 {s.title}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-border">
          <Link to="/" className="flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-subtle hover:bg-card hover:text-text transition-colors">
            <FolderOpen size={14} /> File Browser
          </Link>
          <button
            onClick={clearAll}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-subtle hover:bg-card hover:text-text transition-colors"
          >
            <Trash2 size={14} /> Clear History
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-[54px] border-b border-border flex items-center justify-between px-5 bg-surface shrink-0">
          <div className="text-[15px] font-bold flex items-center gap-2">
            🔍 Document Search
            <span className="text-[10px] px-2 py-0.5 bg-card border border-border rounded-full text-purple">kgpt-reasoning-text</span>
          </div>
          <div className="text-[11px] text-muted">Searching across all uploaded documents</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
          {messages.length === 0 ? (
            <Welcome onSuggestion={sendMessage} />
          ) : (
            <>
              <MessageList messages={messages} loading={loading} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <InputArea onSend={sendMessage} loading={loading} />
      </main>
    </div>
  )
}

function Welcome({ onSuggestion }) {
  const suggestions = [
    '📋 What topics are covered in the uploaded documents?',
    '🔍 Summarize the key points from the documents',
    '❓ What is AIOps and how does it work?',
    '📊 What are the main features described?',
  ]
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-10 py-10">
      <div className="text-5xl">🧠</div>
      <div className="text-[22px] font-bold">Ask anything about your documents</div>
      <div className="text-sm text-muted max-w-md leading-relaxed">
        Upload PDFs via the File Browser, then ask questions here. I'll search through all your documents and give you accurate answers with sources.
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-2 max-w-[560px]">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s.slice(2).trim())}
            className="px-4 py-3 bg-surface border border-border rounded-xl text-xs text-subtle text-left leading-relaxed hover:border-primary hover:text-text hover:bg-card transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
