import { useState, useCallback, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { getAgent } from '../data/agents'
import SkillPicker from '../components/SkillPicker'
import { trainingApi } from '../services/training'
import { configApi } from '../services/configApi'

// Full LLM Model Catalog - The agent's BRAIN (not skills, not modules)
// In production, this would come from llm-resolver.js / llm_catalog.json
const LLM_MODELS = [
    // Anthropic
    { id: 'claude-opus-4-20250514', provider: 'anthropic', name: 'Claude Opus 4', description: 'Most intelligent — complex analysis, nuanced understanding', tier: 'platinum', thinkingMode: true },
    { id: 'claude-sonnet-4-20250514', provider: 'anthropic', name: 'Claude Sonnet 4', description: 'Best balance of intelligence and speed', tier: 'premium', thinkingMode: true },
    { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', description: 'Fast and affordable — quick responses', tier: 'pro' },
    // OpenAI
    { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Flagship multimodal — text, vision, audio', tier: 'premium', multimodal: true },
    { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', description: 'Fast, affordable small model', tier: 'pro' },
    { id: 'o1-preview', provider: 'openai', name: 'o1 Preview', description: 'Advanced reasoning — thinks before answering', tier: 'platinum', thinkingMode: true },
    // Google
    { id: 'gemini-2.0-flash', provider: 'google', name: 'Gemini 2.0 Flash', description: 'Latest fast multimodal — 1M context', tier: 'pro', multimodal: true },
    { id: 'gemini-2.0-flash-thinking', provider: 'google', name: 'Gemini Flash Thinking', description: 'Reasoning model with visible thinking', tier: 'premium', thinkingMode: true },
    { id: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', description: 'Powerful multimodal — 2M context window', tier: 'premium', multimodal: true },
    // NVIDIA / Open Models
    { id: 'meta/llama-3.1-405b-instruct', provider: 'nvidia', name: 'Llama 3.1 405B', description: 'Meta\'s largest — maximum open-source capability', tier: 'platinum' },
    { id: 'meta/llama-3.1-70b-instruct', provider: 'nvidia', name: 'Llama 3.1 70B', description: 'Strong balanced model from Meta', tier: 'premium' },
    { id: 'meta/llama-3.1-8b-instruct', provider: 'nvidia', name: 'Llama 3.1 8B', description: 'Fast, efficient small Llama', tier: 'pro' },
    { id: 'meta/llama-4-maverick-17b-128e-instruct', provider: 'nvidia', name: 'Llama 4 Maverick', description: 'Latest Llama 4 — cutting edge', tier: 'platinum' },
    { id: 'nvidia/nemotron-3-nano-30b-a3b', provider: 'nvidia', name: 'Nemotron 30B', description: 'NVIDIA reasoning with chain-of-thought', tier: 'platinum', thinkingMode: true },
    { id: 'mistralai/mistral-large-latest', provider: 'nvidia', name: 'Mistral Large', description: 'Excellent for creative work', tier: 'premium' },
    { id: 'mistralai/mixtral-8x22b-instruct-v0.1', provider: 'nvidia', name: 'Mixtral 8x22B', description: 'Mixture of experts — versatile', tier: 'premium' },
    { id: 'qwen/qwen2.5-coder-32b-instruct', provider: 'nvidia', name: 'Qwen 2.5 Coder', description: 'Specialized for code generation', tier: 'platinum' },
    { id: 'deepseek-ai/deepseek-r1', provider: 'nvidia', name: 'DeepSeek R1', description: 'Advanced reasoning with thinking trace', tier: 'platinum', thinkingMode: true },
    { id: 'google/gemma-2-27b-it', provider: 'nvidia', name: 'Gemma 2 27B', description: 'Google\'s efficient open model', tier: 'pro' },
    { id: 'google/gemma-2-9b-it', provider: 'nvidia', name: 'Gemma 2 9B', description: 'Small, fast Google model', tier: 'free' },
    { id: 'microsoft/phi-3-mini-4k-instruct', provider: 'nvidia', name: 'Phi-3 Mini', description: 'Microsoft tiny powerhouse', tier: 'free' },
]

function AgentProfilePage() {
    const { agentId } = useParams()
    const agent = getAgent(agentId)

    const location = useLocation()
    const [voiceName, setVoiceName] = useState(getDefaultVoice(agentId))
    const [learnedFacts, setLearnedFacts] = useState([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedLlmSkill, setSelectedLlmSkill] = useState(null)
    const [userTier] = useState('platinum') // In production, get from user context

    // Customization State
    const [customNickname, setCustomNickname] = useState('')
    const [customInstructions, setCustomInstructions] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Load facts from backend on mount
    useEffect(() => {
        if (agentId) {
            trainingApi.getFacts(agentId)
                .then(data => {
                    // Filter out template entries
                    const realFacts = (data.facts || []).filter(f =>
                        f.fact && !f.fact.startsWith('$')
                    )
                    setLearnedFacts(realFacts)
                })
                .catch(err => console.error('Failed to load facts:', err))
        }
    }, [agentId])

    // Scroll to section if hash in URL (e.g., #llm, #voice)
    useEffect(() => {
        if (location.hash) {
            const element = document.getElementById(location.hash.slice(1))
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
            }
        }
    }, [location.hash])

    if (!agent) {
        return (
            <div className="agent-profile">
                <div className="empty-state">
                    <div className="empty-state__icon">🤔</div>
                    <h2 className="empty-state__title">Agent not found</h2>
                    <p className="empty-state__text">This agent doesn't exist in your team.</p>
                    <Link to="/agents" className="btn btn--primary">View All Agents</Link>
                </div>
            </div>
        )
    }

    const handleDrop = useCallback(async (e) => {
        e.preventDefault()
        setIsDragOver(false)
        setIsUploading(true)

        const files = Array.from(e.dataTransfer.files)

        for (const file of files) {
            try {
                // Read file contents
                const text = await trainingApi.readFileAsText(file)

                // Send to backend
                const result = await trainingApi.addFacts(
                    agentId,
                    text,
                    file.type.includes('pdf') ? 'pdf' : 'text',
                    file.name
                )

                // Update local state with new facts
                if (result.facts) {
                    setLearnedFacts(prev => [...prev, ...result.facts])
                }
            } catch (err) {
                console.error(`Failed to process ${file.name}:`, err)
            }
        }

        setIsUploading(false)
    }, [agentId])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false)
    }, [])

    const deleteFact = async (factId) => {
        try {
            await trainingApi.deleteFact(agentId, factId)
            setLearnedFacts(prev => prev.filter(f => f.id !== factId))
        } catch (err) {
            console.error('Failed to delete fact:', err)
        }
    }

    return (
        <div className="agent-profile">
            {/* Portrait and Stats Hero Section */}
            <div className="profile-hero">
                <div className="portrait-frame">
                    <div className={`portrait-frame__border portrait-frame__border--${agent.id}`}>
                        <img
                            src={agent.portrait}
                            alt={agent.name}
                            className="portrait-frame__image"
                            onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                            }}
                        />
                        <div className={`portrait-frame__fallback avatar--${agent.id}`} style={{ display: 'none' }}>
                            {agent.name[0]}
                        </div>
                    </div>
                    <div className="portrait-frame__nameplate">
                        <h1 className="portrait-frame__name">{agent.name}</h1>
                        <span className="portrait-frame__title">{agent.title}</span>
                    </div>
                </div>

                <div className="stats-block">
                    <h3 className="stats-block__title">Agent Stats</h3>
                    {agent.stats && Object.entries(agent.stats).map(([stat, value]) => (
                        <div key={stat} className="stat-row">
                            <span className="stat-row__label">{formatStatName(stat)}</span>
                            <div className="stat-row__bar-container">
                                <div
                                    className={`stat-row__bar stat-row__bar--${agent.id}`}
                                    style={{ width: `${value}%` }}
                                />
                            </div>
                            <span className="stat-row__value">{value}</span>
                        </div>
                    ))}
                    <div className="stats-block__meta">
                        <div className="stats-block__meta-item">
                            <span className="stats-block__meta-label">Bus Role</span>
                            <span className="stats-block__meta-value badge">{agent.busRole}</span>
                        </div>
                        <div className="stats-block__meta-item">
                            <span className="stats-block__meta-label">Default Skill</span>
                            <span className="stats-block__meta-value badge badge--info">{agent.defaultSkill}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Personality Traits Block */}
            <section className="profile-section traits-section">
                <div className="traits-block">
                    <h3 className="traits-block__title">🧠 Personality Traits</h3>
                    <div className="traits-list">
                        {agent.personality.map(trait => (
                            <span key={trait} className={`trait-tag trait-tag--${agent.id}`}>
                                {trait}
                            </span>
                        ))}
                    </div>
                    <p className="traits-block__note">
                        <span className="note-icon">💡</span>
                        Base personality from <code>personality.json</code> — user overrides from <code>user.json</code> will customize behavior.
                    </p>
                </div>

                <div className="description-block">
                    <h3 className="description-block__title">📋 Description</h3>
                    <p className="description-block__text">{agent.description}</p>
                    <blockquote className="description-block__quote">
                        "{agent.catchphrase}"
                    </blockquote>
                </div>
            </section>

            {/* Action Bar */}
            <div className="profile-actions">
                <Link to={`/chat/${agent.id}`} className="btn btn--primary">
                    💬 Chat with {agent.name}
                </Link>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {agent.personality.map(trait => (
                        <span key={trait} className="badge">{trait}</span>
                    ))}
                </div>
            </div>

            {/* Skins (if available) */}
            {agent.skins && agent.skins.length > 0 && (
                <section id="skins" className="agent-profile__section">
                    <h2 className="agent-profile__section-title">🎭 Skins</h2>
                    <div className="skins-row">
                        {agent.skins.map(skin => (
                            <button
                                key={skin}
                                className={`skin-option ${skin === 'Classic' ? 'skin-option--active' : ''}`}
                            >
                                {skin}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="agent-profile__section">
                <h2 className="agent-profile__section-title">📝 About</h2>
                <div className="card">
                    <p style={{ marginBottom: 'var(--space-4)' }}>{agent.description}</p>
                    <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                        "{agent.catchphrase}"
                    </p>
                </div>
            </section>

            <section className="agent-profile__section">
                <h2 className="agent-profile__section-title">⚙️ Customization</h2>
                <div className="card">
                    <div className="form-group">
                        <label className="form-label">Nickname (Override)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder={agent.name}
                            value={customNickname}
                            onChange={(e) => setCustomNickname(e.target.value)}
                        />
                        <p className="form-hint">Call them something else in chat.</p>
                    </div>

                    <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                        <label className="form-label">Custom Instructions</label>
                        <textarea
                            className="form-textarea"
                            rows="4"
                            placeholder="e.g., Always explain things like I'm 5 years old..."
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                        />
                        <p className="form-hint">
                            These instructions are appended to every prompt.
                        </p>
                    </div>

                    <button
                        className="btn btn--primary"
                        style={{ marginTop: 'var(--space-4)' }}
                        onClick={async () => {
                            setIsSaving(true)
                            try {
                                await configApi.updateConfig(agent.id, {
                                    nickname: customNickname,
                                    customInstructions
                                })
                                alert('Settings saved!')
                            } catch (err) {
                                alert('Failed to save settings')
                            } finally {
                                setIsSaving(false)
                            }
                        }}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </section>

            <section id="voice" className="agent-profile__section">
                <h2 className="agent-profile__section-title">🎤 Voice</h2>
                <div className="voice-selector">
                    <div className="voice-selector__current">
                        <div className="voice-selector__name">{voiceName}</div>
                        <div className="voice-selector__provider">via ElevenLabs</div>
                    </div>
                    <button className="btn btn--secondary">
                        🔊 Preview
                    </button>
                    <button className="btn btn--primary">
                        Change Voice
                    </button>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
                    Browse the ElevenLabs voice library and pick any voice you like.
                </p>
            </section>

            <section id="llm" className="agent-profile__section">
                <h2 className="agent-profile__section-title">🧠 Brain / LLM Model</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                    This is {agent.name}'s underlying AI model — the brain that powers all responses.
                    Oracle sets the default, but you can override it.
                </p>
                <SkillPicker
                    agentId={agent.id}
                    agentName={agent.name}
                    agentColor={agent.id}
                    userTier={userTier}
                    currentSkillId={selectedLlmSkill}
                    onSkillChange={setSelectedLlmSkill}
                    skills={LLM_MODELS}
                />
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
                    Override the default LLM for {agent.name}. Your selection persists across sessions.
                </p>
            </section>

            <section id="training" className="agent-profile__section">
                <h2 className="agent-profile__section-title">📚 Training</h2>
                <div
                    className={`training-dropzone ${isDragOver ? 'training-dropzone--active' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    <div className="training-dropzone__icon">📁</div>
                    <div className="training-dropzone__text">
                        Drop files here to train {agent.name}
                    </div>
                    <div className="training-dropzone__hint">
                        PDFs, text files, images, URLs — they'll be processed and deleted automatically
                    </div>
                </div>

                {learnedFacts.length > 0 && (
                    <div style={{ marginTop: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 500, marginBottom: 'var(--space-3)' }}>
                            Learned Facts ({learnedFacts.length})
                        </h3>
                        <div className="learned-facts">
                            {learnedFacts.map(fact => (
                                <div key={fact.id} className="fact-item">
                                    <span className="fact-item__source">{fact.source}</span>
                                    <span className="fact-item__text">{fact.fact}</span>
                                    <button
                                        className="fact-item__delete"
                                        onClick={() => deleteFact(fact.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="agent-profile__section">
                <h2 className="agent-profile__section-title">⚡ Skills</h2>
                <div className="card">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {agent.skills.map(skill => (
                            <span key={skill} className="badge badge--info">{skill}</span>
                        ))}
                    </div>
                    <p style={{
                        marginTop: 'var(--space-4)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-muted)'
                    }}>
                        Skills are assigned by Oracle and can be upgraded based on your subscription tier.
                    </p>
                </div>
            </section>
        </div>
    )
}

function getDefaultVoice(agentId) {
    const voices = {
        vesper: 'Lily',
        mei: 'Sarah',
        hanna: 'Charlotte',
        it: 'Daniel',
        sally: 'Gigi',
        oracle: 'Josh',
    }
    return voices[agentId] || 'Default'
}

function formatStatName(stat) {
    return stat
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
}

export default AgentProfilePage
