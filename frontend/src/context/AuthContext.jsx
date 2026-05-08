import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dociq_user') || 'null')
    } catch {
      return null
    }
  })

  function login(token, userInfo) {
    localStorage.setItem('dociq_token', token)
    localStorage.setItem('dociq_user', JSON.stringify(userInfo))
    setUser(userInfo)
  }

  function logout() {
    localStorage.removeItem('dociq_token')
    localStorage.removeItem('dociq_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function getToken() {
  return localStorage.getItem('dociq_token')
}
