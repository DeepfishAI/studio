import React, { useState, useEffect, useRef } from 'react';
import './BusFeed.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function BusFeed() {
    const [messages, setMessages] = useState([]);
    const bottomRef = useRef(null);

    useEffect(() => {
        // Connect to SSE stream
        const eventSource = new EventSource(`${API_BASE}/api/stream`);

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

    return (
        <div className="bus-feed">
            <div className="bus-feed__header">
                <h3>Office Communications Bus</h3>
                <span className="live-indicator">● LIVE</span>
            </div>
            <div className="bus-feed__content">
                {messages.length === 0 && (
                    <div className="bus-feed__empty">Waiting for bus traffic...</div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`bus-message bus-message--${msg.type?.toLowerCase()}`}>
                        <div className="bus-message__meta">
                            <span className="bus-message__time">
                                {new Date(msg.timestamp || Date.now()).toLocaleTimeString()}
                            </span>
                            <span className="bus-message__agent">{msg.agentId}</span>
                            <span className={`bus-message__type tag tag--${msg.type}`}>
                                {msg.type}
                            </span>
                        </div>
                        <div className="bus-message__body">
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
