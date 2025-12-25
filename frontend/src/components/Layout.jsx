import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { agents } from '../data/agents'
import '../styles/app.css'

function Layout() {
    const { user, logout } = useAuth()
    const location = useLocation()

    const isActive = (path) => location.pathname === path || location.pathname === `/app${path}`

    return (
        <div className="app-layout">
            {/* Sidebar Navigation */}
            <aside className="sidebar">
                {/* Logo */}
                <Link to="/app" className="sidebar__logo">
                    <span className="sidebar__logo-icon">🐟</span>
                    <span className="sidebar__logo-text">DeepFish</span>
                </Link>

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
                            to="/app/store"
                            className={`sidebar__nav-item ${isActive('/app/store') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>🧱</span>
                            <span>Expansion Store</span>
                        </Link>
                        <Link
                            to="/app/terminal"
                            className={`sidebar__nav-item ${isActive('/app/terminal') ? 'sidebar__nav-item--active' : ''}`}
                        >
                            <span>⚡</span>
                            <span>Express Code Server</span>
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
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
