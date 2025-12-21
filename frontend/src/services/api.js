// API service for communicating with backend
const API_BASE = import.meta.env.VITE_API_URL || ''

export const api = {
    /**
     * Send a message and get agent response
     * Routes: User → Vesper → Mei → Workers
     */
    async sendMessage(message, agentId, chatId) {
        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, agentId, chatId }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return response.json()
        } catch (error) {
            console.error('[API] sendMessage error:', error)
            throw error
        }
    },

    /**
     * Get chat history for a specific chat
     */
    async getChatHistory(chatId) {
        try {
            const response = await fetch(`${API_BASE}/api/chat/${chatId}`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[API] getChatHistory error:', error)
            throw error
        }
    },

    /**
     * Get bus transcript for debugging
     */
    async getTranscript(chatId) {
        try {
            const response = await fetch(`${API_BASE}/api/chat/${chatId}/transcript`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[API] getTranscript error:', error)
            throw error
        }
    },

    /**
     * Get list of available agents
     */
    async getAgents() {
        try {
            const response = await fetch(`${API_BASE}/api/chat/agents`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[API] getAgents error:', error)
            throw error
        }
    },

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await fetch(`${API_BASE}/health`)
            if (!response.ok) {
                return { status: 'offline' }
            }
            return response.json()
        } catch (error) {
            return { status: 'offline', error: error.message }
        }
    },

    // Agent endpoints
    async getAgent(agentId) {
        const response = await fetch(`${API_BASE}/api/agents/${agentId}`)
        return response.json()
    },

    async updateAgentVoice(agentId, voiceId) {
        const response = await fetch(`${API_BASE}/api/agents/${agentId}/voice`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voiceId }),
        })
        return response.json()
    },

    // Training endpoints
    async uploadTrainingFile(agentId, file) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${API_BASE}/api/agents/${agentId}/training`, {
            method: 'POST',
            body: formData,
        })
        return response.json()
    },

    async getLearnedFacts(agentId) {
        const response = await fetch(`${API_BASE}/api/agents/${agentId}/facts`)
        return response.json()
    },

    async deleteFact(agentId, factId) {
        const response = await fetch(`${API_BASE}/api/agents/${agentId}/facts/${factId}`, {
            method: 'DELETE',
        })
        return response.json()
    },

    // Voice endpoints (ElevenLabs)
    async getAvailableVoices() {
        const response = await fetch(`${API_BASE}/api/voices`)
        return response.json()
    },

    async previewVoice(voiceId, text) {
        const response = await fetch(`${API_BASE}/api/voices/${voiceId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        })
        return response.blob()
    },

    // Skill catalog
    async getSkillCatalog() {
        const response = await fetch(`${API_BASE}/api/skills`)
        return response.json()
    },

    // User endpoints
    async getCurrentUser() {
        const response = await fetch(`${API_BASE}/api/user`)
        return response.json()
    },

    async getUserTier() {
        const response = await fetch(`${API_BASE}/api/user/tier`)
        return response.json()
    },

    /**
     * Generate TTS audio for a given text
     */
    async generateTts(text, agentId) {
        try {
            const response = await fetch(`${API_BASE}/api/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, agentId }),
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[API] generateTts error:', error)
            throw error
        }
    },
}

export default api
