import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { agents, getAgent } from '../data/agents'
import api from '../services/api'
import AgentContextMenu from '../components/AgentContextMenu'

function ChatPage() {
    const { agentId } = useParams()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [history, setHistory] = useState([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const [tempInput, setTempInput] = useState('')
    const [chatId, setChatId] = useState(null)
    const [useRealApi, setUseRealApi] = useState(false)
    const [voiceEnabled, setVoiceEnabled] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const [volume, setVolume] = useState(1.0)
    const audioRef = useRef(new Audio())
    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)

    // Default to Mei if no agent specified
    const currentAgent = getAgent(agentId) || getAgent('mei')

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            const recognition = new SpeechRecognition()
            recognition.continuous = false
            recognition.interimResults = false
            recognition.lang = 'en-US'

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                setInput(prev => (prev ? `${prev} ${transcript}` : transcript))
                setIsListening(false)
            }

            recognition.onerror = (event) => {
                console.error('[Speech] Error:', event.error)
                setIsListening(false)
            }

            recognition.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current = recognition
        }
    }, [])

    // Update volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume
        }
    }, [volume])

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

        // Add to history (limit to last 50)
        setHistory(prev => [input.trim(), ...prev].slice(0, 50))
        setHistoryIndex(-1)

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

            // Speak if enabled
            if (voiceEnabled) {
                playVoice(responseText, respondingAgentId)
            }

        } catch (error) {
            console.error('[Chat] Error:', error)
            const errorMessage = {
            \n                id: messages.length + 2,
                type: 'agent',
                agent: currentAgent,
                text: `❌ **Error: Unable to connect to ${current Agent.name
            } **\n\n${ error.message || 'Unknown error occurred'
        } \n\nPlease check: \n - API keys are configured\n - Backend service is running\n - Network connection is stable`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsTyping(false)
        }
    }

    const playVoice = async (text, agentId) => {
        try {
            const { url } = await api.generateTts(text, agentId)
            const audioUrl = `${ import.meta.env.VITE_API_URL || '' }${ url } `

            // Stop current audio if playing
            audioRef.current.pause()
            audioRef.current.src = audioUrl
            audioRef.current.play().catch(e => console.warn('[Voice] Playback failed:', e))
        } catch (error) {
            console.error('[Voice] TTS error:', error)
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
                            e.target.style.background = `var(--color - ${ currentAgent.id })`
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
                <div className="chat-header__actions">
                    {/* Volume Control */}
                    {voiceEnabled && (
                        <div className="volume-control" style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                            <span style={{ fontSize: '12px', marginRight: '4px' }}>🔊</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                style={{ width: '60px', accentColor: 'var(--color-primary)' }}
                                title={`Volume: ${ Math.round(volume * 100) }% `}
                            />
                        </div>
                    )}

                    {/* Microphone Toggle */}
                    <button
                        className={`btn btn--circle ${ isListening ? 'btn--danger' : 'btn--secondary' } `}
                        onClick={() => {
                            if (isListening) {
                                recognitionRef.current?.stop()
                            } else {
                                try {
                                    recognitionRef.current?.start()
                                    setIsListening(true)
                                } catch (e) {
                                    console.error("Microphone start failed", e)
                                }
                            }
                        }}
                        title={isListening ? "Stop Recording" : "Speak (Push-to-Talk)"}
                        disabled={!recognitionRef.current}
                    >
                        {isListening ? (
                            <span style={{ textDecoration: 'none' }}>🎤</span> // Active
                        ) : (
                            <span style={{ /* Slash through style or just dimmed */ opacity: 0.5 }}>🎤</span>
                        )}
                    </button>

                    {/* Speaker Toggle */}
                    <button
                        className={`btn btn--circle ${ voiceEnabled ? 'btn--success' : 'btn--secondary' } `}
                        onClick={() => {
                            setVoiceEnabled(!voiceEnabled)
                            if (!voiceEnabled) {
                                // Greet when enabling
                                playVoice(messages[messages.length - 1]?.text || "Voice enabled.", currentAgent.id)
                            } else {
                                audioRef.current.pause()
                            }
                        }}
                        title={voiceEnabled ? "Mute Output" : "Enable Output"}
                    >
                        {voiceEnabled ? '🔊' : '🔇'}
                    </button>
                    <Link to={`/ agents / ${ currentAgent.id } `} className="btn btn--secondary btn--sm">
                        View Profile
                    </Link>
                </div>
            </header>

            {/* Messages */}
            <div className="chat-messages">
                {messages.map(message => (
                    <div key={message.id} className={`message message--${ message.type } `}>
                        {message.type === 'agent' && (
                            <img
                                src={message.agent.portrait}
                                alt={message.agent.name}
                                className="message__avatar"
                            />
                        )}
                        <div>
                            <div className="message__content">
                                {message.type === 'agent' ? (
                                    <ReactMarkdown>{message.text}</ReactMarkdown>
                                ) : (
                                    message.text
                                )}
                            </div>
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
                    placeholder={`Message ${ currentAgent.name }...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit(e)
                        }
                        // Up Arrow: Previous command
                        else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            if (history.length > 0) {
                                const newIndex = Math.min(historyIndex + 1, history.length - 1)
                                if (historyIndex === -1) setTempInput(input)
                                setHistoryIndex(newIndex)
                                setInput(history[newIndex])
                            }
                        }
                        // Down Arrow: Next command
                        else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            if (historyIndex > 0) {
                                const newIndex = historyIndex - 1
                                setHistoryIndex(newIndex)
                                setInput(history[newIndex])
                            } else if (historyIndex === 0) {
                                setHistoryIndex(-1)
                                setInput(tempInput)
                            }
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
