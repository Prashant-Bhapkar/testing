import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import FileBrowser from './components/browser/FileBrowser'
import ChatPage from './components/chat/ChatPage'
import LoginPage from './components/auth/LoginPage'
import AdminPanel from './components/admin/AdminPanel'
import SystemsPage from './components/systems/SystemsPage'
import LinksPage from './components/links/LinksPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login"   element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/"       element={<ProtectedRoute><FileBrowser /></ProtectedRoute>} />
            <Route path="/chat"   element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/systems" element={<ProtectedRoute><SystemsPage /></ProtectedRoute>} />
            <Route path="/links"  element={<ProtectedRoute><LinksPage /></ProtectedRoute>} />
            <Route path="/admin"  element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
