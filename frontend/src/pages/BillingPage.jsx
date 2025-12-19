import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../services/billing'

function BillingPage() {
    const { user } = useAuth()
    const [subscription, setSubscription] = useState(null)
    const [tier, setTier] = useState('free')
    const [loading, setLoading] = useState(true)
    const [portalLoading, setPortalLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadSubscription()
    }, [user])

    const loadSubscription = async () => {
        if (!user?.email) {
            setLoading(false)
            return
        }

        try {
            const data = await billingApi.getSubscription(user.email)
            setSubscription(data.subscription)
            setTier(data.tier || 'free')
        } catch (err) {
            console.error('Failed to load subscription:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleManageBilling = async () => {
        setPortalLoading(true)
        setError(null)

        try {
            const userId = user?.email || 'demo-user'
            const email = user?.email || 'demo@deepfish.app'

            const { portalUrl } = await billingApi.createPortal(userId, email)

            // Redirect to Stripe Customer Portal
            window.location.href = portalUrl
        } catch (err) {
            setError(err.message || 'Failed to open billing portal')
            setPortalLoading(false)
        }
    }

    const getTierBadgeClass = (tierName) => {
        const classes = {
            free: 'badge--free',
            pro: 'badge--pro',
            premium: 'badge--premium',
            platinum: 'badge--platinum',
        }
        return classes[tierName] || 'badge--free'
    }

    const getTierEmoji = (tierName) => {
        const emojis = {
            free: '🐟',
            pro: '🐬',
            premium: '🦈',
            platinum: '🐋',
        }
        return emojis[tierName] || '🐟'
    }

    if (loading) {
        return (
            <div className="billing-page">
                <div className="loading-screen">
                    <div className="loading-spinner"></div>
                    <p>Loading billing info...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="billing-page">
            {/* Header */}
            <div className="billing-page__header">
                <Link to="/" className="btn btn--ghost btn--sm">
                    ← Back to Dashboard
                </Link>
                <h1 className="billing-page__title">Billing & Subscription</h1>
            </div>

            {/* Error Message */}
            {error && (
                <div className="billing-page__error">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Current Plan Card */}
            <div className="billing-card">
                <div className="billing-card__header">
                    <h2 className="billing-card__title">Current Plan</h2>
                    <span className={`badge ${getTierBadgeClass(tier)}`}>
                        {tier.toUpperCase()}
                    </span>
                </div>

                <div className="billing-card__content">
                    <div className="billing-plan">
                        <div className="billing-plan__icon">{getTierEmoji(tier)}</div>
                        <div className="billing-plan__info">
                            <h3 className="billing-plan__name">
                                DeepFish {tier.charAt(0).toUpperCase() + tier.slice(1)}
                            </h3>
                            {subscription ? (
                                <p className="billing-plan__status">
                                    {subscription.cancelAtPeriodEnd ? (
                                        <span className="text-warning">
                                            Cancels on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="text-secondary">
                                            Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                        </span>
                                    )}
                                </p>
                            ) : tier === 'free' ? (
                                <p className="text-secondary">Free tier - no payment required</p>
                            ) : (
                                <p className="text-secondary">Active subscription</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="billing-card__actions">
                    {tier === 'free' ? (
                        <Link to="/pricing" className="btn btn--primary">
                            🚀 Upgrade Plan
                        </Link>
                    ) : (
                        <>
                            <button
                                className="btn btn--primary"
                                onClick={handleManageBilling}
                                disabled={portalLoading}
                            >
                                {portalLoading ? (
                                    <>
                                        <span className="loading-spinner--sm"></span>
                                        Opening Portal...
                                    </>
                                ) : (
                                    '⚙️ Manage Subscription'
                                )}
                            </button>
                            <Link to="/pricing" className="btn btn--secondary">
                                Change Plan
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Usage Stats Card */}
            <div className="billing-card">
                <div className="billing-card__header">
                    <h2 className="billing-card__title">Usage This Month</h2>
                </div>
                <div className="billing-card__content">
                    <div className="usage-stats">
                        <div className="usage-stat">
                            <div className="usage-stat__label">API Requests</div>
                            <div className="usage-stat__value">
                                <span className="usage-stat__current">127</span>
                                <span className="usage-stat__max">
                                    / {tier === 'platinum' ? '∞' : tier === 'premium' ? '2,000' : tier === 'pro' ? '500' : '50'}
                                </span>
                            </div>
                            <div className="progress">
                                <div
                                    className="progress__fill progress__fill--blue"
                                    style={{ width: tier === 'platinum' ? '5%' : `${Math.min((127 / (tier === 'premium' ? 2000 : tier === 'pro' ? 500 : 50)) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="billing-page__links">
                <Link to="/pricing" className="billing-link">
                    💎 View All Plans
                </Link>
                <a href="mailto:support@deepfish.app" className="billing-link">
                    📧 Contact Support
                </a>
            </div>
        </div>
    )
}

export default BillingPage
