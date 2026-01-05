import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { agents } from '../data/agents'
import ScrollingCodeBackground from './ScrollingCodeBackground'
import '../styles/app.css'
import { useEffect } from 'react'

function Layout() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const isMobile = window.innerWidth <= 768

    // Global Shortcut: ESC -> Workspace
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                // If we are already there, maybe go back? For now, just go to workspace.
                navigate('/app/workspace')
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigate])

    const isActive = (path) => location.pathname === path || location.pathname === `/app${path}`

    return (
        <div className="app-layout">
            {/* Scrolling Code Background */}
            <ScrollingCodeBackground />

            {/* Beta Warning Banner */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: 'linear-gradient(90deg, #FFA500 0%, #FF8C00 100%)',
                color: '#1a1a1a',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 500,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}>
                <span>⚠️</span>
                <span><strong>Beta:</strong> DeepFish AI is in early access. Expect experimental features, occasional bugs, and evolving capabilities.</span>
            </div>

            {/* Sidebar Navigation */}
            <aside className="sidebar">
                {/* Logo */}
                <Link to="/app" className="sidebar__logo">
                    <span className="sidebar__logo-icon">🐟</span>
                    <span className="sidebar__logo-text">DeepFish</span>
                </Link>
                <div style={{
                    padding: '0 24px',
                    marginBottom: '16px',
                    fontSize: '11px',
                    color: '#FF3366',
                    fontWeight: 600,
                    letterSpacing: '0.05em'
                }}>
                    BETA v0.9
                </div>

                {/* Quick Actions */}
                <div className="sidebar__section">
                    <div className="sidebar__section-title">Quick Actions</div>
                    <nav className="sidebar__nav">
                        <Link
                            to="/app"
                            className={`sidebar__nav-item ${isActive('/app') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🏠</span>
                            <span>Dashboard</span>
                        </Link>
                        <Link
                            to="/app/agents"
                            className={`sidebar__nav-item ${isActive('/app/agents') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>👥</span>
                            <span>Team Profiles</span>
                        </Link>
                        <Link
                            to="/app/pricing"
                            className={`sidebar__nav-item ${isActive('/app/pricing') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>💎</span>
                            <span>Pricing</span>
                        </Link>
                        <Link
                            to="/app/billing"
                            className={`sidebar__nav-item ${isActive('/app/billing') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>💳</span>
                            <span>Billing</span>
                        </Link>
                        <Link
                            to="/app/workspace"
                            className={`sidebar__nav-item ${isActive('/app/workspace') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🛠️</span>
                            <span>Workspace</span>
                        </Link>
                        <Link
                            to="/app/toggles"
                            className={`sidebar__nav-item ${isActive('/app/toggles') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🎛️</span>
                            <span>Controls</span>
                        </Link>
                        <Link
                            to="/app/god"
                            className={`sidebar__nav-item ${isActive('/app/god') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🧠</span>
                            <span>God Mode</span>
                        </Link>
                        <Link
                            to="/app/store"
                            className={`sidebar__nav-item ${isActive('/app/store') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🛒</span>
                            <span>Store</span>
                        </Link>
                    </nav>
                </div>

                {/* Agents */}
                <div className="sidebar__section" style={{ flex: 1 }}>
                    <div className="sidebar__section-title">Your Team</div>
                    <nav className="sidebar__nav">
                        {agents.map(agent => (
                            <Link
                                key={agent.id}
                                to={`/app/chat/${agent.id}`}
                                className={`sidebar__nav-item ${location.pathname === `/app/chat/${agent.id}` ? 'sidebar__nav-item--active' : ''}`}
                            >
                                <img
                                    src={agent.portrait}
                                    alt={agent.name}
                                    className="avatar"
                                    onError={(e) => {
                                        e.target.style.display = 'none'
                                    }}
                                />
                                <div>
                                    <div style={{ fontWeight: 500 }}>{agent.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                        {agent.title}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* User Footer */}
                <div className="sidebar__footer">
                    <div className="sidebar__user">
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-email">{user?.email}</div>
                            <span className={`badge badge--${user?.tier || 'free'}`}>
                                {user?.tier || 'Free'} Tier
                            </span>
                        </div>
                        <button
                            onClick={logout}
                            className="btn btn--ghost btn--sm"
                            title="Logout"
                        >
                            🚪
                        </button>
                    </div>
                </div>
                <div style={{
                    padding: '12px 24px',
                    fontSize: '10px',
                    color: '#4a5568',
                    textAlign: 'center',
                    borderTop: '1px solid var(--color-surface-hover)'
                }}>
                    Prices subject to change. <br /> Beta Access.
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="app-header" style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    padding: '10px 20px',
                    background: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-surface-border)',
                    fontSize: '0.9rem',
                    color: 'var(--color-text-secondary)'
                }}>
                    <span style={{ marginRight: '15px' }}>
                        Connected as <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{user?.email}</span>
                    </span>
                    <button
                        onClick={logout}
                        style={{
                            background: 'none',
                            border: '1px solid var(--color-surface-border)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.target.style.color = '#FF3366'; e.target.style.borderColor = '#FF3366'; }}
                        onMouseOut={(e) => { e.target.style.color = 'var(--color-text-muted)'; e.target.style.borderColor = 'var(--color-surface-border)'; }}
                    >
                        Logout
                    </button>
                </header>
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
