import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import FileBrowser from './components/browser/FileBrowser'
import ChatPage from './components/chat/ChatPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/"      element={<FileBrowser />} />
        <Route path="/chat"  element={<ChatPage />} />
      </Routes>
    </ToastProvider>
  )
}
