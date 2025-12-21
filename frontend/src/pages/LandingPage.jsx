import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [joined, setJoined] = useState(false);

    const handleJoin = async (e) => {
        e.preventDefault();

        try {
            await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            console.log('Lead captured:', email);
            setJoined(true);

            // Redirect to Verification Page (Simulating Email Link Click)
            setTimeout(() => {
                navigate(`/verify?email=${encodeURIComponent(email)}`);
            }, 2000);

        } catch (err) {
            console.error('Failed to join:', err);
            // Fallback
            setJoined(true);
            setTimeout(() => navigate('/app'), 2000);
        }
    };

    return (
        <div className="landing-page">
            <style>{`
                .landing-page {
                    min-height: 100vh;
                    background: #0f1115; /* Dark surface */
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    padding: 20px;
                    position: relative;
                }
                .landing-header {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    padding: 30px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                }
                .landing-header__logo {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                }
                .landing-header__logo-text {
                    font-size: 1.5rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #FF3366, #FF9933);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: -0.02em;
                }
                .hero-title {
                    font-size: 4rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #FF3366, #FF9933);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 20px;
                    line-height: 1.1;
                }
                .hero-subtitle {
                    font-size: 1.5rem;
                    color: #8b9bb4;
                    max-width: 600px;
                    margin-bottom: 40px;
                }
                .cta-form {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                    max-width: 400px;
                }
                .email-input {
                    flex: 1;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #2d3342;
                    background: #1a1d24;
                    color: white;
                    font-size: 1rem;
                    outline: none;
                }
                .email-input:focus {
                    border-color: #FF3366;
                }
                .join-btn {
                    padding: 15px 30px;
                    border-radius: 8px;
                    border: none;
                    background: #FF3366;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .join-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px -10px rgba(255, 51, 102, 0.5);
                }
                .btn--outline {
                    background: transparent;
                    border: 2px solid #2d3342;
                    color: white;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.2s;
                    font-size: 0.95rem;
                }
                .btn--outline:hover {
                    background: #2d3342;
                    border-color: #FF3366;
                }
                .login-link {
                    margin-top: 24px;
                    color: #8b9bb4;
                    font-size: 0.95rem;
                    text-decoration: none;
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s;
                    display: inline-block;
                }
                .login-link span {
                    color: #FF3366;
                    font-weight: 600;
                    margin-left: 4px;
                }
                .login-link:hover {
                    color: white;
                    transform: translateY(-1px);
                }
                .login-link:hover span {
                    text-decoration: underline;
                }
                .beta-tag {
                    background: rgba(255, 51, 102, 0.1);
                    color: #FF3366;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-bottom: 20px;
                    border: 1px solid rgba(255, 51, 102, 0.2);
                }
                .footer {
                    margin-top: 60px;
                    color: #4a5568;
                    font-size: 0.9rem;
                }
                @media (max-width: 768px) {
                    .hero-title { font-size: 2.5rem; }
                    .landing-header { padding: 20px; }
                    .cta-form { flex-direction: column; }
                }
            `}</style>

            <header className="landing-header">
                <a href="/" className="landing-header__logo">
                    <img src="/logo_beta.png" alt="DeepFish" style={{ width: '40px' }} />
                    <span className="landing-header__logo-text">DeepFish</span>
                </a>
                <button className="btn--outline" onClick={() => navigate('/login')}>
                    Sign In
                </button>
            </header>

            <div className="beta-tag">BETA v0.9 — EARLY ACCESS</div>

            <h1 className="hero-title">
                Stop Prompting.<br />
                Start Managing.
            </h1>

            <p className="hero-subtitle">
                You don't need another chatbot. You need a workgroup.
                <br />
                Spin up autonomous specialists, assign real work, and scale your creative output.
            </p>

            {!joined ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <form className="cta-form" onSubmit={handleJoin}>
                        <input
                            type="email"
                            className="email-input"
                            placeholder="Enter your email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button type="submit" className="join-btn">
                            Join Waitlist
                        </button>
                    </form>
                    <button className="login-link" onClick={() => navigate('/login')}>
                        Already a member? <span>Log in</span>
                    </button>
                </div>
            ) : (
                <div style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    Welcome to the Resistance. Redirecting...
                </div>
            )}

            {joined && (
                <div className="share-section" style={{ marginTop: '30px', animation: 'fadeIn 1s' }}>
                    <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '15px' }}>Help us disrupt the industry.</p>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button
                            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("Just joined the DeepFish AI studio beta. The autonomous agent workforce is here. 🐟✨ #DeepFishAI #AI")}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
                            style={{ padding: '8px 16px', background: 'rgba(29, 161, 242, 0.15)', color: '#1DA1F2', border: '1px solid rgba(29, 161, 242, 0.3)', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                            Tweet
                        </button>
                        <button
                            onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                            style={{ padding: '8px 16px', background: 'rgba(10, 102, 194, 0.15)', color: '#0A66C2', border: '1px solid rgba(10, 102, 194, 0.3)', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                            Share
                        </button>
                    </div>
                </div>
            )}

            <div className="footer">
                Early access only • Prices subject to change in Beta. • DeepFish AI © 2025
            </div>
        </div>
    );
}
