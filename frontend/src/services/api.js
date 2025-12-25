// API service for communicating with backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
     * Get products from catalog
     */
    async getProducts() {
        const response = await fetch(`${API_BASE}/api/products`)
        return response.json()
    },

    /**
     * Purchase a product
     */
    async purchaseProduct(productId) {
        const response = await fetch(`${API_BASE}/api/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
        })
        return response.json()
    },

    /**
     * Send command to CLI endpoint
     */
    async cliCommand(command) {
        try {
            const response = await fetch(`${API_BASE}/api/cli`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            return response.json()
        } catch (error) {
            console.error('[API] cliCommand error:', error)
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
            const response = await fetch(`${API_BASE}/api/agents`)
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
}

// Workspace API
export const getWorkspaceFiles = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/workspace/files`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error('[API] getWorkspaceFiles error:', error);
        throw error;
    }
};

export const getFileContent = async (filePath) => {
    try {
        const response = await fetch(`${API_BASE}/api/workspace/file?path=${encodeURIComponent(filePath)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error('[API] getFileContent error:', error);
        throw error;
    }
};

export const saveFileContent = async (filePath, content) => {
    try {
        const response = await fetch(`${API_BASE}/api/workspace/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error('[API] saveFileContent error:', error);
        throw error;
    }
};

export default api
