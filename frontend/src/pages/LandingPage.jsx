import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [joined, setJoined] = useState(false);

    const handleJoin = async (e) => {
        e.preventDefault();

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }

        const API_BASE = import.meta.env.VITE_API_URL || '';

        try {
            const response = await fetch(`${API_BASE}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                console.warn('[Landing] Join failed:', data.message || data.error);
            }

            console.log('[Landing] Lead captured:', email);
            setJoined(true);

            // Redirect to Verification Page
            setTimeout(() => {
                navigate(`/verify?email=${encodeURIComponent(email)}`);
            }, 2000);

        } catch (err) {
            console.error('[Landing] Failed to join:', err);
            // Fallback - still allow access
            setJoined(true);
            setTimeout(() => navigate('/app'), 2000);
        }
    };

    return (
        <div className="landing-page">
            <style>{`
                .landing-page {
                    min-height: 100vh;
                    min-height: 100dvh;
                    background: #0f1115;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    padding: 16px;
                    padding-top: 80px;
                    padding-bottom: env(safe-area-inset-bottom, 16px);
                    position: relative;
                    overflow-x: hidden;
                }
                .landing-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    background: rgba(15, 17, 21, 0.9);
                    backdrop-filter: blur(10px);
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
                    min-height: 52px;
                    padding: 14px 16px;
                    border-radius: 12px;
                    border: 1px solid #2d3342;
                    background: #1a1d24;
                    color: white;
                    font-size: 16px;
                    outline: none;
                    width: 100%;
                }
                .email-input:focus {
                    border-color: #FF3366;
                }
                .join-btn {
                    min-height: 52px;
                    padding: 14px 28px;
                    border-radius: 12px;
                    border: none;
                    background: #FF3366;
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
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
                    margin-top: 40px;
                    color: #4a5568;
                    font-size: 0.85rem;
                    padding: 0 16px;
                    max-width: 100%;
                }
                
                /* Floating Testimonials */
                .testimonials-layer {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: 1;
                }
                
                .testimonial-card {
                    position: absolute;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 15px 20px;
                    border-radius: 16px;
                    max-width: 280px;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 0.9rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    animation: floatUp 20s infinite linear;
                    opacity: 0;
                }
                
                .testimonial-card p {
                    margin: 0 0 10px 0;
                    font-style: italic;
                    line-height: 1.4;
                }
                
                .t-user {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .t-user img {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                }
                
                .t-user span {
                    font-size: 0.8rem;
                    color: #8b9bb4;
                    font-weight: 600;
                }

                @keyframes floatUp {
                    0% { transform: translateY(100vh) scale(0.9); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-20vh) scale(0.9); opacity: 0; }
                }

                .t-1 { left: 10%; animation-delay: 0s; animation-duration: 25s; }
                .t-2 { right: 15%; animation-delay: 5s; animation-duration: 28s; }
                .t-3 { left: 20%; animation-delay: 12s; animation-duration: 30s; }
                .t-4 { right: 8%; animation-delay: 18s; animation-duration: 22s; bottom: -100px; }

                @media (max-width: 768px) {
                    .hero-title { 
                        font-size: 2rem; 
                        padding: 0 8px;
                    }
                    .hero-subtitle {
                        font-size: 1rem;
                        padding: 0 8px;
                    }
                    .landing-header { 
                        padding: 12px 16px; 
                    }
                    .cta-form { 
                        flex-direction: column;
                        width: 100%;
                        max-width: 100%;
                        padding: 0 8px;
                    }
                    .testimonial-card { display: none; }
                    .btn--outline {
                        padding: 10px 16px;
                        font-size: 0.9rem;
                    }
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
                Autonomous AI experts, all working together to bring your ideas to life.
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

            {/* Testimonials Layer */}
            <div className="testimonials-layer">
                <div className="testimonial-card t-1">
                    <p>"It’s like The Sims, but they do your taxes."</p>
                    <div className="t-user">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="" />
                        <span>@SarahTech</span>
                    </div>
                </div>
                <div className="testimonial-card t-2">
                    <p>"Vesper blocked my ex. 5 stars."</p>
                    <div className="t-user">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Crypto" alt="" />
                        <span>@CryptoKing99</span>
                    </div>
                </div>
                <div className="testimonial-card t-3">
                    <p>"Node.js CEO shouting at Python scientist? Too real."</p>
                    <div className="t-user">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev" alt="" />
                        <span>@DevLife</span>
                    </div>
                </div>
                <div className="testimonial-card t-4">
                    <p>"Finally, an AI that sleeps when I do."</p>
                    <div className="t-user">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Indie" alt="" />
                        <span>@IndieHackerPro</span>
                    </div>
                </div>
            </div>

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
