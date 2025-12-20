import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [joined, setJoined] = useState(false);

    const handleJoin = (e) => {
        e.preventDefault();
        // In real backend, we'd POST to /api/leads
        console.log('Lead captured:', email);
        setJoined(true);
        setTimeout(() => {
            // Auto-redirect to app as "demo" for now
            navigate('/app');
        }, 2000);
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
            `}</style>

            <div className="beta-tag">BETA v0.9 — EARLY ACCESS</div>

            <h1 className="hero-title">
                Build Your Workforce.<br />
                Own Your Code.
            </h1>

            <p className="hero-subtitle">
                The first AI Studio that respects your sovereignty.
                Spin up autonomous agents, assign them skills, and let them build.
            </p>

            {!joined ? (
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
            ) : (
                <div style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    Welcome to the Resistance. Redirecting...
                </div>
            )}

            <div className="footer">
                Prices subject to change during Beta. • DeepFish AI © 2025
            </div>
        </div>
    );
}
