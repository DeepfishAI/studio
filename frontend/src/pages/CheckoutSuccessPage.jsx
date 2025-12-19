import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

function CheckoutSuccessPage() {
    const [searchParams] = useSearchParams()
    const sessionId = searchParams.get('session_id')
    const [showConfetti, setShowConfetti] = useState(true)

    useEffect(() => {
        // Hide confetti after animation
        const timer = setTimeout(() => setShowConfetti(false), 5000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="checkout-result-page checkout-result-page--success">
            {showConfetti && <div className="confetti-overlay"></div>}

            <div className="checkout-result-card">
                <div className="checkout-result__icon checkout-result__icon--success">
                    🎉
                </div>

                <h1 className="checkout-result__title">
                    Welcome to DeepFish Pro!
                </h1>

                <p className="checkout-result__message">
                    Your subscription is now active. Your AI team just got a lot more powerful!
                </p>

                <div className="checkout-result__features">
                    <div className="checkout-result__feature">
                        <span className="checkout-result__check">✓</span>
                        Extended context windows
                    </div>
                    <div className="checkout-result__feature">
                        <span className="checkout-result__check">✓</span>
                        Premium AI models unlocked
                    </div>
                    <div className="checkout-result__feature">
                        <span className="checkout-result__check">✓</span>
                        Priority support enabled
                    </div>
                </div>

                <div className="checkout-result__actions">
                    <Link to="/chat/mei" className="btn btn--primary btn--lg">
                        💬 Start Chatting
                    </Link>
                    <Link to="/billing" className="btn btn--secondary">
                        View Subscription
                    </Link>
                </div>

                {sessionId && (
                    <p className="checkout-result__session">
                        Session: {sessionId.substring(0, 20)}...
                    </p>
                )}
            </div>
        </div>
    )
}

export default CheckoutSuccessPage
