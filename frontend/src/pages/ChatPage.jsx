import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { agents, getAgent } from '../data/agents'
import api from '../services/api'
import AgentContextMenu from '../components/AgentContextMenu'

function ChatPage() {
    const { agentId } = useParams()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [chatId, setChatId] = useState(null)
    const [useRealApi, setUseRealApi] = useState(false)
    const messagesEndRef = useRef(null)

    // Default to Mei if no agent specified
    const currentAgent = getAgent(agentId) || getAgent('mei')

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Check if backend is available
    useEffect(() => {
        api.healthCheck().then(result => {
            setUseRealApi(result.status === 'ok')
            console.log(`[Chat] Backend status: ${result.status}`)
        })
    }, [])

    // Reset messages when agent changes
    useEffect(() => {
        setMessages([])
        setChatId(null)
    }, [agentId])

    // Welcome message on mount
    useEffect(() => {
        if (messages.length === 0 && currentAgent) {
            const welcomeMessage = getWelcomeMessage(currentAgent)
            setMessages([{
                id: 1,
                type: 'agent',
                agent: currentAgent,
                text: welcomeMessage,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }])
        }
    }, [currentAgent, messages.length])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!input.trim()) return

        const userMessage = {
            id: messages.length + 1,
            type: 'user',
            text: input.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        setMessages(prev => [...prev, userMessage])
        const userInput = input.trim()
        setInput('')
        setIsTyping(true)

        try {
            let responseText
            let respondingAgentId = currentAgent.id

            if (useRealApi) {
                const result = await api.sendMessage(userInput, currentAgent.id, chatId)
                responseText = result.response
                respondingAgentId = result.agentId || currentAgent.id
                if (result.chatId) {
                    setChatId(result.chatId)
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
                responseText = getSimulatedResponse(currentAgent, userInput)
            }

            const respondingAgent = getAgent(respondingAgentId) || currentAgent

            const agentResponse = {
                id: messages.length + 2,
                type: 'agent',
                agent: respondingAgent,
                text: responseText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, agentResponse])

        } catch (error) {
            console.error('[Chat] Error:', error)
            const agentResponse = {
                id: messages.length + 2,
                type: 'agent',
                agent: currentAgent,
                text: getSimulatedResponse(currentAgent, userInput),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, agentResponse])
        } finally {
            setIsTyping(false)
        }
    }

    return (
        <div className="chat-page">
            {/* Header */}
            <header className="chat-header">
                <AgentContextMenu agentId={currentAgent.id} agentName={currentAgent.name}>
                    <img
                        src={currentAgent.portrait}
                        alt={currentAgent.name}
                        className="chat-header__avatar"
                        style={{ cursor: 'context-menu' }}
                        onError={(e) => {
                            e.target.style.background = `var(--color-${currentAgent.id})`
                        }}
                    />
                </AgentContextMenu>
                <div className="chat-header__info">
                    <h2 className="chat-header__name">{currentAgent.name}</h2>
                    <div className="chat-header__status">
                        {isTyping ? (
                            <>Typing...</>
                        ) : (
                            <>
                                <span className="online-dot"></span>
                                {currentAgent.title}
                                {useRealApi && <span style={{ marginLeft: '8px', color: 'var(--color-success)' }}>• Connected</span>}
                            </>
                        )}
                    </div>
                </div>
                <Link to={`/agents/${currentAgent.id}`} className="btn btn--secondary btn--sm">
                    View Profile
                </Link>
            </header>

            {/* Messages */}
            <div className="chat-messages">
                {messages.map(message => (
                    <div key={message.id} className={`message message--${message.type}`}>
                        {message.type === 'agent' && (
                            <img
                                src={message.agent.portrait}
                                alt={message.agent.name}
                                className="message__avatar"
                            />
                        )}
                        <div>
                            <div className="message__content">{message.text}</div>
                            <div className="message__time">{message.time}</div>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="message message--agent">
                        <img
                            src={currentAgent.portrait}
                            alt={currentAgent.name}
                            className="message__avatar"
                        />
                        <div className="message__content">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="chat-input" onSubmit={handleSubmit}>
                <textarea
                    className="chat-input__field"
                    placeholder={`Message ${currentAgent.name}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit(e)
                        }
                    }}
                    rows={1}
                />
                <button
                    type="submit"
                    className="chat-input__send"
                    disabled={!input.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    )
}

function getWelcomeMessage(agent) {
    const messages = {
        vesper: "DeepFish studios... Vesper speaking. *files nails* How can I help you today, honey?",
        mei: "Hi there! I'm Mei, your project manager. What are we working on today? I'll break it down and get the right people on it.",
        hanna: "Hey! I'm Hanna, Creative Director. I'd love to hear about your project. What kind of visual experience are you looking for?",
        it: "IT here. Principal Architect. What system do you need built? I'll assess the requirements and provide an architecture recommendation.",
        sally: "Hey! Sally here, Marketing & SEO. Let's talk growth. What are you trying to achieve and who's your target audience?",
        oracle: "I have been expecting you. I am Oracle, the Seer. I watch over the skill catalog... ensuring your team is always equipped with optimal capabilities. What wisdom do you seek?",
    }
    return messages[agent.id] || "Hello! How can I help you today?"
}

function getSimulatedResponse(agent, userInput) {
    const responses = {
        mei: [
            `Got it! Let me break this down into manageable tasks...`,
            `I'll coordinate with the team on this. Hanna might be perfect for the visual aspects, and IT can handle the technical implementation.`,
            `Understood. I'm dispatching this to the appropriate team members now. You'll see progress updates as we go.`,
        ],
        hanna: [
            `Interesting! Let me think about the visual hierarchy here...`,
            `I'm seeing possibilities here. Would you prefer a minimalist approach or something more dynamic?`,
            `I love this direction. Let me sketch out some concepts.`,
        ],
        it: [
            `Analyzing requirements... This looks like a standard implementation with some custom logic.`,
            `I'll architect this with scalability in mind.`,
            `Zero ambiguity. I'll have a working prototype ready for review shortly.`,
        ],
        sally: [
            `Let me analyze the competitive landscape first...`,
            `From an SEO perspective, there are several opportunities here.`,
            `Great! I'll put together a growth strategy with measurable KPIs.`,
        ],
        vesper: [
            `*sips coffee* Sounds like you need to talk to Mei about that. Want me to patch you through?`,
            `Mmm, I can connect you to the right person. Just give me the details.`,
            `Oh, you again. *smiles* What is it this time?`,
        ],
        oracle: [
            `I have foreseen this need. The skill catalog has been updated with new capabilities that may serve you well.`,
            `Interesting... The patterns in your request suggest you would benefit from our premium tier skills.`,
            `All is as it should be. I have trained the agents well for this very purpose.`,
        ],
    }

    const agentResponses = responses[agent.id] || responses.mei
    return agentResponses[Math.floor(Math.random() * agentResponses.length)]
}

export default ChatPage
