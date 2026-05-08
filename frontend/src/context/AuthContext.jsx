import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('appeng_user') || 'null')
    } catch {
      return null
    }
  })

  function login(token, userInfo) {
    localStorage.setItem('appeng_token', token)
    localStorage.setItem('appeng_user', JSON.stringify(userInfo))
    setUser(userInfo)
  }

  function logout() {
    localStorage.removeItem('appeng_token')
    localStorage.removeItem('appeng_user')
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
  return localStorage.getItem('appeng_token')
}
