import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { agents } from '../data/agents'

function DashboardPage() {
    const { user } = useAuth()

    return (
        <div className="dashboard-page">
            {/* Header */}
            <div className="dashboard__header">
                <h1 className="dashboard__greeting">
                    Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
                </h1>
                <p className="dashboard__subtitle">
                    Your AI team is ready to help. What would you like to work on today?
                </p>
            </div>

            {/* Quick Actions */}
            <div className="dashboard__section">
                <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">Quick Actions</h2>
                </div>
                <div className="quick-actions">
                    <Link to="/app/chat/mei" className="quick-action-card">
                        <div className="quick-action-card__icon">💬</div>
                        <h3 className="quick-action-card__title">New Project</h3>
                        <p className="quick-action-card__desc">
                            Start a conversation with Mei
                        </p>
                    </Link>
                    <Link to="/app/agents" className="quick-action-card">
                        <div className="quick-action-card__icon">👥</div>
                        <h3 className="quick-action-card__title">Meet the Team</h3>
                        <p className="quick-action-card__desc">
                            Explore agent profiles
                        </p>
                    </Link>
                    <Link to="/app/chat/hanna" className="quick-action-card">
                        <div className="quick-action-card__icon">🎨</div>
                        <h3 className="quick-action-card__title">Design Something</h3>
                        <p className="quick-action-card__desc">
                            Work with Hanna
                        </p>
                    </Link>
                    <Link to="/app/chat/it" className="quick-action-card">
                        <div className="quick-action-card__icon">💻</div>
                        <h3 className="quick-action-card__title">Build Code</h3>
                        <p className="quick-action-card__desc">
                            Get IT's expertise
                        </p>
                    </Link>
                </div>
            </div>

            {/* Team Status */}
            <div className="dashboard__section">
                <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">Your Team</h2>
                    <Link to="/app/agents" className="btn btn--ghost btn--sm">
                        View All →
                    </Link>
                </div>
                <div className="agents-grid">
                    {agents.slice(0, 4).map(agent => (
                        <div key={agent.id} className={`agent-card agent-card--${agent.id}`}>
                            <div className="agent-card__header">
                                <img
                                    src={agent.portrait}
                                    alt={agent.name}
                                    className="agent-card__avatar"
                                />
                                <div className="agent-card__info">
                                    <h3 className="agent-card__name">{agent.name}</h3>
                                    <p className="agent-card__title">{agent.title}</p>
                                </div>
                            </div>
                            <p className="agent-card__desc">
                                {agent.description?.substring(0, 100)}...
                            </p>
                            <div className="agent-card__actions">
                                <Link to={`/app/chat/${agent.id}`} className="btn btn--primary btn--sm">
                                    💬 Chat
                                </Link>
                                <Link to={`/app/agents/${agent.id}`} className="btn btn--secondary btn--sm">
                                    Profile
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default DashboardPage
