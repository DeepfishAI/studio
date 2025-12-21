import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
// ... (imports)

// ...

function AppRoutes() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()

    // Redirect to landing page on refresh
    useEffect(() => {
        const navEntries = performance.getEntriesByType('navigation')
        if (navEntries.length > 0 && navEntries[0].type === 'reload') {
            navigate('/')
        } else if (window.performance && window.performance.navigation.type === 1) {
            // Fallback for older browsers
            navigate('/')
        }
    }, [navigate])

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
            </div>
        )
    }

    return (
        <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify" element={<VerificationPage />} />

            {/* Admin Switchboard */}
            <Route path="/admin" element={<AdminPage />} />

            {/* Login page */}
            <Route
                path="/login"
                element={user ? <Navigate to="/app" replace /> : <LoginPage />}
            />

            {/* Protected app routes */}
            <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<DashboardPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="chat/:agentId" element={<ChatPage />} />
                <Route path="agents" element={<AgentsPage />} />
                <Route path="agents/:agentId" element={<AgentProfilePage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="workspace" element={<WorkspacePage />} />
                <Route path="toggles" element={<TogglesPage />} />
                <Route path="store" element={<StorePage />} />
            </Route>

            {/* Billing result pages (outside Layout for cleaner UX) */}
            <Route path="/billing/success" element={<CheckoutSuccessPage />} />
            <Route path="/billing/canceled" element={<CheckoutCanceledPage />} />
            <Route path="/billing/purchase-success" element={<CheckoutSuccessPage />} />
        </Routes>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}

export default App
