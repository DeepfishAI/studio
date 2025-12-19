import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../services/billing'

// Pricing tiers data
const tiers = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        description: 'Get started with AI assistants',
        features: [
            'Basic AI chat',
            '50 requests per day',
            '2K token context',
            'Standard models only',
        ],
        cta: 'Current Plan',
        highlighted: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 19.99,
        description: 'Professional-grade AI for serious work',
        features: [
            'Everything in Free',
            '500 requests per day',
            '4K token context',
            'GPT-4 & Claude Sonnet',
            'Priority support',
        ],
        cta: 'Upgrade to Pro',
        highlighted: false,
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 49.99,
        description: 'NVIDIA® powered - 56+ enterprise LLMs',
        features: [
            'Everything in Pro',
            '2,000 requests per day',
            '8K token context',
            'NVIDIA LLM catalog access',
            '20+ model selection',
            'Vision & multimodal',
        ],
        cta: 'Go Premium',
        highlighted: true,
        badge: 'POPULAR',
    },
    {
        id: 'platinum',
        name: 'Platinum',
        price: 99.99,
        description: 'NVIDIA® Unlimited - Full access + priority',
        features: [
            'Everything in Premium',
            'Unlimited requests',
            '16K+ token context',
            'All 56+ NVIDIA models',
            'Thinking mode (CoT)',
            'Priority routing',
            'Custom agent training',
        ],
        cta: 'Go Platinum',
        highlighted: false,
        badge: 'ENTERPRISE',
    },
]

function PricingPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(null)
    const [error, setError] = useState(null)
    const [currentTier, setCurrentTier] = useState('free')

    const handleSubscribe = async (tierId) => {
        if (tierId === 'free' || tierId === currentTier) return

        setLoading(tierId)
        setError(null)

        try {
            const userId = user?.email || 'demo-user'
            const email = user?.email || 'demo@deepfish.app'

            const { checkoutUrl } = await billingApi.createCheckout(userId, email, tierId)

            // Redirect to Stripe Checkout
            window.location.href = checkoutUrl
        } catch (err) {
            setError(err.message || 'Failed to start checkout')
            setLoading(null)
        }
    }

    return (
        <div className="pricing-page">
            {/* Header */}
            <div className="pricing-page__header">
                <Link to="/" className="btn btn--ghost btn--sm">
                    ← Back to Dashboard
                </Link>
                <h1 className="pricing-page__title">
                    Choose Your Plan
                </h1>
                <p className="pricing-page__subtitle">
                    Unlock the full power of your AI team
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="pricing-page__error">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Pricing Cards */}
            <div className="pricing-grid">
                {tiers.map((tier) => (
                    <div
                        key={tier.id}
                        className={`pricing-card ${tier.highlighted ? 'pricing-card--highlighted' : ''} ${currentTier === tier.id ? 'pricing-card--current' : ''}`}
                    >
                        {tier.badge && (
                            <div className="pricing-card__badge">{tier.badge}</div>
                        )}

                        <div className="pricing-card__header">
                            <h3 className="pricing-card__name">{tier.name}</h3>
                            <div className="pricing-card__price">
                                <span className="pricing-card__currency">$</span>
                                <span className="pricing-card__amount">{tier.price}</span>
                                {tier.price > 0 && <span className="pricing-card__period">/mo</span>}
                            </div>
                            <p className="pricing-card__description">{tier.description}</p>
                        </div>

                        <ul className="pricing-card__features">
                            {tier.features.map((feature, idx) => (
                                <li key={idx} className="pricing-card__feature">
                                    <span className="pricing-card__check">✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            className={`btn ${tier.highlighted ? 'btn--primary' : 'btn--secondary'} btn--lg w-full`}
                            onClick={() => handleSubscribe(tier.id)}
                            disabled={loading === tier.id || tier.id === 'free' || tier.id === currentTier}
                        >
                            {loading === tier.id ? (
                                <>
                                    <span className="loading-spinner--sm"></span>
                                    Processing...
                                </>
                            ) : currentTier === tier.id ? (
                                '✓ Current Plan'
                            ) : (
                                tier.cta
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* FAQ / Trust */}
            <div className="pricing-page__footer">
                <p className="text-secondary">
                    🔒 Secure checkout powered by Stripe • Cancel anytime •
                    <Link to="/billing" className="pricing-page__link">Manage subscription</Link>
                </p>
            </div>
        </div>
    )
}

export default PricingPage
