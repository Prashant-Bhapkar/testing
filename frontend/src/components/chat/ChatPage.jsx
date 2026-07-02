import { useState, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { ThemeToggle } from '../../context/ThemeContext'
import MessageList from './MessageList'
import InputArea from './InputArea'
import { Trash2, FolderOpen, MessageSquare, PlusCircle, ShieldCheck, Server, Link2, ClipboardList } from 'lucide-react'
import UserMenu from '../shared/UserMenu'

export default function ChatPage() {
  const toast = useToast()
  const location = useLocation()
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [history, setHistory]   = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(false)
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
    setMessages(prev => [...prev, { role: 'user', content: question, time }])
    setHistory(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    setTimeout(scrollToBottom, 50)
    try {
      const data = await api.chat(question, history)
      const ansTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources, time: ansTime }])
      setHistory(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, sources: [], time: '' }])
      toast(e.message, 'err')
    } finally {
      setLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }, [history, loading, toast])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-[240px] min-w-[240px] bg-surface border-r border-border flex flex-col">
        {/* App header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-bold text-text">🧠 AppEngg</span>
          <ThemeToggle />
        </div>

        {/* Feature nav */}
        <div className="px-3 pt-3 pb-1">
          <div className="text-[11px] uppercase tracking-widest text-muted px-1.5 mb-2">Features</div>
          <FeatureLink to="/"       icon={<FolderOpen size={15} />}    label="Docs"   desc="Browse & manage files"  active={location.pathname === '/'} />
          <FeatureLink to="/chat"   icon={<MessageSquare size={15} />} label="Search" desc="Ask questions on docs"   active={location.pathname === '/chat'} />
          {user?.role === 'admin' && (
            <FeatureLink to="/systems" icon={<Server size={15} />} label="Health" desc="Monitor GitLab runners" active={location.pathname === '/systems'} />
          )}
          <FeatureLink to="/links"  icon={<Link2 size={15} />}         label="Links"  desc="Saved hyperlinks"        active={location.pathname === '/links'} />
          <FeatureLink to="/demo"  icon={<ClipboardList size={15} />} label="Demos"  desc="Demo feedback tracker"   active={location.pathname === '/demo'} />
          {user?.role === 'admin' && (
            <FeatureLink to="/admin" icon={<ShieldCheck size={15} />} label="Admin" desc="Logs, health & config" active={location.pathname === '/admin'} />
          )}
        </div>

        {/* New chat */}
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <PlusCircle size={15} /> New Chat
          </button>
        </div>

        {/* Recent chats */}
        <div className="px-3 pt-2 pb-1">
          <div className="text-[11px] uppercase tracking-widest text-muted mb-1.5">Recent Chats</div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <div className="text-xs text-muted px-2 py-1">No previous chats</div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => loadSession(s)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors truncate"
              >
                💬 {s.title}
              </button>
            ))
          )}
        </div>

        {/* Bottom */}
        <div className="px-2 py-2 border-t border-border">
          <button
            onClick={clearAll}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-subtle hover:bg-card hover:text-text transition-colors"
          >
            <Trash2 size={15} /> Clear History
          </button>
          <div className="mt-1">
            <UserMenu />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-5 bg-surface shrink-0">
          <div className="text-base font-bold flex items-center gap-2">
            🔍 Search
          </div>
          <div className="text-sm text-muted">Searching across all uploaded documents</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
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

function FeatureLink({ to, icon, label, desc, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all ${
        active
          ? 'bg-primary/15 text-primary border border-primary/25'
          : 'text-subtle hover:bg-card hover:text-text border border-transparent'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        <div className={`text-xs leading-tight mt-0.5 ${active ? 'text-primary/70' : 'text-muted'}`}>{desc}</div>
      </div>
    </Link>
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
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-10 py-10">
      <div className="text-6xl">🧠</div>
      <div className="text-2xl font-bold">Ask anything about your documents</div>
      <div className="text-sm text-muted max-w-md leading-relaxed">
        Upload files via Docs, then ask questions here. I'll search through all your documents and give you accurate answers with sources.
      </div>
      <div className="grid grid-cols-2 gap-3 mt-1 max-w-[580px]">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s.slice(2).trim())}
            className="px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-subtle text-left leading-relaxed hover:border-primary hover:text-text hover:bg-card transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
