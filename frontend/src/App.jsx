import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import FileBrowser from './components/browser/FileBrowser'
import ChatPage from './components/chat/ChatPage'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Routes>
          <Route path="/"     element={<FileBrowser />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  )
}
