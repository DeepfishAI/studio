import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import './BusFeed.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function BusFeed() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        // Connect to SSE stream
        const eventSource = new EventSource(`${API_BASE}/api/events`);

        eventSource.onopen = () => {
            console.log('[BusFeed] Connected to stream');
        };

        eventSource.onmessage = (event) => {
            if (event.data === ': heartbeat') return;

            try {
                const message = JSON.parse(event.data);

                // Add to list (keep last 50)
                setMessages(prev => {
                    const next = [...prev, message];
                    if (next.length > 50) return next.slice(next.length - 50);
                    return next;
                });
            } catch (err) {
                console.warn('[BusFeed] Parse error:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[BusFeed] Stream error:', err);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        // Send user message to the bus via API
        // For now, we'll route it through Mei as a "System Override" or direct injection
        try {
            await fetch(`${API_BASE}/api/chat/mei`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `[DIRECTIVE] ${input}`, // Prefix to indicate executive command
                    context: 'bus_injection'
                })
            });
            setInput('');
        } catch (err) {
            console.error('Failed to send bus message:', err);
        }
    };

    return (
        <div className="bus-feed-container">
            <div className="bus-feed__header">
                <h3>Office Communications Bus</h3>
                <span className="live-indicator">● LIVE</span>
            </div>

            <div className="bus-feed__messages">
                {messages.length === 0 && (
                    <div className="bus-feed__empty">
                        <p>Listening to agent sub-space frequency...</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    const isUser = msg.sender === 'user' || msg.agentId === 'user';
                    return (
                        <div key={i} className={`bus-message ${isUser ? 'bus-message--user' : 'bus-message--agent'}`}>
                            <div className="bus-message__avatar">
                                {isUser ? '👤' : (msg.agentId === 'mei' ? '👩‍💼' : '🤖')}
                            </div>
                            <div className="bus-message__content">
                                <div className="bus-message__meta">
                                    <span className="bus-message__name">{msg.agentId}</span>
                                    <span className="bus-message__time">
                                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="bus-message__text">
                                    {typeof msg.content === 'string' ? (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    ) : (
                                        <pre>{JSON.stringify(msg.content, null, 2)}</pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <form className="bus-feed__input-area" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="bus-feed__input"
                    placeholder="Broadcast to all agents..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="bus-feed__send-btn">
                    Send
                </button>
            </form>

            <style>{`
                .bus-feed-container {
                    background: #1a1d24;
                    border-radius: 12px;
                    border: 1px solid #2d3342;
                    display: flex;
                    flex-direction: column;
                    height: 500px; /* Taller for chat view */
                    margin-top: 20px;
                    overflow: hidden;
                }
                .bus-feed__header {
                    padding: 15px 20px;
                    background: #252a36;
                    border-bottom: 1px solid #2d3342;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .bus-feed__messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .bus-message {
                    display: flex;
                    gap: 10px;
                    max-width: 80%;
                }
                .bus-message--agent {
                    align-self: flex-start;
                }
                .bus-message--user {
                    align-self: flex-end;
                    flex-direction: row-reverse;
                }
                .bus-message__content {
                    background: #2d3342;
                    padding: 10px 15px;
                    border-radius: 12px;
                    border-top-left-radius: 2px;
                }
                .bus-message--user .bus-message__content {
                    background: #FF3366;
                    color: white;
                    border-radius: 12px;
                    border-top-right-radius: 2px;
                }
                .bus-message__meta {
                    font-size: 0.75rem;
                    color: #8b9bb4;
                    margin-bottom: 5px;
                    display: flex;
                    gap: 8px;
                }
                .bus-message--user .bus-message__meta {
                    justify-content: flex-end;
                    color: rgba(255,255,255,0.8);
                }
                .bus-message__text {
                    font-size: 0.9rem;
                    line-height: 1.4;
                }
                .bus-message__text p {
                    margin: 0;
                }
                .bus-feed__input-area {
                    padding: 15px;
                    background: #252a36;
                    border-top: 1px solid #2d3342;
                    display: flex;
                    gap: 10px;
                }
                .bus-feed__input {
                    flex: 1;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid #2d3342;
                    background: #1a1d24;
                    color: white;
                }
                .bus-feed__send-btn {
                    padding: 10px 20px;
                    background: #FF3366;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
