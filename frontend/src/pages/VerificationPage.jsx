import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function VerificationPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');
    const [newsletter, setNewsletter] = useState(true);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        // Simulate "Clicking the Link" verification process
        const timer = setTimeout(() => {
            setVerified(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleContinue = () => {
        if (newsletter) {
            console.log(`[Newsletter] Subscribed: ${email}`);
            // In real app: POST /api/newsletter
        }
        navigate('/app');
    };

    return (
        <div className="verification-page">
            <style>{`
                .verification-page {
                    min-height: 100vh;
                    background: #0f1115;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    padding: 20px;
                }
                .card {
                    background: #1a1d24;
                    padding: 40px;
                    border-radius: 12px;
                    border: 1px solid #2d3342;
                    max-width: 400px;
                    width: 100%;
                    animation: fadeIn 0.5s ease-out;
                }
                h1 {
                    margin-bottom: 20px;
                    background: linear-gradient(135deg, #4ade80, #22c55e);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .btn {
                    width: 100%;
                    padding: 12px;
                    background: #FF3366;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 20px;
                    text-align: left;
                    font-size: 0.9rem;
                    color: #8b9bb4;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="card">
                {!verified ? (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔐</div>
                        <h2>Verifying Access...</h2>
                        <p style={{ color: '#8b9bb4' }}>Checking secure link...</p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✅</div>
                        <h1>Access Granted</h1>
                        <p>Welcome to the Resistance, {email?.split('@')[0] || 'User'}.</p>

                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                checked={newsletter}
                                onChange={(e) => setNewsletter(e.target.checked)}
                                id="news"
                            />
                            <label htmlFor="news">
                                Send me the <b>DeepFish Weekly</b> newsletter (Tips, Agents, & Secrets).
                            </label>
                        </div>

                        <button className="btn" onClick={handleContinue}>
                            Enter Studio
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
