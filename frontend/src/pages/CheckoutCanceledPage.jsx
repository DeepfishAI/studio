import { Link } from 'react-router-dom'

function CheckoutCanceledPage() {
    return (
        <div className="checkout-result-page checkout-result-page--canceled">
            <div className="checkout-result-card">
                <div className="checkout-result__icon checkout-result__icon--canceled">
                    🐟
                </div>

                <h1 className="checkout-result__title">
                    Checkout Canceled
                </h1>

                <p className="checkout-result__message">
                    No worries! Your checkout was canceled and you haven't been charged.
                    You can upgrade anytime when you're ready.
                </p>

                <div className="checkout-result__actions">
                    <Link to="/pricing" className="btn btn--primary btn--lg">
                        💎 View Plans
                    </Link>
                    <Link to="/" className="btn btn--secondary">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default CheckoutCanceledPage
