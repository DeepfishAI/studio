import { Link } from 'react-router-dom'
import { agents } from '../data/agents'

function AgentsPage() {
    return (
        <div className="agents-page">
            {/* Header */}
            <div className="agents-page__header">
                <h1 className="agents-page__title">Meet Your Team</h1>
                <p className="agents-page__subtitle">
                    6 specialized AI agents, each with unique skills and personalities
                </p>
            </div>

            {/* Agents Grid */}
            <div className="agents-grid">
                {agents.map(agent => (
                    <div key={agent.id} className={`agent-card agent-card--${agent.id}`}>
                        <div className="agent-card__header">
                            <img
                                src={agent.portrait}
                                alt={agent.name}
                                className="agent-card__avatar"
                                onError={(e) => {
                                    e.target.style.background = `var(--color-${agent.id})`
                                }}
                            />
                            <div className="agent-card__info">
                                <h3 className="agent-card__name">{agent.name}</h3>
                                <p className="agent-card__title">{agent.title}</p>
                            </div>
                        </div>
                        <p className="agent-card__desc">
                            {agent.description}
                        </p>
                        <div className="agent-card__actions">
                            <Link to={`/app/chat/${agent.id}`} className="btn btn--primary btn--sm">
                                💬 Start Chat
                            </Link>
                            <Link to={`/app/agents/${agent.id}`} className="btn btn--secondary btn--sm">
                                View Profile
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default AgentsPage
