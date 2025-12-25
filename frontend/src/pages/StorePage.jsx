import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { agents } from '../data/agents'
import '../styles/app.css'

function StorePage() {
    const [products, setProducts] = useState([])
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [purchaseLoading, setPurchaseLoading] = useState(null)
    const [message, setMessage] = useState(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [pData, uData] = await Promise.all([
                api.getProducts(),
                api.getCurrentUser()
            ])
            setProducts(pData.products || [])
            setUserData(uData)
            setLoading(false)
        } catch (err) {
            console.error('Failed to fetch store data:', err)
            setLoading(false)
        }
    }

    const handlePurchase = async (productId) => {
        setPurchaseLoading(productId)
        setMessage(null)
        try {
            const result = await api.purchaseProduct(productId)
            if (result.success) {
                setMessage({ type: 'success', text: result.message })
                setUserData(result.userData)
            } else {
                setMessage({ type: 'error', text: result.error || 'Purchase failed' })
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error' })
        }
        setPurchaseLoading(null)
    }

    if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

    return (
        <div className="agents-page">
            <div className="agents-page__header">
                <h1 className="agents-page__title">Office Expansion Store 🏗️</h1>
                <p className="agents-page__subtitle">
                    Expand your virtual office with specialized intern teams and increased capacity.
                </p>
                {userData && (
                    <div className="badge badge--premium" style={{ marginTop: 'var(--space-md)' }}>
                        Current Capacity Pool: {userData.capacities?.any || 0} slots
                    </div>
                )}
            </div>

            {message && (
                <div className={`alert alert--${message.type}`} style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: message.type === 'success' ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)' }}>
                    {message.text}
                </div>
            )}

            <div className="agents-grid">
                {products.map(product => {
                    const agentObj = agents.find(a => a.id === product.target_agent)
                    return (
                        <div key={product.id} className="agent-card" style={{ borderLeftColor: agentObj ? `var(--color-${agentObj.id})` : 'var(--color-accent-blue)' }}>
                            <div className="agent-card__header">
                                <div className="agent-card__avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', background: 'var(--color-bg-tertiary)' }}>
                                    {agentObj ? '🧑‍💼' : '🏢'}
                                </div>
                                <div className="agent-card__info">
                                    <div className="agent-card__name">{product.name}</div>
                                    <div style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>${product.price}</div>
                                </div>
                            </div>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: '14px' }}>
                                {product.description}
                            </p>
                            <button
                                className="btn btn--primary w-full"
                                onClick={() => handlePurchase(product.id)}
                                disabled={purchaseLoading === product.id}
                            >
                                {purchaseLoading === product.id ? 'Processing...' : 'Buy Expansion'}
                            </button>
                        </div>
                    )
                })}
            </div>

            <div style={{ marginTop: 'var(--space-2xl)', padding: 'var(--space-xl)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-xl)' }}>
                <h3>Purchase History</h3>
                <div style={{ marginTop: 'var(--space-md)' }}>
                    {userData?.purchases?.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {userData.purchases.map((p, i) => (
                                <li key={i} style={{ padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-bg-tertiary)', fontSize: '14px' }}>
                                    <strong>{p.name}</strong> - {new Date(p.timestamp).toLocaleDateString()}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted">No purchases yet. Start building your empire!</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StorePage
