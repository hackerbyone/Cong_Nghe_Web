import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load user from sessionStorage on mount
  useEffect(() => {
    const auth = sessionStorage.getItem('auth')
    if (auth) {
      try {
        setUser(JSON.parse(auth))
      } catch (e) {
        console.error('Failed to parse auth data:', e)
      }
    }
    setLoading(false)
  }, [])

  const login = (userData) => {
    // Normalize backend response (support PascalCase and camelCase)
    const normalized = {
      token: userData.token || userData.Token || null,
      userId: userData.userId || userData.UserId || null,
      username: userData.username || userData.Username || null,
      name: userData.name || userData.Name || null,
      email: userData.email || userData.Email || null,
      role: userData.role || userData.Role || 'user', // Default role: user
      roles: userData.roles || userData.Roles || [], // Array of roles for future use
      expiresIn: userData.expiresIn || userData.ExpiresIn || null,
    }
    setUser(normalized)
    sessionStorage.setItem('auth', JSON.stringify(normalized))
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('auth')
  }

  // Check if user has specific role
  const hasRole = (role) => {
    if (!user) return false
    return user.role === role || (user.roles && user.roles.includes(role))
  }

  const isAdmin = () => hasRole('admin') || hasRole('Admin')
  const isWarehouse = () => hasRole('warehouse') || hasRole('Warehouse')
  const isAdminOrWarehouse = () => isAdmin() || isWarehouse()

  const updateUser = (partial) => {
    const updated = { ...user, ...partial }
    setUser(updated)
    sessionStorage.setItem('auth', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, isAdmin, isWarehouse, isAdminOrWarehouse, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
