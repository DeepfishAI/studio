import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../services/billing'
import '../styles/store.css'

// DLC-style skill catalog with 12 purchasable items - ALL $0.99 FOR TESTING
const STORE_CATALOG = [
    // Premium Skills
    {
        id: 'skill_code_master',
        name: 'Code Master Pro',
        category: 'Skills',
        description: 'Generate production-ready code in 20+ languages. Includes refactoring, optimization, and documentation.',
        price: 0.99,
        icon: '⚡',
        rarity: 'epic',
        features: ['Multi-language support', 'Auto-documentation', 'Code review'],
        popular: true
    },
    {
        id: 'skill_web_research',
        name: 'Deep Web Research',
        category: 'Skills',
        description: 'Real-time web search with source verification. Your agents can research any topic.',
        price: 0.99,
        icon: '🔍',
        rarity: 'rare',
        features: ['Live search', 'Source citations', 'Fact checking']
    },
    {
        id: 'skill_image_gen',
        name: 'Vision Studio',
        category: 'Skills',
        description: 'Generate stunning AI images, logos, and graphics. Perfect for branding.',
        price: 0.99,
        icon: '🎨',
        rarity: 'epic',
        features: ['DALL-E 3 access', 'Logo generation', 'Brand kit'],
        popular: true
    },
    {
        id: 'skill_voice',
        name: 'Voice Synthesis',
        category: 'Skills',
        description: 'Give your agents a voice. Text-to-speech with 50+ premium voices.',
        price: 0.99,
        icon: '🔊',
        rarity: 'rare',
        features: ['50+ voices', 'Emotion control', 'Audio export']
    },
    {
        id: 'skill_automation',
        name: 'Browser Automation',
        category: 'Skills',
        description: 'Let agents control your browser. Fill forms, scrape data, automate workflows.',
        price: 0.99,
        icon: '🤖',
        rarity: 'legendary',
        features: ['Browser control', 'Form filling', 'Data extraction']
    },
    {
        id: 'skill_memory',
        name: 'Persistent Memory',
        category: 'Skills',
        description: 'Agents remember everything across sessions. Build long-term relationships.',
        price: 0.99,
        icon: '🧠',
        rarity: 'epic',
        features: ['Session memory', 'Preference learning', 'Context retention']
    },
    // Agent Packs
    {
        id: 'agent_creative_pack',
        name: 'Creative Team Pack',
        category: 'Agents',
        description: 'Unlock Hanna (Designer) + Sally (Copywriter). The ultimate creative duo.',
        price: 0.99,
        icon: '🎭',
        rarity: 'legendary',
        features: ['2 Premium Agents', 'Creative workflows', 'Brand consistency'],
        popular: true
    },
    {
        id: 'agent_tech_pack',
        name: 'Tech Team Pack',
        category: 'Agents',
        description: 'Unlock IT (Developer) + Oracle (Researcher). Build and research faster.',
        price: 0.99,
        icon: '💻',
        rarity: 'legendary',
        features: ['2 Premium Agents', 'Code generation', 'Deep research']
    },
    // Modules
    {
        id: 'module_api',
        name: 'API Access',
        category: 'Modules',
        description: 'Programmatic access to all your agents. Build custom integrations.',
        price: 0.99,
        icon: '🔌',
        rarity: 'legendary',
        features: ['REST API', 'Webhooks', 'SDK access']
    },
    {
        id: 'module_whitelabel',
        name: 'White Label',
        category: 'Modules',
        description: 'Remove DeepFish branding. Add your own logo and colors.',
        price: 0.99,
        icon: '🏷️',
        rarity: 'legendary',
        features: ['Custom branding', 'Custom domain', 'Embeddable']
    },
    {
        id: 'module_training',
        name: 'Agent Training Kit',
        category: 'Modules',
        description: 'Upload documents to train your agents. They learn your business.',
        price: 0.99,
        icon: '📚',
        rarity: 'epic',
        features: ['Document upload', 'Custom knowledge', 'Fine-tuning']
    },
    {
        id: 'module_parallel',
        name: 'Parallel Processing',
        category: 'Modules',
        description: 'Run multiple agents simultaneously. 10x your throughput.',
        price: 0.99,
        icon: '⚡',
        rarity: 'epic',
        features: ['5 parallel agents', 'Priority queue', 'Batch processing']
    }
]

