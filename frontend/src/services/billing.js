// Billing API service for Stripe integration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const billingApi = {
    /**
     * Check if billing is enabled
     */
    async getStatus() {
        try {
            const response = await fetch(`${API_BASE}/api/billing/status`)
            if (!response.ok) {
                return { enabled: false }
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Status check failed:', error)
            return { enabled: false }
        }
    },

    /**
     * Get available products (subscriptions + one-time)
     */
    async getProducts() {
        try {
            const response = await fetch(`${API_BASE}/api/billing/products`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Get products failed:', error)
            throw error
        }
    },

    /**
     * Create checkout session for subscription
     * Returns { checkoutUrl, sessionId }
     */
    async createCheckout(userId, email, tier) {
        try {
            const response = await fetch(`${API_BASE}/api/billing/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email, tier }),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Checkout failed')
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Checkout failed:', error)
            throw error
        }
    },

    /**
     * Create customer portal session
     * Returns { portalUrl }
     */
    async createPortal(userId, email) {
        try {
            const response = await fetch(`${API_BASE}/api/billing/portal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email }),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Portal creation failed')
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Portal failed:', error)
            throw error
        }
    },

    /**
     * Create checkout for one-time purchase
     * Returns { checkoutUrl, sessionId }
     */
    async createPurchase(userId, email, productKey) {
        try {
            const response = await fetch(`${API_BASE}/api/billing/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email, productKey }),
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Purchase failed')
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Purchase failed:', error)
            throw error
        }
    },

    /**
     * Get user's current subscription
     * Returns { subscription, tier }
     */
    async getSubscription(userId) {
        try {
            const response = await fetch(`${API_BASE}/api/billing/subscription/${userId}`)
            if (!response.ok) {
                return { subscription: null, tier: 'free' }
            }
            return response.json()
        } catch (error) {
            console.error('[Billing API] Get subscription failed:', error)
            return { subscription: null, tier: 'free' }
        }
    },
}

export default billingApi
