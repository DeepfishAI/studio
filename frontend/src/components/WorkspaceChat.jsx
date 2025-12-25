import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

function WorkspaceChat({ onApplyCode, currentFile, currentContent }) {
    const { user } = useAuth()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [selectedAgent, setSelectedAgent] = useState('mei')
    const [chatId] = useState(() => `workspace-${Date.now()}`)
    const messagesEndRef = useRef(null)

    const agents = [
        { id: 'mei', name: 'Mei', emoji: '📋', desc: 'Project Manager' },
        { id: 'it', name: 'IT', emoji: '💻', desc: 'Developer' },
        { id: 'hanna', name: 'Hanna', emoji: '🎨', desc: 'Designer' },
        { id: 'glitch', name: 'Glitch', emoji: '🕹️', desc: 'Game Developer' },
    ]

    // Scroll to bottom when messages change
    useEffect(() => {
        const container = document.querySelector('.workspace-chat__messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages])

    // Initial welcome message
    useEffect(() => {
        const welcomeMsg = {
            id: 'welcome',
            agent: 'mei',
            agentName: 'Mei',
            content: "Welcome to your workspace! 🐟 I'm here to help you build something amazing.",
            timestamp: new Date()
        }
        setMessages([welcomeMsg])
    }, [])

    // Poll for transcript/bus events
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const transcriptData = await api.getTranscript(chatId);
                const busEvents = transcriptData.transcript || [];

                if (busEvents.length > 0) {
                    setMessages(prev => {
                        // Merge bus events into messages without duplicates
                        const newMsgs = [...prev];
                        busEvents.forEach(event => {
                            const eventId = `bus-${event.timestamp}`;
                            if (!newMsgs.find(m => m.id === eventId)) {
                                newMsgs.push({
                                    id: eventId,
                                    agent: event.agentId,
                                    agentName: agents.find(a => a.id === event.agentId)?.name || event.agentId,
                                    content: formatBusContent(event),
                                    timestamp: new Date(event.timestamp),
                                    isBusEvent: true,
                                    type: event.type
                                });
                            }
                        });
                        return newMsgs.sort((a, b) => a.timestamp - b.timestamp);
                    });
                }
            } catch (err) {
                // Ignore background poll errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [chatId]);

    const formatBusContent = (event) => {
        if (event.type === 'HANDOFF') {
            return `Delegated to **${event.toAgentId}**: ${event.content?.task || 'Work package'}`;
        }
        if (event.type === 'COMPLETE') {
            return `Finished task for **${event.taskId}**.`;
        }
        return event.content || '';
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = {
            id: Date.now(),
            agent: 'user',
            agentName: user?.email?.split('@')[0] || 'You',
            content: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        const currentInput = input
        setInput('')
        setIsLoading(true)

        try {
            // Build context with current workspace state
            const workspaceContext = `
[WORKSPACE CONTEXT]
Current file: ${currentFile}
Current file content:
\`\`\`
${currentContent?.slice(0, 2000) || '(empty)'}
\`\`\`

User is working in a code workspace. If they ask for code, provide it in a format that can be applied to files.
When providing code, wrap it in a code block and specify the filename like this:
\`\`\`javascript:app.js
// your code here
\`\`\`
`
            const fullMessage = `${workspaceContext}\n\nUser request: ${currentInput}`

            // Send to backend API
            const response = await api.sendMessage(fullMessage, selectedAgent, chatId)

            // Parse the response for code blocks
            const codeBlock = extractCodeBlock(response.response || response.message || '')

            const agentResponse = {
                id: Date.now() + 1,
                agent: selectedAgent,
                agentName: agents.find(a => a.id === selectedAgent)?.name || selectedAgent,
                content: cleanResponse(response.response || response.message || 'I received your message!'),
                timestamp: new Date(),
                codeBlock: codeBlock
            }

            setMessages(prev => [...prev, agentResponse])

        } catch (error) {
            console.error('[WorkspaceChat] Error:', error)

            // Show error as message
            const errorMsg = {
                id: Date.now() + 1,
                agent: 'system',
                agentName: 'System',
                content: `⚠️ Connection error: ${error.message}. Make sure the backend is running on localhost:3001.`,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    // Extract code blocks from response
    const extractCodeBlock = (text) => {
        // Match ```language:filename or ```language pattern
        const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/
        const match = text.match(codeBlockRegex)

        if (match) {
            const language = match[1] || 'javascript'
            let filename = match[2] || null
            const code = match[3].trim()

            // If no filename specified, guess from language
            if (!filename) {
                const extMap = {
                    javascript: 'app.js',
                    js: 'app.js',
                    html: 'index.html',
                    css: 'styles.css',
                    python: 'main.py',
                    typescript: 'app.ts',
                }
                filename = extMap[language.toLowerCase()] || 'code.txt'
            }

            return { filename, language, code }
        }

        return null
    }

    // Remove code blocks from displayed message
    const cleanResponse = (text) => {
        if (typeof text !== 'string') return '[Complex Data]';
        return text
            .replace(/```[\s\S]*?```/g, '[Code provided below]')
            .trim()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="workspace-chat">
            {/* Agent selector */}
            <div className="workspace-chat__agents">
                {agents.map(agent => (
                    <button
                        key={agent.id}
                        className={`workspace-chat__agent-btn ${selectedAgent === agent.id ? 'workspace-chat__agent-btn--active' : ''}`}
                        onClick={() => setSelectedAgent(agent.id)}
                        title={agent.desc}
                    >
                        {agent.emoji} {agent.name}
                    </button>
                ))}
            </div>

            {/* Messages */}
            <div className="workspace-chat__messages">
                {messages.map(msg => (
                    <div key={msg.id} className="workspace-chat__script-line">
                        <span className="workspace-chat__script-agent" style={{
                            color: msg.agent === 'user' ? 'var(--color-accent-blue)' :
                                msg.agent === 'mei' ? 'var(--color-mei)' :
                                    msg.agent === 'it' ? 'var(--color-it)' :
                                        msg.agent === 'hanna' ? 'var(--color-hanna)' :
                                            'var(--color-text-secondary)'
                        }}>
                            {msg.agentName}:
                        </span>
                        <span className="workspace-chat__script-content">
                            {msg.content}
                        </span>
                        {msg.codeBlock && (
                            <div className="workspace-chat__code-block">
                                <div className="workspace-chat__code-header">
                                    <span>{msg.codeBlock.filename}</span>
                                    <button
                                        className="btn btn--primary btn--sm"
                                        onClick={() => onApplyCode(msg.codeBlock.filename, msg.codeBlock.code)}
                                    >
                                        ✨ Apply
                                    </button>
                                </div>
                                <pre className="workspace-chat__code-content">
                                    <code>{msg.codeBlock.code}</code>
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="workspace-chat__message workspace-chat__message--agent">
                        <div className="workspace-chat__typing">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="workspace-chat__input-area">
                <textarea
                    className="workspace-chat__input"
                    placeholder={`Ask ${agents.find(a => a.id === selectedAgent)?.name} to write code...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                />
                <button
                    className="btn btn--primary workspace-chat__send"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                >
                    Send
                </button>
            </div>
        </div>
    )
}

export default WorkspaceChat