const RARITY_COLORS = {
    common: '#888',
    rare: '#1e90ff',
    epic: '#8a2be2',
    legendary: '#ffd700'
}

function StorePage() {
    const { user } = useAuth()
    const [selectedItem, setSelectedItem] = useState(null)
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState('all')

    const filteredItems = filter === 'all'
        ? STORE_CATALOG
        : STORE_CATALOG.filter(item => item.category.toLowerCase() === filter)

    const handlePurchase = async (item) => {
        if (!user) return

        setLoading(true)
        try {
            // This would create a Stripe checkout
            const { checkoutUrl } = await billingApi.createPurchase(
                user.email,
                user.email,
                item.id
            )
            window.location.href = checkoutUrl
        } catch (err) {
            console.error('Purchase failed:', err)
            // For demo, just show success
            alert(`Demo mode: ${item.name} would be purchased for $${item.price}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="store-page">
            {/* Header */}
            <div className="store-header">
                <h1 className="store-title">🛒 Skill Shop</h1>
                <p className="store-subtitle">
                    Power up your AI team with premium skills, agents, and modules
                </p>
            </div>

            {/* Filter Tabs */}
            <div className="store-filters">
                <button
                    className={`store-filter ${filter === 'all' ? 'store-filter--active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`store-filter ${filter === 'skills' ? 'store-filter--active' : ''}`}
                    onClick={() => setFilter('skills')}
                >
                    ⚡ Skills
                </button>
                <button
                    className={`store-filter ${filter === 'agents' ? 'store-filter--active' : ''}`}
                    onClick={() => setFilter('agents')}
                >
                    👥 Agents
                </button>
                <button
                    className={`store-filter ${filter === 'modules' ? 'store-filter--active' : ''}`}
                    onClick={() => setFilter('modules')}
                >
                    📦 Modules
                </button>
            </div>

            {/* Product Grid */}
            <div className="store-grid">
                {filteredItems.map(item => (
                    <div
                        key={item.id}
                        className={`store-card store-card--${item.rarity}`}
                        onClick={() => setSelectedItem(item)}
                    >
                        {item.popular && (
                            <div className="store-card__badge">🔥 Popular</div>
                        )}
                        <div className="store-card__icon">{item.icon}</div>
                        <div className="store-card__rarity" style={{ color: RARITY_COLORS[item.rarity] }}>
                            {item.rarity.toUpperCase()}
                        </div>
                        <h3 className="store-card__name">{item.name}</h3>
                        <p className="store-card__category">{item.category}</p>
                        <p className="store-card__description">{item.description}</p>
                        <div className="store-card__features">
                            {item.features.map((f, i) => (
                                <span key={i} className="store-card__feature">✓ {f}</span>
                            ))}
                        </div>
                        <div className="store-card__footer">
                            <span className="store-card__price">${item.price}</span>
                            <button
                                className="btn btn--primary btn--sm"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handlePurchase(item)
                                }}
                                disabled={loading}
                            >
                                {loading ? '...' : 'Buy Now'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bundle Banner */}
            <div className="store-bundle">
                <div className="store-bundle__content">
                    <h2 className="store-bundle__title">🐋 Platinum Bundle</h2>
                    <p className="store-bundle__desc">
                        Get EVERYTHING — all skills, all agents, all modules.
                        One subscription, unlimited power.
                    </p>
                    <div className="store-bundle__price">
                        <span className="store-bundle__original">$9.99/mo</span>
                        <span className="store-bundle__sale">$0.99/mo</span>
                    </div>
                    <Link to="/app/pricing" className="btn btn--primary btn--lg">
                        View Plans
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <div className="store-footer">
                <Link to="/app/toggles" className="btn btn--ghost">
                    🎛️ Manage Active Features
                </Link>
            </div>
        </div>
    )
}

export default StorePage
