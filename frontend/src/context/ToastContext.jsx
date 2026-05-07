import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 3500)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} />}
    </ToastContext.Provider>
  )
}

function Toast({ message, type }) {
  const borderColor = type === 'ok' ? 'border-success' : type === 'err' ? 'border-danger' : 'border-primary'
  return (
    <div className={`fixed bottom-5 right-5 z-50 bg-card border ${borderColor} rounded-lg px-4 py-2.5 text-sm text-text shadow-lg animate-fade-in`}>
      {message}
    </div>
  )
}

export const useToast = () => useContext(ToastContext)
