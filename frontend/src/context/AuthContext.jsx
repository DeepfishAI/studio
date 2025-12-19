import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for existing session
        const savedUser = localStorage.getItem('deepfish_user')
        if (savedUser) {
            setUser(JSON.parse(savedUser))
        }
        setLoading(false)
    }, [])

    const login = async (email) => {
        // Simulate API call - in production this would hit /api/auth/login
        const userData = {
            id: generateUserId(),
            email: email,
            tier: 'free',
            createdAt: new Date().toISOString(),
        }

        localStorage.setItem('deepfish_user', JSON.stringify(userData))
        setUser(userData)
        return userData
    }

    const logout = () => {
        localStorage.removeItem('deepfish_user')
        setUser(null)
    }

    const upgradeTier = (newTier) => {
        if (user) {
            const updated = { ...user, tier: newTier }
            localStorage.setItem('deepfish_user', JSON.stringify(updated))
            setUser(updated)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, upgradeTier }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9)
}

export default AuthContext
