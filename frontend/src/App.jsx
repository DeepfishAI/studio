import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import AgentsPage from './pages/AgentsPage'
import AgentProfilePage from './pages/AgentProfilePage'
import PricingPage from './pages/PricingPage'
import BillingPage from './pages/BillingPage'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage'
import CheckoutCanceledPage from './pages/CheckoutCanceledPage'
import WorkspacePage from './pages/WorkspacePage'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

function AppRoutes() {
    const { user, loading } = useAuth()

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
