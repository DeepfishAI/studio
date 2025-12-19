import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import '../styles/toggles.css'

// Catalog of all toggleable items
const TOGGLE_CATALOG = {
    agents: [
        { id: 'vesper', name: 'Vesper', desc: 'Chief Receptionist', emoji: '📞', tier: 'free' },
        { id: 'mei', name: 'Mei', desc: 'Project Manager', emoji: '📋', tier: 'free' },
        { id: 'hanna', name: 'Hanna', desc: 'Creative Director', emoji: '🎨', tier: 'pro' },
        { id: 'it', name: 'IT', desc: 'Lead Developer', emoji: '💻', tier: 'pro' },
        { id: 'sally', name: 'Sally', desc: 'Copywriter', emoji: '✍️', tier: 'premium' },
        { id: 'oracle', name: 'Oracle', desc: 'Research Analyst', emoji: '🔮', tier: 'premium' },
    ],
    skills: [
        { id: 'code_gen', name: 'Code Generation', desc: 'Write production code', emoji: '⚡', tier: 'pro' },
        { id: 'web_search', name: 'Web Search', desc: 'Real-time web research', emoji: '🔍', tier: 'pro' },
        { id: 'image_gen', name: 'Image Generation', desc: 'Create AI images', emoji: '🖼️', tier: 'premium' },
        { id: 'voice_tts', name: 'Voice Output', desc: 'Text-to-speech responses', emoji: '🔊', tier: 'premium' },
        { id: 'browser', name: 'Browser Control', desc: 'Automate web tasks', emoji: '🌐', tier: 'platinum' },
        { id: 'memory', name: 'Long-term Memory', desc: 'Remember across sessions', emoji: '🧠', tier: 'platinum' },
    ],
    modules: [
        { id: 'workspace', name: 'Code Workspace', desc: 'Built-in editor & preview', emoji: '📝', tier: 'free' },
        { id: 'training', name: 'Agent Training', desc: 'Upload custom knowledge', emoji: '📚', tier: 'pro' },
        { id: 'api_access', name: 'API Access', desc: 'Programmatic integration', emoji: '🔌', tier: 'premium' },
        { id: 'whitelabel', name: 'White Label', desc: 'Custom branding', emoji: '🏷️', tier: 'platinum' },
    ]
}

// Tier hierarchy for ownership check
const TIER_LEVELS = { free: 0, pro: 1, premium: 2, platinum: 3 }

function TogglesPage() {
    const { user } = useAuth()
    const [userTier, setUserTier] = useState('free')
    const [toggles, setToggles] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadToggles()
    }, [user])

    const loadToggles = async () => {
        try {
            // In production, fetch from backend
            // For now, use localStorage
            const saved = localStorage.getItem('deepfish_toggles')
            if (saved) {
                setToggles(JSON.parse(saved))
            }

            // Simulate user tier (would come from billing)
            const tier = localStorage.getItem('deepfish_tier') || 'free'
            setUserTier(tier)
        } catch (err) {
            console.error('Failed to load toggles:', err)
        } finally {
            setLoading(false)
        }
    }

    const isOwned = (itemTier) => {
        return TIER_LEVELS[userTier] >= TIER_LEVELS[itemTier]
    }

    const isEnabled = (itemId) => {
        return toggles[itemId]?.enabled !== false // Default to enabled if owned
    }

    const getState = (item) => {
        if (!isOwned(item.tier)) return 'locked' // Yellow
        if (isEnabled(item.id)) return 'on' // Green
        return 'off' // Red
    }

    const handleToggle = async (item) => {
        if (!isOwned(item.tier)) return // Can't toggle locked items

        const newToggles = {
            ...toggles,
            [item.id]: {
                owned: true,
                enabled: !isEnabled(item.id)
            }
        }

        setToggles(newToggles)
        localStorage.setItem('deepfish_toggles', JSON.stringify(newToggles))

        // In production, save to backend
        // await api.saveToggles(newToggles)
    }

    const renderToggleItem = (item) => {
        const state = getState(item)

        return (
            <div
                key={item.id}
                className={`toggle-item toggle-item--${state}`}
                onClick={() => handleToggle(item)}
            >
                <div className="toggle-item__indicator">
                    <span className={`toggle-dot toggle-dot--${state}`}></span>
                </div>
                <div className="toggle-item__info">
                    <span className="toggle-item__emoji">{item.emoji}</span>
                    <div className="toggle-item__text">
                        <span className="toggle-item__name">{item.name}</span>
                        <span className="toggle-item__desc">{item.desc}</span>
                    </div>
                </div>
                {state === 'locked' && (
                    <span className="toggle-item__tier">{item.tier.toUpperCase()}</span>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="toggles-page">
                <div className="loading-screen">
                    <div className="loading-spinner"></div>
                    <p>Loading controls...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="toggles-page">
            <div className="toggles-header">
                <h1 className="toggles-title">🎛️ System Controls</h1>
                <p className="toggles-subtitle">
                    Manage your features, agents, and skills
                </p>
                <div className="toggles-legend">
                    <span className="legend-item">
                        <span className="toggle-dot toggle-dot--on"></span> Active
                    </span>
                    <span className="legend-item">
                        <span className="toggle-dot toggle-dot--off"></span> Disabled
                    </span>
                    <span className="legend-item">
                        <span className="toggle-dot toggle-dot--locked"></span> Upgrade to Unlock
                    </span>
                </div>
            </div>

            <div className="toggles-grid">
                {/* Agents Column */}
                <div className="toggles-column">
                    <h2 className="toggles-column__title">👥 Agents</h2>
                    <div className="toggles-column__items">
                        {TOGGLE_CATALOG.agents.map(renderToggleItem)}
                    </div>
                </div>

                {/* Skills Column */}
                <div className="toggles-column">
                    <h2 className="toggles-column__title">⚡ Skills</h2>
                    <div className="toggles-column__items">
                        {TOGGLE_CATALOG.skills.map(renderToggleItem)}
                    </div>
                </div>

                {/* Modules Column */}
                <div className="toggles-column">
                    <h2 className="toggles-column__title">📦 Modules</h2>
                    <div className="toggles-column__items">
                        {TOGGLE_CATALOG.modules.map(renderToggleItem)}
                    </div>
                </div>
            </div>

            <div className="toggles-footer">
                <p className="toggles-tier">
                    Your Plan: <strong className={`tier-badge tier-badge--${userTier}`}>
                        {userTier.toUpperCase()}
                    </strong>
                </p>
                <a href="/app/store" className="btn btn--primary">
                    🛒 Upgrade Plan
                </a>
            </div>
        </div>
    )
}

export default TogglesPage
