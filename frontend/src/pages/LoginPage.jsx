import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/design-system.css'

function LoginPage() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim()) {
            setError('Please enter your email')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            await login(email)
            navigate('/app')
        } catch (err) {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Logo Section */}
                <div className="login-logo">
                    <span className="login-logo__icon">🐟</span>
                    <span className="login-logo__text">DeepFish</span>
                </div>

                {/* Hero Text */}
                <div className="login-hero">
                    <h1 className="login-hero__title">
                        Your AI Team,<br />Ready to Work
                    </h1>
                    <p className="login-hero__subtitle">
                        Meet Mei and her specialist crew. They're waiting to tackle your next project.
                    </p>
                </div>

                {/* Agent Preview */}
                <div className="login-agents">
                    <div className="login-agents__avatars">
                        <img src="/portraits/mei.png" alt="Mei" className="avatar avatar--lg avatar--bordered avatar--mei" />
                        <img src="/portraits/hanna.png" alt="Hanna" className="avatar avatar--lg avatar--bordered avatar--hanna" />
                        <img src="/portraits/it.png" alt="IT" className="avatar avatar--lg avatar--bordered avatar--it" />
                        <img src="/portraits/sally.png" alt="Sally" className="avatar avatar--lg avatar--bordered avatar--sally" />
                    </div>
                    <p className="login-agents__label text-secondary">
                        6 specialists ready • Always online
                    </p>
                </div>

                {/* Login Form */}
                <form className="login-form" onSubmit={handleSubmit}>
                    <input
                        type="email"
                        className="input"
                        placeholder="Enter your email to get started"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        autoFocus
                    />

                    {error && <p className="login-form__error">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn--primary btn--lg w-full"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Connecting...' : 'Get Started Free'}
                    </button>
                </form>

                {/* Trust Badges */}
                <div className="login-trust">
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">🔒</span>
                        <span>Secure</span>
                    </div>
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">⚡</span>
                        <span>Real AI</span>
                    </div>
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">🚀</span>
                        <span>Fast Setup</span>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="login-bg">
                <div className="login-bg__orb login-bg__orb--1"></div>
                <div className="login-bg__orb login-bg__orb--2"></div>
            </div>
        </div>
    )
}

export default LoginPage
